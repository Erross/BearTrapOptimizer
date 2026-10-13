# CNQ roster and Bear trap planning

## Use the roster

The published dashboard reads `web/data/alliance-api.json` once at startup. This
is the previously saved MightPulse import, not a provider refresh. The initial
snapshot contains 98 CNQ members from Kingdom 2399, including city coordinates.

1. Open **View roster & assign traps** on the front page.
2. Enter X/Y coordinates for **Bear trap 1** and **Bear trap 2**, then save.
3. Assign each member through its assignment menu, or select members and apply
   a bulk assignment. “Assign unassigned to nearest trap” keeps existing manual
   assignments. The selected-member version explicitly reassigns its selection.
   Equal distances and missing positions are skipped rather than guessed.
4. Tick attendance for this event.
5. Return to the front page and select **Bear trap 1** or **Bear trap 2** under
   **Compare strategies for**. Each group gets the same six starter approaches
   and any added strategies, calculated only for its attending members.
6. Use the member's **Edit / measured travel** button for measured travel, or
   **Edit troops, limits & bonuses** for the existing player detail editor.

“All members” and “Unassigned members” are explicitly hypothetical single-trap
scenarios. They do not simulate interaction between two simultaneous events.
A group without members or without its trap coordinates cannot be compared.
Neither trap is invented or assigned automatically before entering coordinates.

## Observed and estimated data

Names, Town Center levels, power, city coordinates, snapshot time and profile
freshness originate in the saved import. The dashboard treats governor ID as
identity; internal UID and nickname are not identity keys. Those observed fields
are read-only in the player editor.

Stocks, tiers, march/rally capacities and leader bonuses initially interpolate
from the illustrative band assumptions in `web/alliance-profiles.json`. This
is a starting scenario, not a verified power-to-troops formula. Power and Town
Center do not directly multiply damage. Manually entered overrides survive
subsequent imports. Unchanged assumptions remain estimates; entering troop
counts records all three type counts and their total together.

For trap-specific comparisons, outbound and return host travel are estimated as:

`fixed overhead + straight-line coordinate distance / city-width units * seconds per city width`

The default calibration (2 units per city width, 4 seconds per width, 2 seconds
fixed overhead) is adjustable and unverified. The position map is descriptive,
not a game pathfinder. It does not model terrain, march speed buffs or collisions.
Measured outbound/return times take priority. Measurements carry a fingerprint
of both city and trap coordinates and expire when either moves. Without positions,
a user-entered fallback ring can supply an estimate. Without positions or ring,
the simulation uses the player's existing travel assumption.

Joining travel uses member-to-host coordinate distance, not distance to the
bear. A manually entered generic joining-travel value overrides coordinate
estimates for that member. Both engines accept a bounded, directed per-host
`mechanics.join_travel_times` matrix; arrival must precede rally departure.
Travel up to 3,600 seconds is allowed; distant troops may fail to reach a rally
or score before the event ends. Values are never silently clamped to 300 seconds.

## Persistence and refresh

`web/alliance-model.js` validates and merges observations; it contains no network
calls. `web/alliance-ui.js` connects this model to the existing editors and worker.
The active comparison roster is compiled from this plan; assignments do not live
in a nickname-keyed engine row. API snapshots do not contain local assignments.

The local plan uses schema `bear-alliance-plan`, version 1, stored under
`bear-cnq-plan-v1` in localStorage. It holds coordinates, calibration, assignments,
attendance, rally permission, measured travel and entered stat overrides. Download
**CNQ plan (.json)** to share or back it up. **Save alliance file** includes this
plan alongside the existing controls, reports and added strategies. No credentials
are included. Browser saving failures are shown with a download fallback.

**Reload saved import** downloads the published JSON again and merges by governor
ID, preserving planning choices and measured values. It does not run the owner
refresh workflow or consume provider requests. Former/unavailable members remain
in the plan but are excluded from comparisons. New members start unassigned.
The import workflow's existing ownership, cooldown and budget gates are unchanged.

## Validation

Run Python unit tests, browser/Python parity checks, dashboard state checks and
`node tests/check_alliance_model.cjs`. Coverage includes the 98-member snapshot,
bulk assignments, destination-specific joining arrival, measured travel and its
expiration, renamed/removed members, troop/detail override persistence, export /
import round trips, invalid plans and fallback to illustrative rosters.
