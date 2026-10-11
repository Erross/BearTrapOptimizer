# Beginner walkthrough and UX changes

Reviewed 11 October 2026. Audience: a Bear Trap player who knows how to send troops but does not understand simulation terminology; alliance members with different first languages. This was an expert walkthrough of the live page, not a study with recruited players.

## First visit and shared controls

| What a beginner asks | Problem observed | Change implemented |
|---|---|---|
| What do I do first? | Export buttons, assumptions and a long settings sidebar arrive before the task. The instructions are closed. | Three visible steps: alliance setup, troop mixes, compare plans. |
| Are these my players? | A large 2.21B result can look like a forecast for the alliance. “Synthetic” is technical wording. | Explicit demo-player notice, estimated-stock counts for entered rosters, and a plain explanation of baseline scaling. |
| What do M and B mean? | Score, power and stock inputs use abbreviations without a nearby explanation. | Units written out on inputs; k/M/B explained by score graphs and in the glossary. |
| Why does the plan say everyone starts together when the cards show the best result? | Cards display the best compared strategy; the schedule defaults to the baseline. | One selected-plan state updates cards, plan, outcomes and highlighted comparison row together. Initial selection is the highest-scoring compared plan. |
| Where do I change my plan? | Many technical model options are interleaved with practical strategy controls. | Custom-plan options remain in the sidebar. Event limits and demo generation collapse separately. Damage and scale controls move to Help & model. The sidebar defines the “Your plan settings” row; other plans intentionally use their own settings. Recomparison after changed inputs selects the custom plan. |
| What does cadence mean? | Technical label; long menu options clip in the narrow sidebar. | “When rallies start”, shorter option names and a description of the selected start pattern. |
| Does changing this option update the graphs? | Old results remain visible without a clear stale-state warning. | A persistent update-needed banner; result downloads disabled until a new comparison. |
| Did typing troop counts save them? | A user can compare without saving, or switch players and lose the draft. | Unsaved troop/detail notices, explicit save/discard, protection when switching players or running a comparison. |
| Why is this field editable if it does nothing? | Fixed spacing, small own-rally size and linear exponent are always offered. | Disable each when its corresponding strategy/model is not selected. Scale and target similarly follow the baseline-scaling toggle. |
| Will this button erase my players? | Generate/replace can replace the whole roster with no easy recovery. | Clear “Replace alliance with demo players” wording plus in-session undo. |
| What happens when I close the page? | No clear distinction between saved files and tab memory. | Visible save/load buttons and explicit instructions that reloading resets to the demo. Invalid imports restore the previous alliance and settings. Saved files contain roster, controls and reports; redundant computed results are omitted and recalculated on load. The old demo export contained about 10 MB of graph data. |
| Why can’t I use this on my phone? | A huge sidebar precedes all results; tab labels overflow. | Mobile settings toggle, compact step buttons, scrolling tabs, stacked forms and horizontally contained tables. Charts size their SVG coordinate systems to the actual container so axis text stays readable. The dense timeline can scroll sideways. |
| Can I use a keyboard or screen reader? | Clickable rows have no button semantics; SVG labels are internal IDs; hover is the main readout. | Real action buttons, tab roles and arrow-key navigation, focus indicators, labelled charts, keyboard time controls and exact data tables. |

## Compare plans

| Component | Beginner critique | Fix |
|---|---|---|
| Selected score card | Which strategy is this number for? | Selected plan named immediately above the cards. |
| Percentage-change card | Positive against what? | “Change from baseline”; baseline defined as everyone eligible starts together. Zero-baseline cases say “No baseline”. |
| Gap card | Does 20s include the five-minute wait at the start? | “Longest time with no hits”, expressed minutes:seconds; opening wait excluded and ending included in its nearby description. |
| Rally-fill card | What is fill? More damage? | “Average rally capacity used”; glossary explains troops / capacity and includes leader troops. |
| Alliance graph | What do the axes measure? Why does a line jump? | Estimated score axis, elapsed minutes:seconds axis, explanation of flat sections and jumps. |
| Graph legend | Eleven strategies overwhelm the first comparison; colours alone are hard to track. | Initial graph shows baseline plus selected plan. Buttons restore this view or show all; line styles also differ. |
| Hover values | I can’t hover on a phone or reliably inspect a precise time. | A time slider and exact readout on each chart, plus a table of final totals. |
| Event horizon | Different charts can end at the last data point. | All charts use the configured full event duration. |
| Individual graph | Is a heavy hitter always helped by the alliance’s best plan? | Explicit tradeoff prompt, selected player’s stock/slots, and personal totals under the same graph choices. |
| Individual type table | “Busy” sounds like productive damage. | “Away from home”; explanation includes wait, travel and return. Type table is expandable. |
| Strategy titles | Similar rows provide too little action detail. | Shorter titles retain a specific own-march, joining and mix description; detailed instructions in the rally plan. |
| Strategy table | Clicking any cell unexpectedly jumps pages. | A visible keyboard-accessible “View plan” action; selected row clearly marked. |
| Strategy-table numbers | Signed percentages, score and troop use can be confused. | Explicit estimated-score/change headers, signed changes and full descriptions of capacity/away-time metrics. |
| Search button | Does this guarantee the best strategy? How long does it take? | “Find a better tested plan”; bounded-search explanation, progress message and actual candidate count on completion. |
| Downloads | JSON, CSV and SVG look like required setup steps. | Save/load are convenient top actions; result-format downloads are grouped after results and explained. |

## Troop mixes

| Component | Beginner critique | Fix |
|---|---|---|
| Stock editor | Does “available” include my other marches? | Stock description says each troop can be in only one march at a time. |
| Player summary | Power values show long interpolation decimals. | Descriptive power rounded to one decimal; troop counts shown as readable exact numbers. |
| Tiers and bonuses | What is quality? Whose Attack is used? | Optional advanced section explains report totals, leader versus joiner, multiplier 1, and avoiding duplicate bonuses. |
| Power estimate | Does the game have a predictable power-to-stock formula? | Estimate tucked under an explicit assumption explanation; real counted stocks encouraged. |
| Wave preview | Is this an event score? Are five joins plus my own rally five marches? | “Compare one wave”; five joins + own rally = six; separate stock-preview and event-slot limits explained. |
| Default march size | The 226,505-troop example starts with five 90k requests and looks broken. | Default request divides stock across available joining marches, capped by maximum march size. Buttons select even shares or full-size requests. |
| Target ratio | Where is the 80 for archers? Is 10/10/80 cavalry first? | Ratio inputs placed directly in the troop page, with computed archer percentage and explicit Infantry / Cavalry / Archers order. |
| Target control scope | Does this only affect this preview? | A note says the target is shared with the custom rally plan. |
| Stock shortage | Does zero full marches mean I cannot participate? | Explain smaller or different mixes can still work; show required counts and missing type. |
| Policy comparison | “Damage index 100%” looks like the actual score. | Signed “Damage change vs available mix”: 0% is the reference wave, +10% means 10% more estimated wave damage. |
| Unused troops | Does stock at home prove this policy is bad? | Explain that unused troops may still serve later waves; compare wave damage and fill together. |
| Policy row | How do I see the actual troop counts? | Explicit “View marches” button, selected-row styling, and per-march exact counts. |
| Preview freshness | Changing the target/model leaves old ratios or damage visible. | Invalidate old preview when relevant settings change; prompt for recomparison. |
| Alliance stock table | Power decimals, jargon and wide table add noise. | Rounded power, descriptive headers, expandable diagnostics and explanation of stock-only limits. |

## Alliance setup

| Component | Beginner critique | Fix |
|---|---|---|
| Roster | Fifteen editable columns require extensive horizontal scrolling. | Compact attendance/stock/limits table, name search, and one-player detail editor. |
| Name and attendance | What action does clicking a name perform? | Underlined name button; attendance remains a direct checkbox. |
| Starter permission | Does ticking it mean this person must start in every plan? | Explain permission versus selection by each plan. |
| Joining slots | Does my own rally consume one of these? | Explicit separate own-rally slot with shared troops. |
| Troop total | I cannot edit this field. Why? | Display total in roster and provide direct entry to the selected player’s troop page. |
| Travel fields | Which movement is each time measuring? | Full labels for city-to-Bear, return, and joining another rally, all in seconds. |
| Power, town level and past score | Do these automatically determine damage or hosting ability? | Each labelled reference-only; report stats and model multipliers determine modeled damage. |
| Multipliers | I don’t know what number to enter. | Optional advanced details; explain 1 and report-based fitting, warn against power or double-counted tiers. |
| Calibration | Am I expected to prepare CSV before using the app? | Collapse as advanced; add a sample-format button, three steps and labels for contribution reports. |
| Calibration results | What is a host coefficient? What do I do next? | “Estimate leader multipliers” and “Apply estimates to matching players”; an update-needed warning after applying. |

## Rally schedule

| Component | Beginner critique | Fix |
|---|---|---|
| Plan selector | Is this the same strategy as the score at the top? | Shared selected-plan state and explicit text confirming it. |
| Plan explanation | The names sound abstract; what do players actually do? | Six concrete instructions: starters, timing, own troops, joining troops, rally choice and troop mix. |
| Cutoff | Do I count the five-minute countdown or travel too? | Exact per-starter latest safe start, a fastest-eligible bound, configured event deadline and the 25:01 example. |
| Impact timeline | Are dots start times or hit times? Does dot size mean damage? | Explicit hit-time and capacity-size explanation; caption provides hit count and first/last hit. |
| No hits | An empty plot gives no reason. | Plain no-hit message suggests timing, permission or stock checks. |
| Minute bars | Does a bar cover a point or a minute? | Interval labels and exact minute table. Width stays inside the full event horizon; final minute is not stretched past 30:00. |
| Troops-away chart | Higher looks better, but it can be wasted waiting. | Renamed and explained; troop units rather than damage units. |
| Host table | “Model score” and “Residual strength” distract from executing a plan. | Practical starter/capacity/cutoff/start/hit/whole-rally-score columns; advanced multipliers remain in the player editor. |
| Time notation | Is 5:30 a clock time? | Explicit elapsed minutes:seconds explanation. |
| Individual outcomes | Does whole-rally damage belong personally to the starter? | Distinguish whole-rally score from a player’s own contribution; define baseline comparison. |
| Exports | What will each CSV contain? | Buttons describe rally start times versus every player’s troop assignments. Stale exports disabled. |

## Help & model

| Component | Beginner critique | Fix |
|---|---|---|
| Long theory page | Equations arrive before an explanation of useful decisions. | Start with what stock/timing can establish and what damage still needs validation. |
| Jargon | Host, join, baseline, residual and score abbreviations are inconsistent. | Glossary uses starter/leader, joining march, stock, capacity, baseline, leader multiplier and k/M/B. |
| Damage controls | Do I need to understand square roots to use this? | Advanced settings remain optional; the existing community model stays selected. |
| Count-combination mode | Is either scoring scope verified? | Keep the unresolved credit assumption explicit; explain why trying both can change rankings. |
| Score scaling | Does typing 2B predict future damage? | Separate scale panel explains that it sets a comparison reference only. |
| Formulas and sources | Can I still inspect the evidence? | Preserve full technical detail in an expandable section and retain all research links. |

## Checks and remaining limits

The Python and browser simulation algorithms, hero scope, troop conservation and strict hit-before-expiration rule were preserved. UI changes are in `web/index.html`, `app.js`, `formations-ui.js`, `ux.js`, `styles.css` and `ux.css`. The local Python server serves all of those assets.

Checks before deployment: JavaScript syntax, unique HTML IDs, local HTTP asset loading, the existing 28 Python tests and 72 full-output Python/browser parity cases. A DOM-stub smoke check exercises selected-plan consistency, graph labels, stale results, troop preview, imports and search; it is not a substitute for visual/browser checks.

This update uses clearer English and consistent terms; it does not claim to translate the interface into alliance members’ languages. True damage rankings still require alliance report evidence. Responsive layout checks use the live app in a 375-pixel frame in Chrome, not a physical phone or touch emulation. `responsive-check.html` provides a reproducible narrow-viewport check without changing the public app’s normal flow.

During live verification, a duplicate “Enter this player’s troops” action was removed because the generic action could open a different player. Name searches now leave the wave preview intact, and desktop comparison/search actions remain visible at the bottom of the sidebar.
