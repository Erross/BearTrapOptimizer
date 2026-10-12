# Prescriptive rally planner

The default page compares six complete approaches on one damage graph. It does not launch a broad search on first visit. Its five variables are attending players, alliance strength profile, selected starter count, opening wave count, and seconds between waves. Setup, real rosters, troop details, calibration, custom approaches and the larger search are available in an optional dialog. Entered players and attendance are preserved when updating the comparison.

A front-page slider and exact number entry set the per-player joining-march limit for both capped approaches. Changes automatically update the comparison after a short pause, preserving the current line selection and custom comparison. If the limit changes while a worker calculation runs, that result stays marked stale and a follow-up calculation applies the latest value. The slider starts at 1k–150k and expands for larger entered limits or march capacities; it never changes a leader's own packet.

## Six default approaches

| Approach | Leaders | Opening | Joining rule |
|---|---|---|---|
| Everyone together | Every eligible player | One simultaneous group | No voluntary troop limit |
| Strongest leaders only | Highest-rated eligible quarter of attendance, at most the selected starter count | One simultaneous group | Prefer strongest reachable rally; no voluntary troop limit |
| Selected leaders in waves | Up to the selected starter count, ranked by leader rating | Requested waves and interval | First reachable hit; no voluntary troop limit |
| Selected waves + troop limit | Same leaders and timing as the preceding approach | Same requested waves and interval | Same joining rule, with a per-player joining-march limit (50k by default) |
| Everyone in waves | Every eligible player | Requested waves and interval | First reachable hit; no voluntary troop limit |
| Everyone in waves + troop limit | Same leaders and timing as everyone in waves | Same requested waves and interval | Same joining rule, with the same per-player joining-march limit as the selected capped approach |

All six plans use 5% own marches and concentrated joins, reserving the next own packet. The together baseline and the uncapped wave plans use identical troop allocation, formation and restart rules: everyone in one wave, or multiple waves with zero spacing, gives exactly the same damage curve as everyone together. Selecting every eligible starter also makes the selected-leader plan identical to everyone in waves, with matching capped counterparts. The strongest-leader plan additionally prefers the strongest reachable rally; each capped plan adds only the joining-march limit to its uncapped counterpart. All six use the same chosen troop-mix policy and roster. Actual game rally capacities and joiner limits are enforced in every plan. A voluntary limit never removes the game's limits and does not reduce a leader's own troop packet. The chart uses one common denominator: the baseline's final damage is 100. It is a comparison, not a forecast of a measured event score.

`opening_wave_count` makes exactly that many balanced opening groups, up to the number of actual selected leaders. A zero interval merges them into simultaneous starts. `join_march_cap=0` adds no alliance limit; a positive value limits each joining march. The leader's own march is unaffected.

## Illustrative top-four alliance

`web/alliance-profiles.json` is the shared scenario definition for both engines. The default 40-player roster has 8 developing members (TC24–25), 18 core members (TC26–27), 10 strong members (TC28–29), and 4 leaders (TC30). Assumed power spans 20–160M, rally capacities 450k–1M, and usable stocks 150k–1M. Developing and established profiles vary the weights of these groups. These are assumed scenarios, not measured averages of rank-four alliances or Kingdom 2399. Power and TC are labels; inventories, tiers, capacities, travel and explicit bonuses drive simulation. Residual leader and stock-quality multipliers start at 1.

Detailed range edits switch to a custom illustrative roster. Saving player details or attendance retains the current players, and estimated troop stocks remain labelled estimated.

## Optional advanced search objectives

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
