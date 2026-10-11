# Model, mechanics and calibration

## Evidence boundary

Supplied by the alliance owner on October 11, 2026:

- 32 current Bear Trap 1 participants; roughly 2B alliance score.
- 3–14M at the low end and up to 224M are **full-event personal totals**, not per-rally damage.
- Five-minute rally countdown; towns clustered around the trap; travel approximately 8–20 seconds.
- One leader rally **in addition to** each player's maximum joining marches.
- Example quality troop pool: 5 × 45,301 = 226,505.
- Hero optimization is already handled and outside this project's scope.
- Only hits during the 30-minute event count. A rally started at 25:01 is wasted; host travel makes the final feasible start earlier still.

Useful public references (consulted October 11, 2026):

- Publisher's help center: https://centurygames.helpshift.com/hc/en/140-kingshot/section/1740-bear-hunt/
- Publisher's December 2025 update confirms consolidated Bear Hunt battle reports and rally starring: https://www.centurygames.com/kingshot-december-update/
- Community description of host/joiner roles: https://www.kingshotguide.org/guide/bear-trap-kingshot
- Community discussion of troop damage being based on host stats: https://kingshotoptimizer.com/guides/kingshot-bear-hunt-guide/

The publisher help-center category was discoverable but its full content was unavailable to the research tool. Community guides conflict on several details. No exact public combat formula, fixed optimum, or claimed gain for the real alliance is established here. The simulator uses user-confirmed mechanics plus explicit editable assumptions.

## Resource and clock model

Every member has a conserved usable troop pool, one separate host slot and a configurable number of joining slots. Launching a host rally reserves its troop allocation immediately. Joining reserves troops, a joining slot, a rally participant slot and troop capacity immediately. Each player can join a given rally once. Rally capacity includes the host allocation.

Host timeline: start → countdown → outbound travel → impact → return. Joiner timeline: dispatch → travel to host (must arrive strictly before departure) → wait → rally outbound travel → impact → own return from trap. Join travel is approximated by a per-member input, not exact pairwise city distances. No injuries or losses are modeled. Buff changes and hero availability across marches are not modeled; supplied host strength/quality should correspond to the same optimized hero conditions in every scenario.

The one-second clock processes returns, departures and impacts before new actions. A member sends at most one joining march per reaction interval. Player processing order rotates with simulated time. There is no permanent privilege to the first roster row, although this deterministic sequence is still an approximation of human competition.

Synchronized hosts restart after their own return and reaction delay. Staggered/custom/wave hosts use a phase plus their individual repeat cycle; phases and travel differences can make actual gaps uneven. A starved host waits until its own troops are free. Final push adds eligible non-hosts near the last feasible launch window; it never bypasses the countdown or scoring cutoff.

Scoring requires impact strictly before event expiration. Late-hit scoring is not available. At one-second resolution the last allowed start is `duration − countdown − outbound − 1`. For the 30-minute event, 300-second countdown and 8–20 second travel, that is 24:51 down to 24:39 elapsed. A launch at 25:01 cannot score. Opening countdown wait is reported separately. Longest damage gap includes gaps after the first hit and the quiet tail before event end, but excludes the unavoidable opening wait.

## Damage assumptions

At the linear default:

`member contribution = troops × troop_quality × host_strength × score_scale`

Only host strength multiplies a rally's troops. A joining member's personal account power, town level and own host coefficient do not become damage multipliers. Troop quality represents a fixed tier/formation effectiveness estimate. Formation composition is not dynamically re-optimized. All coefficients are empirical abstractions, not reverse-engineered game attributes.

For sensitivity, substitute `troops × (troops / 50,000)^(exponent − 1)` for troops. At exponent 1 the term is exactly linear. Other exponents test a hypothetical concentration effect and must not be presented as confirmed mechanics.

The synthetic roster deliberately correlates historical score, troop pool and host strength to create useful variation. That correlation is illustrative. The power-range controls are descriptive and do not imply a power-to-damage law. Historical synthetic scores attempt to sum to the baseline target within what the selected min/max allow, while retaining the min/max endpoints. They are not fitted per-player simulated scores.

## Calibration and identifiability

One alliance total cannot identify 32 troop pools, host strengths, travel/dispatch choices or contribution distributions. Normalizing the synchronized baseline to 2B scales all scenarios once; it does not prove the baseline matches the alliance's real schedule. Never independently normalize each strategy to the same target, which would erase the comparison.

Host estimates use the median of report damage divided by effective troops, quality and a fixed score scale. Input individual contribution reports, or genuinely aggregate rally troops and quality when using total rally damage. Keep tier, formation, hero bonuses, buffs and trap conditions comparable. Collect multiple reports per host and inspect variability. A single report has no estimated spread and is weak evidence.

For actual baseline calibration, the Python `/api/compare` request accepts `normalization.strategy` to choose a measured baseline strategy, plus `normalization.target`. The dashboard's normalization checkbox uses the synchronized all-eligible-hosts baseline; disable it when using calibrated absolute report coefficients. Exact historical event replay is not implemented.

## Search scope

The search tests several counts of the strongest eligible hosts, three host allocations, two troop splits and two joining policies under evenly staggered cadence. It also retains the directly compared strategies as candidates. Ranking selects hosts by empirical strength, breaking ties by rally capacity. It does not exhaustively search host subsets, every launch timestamp, participant assignment, reserved seats, hero-skill distribution or reward fairness. Capacity-rich medium hosts might deserve selection ahead of an automatically ranked host; use can_host or explicit Strategy.host_names to test them.

The search is bounded scenario exploration, not a mathematical proof of optimality. Re-run with different host-strength estimates, troop quality, reaction delays and other unconfirmed mechanics. Outcomes sensitive to those inputs require calibration before changing alliance rules.

## Practical interpretation

1. A smoother curve is not necessarily more damage. Staggering can reduce gaps while delaying a host's first launch enough to lose a final hit.
2. Busy slots and troops are not necessarily productive: forming rallies can lock troops for several minutes.
3. Small own rallies release troops but may also leave host capacity empty; their usefulness depends on actual replacement and stronger joining opportunities.
4. With a linear model, splitting identical troops across identical hosts changes nothing unless their completed-hit counts change.
5. Strongest-host joining can increase damage per hit but reduce damage per minute. Next-impact joining can do the reverse.
6. More rallies can prevent idle marches, but too many weak rallies can consume the troop pool and dilute strong hosts.
7. Individual gains and alliance gains differ. Use member comparisons and actual reward thresholds before enforcing a policy. Reward thresholds and fair-seat reservations are not implemented in this version.

## Further data that would materially improve decisions

- Actual host rally strength from repeated equivalent contribution reports.
- Member troop pools by tier and type, and hero/preset availability per concurrent march.
- Maximum joiner count and observed rally member capacity rules.
- A current-event rally log: start, departure, impact, host, participants, troops and scores.
- Pairwise town-to-town travel times and report-derived troop quality estimates.

These are extensions, not hidden prerequisites for using the current scenario tool.

## GitHub Pages architecture

The browser engine (`web/engine.js`) mirrors the Python reference and runs in a Web Worker. There is no hosted Python backend and no third-party runtime dependency. Automated parity tests compare complete rally schedules, participant assignments, personal damage, alliance damage, resource utilization, generation and calibration across both engines. All imports and calculations stay in the browser. Project exports are user-controlled downloads.
