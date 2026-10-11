import json
import math
import random
import unittest
from dataclasses import asdict, replace
from beartrap.model import Member, Mechanics, Strategy, synthetic_roster
from beartrap.simulator import simulate
from beartrap.analysis import compare, calibrate


class SimulatorTests(unittest.TestCase):
    def test_known_single_host_damage_and_cycle(self):
        m = Member("Host",troops=100,march_capacity=50,join_slots=0,rally_capacity=100,
                   host_strength=2,troop_quality=1,outbound_s=0,return_s=0,join_travel_s=0)
        cfg = Mechanics(duration_s=60,countdown_s=10,reaction_s=1,score_per_effective_troop=3)
        r = simulate([m],cfg,Strategy(host_count=1,cadence="synchronized",host_allocation="full"),audit=True)
        self.assertEqual([h["second"] for h in r["hits"]],[10,21,32,43,54])
        self.assertEqual(r["total_damage"],5*50*2*3)

    def test_host_stats_apply_to_joiner_not_account_power(self):
        h = Member("Host",troops=100,march_capacity=100,rally_capacity=200,join_slots=0,
                   outbound_s=0,return_s=0,join_travel_s=0,host_strength=2)
        j = Member("Joiner",troops=100,march_capacity=100,join_slots=1,can_host=False,
                   outbound_s=0,return_s=0,join_travel_s=0,host_strength=80,power_m=999999)
        cfg = Mechanics(duration_s=60,countdown_s=50,reaction_s=1,score_per_effective_troop=1)
        r = simulate([h,j],cfg,Strategy(host_count=1,host_allocation="full",troop_split="concentrated"),True)
        self.assertEqual(r["total_damage"],400)
        self.assertEqual(r["members"][1]["damage"],200)
        low_power = simulate([h,replace(j,power_m=1,historical_score=1)],cfg,Strategy(host_count=1,host_allocation="full",troop_split="concentrated"))
        self.assertEqual(r["total_damage"],low_power["total_damage"])

    def test_leading_is_extra_slot_and_no_duplicate_join(self):
        members = [Member(str(i),troops=300,march_capacity=100,join_slots=1,rally_capacity=500,
                          outbound_s=0,return_s=0,join_travel_s=0) for i in range(3)]
        r = simulate(members,Mechanics(duration_s=60,countdown_s=50,reaction_s=1),Strategy(host_count=3,cadence="synchronized"),True)
        self.assertEqual(sum(m["rallies_led"] for m in r["members"]),3)
        self.assertEqual(sum(m["joins"] for m in r["members"]),3)
        for rally in r["rallies"]:
            ids=[p["member_index"] for p in rally["participants"]]
            self.assertEqual(len(ids),len(set(ids)))

    def test_strict_deadline_rejects_late_credit(self):
        m = Member("H",outbound_s=10,return_s=10,join_slots=0)
        strict = simulate([m],Mechanics(duration_s=60,countdown_s=55),Strategy(host_count=1))
        self.assertEqual(strict["total_damage"],0)
        with self.assertRaises(ValueError):
            simulate([m],Mechanics(duration_s=60,countdown_s=55,deadline="departure"),Strategy(host_count=1))

    def test_last_launch_includes_travel_and_excludes_expiration(self):
        for travel in (8,20):
            members=[Member("Anchor",join_slots=0,host_strength=2,outbound_s=travel),
                     Member("Late host",join_slots=0,host_strength=1,outbound_s=travel)]
            boundary=1800-300-travel
            for start in (boundary-1,boundary,1501):
                # Use a wave-free explicit phase in a short event to exercise the same deadline exactly.
                short_start=start-1200
                r=simulate(members,Mechanics(duration_s=600),Strategy(host_count=2,cadence="custom",spacing_s=short_start))
                late=[h for h in r["hits"] if h["host"]=="Late host"]
                self.assertEqual(bool(late),start==boundary-1)
                self.assertTrue(all(h["second"]<600 for h in r["hits"]))

    def test_returns_prevent_early_reuse(self):
        m = Member("H",troops=100,march_capacity=100,join_slots=0,outbound_s=5,return_s=30)
        r = simulate([m],Mechanics(duration_s=120,countdown_s=10,reaction_s=1),Strategy(host_count=1,host_allocation="full",cadence="synchronized"),True)
        starts=[x["start_s"] for x in r["rallies"]]
        self.assertEqual(starts,[0,46,92])
        self.assertEqual(r["summary"]["rallies"],3)

    def test_join_cannot_arrive_after_countdown(self):
        h = Member("H",join_slots=0,outbound_s=0,return_s=0,join_travel_s=0)
        j = Member("J",can_host=False,join_travel_s=11)
        r = simulate([h,j],Mechanics(duration_s=60,countdown_s=10),Strategy(host_count=1),True)
        self.assertEqual(r["members"][1]["damage"],0)

    def test_capacity_join_cap_and_score_conservation(self):
        members = synthetic_roster(n=12)
        cfg=Mechanics(duration_s=600,countdown_s=60,joiner_cap=3)
        for cadence in ("synchronized","staggered","waves","custom"):
            for allocation in ("equal","full","small"):
                r=simulate(members,cfg,Strategy(host_count=7,cadence=cadence,host_allocation=allocation,final_push=True),True)
                self.assertAlmostEqual(r["total_damage"],sum(m["damage"] for m in r["members"]),delta=.00001)
                self.assertAlmostEqual(r["total_damage"],sum(h["damage"] for h in r["hits"]),delta=.00001)
                self.assertAlmostEqual(r["total_damage"],sum(p["damage"] for p in r["contributions"]),delta=.00001)
                self.assertTrue(all(h["second"]<=600 for h in r["hits"]))
                self.assertTrue(all(0<=m["troop_utilization"]<=1 for m in r["members"]))

    def test_randomized_resource_invariants(self):
        rng=random.Random(42)
        for _ in range(20):
            members=[Member(str(i),troops=rng.randint(1,300000),march_capacity=rng.randint(100,100000),
                            join_slots=rng.randint(0,5),rally_capacity=rng.randint(100,500000),
                            host_strength=rng.uniform(.5,5),outbound_s=rng.randint(0,20),
                            return_s=rng.randint(0,20),join_travel_s=rng.randint(0,20)) for i in range(8)]
            r=simulate(members,Mechanics(duration_s=180,countdown_s=30,joiner_cap=4),
                       Strategy(host_count=5,cadence=rng.choice(["staggered","waves","synchronized"]),
                                host_allocation=rng.choice(["equal","small","full"]),
                                troop_split=rng.choice(["equal","concentrated"])),True)
            self.assertTrue(math.isfinite(r["total_damage"]))

    def test_one_common_calibration_scale(self):
        r=compare({"synthetic":{"n":8},"host_count":4,"normalization":{"enabled":True,"target":2e9}})
        self.assertAlmostEqual(r["runs"][0]["total_damage"],2e9,delta=.001)
        self.assertTrue(any(abs(x["total_damage"]-2e9)>1 for x in r["runs"][1:]))
        cfg=Mechanics.parse(r["mechanics"])
        members=[Member.parse(x) for x in r["roster"]]
        again=simulate(members,cfg,Strategy.parse(r["runs"][3]["strategy"]))
        self.assertEqual(again["total_damage"],r["runs"][3]["total_damage"])

    def test_report_calibration(self):
        r=calibrate({"score_scale":100,"reports":[{"host":"H","troops":50000,"damage":10000000},
                                                               {"host":"H","troops":50000,"damage":12000000}]})
        self.assertAlmostEqual(r["hosts"][0]["host_strength"],2.2)
        self.assertEqual(r["hosts"][0]["reports"],2)

    def test_invalid_roster(self):
        for bad in ({"name":"H","troops":-1},{"name":"H","join_slots":1.5},
                    {"name":"H","host_strength":float('nan')},{"name":"H","can_host":"maybe"}):
            with self.assertRaises(ValueError):
                Member.parse(bad)
        with self.assertRaises(ValueError):
            simulate([Member("X"),Member("X")])

    def test_import_export_round_trip(self):
        members=synthetic_roster(4)
        loaded=[Member.parse(r) for r in json.loads(json.dumps([asdict(m) for m in members]))]
        self.assertEqual(loaded,members)

    def test_synthetic_troops_respect_requested_bounds(self):
        members=synthetic_roster(12,troops_min=10000,troops_max=20000)
        self.assertTrue(all(10000<=m.troops<=20000 for m in members))


if __name__ == '__main__':
    unittest.main()
