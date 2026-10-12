from copy import deepcopy
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request

from scripts.mightpulse_import import (
    Client, ImportBlocked, NoRedirect, Policy, ProviderError, authorize,
    execute, http_json, redact, reserve_budget,
)

ROOT = Path(__file__).resolve().parent.parent
KEY = "kss_dummy_test_credential_not_a_real_key"
NOW = datetime(2026, 10, 12, 20, 0, tzinfo=timezone.utc)


def owner_env():
    return {
        "GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": "Erross/BearTrapOptimizer",
        "GITHUB_ACTOR": "Erross", "GITHUB_ACTOR_ID": "33665337",
        "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF": "refs/heads/main",
        "GITHUB_RUN_ID": "100", "GITHUB_RUN_ATTEMPT": "1",
        "MIGHTPULSE_API_KEY": KEY,
    }


def policy():
    value = json.loads((ROOT / "scripts/mightpulse-policy.json").read_text())
    value["alliance_tag"] = "TEST"
    return value


class Clock:
    def __init__(self):
        self.value, self.pauses = 100.0, []

    def now(self):
        return self.value

    def sleep(self, seconds):
        self.pauses.append(seconds)
        self.value += seconds


class Provider:
    def __init__(self, members=3):
        self.ids = [str(i + 1) for i in range(members)]
        self.paths, self.failures, self.profiles = [], {}, {}
        self.alliance = {"kid": 2399, "abbr": "TEST", "count": members, "aid": 99}
        self.require_reservation = None
        self.board = {"ok": True, "rows": [{"governor_id": 1, "score": 123456}]}

    def __call__(self, path, key):
        if self.require_reservation is not None:
            assert self.require_reservation()
        assert key == KEY
        self.paths.append(path)
        if path.startswith("/alliances/"):
            return {"ok": True, "alliance": deepcopy(self.alliance),
                    "members": [{"governor_id": int(i), "uid": 900 + int(i), "kid": 2399,
                                 "nick_name": "Governor " + i, "power": 50000000,
                                 "town_center_level": 26} for i in self.ids],
                    "fresh": False, "cached_at": "2026-10-12T19:00:00Z", "age_seconds": 3600}
        if path.startswith("/kingdoms/"):
            return deepcopy(self.board)
        member = path.split("/")[2].split("?")[0]
        if member in self.failures:
            raise ProviderError(self.failures[member])
        return deepcopy(self.profiles.get(member, {
            "ok": True, "governor_id": int(member), "uid": 900 + int(member),
            "fresh": True, "age_seconds": 0,
            "player": {"governor_id": int(member), "kid": 2399, "x": 500 + int(member),
                       "y": 500, "nick_name": "Governor " + member,
                       "power": 50000000, "town_center_level": 26,
                       "alliance": {"abbr": "TEST"}},
        }))


class OwnerImportTests(unittest.TestCase):
    def setUp(self):
        self.provider, self.clock, self.reservations = Provider(), Clock(), []

    def run_import(self, raw=None, env=None, ledger=None, previous=None, now=NOW, persist=None):
        return execute(
            raw if raw is not None else policy(), env if env is not None else owner_env(),
            ledger or {}, previous or {}, now, persist or self.reservations.append,
            self.provider, self.clock.now, self.clock.sleep,
        )

    def test_unconfigured_policy_cannot_call_provider(self):
        raw = policy()
        raw["alliance_tag"] = None
        with self.assertRaisesRegex(ImportBlocked, "configure"):
            self.run_import(raw=raw)
        self.assertEqual(self.provider.paths, [])
        self.assertEqual(self.reservations, [])

    def test_all_owner_gates_reject_without_calls_or_reservations(self):
        bad_values = {
            "GITHUB_ACTIONS": "false", "GITHUB_REPOSITORY": "someone/fork",
            "GITHUB_ACTOR": "SomeoneElse", "GITHUB_ACTOR_ID": "12345",
            "GITHUB_EVENT_NAME": "pull_request", "GITHUB_REF": "refs/heads/other",
            "GITHUB_RUN_ID": "", "GITHUB_RUN_ATTEMPT": "0",
        }
        for field, value in bad_values.items():
            with self.subTest(field=field):
                env = owner_env()
                env[field] = value
                with self.assertRaises(ImportBlocked):
                    self.run_import(env=env)
        self.assertEqual(self.provider.paths, [])
        self.assertEqual(self.reservations, [])

    def test_missing_or_header_injected_key_cannot_call_provider(self):
        for key in ("", "short", KEY + "\nX-Api-Key: other"):
            with self.subTest(key_length=len(key)):
                env = owner_env()
                env["MIGHTPULSE_API_KEY"] = key
                with self.assertRaises(ImportBlocked):
                    self.run_import(env=env)
        self.assertEqual(self.provider.paths, [])

    def test_policy_cannot_expand_kingdom_or_limits(self):
        for field, value in (("kingdom_id", 2400), ("max_members", 101),
                             ("daily_call_budget", 501), ("calls_per_minute", 60),
                             ("refresh_cooldown_seconds", 0), ("alliance_tag", " TEST")):
            with self.subTest(field=field):
                raw = policy()
                raw[field] = value
                with self.assertRaises(ImportBlocked):
                    self.run_import(raw=raw)
        self.assertEqual(self.provider.paths, [])

    def test_reservation_is_durable_before_provider_call(self):
        self.provider.require_reservation = lambda: bool(self.reservations)
        result = self.run_import()
        self.assertEqual(self.reservations[0]["reserved_calls"], 102)
        self.assertEqual(result["upstream_requests"], 5)
        self.assertEqual(result["profiles"]["1"]["player"]["x"], 501)
        self.assertFalse(result["roster_freshness"]["fresh"])

    def test_failed_reservation_persistence_blocks_all_requests(self):
        def fail(_):
            raise ImportBlocked("Persistence unavailable")
        with self.assertRaisesRegex(ImportBlocked, "Persistence"):
            self.run_import(persist=fail)
        self.assertEqual(self.provider.paths, [])

    def test_full_100_member_refresh_uses_102_calls_and_governor_ids(self):
        self.provider = Provider(100)
        result = self.run_import()
        self.assertEqual(len(result["members"]), 100)
        self.assertEqual(len(result["profiles"]), 100)
        self.assertEqual(result["upstream_requests"], 102)
        profile_paths = [p for p in self.provider.paths if p.startswith("/players/")]
        self.assertEqual(len(profile_paths), 100)
        self.assertTrue(all("id_type=governor_id" in p for p in profile_paths))
        self.assertTrue(all("include=base,heroes,ranks,gov_gear" in p for p in profile_paths))
        self.assertFalse(any("/players/901?" in p for p in profile_paths))

    def test_selected_refresh_keeps_other_profiles_and_does_not_mutate_input(self):
        previous = self.run_import()
        original = deepcopy(previous)
        self.provider.paths.clear()
        self.provider.profiles["2"] = {
            "governor_id": 2, "player": {"governor_id": 2, "kid": 2399,
                                        "nick_name": "Renamed", "x": 600, "y": 600}
        }
        env = owner_env()
        env["GITHUB_RUN_ID"] = "101"
        env["MIGHTPULSE_MEMBER_IDS"] = "2"
        result = self.run_import(env=env, previous=previous)
        self.assertEqual(result["upstream_requests"], 3)
        self.assertEqual(result["profiles"]["1"], previous["profiles"]["1"])
        self.assertEqual(result["profiles"]["2"]["player"]["nick_name"], "Renamed")
        self.assertEqual(previous, original)
        self.assertEqual(self.reservations[-1]["reserved_calls"], 3)

    def test_unknown_selected_id_is_blocked_before_reservation(self):
        env = owner_env()
        env["MIGHTPULSE_MEMBER_IDS"] = "999"
        with self.assertRaisesRegex(ImportBlocked, "saved alliance"):
            self.run_import(env=env)
        self.assertEqual(self.provider.paths, [])
        self.assertEqual(self.reservations, [])

    def test_malformed_or_duplicate_ids_cannot_be_used_as_proxy_paths(self):
        for selected in ("https://example.com", "1/../2", "1,1", "1\nX: 2", "0", "1,"):
            with self.subTest(value=selected):
                env = owner_env()
                env["MIGHTPULSE_MEMBER_IDS"] = selected
                with self.assertRaises(ImportBlocked):
                    self.run_import(env=env)
        self.assertEqual(self.provider.paths, [])

    def test_cooldown_and_repeated_attempt_do_not_call_provider(self):
        self.run_import()
        ledger = self.reservations[-1]
        self.provider.paths.clear()
        with self.assertRaisesRegex(ImportBlocked, "already reserved"):
            self.run_import(ledger=ledger, now=NOW + timedelta(hours=2))
        env = owner_env()
        env["GITHUB_RUN_ID"] = "101"
        with self.assertRaisesRegex(ImportBlocked, "cooldown"):
            self.run_import(env=env, ledger=ledger, now=NOW + timedelta(minutes=20))
        self.assertEqual(self.provider.paths, [])

    def test_daily_hard_budget_blocks_fifth_full_reservation(self):
        p, env, ledger = Policy.read(policy()), owner_env(), {}
        start = NOW.replace(hour=12)
        for i in range(4):
            env["GITHUB_RUN_ID"] = str(100 + i)
            ledger = reserve_budget(ledger, p, env, start + timedelta(hours=i), 102)
        self.assertEqual(ledger["reserved_calls"], 408)
        env["GITHUB_RUN_ID"] = "104"
        with self.assertRaisesRegex(ImportBlocked, "Daily"):
            reserve_budget(ledger, p, env, start + timedelta(hours=4), 102)

    def test_explicit_recovery_charges_again_and_cannot_be_reused(self):
        raw = policy()
        raw["recovery_attempt"] = "100:2"
        self.run_import(raw=raw)
        ledger = self.reservations[-1]
        before = deepcopy(ledger)
        env = owner_env()
        env["GITHUB_RUN_ATTEMPT"] = "2"
        self.provider.paths.clear()
        self.run_import(raw=raw, env=env, ledger=ledger, now=NOW + timedelta(minutes=5))
        updated = self.reservations[-1]
        self.assertEqual(updated["reserved_calls"], 204)
        self.assertEqual(updated["runs"], ["100:1", "100:2"])
        self.assertEqual(ledger, before)
        self.provider.paths.clear()
        with self.assertRaisesRegex(ImportBlocked, "already reserved"):
            self.run_import(raw=raw, env=env, ledger=updated, now=NOW + timedelta(minutes=6))
        env["GITHUB_RUN_ATTEMPT"] = "3"
        with self.assertRaisesRegex(ImportBlocked, "cooldown"):
            self.run_import(raw=raw, env=env, ledger=updated, now=NOW + timedelta(minutes=6))
        self.assertEqual(self.provider.paths, [])

    def test_recovery_cannot_authorize_another_run_attempt_or_previous_run(self):
        raw = policy()
        raw["recovery_attempt"] = "100:2"
        self.run_import(raw=raw)
        ledger = self.reservations[-1]
        self.provider.paths.clear()
        for run_id, attempt, last_run in (("101", "2", "100:1"),
                                          ("100", "3", "100:1"),
                                          ("100", "2", "99:1")):
            with self.subTest(run=run_id, attempt=attempt, previous=last_run):
                env = owner_env()
                env.update(GITHUB_RUN_ID=run_id, GITHUB_RUN_ATTEMPT=attempt)
                saved = {**ledger, "last_run": last_run}
                with self.assertRaisesRegex(ImportBlocked, "cooldown"):
                    self.run_import(raw=raw, env=env, ledger=saved,
                                    now=NOW + timedelta(minutes=5))
        self.assertEqual(self.provider.paths, [])

    def test_recovery_cannot_bypass_daily_budget(self):
        raw = policy()
        raw["recovery_attempt"] = "100:2"
        self.run_import(raw=raw)
        ledger = {**self.reservations[-1], "reserved_calls": 450}
        env = owner_env()
        env["GITHUB_RUN_ATTEMPT"] = "2"
        self.provider.paths.clear()
        with self.assertRaisesRegex(ImportBlocked, "Daily"):
            self.run_import(raw=raw, env=env, ledger=ledger, now=NOW + timedelta(minutes=5))
        self.assertEqual(self.provider.paths, [])

    def test_recovery_cannot_cross_utc_day_during_cooldown(self):
        raw = policy()
        raw["recovery_attempt"] = "100:2"
        start = NOW.replace(hour=23, minute=50)
        self.run_import(raw=raw, now=start)
        ledger = self.reservations[-1]
        env = owner_env()
        env["GITHUB_RUN_ATTEMPT"] = "2"
        self.provider.paths.clear()
        with self.assertRaisesRegex(ImportBlocked, "cooldown"):
            self.run_import(raw=raw, env=env, ledger=ledger, now=start + timedelta(minutes=20))
        self.assertEqual(self.provider.paths, [])

    def test_recovery_remains_owner_only(self):
        raw = policy()
        raw["recovery_attempt"] = "100:2"
        self.run_import(raw=raw)
        ledger = self.reservations[-1]
        env = owner_env()
        env.update(GITHUB_RUN_ATTEMPT="2", GITHUB_ACTOR="SomeoneElse")
        self.provider.paths.clear()
        with self.assertRaisesRegex(ImportBlocked, "owner"):
            self.run_import(raw=raw, env=env, ledger=ledger, now=NOW + timedelta(minutes=5))
        self.assertEqual(self.provider.paths, [])
        self.assertEqual(len(self.reservations), 1)

    def test_recovery_policy_rejects_malformed_or_first_attempt_grants(self):
        for grant in ("100:1", "100:0", "100:02", "0:2", "100:2\n", {}, 100):
            with self.subTest(grant=grant):
                raw = policy()
                raw["recovery_attempt"] = grant
                with self.assertRaisesRegex(ImportBlocked, "recovery policy"):
                    self.run_import(raw=raw)
        self.assertEqual(self.provider.paths, [])

    def test_utc_day_reset_retains_cross_midnight_cooldown(self):
        p, env = Policy.read(policy()), owner_env()
        start = NOW.replace(hour=23, minute=50)
        ledger = reserve_budget({}, p, env, start, 102)
        env["GITHUB_RUN_ID"] = "101"
        with self.assertRaisesRegex(ImportBlocked, "cooldown"):
            reserve_budget(ledger, p, env, start + timedelta(minutes=20), 102)
        reset = reserve_budget(ledger, p, env, start + timedelta(hours=2), 102)
        self.assertEqual(reset["reserved_calls"], 102)

    def test_corrupt_ledger_fails_closed(self):
        with self.assertRaisesRegex(ImportBlocked, "quota state"):
            self.run_import(ledger={"version": 1, "reserved_calls": -1})
        self.assertEqual(self.provider.paths, [])

    def test_wrong_alliance_response_cannot_trigger_profile_fetches(self):
        self.provider.alliance["abbr"] = "OTHER"
        with self.assertRaisesRegex(ImportBlocked, "configured alliance"):
            self.run_import()
        self.assertEqual(len(self.provider.paths), 1)

    def test_duplicate_and_oversized_rosters_are_rejected(self):
        for ids in (["1", "1"], [str(i + 1) for i in range(101)]):
            self.provider.ids = ids
            self.provider.paths.clear()
            with self.assertRaises(ImportBlocked):
                self.run_import()
            self.assertEqual(len(self.provider.paths), 1)

    def test_changed_membership_cannot_update_foreign_profile(self):
        previous = self.run_import()
        self.provider.profiles["1"] = {
            "governor_id": 1, "player": {"governor_id": 1, "kid": 2400}
        }
        result = self.run_import(previous=previous)
        self.assertEqual(result["profiles"]["1"], previous["profiles"]["1"])
        self.assertEqual(result["profile_status"]["1"], "membership_changed")

    def test_404_preserves_cached_profile_and_metadata(self):
        previous = self.run_import()
        self.provider.failures["1"] = 404
        result = self.run_import(previous=previous)
        self.assertEqual(result["profiles"]["1"], previous["profiles"]["1"])
        self.assertEqual(result["profile_status"]["1"], "unavailable")

    def test_mismatched_governor_response_is_rejected(self):
        self.provider.profiles["1"] = {
            "governor_id": 999, "player": {"governor_id": 999, "kid": 2399}
        }
        with self.assertRaisesRegex(ImportBlocked, "mismatched"):
            self.run_import()

    def test_profile_error_does_not_mutate_previous_snapshot(self):
        previous = self.run_import()
        before = deepcopy(previous)
        self.provider.failures["1"] = 401
        with self.assertRaises(ImportBlocked):
            self.run_import(previous=previous)
        self.assertEqual(previous, before)

    def test_other_alliance_snapshot_is_rejected_without_calls(self):
        with self.assertRaisesRegex(ImportBlocked, "different alliance"):
            self.run_import(previous={"schema": "mightpulse-alliance-snapshot",
                                      "version": 1, "kingdom_id": 2399,
                                      "alliance_tag": "OTHER"})
        self.assertEqual(self.provider.paths, [])

    def test_secret_and_credential_fields_are_removed_from_saved_output(self):
        self.provider.board = {"rows": [{"name": "prefix-" + KEY, KEY: "bad"}],
                               "Authorization": KEY, "apiKey": KEY}
        self.provider.profiles["1"] = {
            "governor_id": 1, "debug_echo": KEY,
            "player": {"governor_id": 1, "kid": 2399, "nick_name": KEY,
                       "api_key": KEY, "heroes": [{"secret": KEY, "name": KEY}]}
        }
        result = self.run_import()
        encoded = json.dumps(result)
        self.assertNotIn(KEY, encoded)
        self.assertNotIn("debug_echo", encoded)
        self.assertNotIn("Authorization", encoded)
        self.assertNotIn("apiKey", encoded)

    def test_client_counts_failures_stops_after_auth_error_and_paces_starts(self):
        p, c = Provider(), Clock()
        client = Client(KEY, 2, 50, p, c.now, c.sleep)
        client.get("/alliances/2399/TEST?include=info,roster")
        client.get("/kingdoms/2399/ranks?board=troop_power&limit=100")
        self.assertGreaterEqual(c.pauses[0], 1.19)
        with self.assertRaisesRegex(ImportBlocked, "request limit"):
            client.get("/players/1")
        self.assertEqual(len(p.paths), 2)
        def fail(path, key):
            raise ProviderError(401)
        client = Client(KEY, 102, 50, fail, c.now, c.sleep)
        with self.assertRaises(ProviderError):
            client.get("/players/1")
        self.assertEqual(client.calls, 1)
        with self.assertRaises(ImportBlocked):
            client.get("/players/2")
        self.assertEqual(client.calls, 1)

    def test_auth_header_cannot_follow_a_redirect(self):
        request = Request("https://api.mightpulse.com/v1/players/1",
                          headers={"Authorization": "Bearer " + KEY})
        self.assertIsNone(NoRedirect().redirect_request(
            request, None, 302, "redirect", {}, "https://elsewhere.example/"
        ))

    def test_workflow_has_only_manual_trigger_and_fixed_owner_guard(self):
        text = (ROOT / ".github/workflows/mightpulse-owner-refresh.yml").read_text()
        trigger = text.split("on:", 1)[1].split("concurrency:", 1)[0]
        self.assertIn("workflow_dispatch:", trigger)
        self.assertNotIn("pull_request", trigger)
        self.assertNotIn("schedule:", trigger)
        self.assertNotIn("push:", trigger)
        self.assertIn("github.actor_id == '33665337'", text)
        self.assertIn("github.ref == 'refs/heads/main'", text)
        self.assertIn("cancel-in-progress: false", text)
        self.assertIn("secrets.MIGHTPULSE_API_KEY", text)


class IdentifiedHTTPClientTests(unittest.TestCase):
    def test_provider_accepts_identified_app_instead_of_default_python_agent(self):
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                agent = self.headers.get("User-Agent", "")
                authorization = self.headers.get("Authorization", "")
                requests.append((self.path, agent, authorization))
                if agent.startswith("Python-urllib") or not agent:
                    status, body = 403, {"ok": False}
                elif authorization != "Bearer " + KEY:
                    status, body = 401, {"ok": False}
                else:
                    status, body = 200, {"ok": True}
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(body).encode())

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = "http://127.0.0.1:" + str(server.server_port)
            with patch("scripts.mightpulse_import.API_BASE", base):
                result = http_json("/alliances/2399/CNQ?include=info,roster", KEY)
            self.assertEqual(result, {"ok": True})
            self.assertEqual(len(requests), 1)
            self.assertIn("BearTrapOptimizer", requests[0][1])
            self.assertEqual(requests[0][2], "Bearer " + KEY)
        finally:
            server.shutdown()
            thread.join(timeout=2)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
