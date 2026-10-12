#!/usr/bin/env python3
"""Owner-only, budgeted MightPulse snapshot import. No public refresh endpoint."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / "scripts/mightpulse-policy.json"
LEDGER_PATH = ROOT / ".api-state/mightpulse-budget.json"
SNAPSHOT_PATH = ROOT / "web/data/alliance-api.json"
REPOSITORY = "Erross/BearTrapOptimizer"
OWNER_LOGIN = "Erross"
OWNER_ACTOR_ID = "33665337"
API_BASE = "https://api.mightpulse.com/v1"
MAX_RESPONSE_BYTES = 2_000_000
MEMBER_FIELDS = (
    "uid", "governor_id", "fid", "nick_name", "power", "town_center_level",
    "kills", "alliance_rank", "alliance_rank_label", "kid", "avatar_url",
    "last_active_at", "online",
)
PLAYER_FIELDS = (
    "uid", "governor_id", "fid", "nick_name", "kid", "power",
    "town_center_level", "vip", "x", "y", "online", "last_active_at",
    "alliance", "heroes", "ranks", "gov_gear",
)
ALLIANCE_FIELDS = (
    "aid", "name", "abbr", "kid", "power", "count", "leader_name",
    "leader_uid", "leader_governor_id", "power_rank",
)
FRESHNESS_FIELDS = ("fresh", "cached_at", "age_seconds")


class ImportBlocked(ValueError):
    """Safe, fixed-message errors suitable for public Actions logs."""


class ProviderError(ImportBlocked):
    def __init__(self, status: int | None = None):
        self.status = status
        super().__init__(
            f"MightPulse returned HTTP {status}." if status else
            "MightPulse did not return a valid response."
        )


def authorize(env: dict) -> None:
    expected = {
        "GITHUB_ACTIONS": "true",
        "GITHUB_REPOSITORY": REPOSITORY,
        "GITHUB_ACTOR": OWNER_LOGIN,
        "GITHUB_ACTOR_ID": OWNER_ACTOR_ID,
        "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_REF": "refs/heads/main",
    }
    if any(env.get(k) != v for k, v in expected.items()):
        raise ImportBlocked("Only the repository owner's manual main-branch refresh is allowed.")
    if not re.fullmatch(r"\d+", env.get("GITHUB_RUN_ID", "")) or not re.fullmatch(
        r"[1-9]\d*", env.get("GITHUB_RUN_ATTEMPT", "")
    ):
        raise ImportBlocked("Missing trusted workflow execution identity.")


@dataclass(frozen=True)
class Policy:
    kingdom_id: int
    alliance_tag: str
    max_members: int
    daily_call_budget: int
    refresh_cooldown_seconds: int
    calls_per_minute: int
    include_troop_power_board: bool

    @classmethod
    def read(cls, raw: dict) -> "Policy":
        tag = raw.get("alliance_tag")
        if not isinstance(tag, str) or not tag.strip() or tag != tag.strip() or len(tag) > 32 or any(
            ord(c) < 32 for c in tag
        ):
            raise ImportBlocked("Import disabled: configure the exact alliance tag first.")
        bounds = {
            "kingdom_id": (2399, 2399),
            "max_members": (1, 100),
            "daily_call_budget": (1, 500),
            "refresh_cooldown_seconds": (3600, 86400),
            "calls_per_minute": (1, 50),
        }
        for key, (low, high) in bounds.items():
            if type(raw.get(key)) is not int or not low <= raw[key] <= high:
                raise ImportBlocked("Invalid fixed-alliance import policy.")
        if type(raw.get("include_troop_power_board")) is not bool:
            raise ImportBlocked("Invalid leaderboard policy.")
        return cls(**{key: raw[key] for key in cls.__dataclass_fields__})


def governor_id(value) -> str:
    text = str(value)
    if not re.fullmatch(r"[1-9]\d{0,19}", text):
        raise ImportBlocked("Invalid governor ID.")
    return text


def requested_ids(text: str, maximum: int) -> list[str]:
    if not text.strip():
        return []
    items = [governor_id(part.strip()) for part in text.split(",")]
    if len(items) > maximum or len(set(items)) != len(items):
        raise ImportBlocked("Too many or duplicate requested members.")
    return items


def iso(now: datetime) -> str:
    return now.astimezone(timezone.utc).isoformat()


def reserve_budget(ledger: dict, policy: Policy, env: dict, now: datetime, calls: int) -> dict:
    """Charge the complete upper bound before any upstream request."""
    day = now.astimezone(timezone.utc).date().isoformat()
    run = env["GITHUB_RUN_ID"] + ":" + env["GITHUB_RUN_ATTEMPT"]
    if ledger and ledger.get("version") != 1:
        raise ImportBlocked("Invalid saved quota state; refresh refused.")
    if ledger:
        try:
            previous_start = datetime.fromisoformat(ledger["last_started_at"])
            if previous_start.tzinfo is None:
                raise ValueError
            same_day = ledger["day"] == day
            reserved = ledger["reserved_calls"] if same_day else 0
            runs = ledger["runs"] if same_day else []
            if type(reserved) is not int or reserved < 0 or not isinstance(runs, list):
                raise ValueError
        except (KeyError, TypeError, ValueError):
            raise ImportBlocked("Invalid saved quota state; refresh refused.") from None
        if run == ledger.get("last_run") or run in runs:
            raise ImportBlocked("This workflow attempt already reserved its API budget.")
        if (now - previous_start).total_seconds() < policy.refresh_cooldown_seconds:
            raise ImportBlocked("Refresh cooldown active; use the existing snapshot.")
    else:
        reserved, runs = 0, []
    if calls > policy.daily_call_budget - reserved:
        raise ImportBlocked("Daily import budget exhausted; use the existing snapshot.")
    return {
        "version": 1, "day": day, "reserved_calls": reserved + calls,
        "runs": [*runs, run], "last_run": run, "last_started_at": iso(now),
    }


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http_json(path: str, api_key: str) -> dict:
    if not path.startswith("/") or path.startswith("//") or "://" in path:
        raise ImportBlocked("Invalid upstream request path.")
    request = Request(
        API_BASE + path,
        headers={"Authorization": "Bearer " + api_key, "Accept": "application/json"},
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=100) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ProviderError()
        value = json.loads(raw)
        if not isinstance(value, dict) or value.get("ok") is False:
            raise ProviderError()
        return value
    except HTTPError as error:
        raise ProviderError(error.code) from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise ProviderError() from None


class Client:
    def __init__(self, key: str, maximum: int, rate: int, transport=http_json,
                 clock=time.monotonic, sleep=time.sleep):
        self.key, self.maximum, self.rate = key, maximum, rate
        self.transport, self.clock, self.sleep = transport, clock, sleep
        self.calls, self.next_start = 0, 0.0
        self.lock = threading.Lock()
        self.stopped = threading.Event()

    def get(self, path: str) -> dict:
        with self.lock:
            if self.stopped.is_set() or self.calls >= self.maximum:
                raise ImportBlocked("Import stopped at its reserved request limit.")
            delay = max(0.0, self.next_start - self.clock())
            if delay:
                self.sleep(delay)
            self.next_start = self.clock() + 60 / self.rate
            self.calls += 1
        try:
            return self.transport(path, self.key)
        except ProviderError as error:
            if error.status != 404:
                self.stopped.set()
            raise


def pick(value: dict, fields) -> dict:
    return {field: value[field] for field in fields if field in value}


def redact(value, secret: str):
    if isinstance(value, str):
        return value.replace(secret, "[redacted]")
    if isinstance(value, list):
        return [redact(item, secret) for item in value]
    if isinstance(value, dict):
        return {
            key.replace(secret, "[redacted]"): redact(item, secret) for key, item in value.items()
            if key.lower().replace("-", "").replace("_", "") not in
            {"authorization", "xapikey", "apikey", "token", "secret", "accesstoken"}
        }
    return value


def refresh(policy: Policy, client: Client, previous: dict, selected: list[str], now: datetime) -> dict:
    roster = client.get(
        f"/alliances/{policy.kingdom_id}/{quote(policy.alliance_tag, safe='')}?include=info,roster"
    )
    alliance, members = roster.get("alliance"), roster.get("members")
    if not isinstance(alliance, dict) or alliance.get("kid") != policy.kingdom_id or (
        alliance.get("abbr") != policy.alliance_tag
    ):
        raise ImportBlocked("Provider response does not match the configured alliance.")
    if not isinstance(members, list) or not 1 <= len(members) <= policy.max_members:
        raise ImportBlocked("Provider returned an invalid or oversized roster.")
    ids = [governor_id(m.get("governor_id", m.get("fid"))) for m in members]
    if len(set(ids)) != len(ids) or any(
        m.get("kid", policy.kingdom_id) != policy.kingdom_id for m in members
    ):
        raise ImportBlocked("Provider returned duplicate or cross-kingdom members.")
    if any(member not in ids for member in selected):
        raise ImportBlocked("Requested profiles must belong to the configured alliance.")
    profiles = {
        member: value for member, value in previous.get("profiles", {}).items() if member in ids
    }
    statuses = {member: "not_refreshed" for member in ids}

    def get_profile(member: str):
        try:
            data = client.get(
                f"/players/{member}?id_type=governor_id&include=base,heroes,ranks,gov_gear"
            )
        except ProviderError as error:
            if error.status == 404:
                return member, None, "unavailable"
            raise
        player = data.get("player")
        if not isinstance(player, dict) or governor_id(
            data.get("governor_id", player.get("governor_id", player.get("fid")))
        ) != member:
            raise ImportBlocked("Provider returned a mismatched governor profile.")
        affiliation = player.get("alliance", {})
        if player.get("kid", policy.kingdom_id) != policy.kingdom_id or (
            isinstance(affiliation, dict) and affiliation.get("abbr", policy.alliance_tag)
            != policy.alliance_tag
        ):
            return member, None, "membership_changed"
        return member, {
            "governor_id": member, **pick(data, FRESHNESS_FIELDS),
            "player": pick(player, PLAYER_FIELDS),
        }, "refreshed"

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(get_profile, member) for member in selected or ids]
        try:
            for future in as_completed(futures):
                member, value, status = future.result()
                statuses[member] = status
                if value is not None:
                    profiles[member] = value
        except Exception:
            client.stopped.set()
            for future in futures:
                future.cancel()
            raise
    board = previous.get("troop_power_board")
    if policy.include_troop_power_board:
        try:
            board = client.get(f"/kingdoms/{policy.kingdom_id}/ranks?board=troop_power&limit=100")
        except ProviderError as error:
            if error.status != 404:
                raise
    return redact({
        "schema": "mightpulse-alliance-snapshot", "version": 1,
        "kingdom_id": policy.kingdom_id, "alliance_tag": policy.alliance_tag,
        "generated_at": iso(now), "alliance": pick(alliance, ALLIANCE_FIELDS),
        "roster_freshness": pick(roster, FRESHNESS_FIELDS),
        "members": [pick(member, MEMBER_FIELDS) for member in members],
        "profiles": dict(sorted(profiles.items())), "profile_status": statuses,
        "troop_power_board": board, "upstream_requests": client.calls,
        "refresh_scope": "selected" if selected else "all",
    }, client.key)


def execute(raw_policy: dict, env: dict, ledger: dict, previous: dict, now: datetime,
            persist_reservation, transport=http_json, clock=time.monotonic, sleep=time.sleep):
    authorize(env)
    policy = Policy.read(raw_policy)
    key = env.get("MIGHTPULSE_API_KEY", "")
    if len(key) < 16 or len(key) > 1024 or any(ord(c) < 32 for c in key):
        raise ImportBlocked("Import disabled: set the private MIGHTPULSE_API_KEY Actions secret.")
    selected = requested_ids(env.get("MIGHTPULSE_MEMBER_IDS", ""), policy.max_members)
    if previous and (
        previous.get("schema") != "mightpulse-alliance-snapshot"
        or previous.get("version") != 1
        or previous.get("kingdom_id") != policy.kingdom_id
        or previous.get("alliance_tag") != policy.alliance_tag
    ):
        raise ImportBlocked("Saved snapshot belongs to a different alliance or schema.")
    if selected:
        known = {
            governor_id(member.get("governor_id", member.get("fid")))
            for member in previous.get("members", [])
        }
        if any(member not in known for member in selected):
            raise ImportBlocked("Selected updates require IDs from the saved alliance roster.")
    maximum = 1 + (len(selected) if selected else policy.max_members) + int(
        policy.include_troop_power_board
    )
    reservation = reserve_budget(ledger, policy, env, now, maximum)
    persist_reservation(reservation)
    client = Client(key, maximum, policy.calls_per_minute, transport, clock, sleep)
    return refresh(policy, client, previous, selected, now)


def read_json(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".pending")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(path)


def publish_file(path: Path, message: str):
    child_env = {k: v for k, v in os.environ.items() if k != "MIGHTPULSE_API_KEY"}
    for args in (
        ["add", "--", str(path.relative_to(ROOT))],
        ["commit", "-m", message],
        ["push", "origin", "HEAD:main"],
    ):
        completed = subprocess.run(
            ["git", *args], cwd=ROOT, env=child_env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        )
        if completed.returncode:
            raise ImportBlocked("Snapshot/quota publication failed; refresh stopped.")


def main():
    try:
        def persist(value):
            write_json(LEDGER_PATH, value)
            publish_file(LEDGER_PATH, "Reserve bounded owner-only MightPulse refresh budget")
        snapshot = execute(
            read_json(POLICY_PATH, {}), dict(os.environ), read_json(LEDGER_PATH, {}),
            read_json(SNAPSHOT_PATH, {}), datetime.now(timezone.utc), persist,
        )
        write_json(SNAPSHOT_PATH, snapshot)
        publish_file(SNAPSHOT_PATH, "Update cached alliance observations from MightPulse")
        print(f"Snapshot saved: {len(snapshot['members'])} members; "
              f"{snapshot['upstream_requests']} provider calls.")
    except ImportBlocked as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        print("Import failed; the previous published snapshot remains available.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
