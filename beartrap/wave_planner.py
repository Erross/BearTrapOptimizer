"""Bounded damage search with a required joining packet in the opening wave."""
from dataclasses import asdict, replace
import math
from .analysis import compare
from .model import Member, Mechanics, Strategy
from .simulator import simulate


def optimize_waves(payload):
    base = compare(payload)
    members = [Member.parse(row) for row in base['roster']]
    mechanics = Mechanics.parse(base['mechanics'])
    count = sum(m.can_host for m in members)
    if count < 2:
        raise ValueError('Opening joins for everyone need at least two rally starters.')
    source = Strategy.parse(payload.get('strategies', [payload.get('strategy', {})])[0])
    common = replace(source, host_count=count, host_names=(), cadence='groups',
                     first_wave_join=True, reserve_lead_troops=True, final_push=False,
                     host_allocation='small', troop_split='concentrated',
                     group_repeat='ready', wave_cycle_s=0, join_policy='next', join_window_s=0)
    limit = payload.get('opening_limit_s', 240)
    if type(limit) is not int or not 0 <= limit <= 3600:
        raise ValueError('First-start window must be 0–3600 seconds.')
    tested, seen = [], set()

    def trial(s):
        key = tuple((k, tuple(v) if k == 'host_names' else v) for k, v in asdict(s).items() if k != 'name')
        if key in seen or len(tested) >= 144:
            return
        seen.add(key)
        if limit and (min(s.host_count, s.opening_wave_count)-1)*s.wave_interval_s > limit:
            return
        run = simulate(members, mechanics, s, travel_times=payload.get('travel_times'))
        summary = run['summary']
        feasible = not summary['first_wave_missing_count'] and not summary['starters_without_first_rally'] and (not limit or summary['opening_last_start_s'] <= limit)
        row = {'strategy': run['strategy'], 'total_damage': run['total_damage'], **summary,
               'opening_feasible': feasible, 'selected_hosts': run['selected_hosts']}
        tested.append(row)

    def finalists():
        return sorted((i for i, row in enumerate(tested) if row['opening_feasible']), key=lambda i: (-tested[i]['total_damage'], tested[i]['ready_wait_fraction']))[:2]

    for waves in (1, 2, 3, 4, 5):
        for gap in ((0,) if waves == 1 else (30, 45, 60, 75, 90)):
            for cap in (50000, 100000, 0):
                trial(replace(common, opening_wave_count=waves, wave_interval_s=gap, join_march_cap=cap))
    seeds = [Strategy.parse(tested[i]['strategy']) for i in finalists()]
    for s in seeds:
        for hosts in dict.fromkeys((count, max(2, math.ceil(count*.75)), max(2, min(count, payload.get('host_count', count))))):
            for own in (.00001, .05):
                for window in (0, 15):
                    for policy in ('next', 'rate'):
                        trial(replace(s, host_count=hosts, small_host_fraction=own,
                                      join_window_s=window, join_policy=policy))
    seeds = [Strategy.parse(tested[i]['strategy']) for i in finalists()]
    for s in seeds:
        for delta in (-10, 10):
            for window in (s.join_window_s, 30):
                trial(replace(s, wave_interval_s=max(1, s.wave_interval_s+delta), join_window_s=window))
    best = finalists()
    if not best:
        raise ValueError('No tested wave plan gives everyone an opening join. Check travel, troop stocks, starter permissions and opening capacity.')
    winner = simulate(members, mechanics, Strategy.parse(tested[best[0]]['strategy']), travel_times=payload.get('travel_times'))
    winner['strategy']['name'] = 'Optimized waves'
    tested.sort(key=lambda row: (not row['opening_feasible'], -row['total_damage'], row['ready_wait_fraction']))
    return {'best': winner, 'tested': tested, 'mechanics': base['mechanics'],
            'note': 'Best tested total alliance damage, requiring everyone to join the opening wave. Tested 1–5 waves, gaps, starter counts, 50k/100k/uncapped joins, tiny/5% leader packets, immediate/late joining and next-hit/rate selection. Troops remain unavailable through gathering, travel and return. Not a proof of a global optimum; damage and player inputs remain estimates.'}
