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

## Automatic group planner revision · 12 October 2026

- 35 Python tests and84 full-output Python/browser parity cases pass. New cases cover exact10/10/10/2 opening waves, reserved troops, fixed360-second cycles, rejected short cycles, hard starter floors including final push, blocked-troop waiting, per-type conservation under three formation policies and unequal capacities, configurable roster bonuses and all three search objectives.
- Balanced recommendations are checked to meet the opening window and retain at least95% of the highest feasible tested score. Search comparison uses one common scale.
- A40-player example using450k–1M rally capacities, T8–T10, 50–250% Attack/Lethality and45,301–140k march capacities tested226 plans in about40seconds in Node. Its recommendation selected groups of10 at30s intervals, all first starts by1:30. This is an assumed scenario, not a Kingdom2399 measurement or a universal rule.
- Browser worker, engine and UI assets are versioned together to avoid stale mixed-model resources on GitHubPages.
- Live Chrome verification passed for automatic32-player and40-player recommendations, grouped first starts, practical troop instructions, the travel-aware cutoff and the ready-wait graph. A1M capacity floor selected only the1M leader and reported39 join-only players with80.4% waiting, demonstrating the cost of excluding all smaller rallies. These are demo outcomes, not alliance measurements.
- All five tabs fit within the360-pixel usable width of a375-pixel Chrome frame, without page-level horizontal overflow. This does not validate a physical touch device.

## Roster preservation revision · 12 October 2026

- Fixed the recommendation flow resetting attendance, saved player details and individual power-based troop estimates while the original roster was still marked as a demo. Those edits now select the current roster for subsequent recommendations. Editing details does not relabel estimated stocks as measured counts.
- `node tests/check_ui_state.cjs` exercises attendance selection, player renaming and rally capacity edits, and a per-player stock estimate through the actual dashboard handlers and browser engine. Recommendations keep the edited inputs and do not regenerate players. This uses a DOM stub and a short event; full timing and engine parity are covered by the existing suites. The Pages workflow runs this check before deployment.

## Graph-first approach comparison · 12 October 2026

- Checks: 41 Python tests, 99 complete-output Python/browser parity cases, and the dashboard state check. Shared profile JSON and new scripts/styles are also checked through the local HTTP API.
- Added balanced explicit wave counts, voluntary per-join troop limits, ordered named comparisons sharing one scale, and a shared illustrative profile definition. Tests cover uneven groups, more waves than leaders, conservation and physical capacity under voluntary caps, and preserving the leader's own march size.
- The updated UI-state check verifies exactly five initial approaches, all five lines selected, a relative damage graph, closed initial Setup, opening/closing Setup, and roster edits surviving comparison updates.
- The default 40-player scenario uses 8 developing / 18 core / 10 strong / 4 leader profiles. Before the one-wave comparison correction below, the five approaches scored relative indices 100.0 / 53.4 / 88.1 / 100.3 / 110.8. That baseline also changed troop allocation and has been superseded. These calculations do not establish actual alliance damage or mobile-device performance.
- Live Chrome review confirmed all five initial curves, approach-card selection, the 50k cap label and join-only list, a 23-starter / five-wave / 30-second comparison with groups of 5/5/4/5/4, and preservation of a saved renamed player and attendance changes. The main page contains exactly five setup variables. A 375-pixel frame had a 360-pixel usable viewport and equal document width, without page-level horizontal overflow. This is a browser layout check, not a physical-phone test.
- The live pass also corrected the attending estimated-stock count, an outdated save instruction, excessive control-row spacing, and setup-dialog sizing relative to the usable viewport.

## Equivalent one-wave comparison correction · 12 October 2026

- Reproduced the user-reported mismatch on the live page: with 40 attending, 40 selected starters and one wave, the together baseline scored index 100 while the two uncapped wave plans scored 91. The baseline used full leader marches and equal joining shares; the wave plans used 5% leader marches and concentrated joins. The same start times were therefore comparing different troop rules.
- Removed the baseline-only troop overrides. All five plans now share 5% leader marches and concentrated joins, and the common rules are stated above the approach cards. The wave plans and together baseline use the same restart and joining rules.
- The actual dashboard builder and browser engine now give identical complete damage curves, hits and player outcomes for everyone selected in one wave. Multiple waves with zero spacing also match. A voluntary joining cap above every player's march size has no effect. The dashboard state test still checks attendance, player edits and estimated-stock preservation.
- Reference regression coverage checks identical complete simulation outputs for one-wave and zero-spacing openings under all three damage models, both counting scopes and four formation policies, including unequal travel, stock, capacities and ineligible starters. Troop conservation is audited in each run.
- Checks passed: 42 Python tests, 105 complete-output Python/browser parity cases, dashboard state regression, JavaScript syntax and whitespace validation.
- The revised default 40-player / 24-starter / four-wave / 60-second comparison scores indices 100.0 / 58.7 / 96.8 / 110.3 / 121.8. The changed denominator reflects the corrected troop-consistent baseline. With 40 starters and one wave, the together, selected uncapped and everyone-wave curves all score exactly 100.

## Matched everyone-wave cap and interactive dial · 12 October 2026

- Added a sixth approach, everyone in waves with the same joining-march limit as the selected capped plan. Its settings match the uncapped everyone-wave plan except for the name and limit. The leader list, opening groups, restart rule, own troop packet and joining priority are identical.
- The front-page slider and exact number entry control both capped approaches and automatically refresh the comparison. Chosen graph lines and a custom comparison are preserved. Mid-calculation cap changes queue the latest value and keep the older result marked stale.
- Dashboard regression checks cover six visible approaches, the matching settings, the new plan's leader instructions and cap, slider/number synchronization, automatic updates, selected graph lines, unchanged roster, and changing the cap during a worker request. Capped selected/everyone curves agree when all starters are selected, and a cap above every march capacity has no effect. Existing one-wave and zero-gap checks still pass.
- Local checks passed: dashboard regression, JavaScript syntax, static HTTP/API tests and whitespace validation. The Python simulation and browser engine are unchanged.
