# Wave recycling and opening participation

The optimization objective is total simulated alliance damage during the event. Waiting at home or delaying a later rally is acceptable when it improves that objective. Every member must first get a joining packet into the opening wave; leading a rally does not count as that member's opening join.

## Why five waves can work

A snapshot of all gathering rallies is not a capacity test for a repeating schedule. Troops committed to an earlier rally hit, return, and can join a later gathering rally before its departure. The simulator keeps troop stocks and march slots locked until return and checks city-to-starter travel before accepting a join. The useful quantity is troop-hits over the entire event, alongside damage, rather than simultaneous available rally capacity.

With opening participation enabled, unserved members have priority. Their first packet is limited to an equal share of their available joining troops (also subject to the march cap and rally capacity). Extra opening joins are held until everyone has joined. If travel, troop stocks, permissions or capacity prevent that, the run reports missing members and the optimizer excludes it.

## Controlled 50-player experiment

Run `node scripts/analyze_wave_recycling.cjs` from the repository root. The script writes its detailed results to `/tmp/wave-recycling-results.json`.

These are homogeneous test rosters, not the CNQ roster: all 50 members can start rallies, have identical T9 troops and 100k march capacity, and have either four 50k joining stocks or five 50k joining stocks, plus one troop. Countdown is 300 seconds, event duration 1,800 seconds, city-to-starter travel and bear outbound/return travel are each 12 seconds. Rally restart includes the model's three-second preparation delay. The selected damage assumption is square-root scaling per march, with normalization disabled.

| Joining marches per player | Rally capacity | Best tested wave count | Initial wave gap | Opening joins | Troop-hits over event |
|---|---:|---:|---:|---:|---:|
| 4 | 500k | 4 | 55 seconds | 50/50 | 125 million |
| 4 | 600k | 4 | 55 seconds | 50/50 | 150 million |
| 5 | 500k | 5 | 40 seconds | 50/50 | 125 million |
| 5 | 600k | 3 | 60 seconds | 50/50 | 150 million |

Every winner uses all 50 starters, a 50k joining cap, a 5k leader packet, immediate joining, and next-hit selection. The optimizer evaluated 92 plans in each case. Fewer initial waves can help fit additional hits before the event ends; the opening gap is not an instruction to prevent a returned starter from restarting.

Compared with four waves at 60-second initial gaps and a one-troop leader packet, these winners produced about 5.04% more troop-hits. Their modeled damage gains were 8.2–9.3%, partly because the chosen per-march damage curve favors the larger leader packet. Compared with five waves at 65-second gaps and a one-troop leader packet, troop-hits increased about 8.70% and modeled damage 12.0–13.1%. These comparisons change leader packet size as well as timing, so they do not isolate the effect of wave count.

Re-evaluating these same schedules with linear weighted damage per march and square-root damage applied to the whole rally retained the throughput advantage: approximately 5.04% over the four-wave reference and 8.70% over the five-wave reference. This is a sensitivity check of the selected schedules, not a new exhaustive search under those formulas.

## Search scope and limits

The browser and Python endpoint share a bounded search of at most 144 simulations. It tests one through five initial waves; initial gaps of 30, 45, 60, 75 and 90 seconds, followed by local ten-second refinements; all and reduced starter counts; 50k, 100k and uncapped joins; tiny and 5% leader packets; immediate and late joining; and next-hit/rate selection. The last initial wave must begin within 240 seconds by default. Starter strength floors, troop stocks, travel times and march slots still apply.

The winning plan is the highest-damage **tested feasible** plan, not a proof of a global optimum. Equal-strength rosters can have close or tied schedules. Actual heterogeneous troops, heroes, rally capacities and travel times can change the answer. Damage formulas and inferred troop stocks remain estimates. Ridcully's reported 100M result is useful evidence that absolute personal scoring is not calibrated; it does not establish a conversion for the entire alliance.

Use **Optimize waves** on the main page to add the winner as a reviewable strategy. The results list tested alternatives, opening coverage and relative modeled damage. Keep actual attendance, rally capacities, travel and troop inventories current before treating the recommendation as an operational plan.
