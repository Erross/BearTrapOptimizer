import math
import unittest
from dataclasses import replace, asdict
from beartrap.model import Member, Mechanics, Strategy
from beartrap.combat import TYPES, inventory, coefficients, allocate, effective_components, formation_plan
from beartrap.simulator import simulate
from beartrap.analysis import calibrate


class CombatTests(unittest.TestCase):
    def setUp(self):
        self.m = Member('Player', troops=226505, infantry=90602, cavalry=56626, archers=79277)
        self.cfg = Mechanics(damage_model='sqrt', score_per_effective_troop=1)

    def test_coefficients_and_host_bonuses(self):
        m = replace(self.m, infantry_tier=9, cavalry_tier=9, archers_tier=9)
        w = coefficients(m,m,self.cfg)
        self.assertAlmostEqual(w['cavalry']/w['infantry'],3)
        self.assertAlmostEqual(w['archers']/w['infantry'],4.4)
        h = replace(m, archers_attack_bonus=100, archers_lethality_bonus=50)
        self.assertAlmostEqual(coefficients(m,h,self.cfg)['archers']/w['archers'],3)
        self.assertEqual(coefficients(replace(m,power_m=999999),h,self.cfg), coefficients(m,h,self.cfg))

    def test_published_t6_worked_example(self):
        m=Member('Example',troops=18000,infantry=6000,cavalry=6000,archers=6000,
                 infantry_tier=6,cavalry_tier=6,archers_tier=6)
        c=replace(self.cfg,bear_attack_bonus=25)
        effective=sum(effective_components(inventory(m),m,m,c).values())
        # Restore the published example's common battle constants and ten rounds.
        conversion=339/math.sqrt(10)*(10/100)/(83.3333*10/100)/100*10
        self.assertEqual(math.ceil(effective*conversion),16797)

    def test_leader_selection_uses_type_bonuses_on_reference_troops(self):
        plain=replace(self.m,name='Plain',host_strength=2,join_slots=0)
        buffed=replace(self.m,name='Buffed',host_strength=.8,archers_attack_bonus=200,
                       archers_lethality_bonus=200,join_slots=0)
        r=simulate([plain,buffed],self.cfg,Strategy(host_count=1))
        self.assertEqual(r['selected_hosts'],['Buffed'])

    def test_square_root_size_effect_and_small_march_boundary(self):
        m = replace(self.m, troop_quality=1)
        low = effective_components(dict(infantry=0,cavalry=0,archers=10000),m,m,self.cfg)['archers']
        high = effective_components(dict(infantry=0,cavalry=0,archers=40000),m,m,self.cfg)['archers']
        self.assertAlmostEqual(high/low,2)
        tiny = effective_components(dict(infantry=0,cavalry=0,archers=1000),m,m,self.cfg)['archers']
        doubled = effective_components(dict(infantry=0,cavalry=0,archers=2000),m,m,self.cfg)['archers']
        self.assertAlmostEqual(doubled/tiny,2)

    def test_strict_ratio_can_leave_troops_unused(self):
        p = formation_plan(dict(member=asdict(self.m),mechanics=asdict(self.cfg),marches=5,march_size=45301))
        plans = {x['formation']:x for x in p['plans']}
        self.assertEqual(sum(plans['inventory']['used'].values()),226505)
        self.assertLess(sum(plans['strict']['used'].values()),100000)
        self.assertEqual(p['full_target_marches'],2)
        self.assertEqual(p['needed_for_target']['archers'],181205)
        self.assertEqual(sum(plans['adaptive']['used'].values()),226505)

    def test_large_inventory_can_fill_five_full_archer_heavy_marches(self):
        m = replace(self.m,troops=1500000,infantry=600000,cavalry=375000,archers=525000)
        p = formation_plan(dict(member=asdict(m),mechanics=asdict(self.cfg),marches=5,march_size=90000))
        self.assertEqual(p['full_target_marches'],5)
        self.assertEqual(p['needed_for_target']['archers'],360000)
        strict = next(x for x in p['plans'] if x['formation']=='strict')
        self.assertEqual(strict['fill'],1)

    def test_integer_fleet_never_exceeds_march_capacity(self):
        for total in range(1,35):
            m = Member('M',troops=total,infantry=total//3,cavalry=total//3,archers=total-2*(total//3),march_capacity=7)
            p = formation_plan(dict(member=asdict(m),mechanics=asdict(self.cfg),marches=5,march_size=7))
            for plan in p['plans']:
                self.assertTrue(all(sum(mix.values())<=7 for mix in plan['marches']))
                for t in TYPES:
                    self.assertEqual(sum(x[t] for x in plan['marches']),plan['used'][t])
                    self.assertEqual(plan['used'][t]+plan['unused'][t],p['inventory'][t])

    def test_integer_optimizer_matches_brute_force(self):
        av=dict(infantry=5,cavalry=8,archers=9)
        weights=coefficients(self.m,self.m,self.cfg)
        for size in range(1,23):
            chosen=allocate(av,size,self.m,self.m,self.cfg,Strategy(formation='optimized'))
            value=lambda x:sum(weights[t]*math.sqrt(x[t]) for t in TYPES)
            best=max(value(dict(infantry=i,cavalry=c,archers=size-i-c)) for i in range(6) for c in range(9) if 0<=size-i-c<=9)
            self.assertAlmostEqual(value(chosen),best)

    def test_troop_type_conservation_and_credit_for_both_scopes(self):
        ms=[replace(self.m,name=str(i),join_slots=2,march_capacity=50000,rally_capacity=140000,
                    infantry_tier=7+i%3) for i in range(5)]
        for scope in ('march','rally'):
            for policy in ('inventory','strict','adaptive','optimized'):
                r=simulate(ms,replace(self.cfg,duration_s=180,countdown_s=30,damage_scope=scope),
                           Strategy(host_count=3,formation=policy,host_allocation='small'),audit=True)
                self.assertAlmostEqual(sum(r['damage_by_type'].values()),r['total_damage'])
                for m in r['members']:
                    self.assertAlmostEqual(sum(m['damage_by_type'].values()),m['damage'])
                    self.assertTrue(all(0<=x<=1 for x in m['type_utilization'].values()))
                for rally in r['rallies']:
                    for p in rally['participants']:
                        self.assertLessEqual(p['troops'],50000)

    def test_inventory_import_and_zero_archers(self):
        m=Member.parse(dict(name='M',troops=999,infantry=12,cavalry=8,archers=0))
        self.assertEqual(m.troops,20)
        self.assertEqual(sum(allocate(inventory(m),20,m,m,self.cfg,Strategy(formation='strict')).values()),0)
        with self.assertRaises(ValueError):Member.parse(dict(name='M',infantry=12))
        with self.assertRaises(ValueError):Member.parse(dict(name='M',infantry=1.5,cavalry=8,archers=0))

    def test_troop_aware_calibration_requires_composition_and_correct_host(self):
        mix=dict(infantry=5000,cavalry=5000,archers=40000)
        damage=sum(effective_components(mix,self.m,self.m,self.cfg).values())*2.5
        report=dict(host=self.m.name,troops=50000,damage=damage,**mix)
        p=dict(score_scale=1,mechanics=asdict(self.cfg),roster=[asdict(self.m)],reports=[report])
        fit=calibrate(p)
        self.assertAlmostEqual(fit['hosts'][0]['host_strength'],2.5)
        with self.assertRaises(ValueError):calibrate(dict(p,reports=[dict(host=self.m.name,troops=50000,damage=damage)]))
        with self.assertRaises(ValueError):calibrate(dict(p,mechanics=asdict(replace(self.cfg,damage_scope='rally'))))


if __name__=='__main__':unittest.main()
