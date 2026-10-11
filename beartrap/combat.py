"""Inventory allocation and explicitly approximate community damage models.

Sources and unresolved march-versus-rally scoring are in docs/DAMAGE_RESEARCH.md.
No account-power-to-damage conversion is used.
"""
import math
from dataclasses import asdict, replace
from .model import Member, Mechanics, Strategy

TYPES = ("infantry", "cavalry", "archers")
BASE_ATTACK = {
    "infantry": (63, 94, 132, 172, 206, 243, 287, 339, 400, 472),
    "cavalry": (189, 283, 397, 516, 619, 730, 862, 1017, 1200, 1416),
    "archers": (252, 378, 529, 688, 825, 974, 1149, 1356, 1600, 1888),
}


def inventory(member):
    if member.infantry is None:
        # Old project imports remain usable, but this fallback is visibly labelled.
        inf = member.troops // 3
        return dict(zip(TYPES, (inf, inf, member.troops-2*inf)))
    return {t: getattr(member, t) for t in TYPES}


def coefficients(member, host, mechanics):
    result = {}
    for t in TYPES:
        base = BASE_ATTACK[t][getattr(member, t+"_tier")-1] / 339
        atk = 1 + (getattr(host, t+"_attack_bonus") + mechanics.bear_attack_bonus) / 100
        let = 1 + getattr(host, t+"_lethality_bonus") / 100
        bonus = (1+mechanics.archer_counter_bonus/100)*(1+mechanics.archer_volley_bonus/100) if t == "archers" else 1
        result[t] = base * getattr(member, t+"_quality") * member.troop_quality * atk * let * bonus
    return result


def rounded_allocation(values, limits, amount, weights=None, sqrt=False):
    """Round a continuous solution while preserving count and per-type limits."""
    out = {t: min(limits[t], int(math.floor(values[t]))) for t in TYPES}
    left = amount-sum(out.values())
    while left > 0:
        eligible = [t for t in TYPES if out[t] < limits[t]]
        if not eligible:
            break
        if weights is None:
            key = lambda t: (values[t]-out[t], -TYPES.index(t))
        else:
            key = lambda t: (weights[t]*(math.sqrt(out[t]+1)-math.sqrt(out[t])) if sqrt else weights[t], -TYPES.index(t))
        t = max(eligible, key=key)
        out[t] += 1
        left -= 1
    return out


def allocate(available, desired, member, host, mechanics, strategy):
    amount = min(int(desired), sum(available.values()))
    if amount <= 0:
        return dict.fromkeys(TYPES, 0)
    weights = coefficients(member, host, mechanics)
    ratios = dict(zip(TYPES, (strategy.infantry_pct/100, strategy.cavalry_pct/100,
                             1-(strategy.infantry_pct+strategy.cavalry_pct)/100)))
    if strategy.formation == "strict":
        amount = min(amount, *(int(math.floor(available[t]/ratios[t])) for t in TYPES if ratios[t] > 0))
        return rounded_allocation({t: amount*ratios[t] for t in TYPES}, available, amount)
    if strategy.formation == "inventory":
        total = sum(available.values())
        return rounded_allocation({t: amount*available[t]/total for t in TYPES}, available, amount)
    if strategy.formation == "adaptive":
        goal = rounded_allocation({t: amount*ratios[t] for t in TYPES}, dict.fromkeys(TYPES, amount), amount)
        out = {t: min(available[t], goal[t]) for t in TYPES}
        for t in sorted(TYPES, key=lambda t: (-weights[t], TYPES.index(t))):
            extra = min(available[t]-out[t], amount-sum(out.values()))
            out[t] += extra
        return out
    if mechanics.damage_model != "sqrt":
        out = dict.fromkeys(TYPES, 0)
        for t in sorted(TYPES, key=lambda t: (-weights[t], TYPES.index(t))):
            out[t] = min(available[t], amount-sum(out.values()))
        return out
    # Maximize sum(w_t * sqrt(n_t)), subject to stock and total-count limits.
    # The continuous optimum is n_t proportional to w_t squared. Clamp scarce types.
    values = dict.fromkeys(TYPES, 0.0)
    active = [t for t in TYPES if available[t] > 0]
    budget = amount
    while active:
        denominator = sum(weights[t]**2 for t in active)
        proposals = {t: budget*weights[t]**2/denominator for t in active}
        capped = [t for t in active if proposals[t] >= available[t]]
        if not capped:
            values.update(proposals)
            break
        for t in capped:
            values[t] = available[t]
            budget -= available[t]
            active.remove(t)
    return rounded_allocation(values, available, amount, weights, sqrt=True)


def effective_components(composition, member, host, mechanics):
    total = sum(composition.values())
    if total <= 0:
        return dict.fromkeys(TYPES, 0.0)
    if mechanics.damage_model == "legacy":
        factor = (total/50000)**(mechanics.damage_exponent-1) * member.troop_quality
        return {t: composition[t]*factor for t in TYPES}
    weights = coefficients(member, host, mechanics)
    if mechanics.damage_model == "weighted":
        factor = (total/50000)**(mechanics.damage_exponent-1)
        return {t: composition[t]*weights[t]*factor for t in TYPES}
    # Common battle constants and ten rounds are absorbed into the score scale.
    # 50k reference keeps the scale readable; this is not an absolute game formula.
    minimum = min(total, 5000)
    return {t: math.sqrt(composition[t]*minimum)*math.sqrt(10)*weights[t] for t in TYPES}


def host_rating(host, mechanics):
    """Compare leaders with identical reference troops, not their personal stock."""
    reference = Member("Reference", troops=50000, troop_quality=1)
    mix = dict(infantry=16667, cavalry=16667, archers=16666)
    numerator = sum(effective_components(mix, reference, host, mechanics).values())
    denominator = sum(effective_components(mix, reference, reference, mechanics).values())
    return host.host_strength*numerator/denominator


def rally_components(participants, members, host, mechanics):
    scale = host.host_strength*mechanics.score_per_effective_troop
    if mechanics.damage_model != "sqrt" or mechanics.damage_scope == "march":
        return [{t: x*scale for t,x in effective_components(p["composition"], members[p["member_index"]], host, mechanics).items()}
                for p in participants]
    # Sensitivity alternative: pool troop types across the rally, then distribute
    # each type's damage by weighted troops. Individual credit is an assumption.
    counts = {t: sum(p["composition"][t] for p in participants) for t in TYPES}
    weights = [coefficients(members[p["member_index"]], host, mechanics) for p in participants]
    weighted = {t: sum(p["composition"][t]*w[t] for p,w in zip(participants, weights)) for t in TYPES}
    minimum = min(sum(counts.values()), 5000)
    damages = {t: math.sqrt(counts[t]*minimum)*math.sqrt(10)*weighted[t]/counts[t]*scale if counts[t] else 0 for t in TYPES}
    return [{t: damages[t]*p["composition"][t]*w[t]/weighted[t] if weighted[t] else 0 for t in TYPES}
            for p,w in zip(participants, weights)]


def formation_plan(payload):
    """A simultaneous fleet preview; same host for all marches, no rally timing."""
    m = Member.parse(payload["member"])
    host = Member.parse(payload.get("host", payload["member"]))
    mechanics = Mechanics.parse(payload.get("mechanics", {}))
    strategy = Strategy.parse(payload.get("strategy", {}))
    count = payload.get("marches", m.join_slots)
    if not isinstance(count, int) or not 1 <= count <= 11:
        raise ValueError("Preview 1–11 simultaneous marches")
    capacity = payload.get("march_size", m.march_capacity)
    if not isinstance(capacity, int) or not 1 <= capacity <= m.march_capacity:
        raise ValueError("Preview march size must be 1–member march capacity")
    initial = inventory(m)
    ratio = dict(zip(TYPES, (strategy.infantry_pct/100, strategy.cavalry_pct/100,
                           1-(strategy.infantry_pct+strategy.cavalry_pct)/100)))
    per_full = rounded_allocation({t: capacity*ratio[t] for t in TYPES}, dict.fromkeys(TYPES, capacity), capacity)
    full = min(initial[t]//per_full[t] for t in TYPES if per_full[t])
    plans = []
    for policy in ("inventory", "strict", "adaptive", "optimized"):
        # Allocate a fleet-wide stock budget, then spread each type evenly. This
        # avoids a first march taking all archers in this preview. Event dispatch
        # remains a local, sequential policy and is labelled separately in UI.
        s = replace(strategy, formation=policy)
        stock = allocate(initial, capacity*count, m, host, mechanics, s)
        marches = []
        remaining = dict(stock)
        for j in range(count):
            desired = math.ceil(sum(remaining.values())/(count-j))
            mix = rounded_allocation({t:remaining[t]/(count-j) for t in TYPES}, remaining, desired)
            marches.append(mix)
            remaining = {t:remaining[t]-mix[t] for t in TYPES}
        components = [{t: v*host.host_strength*mechanics.score_per_effective_troop for t,v in effective_components(mix,m,host,mechanics).items()} for mix in marches]
        plans.append({"formation": policy, "marches": marches, "used": stock,
                      "unused": {t: initial[t]-stock[t] for t in TYPES},
                      "effective_damage": sum(sum(x.values()) for x in components),
                      "damage_by_type": {t: sum(x[t] for x in components) for t in TYPES},
                      "fill": sum(stock.values())/(count*capacity)})
    return {"member": asdict(m), "host": host.name, "march_count": count, "march_size": capacity,
            "inventory": initial, "inventory_estimated": m.infantry is None,
            "full_target_marches": min(count, full), "full_target_marches_stock_limit": full,
            "needed_for_target": {t: per_full[t]*count for t in TYPES},
            "plans": plans, "coefficients": coefficients(m, host, mechanics),
            "unlimited_sqrt_ratio": {t: w*w/sum(x*x for x in coefficients(m,host,mechanics).values()) for t,w in coefficients(m,host,mechanics).items()}}
