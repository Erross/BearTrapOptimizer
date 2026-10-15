import unittest
from dataclasses import asdict, replace
from beartrap.model import Member, Mechanics, Strategy
from beartrap.simulator import simulate
from beartrap.wave_planner import optimize_waves


class WaveRecyclingTests(unittest.TestCase):
    def members(self):
        return [Member(f'P{i:02}', troops=200001, march_capacity=100000,
                       join_slots=5, rally_capacity=200001, outbound_s=2,
                       return_s=2, join_travel_s=2) for i in range(10)]

    def setting(self):
        return Strategy(host_count=10, cadence='groups', opening_wave_count=5,
                        wave_interval_s=10, host_allocation='small', small_host_fraction=.00001,
                        troop_split='concentrated', reserve_lead_troops=True)

    def test_opening_equal_share_prevents_first_players_taking_all_space(self):
        members, c, s = self.members(), Mechanics(duration_s=180, countdown_s=60), self.setting()
        greedy = simulate(members, c, s, audit=True)
        fair = simulate(members, c, replace(s, first_wave_join=True), audit=True)
        self.assertLess(greedy['summary']['first_wave_joiners'], 10)
        self.assertEqual(fair['summary']['first_wave_joiners'], 10)
        self.assertEqual(fair['first_wave_missing'], [])
        self.assertTrue(all(p['troops'] <= 40000 for r in fair['rallies'] if r['start_s'] == 0
                            for p in r['participants'] if p['role'] == 'join' and p['sent_s'] == 0))

    def test_late_joining_keeps_travel_and_return_locks(self):
        members, c = self.members(), Mechanics(duration_s=240, countdown_s=60)
        s = replace(self.setting(), first_wave_join=True, join_window_s=8)
        run = simulate(members, c, s, audit=True)
        self.assertEqual(run['summary']['first_wave_joiners'], 10)
        for r in run['rallies']:
            for p in r['participants']:
                if p['role'] == 'join':
                    self.assertGreaterEqual(p['sent_s'], r['departure_s']-10)
                    self.assertLess(p['sent_s']+2, r['departure_s'])
        self.assertGreater(sum(m['troop_hits'] for m in run['members']), sum(m.troops for m in members))

    def test_infeasible_opening_is_reported_and_rejected(self):
        members = [replace(m, can_host=i == 0) for i, m in enumerate(self.members())]
        run = simulate(members, Mechanics(duration_s=180, countdown_s=60), replace(self.setting(), first_wave_join=True))
        self.assertIn('P00', run['first_wave_missing'], 'A leader cannot join their own rally')
        with self.assertRaisesRegex(ValueError, 'at least two'):
            optimize_waves({'roster': [asdict(m) for m in members]})

    def test_optimizer_ranks_damage_and_requires_everyone_in_opening(self):
        payload = {'roster': [asdict(m) for m in self.members()],
                   'mechanics': {'duration_s': 240, 'countdown_s': 60},
                   'host_count': 8, 'opening_limit_s': 180,
                   'normalization': {'enabled': False}, 'strategy': asdict(self.setting())}
        result = optimize_waves(payload)
        feasible = [r for r in result['tested'] if r['opening_feasible']]
        self.assertEqual(result['best']['summary']['first_wave_joiners'], 10)
        self.assertEqual(result['best']['total_damage'], max(r['total_damage'] for r in feasible))
        self.assertLessEqual(len(result['tested']), 144)
        self.assertTrue(all(r['strategy']['first_wave_join'] for r in result['tested']))

    def test_new_fields_are_validated(self):
        for row in ({'join_window_s': -1}, {'join_window_s': True}, {'first_wave_join': 1}):
            with self.assertRaises(ValueError):
                Strategy.parse(row)
