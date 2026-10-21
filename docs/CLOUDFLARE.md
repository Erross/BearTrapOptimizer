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
6. Choose a member and confirm code issuance. Save the returned player code and
   privately give it to that player. Issuing again invalidates their old code
   while preserving the profile. The server stores only a hash of the code.
7. On Optimize Me, choose that name, enter the private player code, and Load
   shared profile. If none exists, the entered local setup remains. Complete
   a valid setup, then Save online. Loading an existing setup replaces local
   form entries. Export a local draft first if you need to preserve both.
8. On a second device, choose that name and load with the same player code.
9. On Organizer, Review submitted profiles, select the desired rows, and Apply
   selected counts. Reopen the alliance optimizer and compare again. Nothing
   automatically replaces the organizer's model before this review.

The organizer key and player code are held only in the page's current memory and
inputs, not persistent browser storage. Player profile data continues to save
locally. Clear access key or close Organizer when finished. Codes are bearer
credentials: anyone possessing one can use its access. Lost codes are replaced,
not recovered. The model's aggregate troop/queue/capacity inputs are updated;
its existing tier, strength, bonus and geometry assumptions remain for review.

## Verification and limits

`GET /health` identifies the deployed Worker but does not test DB readiness.
Initialization and an authenticated save/load test verify the database binding.
Unauthenticated profile reads/writes must return 401. A different player's code
must fail. An older revision must return 409 instead of overwriting newer data.
Load again before resolving a conflict; export unsaved local edits first.

The Worker permits browser requests only from `https://erross.github.io`.
CORS is not authentication; every data request also requires an organizer or
player credential. IDs are restricted to the CNQ roster present when the
bundle was generated. Responses use no-store, writes validate the same full
setup as the client, and request bodies are capped at 20 KB. Queries use bound
parameters. Server errors return no SQL, credentials or raw exception details.
The long random codes resist guessing; this first version does not include
user accounts, email recovery, a custom abuse rate limiter or an audit history.
Cloudflare platform limits still apply. Do not expose the organizer key to members.

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
authentication, key rotation, stale revisions, body validation and imports.
It does not substitute for a live Cloudflare test after deployment.
