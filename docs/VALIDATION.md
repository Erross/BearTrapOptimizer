# Validation of version 0.1.0

- Python unittest suite: 17 tests passing, including HTTP integration and invalid-input handling.
- Audited simulated cases reconstruct every troop reservation and assert conservation, slot bounds, rally capacity and unique membership each second.
- Browser/Python parity: 40 complete-output comparison cases pass, including a 25:01 launch being excluded, generation, contribution calibration and all scheduling/allocation/joining modes.
- JavaScript parses successfully. All referenced fixed DOM IDs exist and are unique.
- Dashboard logic smoke checks with a DOM stub: initial comparison, individual selection, disabling normalization, report calibration and applying coefficients, CSV import, custom cadence, search and generated chart/table markup. The earlier server-backed version completed ten real API requests. The current static app also passed these logic checks using the browser engine through a worker stub; this does not validate the browser Worker implementation.
- Default search completes 108 candidate settings, retaining the directly compared scenarios as candidates, in roughly 1.4 seconds in Node for the browser engine and 11 seconds for the Python reference in the development environment. This is not a runtime guarantee for every roster size.
- A real browser visual/interaction check was not completed: the browser engine was unavailable and its download failed in the execution environment. The DOM-stub checks do not verify layout, pointer interactions or actual browser download behavior.
- Actual Kingshot event validation has not occurred. Synthetic scenario gains are not evidence of gains for the alliance.
