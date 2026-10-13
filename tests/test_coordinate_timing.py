from dataclasses import asdict, replace
import unittest
from beartrap.model import Member, Mechanics, Strategy
from beartrap.simulator import simulate
from beartrap.analysis import compare


class CoordinateTimingTests(unittest.TestCase):
    def setUp(self):
        self.members = [Member('Host', troops=100, march_capacity=100, rally_capacity=300,
                               join_slots=0, outbound_s=0, return_s=0),
                        Member('Near', troops=100, march_capacity=100, join_slots=1,
                               can_host=False, outbound_s=0, return_s=0),
                        Member('Far', troops=100, march_capacity=100, join_slots=1,
                               can_host=False, outbound_s=0, return_s=0)]
        self.mechanics = Mechanics(duration_s=60, countdown_s=50, reaction_s=1, score_per_effective_troop=1)
        self.strategy = Strategy(host_count=1, cadence='synchronized', host_allocation='full', troop_split='concentrated')
        self.times = {'Near': {'Host': 49}, 'Far': {'Host': 50}}

    def test_each_joiner_must_reach_its_host_before_departure(self):
        run = simulate(self.members, self.mechanics, self.strategy, audit=True, travel_times=self.times)
        self.assertEqual(run['total_damage'], 200)
        self.assertEqual(next(m['joins'] for m in run['members'] if m['name'] == 'Far'), 0)
        self.assertEqual(simulate(self.members, self.mechanics, self.strategy)['total_damage'], 300)

    def test_compare_normalization_uses_the_same_distances_as_the_runs(self):
        data = {'roster': [asdict(m) for m in self.members], 'mechanics': asdict(self.mechanics),
                'strategies': [asdict(self.strategy)], 'travel_times': self.times,
                'normalization': {'enabled': True, 'target': 1000}}
        run = compare(data)
        self.assertEqual(run['runs'][0]['total_damage'], 1000)
        self.assertEqual(run['mechanics']['score_per_effective_troop'], 5)

    def test_one_wave_remains_equivalent_with_city_distances(self):
        base = simulate(self.members, self.mechanics, self.strategy, travel_times=self.times)
        waves = simulate(self.members, self.mechanics,
                         replace(self.strategy, cadence='groups', opening_wave_count=1, wave_interval_s=90),
                         travel_times=self.times)
        self.assertEqual(base['series'], waves['series'])
        self.assertEqual(base['contributions'], waves['contributions'])

    def test_bad_matrix_is_rejected_before_simulation(self):
        for bad in ({'Stranger': {}}, {'Near': []}, {'Near': {'Stranger': 1}},
                    {'Near': {'Host': -1}}, {'Near': {'Host': 3601}},
                    {'Near': {'Host': 1.5}}, {'Near': {'Host': True}}):
            with self.subTest(matrix=bad), self.assertRaises(ValueError):
                simulate(self.members, self.mechanics, self.strategy, travel_times=bad)

    def test_long_city_travel_is_supported_and_can_miss_the_event(self):
        member = replace(self.members[0], outbound_s=600)
        run = simulate([member], self.mechanics, self.strategy)
        self.assertEqual(run['total_damage'], 0)
        with self.assertRaises(ValueError):
            replace(member, outbound_s=3601).validate()
