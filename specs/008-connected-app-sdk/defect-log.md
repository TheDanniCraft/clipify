# Defect log

| ID       | State                             | Cause and resolution                                                                                                                                                                          |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-001 | Fixed, native regression verified | Eager policy DB import initialised the pool before fixture configuration. Import only after verified administrator; 75 real OAuth/search/account-export regression tests pass.                |
| AUTH-002 | Fixed, real provider verified     | Empty redirect URI array rejected for machine client; omit the field. Add failed-grant compensating client deletion.                                                                          |
| SDK-001  | Fixed, package/runtime verified   | Bun versions produced different archive metadata/integrity. Deterministic standard-library packaging and frozen install verified.                                                             |
| NET-001  | Fixed, runtime verified           | Initial one-project topology did not prove independent deployment. Two actual Compose projects now pass with separate private databases and denied cross-database access.                     |
| TDD-001  | Disclosed delivery exception      | Initial Awards CLI prototype preceded its first 11 tests. Passing characterization does not prove test-first history. Strict verification remains FAIL; no historical evidence is fabricated. |

Setup-only failures (mock reuse/matrix syntax, PGlite fixture callback) are excluded from intended Red evidence. No production/shared development database was used or changed.

CI-001 fixed locally: OAuth discovery/startup and mandatory-gate fixtures assumed the pre-application resource topology. Exact two-resource assertions and explicit connected-app gate refusal preserve the real guarantees; 26+11 tests pass. Full current-source CI remains required.

On 2026-11-16, after disclosure that the initial CLI was test-after and strict TDD
verification remains FAIL, the project owner requested merging or preparing PR569
for merge. Merge preparation proceeds under that disclosed delivery exception.
The original verification is retained unchanged; this is not a test-first pass.

The separate Awards app is now deployed under Test with its own persistence and
private media. Its UI/provider completeness is outside the bounded SDK gateway
merge. In particular, Twitch polls/predictions are not gateway operations.
