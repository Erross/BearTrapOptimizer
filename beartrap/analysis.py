from dataclasses import asdict, replace
import statistics
from .model import Member, Mechanics, Strategy, synthetic_roster
from .simulator import simulate


def default_strategies(n, count):
    return [
        Strategy("All hosts · synchronized baseline", n, "synchronized", "next", "full", "equal"),
        Strategy("All hosts · evenly staggered", n, "staggered", "next", "full", "equal"),
        Strategy("Selected hosts · next impact", count, "staggered", "next", "equal", "equal"),
        Strategy("Selected hosts · efficient joins", count, "staggered", "rate", "equal", "equal"),
        Strategy("Selected hosts · small host marches", count, "staggered", "rate", "small", "equal"),
        Strategy("Selected hosts · concentrated troops", count, "staggered", "rate", "equal", "concentrated"),
        Strategy("Three waves · efficient joins", count, "waves", "rate", "equal", "equal"),
    ]


def compare(payload):
    members = [Member.parse(r) for r in payload["roster"]] if "roster" in payload else synthetic_roster(**payload.get("synthetic",{}))
    mechanics = Mechanics.parse(payload.get("mechanics",{}))
    count = int(payload.get("host_count",12))
    strategies = default_strategies(len(members),count)
    custom = Strategy.parse(payload.get("strategy",{}))
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
                "Expected damage = committed troops × troop quality × host strength × common score scale (linear by default).",
                "Host strength is an empirical input, not derived from town level or account power.",
                "Historical personal event totals are context only; they are not host coefficients.",
                "Host slot is separate from joining slots. Each player can join a particular rally once.",
                "Rally capacity includes the host. Joiner cap and all timing mechanics are editable.",
                "Join travel is a per-member approximation, not a city-to-city distance matrix.",
                "Heroes, formations and buffs are held constant; their effects are absorbed into host strength and troop quality.",
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
                    s = Strategy(f"{count} hosts · {lead} host · {split} troops · {policy}",count,"staggered",policy,lead,split,
                                 small_host_fraction=Strategy.parse(payload.get("strategy",{})).small_host_fraction)
                    r = simulate(members,mechanics,s)
                    tested.append({"strategy":asdict(s),"total_damage":r["total_damage"],**r["summary"]})
                    if r["total_damage"] > best["total_damage"]:
                        best = r
    if not n:
        raise ValueError("No eligible hosts")
    tested.sort(key=lambda x:-x["total_damage"])
    return {"best":best,"tested":tested,"mechanics":base["mechanics"],"normalization":base["normalization"],
            "note":"Best among compared strategies and sampled top-host-count/allocation/next-or-rate settings. Host subsets and assignments are not globally optimized."}


def calibrate(payload):
    """Fit host coefficients from individual contribution reports, not event ranks."""
    scale = float(payload.get("score_scale",100))
    exponent = float(payload.get("damage_exponent",1))
    Mechanics.parse({"score_per_effective_troop":scale,"damage_exponent":exponent})
    grouped = {}
    reports = payload.get("reports",[])
    if not reports or len(reports) > 10000:
        raise ValueError("Provide 1–10,000 individual report rows")
    for row in reports:
        host = str(row["host"]).strip()
        troops, damage, quality = float(row["troops"]),float(row["damage"]),float(row.get("troop_quality",1))
        if not host or not all(0 < x < float("inf") for x in (troops,damage,quality)):
            raise ValueError("Report host and positive finite troops/damage/quality are required")
        coefficient = damage / (troops*(troops/50000)**(exponent-1)*quality*scale)
        grouped.setdefault(host,[]).append(coefficient)
    return {"hosts":[{"name":host,"host_strength":statistics.median(values),"reports":len(values),
                      "low":min(values),"high":max(values),
                      "coefficient_cv":statistics.stdev(values)/statistics.mean(values) if len(values)>1 else None}
                     for host,values in grouped.items()],
            "note":"Use comparable individual contribution reports and troop-quality definitions. Multiple reports expose variability; these are empirical estimates, not the hidden combat formula."}
