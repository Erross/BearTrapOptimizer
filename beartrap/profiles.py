"""Deterministic illustrative alliance mixes, defined once for both engines."""
from dataclasses import asdict
import json
from pathlib import Path
from .model import Member


def profile_roster(payload):
    data = json.loads((Path(__file__).resolve().parents[1] / "web/alliance-profiles.json").read_text())
    n, slots, key = payload.get("n",40), payload.get("join_slots",5), payload.get("profile","top_four")
    if not isinstance(n,int) or not 2 <= n <= 100 or not isinstance(slots,int) or not 0 <= slots <= 10:
        raise ValueError("Illustrative alliance needs 2–100 players and 0–10 joining marches")
    if key not in data["profiles"]:
        raise ValueError("Choose a known alliance profile")
    profile = data["profiles"][key]
    groups = [[] for _ in data["bands"]]
    for i in range(n):
        q, cumulative = (i+.5)/n, 0
        for index, weight in enumerate(profile["weights"]):
            cumulative += weight
            if q < cumulative or index == len(groups)-1:
                groups[index].append(i)
                break
    roster, bands = [], []
    for band, indices in zip(data["bands"],groups):
        if not indices:
            continue
        bands.append({"label":band["label"],"players":len(indices),
                      **{k:band[k] for k in ("town_level","power_m","troops","march_capacity","rally_capacity","tier","attack","lethality")}})
        for local, i in enumerate(indices):
            x = local/(len(indices)-1) if len(indices)>1 else .5
            def interpolate(field):
                low,high = band[field]
                return low+(high-low)*x
            total = round(interpolate("troops"))
            infantry, cavalry = int(total*.40), int(total*.25)
            travel = round(interpolate("travel_s"))
            values = dict(name=f"Member {i+1:02d}", troops=total, infantry=infantry,cavalry=cavalry,
                          archers=total-infantry-cavalry, power_m=interpolate("power_m"),
                          town_level=round(interpolate("town_level")),join_slots=slots,
                          march_capacity=round(interpolate("march_capacity")),
                          rally_capacity=round(interpolate("rally_capacity")),
                          outbound_s=travel,return_s=travel,join_travel_s=travel)
            for troop in ("infantry","cavalry","archers"):
                values.update({troop+"_tier":band["tier"],troop+"_attack_bonus":interpolate("attack"),
                               troop+"_lethality_bonus":interpolate("lethality")})
            roster.append(asdict(Member.parse(values)))
    return {"roster":roster,"profile":{"key":key,"label":profile["label"],
            "description":profile["description"],"provenance":data["provenance"],"bands":bands}}
