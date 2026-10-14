# Owner-only MightPulse import

The manual, owner-only importer publishes a saved snapshot. The public planner
loads that file; opening the app and running comparisons never call MightPulse.

## Use the imported roster

Open the main app and choose **CNQ roster & traps**. The initial plan has all
imported members unassigned and both trap coordinates blank. Enter coordinates
for **Bear trap 1** and **Bear trap 2**, save them, then assign unassigned members
to their nearest trap or select members and apply a group manually. Search,
group filters, page selection and select-all work across the roster. Attendance
and permission to start rallies can also be changed in bulk.

Choose **Compare Bear trap 1** or **Compare Bear trap 2** to graph that group's
attending players. Coordinate travel is a calibrated straight-line estimate:
offset + distance / coordinate units per city width * seconds per city width.
Both leader-to-trap and joiner-to-leader city travel are simulated. The initial
calibration is an assumption; measure marches and adjust it. A per-member
measured trap march takes precedence until their city or that trap moves.

Town Center, account power and positions are imported observations. Troop counts,
tiers, capacities and Attack/Lethality start from the existing illustrative bands
and remain editable estimates. They are not measurements supplied by MightPulse.

Main-page CSV and JSON downloads use the published provider snapshot, not the
simulation roster or the current trap selection. Included player response sections
(`heroes`, `ranks`, `gov_gear`) are retained at their documented top-level location,
along with base-profile details and freshness metadata. Hidden gear and unavailable
sections remain explicitly unavailable. CSV flattens object fields and retains arrays
as JSON cells; the complete JSON download preserves the provider structures.

The browser saves the alliance plan locally. Export/Import plan also preserves
assignments, trap positions, attendance, rally permissions, measured stats,
calibration and added strategies. **Update saved observations** reads the latest
published snapshot; it does not launch a provider refresh. It updates selected
governors, or everyone if no selection exists. Changes are merged by governor
ID, preserving local planning fields. Departed members are retained but excluded.

## Activation

The configured target is **CNQ in Kingdom 2399**. The alliance and kingdom
cannot be changed through workflow inputs or the public app.

1. Merge the implementation into the repository's main branch.
2. In GitHub Settings → Secrets and variables → Actions, create the repository
   secret MIGHTPULSE_API_KEY. Enter the key there, never in chat, source,
   frontend settings, exported plans or URLs.
3. In Actions, run **Owner-only alliance refresh** on main.
   Only Erross (GitHub actor ID 33665337) is accepted. Initial setup requires
   the repository's workflow token to be allowed to write repository contents.
4. Later, enter comma-separated governor IDs to update selected members.
   IDs must exist in the saved roster and the provider's current response.

## Bounded traffic

- The saved JSON snapshot supplies the public planner; no public provider
  refresh endpoint exists.
- No refresh occurs on page load, push, pull request, slider change or simulation.
- The workflow and Python importer both check owner, repository and main branch.
- Full refresh reserves at most 102 requests for 100 profiles and one board.
- Starts are paced at at most 50 requests/minute with five concurrent lookups.
- One-hour cooldown and a 500-request/day UTC application budget are enforced.
- The complete upper-bound reservation is committed and pushed before any
  provider request. If that durable write fails, no provider request occurs.
- The same workflow attempt cannot reuse its reservation. Failures still consume
  the reserved budget. There are no automatic provider retries.
- A source-controlled recovery_attempt may authorize one exact rerun of a known
  failed first attempt during the cooldown. It requires that first attempt to be
  the latest recorded run on the same UTC day, and charges another complete
  reservation. Other runs and attempts remain blocked. Clear the grant after
  recovery; there is no workflow input or public control for it.
- A fixed Actions concurrency group serializes imports. Quota reservation remains
  durable if the runner fails or is terminated.
- A successful refresh is published at web/data/alliance-api.json.
  The old published snapshot remains available if the refresh fails.

The quota ledger lives at .api-state/mightpulse-budget.json. It contains
timestamps, request reservations and workflow IDs; no credentials. Do not delete
or reset it during operation. These caps govern this importer, not other use of
the same MightPulse key outside the application.

## Data and deployment boundaries

The repository and Pages site are public. Successful snapshots contain public
in-game roster/profile observations, including city coordinates. This is an
API-usage gate, not private alliance-data hosting. Keys and HTTP authentication
headers are never published. Unknown top-level profile fields are omitted;
credential-shaped fields and occurrences of the actual key are stripped from
the saved output. Redirects are refused. Requests identify the application with
a BearTrapOptimizer User-Agent; MightPulse rejected Python's default client
header with HTTP 403 during integration testing.

The importer rejects unexpected kingdoms/tags, oversized or duplicate rosters,
unknown selected IDs and mismatched governor profiles. Governor IDs are used
explicitly; internal UIDs are not interchangeable. Snapshots preserve the
provider's freshness metadata and status of unavailable profiles.

Planner assignments, Bear trap 1 / Bear trap 2 coordinates and manually measured
stats are saved in separate user planning data. The dashboard merges API
observations by governor ID while preserving those fields.

The import workflow deploys the updated web directory itself because commits
made with GITHUB_TOKEN do not ordinarily trigger the separate Pages push
workflow. No deployment occurs when the import is disabled or fails.

## Future in-app refresh and user-supplied keys

An in-app refresh needs a server-side authentication gate. Cloudflare Access with
an owner allowlist and server validation of the Access JWT is one option.
Use a server secret for the shared provider key, durable atomic budgets and a
single refresh job shared by duplicate clicks. A hidden button, CORS check or
frontend password does not authorize a refresh.

For user-supplied keys, the service must authenticate the user and use their key
only for their refresh jobs, with no fallback to the owner key. Start with
session-only handling. Persistent storage requires encryption at rest with a
separate server-held encryption key, tenant authorization, redacted logging and
explicit revoke/delete controls. API keys must not be exported with plans.
Direct browser-to-MightPulse access is an alternative only if the provider
supports browser CORS; this has not been verified.

Local tests use a dummy key and exercise the security and budget gates. Live
provider requests run only through the owner-gated Actions workflow, with the
real key retained in the private Actions secret.

Live verification on 2026-10-12: the API returned 98 CNQ roster members, and all
98 profiles and city coordinates were saved using 100 provider requests. Both
the import and Pages publication succeeded. The one-time recovery grant was
cleared after use; the failed and successful reservations remain charged.

Live export verification on 2026-10-14: the owner refresh saved 100 members using 102 provider requests. Requested top-level sections were retained for 100 hero responses, 100 ranking responses and 100 governor-gear responses. Main-page CSV and JSON downloads were verified against the saved roster; unavailable/hidden values remain provider observations rather than simulated estimates.
