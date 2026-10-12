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

## Beginner UX revision

- The 28-test suite and 72 full-output engine parity cases still pass. HTTP checks also verify the extracted app scripts and stylesheets are served by the local Python app.
- DOM-stub checks exercise selected-plan/card consistency, stale export protection, troop preview, saving stocks, valid imports and restoration after an invalid import. The full revised search path completed in a separate stub smoke run. JavaScript syntax and unique static HTML IDs were checked.
- Live Chrome checks passed for initial comparison, searching/selecting a player, saving travel details, warning about old results, editing and saving archer stocks, interpreting signed wave-damage changes, inspecting exact score at 15:00, and consistent selected-plan/schedule instructions.
- A live JSON save/load round trip succeeded. The old exported file measured 10,334,382 bytes because it included computed output that loading ignored. The revision saves roster, controls and reports and recomputes results instead.
- The live app was inspected inside a 375-pixel frame. Its initial usable viewport was 360 pixels after scrollbar space, and document width matched viewport width without page-level horizontal overflow. Responsive chart coordinates and compact mobile steps address the observed readability problems. This is a Chrome layout check, not physical-device or touch validation.
- Tests and Pages deployment succeeded for both UX implementation commits `1aa0b2516a2c39c26be838f930a1325f3988155a` and `d187cb1129e398eba1d3a2d6324e36e90c80fa10`. Further visual refinements are committed with the final revision.
- Final live narrow-viewport checks covered all five tabs: each document width equalled its 360-pixel usable viewport, and the score chart used a readable 320 × 290 SVG coordinate system. Exact 15:00 values were inspected. These checks use a 375-pixel Chrome frame with scrollbar space.
- The final live search completed, selected its winner, and kept summary/schedule selection consistent. Changing custom-plan controls followed by Compare selected “Your plan settings”. Tests and Pages deployment succeeded for revision `35d4b015e14385077ce53c94b036dddb2cd717e1`.
