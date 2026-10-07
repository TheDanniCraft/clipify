# Test Summary Report: MCP Support

Updated: 2026-10-07. Branch: `feature/mcp-support`. Canonical SpecKit feature: `003-mcp-support`.

## Current combined status

**543/557 tasks complete (97.5%, unweighted task count, not shipping readiness).** The 136 workflow expansion tasks are included as T406–T541. The original 14 historical/external tasks remain unchecked with their exact blockers in [blockers.md](blockers.md); consolidation neither closes nor waives them.

All **50 MCP tools** are implemented: the original 15 overlay/playlist/capability tools plus 34 remote-control, discovery/import, gallery/embed, Creator Page and runner tools and one user-requested feedback tool. Native Better Auth/MCP/OAuth 1.7.7 and official MCP SDK 2.3.0 remain the underlying stack.

The original scope has 709 local MCP and 86 existing browser acceptance cases with retained evidence. The expansion has 320 unique workflow Gherkin examples with passing evidence. These inventories are reported separately; reruns and overlapping native checks are not added as unique cases. Final strict coverage passes for all 91 required MCP source files, and unchanged Jest global/gallery thresholds pass (`test-results/mcp-workflows/shared-feedback-coverage-complete.log`, `coverage/mcp-shared-feedback-complete/strict-gate.json`). Types, scoped lint, formatting, production build, 91-file action manifest, migration-policy checks, scheduler checks and Graphify refresh pass.

The final broad regression invocation retained 4,435 passes, five failures in four outdated expectations, and 11 auth skips. All four suites have passing focused compatibility reruns; all 11 auth cases passed on a disposable loopback PostgreSQL fixture. The original invocation is not relabeled green. Two expansion product defects—session audit target identity and within-page duplicate provider clips—have retained Red and Green evidence.

## Remaining blockers and recommendation

Local implementation is ready for review. Release remains **No-Go** for the original named-host/public-HTTPS journeys and historical test-first evidence obligations recorded individually in [blockers.md](blockers.md). Physical runner installation/enrollment, real broadcasting and device snapshots additionally require supported hardware and streaming credentials; local API/control/upload paths pass, but actual hardware operation is not claimed. Repository migration/deployment prerequisites also remain applicable. Marketplace/directory submission belongs to a later PR.

## Evidence history

- [Original foundation verification snapshot](history/core/test-summary.md), preserved before consolidation.
- [Workflow expansion verification snapshot](history/workflows/test-summary.md), with its exact execution counts and log paths.
- [Combined traceability and gates](test-traceability.md).
- [Combined defects](defect-log.md) and [test-first cycle evidence](tdd/cycle-log.md).

No migrations were generated, and no changes were committed, pushed or deployed.

## Feedback tool verification

The submit_feedback tool is part of this feature (T542–T549). It uses the existing creator:read permission, requires explicit confirmed user intent, and is available on Free. Reports use the installed Sentry SDK and the same feedback product as the browser widget. The quota and replay state are RAM-only: five distinct reports per verified user per fixed 24-hour window starting with the first accepted report across clients/creators on one server process. Live user budgets and retry aliases are bounded; restarts clear the state and replicas maintain independent budgets. No feedback table or migration was added.

**16 actual OAuth/MCP feedback acceptance examples passed** (`feedback-bdd-complete.log`), making 336 unique workflow/feedback Gherkin examples when combined with the separately retained 320 workflow examples. Tests exercised the real installed SDK using a controlled local transport; **no test feedback was sent to the real Sentry account**. All external feedback envelopes were collected only in the fixture. No automatic transcript, replay, screenshot or email is sent, and message content is absent from activity metadata. Replies identify SDK queuing, not guaranteed delivery.

Scoped verification: 179 compatibility tests across 9 suites passed (`feedback-compatibility.log`); 25 public-label/component checks passed (`feedback-labels-green.log`); all 8 current RAM-quota/replay tests passed (`feedback-memory-final.log`). These totals overlap and are not summed. Contract and actual-handler missing-tool Red preceded implementation. Rolling-window and replay-alias defects each have retained Red before their fixes. Current types, lint, production build, action manifest and unchanged strict/global coverage gates pass. Partial-scope Jest reports show untouched unrelated application files at zero; the final aggregate applies the original global/gallery thresholds unchanged and excludes stale counters for changed files.

Evidence: all named logs are under test-results/mcp-workflows; final coverage is coverage/mcp-feedback-complete. The original 14 blocked tasks remain unchanged. No commit, push, deployment or real Sentry feedback submission was performed.

## Shared limiter refinement — current checkpoint

Feedback quota uses the existing application rate-limiter-flexible infrastructure through src/server/rate-limit.ts. The application server-action facade delegates to that core; feedback keeps only bounded receipt/digest/retry state. No custom feedback counter remains. The library enforces five reports per verified user in a fixed 24-hour window from the first accepted report. Authentication and the existing distributed MCP transport limiter remain unchanged.

Current evidence: 30 focused app/replay/contract tests pass; 17 actual OAuth/MCP feedback scenarios pass (shared-feedback-bdd-verified.log). This makes 337 unique workflow/feedback examples, replacing the earlier 336 checkpoint. Current types, scoped lint/format, production build and 91-file action manifest pass. Sentry SDK envelopes use the local fixture transport; no real account feedback is created. Strict coverage is refreshed against 91 required source files, excluding stale changed/deleted source counters and preserving global/gallery thresholds. Final gate result is recorded in shared-feedback-coverage-complete.log. Graphify refresh completed (7176 nodes, 15868 edges, 322 communities).

Correction evidence remains visible: the first type/build attempt exposed a test-script global Cache collision, corrected by making the test a module. A misnamed probe-directory environment variable selected an uncompiled test path; the corrected instrumented actual-handler run passed all 17 cases. The initial coverage aggregate missed the new shared core in Jest collection; its collection entry was added before final verification. These were addressed locally; no new external blocker was introduced. Earlier evidence rows are historical checkpoints. The original 14 blocked tasks remain unresolved.

## MCP without an activation toggle — current checkpoint

The user rejected activation environment flags. MCP configuration has no enabled property, native Better Auth plugins are always registered and discovery is no longer hidden with 404. Credentials, canonical origins, authorization and schema-readiness remain enforced; invalid required configuration/schema returns 503. The OAuth route imports Auth after readiness validation, avoiding eager resource seeding before a guarded rejection.

156 affected unit checks pass. 81 configuration/OAuth/discovery contract checks plus 3 additional invalid-configuration discovery checks pass (84 checks in this scope). Types, changed-file lint/format, production build, 91-file action manifest and Graphify refresh pass. Strict coverage passes all 91 required files and unchanged global/gallery thresholds (no-toggle-coverage-complete.log, coverage/mcp-no-toggle-complete/strict-gate.json). Changed source counters from the previous checkpoint are excluded. Genuine two-test Red is retained in no-toggle-red.log; additional route checks characterize the final boundary.

The former full pre-push run (4495 passed, 11 skipped) remains historical evidence. This small initialization/configuration refinement uses focused verification rather than rerunning that 41-minute full suite; GitHub CI checks the updated PR separately. Original external/historical blockers remain unchanged.

Node 24 preview correction: discovery 200 revealed a POST-only runtime failure in framework-proxied Request reconstruction. Genuine Red and Green evidence plus 21 passing Node-24 adapter checks, actual production-Next POST 401, build and 91-file strict/global coverage are retained under node24-* logs. The prior full run on activation-toggle removal passed 416 suites / 4488 tests with 11 existing skips; the correction's normal pre-push run is recorded separately after completion.

CI follow-up: the no-toggle revision's full GitHub Jest run passed all 4488 tests but strict coverage failed because the complete command omitted native workflow/feedback journeys. The complete coverage command now executes those journeys and merges their fresh counters; scoped Jest commands remain scoped. The browser job exhausted the Next development compiler's roughly 4.8-GiB heap during the ten-case first ATDD half. The browser gate now restarts between four ATDD/BDD shards on machines with under 16 GiB available memory, retaining every case. Native integration and CI-sized browser verification are running; their final results belong in the PR evidence, not a premature Green claim.
