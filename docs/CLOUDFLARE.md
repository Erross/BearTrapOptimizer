# Shared player profiles

The website stays on GitHub Pages. A separate Worker at
`https://bear-optimizer-api.ewanrross.workers.dev` stores profiles in Cloudflare D1.
No game API is involved. Local browser saves and JSON export/import remain available.

## Dashboard setup

1. Create Worker `bear-optimizer-api` and D1 database `bear-optimizer`.
2. In the Worker, add a D1 binding named `DB` selecting that database.
3. In Settings → Variables and Secrets, add secret `ADMIN_TOKEN` with at least
   32 random characters. Retain it in your password manager. Never put it in
   GitHub, chat, source code, a query string or a public configuration file.
4. Open the website's Organizer page (`organizer.html`). Copy Worker code using
   its button. In Cloudflare → Worker → Edit code, replace the complete Hello
   World module with that code, then Deploy. The source is also available at
   `web/cloudflare-worker.js` in the repo.
5. On Organizer, enter your ADMIN_TOKEN and click Initialize database. This
   creates a table if absent; it does not drop or clear existing data.
6. On Optimize Me, choose your name. The page checks for an online setup
   automatically. Existing local drafts and edits made while checking are preserved;
   use the clearly labelled online-copy button if you want to replace them.
   Complete your troops, limits and heroes, then **Save online & show setup**.
   Missing fields are highlighted. **Preview without saving online** works locally.
7. On another device, choose that name to load the saved setup automatically.
   If an online copy changes during editing, explicitly choose which copy to keep.
8. On Organizer, Review submitted profiles, select desired rows, and Apply
   selected counts. Reopen the alliance optimizer and compare again. Nothing
   automatically replaces the organizer's model before this review.

**Open mode:** anyone can view or change a known player's shared profile by
selecting that name. Names do not prove identity. Numeric validation cannot
verify that plausible troop numbers are truthful. The organizer reviews counts
before applying them to their local model. Existing saved profiles are retained;
legacy edit-code hashes are unused, and issuing player codes is disabled.

The organizer key stays only in current page memory/inputs, not persistent
browser storage. Clear access key or close Organizer when finished. Player data
continues to save locally. Exact tier inventories stay in shared profiles; the
model's aggregate troop/queue/capacity inputs are updated, and its existing tier,
strength, bonus and geometry assumptions remain for review.

## Verification and limits

`GET /health` identifies the deployed Worker but does not test DB readiness.
Initialization and an authenticated save/load test verify the database binding.
Player reads/writes work without credentials. Organizer actions without a valid
key must return 401. An older revision returns 409 instead of replacing newer data.
Saving a player again within 10 seconds returns 429. The write condition enforces
both checks atomically, including simultaneous first submissions.
Load again before resolving a conflict; export unsaved local edits first.

The Worker permits browser requests only from `https://erross.github.io`.
CORS is not authentication: player endpoints are deliberately public, while
organizer endpoints still require the secret. IDs are restricted to the CNQ
roster present when the bundle was generated. Responses use no-store. Bodies
are limited to 20 KB. Only supported hero names/levels and fixed troop fields
are retained; numeric strings become bounded integers, extra fields are dropped,
and malformed values, invalid heroes, duplicate heroes and totals above five
million troops are rejected. The allocation validator also checks stock/capacity
and hero availability. Queries use bound parameters; displayed text is escaped.
Server errors expose no SQL, credentials or raw exception details.

The 10-second cooldown is per player, not a global or per-IP abuse defense.
Open mode does not prevent impersonation or all malicious traffic. There are no
user accounts, edit history or automated identity checks. Platform limits still
apply. Do not share the organizer key with members.

The public Worker URL is configured in `web/cloud-client.js`. Change it if the
account/Worker name changes. ADMIN_TOKEN is set only in Cloudflare. The DB binding
needs no browser-visible database password or Cloudflare API token.

## Updating code

Edit `backend/worker-api.js` and regenerate the pasteable bundle with:

```sh
node scripts/build_cloud_worker.cjs
node tests/check_cloud_backend.cjs
node tests/check_personal_ui.cjs
```

The bundle includes `web/personal-model.js` and current roster IDs. Commit the
regenerated `web/cloudflare-worker.js`, publish the website, and paste/deploy
that module again in Cloudflare. GitHub publishing alone does not deploy the
Cloudflare Worker. Adding new roster IDs also requires a regenerated Worker.

The backend test uses Node 22+ built-in SQLite to exercise real SQL statements,
organizer authentication, open saves, cooldowns, concurrent/stale revisions,
strict validation, legacy data preservation and imports.
It does not substitute for a live Cloudflare test after deployment.
