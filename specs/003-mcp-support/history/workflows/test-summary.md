# Test summary: MCP workflows

## References

[Plan](plan.md), [traceability](test-traceability.md), [defects](defect-log.md).

## Execution

In progress. Five remote tools implemented; 39 full actual OAuth/MCP HTTP BDD scenarios passed in 1.5 minutes with automatically budgeted parallel workers. Scoped TDD includes 40 catalogue, 3 runtime-state, 9 link-parser and 16 remote-entry cases, with retained Red/Green logs. These overlap acceptance intents and are not summed as unique acceptance cases. Original 003 results remain separate. Coverage and remaining stories are pending.

## Recommendation

Go for local implementation review; No-Go for external release until the separately recorded real-host and physical-runner validation is available.

## Current verified checkpoint

All 34 workflow adapters have scoped Red/Green evidence in `tdd/cycle-log.md`. Acceptance executions: remote 39, discovery/import 25, galleries/embeds 53, Creator Pages 15 passed (132 cases total). Runner acceptance is in progress. Browser integration, coverage, types, documentation and final release gates are still pending; this checkpoint is not a shipping approval.

Runner acceptance: 70 passed, retained in `test-results/mcp-workflows/runner-acceptance.log`; total five-story acceptance 202 passed. Type gate passed. All adapter scope cycles Green; complete affected regression running. Shared browser write integration and final quality gates still pending.

## Strengthened acceptance and build checkpoint

The actual MCP workflow BDD/ATDD owning suite passed all 207 cases (`test-results/mcp-workflows/bdd-final.log`). Positive cases assert tool-specific outputs and selected effects; the new cases cover supported public embed formats and missing/offline/unassigned snapshot results. Native secondary-scope tests passed three cases (`secondary-scopes.log`); input boundary characterization passed 28 cases (`input-boundaries.log`). TypeScript, production build, server-action manifest, scoped lint, corrected formatting and migration policy passed. Full regression/strict coverage and Graphify are running; final readiness remains No-Go until all required local gates pass. Real named AI-host OAuth over public HTTPS and physical runner installation/broadcast require external accounts/devices and are not claimed.

## Expanded acceptance checkpoint

The additional authority, boundary, foreign ownership, pagination and detailed option inventory contains 113 examples. Initial execution passed 108 (`bdd-delta.log`); the remaining five passed after correcting test-only contrast expectations and fixture table names (`bdd-options-corrected.log`). Combined with the 207 earlier examples, all 320 unique workflow acceptance examples have passing evidence. The broad regression retained 4,435 passing tests, five failures in four legacy-expectation suites and 11 skipped auth cases; all four suites have focused passing reruns, and all 11 auth cases passed on a disposable loopback PostgreSQL fixture. Two production defects found during expansion—stream-session audit target selection and within-page duplicate provider IDs—have retained Red and Green evidence. Scoped workflow coverage collection is running; strict coverage and final source-frozen build/reports remain required. Recommendation remains No-Go.

## Final local verification

All 136 follow-up implementation tasks are complete. The server exposes 49 tools (15 original plus 34 workflow tools), with native Better Auth OAuth/DCR and the official MCP SDK. All 320 unique workflow Gherkin examples have passing evidence. The affected workflow/scheduler run passed 242 of 243 tests; its single new assertion defect passed in the focused 3-case rerun. The final queue/browser-playlist boundary run passed 19 of 20 tests; its expiry fixture defect passed as the selected remaining case. All 10 final malformed-input/lock-wait playlist cases passed. These execution totals overlap and are not added as a unique test count.

Strict coverage passes for every required MCP source file in `coverage/mcp-workflows-aggregate/strict-gate.json`. Counters combine the retained full regression with scoped actual-handler/native executions. Old full-run counters for the two changed production files, workflow.ts and clip-discovery.ts, were excluded. Per-scope Jest coverage checks intentionally see unexercised unrelated application files; final aggregate thresholds are applied unchanged. Full regression evidence remains accurately retained as 4,435 passes, five legacy-expectation failures in four suites, and 11 auth skips; each failing suite has passing focused compatibility evidence, and all 11 auth cases passed on the disposable database fixture. No claim is made that the original full invocation was rerun entirely green.

TypeScript (`typecheck-last.log`), scoped lint (`lint-delta.log`, `lint-last.log`), formatting, production build (`build-delta.log`), server action manifest (91 files, `action-manifest-delta.log`), migration-policy checks (11, `migration-policy-final.log`), scheduler tests and Graphify refresh pass. All defect-log entries have scoped verification; no known local product defect remains open.

### External validation deferred

- Named ChatGPT/Claude/custom hosted-client connection journeys: require usable host accounts and a deployed publicly reachable HTTPS Clipify endpoint. Local OAuth registration, consent, scopes, quota enforcement, SDK transport and revocation are verified; real host acceptance is not claimed. See `specs/003-mcp-support/blockers.md` for the original individual journeys.
- Physical runner installation/enrollment, broadcast and live device snapshot: require an actual supported machine, enrollment and streaming credentials. Local provisioning/configuration/control and real API snapshot-upload paths are tested; no real stream was started.
- Original feature 003 historical test-first chronology obligations require the evidence review documented in that feature; current passing tests do not fabricate earlier Red evidence.

Marketplace/directory submission is deliberately excluded from this PR and belongs to the later PR the user requested. No migrations were generated, and no changes were committed, pushed or deployed. Recommendation: local implementation ready for review; external release remains No-Go until the above validation and existing migration/deployment prerequisites are fulfilled.
