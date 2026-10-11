# Bear Trap Lab

A GitHub Pages browser app, with a Python reference simulator, for alliance-wide Kingshot Bear Trap strategy. It compares rally cadence, host selection, host troop size, equal troop splits and concentrated marches, with alliance and individual damage-over-time charts.

## Open the hosted app

The `web/` folder is a fully static GitHub Pages app. It runs all calculations in a Web Worker in the browser; members need no Python installation. No input data is uploaded. The Python engine remains available for local analysis and automated parity checks.

In GitHub, enable **Settings → Pages → Source: GitHub Actions**. The included `pages.yml` workflow validates both engines and publishes the web folder on pushes to main. Alternatively publish the `web` directory contents from a dedicated Pages branch.

## Run locally

Requires Python 3.10 or later. **No pip installs or third-party dependencies.**

```bash
python app.py
```

Open **http://127.0.0.1:8765**. On Windows, `py app.py` also works. Stop with Ctrl+C. For another port: `python app.py --port 8766`.

## What is included

- Editable sample alliance of 32 members, historical personal totals from 3M to 224M, and an illustrative 2B baseline.
- Separate leader slot plus each member's own joining slots; troop conservation, rally capacity, joiner caps, travel, return and reaction delays.
- Synchronized, evenly staggered, three-wave and custom-spacing schedules.
- Next-impact, strongest-host and estimated damage-per-troop-minute joining policies.
- Full, equal-share and small host marches; equal or concentrated joining troops.
- Host-count/allocation search, selectable individual charts, impact timeline, utilization and member tradeoffs.
- CSV roster import/export, contribution-report calibration, project JSON export/import, results CSV, host timetable and SVG chart export.
- Example player with 226,505 troops: five joining marches of 45,301, or roughly 37,751 per allocation if also leading a sixth allocation.

## Start with the demo, then calibrate

1. Compare the default scenarios. Treat the charts as demonstrations, not promises about your alliance.
2. In **Members & calibration**, enter real attendance, troops, march capacities, rally capacities and travel. The Host checkbox controls eligibility. Unchecking Here removes a member from that event.
3. Enter empirically estimated host strength. Account power and town level are context, not damage coefficients. Personal event totals cannot identify rally-host strength by themselves.
4. Paste individual contribution reports into the calibration panel. Repeat the same formation/tier/buff conditions where possible. Apply the fitted coefficients to exact matching member names.
5. Disable baseline normalization for an absolute report-calibrated run. Normalization deliberately fits one baseline to a target and holds that scale fixed across other strategies; it does not independently validate them.
6. Search host counts, inspect personal outcomes, export the host start timetable and trial one approach in-game.

Travel defaults reflect the supplied 8–20 second range. The default is five-minute rallies and one extra host slot. The owner confirmed that rallies must hit before the event ends. That cutoff is mandatory and includes host travel. With five-minute countdowns and 8–20 second travel, launch before 24:40–24:52 elapsed, depending on the host. The maximum joiner count remains editable.

Use Export project JSON before closing to keep inputs, reports and the last results. There is no automatic disk or cloud saving from the dashboard. All game actions are manual; this is an analysis tool.

## Initial strategy questions

- **Cadence:** spread launches over the host cycle rather than concentrating them into one burst. A starting estimate is `(300 + outbound + return + reaction seconds) / number of hosts`, but compare actual completed hits, fill and member scores.
- **Who leads:** measure damage per equivalent troop under each host. Capacity and travel affect throughput. A weak host can still be useful when stronger rallies lack room; a strong host can be underused if its rally cannot fill.
- **Own march:** large host marches help if those troops would otherwise sit idle. Smaller host marches can help when troops can enter stronger rallies and when other members actually replace the released capacity.
- **Split troops:** with linear damage and the same host coefficient, splitting alone creates no free damage. The gain or loss comes from which rallies those troops reach, how often they hit, capacity competition and time spent waiting.
- **Joining:** the next rally may maximize turnover; the strongest host may maximize each hit. Damage per occupied troop-minute tests the tradeoff. None is assumed universally best.

These are model-guided hypotheses, not a solved combat meta. See [docs/MODEL.md](docs/MODEL.md) for the boundaries.

## Python use

```python
from beartrap.model import synthetic_roster, Mechanics, Strategy
from beartrap.simulator import simulate

roster = synthetic_roster(n=32)
run = simulate(roster, Mechanics(), Strategy(host_count=16, cadence="staggered"), audit=True)
print(run["total_damage"], run["summary"])
```

API: `POST /api/compare`, `/api/search`, `/api/calibrate`, `/api/roster`. Requests and responses use JSON. `data/sample-roster.csv` documents all roster fields. The Python reference API server binds to localhost by default. The public Pages dashboard calculates in the browser and does not require the server. This local tool is not a hardened public hosting service; authentication and deployment are outside this version.

## Validation

```bash
python -m unittest discover -s tests -v
python tests/check_browser_parity.py  # Node is needed for this development check only
```

Tests cover troop/slot conservation, damage attribution, host-stat versus power separation, travel deadlines, return constraints, strict end-of-event scoring, calibration and randomized resource cases. GitHub Actions runs the suite on Python 3.10, 3.12 and 3.13.

## GitHub setup

The project repository is `Erross/BearTrapOptimizer`. To connect a local checkout to it:

```bash
git init -b main
git add .
git commit -m "Build Bear Trap strategy simulator and dashboard"
git remote add origin https://github.com/Erross/BearTrapOptimizer.git
git push -u origin main
```

The sample members are fictional. GitHub Pages publishes only the `web/` folder; the Python reference and tests remain in the repository.
