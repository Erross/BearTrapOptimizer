# KvK spend planner

Open **KvK planner** in the shared navigation, select a player and optionally the
first preparation date. Each player/event has separate inputs. Record current
governor gear, charms and hero gear before entering materials, usable speedups,
currency balances, reserves and daily targets. Unknown equipment is excluded.

Quantity fields support direct typing or a **±** panel with +1, +10, +100 and
matching decreases. Small ranges show only applicable steps. Select a player
before editing, then use Continue through the five sections. Only one main
section stays open at a time; closed headings summarize entered amounts and
can be reopened without losing them. Continue validates the current section,
and calculation errors reopen the section containing the field to fix. Inventory
is grouped into expandable cards; reserves, limits and specialist settings stay
inside optional controls. The final review links to exclusions such as unused
speedups, switched-off items and missing gear. A partial plan is allowed, with
unrecorded equipment excluded.

The planner derives successive upgrades and their complete material requirements
from equipment levels. Hero enhancement fields use the +level shown in game
(for example, Red +20 is entered as 20); the stored normalized level is converted
automatically. It uses the increase in event score for each upgrade,
rather than cumulative score or gear power. It can buy a missing material only
when an enabled store offer, currency balance and availability window permit it.
All listed store offers and direct-use items are included by default. Players
enter balances and let the optimizer choose purchases across every store. Optional
settings support exclusions, reserves, price corrections and remaining stock.
Reference offers cover Swordland, Arena, Trial, Tidal, Championship, Alliance
and the standard Gem shop. Alliance stock rotates; its default prices use the
full-price daily offers. Discounts and currently missing offers can be corrected
in optional settings. Gem shop unlimited stock uses a 100,000-purchase model cap.
Pre-update opt-in drafts are migrated once; newer exclusions are retained across
device drafts, online profiles and backups. Custom offers and completed upgrade/training batches support
other confirmed options. Random chest outcomes are not assumed.

## Allocation

All five days are solved together. If every target is achievable, the planner
maximizes total points while meeting those targets. Otherwise it first maximizes
the number of targets met, then minimizes total shortfall, then maximizes points.
An equal-score tie is broken by minimizing the fraction of each currency budget
spent. Different store currencies are not treated as interchangeable coins.

Purchases are integer packs. Currency and material constraints hold at every day,
including upgrade prerequisites. Reserves are protected. General speedups require
actual activity capacity and respect the entered usable limit. Closed days cannot
receive new actions; their past income is excluded from future balances. Enter
already-earned points separately from additional expected points.

HiGHS 1.15.4 runs in a Web Worker using the locally hosted MIT-licensed JS/WASM
files in `web/vendor/`. Each optimization pass has a five-second limit. Only proven
optimal results are accepted and rounded integer results are checked against all
model constraints. A time limit produces an error, not an alleged optimal plan.
The solution is optimal for the confirmed options entered, not every possible
purchase or future activity in the game.

## Gear coverage and inputs

- Governor gear: through Red T2 three stars; charms: through level 21.
- Optional five-part upgrades require the player's current partial stage.
- Hero mastery requires known Mythic/Red gear and enhancement prerequisites;
  higher mastery consumes spare unequipped Mythic pieces as well as hammers.
- Mithril is calculated only for an already-ready, unpaid Red checkpoint. Future
  enhancement XP, initial ascension and unknown gear are not invented.
- Pet advancement, future gathering yields and other unmodelled upgrades need
  confirmed custom batches or expected points. Actual timer capacity and other
  training requirements must be checked by the player.

Reference URLs are kept beside the data in `kvk-catalog.js` and `kvk-gear.js`.
Community tables and store stock vary by kingdom age; confirm them in game. The
daily scoring matrix, targets and shop offers are editable.

## Shared saving and deployment

Calculating never buys an item or writes a player profile online. Device drafts
and JSON backups work without the backend. Explicit **Save online** uses the
existing open roster-profile access model: members with the link can view/edit
inventory. There are no private player accounts.

For shared KvK saves, copy the regenerated Worker from **Organizer → Copy
Worker**, deploy it to the existing Cloudflare Worker with the existing D1
binding, then run **Initialize database** using the organizer key. Initialization
adds `kvk_profiles` and preserves existing Bear profiles. No new binding or secret
is required. See [Cloudflare setup](CLOUDFLARE.md).

KvK records use `(governor_id, event_key)` as their key and optimistic revisions
to reject stale saves. The backend validates the complete schema and roster ID.
An authenticated organizer can export them with `GET /api/admin/kvk/profiles`.
These records are separate from Bear troop profiles and history captures.

Run `node tests/check_kvk_model.cjs` and
`node tests/check_cloud_backend.cjs` for calculation/database checks. The optional
`tests/check_kvk_ui.cjs` Playwright check covers real browser/WASM calculation,
responsive navigation, validation and player/event save separation while mocking
external requests.
