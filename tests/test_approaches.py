import unittest
from dataclasses import replace
from beartrap.analysis import compare
from beartrap.model import Member, Mechanics, Strategy
from beartrap.profiles import profile_roster
from beartrap.simulator import simulate


class ApproachTests(unittest.TestCase):
    def test_top_four_has_a_core_group_and_separate_leaders(self):
        data=profile_roster({'n':40})
        self.assertEqual([b['players'] for b in data['profile']['bands']],[8,18,10,4])
        members=[Member.parse(row) for row in data['roster']]
        self.assertEqual((members[0].power_m,members[-1].power_m),(20,160))
        self.assertEqual((members[0].rally_capacity,members[-1].rally_capacity),(450000,1000000))
        self.assertTrue(all(m.troop_quality==1 and m.host_strength==1 for m in members))
        baseline=simulate(members,Mechanics(duration_s=120,countdown_s=30,damage_model='sqrt'))
        relabelled=simulate([replace(m,town_level=99,power_m=9999) for m in members],Mechanics(duration_s=120,countdown_s=30,damage_model='sqrt'))
        self.assertEqual(baseline['total_damage'],relabelled['total_damage'])

    def test_exact_wave_count_for_uneven_leader_groups(self):
        members=[Member(f'P{i}',troops=100000,march_capacity=20000) for i in range(5)]
        settings=Strategy(host_count=5,cadence='groups',opening_wave_count=4,group_size=2,
                          wave_interval_s=30,host_allocation='small',reserve_lead_troops=True)
        run=simulate(members,Mechanics(duration_s=300,countdown_s=30),settings,audit=True)
        self.assertEqual(list(run['initial_starts'].values()),[0,0,30,60,90])
        self.assertEqual(len(set(run['initial_starts'].values())),4)
        # More requested waves than actual leaders still creates one group per leader.
        run=simulate(members,Mechanics(duration_s=300,countdown_s=30),replace(settings,opening_wave_count=20),audit=True)
        self.assertEqual(list(run['initial_starts'].values()),[0,30,60,90,120])

    def test_voluntary_join_cap_does_not_cap_leader_troops(self):
        members=[Member(f'P{i}',troops=200000,march_capacity=100000,rally_capacity=450000) for i in range(8)]
        settings=Strategy(host_count=8,cadence='synchronized',host_allocation='full',troop_split='concentrated',join_march_cap=25000)
        run=simulate(members,Mechanics(duration_s=300,countdown_s=60),settings,audit=True)
        self.assertTrue(run['contributions'])
        self.assertTrue(all(p['troops']<=25000 for p in run['contributions'] if p['role']=='join'))
        self.assertTrue(all(p['troops']==100000 for p in run['contributions'] if p['role']=='lead'))
        self.assertTrue(all(r['troops']<=450000 and len(r['participants'])<=15 for r in run['rallies']))
        unlimited=simulate(members,Mechanics(duration_s=300,countdown_s=60),replace(settings,join_march_cap=0),audit=True)
        self.assertTrue(any(p['troops']>25000 for p in unlimited['contributions'] if p['role']=='join'))

    def test_named_comparisons_share_one_baseline_and_preserve_order(self):
        rows=profile_roster({'n':8})['roster']
        settings=[{'name':'Everyone together','host_count':8,'cadence':'synchronized'},
                  {'name':'Selected waves','host_count':4,'cadence':'groups','opening_wave_count':2,'wave_interval_s':30,'reserve_lead_troops':True,'host_allocation':'small'},
                  {'name':'Selected capped','host_count':4,'cadence':'groups','opening_wave_count':2,'wave_interval_s':30,'reserve_lead_troops':True,'host_allocation':'small','join_march_cap':25000}]
        data=compare({'roster':rows,'mechanics':{'duration_s':240,'countdown_s':60,'damage_model':'sqrt'},'strategies':settings})
        self.assertEqual([r['strategy']['name'] for r in data['runs']],[s['name'] for s in settings])
        self.assertAlmostEqual(data['runs'][0]['total_damage'],2e9,places=4)
        self.assertTrue(all(h['hit_s']<240 for r in data['runs'] for h in r['rallies']))
        for invalid in ([],[settings[0],settings[0]]):
            with self.assertRaises(ValueError):compare({'roster':rows,'strategies':invalid})

    def test_profile_and_policy_inputs_are_validated(self):
        for payload in ({'profile':'unknown'},{'n':1},{'n':2.5},{'join_slots':11}):
            with self.assertRaises(ValueError):profile_roster(payload)
        for settings in ({'join_march_cap':-1},{'join_march_cap':1.2},{'opening_wave_count':101}):
            with self.assertRaises(ValueError):Strategy.parse(settings)
