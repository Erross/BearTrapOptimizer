# Validation of version 0.2.0

- Python suite: 28 tests pass, including HTTP integration, conserved type inventories, troop-aware calibration, host-stat selection and the strict event cutoff.
- Browser/Python parity: 72 complete-output cases pass. Added cases cover every formation policy, both scoring scopes, linear/square-root models, tier and host bonuses, six-march previews and troop-aware report fitting.
- The integer square-root allocator is compared against brute-force maxima for small stock budgets. Fleet rounding is checked for capacity overflow and exact type-count conservation.
- The published T6 worked example produces the documented rounded 16,797 under its stated assumptions. This tests arithmetic, not Kingshot server accuracy.
- The sample with 226,505 troops and limited archers can use all troops across five 45,301-sized inventory/adaptive marches, while strict 10/10/80 leaves troops unused. A 1.5M stock can supply five full 90k target-ratio marches.
- JavaScript syntax and unique static DOM IDs checked. A DOM-stub smoke run checked rendering, fleet preview, saving stocks, importing CSV, custom cadence and search. A stub cannot verify visual layout or real browser behaviour.
- A 32-member square-root search tested 432 configurations in about 34 seconds in Node in this environment. A Web Worker keeps the interface responsive; larger rosters and pooled damage can take longer.
- In-game validation has not occurred. All demo gains and power-stock correlations are estimates, not real alliance forecasts.

- Live GitHub Pages verification in Chrome passed on 11 October 2026: initial comparison, small/large-player stock limits, stock saving, troop-tier editing, power estimation, individual type breakdowns, pooled-rally comparison, troop-aware report fitting, and the 432-setting strategy search.
- The live player-assignment CSV contained 1,630 assignments. Every row's three troop-type counts summed to its total, and every exported impact was before 30:00. Plain-language plan explanations and the five-by-45,301 formation comparison were inspected visually.
- Both GitHub Actions workflows (Tests and Publish Bear Trap Lab) succeeded for the implementation commit `7986b53ce623d17fe1f650e0040c67ba50f9ebb8`.
