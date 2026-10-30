# Bear Trap Lab

A GitHub Pages browser app, with a Python reference simulator, for alliance-wide Kingshot Bear Trap strategy. It compares rally cadence, host selection, troop inventories, tiers, infantry/cavalry/archer mixtures, equal troop splits and concentrated marches, with alliance and individual damage-over-time charts.

## Open the hosted app

https://erross.github.io/BearTrapOptimizer/

The `web/` folder is a fully static GitHub Pages app. It runs all calculations in a Web Worker in the browser; members need no Python installation. No input data is uploaded. The Python engine remains available for local analysis and automated parity checks.

Every page has a **Language** picker for English, Turkish, French, German, Danish,
Spanish and Portuguese. The choice is remembered on this device. Plans and copied
instructions use the selected language; troop entries, player names, calculations
and backup formats keep their original values. See [translation maintenance](docs/localization.md).

The [beginner UX audit](docs/UX_AUDIT.md) records the page-by-page critique and resulting changes. The interface uses one selected approach for its plan and schedule, labels all time/score graphs, provides keyboard time readouts, and marks old results when inputs change. Save an alliance JSON file to retain edits after closing the tab.

In GitHub, enable **Settings → Pages → Source: GitHub Actions**. The included `pages.yml` workflow validates both engines and publishes the web folder on pushes to main. Alternatively publish the `web` directory contents from a dedicated Pages branch.

## Optimize Me

Open **Optimize Me** from the header. Select a member, enter T8/T9/T10 infantry,
cavalry and archers, normal joining queues, saved formation slots, and available
heroes with their first Expedition skill levels. Reserve a separate troop packet
and leader team for your own Bear rally. The special own-rally march does not
consume a joining queue: five joining queues plus your own rally is six marches.

The planner produces identical joining troop counts, assigns supported offensive
joiners without reusing your leaders, and gives preset-saving instructions. Extra
joins use no hero and require a confirmed hero-free capacity. Troops are conserved;
archers fill joins first, then cavalry, then infantry, using the strongest tier
within each type. The own-rally comparison shows the effect of giving joins or
your own rally first pick and can use same-formation damage/hit measurements. Leader
suggestions use visible equipment as a heuristic; confirm your team in game.

Run and select an alliance comparison before opening the page for personal launch
groups. Changed model inputs invalidate those instructions. Assumed travel and
conflicts between personal choices and the selected alliance plan are identified.
The page cannot see live rally countdowns or space.

Personal entries automatically save per player in this browser. Export/import a
player JSON file to transfer devices or collect member submissions. **Use these
counts in the alliance model** updates aggregate troop counts, joining queues,
capacity and hosting eligibility on this device; review the model's tier and bonus
assumptions and compare again. Exact tier inventories remain in the personal
profile. Shared online saving uses the separately deployed Cloudflare Worker and D1 database.
See [Cloudflare setup](docs/CLOUDFLARE.md). Player profiles are currently open to
view and edit without codes; organizer setup and bulk review require the private
organizer key. Submitted counts are reviewed before applying them to the model.
Local-only use remains available.

CNQ joining recommendations are restricted to Chenko, Yeonwoo, Amane and
Amadeus. Hilde and every other listed hero are own-rally options only.

All hero-free joining marches reuse a single saved preset, even while another
hero-free march is away. Preset requirements count distinct formations; any freed
slot can save the separate own-rally formation.

## KvK spend planner

Open **KvK planner** to enter a player's current governor gear, charms, hero gear,
materials, speedups and store currencies. The planner calculates complete upgrade
costs from that gear and allocates confirmed store purchases and actions across
all five preparation days. It prioritizes daily targets, shows shortfalls and
maximizes total points within the entered options. Device drafts and backups work
immediately; shared saving requires the updated Worker and database initialization.
See [KvK inputs, calculation limits and setup](docs/KVK_PLANNER.md).

## Automatic roster refresh

The owner-only MightPulse workflow targets **13:30 and 23:30 UTC** daily. It
opens kingdom 2399, requests Update Map when available, keeps the browser open
for five minutes, then imports CNQ observations and republishes the site. Failed
or still-pending map refreshes stop before the API pull. GitHub start times may
be delayed. See [refresh controls and limits](docs/PRIVATE_API_IMPORT.md).

## Alliance summary

Open **Alliance summary** from the main page or Optimize Me. The directory shows
CNQ members, Town Center levels, power, rank, coordinates, and online troop
submissions. Select a player’s name to open their Optimize Me update page.
Search, filter missing/older submissions, or sort by power, level, troops or save time.

Roster observation/publication times are shown separately from each player's
server-recorded submission time. Position observations have their own timestamps.
Troop totals cover checked online submissions only; missing or failed reads are
unknown, not zero. Local drafts and inferred simulator stocks are excluded.
Tier breakdowns include a separately labelled lower-tier own-rally reserve when used.
Profiles older than seven days are flagged; the page shows times in your timezone.

The page works with the existing open-profile Worker: no redeployment is needed.
It reads profiles in batches of at most six, once on opening or explicit refresh,
with no MightPulse refresh calls or automatic writes. If the first batch entirely
fails, it stops and offers a retry rather than waiting through every member.

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

Opening groups show player names without governor IDs. Use **Copy group** or **Copy all groups** to paste the names and launch times into alliance chat; if clipboard access is unavailable, selected plain text is provided for manual copying. Leaders are selected by the existing strength and eligibility rules, then successive opening groups run from shortest to longest bear travel (ties keep the strength order). Trap comparisons use measured or coordinate-estimated travel to that trap; All members uses configured assumptions. This changes the simulated launch schedule as well as the displayed groups. Simultaneous openings preserve the original dispatch order.

**Optimize waves** adds the highest-damage plan found in a bounded search of wave counts, gaps, starter pools, joining caps and joining times. Every recommended plan must give every attending player a joining packet in the opening wave. The opening policy offers one equal-share packet, limited by stocks, march size and cap, before extra opening joins. It counts joining troops, not the leader's tiny own packet. Cards and the selected plan show opening coverage; infeasible plans are flagged and cannot receive the highest-damage badge. The requirement can be switched off for manual comparisons.

The optimizer permits waiting when it helps damage. In **Add/Edit strategy**, a joining window can hold troops at home until they can arrive shortly before departure (0 sends immediately). Troops in a gathering rally remain committed through countdown, outbound travel and return; returned troops can join another rally whose departure is still reachable. The search tests immediate and late joining and does not equate unused gathering capacity with a rally that will hit underfilled. See [the recycling experiment](docs/WAVE_RECYCLING.md). It is a model comparison, not a calibrated CNQ forecast or proof of a global optimum.

Use **+ Add strategy** at the top to add up to six named comparisons alongside the starter approaches. Copy an existing approach, choose its own starter count, waves, timing and troop mix, then select **Add & compare**. Infantry and cavalry percentages leave the remainder for archers; shortcuts provide 10/10/80 and 20/20/60. You can edit, duplicate or remove each saved strategy without changing the others. All runs share the same attending players, stocks, mechanics and reference damage.

An added strategy can have no voluntary troop cap, its own fixed cap, or follow the front-page dial. Fixed caps and troop mixes remain independent of the preset controls. Added strategies are included in the alliance JSON file and all comparison exports; loading the file recalculates every curve.

The main controls show attendance, alliance strength, selected starter count, opening waves and seconds between waves. With the imported CNQ roster, attendance and strength reflect the chosen players; edit attendance in **CNQ roster & traps**. A troop-cap slider with an exact numeric entry automatically refreshes both capped approaches. Advanced mechanics and search remain in **Setup & assumptions**.

The default loads the published **CNQ, Kingdom 2399** roster. Choose **CNQ roster & traps**, enter coordinates for **Bear trap 1** and **Bear trap 2**, and assign members automatically by nearest trap or manually in bulk. Each trap can be compared separately. The cached data supplies names, TC, account power and city positions; stocks, tiers, capacities and Attack/Lethality remain editable starting estimates. Assignments and measured values merge by governor ID and survive snapshot updates. See [import and planning instructions](docs/PRIVATE_API_IMPORT.md).

The main-page **Download alliance CSV** and **Download full API JSON** buttons export the entire saved alliance, including members outside the selected trap or distance cutoff. CSV includes coordinates, observed account and available troop power, roster/profile fields, rankings and nested hero/gear sections. Unavailable observations stay blank; top-100 power-board omissions do not mean zero power. JSON preserves the complete published snapshot and kingdom-board context. Downloads make no provider requests and contain no simulator estimates or local planning overrides.

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
node tests/check_alliance_export.cjs  # Complete provider exports and CSV integrity
```

Tests cover troop/slot conservation, damage attribution, host-stat versus power separation, travel deadlines, return constraints, strict end-of-event scoring, calibration and randomized resource cases. GitHub Actions runs the suite on Python 3.10, 3.12 and 3.13.

## Repository and deployment

The project repository is [Erross/BearTrapOptimizer](https://github.com/Erross/BearTrapOptimizer).
GitHub Pages publishes only `web/`; the Python reference, research notes and tests stay in the repository.
New API requests still default to the legacy model for backward compatibility; set `damage_model="sqrt"` or `"weighted"` to use troop-aware damage. The updated browser defaults to `"sqrt"`.

### Player history

`history.html` graphs each player's power, Town Center level and submitted troop counts. Each successful owner import archives the roster and reads the public player-profile API (up to six reads concurrently, 12-second timeout per read, no credentials). Public troop counts and their save timestamps are retained under `web/data/history/{governorId}.json`; names and active/former status are listed in `index.json`. No additional Worker deployment is needed. These files are public, like the existing player submissions.

The archive retains source timestamps, deduplicates repeated cached observations, preserves departed members by governor ID and never substitutes zero for an unavailable profile. Troop points include T8–T10 stock plus a separately entered lower-tier own-rally reserve, counted once. This is submitted Bear inventory, not an inferred or live whole-city count. Unchanged profile submissions do not create new points; edits overwritten between twice-daily captures cannot be recovered. A failed profile read does not prevent roster history from advancing. A corrupt archive stops publication rather than erasing old history.

To recover earlier committed power/level snapshots without making provider calls, run `python scripts/alliance_history.py --backfill`. To capture current public troop submissions separately, add `--capture-profiles`. The normal import handles future captures and publishes the current snapshot and history in one commit; API budget reservation still happens before the provider calls.

Alliance totals are available by choosing **CNQ alliance · totals** in History. Power uses the provider's reported alliance total, with earlier committed snapshots recovered. Troops sum the latest entered inventory of current members only and show reporting coverage per capture. Failed or unchecked profile reads retain labelled last-known counts; a confirmed missing submission is excluded. Departed members are excluded from new totals but retain their individual history. Unknown totals are never plotted as zero. The chart breaks lines and withholds growth percentages when reporting member IDs or roster membership change, so new submissions do not masquerade as troop growth. Use `--backfill --alliance-only` to recover alliance power without changing player capture metadata.

### Exclusive gear widgets

KvK widgets are entered per hero in Current gear, including that hero’s current exclusive gear level and owned widgets. Only complete levels (5 × target level, up to level 10) score; hero stocks cannot be combined. Widget offers must select a matching entered hero. Previous aggregate widget counts are preserved as a reference but earn no assumed points until assigned. Reserves, total usage caps, daily rules and purchase windows still apply.

For online saving of these new fields, deploy the current `web/cloudflare-worker.js` using Organizer → Copy Worker code → Cloudflare Edit code → Deploy. The existing D1 table already stores JSON; no database initialization or migration is required. The frontend checks the `kvk-exclusive-widgets` capability before sending hero/widget data, so an older Worker cannot silently discard it. Local drafts and backups work immediately.

### KvK inventory history

History now includes a player/event inventory section: materials and hero items, speedups (minutes), all store balances, governor gear, charms, hero mastery/enhancement, hero-specific exclusive widgets/levels, reserves and daily targets/scores. Select a category/item to chart it, load earlier saves, or inspect/download any recorded full inventory. Full snapshots also retain offers, rules, usable limits, timer capacity and income forecasts. Amount changes are self-reported inventory differences, not inferred purchases or spending. Missing/unentered values do not become zero; hero rows retain stable IDs.

Deploy the current `web/cloudflare-worker.js` once to enable this feature. The Worker creates its inventory-history table and SQLite triggers automatically on first use; do not reinitialize or replace the database. Each successful online KvK save and its history snapshot commit atomically. Failed validation, conflicts and throttled saves add no revisions. The latest preexisting inventory is preserved as a labelled baseline, including before it is overwritten. Previous overwritten versions and device-only drafts cannot be recovered.

`GET /api/kvk/players/{governorId}/history?event=next-kvk` returns full snapshots (10 per page), event choices and an exclusive `nextBefore` revision cursor; `before` and `limit` (1–25) paginate without mixing players/events. Read access to recorded former members is preserved. This public read model matches existing public player inventories. Inventory history is stored in D1 on save, independently of the twice-daily GitHub power/troop archive.

### Joining priorities and own-rally choices

Optimize Me defaults to an inventory-constrained per-type square-root reference. It calculates damage-derived infantry/cavalry amounts and fills the remaining march with archers. An explicit archer-first stock policy and adaptable target ratios are also available. Within a type, T10 precedes T9 and T8. The entered own packet is reserved exactly once first. The default optimizes the stated reference, rather than stock proportions or a fixed universal ratio. Unentered host bonuses are assumed equal across types; optional Attack/Lethality fields let users supply the actual rally leader’s bonuses.

The own-rally comparison shows joins-first with a surplus own packet, a small leader packet, an own-first full reference packet, and the current manual packet. Small uses the weakest entered tier or explicitly confirmed lower troops; it never invents lower-tier inventory. Own-first compares single-tier candidates using the chosen joining policy because the own entry currently supports one tier. Applying a choice changes only the existing own-tier/count fields, leaving the current packet intact until chosen. Default calculation and selected own-tier/count fields work with the existing Worker. Custom policies and optional host bonuses require the updated Worker for online persistence; no database initialization is needed.

Optional same-test-formation own/join damage ratio and hit counts compare personal modeled contribution. The score is `sum_type sqrt(sum_tier(count * relative_attack²)) * sqrt(min(packet_total,5000))`, using combat.js T8–T10 attack values and 10% archer counter and 10% average Volley reference. The overall comparison weights own and joining packets by the entered hit counts and relative rally damage; it also reports the full-vs-small break-even relative strength. Measurements are device/player-specific. The assumption that a same-formation damage ratio transfers across packets, unknown host-type-specific buffs, rally aggregation and displaced joiner damage remain approximations; measured reports should decide close cases. No player data is changed online while comparing.

An optional adaptable target ratio (for example 5/5/90) allocates the requested proportions before filling shortages from archers, cavalry and infantry. It preserves all available matching high-priority troops up to the target/cap; it does not pretend the target ratio is a verified universal optimum. New target-policy fields require the updated Worker for online persistence; the UI checks `bear-join-policy` before saving them, preserving local drafts if the Worker is older. No database initialization is required. Century Games’ Combat FAQ states that a hero’s Expedition skills can activate without matching troops; the app does not impose a fictitious one-infantry skill activation rule.

The guarded default chooses the exact integer maximum for its stated separable square-root reference, using decreasing marginal gains rather than an arbitrary 1-troop floor. Infantry/cavalry results are shown as the damage-derived amounts; remaining capacity goes to archers. On mixed tiers, attack-weighted effective counts approximate the combined type; this is not a claim that the publisher has confirmed that aggregation formula. Exhaustive mixed-tier tests independently verify the reference optimum. Optional actual leader Attack/Lethality changes the coefficients. The measured own/join comparison assumes the entered same-formation ratio transfers across candidate packets; it remains a conditional reference comparison, not a guarantee for unknown hero/Truegold effects or crowded-rally displacement.

### KvK save confirmation

Worker version 7 confirms a successful KvK write from the UPSERT's `RETURNING` row. D1's change metadata includes writes made by the inventory-history triggers, so requiring exactly one changed row could report a conflict after a successful commit. Atomic revision checks, throttling and history rollback remain in place. The backend test adapter now includes trigger writes in its change counts, matching D1. The floating save bar displays the actual error when a request fails.

Deploy the current Worker using Organizer → Copy Worker code → Cloudflare Edit code → Deploy. Existing profiles and history need no reinitialization. A previously reported failed save may already appear in inventory history; check the saved timestamp before replacing any entries.


### Languages and player preferences

All pages support the game's 17 language options plus Danish. Arabic uses right-to-left layout. See [localization](docs/localization.md) for catalog maintenance.

Players may explicitly choose a preferred language in Optimize Me. Worker version 8 saves it with their profile; the alliance summary shows per-player choices and counts. Deploy the updated Worker from Organizer, without resetting D1. Until then, troops still save online and the preference stays local with a clear notice.
