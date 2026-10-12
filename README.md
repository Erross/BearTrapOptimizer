# Bear Trap Lab

A GitHub Pages browser app, with a Python reference simulator, for alliance-wide Kingshot Bear Trap strategy. It compares rally cadence, host selection, troop inventories, tiers, infantry/cavalry/archer mixtures, equal troop splits and concentrated marches, with alliance and individual damage-over-time charts.

## Open the hosted app

https://erross.github.io/BearTrapOptimizer/

The `web/` folder is a fully static GitHub Pages app. It runs all calculations in a Web Worker in the browser; members need no Python installation. No input data is uploaded. The Python engine remains available for local analysis and automated parity checks.

The [beginner UX audit](docs/UX_AUDIT.md) records the page-by-page critique and resulting changes. The interface uses one selected plan for its summary and schedule, labels all time/score graphs, provides keyboard time readouts, and marks old results when inputs change. Save an alliance JSON file to retain edits after closing the tab.

In GitHub, enable **Settings → Pages → Source: GitHub Actions**. The included `pages.yml` workflow validates both engines and publishes the web folder on pushes to main. Alternatively publish the `web` directory contents from a dedicated Pages branch.

## Automatic planning and Kingdom 2399

The simple intake starts with your reported **450k–1M rally capacities**. Other ranges are explicitly illustrative: TC22–30 labels, T8–T10, 45,301–140k march capacities, 45k–1.5M stocks and 50–250% Attack and Lethality by type. These are editable assumptions, not a measured server distribution. Historical scores and power do not enter the combat calculation. Town level alone does not infer a player's bonuses or inventories.

`/api/search` accepts `search_goal` (`balanced`, `damage`, `flow`) and `opening_limit_s` (default240, 0 disables). Balanced retains at least95% of the highest feasible tested score and then minimizes ready-troop waiting. A bounded three-stage search tests starter cohorts, capacity/leader-score floors, group sizes, intervals, restart rules, own-rally amounts and mixes. It checks all selected starters actually begin within the opening window. Recommendations are best tested, not proven global optima.

The [Kingshot Stats API](https://api.kingshotstats.com/) advertises kingdom boards and alliance rosters with power and Town Center levels, behind a Discord-issued API key. A usable Kingdom2399 alliance roster was not retrieved. Full troop inventory and rally bonuses still need player input; no credentials are included in this static app. See [planner details](docs/PLANNER.md).

## Run locally

Requires Python 3.10 or later. **No pip installs or third-party dependencies.**

```bash
python app.py
```

Open **http://127.0.0.1:8765**. On Windows, `py app.py` also works. Stop with Ctrl+C. For another port: `python app.py --port 8766`.

## What is included

- Editable sample alliance of 32 members, historical personal totals from 3M to 224M, and an illustrative 2B baseline.
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
- Example player with 226,505 troops: five joining marches of 45,301, or roughly 37,751 per allocation if also leading a sixth allocation.

## Start with the demo, then calibrate

1. Set attendance and the example capacity spread, then choose **Recommend my rally plan**. The default selects the least waiting among tested plans within 5% of the highest tested damage. Read the starter roles and first-wave table. Treat this as an estimate under assumptions.
2. In **Alliance setup**, choose attending players and select a name to edit march sizes, capacities and travel. “May start rallies” controls eligibility; each plan chooses how many eligible starters to use. In **Troop mixes**, save usable infantry, cavalry, archers, tiers and report stats. The preview can check full marches or five 45,301-troop shares. Power-based estimates use your selected endpoints only and stay labelled estimated.
3. Choose the damage model and scope. The community square-root model is the new UI default; compare per-player and pooled-rally assumptions. Enter empirically estimated residual host strength after accounting for type stats. Account power and town level are context, not damage coefficients. Personal event totals cannot identify rally-host strength by themselves.
4. Optionally paste individual contribution reports into the advanced report-fitting panel on Alliance setup. Include each report's three troop counts and tiers; counts must sum to total troops. Troop-aware fitting supports per-player mode only. Repeat tier/buff conditions where possible. Apply estimates to exact matching member names.
5. Disable baseline normalization for an absolute report-calibrated run. Normalization deliberately fits one baseline to a target and holds that scale fixed across other strategies; it does not independently validate them.
6. Search host counts and troop mixtures, inspect personal outcomes, export the host start timetable and trial one approach in-game.

Travel defaults reflect the supplied 8–20 second range. The default is five-minute rallies and one extra host slot. The owner confirmed that rallies must hit before the event ends. That cutoff is mandatory and includes host travel. With five-minute countdowns and 8–20 second travel, launch before 24:40–24:52 elapsed, depending on the host. The maximum joiner count remains editable.

Use Save alliance file before closing to keep inputs and reports. Computed results are omitted and recalculated on load. There is no automatic disk or cloud saving from the dashboard. All game actions are manual; this is an analysis tool.

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
```

Tests cover troop/slot conservation, damage attribution, host-stat versus power separation, travel deadlines, return constraints, strict end-of-event scoring, calibration and randomized resource cases. GitHub Actions runs the suite on Python 3.10, 3.12 and 3.13.

## Repository and deployment

The project repository is [Erross/BearTrapOptimizer](https://github.com/Erross/BearTrapOptimizer).
GitHub Pages publishes only `web/`; the Python reference, research notes and tests stay in the repository.
New API requests still default to the legacy model for backward compatibility; set `damage_model="sqrt"` or `"weighted"` to use troop-aware damage. The updated browser defaults to `"sqrt"`.
