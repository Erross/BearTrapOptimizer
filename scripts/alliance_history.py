#!/usr/bin/env python3
"""Append public, dated observations; never infer troop counts from power."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / 'web/data/history'
PROFILE_API = 'https://bear-optimizer-api.ewanrross.workers.dev/api/players/'
TYPES = ('infantry', 'cavalry', 'archers')


def stamp(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        date = (datetime.fromtimestamp(value, timezone.utc) if isinstance(value, (int, float))
                else datetime.fromisoformat(value.replace('Z', '+00:00')))
        if date.tzinfo is None:
            return None
        return date.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def count(value):
    if isinstance(value, bool):
        raise ValueError('Invalid inventory count')
    result = int(value)
    if result != float(value) or not 0 <= result <= 5_000_000:
        raise ValueError('Invalid inventory count')
    return result


def inventory(record):
    """Validate inventory only: old hero/preset choices do not invalidate counts."""
    item = record.get('input')
    if item is None:
        return None
    at = stamp(record.get('updatedAt'))
    if not at or not isinstance(item, dict) or not isinstance(item.get('stock'), dict):
        raise ValueError('Invalid inventory observation')
    stock = {str(t): {k: count(item['stock'].get(str(t), {}).get(k, 0)) for k in TYPES}
             for t in (10, 9, 8)}
    lower = {k: count(item.get('ownTroops', {}).get(k, 0))
             if item.get('ownEnabled') is True and item.get('ownTier') == 'lower' else 0
             for k in TYPES}
    types = {k: sum(row[k] for row in stock.values()) + lower[k] for k in TYPES}
    if sum(types.values()) > 5_000_000:
        raise ValueError('Invalid inventory total')
    return {'at': at, 'revision': count(record.get('revision', 0)), 'stock': stock,
            'lower': lower, 'types': types, 'total': sum(types.values())}


def get_profile(identity):
    # This endpoint is public. No provider API key or organizer credential is sent.
    try:
        request = Request(PROFILE_API + identity, headers={'User-Agent': 'BearTrapOptimizer-history/1.0'})
        with urlopen(request, timeout=12) as response:
            raw = response.read(25_001)
        if len(raw) > 25_000:
            return None
        result = json.loads(raw)
        if str(result.get('governorId')) != identity:
            return None
        return result
    except Exception:
        return None


def load(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n'
    if path.exists() and path.read_text() == content:
        return []
    temporary = path.with_suffix('.pending')
    temporary.write_text(content)
    temporary.replace(path)
    return [path]


def append(series, point):
    # A cached source time is one observation, even if captured by several imports.
    if not any(p['at'] == point['at'] for p in series):
        series.append(point)
        series.sort(key=lambda p: p['at'])


def archive(snapshot, records=None, directory=DIRECTORY, captured_at=None):
    """Preserve departed players and previous points; missing/error reads add no zero."""
    index = load(directory / 'index.json', {'version': 1, 'players': []})
    if index.get('version') != 1 or not isinstance(index.get('players'), list):
        raise ValueError('Unknown history index')
    players = {p['id']: dict(p, active=False) for p in index['players']}
    at = stamp(snapshot.get('roster_freshness', {}).get('cached_at'))
    # Legacy snapshots without a provider timestamp use their recorded capture time.
    at = at or stamp(snapshot.get('generated_at'))
    if not at:
        raise ValueError('Snapshot has no timestamp')
    captured = stamp(captured_at or snapshot['generated_at'])
    paths = []
    checked = saved = errors = not_checked = 0
    for member in snapshot['members']:
        identity = str(member.get('governor_id', member.get('fid')))
        if not re.fullmatch(r'[1-9]\d{0,19}', identity):
            raise ValueError('Invalid history identity')
        players[identity] = {'id': identity, 'name': member.get('nick_name') or identity, 'active': True}
        path = directory / (identity + '.json')
        history = load(path, {'version': 1, 'id': identity, 'power': [], 'troops': []})
        if history.get('version') != 1 or history.get('id') != identity:
            raise ValueError('Unknown player history')
        power, level = member.get('power'), member.get('town_center_level')
        if isinstance(power, int) and not isinstance(power, bool) and power >= 0:
            append(history['power'], {'at': at, 'power': power,
                                     'townLevel': level if isinstance(level, int) and level > 0 else None})
        if records is not None:
            record = records.get(identity)
            if identity not in records:
                not_checked += 1
            elif record is None:
                errors += 1
            else:
                try:
                    point = inventory(record)
                    checked += 1
                    if point:
                        point['capturedAt'] = captured if captured >= point['at'] else None
                        append(history['troops'], point)
                        saved += 1
                except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
                    errors += 1
        paths += save(path, history)
    index = {'version': 1, 'updatedAt': captured,
             'players': sorted(players.values(), key=lambda p: (p['name'].casefold(), p['id']))}
    if records is not None:
        index['profileCapture'] = {'at': captured, 'checked': checked, 'saved': saved, 'unavailable': errors, 'notChecked': not_checked}
    paths += save(directory / 'index.json', index)
    return paths


def capture(snapshot, directory=DIRECTORY):
    identities = [str(m.get('governor_id', m.get('fid'))) for m in snapshot['members']]
    with ThreadPoolExecutor(max_workers=6) as pool:
        records = dict(zip(identities, pool.map(get_profile, identities)))
    return archive(snapshot, records, directory, datetime.now(timezone.utc).isoformat())


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backfill', action='store_true', help='Recover committed roster snapshots without provider calls')
    parser.add_argument('--capture-profiles', action='store_true', help='Read current public player submissions')
    args = parser.parse_args()
    if args.backfill:
        commits = subprocess.check_output(['git', 'log', '--reverse', '--format=%H', 'HEAD', '--',
                                          'web/data/alliance-api.json'], cwd=ROOT, text=True).splitlines()
        for commit in commits:
            snapshot = json.loads(subprocess.check_output(['git', 'show', commit + ':web/data/alliance-api.json'], cwd=ROOT))
            archive(snapshot)
        print(f'Archived {len(commits)} committed roster snapshots.')
    if args.capture_profiles:
        capture(load(ROOT / 'web/data/alliance-api.json', {}))
