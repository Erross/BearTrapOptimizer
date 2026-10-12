from dataclasses import dataclass, fields, replace
import math


@dataclass(frozen=True)
class Member:
    name: str
    troops: int = 226505
    march_capacity: int = 90000
    join_slots: int = 5
    rally_capacity: int = 600000
    host_strength: float = 1.0
    troop_quality: float = 1.0
    outbound_s: int = 12
    return_s: int = 12
    join_travel_s: int = 12
    historical_score: float = 0
    power_m: float = 50
    town_level: int = 26
    can_host: bool = True
    infantry: int | None = None
    cavalry: int | None = None
    archers: int | None = None
    infantry_tier: int = 8
    cavalry_tier: int = 8
    archers_tier: int = 8
    infantry_quality: float = 1.0
    cavalry_quality: float = 1.0
    archers_quality: float = 1.0
    infantry_attack_bonus: float = 0.0
    cavalry_attack_bonus: float = 0.0
    archers_attack_bonus: float = 0.0
    infantry_lethality_bonus: float = 0.0
    cavalry_lethality_bonus: float = 0.0
    archers_lethality_bonus: float = 0.0

    @classmethod
    def parse(cls, row):
        allowed = {f.name for f in fields(cls)}
        if set(row) - allowed:
            raise ValueError(f"Unknown member fields: {sorted(set(row) - allowed)}")
        values = dict(row)
        inventory = ("infantry", "cavalry", "archers")
        supplied = [values.get(k) is not None for k in inventory]
        if any(supplied) and not all(supplied):
            raise ValueError("Enter all three troop inventories, or leave all three empty")
        if all(supplied):
            values["troops"] = sum(float(values[k]) for k in inventory)
        for key in ("troops", "march_capacity", "join_slots", "rally_capacity", "outbound_s", "return_s", "join_travel_s", "town_level", *inventory, "infantry_tier", "cavalry_tier", "archers_tier"):
            if key in values:
                if values[key] is None and key in inventory:
                    continue
                x = float(values[key])
                if not math.isfinite(x) or x != int(x):
                    raise ValueError(f"{key} must be a whole number")
                values[key] = int(x)
        for key in ("host_strength", "troop_quality", "historical_score", "power_m", *[f"{t}_{suffix}" for t in inventory for suffix in ("quality", "attack_bonus", "lethality_bonus")]):
            if key in values:
                values[key] = float(values[key])
        if "can_host" in values and not isinstance(values["can_host"], bool):
            v = str(values["can_host"]).lower()
            if v not in ("true", "false", "1", "0"):
                raise ValueError("can_host must be true or false")
            values["can_host"] = v in ("true", "1")
        obj = cls(**values)
        obj.validate()
        return obj

    def validate(self):
        if not isinstance(self.name, str) or not self.name.strip() or len(self.name) > 80:
            raise ValueError("Each member needs a name of 1–80 characters")
        for f in fields(self):
            x = getattr(self, f.name)
            if isinstance(x, (int, float)) and (not math.isfinite(x) or x < 0):
                raise ValueError(f"{self.name}: {f.name} must be finite and nonnegative")
        if not 1 <= self.troops <= 5000000 or not 1 <= self.march_capacity <= 2000000:
            raise ValueError("Troops must be 1–5M; march capacity must be 1–2M")
        if not 1 <= self.rally_capacity <= 20000000 or not 0 <= self.join_slots <= 10:
            raise ValueError("Rally capacity must be 1–20M and join slots 0–10")
        if not 0 < self.host_strength <= 100 or not 0 < self.troop_quality <= 20:
            raise ValueError("Host strength must be 0–100 and troop quality 0–20 (exclusive of zero)")
        if max(self.outbound_s, self.return_s, self.join_travel_s) > 300:
            raise ValueError("Travel times must be 0–300 seconds")
        inv = [getattr(self, t) for t in ("infantry", "cavalry", "archers")]
        if any(x is not None for x in inv):
            if not all(isinstance(x, int) and not isinstance(x, bool) and x >= 0 for x in inv) or sum(inv) != self.troops:
                raise ValueError("Three whole-number inventories must sum to usable troops")
        for t in ("infantry", "cavalry", "archers"):
            tier = getattr(self, f"{t}_tier")
            if not isinstance(tier, int) or not 1 <= tier <= 10:
                raise ValueError("Troop tiers must be T1–T10; use quality multipliers for TrueGold or mixed tiers")
            if not 0 < getattr(self, f"{t}_quality") <= 20:
                raise ValueError("Type quality must be >0 and <=20")
            if max(getattr(self, f"{t}_attack_bonus"), getattr(self, f"{t}_lethality_bonus")) > 100000:
                raise ValueError("Troop stat bonuses must be 0–100,000%")


@dataclass(frozen=True)
class Mechanics:
    duration_s: int = 1800
    countdown_s: int = 300
    joiner_cap: int = 14
    reaction_s: int = 3
    score_per_effective_troop: float = 100.0
    damage_exponent: float = 1.0
    deadline: str = "hit"
    damage_model: str = "legacy"
    damage_scope: str = "march"
    archer_counter_bonus: float = 10.0
    archer_volley_bonus: float = 0.0
    bear_attack_bonus: float = 0.0

    @classmethod
    def parse(cls, row):
        obj = cls(**row)
        if any(not isinstance(getattr(obj, k), int) for k in ("duration_s", "countdown_s", "joiner_cap", "reaction_s")):
            raise ValueError("Timing, slot limits and reaction delay must be whole numbers")
        if not 60 <= obj.duration_s <= 3600 or not 10 <= obj.countdown_s <= 600:
            raise ValueError("Invalid event duration/countdown")
        if not 1 <= obj.joiner_cap <= 30 or not 1 <= obj.reaction_s <= 60:
            raise ValueError("Invalid joiner cap/reaction delay")
        if not math.isfinite(obj.score_per_effective_troop) or not 0 < obj.score_per_effective_troop <= 1e9:
            raise ValueError("Invalid score scale")
        if not math.isfinite(obj.damage_exponent) or not .7 <= obj.damage_exponent <= 1.3:
            raise ValueError("Damage exponent must be 0.7–1.3")
        if obj.deadline != "hit":
            raise ValueError("Bear Trap rallies must hit before the event ends; late-hit scoring is not supported")
        if obj.damage_model not in ("legacy", "weighted", "sqrt") or obj.damage_scope not in ("march", "rally"):
            raise ValueError("Invalid damage model or damage scope")
        for k in ("archer_counter_bonus", "archer_volley_bonus", "bear_attack_bonus"):
            if not math.isfinite(getattr(obj, k)) or not 0 <= getattr(obj, k) <= 1000:
                raise ValueError("Damage bonuses must be 0–1,000%")
        return obj


@dataclass(frozen=True)
class Strategy:
    name: str = "Staggered · efficient joins"
    host_count: int = 12
    cadence: str = "staggered"
    join_policy: str = "rate"
    host_allocation: str = "equal"
    troop_split: str = "equal"
    spacing_s: int = 25
    small_host_fraction: float = .05
    final_push: bool = False
    host_names: tuple = ()
    formation: str = "inventory"
    infantry_pct: float = 10.0
    cavalry_pct: float = 10.0
    group_size: int = 10
    wave_interval_s: int = 60
    group_repeat: str = "ready"
    wave_cycle_s: int = 0
    reserve_lead_troops: bool = False
    host_min_relative_score: float = 0.0
    host_min_rally_capacity: int = 0

    @classmethod
    def parse(cls, row):
        row = dict(row)
        if "host_names" in row:
            row["host_names"] = tuple(row["host_names"])
        obj = cls(**row)
        if not isinstance(obj.host_count, int) or not 0 <= obj.host_count <= 100:
            raise ValueError("Invalid host count")
        if obj.cadence not in ("synchronized", "staggered", "waves", "custom", "groups"):
            raise ValueError("Invalid cadence")
        if obj.join_policy not in ("next", "strength", "rate"):
            raise ValueError("Invalid join policy")
        if obj.host_allocation not in ("full", "equal", "small") or obj.troop_split not in ("equal", "concentrated"):
            raise ValueError("Invalid troop allocation")
        if not isinstance(obj.spacing_s, int) or not 0 <= obj.spacing_s <= 600:
            raise ValueError("Invalid spacing")
        if not math.isfinite(obj.small_host_fraction) or not .00001 <= obj.small_host_fraction <= 1:
            raise ValueError("Small host fraction must be >0 and <=1")
        if obj.formation not in ("inventory", "strict", "adaptive", "optimized"):
            raise ValueError("Invalid formation policy")
        if not all(math.isfinite(x) and 0 <= x <= 100 for x in (obj.infantry_pct, obj.cavalry_pct)) or obj.infantry_pct + obj.cavalry_pct > 100:
            raise ValueError("Infantry and cavalry percentages must total at most 100")
        if not isinstance(obj.group_size, int) or not 1 <= obj.group_size <= 100:
            raise ValueError("Group size must be 1–100")
        if not isinstance(obj.wave_interval_s, int) or not 0 <= obj.wave_interval_s <= 600:
            raise ValueError("Wave interval must be 0–600 seconds")
        if obj.group_repeat not in ("ready", "fixed") or not isinstance(obj.reserve_lead_troops, bool):
            raise ValueError("Invalid group repeat or reservation setting")
        if not isinstance(obj.wave_cycle_s, int) or not 0 <= obj.wave_cycle_s <= 3600:
            raise ValueError("Group cycle must be 0 (automatic) or at most 3600 seconds")
        if not math.isfinite(obj.host_min_relative_score) or not 0 <= obj.host_min_relative_score <= 100:
            raise ValueError("Minimum leader score must be 0–100% of the strongest eligible player")
        if not isinstance(obj.host_min_rally_capacity, int) or not 0 <= obj.host_min_rally_capacity <= 20000000:
            raise ValueError("Minimum rally capacity must be 0–20M")
        return obj


def synthetic_roster(n=32, minimum_m=3, maximum_m=224, power_min_m=20, power_max_m=200,
                     troops_min=45000, troops_max=450000, strength_min=.5, strength_max=3,
                     join_slots=5, target_total=2e9, inventory_infantry_pct=40, inventory_cavalry_pct=25,
                     rally_capacity_min=350000,rally_capacity_max=1100000,
                     march_capacity_min=90000,march_capacity_max=90000,
                     town_level_min=22,town_level_max=30,tier_min=8,tier_max=8,
                     attack_min=0,attack_max=0,lethality_min=0,lethality_max=0):
    """Illustrative correlations only. Historical scores never enter combat math."""
    if not 2 <= n <= 100:
        raise ValueError("Synthetic roster size must be 2–100")
    if not 0 <= minimum_m <= maximum_m or minimum_m == maximum_m == 0:
        raise ValueError("Invalid score range")
    if not 0 <= power_min_m <= power_max_m or not 1 <= troops_min <= troops_max:
        raise ValueError("Invalid power/troop range")
    if not 0 < strength_min <= strength_max:
        raise ValueError("Invalid host strength range")
    if not all(math.isfinite(x) and 0 <= x <= 100 for x in (inventory_infantry_pct, inventory_cavalry_pct)) or inventory_infantry_pct + inventory_cavalry_pct > 100:
        raise ValueError("Invalid inventory percentages")
    for low,high,bound in ((rally_capacity_min,rally_capacity_max,20000000),(march_capacity_min,march_capacity_max,2000000),
                           (town_level_min,town_level_max,100),(tier_min,tier_max,10)):
        if not all(isinstance(v,int) for v in (low,high)) or not 1<=low<=high<=bound:
            raise ValueError("Invalid capacity, town level or troop tier range")
    if not all(math.isfinite(v) for v in (attack_min,attack_max,lethality_min,lethality_max)) or not 0<=attack_min<=attack_max<=100000 or not 0<=lethality_min<=lethality_max<=100000:
        raise ValueError("Invalid Attack or Lethality range")
    lo, hi = .03, 30.
    total_m = min(n * maximum_m - maximum_m + minimum_m,
                  max(n * minimum_m - minimum_m + maximum_m, target_total / 1e6))
    for _ in range(70):
        p = (lo + hi) / 2
        vals = [minimum_m + (maximum_m - minimum_m) * (i / (n - 1)) ** p for i in range(n)]
        if sum(vals) > total_m:
            lo = p
        else:
            hi = p
    roster = []
    for i, score in enumerate(vals):
        x = i / (n - 1)
        example = i == n//2 and troops_min <= 226505 <= troops_max
        roster.append(Member(name="Example · 5 × 45,301" if example else f"Member {i+1:02d}",
            troops=226505 if example else round(troops_min + (troops_max-troops_min) * x),
            march_capacity=round(march_capacity_min+(march_capacity_max-march_capacity_min)*x), join_slots=join_slots,
            rally_capacity=round(rally_capacity_min+(rally_capacity_max-rally_capacity_min)*x),
            host_strength=strength_min + (strength_max-strength_min)*x*x,
            troop_quality=.8+.4*x, outbound_s=round(20-12*x), return_s=round(20-12*x),
            join_travel_s=round(20-12*x), historical_score=score*1e6,
            power_m=power_min_m+(power_max_m-power_min_m)*x, town_level=round(town_level_min+(town_level_max-town_level_min)*x)))
        # Explicit illustrative stock, not a claim that account power predicts a troop mix.
        total = roster[-1].troops
        inf = int(total * inventory_infantry_pct / 100)
        cav = int(total * inventory_cavalry_pct / 100)
        roster[-1] = replace(roster[-1], infantry=inf, cavalry=cav, archers=total-inf-cav,
                            **{t+suffix:value for t in ("infantry","cavalry","archers") for suffix,value in
                               (("_tier",round(tier_min+(tier_max-tier_min)*x)),
                                ("_attack_bonus",attack_min+(attack_max-attack_min)*x),
                                ("_lethality_bonus",lethality_min+(lethality_max-lethality_min)*x))})
    for m in roster:
        m.validate()
    return roster
