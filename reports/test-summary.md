# Rolling Test Summary

**Mode**: rolling
**Last Updated**: 2026-10-07

## Included Feature Reports

| Feature                             | Status                                                                 | Recommendation                                                                | Feature Evidence                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Creator Identity and Access Rewrite | Green for merge                                                        | Go to merge; No-Go to deploy pending T217–T218                                | [Feature test summary](../specs/002-auth-engine-rewrite/test-summary.md)                                                      |
| Local Legal Compliance              | Referenced baseline                                                    | See feature report                                                            | [Feature test summary](../specs/001-local-legal-compliance/test-summary.md)                                                   |
| Clipify MCP Support                 | Local behavior/quality Green; external and historical evidence Blocked | No-Go for release pending named hosts and original test-first evidence review | [Feature test summary](../specs/003-mcp-support/test-summary.md), [individual blockers](../specs/003-mcp-support/blockers.md) |

## Aggregate Decision

MCP support implements all 15 tools with native Better Auth/MCP/OAuth 1.7.7 and official MCP SDK 2.3.0. All 709 local MCP examples and 86 existing acceptance/ATDD/BDD/compliance cases pass; full regression plus exact repairs meets source/global coverage, normal build/runtime, lint/types/audit and mutation gates. Final document verification passes. MCP release remains No-Go: four real-host journeys require unavailable accounts/HTTPS deployment, and twelve original chronology/retention task obligations require explicit evidence review. Current passing behavior is not a fabricated historical Red or named-host acceptance.

The auth rewrite's implementation, security audit, behavior suites, changed-code coverage gate, performance checks, production configuration audit, production data invariants, and prior cutover rehearsals are Green. The branch is ready to merge so the repository-owned workflow can generate the final migration. Deployment remains blocked until that generated SQL is reviewed and rehearsed on a fresh production snapshot (T217), followed by the fresh-backup, stopped-runtime, post-apply invariant/smoke, and explicit-reopen production gate (T218).

## Current Aggregate Snapshot

| Area                       | Result                                                                                                  | Evidence                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Executable behavior        | Green — 61 BDD, 19 ATDD, 4 acceptance, and 2 compliance examples                                        | [Auth feature execution summary](../specs/002-auth-engine-rewrite/test-summary.md#execution-summary)       |
| Repository regression      | Green — 195 suites and 1,704 tests                                                                      | [Auth quality gates](../specs/002-auth-engine-rewrite/test-traceability.md#quality-gate-results)           |
| Agency billing             | Green — 5 negotiated-capacity browser examples and focused Stripe policy tests                          | [Auth agency evidence](../specs/002-auth-engine-rewrite/test-summary.md#us4-agency-evidence)               |
| Retained Pro resources     | Green — non-destructive read/delete retention with update/runtime capability restrictions               | [Auth lifecycle evidence](../specs/002-auth-engine-rewrite/test-summary.md#us5-retained-resource-evidence) |
| Migration safety           | Green — 94 database-backed migration tests and two full rehearsals                                      | [Auth migration evidence](../specs/002-auth-engine-rewrite/test-summary.md#us6-cutover-evidence)           |
| Coverage and quality gates | Green — focused adapters pass at 93.50% branches and at least 98.12% for other metrics                  | [Auth traceability gates](../specs/002-auth-engine-rewrite/test-traceability.md#quality-gate-results)      |
| Deployment readiness       | Pending — generated migration review/rehearsal and operator cutover gates T217–T218                     | [Auth release recommendation](../specs/002-auth-engine-rewrite/test-summary.md#release-recommendation)     |
| Defects and risk           | Zero open Critical/High; two non-product tooling deferrals, including one scoped no-fix audit exception | [Auth defect report](../specs/002-auth-engine-rewrite/defect-log.md)                                       |

**Recommendation**: Go to merge for migration generation; No-Go to deploy until T217–T218 are completed with retained evidence.

## MCP Current Local Snapshot

| Area                   | Result                                                                                                                   | Evidence                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Local behavior         | 709 MCP and 86 existing browser cases Green; original failures and exact repairs retained                                | [MCP summary](../specs/003-mcp-support/test-summary.md#execution-summary)              |
| Source/global coverage | Every required MCP source threshold passes; unchanged global thresholds pass                                             | [MCP traceability](../specs/003-mcp-support/test-traceability.md#quality-gate-results) |
| Build/auth             | Normal config build, action manifest, seven runtime HTTP checks and actual SDK/browser consent/read/mutation/revoke pass | [MCP gates](../specs/003-mcp-support/test-summary.md#quality-gates)                    |
| Dependencies           | Better Auth adapters1.7.7, no Better Auth patch; sharp0.35.5 high-audit/image/build checks Green                         | [MCP report](../specs/003-mcp-support/test-summary.md)                                 |
| External/history       | Fourteen individual blocked tasks; no release approval or production migration performed                                 | [Exact blockers](../specs/003-mcp-support/blockers.md)                                 |

Existing auth rewrite production T217–T218 ownership/reopen requirements remain unchanged. MCP schema sources are edited only; ordinary migration generation remains owned by the post-merge master workflow.

## Consolidated MCP workflows (003)

All 136 local follow-up tasks are complete: the combined server now exposes 49 tools, including live remote control, clip discovery/import preview and confirmation, galleries/public embeds, Creator Pages, and entitlement-aware runner setup/configuration/control/snapshots. All 320 unique workflow acceptance examples have passing evidence. Final unchanged strict MCP coverage thresholds pass for every required source; source-frozen build, 91-file server action manifest, types, lint, formatting, migration-policy and bounded scheduler checks pass. Graphify is refreshed. See [follow-up evidence](../specs/003-mcp-support/test-summary.md) and [traceability](../specs/003-mcp-support/test-traceability.md).

The broad regression invocation retained 4,435 passes plus five failures in four outdated expectations and 11 auth skips; each failing suite passed a scoped compatibility rerun, and all 11 auth cases passed on a disposable loopback database. The original broad invocation is not relabeled green. The follow-up is ready for local implementation review; branch release remains No-Go for the existing real-host/public-HTTPS, hardware and historical evidence obligations, plus the repository's migration/deployment prerequisites. Marketplace submission remains a separate later PR.

## SpecKit consolidation

`003-mcp-support` is the single canonical MCP-server feature. Its combined task list is 527/541 complete (97.4% unweighted), including all 136 workflow expansion tasks as T406–T541. The original 14 blocked tasks remain unchanged. The original `004` artifacts are preserved under `003/history/workflows/`; no separate active `004` feature remains. Current tool count is 49; previous 15-tool statements above describe the retained foundation checkpoint.

## MCP feedback addition

Canonical feature 003 now has 50 tools and 535/549 tasks complete; the original 14 blockers remain. User-requested submit_feedback uses existing creator:read permission and RAM-only rolling quota/replay state, without new tables/migrations. All 16 real OAuth/MCP feedback examples pass; tests use the real Sentry SDK with a local-only transport and emit no actual Sentry feedback. The workflow/feedback Gherkin inventory is 336 examples (320 plus 16). Scoped compatibility/UI/memory checks, final production build, types/lint and strict coverage for all 90 required source files pass. See the [current canonical summary](../specs/003-mcp-support/test-summary.md#feedback-tool-verification). Previous 49-tool/541-task entries remain historical checkpoints.

## MCP shared application limiter checkpoint

539/553 tasks complete (97.5% unweighted); 14 original historical/external blockers remain. Feedback uses the existing app rate-limiter-flexible core, with separate business replay state only. 30 focused tests and 17 actual OAuth/MCP feedback examples pass. Final strict/global coverage, types/lint/format/build/action-manifest and Graphify evidence is in specs/003-mcp-support/test-summary.md and test-results/mcp-workflows/shared-feedback-*.log. This is local implementation readiness, not a waiver of release blockers. No test feedback is sent to the real Sentry account.

## MCP activation flag removal

542/556 tasks complete; 14 original blocked obligations remain. MCP/native OAuth/discovery are always installed. 156 unit and 84 affected OAuth/configuration/discovery checks pass, as do strict/global coverage (91 files), types/lint/format/build/action manifest. No activation environment toggle remains. See the canonical feature test summary for current evidence; the previous full 4495-test checkpoint is historical after this refinement.
