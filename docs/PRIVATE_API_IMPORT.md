# Owner-only MightPulse import

This first phase adds a manual, owner-only data importer. It does not activate
live API requests in the public planner, and does not yet wire the coordinate
planner preview into the published dashboard.

## Activation

1. Merge the implementation into the repository's main branch.
2. Set the exact, case-sensitive alliance_tag in scripts/mightpulse-policy.json.
   Kingdom 2399 and owner identity are fixed. The default null tag disables
   all provider traffic.
3. In GitHub Settings → Secrets and variables → Actions, create the repository
   secret MIGHTPULSE_API_KEY. Enter the key there, never in chat, source,
   frontend settings, exported plans or URLs.
4. In Actions, run **Owner-only alliance refresh** on main.
   Only Erross (GitHub actor ID 33665337) is accepted. Initial setup requires
   the repository's workflow token to be allowed to write repository contents.
5. Later, enter comma-separated governor IDs to update selected members.
   IDs must exist in the saved roster and the provider's current response.

## Bounded traffic

- Public visitors load a saved JSON snapshot; no public refresh endpoint exists.
- No refresh occurs on page load, push, pull request, slider change or simulation.
- The workflow and Python importer both check owner, repository and main branch.
- Full refresh reserves at most 102 requests for 100 profiles and one board.
- Starts are paced at at most 50 requests/minute with five concurrent lookups.
- One-hour cooldown and a 500-request/day UTC application budget are enforced.
- The complete upper-bound reservation is committed and pushed before any
  provider request. If that durable write fails, no provider request occurs.
- The same workflow attempt cannot reuse its reservation. Failures still consume
  the reserved budget. There are no automatic provider retries.
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
the saved output. Redirects are refused.

The importer rejects unexpected kingdoms/tags, oversized or duplicate rosters,
unknown selected IDs and mismatched governor profiles. Governor IDs are used
explicitly; internal UIDs are not interchangeable. Snapshots preserve the
provider's freshness metadata and status of unavailable profiles.

Planner assignments, Bear trap 1 / Bear trap 2 coordinates and manually measured
stats belong in separate user planning data. A subsequent dashboard integration
should merge API observations by governor ID while preserving those fields.

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

Live provider access has not been tested because no alliance tag or key has
been supplied. Local tests mock HTTP and exercise the security and budget gates.
