# Bear Trap Lab

A GitHub Pages browser app, with a Python reference simulator, for alliance-wide Kingshot Bear Trap strategy. It compares rally cadence, host selection, troop inventories, tiers, infantry/cavalry/archer mixtures, equal troop splits and concentrated marches, with alliance and individual damage-over-time charts.

## Open the hosted app

https://erross.github.io/BearTrapOptimizer/

The `web/` folder is a fully static GitHub Pages app. It runs all calculations in a Web Worker in the browser; members need no Python installation. No input data is uploaded. The Python engine remains available for local analysis and automated parity checks.

The [beginner UX audit](docs/UX_AUDIT.md) records the page-by-page critique and resulting changes. The interface uses one selected approach for its plan and schedule, labels all time/score graphs, provides keyboard time readouts, and marks old results when inputs change. Save an alliance JSON file to retain edits after closing the tab.

In GitHub, enable **Settings → Pages → Source: GitHub Actions**. The included `pages.yml` workflow validates both engines and publishes the web folder on pushes to main. Alternatively publish the `web` directory contents from a dedicated Pages branch.

## Map zoom and distant members

In **CNQ roster & traps**, use **+ / −**, **Fit nearby** or **Fit all** to zoom the
city map. Scroll to zoom and drag to pan; arrow buttons and keyboard controls
are available. Map navigation does not change assignments or simulation inputs.

Save both trap positions, then use **Auto-assign by proximity** beside the save
button to assign unassigned members to the nearer trap. To reassign a selected
set, use the proximity button above the member table. Existing assignments are
kept when no members are selected.

**Exclude distant members** defaults to a maximum of **100 coordinate units**.
For a trap-specific comparison, distance is to that trap; All members and
Unassigned use the nearest saved trap. Change the threshold or turn it off.
Distant members remain in the roster with their attendance and assignments;
they are omitted from every strategy in that comparison. The summary lists
excluded names, and orange outlines mark their map positions. Without a known
city/trap distance the member stays included. The setting saves with the plan.

## Starter approaches and your own strategies

The front page compares **Everyone together**, **Strongest leaders only**, **Selected leaders in waves**, **Selected waves + troop limit**, **Everyone in waves**, and **Everyone in waves + troop limit**. All six damage curves are shown by default. Each approach card names its starter count, opening groups, interval and troop rule. Selecting a card shows the corresponding leaders, join-only players and launch groups. Both wave approaches have a capped counterpart with identical leaders and timing, so the only difference within each pair is the joining-march limit.

Use **+ Add strategy** at the top to add up to six named comparisons alongside the starter approaches. Copy an existing approach, choose its own starter count, waves, timing and troop mix, then select **Add & compare**. Infantry and cavalry percentages leave the remainder for archers; shortcuts provide 10/10/80 and 20/20/60. You can edit, duplicate or remove each saved strategy without changing the others. All runs share the same attending players, stocks, mechanics and reference damage.

An added strategy can have no voluntary troop cap, its own fixed cap, or follow the front-page dial. Fixed caps and troop mixes remain independent of the preset controls. Added strategies are included in the alliance JSON file and all comparison exports; loading the file recalculates every curve.

The main controls show attendance, alliance strength, selected starter count, opening waves and seconds between waves. With the imported CNQ roster, attendance and strength reflect the chosen players; edit attendance in **CNQ roster & traps**. A troop-cap slider with an exact numeric entry automatically refreshes both capped approaches. Advanced mechanics and search remain in **Setup & assumptions**.

The default loads the published **CNQ, Kingdom 2399** roster. Choose **CNQ roster & traps**, enter coordinates for **Bear trap 1** and **Bear trap 2**, and assign members automatically by nearest trap or manually in bulk. Each trap can be compared separately. The cached data supplies names, TC, account power and city positions; stocks, tiers, capacities and Attack/Lethality remain editable starting estimates. Assignments and measured values merge by governor ID and survive snapshot updates. See [import and planning instructions](docs/PRIVATE_API_IMPORT.md).

Choose **Illustrative alliance** to use the original top-four scenario: 40 players split into 8 developing / 18 core / 10 strong / 4 leader profiles, TC24–30, 20–160M power and 450k–1M rally capacities. This is an assumed mix, not a measured alliance average. The shared definition is `web/alliance-profiles.json`; power and TC do not directly multiply damage.

The graph shows relative damage, with **100 = the together baseline's final damage**. Every line uses the same roster, troop stocks and common denominator. A per-join troop limit is an alliance rule, 50k by default in the capped approach; actual game rally capacities and joiner limits apply everywhere.

The six starter approaches share 5% leader marches and concentrated joining marches. With everyone selected and one opening wave, the uncapped selected and everyone-wave approaches exactly match the together baseline, including every point on the damage curve; their capped counterparts also match each other. Zero spacing between waves has the same effect. Both capped starter approaches use the front-page troop-cap limit. Added strategies have their own troop allocation; the editor keeps those extra controls in an optional section.

The broader three-stage search remains optional. Balanced keeps at least 95% of the highest feasible tested damage and then minimizes ready-troop waiting. See [planner details](docs/PLANNER.md) for exact approach definitions, assumptions and search limits.

## Run locally

Requires Python 3.10 or later. **No pip installs or third-party dependencies.**

```bash
python app.py
```

Open **http://127.0.0.1:8765**. On Windows, `py app.py` also works. Stop with Ctrl+C. For another port: `python app.py --port 8766`.

## What is included

- Editable illustrative 40-player alliance with developing, core, strong and leader groups; alternative maturity profiles and custom ranges.
- Separate leader slot plus each member's own joining slots; troop conservation, rally capacity, joiner caps, travel, return and reaction delays.
- Synchronized, evenly staggered, three-wave, custom-spacing and configurable group schedules; independent restarts or a shared group clock.
- Next-impact, strongest-host and estimated damage-per-troop-minute joining policies.
- Full, equal-share and small host marches; equal or concentrated joining troops.
- Four inventory-aware formation policies and a player fleet preview showing exact march counts and unused troops.
- Editable type-specific leader Attack/Lethality, tier and quality; community square-root, weighted linear and legacy damage modes.
- Damage and committed-time breakdowns for infantry, cavalry and archers.
- Plain-language strategy names, instructions and explanations of each tradeoff.
- Automatic starter-pool, group-size, wave-interval and allocation recommendations, selectable individual charts, impact timeline, utilization and member tradeoffs.
- CSV roster import/export, contribution-report calibration, project JSON export/import, results CSV, host timetable and SVG chart export.
- Can model a player with 226,505 troops: five joining marches of 45,301, or roughly 37,751 per allocation if also leading a sixth allocation.

## Start with the comparison, then refine

1. Open the app to see six damage curves for the cached CNQ roster. In **CNQ roster & traps**, enter trap positions, assign groups, then choose **Compare Bear trap 1** or **Compare Bear trap 2**. Before selecting a trap, full-alliance comparisons use assumed travel.
2. Drag the troop-cap slider or enter an exact limit to explore the two capped approaches. The comparison refreshes automatically and preserves the graph lines you chose.
3. Choose **+ Add strategy** to compare a named troop mix or timing plan. Use Edit, Duplicate and Remove to refine the added comparisons. Save the alliance file to keep them.
4. Select an approach card to inspect its leaders, join-only members and opening groups. Changing selected starter count affects the selected-leader plans; the everyone plans still use all eligible players.
5. Open **Setup & assumptions** to enter real players, attendance, troop counts, tiers, bonuses and travel times. Saved player edits are preserved when updating the comparison. Estimated stocks stay labelled estimated.
6. Use the model page for custom player ranges, an additional custom plan or a broader search. The troop-mix and report-fitting tools remain available there.
7. Save an alliance file in Setup to keep the inputs after closing the tab. Load it later or share it with another member. Computed results are recalculated.

Travel defaults reflect the supplied 8–20 second range. The default is five-minute rallies and one extra host slot. The owner confirmed that rallies must hit before the event ends. That cutoff is mandatory and includes host travel. With five-minute countdowns and 8–20 second travel, launch before 24:40–24:52 elapsed, depending on the host. The maximum joiner count remains editable.

The CNQ plan saves assignments and measured values in this browser. Export the plan to keep a portable backup, including added strategies and comparison settings. Save alliance file in Setup also includes the CNQ plan. Computed results are recalculated on load. There is no cloud storage for user plans. All game actions are manual; this is an analysis tool.

## Initial strategy questions

- **Cadence:** compare opening groups and individually spread starts. Reserve small own-rally packets so later starters can join early rallies without losing their ability to start. The planner checks actual first-start deadlines and waiting, not just impact gaps.
- **Who leads:** measure damage per equivalent troop under each host. Capacity and travel affect throughput. A weak host can still be useful when stronger rallies lack room; a strong host can be underused if its rally cannot fill.
- **Own march:** large host marches help if those troops would otherwise sit idle. Smaller host marches can help when troops can enter stronger rallies and when other members actually replace the released capacity.
- **Split troops:** with the legacy or weighted linear model and identical hosts, splitting alone creates no free damage. The square-root model can favour sharing scarce archers across more attacks; stock, travel and slot limits still apply. The gain or loss comes from which rallies those troops reach, how often they hit, capacity competition and time spent waiting.
- **Joining:** the next rally may maximize turnover; the strongest host may maximize each hit. Damage per occupied troop-minute tests the tradeoff. None is assumed universally best.

These are model-guided hypotheses, not a solved combat meta. See [docs/DAMAGE_RESEARCH.md](docs/DAMAGE_RESEARCH.md) for sources and [docs/MODEL.md](docs/MODEL.md) for implementation boundaries.

## Python use

```python
from beartrap.model import synthetic_roster, Mechanics, Strategy
from beartrap.simulator import simulate

roster = synthetic_roster(n=32)
run = simulate(roster, Mechanics(damage_model="sqrt"), Strategy(host_count=16, cadence="staggered"), audit=True)
print(run["total_damage"], run["summary"])
```

API: `POST /api/compare`, `/api/search`, `/api/calibrate`, `/api/roster`, `/api/formation_plan`. Requests and responses use JSON. `data/sample-roster.csv` documents all roster fields. The CSVs are fictional demonstration inputs. Old project JSON v1 imports preserve the legacy damage model; v2 exports include inventories and provenance labels. The Python reference API server binds to localhost by default. The public Pages dashboard calculates in the browser and does not require the server. This local tool is not a hardened public hosting service; authentication and deployment are outside this version.

## Validation

```bash
python -m unittest discover -s tests -v
python tests/check_browser_parity.py  # Node is needed for this development check only
node tests/check_ui_state.cjs         # Dashboard roster-preservation checks
node tests/check_alliance_model.cjs   # Identity, merge and coordinate timing
node tests/check_alliance_ui.cjs      # CNQ grouping, graph and import handlers
```

Tests cover troop/slot conservation, damage attribution, host-stat versus power separation, travel deadlines, return constraints, strict end-of-event scoring, calibration and randomized resource cases. GitHub Actions runs the suite on Python 3.10, 3.12 and 3.13.

## Repository and deployment

The project repository is [Erross/BearTrapOptimizer](https://github.com/Erross/BearTrapOptimizer).
GitHub Pages publishes only `web/`; the Python reference, research notes and tests stay in the repository.
New API requests still default to the legacy model for backward compatibility; set `damage_model="sqrt"` or `"weighted"` to use troop-aware damage. The updated browser defaults to `"sqrt"`.
