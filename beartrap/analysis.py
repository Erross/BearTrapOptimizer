from dataclasses import asdict, replace, fields
import statistics
from .model import Member, Mechanics, Strategy, synthetic_roster
from .simulator import simulate
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
    strategies += [replace(custom, name="Formation test · "+policy, formation=policy)
                   for policy in ("inventory", "strict", "adaptive", "optimized") if policy != custom.formation]
    return strategies


def compare(payload):
    members = [Member.parse(r) for r in payload["roster"]] if "roster" in payload else synthetic_roster(**payload.get("synthetic",{}))
    mechanics = Mechanics.parse(payload.get("mechanics",{}))
    count = int(payload.get("host_count",12))
    custom = Strategy.parse(payload.get("strategy",{}))
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
    n = sum(m.can_host for m in members)
    counts = sorted({min(n,x) for x in (1,2,4,6,8,12,16,24,32,n)}-{0})
    tested = []
    best = max(base["runs"],key=lambda r:r["total_damage"])
    # Bounded, reproducible heuristic search. Keep score scale identical across trials.
    for count in counts:
        for lead in ("equal","small","full"):
            for split in ("equal","concentrated"):
                for policy in ("next","rate"):
                    for formation in ("inventory", "strict", "adaptive", "optimized"):
                        custom = Strategy.parse(payload.get("strategy",{}))
                        s = Strategy(f"{count} hosts · {lead} host · {split} troops · {policy} · {formation}",count,"staggered",policy,lead,split,
                                     small_host_fraction=custom.small_host_fraction, formation=formation,
                                     infantry_pct=custom.infantry_pct, cavalry_pct=custom.cavalry_pct)
                        r = simulate(members,mechanics,s)
                        tested.append({"strategy":asdict(s),"total_damage":r["total_damage"],**r["summary"]})
                        if r["total_damage"] > best["total_damage"]:
                            best = r
    if not n:
        raise ValueError("No eligible hosts")
    tested.sort(key=lambda x:-x["total_damage"])
    return {"best":best,"tested":tested,"mechanics":base["mechanics"],"normalization":base["normalization"],
            "note":"Best among compared strategies and sampled host counts, troop amounts, joining choices and four formation policies. Not every host group, start time or troop assignment is tested."}


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
