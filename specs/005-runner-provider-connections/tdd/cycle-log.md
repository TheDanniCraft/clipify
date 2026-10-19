# Development evidence

2026-10-19, whole-file development commands, no coverage:

- PC-1/3: provider-contract.test.ts initially failed because the contract module did not exist; then 4 cases passed (combined permissions, unchanged login scopes, offline YouTube grant, inherited title and validation).
- PC-1/2/4/6: provider-api.test.ts initially failed because the provider API module did not exist; then 5 cases passed (fixed endpoints, token exchange, channel identity, minimal metadata patch, bounded/sanitized failures).
- PC-6: provider-callback.test.ts initially failed because the callback route did not exist; then 2 cases passed (session requirement, no secrets in response, same-origin opener and restrictive CSP).
- PC-1/2/3/4/5/6: provider-connections.test.ts uses disposable real PostgreSQL with the existing fixture schema builder. Authorization is mocked here; authenticated browser acceptance owns composed authorization evidence. Each storage behavior was added and observed failing before implementation: state binding/replay/expiry; connected encrypted destination save; event-detail persistence and selection validation; due metadata application; private test output; refresh-token survival after downstream denial. Missing fixture email/actor rows were setup failures and were corrected, not counted as product Reds. The additional signed test-deadline assertion is a completion check, not claimed as a separate test-first cycle.
- PC-1/6: runnerProviderConnection.test.tsx failed against the old editor, then passed with the contextual connection action. Mocked controls do not constitute browser UX acceptance.

Latest whole-file commands and completion results are recorded in verification.md after the actual checks finish. No live provider credentials or shared databases are test fixtures.

Completion review additionally reproduced and corrected two category edge cases: the strict schedule contract rejected the UI's category display label (provider-category-label-red.log), and clearing a category retained that label (provider-category-clear-red-corrected.log). The first clear-label test queried a combobox in the repository's mocked HeroUI unit environment and failed for that test-setup reason; it is not claimed as the product Red. The corrected clear-label test failed on the stale label itself. Contract/database tests then passed 63 cases; the UI whole-file test passed both cases. The label is retained only for editor display and never included in the provider metadata patch.

Final completion gates were restarted after these corrections so evidence does not mix changed execution inputs. Earlier interrupted runs are diagnostic evidence only, not completion passes.

The complete application run exposed a genuine optional-loading regression in both existing cleanup-disabled cases: production-mode MCP-off route import eagerly loaded provider encryption and required a secret before any provider operation. The existing failing test is the regression Red. Keep display result schemas in the pure contract and load grant/metadata services only on the connected-provider path. The complete cleanup-disabled, provider-contract and provider-connections files then passed 65 cases without adding an encryption secret to that test environment. Do not treat the interrupted pre-correction coverage report as completion evidence.
