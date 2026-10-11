# Troop damage research · 11 October 2026

No official damage equation was located. The following are community researchers' models, partly inferred from a related game's engine. Their confidence labels do not make them publisher-confirmed Kingshot mechanics. Several fan sites repeat the same work; repetition is not independent validation.

## Numbers used

[Daryl's worked Bear Trap example](https://kingshotguides.com/guide/bear-trap-damage-mechanics-and-example-simulation/) reports T6 Attack values 243 / 730 / 974 for Infantry / Cavalry / Archers, a 10% archer counter bonus, ten rounds and a 5,000-unit bear army. We reproduce its rounded 16,797 score in a regression test using its assumptions and constants. This is arithmetic agreement with a published model, not validation of the game's server.

[Absy Labs' troop notes](https://kingshotsim.com/rally-and-troops) report approximately 1 / 3 / 4 base Attack at equal tiers. They also describe leader-derived bonuses and an optional expected 10% archer extra attack. That extra-attack term defaults to zero here so it is not silently added to Daryl's simpler example. Counter and extra attacks are different effects.

[Absy Labs' damage methodology](https://kingshotsim.com/damage-formula) uses an army factor `sqrt(type_count * min(total_attacker, total_defender))`, and multiplicative Attack and Lethality bonuses. It identifies its SoS-engine lineage; that does not establish every Kingshot scoring detail.

[StrategicNoodles' community database](https://strategicnoodle.com/kingshot/database/troops) supplies the T1–T10 reference table below. The UI allows per-type quality adjustments for mixed tiers or TrueGold; exact TrueGold skills are not simulated.

| Tier | Infantry Attack | Cavalry Attack | Archer Attack |
|---|---:|---:|---:|
| T1 | 63 | 189 | 252 |
| T2 | 94 | 283 | 378 |
| T3 | 132 | 397 | 529 |
| T4 | 172 | 516 | 688 |
| T5 | 206 | 619 | 825 |
| T6 | 243 | 730 | 974 |
| T7 | 287 | 862 | 1149 |
| T8 | 339 | 1017 | 1356 |
| T9 | 400 | 1200 | 1600 |
| T10 | 472 | 1416 | 1888 |

## Our modelling choices and deductions

The troop-aware coefficient includes the contributing player's tier/quality and the host's type-specific Attack/Lethality. Residual Host strength holds fixed hero and unmodelled effects. Do not retain a coefficient that already contains bonuses and then add those same bonuses again.

With equal-tier coefficients 1 / 3 / 4.4, a square-root objective's unconstrained proportions are the squared coefficients normalized to a total: approximately 3.4% / 30.7% / 65.9%. This follows from the selected mathematical objective; it is not an in-game tested recommendation. An 80% archer mix can follow from stronger archer buffs, other fixed hero effects or a different model. A universal ratio cannot be inferred from base Attack alone.

The exact scope of troop-count aggregation and personal score attribution is not resolved by these references. The app exposes independent per-player and pooled-rally approximations. Pooled mode averages mixed-tier coefficients and distributes each type's credit by weighted troops. The fleet preview always compares separate marches with the same host. Both scopes need alliance report validation, and conclusions that reverse between them should not become alliance rules without that evidence.

## Stock limits, independent of the damage equation

Five 90,000-troop marches at 10 / 10 / 80 require 45,000 infantry, 45,000 cavalry and 360,000 archers simultaneously. Adding a sixth own rally increases that requirement to 54,000 / 54,000 / 432,000. Troops returning from earlier hits can later be reused; they cannot fill multiple simultaneous marches.

For five 45,301-troop marches, the rounded per-march split is 4,530 / 4,530 / 36,241, requiring 181,205 archers in total. A smaller stock can make some full target-ratio marches, smaller target-ratio marches, or full marches with a different mix. The calculator now compares these decisions and reports unused troops.

Account power includes more than troop inventory. The power estimator is explicitly a user-selected interpolation, with user-selected training-stock shares. It is not a fitted or empirically validated population prediction. Enter actual counts when available.

## Validation data to collect

Collect individual report damage with the rally leader, each troop-type count and tier, report Attack/Lethality, trap bonus, fixed hero setup, and total rally composition. Repeat with balanced and archer-heavy mixes, different march sizes and similar rally totals. To distinguish credit scopes, vary total rally composition while holding one contributor's march and the host fixed. The app's per-player report fitter estimates only the residual host coefficient; pooled personal credit requires more information and is therefore rejected by that fitter.
