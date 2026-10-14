"""One-second discrete-event/resource simulation; no game automation."""
from dataclasses import asdict
import heapq
import math
from .model import Mechanics, Strategy
from .combat import TYPES, inventory, allocate, effective_components, rally_components, host_rating


def starter_pool(members, mechanics, strategy):
    ratings = [host_rating(m, mechanics) for m in members]
    strongest = max((ratings[i] for i,m in enumerate(members) if m.can_host),default=1)
    relative = [100*r/strongest for r in ratings]
    eligible = sorted((i for i,m in enumerate(members) if m.can_host
                       and relative[i]+1e-9 >= strategy.host_min_relative_score
                       and m.rally_capacity >= strategy.host_min_rally_capacity),
                      key=lambda i:(-ratings[i],-members[i].rally_capacity,members[i].name))
    return ratings, relative, eligible


def join_travel_matrix(members, supplied):
    """Partial name-keyed city-to-city times; missing entries keep member defaults."""
    names = {m.name for m in members}
    if supplied is None:
        supplied = {}
    if not isinstance(supplied, dict) or set(supplied) - names:
        raise ValueError("Joining travel must use known roster names")
    for row in supplied.values():
        if not isinstance(row, dict) or set(row) - names:
            raise ValueError("Joining travel rows must use known roster names")
        for seconds in row.values():
            if type(seconds) is not int or not 0 <= seconds <= 3600:
                raise ValueError("Joining travel must be whole seconds from 0–3,600")
    return [[supplied.get(m.name, {}).get(host.name, m.join_travel_s)
             for host in members] for m in members]


def simulate(members, mechanics=Mechanics(), strategy=Strategy(), audit=False, travel_times=None):
    if not members or len(members) > 100:
        raise ValueError("Roster must contain 1–100 members")
    for m in members:
        m.validate()
    Mechanics.parse(asdict(mechanics))
    Strategy.parse(asdict(strategy))
    names = [m.name for m in members]
    if len(set(names)) != len(names):
        raise ValueError("Member names must be unique")
    if set(strategy.host_names) - set(names):
        raise ValueError("Selected host does not exist in the roster")
    join_travel = join_travel_matrix(members, travel_times)
    ratings, relative_scores, eligible = starter_pool(members,mechanics,strategy)
    hosts = [i for i in eligible if names[i] in strategy.host_names] if strategy.host_names else eligible[:strategy.host_count]
    # Choose leaders by strength first, then schedule successive opening groups
    # from the shortest travel to the longest. Keep simultaneous dispatch order.
    opening_waves = min(len(hosts), strategy.opening_wave_count) if strategy.opening_wave_count else math.ceil(len(hosts)/strategy.group_size)
    if (strategy.cadence == "groups" and opening_waves > 1 and strategy.wave_interval_s > 0
            or strategy.cadence == "waves" and len(hosts) > 1):
        hosts.sort(key=lambda i: members[i].outbound_s)
    host_set = set(hosts)
    n = len(members)
    minimum_join_travel = [min((join_travel[i][host] for host in eligible if host != i),
                              default=m.join_travel_s) for i, m in enumerate(members)]
    available = [m.troops for m in members]
    available_types = [inventory(m) for m in members]
    original_types = [dict(x) for x in available_types]
    lead_busy = [False]*n
    slots = [0]*n
    next_dispatch = [0]*n
    next_start = [0]*n
    cycles = [mechanics.countdown_s + m.outbound_s + m.return_s + mechanics.reaction_s for m in members]
    reference_cycle = max((cycles[i] for i in hosts), default=mechanics.countdown_s)
    phases = {}
    for rank,i in enumerate(hosts):
        phases[i] = (0 if strategy.cadence == "synchronized" else
                     int(rank*reference_cycle/max(1,len(hosts))) if strategy.cadence == "staggered" else
                     (rank*min(3,len(hosts))//len(hosts))*90 if strategy.cadence == "waves" else
                     ((rank*min(len(hosts),strategy.opening_wave_count)//len(hosts)) if strategy.opening_wave_count else rank//strategy.group_size)*strategy.wave_interval_s if strategy.cadence == "groups" else rank*strategy.spacing_s)
        next_start[i] = phases[i]
    group_cycle = 0
    if strategy.cadence == "groups" and strategy.group_repeat == "fixed":
        opening_waves = min(len(hosts),strategy.opening_wave_count) if strategy.opening_wave_count else math.ceil(len(hosts)/strategy.group_size)
        minimum_cycle = max(reference_cycle, opening_waves*strategy.wave_interval_s)
        group_cycle = strategy.wave_cycle_s or (math.ceil(minimum_cycle/strategy.wave_interval_s)*strategy.wave_interval_s if strategy.wave_interval_s else minimum_cycle)
        if group_cycle < minimum_cycle:
            raise ValueError(f"Shared group cycle must be at least {minimum_cycle}s for these starters and travel times")
    rallies, open_rallies, events, hits, contributions = [], [], [], [], []
    series = [{"second":0,"damage":0.0}]
    individual_series = {m.name:[{"second":0,"damage":0.0}] for m in members}
    totals = [0.0]*n
    troops_used = [0]*n
    attacks = [0]*n
    led = [0]*n
    join_count = [0]*n
    troop_busy_seconds = [0]*n
    slot_busy_seconds = [0]*n
    type_busy_seconds = [dict.fromkeys(TYPES, 0) for m in members]
    type_damage = [dict.fromkeys(TYPES, 0.0) for m in members]
    type_hits = [dict.fromkeys(TYPES, 0) for m in members]
    utilization = []
    ready_wait = [0]*n
    held_seconds = [0]*n
    missed_waves = [0]*n
    deployable = sum(min(m.troops,m.march_capacity*(m.join_slots+(1 if m.can_host else 0))) for m in members)
    max_departure = mechanics.duration_s-min((members[i].outbound_s for i in eligible),default=0)-1
    def own_quota(i):
        m=members[i]
        desired = (m.march_capacity if strategy.host_allocation=="full" else
                   max(1,round(m.march_capacity*strategy.small_host_fraction)) if strategy.host_allocation=="small" else
                   max(1,math.ceil(m.troops/(m.join_slots+1))))
        return min(m.troops,m.march_capacity,m.rally_capacity,desired)
    serial = 0
    def enqueue(t, kind, data):
        nonlocal serial
        serial += 1
        heapq.heappush(events,(t,serial,kind,data))
    def contribution_damage(composition, i, host):
        return sum(effective_components(composition, members[i], members[host], mechanics).values()) * members[host].host_strength * mechanics.score_per_effective_troop
    def permitted(departure, host):
        return departure + members[host].outbound_s < mechanics.duration_s
    final_push_at = max(0, mechanics.duration_s-mechanics.countdown_s-max(m.outbound_s for m in members)-30)
    horizon = mechanics.duration_s
    for now in range(horizon+1):
        while events and events[0][0] <= now:
            _,_,kind,data = heapq.heappop(events)
            if kind == "release":
                i, amount, leader, mix = data
                available[i] += amount
                for t in TYPES:
                    available_types[i][t] += mix[t]
                if leader:
                    lead_busy[i] = False
                else:
                    slots[i] -= 1
            elif kind == "depart":
                data["status"] = "travelling"
                if data in open_rallies:
                    open_rallies.remove(data)
            elif kind == "hit":
                rally = data
                rally["status"] = "hit"
                damage = 0.0
                components = rally_components(rally["participants"], members, members[rally["host_index"]], mechanics)
                for p, by_type in zip(rally["participants"], components):
                    i = p["member_index"]
                    amount = p["troops"]
                    d = sum(by_type.values())
                    for t in TYPES:
                        type_damage[i][t] += by_type[t]
                        type_hits[i][t] += p["composition"][t]
                    damage += d
                    totals[i] += d
                    attacks[i] += 1
                    troops_used[i] += amount
                    individual_series[names[i]].append({"second":now,"damage":totals[i]})
                    contributions.append({"rally_id":rally["id"],"host":names[rally["host_index"]],
                        "member":names[i],"troops":amount,"composition":p["composition"],"damage_by_type":by_type,"damage":d,"second":now,"role":p["role"]})
                rally["damage"] = damage
                hits.append({"second":now,"damage":damage,"rally_id":rally["id"],
                             "host":names[rally["host_index"]],"troops":rally["troops"],
                             "fill":rally["troops"]/members[rally["host_index"]].rally_capacity})
                series.append({"second":now,"damage":sum(totals)})
        active_hosts = list(hosts)
        if strategy.final_push and now >= final_push_at:
            for i in eligible:
                if i not in host_set:
                    active_hosts.append(i)
        for i in active_hosts:
            if group_cycle and i in host_set and now >= next_start[i]:
                if now > next_start[i]:
                    missed = math.ceil((now-next_start[i])/group_cycle)
                    missed_waves[i] += missed
                    next_start[i] += missed*group_cycle
                if now != next_start[i]:
                    continue
                next_start[i] += group_cycle
                if lead_busy[i] or now < phases[i] or not available[i]:
                    missed_waves[i] += 1
                    continue
            elif lead_busy[i] or now < next_start[i] or available[i] == 0:
                continue
            departure = now+mechanics.countdown_s
            if not permitted(departure,i):
                continue
            m = members[i]
            if strategy.host_allocation == "full":
                desired = m.march_capacity
            elif strategy.host_allocation == "small":
                desired = max(1,round(m.march_capacity*strategy.small_host_fraction))
            else:
                desired = max(1,math.ceil(m.troops/(m.join_slots+1)))
            amount = min(available[i],m.march_capacity,m.rally_capacity,desired)
            mix = allocate(available_types[i], amount, m, m, mechanics, strategy)
            amount = sum(mix.values())
            if not amount:
                if group_cycle and i in host_set:
                    missed_waves[i] += 1
                continue
            available[i] -= amount
            for t in TYPES:
                available_types[i][t] -= mix[t]
            lead_busy[i] = True
            led[i] += 1
            hit = departure+m.outbound_s
            rally = {"id":len(rallies)+1,"host":names[i],"host_index":i,"start_s":now,
                     "departure_s":departure,"hit_s":hit,"troops":amount,"status":"forming",
                     "participants":[{"member_index":i,"troops":amount,"composition":mix,"role":"lead","sent_s":now}]}
            rallies.append(rally)
            open_rallies.append(rally)
            enqueue(departure,"depart",rally)
            enqueue(hit,"hit",rally)
            enqueue(hit+m.return_s,"release",(i,amount,True,mix))
            if group_cycle and i in host_set:
                pass
            elif strategy.cadence == "synchronized" or (strategy.cadence == "groups" and strategy.group_repeat == "ready"):
                next_start[i] = hit+m.return_s+mechanics.reaction_s
            else:
                next_start[i] = phases.get(i,now)+((now-phases.get(i,now))//cycles[i]+1)*cycles[i]
        # Rotate the order each second: avoids permanent first-row privilege.
        order = [(now+j)%n for j in range(n)]
        waiting_now = 0
        held_now = 0
        for i in order:
            m = members[i]
            reserve = dict.fromkeys(TYPES,0)
            if strategy.reserve_lead_troops and i in active_hosts and not lead_busy[i] and permitted(max(now,next_start[i])+mechanics.countdown_s,i):
                reserve = allocate(available_types[i], min(available[i],own_quota(i)),m,m,mechanics,strategy)
            reserve_amount = sum(reserve.values())
            held_now += reserve_amount
            if now < mechanics.duration_s:
                held_seconds[i] += reserve_amount
            join_available = {t:available_types[i][t]-reserve[t] for t in TYPES}
            join_total = sum(join_available.values())
            if slots[i] >= m.join_slots or not join_total or now < next_dispatch[i] or now >= mechanics.duration_s:
                continue
            candidates = []
            for r in open_rallies:
                if r["host_index"] == i or any(p["member_index"] == i for p in r["participants"]):
                    continue
                if now+join_travel[i][r["host_index"]] >= r["departure_s"] or len(r["participants"])-1 >= mechanics.joiner_cap:
                    continue
                remaining = members[r["host_index"]].rally_capacity-r["troops"]
                if remaining < 1:
                    continue
                desired = (m.march_capacity if strategy.troop_split == "concentrated" else
                           max(1,math.ceil(max(0,m.troops-(own_quota(i) if i in active_hosts else 0))/max(1,m.join_slots))) if strategy.reserve_lead_troops else
                           max(1,math.ceil(m.troops/(m.join_slots+(1 if i in active_hosts else 0)))))
                amount = min(desired,m.march_capacity,join_total,remaining,strategy.join_march_cap or m.march_capacity)
                mix = allocate(join_available, amount, m, members[r["host_index"]], mechanics, strategy)
                amount = sum(mix.values())
                if not amount:
                    continue
                if mechanics.damage_model == "sqrt" and mechanics.damage_scope == "rally":
                    # Compare marginal alliance damage, not an independent-march proxy.
                    before = sum(sum(x.values()) for x in rally_components(r["participants"], members, members[r["host_index"]], mechanics))
                    after = sum(sum(x.values()) for x in rally_components(r["participants"]+[{"member_index":i,"composition":mix}], members, members[r["host_index"]], mechanics))
                    d = after-before
                else:
                    d = contribution_damage(mix,i,r["host_index"])
                priority = (-r["hit_s"] if strategy.join_policy == "next" else
                            ratings[r["host_index"]] if strategy.join_policy == "strength" else
                            d/(amount*max(1,r["hit_s"]+m.return_s-now)))
                candidates.append((priority,-r["hit_s"],-r["id"],amount,r,mix))
            if not candidates:
                if now+minimum_join_travel[i] < max_departure:
                    ready = min(join_total,(m.join_slots-slots[i])*m.march_capacity)
                    ready_wait[i] += ready
                    waiting_now += ready
                continue
            _,_,_,amount,r,mix = max(candidates,key=lambda x:x[:3])
            available[i] -= amount
            for t in TYPES:
                available_types[i][t] -= mix[t]
            slots[i] += 1
            join_count[i] += 1
            next_dispatch[i] = now+mechanics.reaction_s
            r["troops"] += amount
            r["participants"].append({"member_index":i,"troops":amount,"composition":mix,"role":"join","sent_s":now})
            enqueue(r["hit_s"]+m.return_s,"release",(i,amount,False,mix))
        if now < mechanics.duration_s:
            for i,m in enumerate(members):
                troop_busy_seconds[i] += m.troops-available[i]
                slot_busy_seconds[i] += slots[i]
                for t in TYPES:
                    type_busy_seconds[i][t] += original_types[i][t]-available_types[i][t]
        if now%15 == 0:
            utilization.append({"second":now,"committed_troops":sum(m.troops for m in members)-sum(available),
                                "free_troops":sum(available),"forming_rallies":len(open_rallies),
                                "ready_waiting_troops":waiting_now,"reserved_for_own_rallies":held_now})
        if audit:
            committed = [0]*n
            committed_types = [dict.fromkeys(TYPES, 0) for m in members]
            for r in rallies:
                for p in r["participants"]:
                    i = p["member_index"]
                    if r["hit_s"]+members[i].return_s > now:
                        committed[i] += p["troops"]
                        for t in TYPES:
                            committed_types[i][t] += p["composition"][t]
            for i,m in enumerate(members):
                assert 0 <= available[i] <= m.troops, (now,i,available[i])
                assert available[i]+committed[i] == m.troops, (now,i,available[i],committed[i])
                assert 0 <= slots[i] <= m.join_slots
                for t in TYPES:
                    assert available_types[i][t] >= 0
                    assert available_types[i][t]+committed_types[i][t] == original_types[i][t], (now, i, t)
            for r in rallies:
                assert r["troops"] <= members[r["host_index"]].rally_capacity
                assert len(r["participants"])-1 <= mechanics.joiner_cap
                ids = [p["member_index"] for p in r["participants"]]
                assert len(ids) == len(set(ids))
                assert all(sum(p["composition"].values()) == p["troops"] for p in r["participants"])
    total = sum(totals)
    last_t = max(mechanics.duration_s,max((h["second"] for h in hits),default=0))
    series.append({"second":last_t,"damage":total})
    for i in range(n):
        individual_series[names[i]].append({"second":last_t,"damage":totals[i]})
    unique_hit_times = sorted(set(h["second"] for h in hits))
    gaps = [b-a for a,b in zip(unique_hit_times,unique_hit_times[1:])]
    tail_gap = mechanics.duration_s-unique_hit_times[-1] if unique_hit_times and unique_hit_times[-1] < mechanics.duration_s else 0
    by_minute = [0.0]*(math.ceil(last_t/60)+1)
    for h in hits:
        by_minute[min(len(by_minute)-1,h["second"]//60)] += h["damage"]
    initial_starts = {names[i]:next((r["start_s"] for r in rallies if r["host_index"]==i),None) for i in hosts}
    role_rows=[]
    for i,m in enumerate(members):
        reason = ("Not permitted to start" if not m.can_host else
                  "Below minimum rally capacity" if m.rally_capacity < strategy.host_min_rally_capacity else
                  "Below minimum leader score" if relative_scores[i]+1e-9 < strategy.host_min_relative_score else
                  "Regular starter" if i in host_set else "Eligible, outside selected starter count")
        role_rows.append({"name":m.name,"relative_score":relative_scores[i],"rally_capacity":m.rally_capacity,
                          "regular_starter":i in host_set,"eligible":i in eligible,"reason":reason})
    return {"strategy":asdict(strategy),"total_damage":total,"series":series,"individual_series":individual_series,
        "hits":hits,"rallies":rallies,"contributions":contributions,"utilization":utilization,
        "minute_damage":by_minute,"selected_hosts":[names[i] for i in hosts],
        "host_ratings":dict(zip(names, ratings)),
        "host_eligibility":role_rows,"initial_starts":initial_starts,"planned_initial_starts":{names[i]:phases[i] for i in hosts},
        "group_cycle_s":group_cycle,"deployable_troops":deployable,
        "damage_by_type": {t:sum(x[t] for x in type_damage) for t in TYPES},
        "summary":{"rallies":len(hits),"mean_fill":sum(h["fill"] for h in hits)/max(1,len(hits)),
                   "max_gap_s":max(gaps+[tail_gap],default=0),"opening_wait_s":unique_hit_times[0] if unique_hit_times else mechanics.duration_s,
                   "troop_utilization":sum(troop_busy_seconds)/(mechanics.duration_s*sum(m.troops for m in members)),
                   "ready_wait_troop_seconds":sum(ready_wait),"ready_wait_fraction":sum(ready_wait)/max(1,mechanics.duration_s*deployable),
                   "ready_wait_equivalent_s":sum(ready_wait)/max(1,deployable),"reserved_troop_seconds":sum(held_seconds),
                   "missed_group_starts":sum(missed_waves),"starters_without_first_rally":sum(t is None for t in initial_starts.values()),
                   "opening_last_start_s":max((t for t in initial_starts.values() if t is not None),default=0),
                   "committed_at_60s":next((p["committed_troops"] for p in utilization if p["second"]==60),0),
                   "committed_at_240s":next((p["committed_troops"] for p in utilization if p["second"]==240),0)},
        "members":[{"name":names[i],"damage":totals[i],"historical_score":m.historical_score,
                    "damage_by_type":type_damage[i],"troop_hits_by_type":type_hits[i],
                    "inventory_estimated":m.infantry is None,
                    "type_utilization":{t:type_busy_seconds[i][t]/max(1,mechanics.duration_s*original_types[i][t]) for t in TYPES},
                    "attacks":attacks[i],"rallies_led":led[i],"joins":join_count[i],"troop_hits":troops_used[i],
                    "troop_utilization":troop_busy_seconds[i]/(mechanics.duration_s*m.troops),
                    "ready_wait_equivalent_s":ready_wait[i]/max(1,min(m.troops,m.march_capacity*(m.join_slots+(1 if m.can_host else 0)))),
                    "reserved_troop_seconds":held_seconds[i],
                    "join_slot_utilization":slot_busy_seconds[i]/max(1,mechanics.duration_s*m.join_slots)} for i,m in enumerate(members)]}
