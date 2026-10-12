from dataclasses import asdict, replace, fields
import statistics
import math
from .model import Member, Mechanics, Strategy, synthetic_roster
from .simulator import simulate, starter_pool
from .combat import effective_components


def default_strategies(n, count, custom=Strategy()):
    strategies = [
        Strategy("All hosts · synchronized baseline", n, "synchronized", "next", "full", "equal"),
        Strategy("All hosts · evenly staggered", n, "staggered", "next", "full", "equal"),
        Strategy("Selected hosts · next impact", count, "staggered", "next", "equal", "equal"),
        Strategy("Selected hosts · efficient joins", count, "staggered", "rate", "equal", "equal"),
        Strategy("Selected hosts · small host marches", count, "staggered", "rate", "small", "equal"),
        Strategy("Selected hosts · concentrated troops", count, "staggered", "rate", "equal", "concentrated"),
        Strategy("Three waves · efficient joins", count, "waves", "rate", "equal", "equal"),
    ]
    strategies = [replace(s, formation=custom.formation, infantry_pct=custom.infantry_pct, cavalry_pct=custom.cavalry_pct) for s in strategies]
    strategies += [replace(custom,name=label,host_names=(),host_count=n,cadence="groups",group_size=size,
                           wave_interval_s=60,group_repeat=repeat,wave_cycle_s=0,host_allocation="small",
                           troop_split="equal",join_policy="next",reserve_lead_troops=True)
                   for label,size,repeat in (("Groups of 10 · every 60 seconds",10,"ready"),
                                             ("Groups of 8 · every 60 seconds",8,"ready"),
                                             ("Shared group cycle · every 60 seconds",10,"fixed"))]
    strategies = [replace(s,host_min_relative_score=custom.host_min_relative_score,
                          host_min_rally_capacity=custom.host_min_rally_capacity) for s in strategies]
    strategies += [replace(custom, name="Formation test · "+policy, formation=policy)
                   for policy in ("inventory", "strict", "adaptive", "optimized") if policy != custom.formation]
    return strategies


def compare(payload):
    members = [Member.parse(r) for r in payload["roster"]] if "roster" in payload else synthetic_roster(**payload.get("synthetic",{}))
    mechanics = Mechanics.parse(payload.get("mechanics",{}))
    count = int(payload.get("host_count",12))
    custom = Strategy.parse(payload.get("strategy",{}))
    if "strategies" in payload:
        rows = payload["strategies"]
        if not isinstance(rows,list) or not 1 <= len(rows) <= 12:
            raise ValueError("Provide 1–12 comparison approaches")
        strategies = [Strategy.parse(row) for row in rows]
        if len({s.name for s in strategies}) != len(strategies) or any(not s.name.strip() for s in strategies):
            raise ValueError("Comparison approaches need unique, non-empty names")
    else:
        strategies = default_strategies(len(members),count,custom)
        strategies.append(replace(custom,name="Your custom strategy"))
    # Fit once to an explicitly chosen baseline; NEVER fit each scenario separately.
    normalization = payload.get("normalization", {})
    target = float(normalization.get("target",2e9))
    if not 0 < target <= 1e13:
        raise ValueError("Normalization target must be >0 and <=10 trillion")
    baseline_strategy = Strategy.parse(normalization["strategy"]) if normalization.get("strategy") else strategies[0]
    fit_enabled = bool(normalization.get("enabled",True))
    if fit_enabled:
        baseline = simulate(members,mechanics,baseline_strategy)
        if not baseline["total_damage"]:
            raise ValueError("Chosen normalization baseline scored zero; add eligible hosts or turn normalization off")
        mechanics = replace(mechanics,score_per_effective_troop=mechanics.score_per_effective_troop*target/baseline["total_damage"])
    runs = [simulate(members,mechanics,s) for s in strategies]
    best = max(runs,key=lambda x:x["total_damage"])
    return {"roster":[asdict(m) for m in members],"mechanics":asdict(mechanics),"runs":runs,
            "normalization":{"enabled":fit_enabled,"target":target,"baseline_strategy":asdict(baseline_strategy)},
            "best_name":best["strategy"]["name"],"synthetic": "roster" not in payload,
            "assumptions":[
                "Damage model and scope are editable approximations. Community square-root equations are not official game documentation.",
                "Host strength is an empirical input, not derived from town level or account power.",
                "Historical personal event totals are context only; they are not host coefficients.",
                "Host slot is separate from joining slots. Each player can join a particular rally once.",
                "Rally capacity includes the host. Joiner cap and all timing mechanics are editable.",
                "Join travel is a per-member approximation, not a city-to-city distance matrix.",
                "Troop inventories and tiers are tracked. Host Attack and Lethality bonuses apply by type; residual hero effects remain in host strength.",
                "A better sampled scenario is not proof of a global optimum or a measured in-game improvement.",
            ]}


def search(payload):
    base = compare(payload)
    members = [Member.parse(r) for r in base["roster"]]
    mechanics = Mechanics.parse(base["mechanics"])
    custom = Strategy.parse(payload.get("strategy",{}))
    goal = payload.get("search_goal","damage")
    opening_limit = payload.get("opening_limit_s",240)
    if goal not in ("damage","flow","balanced") or not isinstance(opening_limit,int) or not 0 <= opening_limit <= 3600:
        raise ValueError("Search goal must be damage or flow; first-start window must be 0–3600 seconds")
    _,_,pool=starter_pool(members,mechanics,custom)
    if custom.host_names:
        pool=[i for i in pool if members[i].name in custom.host_names]
    if not pool:
        raise ValueError("No starters meet the current permission, leader-score and rally-capacity rules")
    def rank(row):
        return ((row["ready_wait_fraction"],-row["total_damage"]) if goal=="flow" else
                (-row["total_damage"],row["ready_wait_fraction"]))
    def valid(row):
        return not row["starters_without_first_rally"] and (not opening_limit or row["opening_last_start_s"]<=opening_limit)
    tested=[]
    seen=set()
    best_run=None
    best_damage=None
    best_flow=None
    def record(run):
        nonlocal best_run,best_damage,best_flow
        row={"strategy":run["strategy"],"total_damage":run["total_damage"],**run["summary"],"selected_hosts":run["selected_hosts"],"opening_feasible":valid(run["summary"])}
        if not row["opening_feasible"]:
            tested.append(row)
            return
        tested.append(row)
        if best_run is None or rank(row)<rank({"total_damage":best_run["total_damage"],**best_run["summary"]}):best_run=run
        if best_damage is None or (-row["total_damage"],row["ready_wait_fraction"])<(-best_damage["total_damage"],best_damage["ready_wait_fraction"]):best_damage=row
        if best_flow is None or (row["ready_wait_fraction"],-row["total_damage"])<(best_flow["ready_wait_fraction"],-best_flow["total_damage"]):best_flow=row
    def strategy_key(s):
        return tuple((k,tuple(v) if k=="host_names" else v) for k,v in asdict(s).items() if k!="name")
    for run in base["runs"]:
        record(run)
        seen.add(strategy_key(Strategy.parse(run["strategy"])))
    def trial(s):
        key=strategy_key(s)
        if key in seen or len(tested)>=420:return
        seen.add(key)
        if s.cadence=="groups" and opening_limit and ((s.host_count-1)//s.group_size)*s.wave_interval_s>opening_limit:return
        record(simulate(members,mechanics,s))
    # Stage 1: select candidate starter pools using combined leader rating and
    # capacity, then compare group and individually staggered launch protocols.
    capacities=sorted(members[i].rally_capacity for i in pool)
    floors=list(dict.fromkeys([custom.host_min_rally_capacity,*[max(custom.host_min_rally_capacity,capacities[int((len(capacities)-1)*q)]) for q in (.25,.5,.75)]]))
    percentages=list(dict.fromkeys([custom.host_min_relative_score,*[max(custom.host_min_relative_score,x) for x in (25,50,75)]]))
    counts=sorted({min(len(pool),x) for x in (4,8,12,16,24,len(pool),max(1,custom.host_count))})
    candidates=[];groups_seen=set()
    for cap in floors:
        for percent in percentages:
            rule=replace(custom,host_min_relative_score=percent,host_min_rally_capacity=cap)
            _,_,indices=starter_pool(members,mechanics,rule)
            indices=[i for i in indices if i in pool]
            for count in counts:
                selected=tuple(members[i].name for i in indices[:count])
                if not selected or selected in groups_seen:continue
                groups_seen.add(selected)
                candidates.append(replace(rule,host_names=selected,host_count=len(selected),cadence="groups",wave_cycle_s=0,
                                          host_allocation="small",troop_split="equal",join_policy="next",reserve_lead_troops=True))
    # Deterministic bounded sampling covers unrestricted and stricter pools.
    if len(candidates)>32:
        candidates=[candidates[round(i*(len(candidates)-1)/31)] for i in range(32)]
    for s in candidates:
        trial(replace(s,group_size=10,wave_interval_s=60,group_repeat="ready",name="Starter pool · groups of 10"))
        trial(replace(s,group_size=10,wave_interval_s=60,group_repeat="fixed",name="Starter pool · shared group clock"))
        trial(replace(s,group_size=max(1,math.ceil(s.host_count/5)),wave_interval_s=60,group_repeat="ready",name="Starter pool · spread over four minutes"))
        trial(replace(s,cadence="staggered",name="Starter pool · individual starts"))
    finalists=sorted((r for r in tested if r["opening_feasible"]),key=rank)[:4]
    # Stage 2: vary group size, interval and restart rule around promising pools.
    for row in finalists:
        s=Strategy.parse(row["strategy"])
        for size in sorted({max(1,math.ceil(len(row["selected_hosts"])/5)),8,10,12}):
            for interval in (30,60,90):
                for repeat in ("ready","fixed"):
                    trial(replace(s,host_names=tuple(row["selected_hosts"]),host_count=len(row["selected_hosts"]),cadence="groups",
                                  group_size=size,wave_interval_s=interval,group_repeat=repeat,wave_cycle_s=0,
                                  opening_wave_count=0,reserve_lead_troops=True,name=f"Groups of {size} · {interval}s · {repeat}"))
    finalists=sorted((r for r in tested if r["opening_feasible"]),key=rank)[:4]
    # Stage 3: amounts and troop mixes. Keep the score scale fixed throughout.
    for row in finalists:
        s=Strategy.parse(row["strategy"])
        for lead in ("small","equal","full"):
            for split in ("equal","concentrated"):
                for policy in ("next","rate"):
                    for formation in dict.fromkeys((custom.formation,"adaptive","optimized")):
                        trial(replace(s,host_names=tuple(row["selected_hosts"]),host_count=len(row["selected_hosts"]),host_allocation=lead,
                                      troop_split=split,join_policy=policy,formation=formation,
                                      name=f"Group search · {lead} own · {split} joins · {policy} · {formation}"))
    if best_run is None:raise ValueError("No tested plan can launch every selected starter within the chosen window. Check troop mixes or increase the window.")
    if goal=="balanced":
        near_best=[r for r in tested if r["opening_feasible"] and r["total_damage"]>=.95*best_damage["total_damage"]]
        selected=min(near_best,key=lambda r:(r["ready_wait_fraction"],-r["total_damage"]))
        best_run=simulate(members,mechanics,Strategy.parse(selected["strategy"]))
    tested.sort(key=lambda r:(not r["opening_feasible"],*rank(r)))
    return {"best":best_run,"tested":tested,"best_damage":best_damage,"best_flow":best_flow,"search_goal":goal,"opening_limit_s":opening_limit,
            "mechanics":base["mechanics"],"normalization":base["normalization"],
            "note":"Bounded three-stage search of starter eligibility, batch sizes, wave intervals, restart rules, troop amounts and mixes. Ready waiting excludes reaction delay, deliberately reserved leader troops, full joining slots and the absolute end cutoff. No universal never-host threshold is inferred."}


def calibrate(payload):
    """Fit host coefficients from individual contribution reports, not event ranks."""
    scale = float(payload.get("score_scale",100))
    exponent = float(payload.get("damage_exponent",1))
    config = dict(payload.get("mechanics", {}), score_per_effective_troop=scale, damage_exponent=exponent)
    mechanics = Mechanics.parse(config)
    profiles = {m.name:m for m in (Member.parse(r) for r in payload.get("roster", []))}
    grouped = {}
    reports = payload.get("reports",[])
    if not reports or len(reports) > 10000:
        raise ValueError("Provide 1–10,000 individual report rows")
    for row in reports:
        host = str(row["host"]).strip()
        troops, damage, quality = float(row["troops"]),float(row["damage"]),float(row.get("troop_quality",1))
        if not host or not all(0 < x < float("inf") for x in (troops,damage,quality)):
            raise ValueError("Report host and positive finite troops/damage/quality are required")
        if mechanics.damage_model == "legacy":
            effective = troops*(troops/50000)**(exponent-1)*quality
        else:
            if mechanics.damage_scope == "rally":
                raise ValueError("Report fitting currently supports per-player damage only. Select the per-player scope or enter host strength manually.")
            if not all(k in row for k in ("infantry", "cavalry", "archers")):
                raise ValueError("Troop-aware fitting needs infantry, cavalry and archers in every report row")
            if host not in profiles:
                raise ValueError("Report host must match a roster member, so their type bonuses can be used")
            profile = {k:row[k] for k in row if k in {f.name for f in fields(Member)}}
            profile.update(name="Report", troop_quality=quality)
            report_member = Member.parse(profile)
            if report_member.troops != troops:
                raise ValueError("Report troop types must sum to troops")
            effective = sum(effective_components({t:getattr(report_member,t) for t in ("infantry", "cavalry", "archers")}, report_member, profiles[host], mechanics).values())
        coefficient = damage / (effective*scale)
        grouped.setdefault(host,[]).append(coefficient)
    return {"hosts":[{"name":host,"host_strength":statistics.median(values),"reports":len(values),
                      "low":min(values),"high":max(values),
                      "coefficient_cv":statistics.stdev(values)/statistics.mean(values) if len(values)>1 else None}
                     for host,values in grouped.items()],
            "note":"Use comparable individual contribution reports and troop-quality definitions. Multiple reports expose variability; these are empirical estimates, not the hidden combat formula."}
