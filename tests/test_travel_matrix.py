import unittest
from dataclasses import replace
from beartrap.model import Member, Mechanics, Strategy
from beartrap.simulator import simulate


class TravelMatrixTests(unittest.TestCase):
    def test_destination_specific_join_arrival(self):
        members=[Member('Host',join_slots=0),Member('Joiner',can_host=False)]
        config=Mechanics(duration_s=120,countdown_s=30)
        strategy=Strategy(host_count=1,cadence='synchronized')
        baseline=simulate(members,config,strategy,audit=True)
        blocked=simulate(members,replace(config,join_travel_times={'Joiner':{'Host':3600}}),strategy,audit=True)
        self.assertGreater(baseline['members'][1]['joins'],0)
        self.assertEqual(blocked['members'][1]['joins'],0)
        self.assertLess(blocked['total_damage'],baseline['total_damage'])
        arrived=simulate(members,replace(config,join_travel_times={'Joiner':{'Host':0}}),strategy,audit=True)
        self.assertGreater(arrived['members'][1]['joins'],0)

    def test_invalid_matrix_and_unknown_players(self):
        for value in (None,[],{'Joiner':[]},{'Joiner':{'Host':1.5}},{'Joiner':{'Host':-1}},{'Joiner':{'Host':3601}}):
            with self.assertRaises(ValueError):
                Mechanics.parse({'join_travel_times':value})
        with self.assertRaises(ValueError):
            simulate([Member('Host')],Mechanics(join_travel_times={'Missing':{'Host':5}}))

    def test_distant_host_can_take_longer_than_countdown(self):
        member=replace(Member('Far city'),outbound_s=700,return_s=700,join_travel_s=800)
        run=simulate([member],Mechanics(duration_s=1800),Strategy(host_count=1,cadence='synchronized'),audit=True)
        self.assertEqual(run['hits'][0]['second'],1000)
        self.assertTrue(all(hit['second']<1800 for hit in run['hits']))
