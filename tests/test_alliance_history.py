import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('history', Path(__file__).resolve().parents[1] / 'scripts/alliance_history.py')
H = importlib.util.module_from_spec(spec)
spec.loader.exec_module(H)


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.snapshot = {'generated_at': '2026-10-21T23:00:00Z', 'roster_freshness': {'cached_at': 1792620000},
                         'members': [{'governor_id': 123, 'nick_name': 'First name', 'power': 100, 'town_center_level': 25}]}
        self.record = {'governorId': '123', 'updatedAt': '2026-10-21T20:00:00Z', 'revision': 1,
                       'input': {'stock': {'9': {'infantry': 100, 'cavalry': 200, 'archers': 300}},
                                 'ownEnabled': True, 'ownTier': 'lower', 'ownTroops': {'infantry': 50}}}

    def run_archive(self, record=None):
        H.archive(self.snapshot, record, self.directory)
        return json.loads((self.directory / '123.json').read_text())

    def test_source_times_deduplicate_repeated_capture(self):
        self.run_archive({'123': self.record})
        self.snapshot['generated_at'] = '2026-10-22T13:30:00Z'
        result = self.run_archive({'123': self.record})
        self.assertEqual(len(result['power']), 1)
        self.assertEqual(len(result['troops']), 1)
        self.assertEqual(result['troops'][0]['at'], '2026-10-21T20:00:00+00:00')
        self.assertEqual(result['troops'][0]['total'], 650)
        self.assertEqual(result['troops'][0]['types']['infantry'], 150)

    def test_own_rally_same_tier_is_not_double_counted(self):
        self.record['input']['ownTier'] = 9
        self.assertEqual(H.inventory(self.record)['total'], 600)

    def test_outage_and_missing_profiles_preserve_history(self):
        self.run_archive({'123': self.record})
        self.run_archive({'123': None})
        result = self.run_archive({'123': {'input': None}})
        self.assertEqual(len(result['troops']), 1)
        self.assertEqual(result['troops'][0]['total'], 650)
        index = json.loads((self.directory / 'index.json').read_text())
        self.assertEqual(index['profileCapture']['saved'], 0)
        self.assertEqual(index['profileCapture']['checked'], 1)

    def test_zero_is_observed_not_missing(self):
        self.record['input'] = {'stock': {}}
        result = self.run_archive({'123': self.record})
        self.assertEqual(result['troops'][0]['total'], 0)

    def test_rename_new_observation_and_departure(self):
        self.run_archive({'123': self.record})
        self.snapshot['roster_freshness']['cached_at'] += 86400
        self.snapshot['members'][0].update(nick_name='New name', power=120, town_center_level=26)
        self.record.update(revision=2, updatedAt='2026-10-22T12:00:00Z')
        self.record['input']['stock']['9']['archers'] = 400
        result = self.run_archive({'123': self.record})
        self.assertEqual([p['power'] for p in result['power']], [100, 120])
        self.assertEqual([p['total'] for p in result['troops']], [650, 750])
        self.snapshot['members'] = []
        self.run_archive()
        index = json.loads((self.directory / 'index.json').read_text())
        self.assertEqual(index['players'], [{'id': '123', 'name': 'New name', 'active': False}])
        self.assertEqual(len(json.loads((self.directory / '123.json').read_text())['power']), 2)

    def test_invalid_counts_never_become_points(self):
        for invalid in (-1, 1.2, True, 'NaN', 5000001):
            with self.subTest(invalid=invalid):
                record = copy.deepcopy(self.record)
                record['input']['stock']['9']['archers'] = invalid
                with self.assertRaises((ValueError, OverflowError)):
                    H.inventory(record)
        result = self.run_archive({'123': record})
        self.assertEqual(result['troops'], [])

    def test_corrupt_archive_is_not_silently_overwritten(self):
        self.run_archive()
        path = self.directory / '123.json'
        path.write_text('{broken')
        with self.assertRaises(ValueError):
            self.run_archive()
        self.assertEqual(path.read_text(), '{broken')

    def test_governor_identity_cannot_escape_directory(self):
        self.snapshot['members'][0]['governor_id'] = '../other'
        with self.assertRaises(ValueError):
            self.run_archive()

    def test_malformed_or_unchecked_profile_does_not_block_power(self):
        self.record['input']['stock']['9'] = None
        result = self.run_archive({'123': self.record})
        self.assertEqual(len(result['power']), 1)
        self.assertEqual(result['troops'], [])
        self.run_archive({})
        capture = json.loads((self.directory / 'index.json').read_text())['profileCapture']
        self.assertEqual(capture['notChecked'], 1)
        self.assertEqual(capture['unavailable'], 0)

    def test_clock_skew_does_not_claim_capture_before_submission(self):
        self.record['updatedAt'] = '2026-10-22T00:00:00Z'
        result = self.run_archive({'123': self.record})
        self.assertIsNone(result['troops'][0]['capturedAt'])
        self.assertEqual(result['troops'][0]['at'], '2026-10-22T00:00:00+00:00')

    def alliance(self):
        return json.loads((self.directory / 'alliance.json').read_text())

    def advance(self):
        self.snapshot['generated_at'] = '2026-10-22T13:30:00Z'
        self.snapshot['roster_freshness']['cached_at'] += 86400

    def test_alliance_power_uses_reported_total_and_deduplicates(self):
        self.snapshot['alliance'] = {'power': 4_000_000_000}
        self.run_archive()
        self.run_archive()
        self.assertEqual(self.alliance()['power'], [{'at': H.stamp(1792620000), 'power': 4_000_000_000, 'members': 1}])
        self.advance()
        self.snapshot['alliance']['power'] += 100
        self.run_archive()
        self.assertEqual([p['power'] for p in self.alliance()['power']], [4_000_000_000, 4_000_000_100])

    def test_alliance_inventory_totals_and_retained_counts_after_outage(self):
        self.run_archive({'123': self.record})
        first = self.alliance()['troops'][0]
        self.assertEqual(first['total'], 650)
        self.assertEqual(first['types']['infantry'], 150)
        self.assertEqual(first['stock']['9']['infantry'], 100)
        self.assertEqual(first['memberIds'], ['123'])
        self.assertEqual(first['carried'], 0)
        self.advance()
        self.run_archive({'123': None})
        last = self.alliance()['troops'][-1]
        self.assertEqual(last['total'], 650)
        self.assertEqual(last['carried'], 1)
        self.assertEqual(last['unavailable'], 1)
        self.assertEqual(last['oldestSubmission'], first['oldestSubmission'])

    def test_alliance_new_reporter_and_departure_change_coverage(self):
        self.run_archive({'123': self.record})
        self.advance()
        self.snapshot['members'].append({'governor_id': 456, 'nick_name': 'Second', 'power': 10})
        other = copy.deepcopy(self.record)
        other['input'] = {'stock': {'10': {'archers': 50}}}
        self.run_archive({'123': self.record, '456': other})
        point = self.alliance()['troops'][-1]
        self.assertEqual(point['total'], 700)
        self.assertEqual(point['reported'], 2)
        self.assertEqual(point['members'], 2)
        self.snapshot['generated_at'] = '2026-10-23T13:30:00Z'
        self.snapshot['members'] = self.snapshot['members'][1:]
        self.run_archive({'456': None})
        point = self.alliance()['troops'][-1]
        self.assertEqual(point['memberIds'], ['456'])
        self.assertEqual(point['total'], 50)
        self.assertTrue((self.directory / '123.json').exists())

    def test_alliance_unknown_is_not_zero_but_reported_zero_is(self):
        self.run_archive({'123': {'input': None}})
        self.assertIsNone(self.alliance()['troops'][0]['total'])
        self.assertEqual(self.alliance()['troops'][0]['reported'], 0)
        self.advance()
        self.record['input'] = {'stock': {}}
        self.run_archive({'123': self.record})
        self.assertEqual(self.alliance()['troops'][-1]['total'], 0)
        self.assertEqual(self.alliance()['troops'][-1]['reported'], 1)

    def test_alliance_backfill_preserves_troop_series_and_player_metadata(self):
        self.run_archive({'123': self.record})
        before = (self.directory / 'index.json').read_text()
        points = self.alliance()['troops']
        H.archive_alliance(self.snapshot, self.directory)
        self.assertEqual(self.alliance()['troops'], points)
        self.assertEqual((self.directory / 'index.json').read_text(), before)
