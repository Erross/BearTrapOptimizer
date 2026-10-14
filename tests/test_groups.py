import unittest
from dataclasses import replace
from beartrap.model import Member, Mechanics, Strategy, synthetic_roster
from beartrap.simulator import simulate
from beartrap.analysis import search

class GroupTests(unittest.TestCase):
    def roster(self,n=32):
        return [Member(f'P{i:02d}',troops=100000,march_capacity=20000,join_slots=5,rally_capacity=500000) for i in range(n)]
    def test_opening_groups_and_reserved_stock(self):
        ms=self.roster();s=Strategy(host_count=32,cadence='groups',group_size=10,wave_interval_s=60,host_allocation='small',reserve_lead_troops=True)
        r=simulate(ms,Mechanics(),s,audit=True)
        self.assertEqual(list(r['initial_starts'].values()),[0]*10+[60]*10+[120]*10+[180]*2)
        self.assertEqual(r['summary']['starters_without_first_rally'],0)
        self.assertGreater(r['summary']['reserved_troop_seconds'],0)
        self.assertEqual(r['summary']['committed_at_240s'],3200000)
    def test_shared_clock_and_too_short_period(self):
        ms=self.roster();s=Strategy(host_count=32,cadence='groups',group_repeat='fixed',host_allocation='small',reserve_lead_troops=True)
        r=simulate(ms,Mechanics(),s,audit=True)
        self.assertEqual(r['group_cycle_s'],360)
        self.assertEqual([x['start_s'] for x in r['rallies'] if x['host']=='P00'],[0,360,720,1080,1440])
        with self.assertRaises(ValueError):simulate(ms,Mechanics(),replace(s,wave_cycle_s=300))
    def test_nearer_opening_groups_keep_the_selected_leaders(self):
        ms=[replace(m,host_strength=i+1,outbound_s=t,return_s=t,join_slots=0)
            for i,(m,t) in enumerate(zip(self.roster(6),[1,40,10,30,10,20]))]
        c=Mechanics(duration_s=600,countdown_s=60)
        for cadence in ('groups','waves'):
            s=Strategy(host_count=5,cadence=cadence,opening_wave_count=3,wave_interval_s=30)
            r=simulate(ms,c,s,audit=True)
            # P00 is nearest but is still outside the five strongest leaders.
            self.assertEqual(r['selected_hosts'],['P04','P02','P05','P03','P01'])
            starts=r['planned_initial_starts']
            self.assertLess(starts['P04'],starts['P03'])
            self.assertLessEqual(starts['P03'],starts['P01'])
            self.assertEqual(r['initial_starts'],starts)
        explicit=simulate(ms,c,replace(s,host_names=('P01','P02','P03')),audit=True)
        self.assertEqual(explicit['selected_hosts'],['P02','P03','P01'])
    def test_hard_starter_rules_also_apply_to_final_push(self):
        ms=[replace(m,host_strength=i+1,rally_capacity=200000+i*100000) for i,m in enumerate(self.roster(5))]
        r=simulate(ms,Mechanics(),Strategy(host_count=1,host_min_relative_score=60,host_min_rally_capacity=500000,final_push=True),audit=True)
        self.assertTrue(all(x['host'] in ('P03','P04') for x in r['rallies']))
        self.assertEqual(r['host_eligibility'][0]['reason'],'Below minimum rally capacity')
    def test_waiting_counts_capacity_blocked_troops(self):
        ms=self.roster(8);c=Mechanics(duration_s=120,countdown_s=60,joiner_cap=2)
        blocked=simulate(ms,c,Strategy(host_count=1,reserve_lead_troops=True),audit=True)
        covered=simulate(ms,c,Strategy(host_count=8,cadence='synchronized',reserve_lead_troops=True),audit=True)
        self.assertGreater(blocked['summary']['ready_wait_troop_seconds'],covered['summary']['ready_wait_troop_seconds'])
    def test_type_reservations_and_unequal_capacities(self):
        ms=[replace(m,infantry=20000,cavalry=20000,archers=60000,rally_capacity=45000+i*30000) for i,m in enumerate(self.roster(8))]
        for policy in ('strict','adaptive','optimized'):
            r=simulate(ms,Mechanics(duration_s=400,countdown_s=60),Strategy(host_count=8,cadence='groups',group_size=3,wave_interval_s=30,reserve_lead_troops=True,formation=policy),audit=True)
            self.assertTrue(all(x['hit_s']<400 for x in r['rallies']))
    def test_prescriptive_search_feasibility_damage_floor(self):
        rows=[{'name':m.name,'troops':m.troops,'march_capacity':m.march_capacity,'rally_capacity':m.rally_capacity} for m in self.roster(4)]
        p={'roster':rows,'mechanics':{'duration_s':120,'countdown_s':30},'search_goal':'balanced','opening_limit_s':60}
        r=search(p)
        self.assertLessEqual(len(r['tested']),420)
        self.assertEqual(r['best']['summary']['starters_without_first_rally'],0)
        self.assertLessEqual(r['best']['summary']['opening_last_start_s'],60)
        self.assertGreaterEqual(r['best']['total_damage'],.95*r['best_damage']['total_damage'])
        eligible=[x for x in r['tested'] if x['opening_feasible'] and x['total_damage']>=.95*r['best_damage']['total_damage']]
        self.assertEqual(r['best']['summary']['ready_wait_fraction'],min(x['ready_wait_fraction'] for x in eligible))
    def test_demo_spread_is_configurable_and_town_label_is_not_damage(self):
        ms=synthetic_roster(4,rally_capacity_min=450000,rally_capacity_max=1000000,march_capacity_min=45301,march_capacity_max=140000,tier_min=8,tier_max=10,attack_min=50,attack_max=250,lethality_min=25,lethality_max=200)
        self.assertEqual((ms[0].rally_capacity,ms[-1].rally_capacity),(450000,1000000))
        self.assertEqual((ms[0].archers_attack_bonus,ms[-1].archers_attack_bonus),(50,250))
        self.assertEqual(simulate(ms)['total_damage'],simulate([replace(m,town_level=30,power_m=1) for m in ms])['total_damage'])
