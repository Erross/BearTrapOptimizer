# Prescriptive rally planner

The intake is attendance plus editable assumed ability endpoints. The application automatically searches after generating a roster; entered rosters are retained when requesting a recommendation. Real attendance is edited on Alliance setup. Range changes rebuild only the demo. Every output labels whether it is an assumed or entered roster.

## Recommendation objectives

- **Balanced (default):** minimize ready waiting among feasible tested plans scoring at least95% of the highest feasible tested damage.
- **Damage:** maximize feasible tested alliance damage, breaking ties on ready waiting.
- **Flow:** minimize ready waiting, breaking ties on alliance damage. This can cost substantial damage and is labelled accordingly.

The staged search records no more than420 plans. Candidate cohorts include rating-ranked prefixes and stricter combined leader-score/capacity floors. Up to32 distinct cohorts are sampled. Around promising cohorts it varies groups of8/10/12 or a size that spreads starts over four minutes, 30/60/90s intervals, independent versus shared-clock restarts, own/joining amounts, joining choice and stock-aware formations. Default comparisons include all-starter groups of10 and8 at60s intervals. Other possible cohorts, queue rules and joint assignments are not exhaustively explored.

## Groups and reservation

`cadence=groups`, `group_size=10`, `wave_interval_s=60` launches the first10 selected starters at0, next10 at60, and so on. The ranked order is explicit. `group_repeat=ready` restarts after actual own troop return plus reaction delay. `fixed` uses a common cycle, automatically rounded up to the interval and long enough for the slowest leader and all opening groups. A missed fixed tick cannot catch up between ticks. `wave_cycle_s=0` chooses automatically; too-short explicit periods fail validation.

`reserve_lead_troops=True` keeps the selected starter's own packet by troop type out of join allocations when a future own rally can still hit. The packet is virtual: the stock is conserved and counts as held at home until launched. Equal joins divide stock after the planned own packet across joining slots; concentrated joins fill available marches first. Other plans retain their previous allocation behavior when reservation is off.

## Waiting measure

Each second, a player contributes ready waiting only when they have unreserved troops, a free joining slot, no reaction delay, and no reachable open rally with available capacity, joiner room and a constructible mix. The counted amount is capped by remaining march-slot capacity. The final possible joining arrival is excluded. Troops held for the next own rally are reported separately. Rallies already forming, travelling or returning are committed rather than waiting at home.

The denominator is the same physical deployable stock across plans: sum(min(stock,march capacity×(joining slots+one allowed leader slot))). This avoids treating excess stock beyond all possible marches as necessarily deployable. Ready-wait fraction is troop-seconds divided by duration and deployable stock. Equivalent seconds divide only by deployable stock. Neither metric proves best damage or measures manual coordination reliability.

## Capacity and starter decisions

Rally capacity includes the leader's troops. Each rally enforces its own troop cap and joiner cap. A450k rally with4,500 leader troops fits9 full45,301-troop joins; the tenth is partial. With1M capacity and the same packets, the14-joiner cap binds before troop capacity.

A slot-only lower bound is ceil(sum(joining slots)/joiner cap), capped per player by distinct other players. It ignores troop caps, the inability to join your own rally and return timing, so it is optimistic. It is displayed as a diagnostic, not a starter recommendation. Groups that begin later cannot offer joining space at time0; holding a small own packet makes that deliberate opening delay visible.

Hard `host_min_relative_score` (percent of the strongest permission-eligible reference rating) and `host_min_rally_capacity` apply to every starter, including final push. Cohort cutoffs and selected starter counts are scenario-specific. An excluded player can become useful when attendance, capacities or bonuses change. No universal TC, power or Lethality ban is established.

## Kingdom2399 provenance

Only the user's reported450k–1M rally-capacity range is used as a reported starting endpoint. Other defaults are editable synthetic assumptions, including stock, tier, Attack and Lethality. The same type bonus is used across types in synthetic generation; real profiles support individual bonuses. TC and power label the example profile and are not combat multipliers. A real relationship between power, stock and combat strength has not been fitted.

Research on12October2026 found a fan-operated KingshotStats API advertising authenticated kingdom boards and alliance rosters. No usable2399 roster was retrieved. Its documented roster fields include power and TC, not usable per-type inventories or complete combat bonuses. Public KingshotAllianceCommand tools provide reference data and the authenticated player's own saved profile, not alliance roster census data. No API key or login is needed by this app, and no third-party stats request is made from the page.
