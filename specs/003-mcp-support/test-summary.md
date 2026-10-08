# Test Summary Report: MCP Support

Updated: 2026-10-08. Branch: `feature/mcp-support`. Canonical feature: `003-mcp-support`.

## Current combined status

**585/586 tasks closed (99.8%, unweighted; not a shipping-readiness percentage).**
All 66 MCP tools and six optional prompts are implemented. The user explicitly
approved the twelve historical evidence exceptions and dependent T249
release-review disposition; see [merge-readiness-review.md](merge-readiness-review.md).
Original chronology remains unproven and is not relabeled as genuine Red.
T577 is an approved nonblocking production collector follow-up.

Full CI run 37812676896 passed 436 suites / 4,603 tests, with 11 unchanged skips,
all strict coverage thresholds, browser projects, static checks and builds.
The actual preview passed native Codex DCR/PKCE login, discovery, creator
isolation, refresh rotation and 35 disposable mutation/limit/retry/revision
checks; original resources were restored. Actual Grafana/Influx validation
accepted the complete 81-panel v6 import and 360 fixture queries.

The CodeQL generated-test-path finding was fixed in ecae530. Both affected test
lanes and normal hooks pass; independent review finds no surviving interpolation
or path regression. GitHub confirms alert #9 fixed and its thread is resolved.
Fresh final-head CI is pending; successful completion is still required before
GitHub merge readiness. The PR is no longer draft.

## Remaining follow-up and recommendation

No known implementation or historical merge blocker remains. Production
migration/deployment follow normal repository workflows. The external collector
operator must verify real MCP ingestion at first production monitoring rollout
(T577); ingestion is not claimed. Physical runner operation, live UI revocation
and additional named-host compatibility are not claimed as preview-tested.
Automated contracts remain applicable. Marketplace submissions are a later PR.

The following sections preserve earlier verification checkpoints. Their old
counts, pending prerequisites and blockers are superseded by this current
status and the approved merge-readiness review.

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

CI correction verification: all 337 workflow/feedback journeys passed through the new collector. Replaying their fresh counters against the actual failed CI report, replacing the two changed Node-24 adapter files with fresh counters, passes all 91 strict files and unchanged global/gallery thresholds (`ci-gap-proof.log`). Coverage infrastructure: 5 suites/9 tests pass; worker selection: 18 tests pass; targeted OAuth: 34 tests pass. Four development-server shards still exhausted the heap in the final lifecycle group, so that intermediate approach is superseded. The canonical browser gate now builds once into the existing `.next-playwright` test directory and uses a production server; the ordinary deployment remains standalone. All 19 ATDD auth journeys passed in 37.8 seconds on one production server with a 1536-MiB V8 limit. Build-policy/heap-boundary checks (8 tests) pass. Production browser regressions pass: 4 acceptance checks, 62 BDD checks (61 original browser cases plus the actual MCP consent/SDK roundtrip), and 2 compliance checks. Browser output no longer clears the shared compiled probe directory.

## Focused editing and agent guidance — local verification checkpoint

66 public tools and six optional MCP prompt templates are implemented. Focused overlay/gallery patches preserve unrelated configuration and enforce existing backend permission, plan and revision rules. get_overlay_link is streaming-neutral and requires explicit overlay-secret:read. HeroUI connected-app examples use English copy. The descriptions index is generated from actual SDK discovery. Graphify and LLMS documentation are updated.

Complete Jest execution: 423 suites passed, two skipped, two failed; 4,536 tests passed, 11 skipped, two failed. Both failures were stale test projections and pass after correction (focused-entitlement-green.log, focused-benchmark-green.log). Full native workflow execution: 335 passed, eight stale option assertions failed; all 37 option scenarios pass after exact repairs (focused-options-green.log). Additional behavior verification: 40 component/configuration/connection checks and one native missing-playlist check pass. These overlapping totals are not summed into a fictitious single successful run.

The complete current-source Jest counters and all 343 native workflow executions, plus scoped repair counters, pass the unchanged strict gate for **96 required source files**, and unchanged global/gallery thresholds. Strict feature coverage: lines 98.95%, statements 97.00%, functions 97.83%, branches 91.64%. Aggregate global coverage: lines 89.17%, statements 86.66%, functions 86.20%, branches 80.69%; seven gallery files meet their original thresholds. Logs: focused-coverage-complete.log, focused-coverage-merged.log, focused-coverage-repairs.log and focused-native-coverage-repairs.log under test-results/mcp-workflows. Reports: coverage/mcp-focused-complete/strict-gate.json and global-gallery-gate.json. No stale counters for changed production code are used; frozen production sources did not change during full verification.

Actual browser consent/SDK/examples: three passed. Focused field-isolation BDD/ATDD: six passed. Scoped migration regression: 243 passed; capabilities/routing/native checks: 21 passed; prompt/component guidance: 12 passed. Both production build variants, types, scoped lint, 91-file action manifest and migration policy pass. The normal publication hook is pending and will record a complete rerun against the corrected committed tests. No claim of live vendor authorization or release readiness is made: Infisical development access and real-host OAuth prerequisites remain external.

Previous CI failure follow-up: native Better Auth supplies X-Retry-After, now honored by the browser registration fixture alongside application Retry-After. Eight helper tests pass, retaining genuine Red for the missing header path. Core consent/catalogue BDD fixtures now request only their scenario scopes and assert the independent complete public catalogue; all 16 native examples pass. An affected real-browser batch records 11 passes and one stale worker assertion, followed by a passing exact fresh-worker rerun (17.6 seconds). Dashboard theme saves, stale revisions, playlist deletion/items, native consent and SDK journeys are covered. Browser fixture counters were not reset or disabled; one registration correctly waited about 60 seconds. No production source changed during these test corrections. The initial publication attempt was cancelled before transfer to include these CI fixes; a fresh normal pre-push regression remains required.

## Focused editing publication — final committed regression Green

The normal unmodified pre-push hook completed successfully against 609b57c: **426 suites and 4,553 tests passed**; two existing suites and 11 existing tests skipped. Duration: 2,436.71 seconds. No failed tests remain in this final committed execution. Evidence: test-results/mcp-workflows/focused-push-verified.log. The branch update be88232 → 609b57c completed to the existing draft PR #496. This supersedes the earlier pending-publication statements while preserving genuine failed-run and repair evidence.

All locally implementable focused-editing tasks T563–T569 are complete. Strict/global/gallery coverage, native SDK discovery/prompts, real browser journeys, both builds, static checks and migration policy remain verified. Live preview authorization still needs Infisical development access and the earlier consent schema update, then fresh user OAuth approval. Real named-host acceptance and original historical-evidence exceptions remain blocked as documented; no complete release Green is claimed.

## Acceptance scope amendment — 2026-10-08

The user explicitly replaced the original four-host release matrix with Codex-driven testing against the PR preview MCP server. ChatGPT web, Claude web and another custom host are deferred to follow-up compatibility work and are no longer merge prerequisites for this PR. Existing independent SDK denial/revocation contracts remain required automated coverage; this amendment does not claim those other products were tested. Historical test-first evidence exceptions and production migration/monitoring rollout requirements remain separate.

The real Codex CLI completed native dynamic registration, user consent and PKCE token exchange against `https://beta-496.clipify.cloud.thedannicraft.de/mcp`. The official SDK then used that grant for preview validation: 66 tools, six prompts, approved-creator reads and unapproved-creator denial; **35/35 disposable mutation checks passed** across overlays, playlists and galleries, including create retry identity, focused editing, stale-revision rejection, invalid input, Free quotas, paid-feature rejection and deletion with persisted absence. Existing development resources were backed up and restored. A subsequent real refresh returned HTTP 200, rotated the refresh token and successfully read the approved creator. No credentials or callback codes are retained in these documents.

Publication checkpoint: acb3b3e reached the preview after normal commit/push hooks; all 436 suites / 4,603 tests pass with 11 unchanged skips (2,406.372 seconds). CodeFactor and CodeQL are Green; CodeFactor retains 15 nonblocking complexity notices. Preview refresh rotation and subsequent authenticated reads pass. The old BDD shard's 15 callback-navigation timeouts were traced to a shared test helper that expected an automatic redirect; the corrected manual-continuation helper passes all 15 affected real-browser journeys in three minutes. Fresh browser CI remains pending.

## Final CI and deployed-preview verification — 2026-10-08

Code commit 66e0ed7 passes all applicable checks in [CI run 37808034227](https://github.com/TheDanniCraft/clipify/actions/runs/37808034227). Full Jest: 436 suites / 4,603 tests, 11 unchanged skips; strict coverage passes. Every browser project passes; the repaired BDD shard reports 372 passed in 13.0 minutes. CodeFactor and CodeQL are Green. The final deployed preview passes 66-tool/six-prompt discovery, six approved-creator reads and unapproved-creator denial. Earlier 35/35 disposable mutation and refresh-rotation evidence remains valid; original resources were restored. Final evidence-only closeout leaves application and test code identical to that verified revision. Historical chronology/retention review and actual external collector ingestion remain unverified; other-host acceptance was explicitly deferred by the user.
