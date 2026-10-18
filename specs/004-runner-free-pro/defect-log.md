# Defect Log: Free Runner and Pro Broadcasting

**Feature**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)  
**Traceability**: [test-traceability.md](test-traceability.md)  
**Test Summary**: [test-summary.md](test-summary.md)  
**Created**: 2026-10-14  
**Last Updated**: 2026-10-18

## Purpose and Scope

Track defects, unexpected test failures, escaped issues, accepted risks, and verification evidence for this feature. Record only product, test, environment, or governance issues that affect feature readiness; routine implementation tasks belong in `tasks.md`.

## Status Vocabulary

- `Open`: confirmed issue without an implemented fix.
- `In Progress`: fix or investigation is underway.
- `Blocked`: progress needs an external decision, dependency, access, or environment change.
- `Fixed`: fix is implemented and awaiting verification.
- `Verified`: fix is confirmed by linked evidence.
- `Deferred`: accepted for later work with approval and compensating evidence.
- `Rejected`: triaged as not a defect, duplicate, or out of scope with rationale.

## Severity and Priority Policy

| Level    | Severity Meaning                                                                                                           | Priority Meaning                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Critical | Data loss, security exposure, unavailable core workflow, legal/compliance risk, or release-blocking safety issue           | Must be resolved before release unless explicitly accepted by the accountable approver |
| High     | Major user-visible failure, broken acceptance criterion, severe performance/accessibility failure, or high-risk regression | Resolve before release unless a documented exception exists                            |
| Medium   | Partial workflow failure, workaround exists, non-critical quality gate failure, or localized regression                    | Resolve in the current release when practical or track as follow-up                    |
| Low      | Cosmetic, documentation, low-risk maintainability, or minor non-blocking issue                                             | Resolve opportunistically                                                              |

## Defect Summary

Implementation records242 canonical defects:242 Verified. No open High/Critical, deferred risk or approved exception remains. Local implementation and qualification are complete; required official CI/platform gates remain tracked in tasks.md.

| Defect ID   | Title                                                                              | Source / Evidence                                              | Severity | Priority | Status   | Owner               | Evidence                                                                                                          | Resolution                                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------- | -------- | -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEF-US1-001 | Native Runner adapter omitted local OAuth lookup                                   | A1 acceptance fixture                                          | Medium   | P1       | Verified | Feature implementer | tdd/evidence/A1-green-corrected.log; cycle-1-refactor.log                                                         | Route token lookup through isolated auth.handler and reject protocol errors                                                                                                                        |
| DEF-US1-002 | New enrollment test imported an incorrect action name                              | Enrollment characterization setup                              | Low      | P2       | Verified | Feature implementer | tdd/evidence/enrollment-import-error.log; enrollment-access-red.log; enrollment-access-green.log                  | Use actual submitRunnerSelection action; reject import failure as intended Red                                                                                                                     |
| DEF-US1-003 | Historical Pro-without-Runner-grant test expects registration denial               | A1 full coverage; test/mcp/workflows/plan-boundaries.test.ts   | Medium   | P1       | Verified | Feature implementer | tdd/evidence/A1-plan-boundary-fix.log; A1-clean-complete-coverage.log                                             | Update the obsolete expectation to approved basic registration, retain remote-control restrictions and credential safety, verify whole file and complete gate                                      |
| DEF-US1-004 | New permission-denial fixture assumed the wrong error envelope and audit semantics | A25 native workflow fixture                                    | Low      | P2       | Verified | Feature implementer | tdd/evidence/A25-envelope-diagnostic.log; A25-restored.log                                                        | Assert the real OAuth transport denial and count successful protected mutation audits; permission-weakening mutant killed and restored                                                             |
| DEF-US1-005 | Forged-payload fixture conflated signature rejection with identity rejection       | U242 signature mutant survived                                 | Medium   | P1       | Verified | Feature implementer | tdd/evidence/U242-signature-mutant.log; U242-restored.log                                                         | Add a tampered expiry with unchanged resource identity so signature-only bypass fails; identity and expiry bypasses also fail; restore source and verify 14 tests                                  |
| DEF-US1-006 | Heartbeat parser integration retained untyped-body assumptions                     | A2-typecheck.log; heartbeat/route.ts                           | Medium   | P1       | Verified | Feature implementer | tdd/evidence/A2-typecheck.log; A2-typecheck-restored.log; A2-fast-complete.log                                    | Use validated optional telemetry and enum-narrowed observed states; corrected app type gate exit 0 and all seven affected suites/60 tests pass                                                     |
| DEF-US1-007 | Native package node_modules is older than its locked patch target                  | A2-native-patches.log                                          | Medium   | P1       | Verified | Feature implementer | tdd/evidence/A2-native-patches.log                                                                                | Frozen native install restored exact lock/patch versions without manifest/lock edits; both patches, native types, 20 tests and keyring binding pass; document separate native install              |
| DEF-US1-008 | Native lockfile contains transitive dependencies with High advisories              | A2-native-audit.log                                            | High     | P1       | Verified | Feature implementer | tdd/evidence/A2-native-audit.log; A2-native-audit-fix-preview.log                                                 | Compatible transitive fixes and downloader-only override; clean native install, 20 tests, patch/types, real capture/cleanup and High audit pass; audit enforced in both CI workflows               |
| DEF-US1-009 | New real-capture probe used incorrect headless and portable browser-path options   | A2-native-capture-baseline.log; A2-native-capture-portable.log | Low      | P2       | Verified | Feature implementer | tdd/evidence/A2-native-qualified-capture.log                                                                      | Correct actual Runner headless-new option and portable Chromium lookup; final portable real capture/cleanup exit 0                                                                                 |
| DEF-US1-010 | Critical coverage inventory omitted the changed heartbeat transport                | A2-heartbeat-inventory-red.log                                 | Medium   | P1       | Verified | Feature implementer | tdd/evidence/A2-transport-instrumented-coverage.log; A2-lanes-merged-coverage.log; A2-lanes-summary.json          | Heartbeat canonical/critical inventory enforced; individual critical thresholds and complete six-lane merge pass with unchanged source inputs                                                      |
| DEF-US1-011 | Root lint scans the newly generated native Runner bundle                           | A2-qualification-lint.log                                      | Medium   | P1       | Verified | Feature implementer | tdd/evidence/A2-qualification-lint.log; A2-qualified-build-ignore-lint.log                                        | Exact native build directory ignored by Git/Prettier/ESLint; actual generated bundle retained, source lint 0 errors/5 baseline warnings and changed-file format check pass                         |
| DEF-US1-012 | Provider metadata probe times out during concurrent local lane validation          | A2-lane-database-1.log; test/mcp/contract/oauth.test.ts        | Medium   | P1       | Verified | Feature implementer | tdd/evidence/A2-lane-database-1.log; A2-lane-database-1-restored.log; A2-lanes-summary.json                       | All other producers completed; identical-source full owning lane rerun passed 416 tests with original 15s timeout/assertions. Earlier local concurrency timeout retained; no source/timeout waiver |
| DEF-US1-013 | New dashboard/MCP native race probe needs the established RSC-compatible bundle    | A3-owner-race-outer-red.log                                    | Low      | P2       | Verified | Feature implementer | tdd/evidence/A3-owner-race-outer-red.log; A3-owner-race-outer-red-corrected.log; A3-focused-native-race-green.log | Native Playwright setup now compiles existing RSC aliases without instrumentation; external coverage producer preserved; exact focused command passes8scenarios                                    |

| DEF-US1-014 | New race assertion assumes lexical enum ordering | A3-race-rollback-inner.log | Low | P2 | Verified | Feature implementer | tdd/evidence/A3-race-rollback-restored.log | Assert exact two state/revision rows without ordering assumption; 18 tests pass |
| DEF-US1-015 | Historical dashboard start assertion rejects additive admission result | A3-affected-regression.log | Medium | P1 | Verified | Feature implementer | tdd/evidence/A3-browser-revision-restored.log | Verify accepted/applied separation and persisted reservation, all9 file tests pass |
| DEF-US1-016 | Historical capability assertion expects paid manual control | A3-affected-regression.log | Medium | P1 | Verified | Feature implementer | tdd/evidence/A3-capabilities-restored.log | Explicitly permit basic control and retain other restrictions, all3 file tests pass |

| DEF-US1-017 | Instrumented shared module inherits its native ESM package scope | A3-affected-instrumented-coverage.log | Medium | P1 | Verified | Feature implementer | tdd/evidence/A3-native-module-refactor.log; A3-complete-workflows-policy-restored.log | Preserve original Jest counters and give transformed native protocol an explicit CJS bundling identity; regression/calibration and complete native owner pass |
| DEF-US1-018 | New source-input JSON evidence uses nonstandard indentation | A3-format-check.log | Low | P2 | Verified | Feature implementer | tdd/evidence/A3-format-check-restored.log | Format generated evidence without changing parsed content or hash values; full formatting gate passes |
| DEF-US1-019 | Existing Gherkin still expects paid manual control | A3-complete-workflows-coverage-restored.log | Medium | P1 | Verified | Feature implementer | tdd/evidence/A3-complete-workflows-policy-restored.log | Move the exact option to the existing basic-access allowed outline; all361 scenarios pass, no skips or inventory reduction |
| DEF-US1-020 | Nested terminal fixture imports Jest-only CommonJS helper | A4-terminal-inner-green.log | Low | P2 | Verified | Feature implementer | tdd/evidence/A4-terminal-inner-restored.log; A4-terminal-outer-restored.log | Use ESM Node built-ins in native child fixture and retain real terminal route invocation |

| DEF-US1-021 | Lease recovery assigns untyped stream-state literals | A4-intermediate-typecheck.log | Medium | P1 | Verified | Feature implementer | A4-intermediate-typecheck-restored.log; A4-lease-recovery-restored.log | Use existing StreamState enum; type gate0 and41admission tests pass |

| DEF-US1-022 | Lease recovery preceded its required outer Red | T749; implementation wrapper | Medium | P1 | Verified | Feature implementer | A4-lease-recovery-outer-red.log; outer-green.log; inner-final.log | Prior policy expected outer Red; restored recovery passes23outer/41inner |

| DEF-US1-023 | Clock prerequisite imports one directory above repository | A4-free-clock-before-red.log | Low | P2 | Verified | Feature implementer | A4-free-clock-before-corrected-red.log; A4-free-clock-before-green.log | Correct import, intended functionality Red then24Green |

| DEF-US1-024 | Browser heartbeat regression retains obsolete paid-only403 shutdown expectation | A4-server-checkpoint-internal.log | Medium | P1 | Verified | Feature implementer | A4-browser-heartbeat-policy-restored.log | Nine whole-file tests pass with update-required/no invented state transition |

| DEF-US1-025 | Native fixture paths were relative to package cwd twice | A5-native-drain-outer-red.log | Low | P2 | Verified | Feature implementer | A5-native-lifecycle-real-media-green.log; original failure and corrected Red retained in details | Move only three newlycreated fixture files to intended package test tree |

| DEF-US1-026 | Native real Engine fixture times out before stop assertion | A5-native-drain-outer-corrected-red.log | Medium | P1 | Verified | Feature implementer | A5-native-lifecycle-real-media-green.log; original failure and corrected Red retained in details | Identify stalled runtime/cleanup; preserve timeout and do not count setup failure as behaviorRed |

| DEF-US1-027 | Native media fixture checks first clip instead of current clip | A5-native-drain-outer-runtime-red.log | Low | P2 | Verified | Feature implementer | A5-native-lifecycle-real-media-green.log; original failure and corrected Red retained in details | Capture current clip ID at Stop and require its completion/no later successor |

| DEF-US1-028 | Native final-frame check samples container end instead of last video frame | A5-native-drain-outer-green.log | Low | P2 | Verified | Feature implementer | A5-native-lifecycle-real-media-green.log; original failure and corrected Red retained in details | Decode all small RGB video samples and inspect final frame; preserve stronger requirement |

| DEF-US1-029 | Emergency admission SQL update omits helper import | A5-emergency-control-typecheck.log | Medium | P1 | Verified | Feature implementer | A5-emergency-control-{inner,outer,typecheck}-restored.log | Add Drizzle sql import; reject pre-fix failed runs as qualification |

| DEF-US1-030 | Cancellation test omits controlled page interface | A5-late-browser-red.log | Low | P2 | Verified | Feature implementer | A5-late-browser-corrected-red.log; A5-late-browser-green.log | Complete page stub; prove semantic Red before guarded production change |

| DEF-US1-031 | Capture launcher returns before extension installation | A5-native-lifecycle-complete-checkpoint.log | Medium | P1 | Verified | Feature implementer | A5-capture-install-order-green.log; A5-capture-slow-install-runtime-green.log; A5-native-lifecycle-complete-checkpoint-restored.log | Flatten actual nested Promise.all list in pinned capturecore24 CJS/ESM; preserve media assertions and deadlines |
| DEF-US1-032 | Patch validator assumes only one installed package version | A5-capture-order-patches-validate.log | Medium | P1 | Verified | Feature implementer | A5-patch-resolver-strictness-green.log; A5-capture-order-patches-validate-restored.log | Resolve and validate every matching installed package/version, preserve target/type checks |

| DEF-US1-033 | Shared protocol test move uses wrong relative import depth | A4-initial-request-context-owning-red.log | Low | P2 | Verified | Feature implementer | A4-initial-request-context-owning-corrected-red.log; A4-initial-request-context-green.log | Compute actual relative path and prove semantic Red before production |
| DEF-US1-034 | Expiry fixture edit assumes preformatted anchor text | A4-native-lease-expiry-outer-red.log | Low | P2 | Verified | Feature implementer | A4-native-lease-expiry-outer-corrected-red.log; A4-native-lease-expiry-outer-green.log | Correct owned driver hook and require actual false-to-true runtime expiry result |

| DEF-US1-035 | CLI watchdog fixture exports an undeclared future helper | A4-cli-watchdog-red.log | Low | P2 | Verified | Feature implementer | A4-cli-watchdog-corrected-red.log; A4-cli-watchdog-green.log | Conditionally expose the missing function so Red proves missing timer, not transform failure |

| DEF-US1-036 | Extended CLI disconnect fixture omits proxy cleanup interface | A5-disconnect-shutdown-red.log | Low | P2 | Verified | Feature implementer | A5-disconnect-shutdown-corrected-red.log; A5-disconnect-shutdown-green.log | Complete existing engine fixture, prove semantic Red before product change |

| DEF-US1-037 | Dashboard action probe placed outside its compiled workflow owner | A5-dashboard-stop-action-red.log | Low | P2 | Verified | Feature implementer | A5-dashboard-stop-action-corrected-red.log; A5-dashboard-stop-action-green.log | Move to existing MCP workflow lane so Next public entries use compiled adapters, preserving all assertions |

| DEF-US1-038 | Elapsed clock validates rebased origin as a nonnegative physical reading | A4-suspend-clock-rollback-green.log | Low | P2 | Verified | Feature implementer | A4-suspend-clock-rollback-restored.log | Permit finite negative logical origin while retaining nonnegative source readings; failed filename never qualifies as Green |

| DEF-US1-039 | One formatted CLI fixture bypasses its new shared clock dependency adapter | A4-default-clock-native-green.log | Low | P2 | Verified | Feature implementer | A4-default-clock-native-restored.log | Route the existing formatted fallback through dependencyFallback; keep original nonce and clock assertions |

| DEF-US1-040 | Native CLI fixture CommonJS loader style and local module names violate lint | A4-key-clock-lint.log | Low | P2 | Verified | Feature implementer | A4-key-clock-lint-restored.log | Use Jest actual-module adapter, name fixtureModule, remove unused bindings, preserve runtime assertions |

| DEF-US1-041 | Native behavior execution and safety error paths lack complete coverage ownership | A4-native-critical-coverage.log; A4-shared-critical-coverage.log | Medium | P1 | Verified | Feature implementer | Both full behavioral runs pass; coverage thresholds fail | Instrument the actual CLI adapter under coverage, cover missing safety paths, retain all thresholds and owning physical scenarios |

## Defect Details

DEF-US1-001: environment is the disposable loopback native MCP fixture. Expected: paid policy gives a business restriction before feature change. Actual: protocol error "no token payload" because the new adapter did not reuse local auth.handler token lookup. Initial A1 Red was rejected as feature evidence. Restored the original production gate, fixed adapter, obtained corrected intended Red, reapplied minimal feature change and verified acceptance plus 19 affected fast tests. Source of failure was test infrastructure, with no production credential/data involvement.

Each observed unexpected failure needs stable DEF-USn-###, source/artifact IDs, environment, expected/actual result, reproduction, logs, investigation, resolution, verification and any scoped approval. An expected Red is not itself a defect.

DEF-US1-002: the new test initially imported a nonexistent submitRunnerEnrollChoice action. The intended-Red guard rejected the TypeError before any production change. Retained diagnostic, corrected to submitRunnerSelection, then verified actual paid-policy assertion Red and authorized Free approval Green. This was a test authoring error, not a repository baseline regression.

## Open Defect Review

242 canonical issues are Verified. The following A2–A4 narrative is retained historical evidence, not the current open-defect state: The historical A2/A3 scoped coverage checkpoints pass; current A4 completion coverage is pending. The failed concurrent local provider probe remains recorded; its complete isolated owning-lane rerun passed with no source/assertion/timeout change. Exact host-contention root cause is not proven; local qualification uses the complete successful isolated owner result, matching CI lane isolation. No High/Critical or approved exception remains. Feature implementation and final release validation are incomplete.

## Verification and Regression Closure

DEF-US1-001 fix verified by A1-green-corrected.log and cycle-1-refactor.log. Closure requires linked current-source Green evidence, regression checks and owner/date. Never treat planned remediation as Verified.

## Defect Metrics

| Metric               | Value | Notes                                                                      |
| -------------------- | ----- | -------------------------------------------------------------------------- |
| Total known defects  | 242   | 242 Verified; no open defects or approved exceptions.                      |
| Open Critical / High | 0     | Local qualification complete; official CI/platform gates pending.          |
| Deferred / accepted  | 0     | No risk exception approved.                                                |
| Reopened / escaped   | 1     | Native fixture contract reopened at workflow boundary; no release escaped. |

## Design Limitations and Follow-up

- Free occupied slots remain blocked during uncertain streaming until a matching output-closed acknowledgment or the final signed lease expiry plus bounded drain and safety margin. Lost leased devices have bounded recovery; non-leased legacy executions require terminal reconciliation. No unconditional force-release or monthly quota.
- One live-fallback ingest per installation because current proxy has fixed ports; multiple destinations and multiple registered devices remain supported.
- Offline snapshots cannot learn unknown benefit revocation immediately; known expiry is enforced locally and reconciliation updates on reconnect.
- Legacy count is user-reported, not production-verified; review recurring billing/allocation history read-only before any commercial action.
- Verify actual bundled FFmpeg reconnection/status and native platform compatibility through planned smoke; no unmeasured performance promise.

## Required Checks

- [x] Severity/priority and triage/release policy initialized.
- [x] Known defects and approved exceptions initialized to zero without claiming product success.
- [ ] Record every unexpected failure or a documented non-defect rationale during execution.
- [ ] Resolve/verify every High/Critical defect or obtain scoped human acceptance.
- [ ] Match current defect counts and verification links with test-summary.md.

## Design Review Remediation Record

| Finding        | Document disposition                                                        | Product execution |
| -------------- | --------------------------------------------------------------------------- | ----------------- |
| C1             | Slice gates/dependencies corrected following user approval                  | Not Run           |
| C2             | Explicit boundary examples/registry/tasks corrected                         | Not Run           |
| C3             | Native ATDD routing contract/tasks aligned                                  | Not Run           |
| I1/U1/I2/A1/A2 | Design resolved in reconciled contracts/tasks; runtime verification pending | Not Run           |

This record does not mark runtime fixes Verified or change the zero executed-product-defect counts. The documented design findings are closed at planning level. Release remains No-Go pending implementation and mandatory execution evidence.

## Reconciled design findings (planning closure, execution pending)

I1: stable event/occurrence identity with separate revisions, active occurrence locks and explicit stop/resume. U1: renewable supported Free lease, bounded drain recovery and terminal-only revoked-device acknowledgments. I2: whole-feature native no-coverage commands in Red/Green tasks/registry, full instrumented workflow lane at completion. A1: fixed translucent numeric sizing/contrast and collision fixtures. A2: explicit multi-day/week dates, local-day DST and mobile adapter/editor. Each has executable planned acceptance/internal artifacts and dependency-ordered Red/Green tasks. This closes the documented design gaps, not runtime defect verification; product evidence is still Not Run.

## Existing baseline diagnostics — non-regression rationale

The first-slice browser acceptance passed all four journeys. Its server stderr includes the Next lazy-module loading invariant and the fake provider invalid-client/no-token messages. These exact diagnostics already appear in the pre-feature successful baseline `/tmp/clipify-local-test-browser.log:195–199`, while all four journeys passed there too. They are inherited framework/fixture diagnostics, not intended Red or a new feature regression. No failure was suppressed or waived. Current evidence: `tdd/evidence/A1-browser-acceptance.log`; the identical diagnostics recur with a passing generated-source journey in `tdd/evidence/E1-standby-browser-green.log`. This rationale does not turn any future failing mandatory gate into an accepted exception.

## DEF-US1-003 investigation

The complete A1 suite found `Pro without Runner Access cannot provision a runner` expecting FEATURE_RESTRICTED and zero writes. FR-001 now explicitly permits authenticated owners, including Pro owners without a standalone Runner grant, to register devices. The API correctly returned its successful safe projection, so the obsolete `.error.code` assertion threw a TypeError. Proposed fix is a positive creation/enrollment projection and one committed audit write, while preserving the separate Free remote-control denial test and safe-projection assertions. No production change is indicated by this failure. The complete gate remains failed/incomplete until corrected current-source evidence is verified.

DEF-US1-003 verification: clean full application 464 suites / 4,861 tests passed, native 349 passed, merged coverage ok true, command exit 0. No production change was required for this historical assertion correction. Open defects 0; approved exceptions 0.

## DEF-US1-004 verification

The new read-only operator probe expected a tool business envelope, but OAuth correctly rejects insufficient scope at transport entry. It also initially counted denial audit records as successful writes. Corrected new fixture assertions and the success-only audit predicate. All seven native Runner scenarios passed; weakening the permission map fails A25 and restoration passes. This is test authoring, not a product regression; no exception.

## DEF-US1-005 investigation and closure

The first signature-bypass mutant passed 13 tests because the forged-generation fixture was independently rejected by resource identity checks. The tool transcript records that initial surviving mutant; its old log path was overwritten on the corrected rerun, so it is not presented as immutable original failure evidence. Production signature verification was restored immediately. Added a tampered but otherwise valid expiry without changing identity; signature bypass now fails. Identity and exact-expiry bypasses also fail. Whole file restored Green, 14 tests. No production vulnerability or threshold exception inferred; this is a test-strength gap corrected before slice closure.

## DEF-US1-008 dependency investigation

The root audit never included the independent native lockfile. Compatible native transitive updates remove fixable advisories. The remaining vulnerable extractor/FTP chain came from capture's Puppeteer 24 downloader 2.x, while the Runner already uses downloader 3.2.3. First tried sharing Puppeteer 25 itself: rejected because real capture/cleanup exposes its removed isConnected API and extension startup differences. That override is not retained. Final narrow override shares only @puppeteer/browsers 3.2.3, preserving capture's Puppeteer 24 API. A fresh install removes orphaned old nested modules; frozen install alone after changing overrides had left an unreferenced old runtime tree. The portable probe verifies resolved downloader versions, captures real WebM, checks its header and requires successful browser/socket/server cleanup. Native audit is clean without any ignored High advisory. The standard CI Runner job and native build matrix now both run the exact native audit command. No new patch suppression/guard bypass; existing two patched package pins remain unchanged.

Earlier 25-core capture experiment and aggregate audit alone were not accepted as compatibility proof. Positive output printed before a cleanup exception is not a passing process; only exit 0 final qualification qualifies. Diagnostic captures and rejected experiment logs remain under tdd/evidence/A2-native-*. The first temporary probe also had two setup errors (headless=true instead of the actual Runner headless=new, then an incorrectly ported Chromium executable lookup); DEF-US1-009 records those as fixture defects, never intended feature Red. Prettier reported no parser for bun.lock when it was explicitly included once; the repository's supported-extension checker correctly excludes .lock, Bun owns its serialization, and no formatting-gate exception is needed.

## DEF-US1-014 — New race assertion assumed enum lexical ordering

Status: Verified. Evidence: `tdd/evidence/A3-race-rollback-restored.log`, whole file 18 passed. Severity: Low. Command: `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`. Suite TDD, case TDD-US1-EC001 U23 in test/server/runner/admission.test.ts. Expected baselineGreen rollback; actual failure only array order: PostgreSQL stream_state enum sorts stopped before running, not lexical order. Both original state/revision assertions were otherwise satisfied. Fix: assert exact two rows with unordered membership; preserve exact values/count, locks, admission and audit assertions. No production change or intended featureRed. Original output: tdd/evidence/A3-race-rollback-inner.log.

## DEF-US1-015 — Existing dashboard start assertion rejects additive admission result

Status: Verified. Whole-file 9 passed, `tdd/evidence/A3-browser-revision-restored.log`. Severity: Medium. Command `bun run test --maxWorkers=2 test/mcp/workflows test/app/actions/runner.test.ts --coverage=false`, TDD test/mcp/workflows/browser-runner-revisions.test.ts case browser start requests advance the stream configuration revision. Expected all existing regression contracts Green; actual exact `{success:true}` assertion rejects planned additive accepted/applied/admissionId/configurationRevision fields. Actual command succeeded with revision2 and applied=false. Proposed fix is stronger exact result shape plus real matching reserved admission/actual-state assertions, retaining stale-revision tests and original DB checks. No production change or intended featureRed. Original evidence tdd/evidence/A3-affected-regression.log.

## DEF-US1-016 — Old capability assertion still expects paid manual control

Status: Verified. Whole file3 passed, `tdd/evidence/A3-capabilities-restored.log`. Severity: Medium. Command `bun run test --maxWorkers=2 test/mcp/workflows test/app/actions/runner.test.ts --coverage=false`, TDD test/mcp/workflows/capabilities.test.ts, basic Runner setup and registration remain available without a standalone Runner grant. Expected all unchanged capability restrictions remain Green; actual paid-only control expectation conflicts with approved Free manual control and the shared policy. Fix explicitly expects control allowed alongside registration/setup, while retaining currently unconverted configure and all remote-control restrictions. Actual Free admission and owner-limit operation are exercised in separate native acceptance. No production change or artificial intended Red. Evidence `tdd/evidence/A3-affected-regression.log` (30 suites:28 pass,2 failed obsolete assertions).

## DEF-US1-017 — Instrumented shared native module inherits ESM package scope

Status: Verified. New regression2pass and existing calibration3tests across2files pass in A3-native-module-green.log / A3-native-module-refactor.log; complete current native instrumented owner361pass A3-complete-workflows-policy-restored.log confirms the loading fix. The broader whole-slice coverage gate remains independently pending. Severity: Medium. A3 instrumented affected suite and complete native workflow lane fail with `ReferenceError: exports is not defined` at packages/runner/src/protocol.ts. Original logs A3-affected-instrumented-coverage.log and A3-complete-workflows-coverage.log. First parent symptom was coverage-mixed-source nested calibration2failedtests; stack reveals same module-loading cause, not accepted missing-behavior Red. Coverage producer trees stopped after preserving evidence to avoid repeating known invalid runs. Cause: Jest transforms protocol source to CommonJS for identical counters; esbuild treats its original path inside type=module native workspace as ESM, leaving free exports in an ESM initializer. A3 introduces server import of the codec through the shared admission capability module, exposing it in native instrumented probes. Add real instrumented bundle/operation regression, then repair the builder module format without changing production source, omitting protocol instrumentation or weakening counters/thresholds. Both complete owning checks must be rerun.

## DEF-US1-018 — New source-input JSON reports need repository formatting

Status: Verified. Whole repository formatting passes, A3-format-check-restored.log; report contents/source hashes retained. Severity: Low. `bun run app:prettier:check` failed only for A3-source-inputs.json and A3-qualified-source-inputs.json, generated by the local evidence helper with default Python indentation. Evidence A3-format-check.log. Format these two reports with the repository formatter, retaining parsed contents and source hashes unchanged, then rerun the same whole formatting gate. This is evidence serialization, not a product failure or featureRed; no ignore/threshold exemption.

## DEF-US1-019 — Existing Runner workflow example retains paid manual-control expectation

Status: Verified. Complete owning workflow producer exit0, all361 scenarios pass in A3-complete-workflows-policy-restored.log; same scenario total, no skips/sampling. Severity: Medium. Complete native coverage command `node scripts/run-coverage-lane.mjs workflows` completes360pass/1fail, BDD-US5-003 broadcast operations retain admission gate, control_stream_session no_runner_access example. Expected all owning scenarios current policyGreen; actual valid manual start is accepted, so old denied assertion fails. This is the executable Gherkin counterpart of DEF-US1-016's obsolete capability assertion. Evidence A3-complete-workflows-coverage-restored.log. Proposed fix moves that exact named option to the existing basic-access allowed outline and retains standalone configuration restriction until its owning conversion. All scenario IDs/total inventory remain accounted for; no skip or sampling. Complete owning workflow lane rerun required. Production policy remains unchanged.

## DEF-US1-020 — Nested terminal fixture imported the Jest-only CommonJS probe utility

Status: Verified. Whole inner36pass and native20pass, A4-terminal-{inner,outer}-restored.log. Severity: Low. Command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`, TDD-US1-CON003 U239 terminal receipt. Expected actual new route reconciliation200; actual dynamic require node:crypto error before invocation, from test/support/mcp/probe.ts importing coverage-paths.cjs inside uninstrumented ESM flow bundle. Evidence A4-terminal-inner-green.log (failed,35pass/1fail). This is fixture integration, not accepted featureRed. Replace the nested Jest helper import with Node ESM child_process/path built-ins, inheriting the owning producer runtime and coverage folder; retain actual route driver, no mocked responses, no production/auth/threshold workaround. Rerun whole inner and native owning feature.

## DEF-US1-021 — Lease recovery update uses untyped stream-state literals

Status: Verified. Evidence: A4-intermediate-typecheck-restored.log (exit0), A4-lease-recovery-restored.log (41pass). Severity: Medium. Command `bun run app:typecheck`, gate `A4-intermediate-typecheck.log`. Expected typed recovery update; actual TS2322 at src/server/runner/admission.ts:26, strings stopped do not satisfy existing StreamState enum. Admission41tests Green but type gate blocks progression. Fix import existing StreamState and use its Stopped value; rerun type gate and whole admission file, retain original log. No schema migration, business rule or test threshold change.

## DEF-US1-022 — Server lease recovery implementation preceded its required outer Red

Status: Verified. Evidence: A4-lease-recovery-outer-red.log (22pass/1expectedfailure), A4-lease-recovery-outer-green.log (23pass), A4-lease-recovery-inner-final.log (41pass). Severity: Medium (governance). The U199 real Start contract had intended Red before implementation, but the matching DEC001 native workflow boundary was not yet materialized. T749 and the implementation wrapper require applicable outer evidence too. Do not count the early server41-pass run as complete test-first evidence. Add the real native workflow case for this same behavior, temporarily restore the immediately preceding occupancy policy, prove intended outer Red, then reapply the same minimal recovery and rerun both owners. Preserve all original evidence and record the ordering correction explicitly. Remaining physical lease/drain/replay invariants remain mandatory and pending; this workflow case covers server recovery only.

## DEF-US1-023 — Clock guard prerequisite test import traverses one parent too many

Status: Verified. Evidence: A4-free-clock-before-corrected-red.log (explicit missing guard), A4-free-clock-before-green.log (24pass). Severity: Low. Command `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`; internal supporting CON004 monotonic lease prerequisite. Expected explicit missing guard functionality assertion; actual module-not-found from five parent traversals instead of four. Original A4-free-clock-before-red.log retained and rejected as intended Red. Fix test import only, rerun same whole file to prove intended missing guard assertion before production change; no source behavior changed.

## DEF-US1-024 — Browser heartbeat regression still asserts retired paid-only policy

Status: Verified. Evidence: A4-browser-heartbeat-policy-restored.log (9whole-filepass). Severity: Medium. Command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts test/app/api/runner/heartbeat.test.ts test/app/api/runner/terminal.test.ts test/app/lib/runnerScheduler.test.ts test/app/actions/runner.test.ts test/mcp/workflows/browser-runner-revisions.test.ts test/mcp/workflows/capabilities.test.ts --coverage=false`, test/mcp/workflows/browser-runner-revisions.test.ts expired-access heartbeats version shutdown intent once. Expected allcurrentpolicyregressionsGreen; actual403expectedvs426update_required,133otherchecksGreen. Original A4-server-checkpoint-internal.log retained. U231 paid-only403 characterization is already intentionallysuperseded by approvedFreebasicpolicy. Fix this counterpart assertion to426/repeatedidempotence/no inventeddesired/config/actualclosure; do not restorepaidgate or weakenoutputprotocol. Rerun complete owning file then checkpoint affectedfiles.

## DEF-US1-025 — Native fixture generation used a root-relative path from package cwd

Status: Verified. Resolution evidence: A5-native-drain-outer-runtime-red.log reaches a real assertion in18seconds, proving path/discovery and completed process cleanup; the separate current-clip fixture assertion is DEF-US1-027 and is not accepted featureRed. Severity: Low. Native BDD command `bun run test --runTestsByPath test/bdd/runner-free-pro.test.ts --coverage=false` exits before execution because newlycreated fixtures were under packages/runner/packages/runner/test. A5-native-drain-outer-red.log is retained and rejected as behaviorRed. Move only the three owned new files to intended paths, remove owned empty directories, rerun native whole-file command. No productcode changed. Expected intendedfailure is actual current Engine hardcut before real clip ends.

## DEF-US1-026 — Real Engine drain fixture times out before its assertion

Status: Verified. Resolution evidence: A5-native-drain-outer-runtime-red.log reaches a real assertion in18seconds, proving path/discovery and completed process cleanup; the separate current-clip fixture assertion is DEF-US1-027 and is not accepted featureRed. Severity: Medium. Corrected native BDD command starts driver but execFileSync timesout60000ms; expected intentionalcurrenthardcut assertion not reached. A5-native-drain-outer-corrected-red.log retained and rejected as intendedRed. Run standalone owned driver with streamed diagnosticlog, inspect actualEngine/capture/processcleanupstage, resolve rootcause without relaxingtimeoutorassertions. No product drain implementation exists yet.

## DEF-US1-027 — Native media fixture measured clip zero after encoder buffering advanced playback

Status: Verified. Resolution evidence: A5-native-drain-outer-current-clip-red.log and A5-native-generation-runtime-green.log prove current-clip selection, intended hardcut Red and completed real capture Green. Severity: Low. After WebSocketcleanupfix, native test reaches assertions but firstclip completed before media-ready precondition; Stopoccursduringnextclip. A5-native-drain-outer-runtime-red.log failsnextClipStarted duepreStopclipone, so it is not acceptedbehaviorRed. FixfixturetrackcurrentclipIDatStop, preserveactualmedia-ready andmidcliprequirements, assertthatclipcompletes andnohigherindexstarts. Keepcontinuousfixtureplaylist so a successor exists for every possible currentclip. No productionchange.

DEF-US1-025 recurrence: innerfixture writer again used root-relative path from package cwd, rejectedbeforeanyproductchange (A5-native-drain-inner-red.log). Corrected by separating root-cwd filewriting from package-cwd testexecution; keep original failedlog and require corrected actualassertionRed.

## DEF-US1-028 — Native final-frame sample is not the actual last video frame

Status: Verified. Resolution evidence: A5-native-drain-outer-last-frame-restored.log, A5-native-generation-runtime-green.log and A5-native-drain-inner-generation-green.log. Final-frame decode and actual encoded clip completion pass without relaxed assertions. Severity: Low. First outerGreenattempt passescurrentclipend/nosuccessor butlateRGBboolfalse; unchangedproductiondirectdiagnostic A5-native-final-frame-diagnostic.log yields RGB0,255,0/allpass. Original A5-native-drain-outer-green.log retained. Exactfirst-runrootcauseisnotproven. Fixedcontainer-relative-0.2sseekisnotageneraltestforlastvideoframe whenaudio/videoendtimestampsdiffer. Replacewithboundedstreamingdecodeofallvideoframesdownscaled1x1 andinspectlast3RGBbytes, samegreencondition; no threshold/timeoutwaiver. RequirebothactualnativeandinternalGreenbeforeclosingcurrentbehavior.

## DEF-US1-029 — Emergency admission update omits its SQL helper import

Status: Verified. Resolution: A5-emergency-control-inner-restored.log (69pass), A5-emergency-control-outer-restored.log (46pass), A5-emergency-control-typecheck-restored.log (exit0). Severity: Medium. Command: bun run app:typecheck. Gate evidence: tdd/evidence/A5-emergency-control-typecheck.log, TS2304 at src/server/runner/admission.ts:117. Expected typed persisted emergency intent; actual missing sql import after adding sticky immediate-stop update. This is an integration defect, never intended Red. Add existing Drizzle sql import and rerun typecheck plus both whole owning suites; concurrent pre-fix runs are retained as invalid qualification and must not be claimed Green.

## DEF-US1-030 — Late-browser cancellation fixture omits the page interface

Status: Verified. Resolution: A5-late-browser-corrected-red.log proves intended missing close; A5-late-browser-green.log seven cases pass. Severity: Low. Native TDD command: bun run test --runTestsByPath src/**tests**/engine.test.ts --coverage=false. Case TDD-US1-FR004 late browser. Evidence A5-late-browser-red.log. Expected missing late-launch cancellation assertion; actual TypeError reading evaluateOnNewDocument because the new fixture browser.newPage returned undefined. Reject as intended Red. Complete the controlled page interface with the same methods as the existing fixture and rerun to prove the intended close/no-page assertion before production. No product code changed for the fixture correction.

## DEF-US1-031 — Real native checkpoint hits unhandled capture-extension navigation failure

Status: Verified. Resolution: controlled CJS/ESM ordering Red/Green and delayed real install Red/Green, plus A5-native-lifecycle-complete-checkpoint-restored.log39pass/1existingtodo. Severity: Medium. Command: (cwd packages/runner) bun run test --coverage=false. Owner BDD-US1-FR004. Evidence: A5-native-lifecycle-complete-checkpoint.log (1failed,36passed,1 existingtodo). Expected all native checks Green; actual real Chromium capture launch rejects net::ERR_BLOCKED_BY_CLIENT for capture options.html. Puppeteer-stream starts options navigation without awaiting its promise, so rejection kills the child process. Native types pass. Preserve exact media/closure assertions and existing timeouts. Investigate browser registration/navigation readiness and error ownership using real-runtime diagnostics; do not count an isolated retry as root-cause proof.

## DEF-US1-032 — Patch validator resolves only the top-level installed version

Status: Verified. Resolution: A5-patch-resolver-strictness-green.log3pass; A5-capture-order-patches-validate-restored.log validates3dependencies/4files. Root validator compatibility check separately pending. Severity: Medium. Command: (cwd packages/runner) bun run patches:validate. Gate evidence: A5-capture-order-patches-validate.log. The capture package correctly uses patched puppeteer-core24.43.1 nested beside direct25.12.0; current validator assumes one version and rejects the direct version mismatch. Preserve version, file containment and changed-line type checks; add exact nested-version resolution with a synthetic installed-tree regression before changing the validator. Do not suppress or skip validation.

## DEF-US1-033 — Shared lease test move retained the wrong import depth

Status: Verified. Resolution: A4-initial-request-context-owning-corrected-red.log and A4-initial-request-context-green.log. Severity: Low. Command: bun run test --runInBand --runTestsByPath test/app/lib/runnerExecutionLease.test.ts --coverage=false. Evidence: A4-initial-request-context-owning-red.log (module resolution failure, rejected as intended Red). Move the single protocol-unit owner into the parent instrumentation stack and compute its import path using pathlib/os.path.relpath; original four parent traversals were one too many. Correct path is ../../../packages/runner/src/protocol. No production change before corrected semantic Red.

## DEF-US1-034 — Expiry-driver writer expected formatted text before formatting ran

Status: Verified. Resolution: A4-native-lease-expiry-outer-corrected-red.log proves runtimeExpiredfalse with valid fixture; A4-native-lease-expiry-outer-green.log passes actual encoded expiry/terminal scenario. Severity: Low. The first expiry-fixture edit aborted on an exact-text assertion (runtimeAccepted spacing), while shell execution continued to create/run the new scenario. A4-native-lease-expiry-outer-red.log therefore lacks the expiry hook and must not count as intended Red. Correct the owned driver against its actual source before rerunning as A4-native-lease-expiry-outer-corrected-red.log; require runtimeExpired=false from the implemented fixture and missing controller tick, not an undefined fixture field. No production runtime change before corrected Red.

## DEF-US1-035 — CLI watchdog fixture exports a future helper before it exists

Status: Verified. Severity: Low. Command: native whole-file heartbeat-protocol.test.ts. A4-cli-watchdog-red.log fails during esbuild transform and is not intended Red. Use conditional typeof exposure; A4-cli-watchdog-corrected-red.log proves no timer scheduled with the prior protocol/dispatch case Green. A4-cli-watchdog-green.log confirms both cases pass.

## DEF-US1-036 — CLI disconnect fixture omits proxy cleanup

Status: Verified. Severity: Low. Existing stopActiveEngines calls stopTCPProxy even with zero engines; new fixture omitted it. Complete the unchanged helper interface. A5-disconnect-shutdown-corrected-red.log proves two intended missing shutdown behaviors before production. A5-disconnect-shutdown-green.log verifies both owners Green.

## DEF-US1-037 — Dashboard action scenario bypasses its native probe compilation owner

Status: Verified. Severity: Low. New integration scenario initially lived under test/app/actions and direct Jest ran it as ordinary unit work; its raw react-server/tsx probe then loaded next/navigation client context and failed createContext before assertions. A5-dashboard-stop-action-red.log is invalid Red. Move unchanged scenarios to test/mcp/workflows/browser-runner-stop.test.ts and use the documented repository test runner, which compiles public Next adapters once. No production change before corrected semantic Red.

## DEF-US1-038 — Logical clock rebase origin may legitimately be negative

Status: Verified. Severity: Low. A4-suspend-clock-rollback-green.log is failed output, not Green qualification: after correctly rebasing a backwards uptime transition, subsequent read wrongly rejects the finite negative logical origin as an invalid OS reading. Keep actual source readings finite/nonnegative; only the derived origin may be negative. Core-clock owner stays separate from default-lease integration owner so each whole file has one boundary. Verify core owner before integrating consumers.

## DEF-US1-039 — Formatted CLI fixture bypasses the shared clock adapter

Status: Verified. Severity: Low. New shared-clock dispatch fixture fallback was updated in all compact relative-module stubs but missed the first formatted nested ternary. A4-default-clock-native-green.log contains1unexpectedTypeError,15pass and is not Green qualification. Complete that fixture dependency interface, preserve all assertions, rerun three whole native owners. Parent default-clock integration already10Green.

## DEF-US1-040 — Native test adapter style fails the unchanged lint gate

Status: Verified. Severity: Low. Scoped A4-key-clock-lint.log reports11errors/4warnings in new native fixture loaders and one never-reassigned root test binding. Keep lint rules enabled: use jest.requireActual for dynamic dependencies, rename local module containers, retain CJS parameter strings, type mock arguments without unused bindings, and use const where appropriate. Verify lint, types, and affected whole test owners; no product behavior or assertion is relaxed.

## DEF-US1-041 — Behavioral checkpoint passes but required coverage gates remain incomplete

Status: Verified. Severity: Medium. A4-native-critical-coverage.log:21suites101pass/1existingtodo; current source coverage44.38% includes uncounted CLI adapter execution (index0), uncounted browser-bound playback helper (presentation0), and gaps in engine/credential/retry/validation paths. A4-shared-critical-coverage.log:44pass; clock100%, protocol93.81S/95.72B/90F/97.1L misses95S/F. These are failed coverage qualifications, not failing behavior tests or intended Red. Keep plan90/85/90 changed-module and95/90/95 critical thresholds. Correct accounting at one owner, add meaningful missing-path regressions, and rerun appropriate owning gates before slice completion.

DEF-US1-034 recurrence: connectivity-copy writer expected a one-line formatted JSX condition and aborted before writing. A4-free-connection-guidance-green.log retains two unchanged missing-copy failures and is not Green evidence. Apply-patch correction plus A4-free-connection-guidance-restored.log2pass verifies resolution; dependent shell mutation/check sequences now stop on failure.

Coverage checkpoint progress: shared critical owner now passes 50 cases at 100% statements/functions/lines and 99.2% branches (`tdd/evidence/A4-shared-critical-coverage-restored.log`). Canonical CLI adapter accounting is repaired without changing source counter identity (`A4-cli-canonical-adapter-refactor.log`), with actual CLI coverage now measurable rather than omitted. Native critical component check has 63 passing tests, 99.06% statements / 95.96% branches / 98.11% functions / 100% lines; per-file retired-store function coverage still missed 95%, so this is not a passing qualification (`A4-native-critical-restored.log`). An idempotent-save characterization covers the remaining callback; final exact gate rerun remains pending. Engine/CLI checkpoint coverage remains open.

## DEF-US1-042 — Proxy fixture repeats socket close indefinitely

Status: Verified. Severity: Low. Native whole-file command `bun run test --coverage=false src/__tests__/proxy.test.ts` unexpectedly failed with a stack overflow in the new socket fixture (`tdd/evidence/A4-native-proxy-characterization.log`). Expected real-ingest close assertions; actual mock destroy emitted close on every repeated invocation, unlike Node's idempotent socket destruction. Add the fixture's destroyed state without changing production code or weakening assertions. All three cases pass in `tdd/evidence/A4-native-proxy-characterization-restored.log`. Original failure is characterization setup failure, not intended missing-behavior Red.

## DEF-US1-043 — Graceful shutdown destroys the capture before recorder final data is flushed

Status: Verified. Severity: High. Prior partial resolution: A4-capture-final-chunk-bounded-green.log15unit cases, actual final-frame Green27.918s and complete A4-native-final-capture-qualified.log33 suites / 154 pass/all coverage gates validate final capture flush and real closed outputs. Packaged rebuilt Linux self-test passes. Full native checkpoint `tdd/evidence/A4-native-complete-qualified.log` has an unexpected actual-media failure in BDD-US1-DEC001: playback ended but decoded encoded-final-frame assertion false. Earlier complete native run148pass (`A4-native-complete-coverage-restored.log`) still failed its separate coverage threshold; isolated retries do not qualify a fix. Inspection of installed puppeteer-stream confirms stream.stop requests MediaRecorder.stop and closes its websocket after all final data is sent; stream.destroy prevents those buffered messages reaching the encoder. Current Engine graceful stop destroys capture and ends stdin immediately. New whole-file inner regression `A4-capture-final-chunk-red.log` proves capture.stop was never called and the final chunk is discarded (one intended failure,12pass). Flush capture to EOF within the existing absolute close budget before ending stdin; attach physical encoder close observation before EOF can close it. Emergency stop remains bounded. Require unit Green plus actual native final-frame evidence before closure.

DEF-US1-041 native remediation verified: `A4-native-final-capture-qualified.log` all33suites154cases pass, original TODO unchanged. Required global changed-module90/85/90/90 and each critical95/90/95/95 thresholds pass. Shared critical owner also passes. Combined affected app coverage and canonical source threshold evaluation remain pending, so this defect stays In Progress.

## DEF-US1-044 — App milestone used raw Jest rather than the instrumented coverage wrapper

Status: Verified. Severity: Medium. `tdd/evidence/A4-final-affected-app-coverage.log` was started with `bun run test ... --coverage`. The ordinary test runner builds uninstrumented native application probes, so raw Jest cannot qualify canonical native source counters; required route is `node scripts/run-mcp-coverage.mjs ...`. Stop only that owned process tree before it can be mistaken for passing qualification. Preserve its output as aborted configuration evidence. Use the existing safe worker calculation (8 on this16CPU/available-memory machine), existing PostgreSQL-aware phase budget, and unchanged thresholds. Formatting gate also found18source/test files needing normalization (`A4-final-changed-format-check.log`); format before restarting the current-source qualification. Repeat owning checks affected by changed source, retain unchanged native semantics only with explicit current owner evidence. No test, source, timeout or threshold is removed.

DEF-US1-043 reopened: formatted current-source full native rerun again fails the real encoded-final-frame check (153pass/1failure/1existingTODO). Recorder final-chunk unit fix remains valid but does not fully explain/eliminate the media failure; no passing single retry is accepted as closure. The retained final-capture log now contains this failed current attempt; its qualification is withdrawn. Add failure-only actual-result diagnostics (RGB/decode error/event/closure fields) to its existing owner, reproduce under current workload and investigate capture/paint/encoder boundaries without weakening the color assertion. A4/A5 final gates remain blocked.

## DEF-US1-045 — Real-media fixture assumes capture samples a short marker under load

Status: Verified. Severity: Medium. Four concurrent real captures (`A4-capture-diagnostic-load-{3,4,5,6}.log`) causally isolate three false final-marker results: decoded RGB is blue, no decode error, encoder exits0 with no kill, matching drain/current clip, clip ended and no successor. The half-second marker can be skipped by the display-capture pipeline under contention; polling/end-time alone cannot prove sampled pixels. Retain product recorder-tail fix from DEF-US1-043, then synchronize only the controlled media fixture's short terminal segment with the actual FFmpeg preview output before releasing its real ended event. Assert an additional finalMarkerCaptured flag, retain actual final-frame decode, real ended/no-successor/output-closure checks, and unchanged60s child/65s test and60s/300s product bounds. Immediate Stop still closes before completed clip and fails the positive completion condition. Intermediate paused-source experiment stalled the encoder input and hit unchanged60s timeout (`A4-capture-marker-handshake-green.log`, rejected as Green); keep the short terminal segment playing until its real encoded preview is acknowledged instead. Three concurrent graceful runs and immediate-stop negative control satisfy all conditions (`A4-capture-marker-load-verification.json`); identical four-positive contention check and complete owning native suite are pending before Verified. No production delay/FPS policy was added for fixture synchronization.

Final A4/A5 qualification: DEF041/043/044/045 Verified. All current app whole-file owners execute across the affected inventory, its previously unexecuted complement and two critical-unit files (476 owners: 474 passed plus 2 unchanged opt-in skipped suites), with 5,021assertions passing and 11 unchanged opt-in cases skipped. Canonical workflow392 pass. Global/source gates pass in `A4-final-combined-qualified.log`; explicit new critical per-file95 S/F/L, 90 B passes in `A4-critical-per-file-qualified.json`. Current-source hashes and counter maps match before merge. Native33 suites / 154 pass/1existingTODO/all unchanged thresholds pass in `A4-native-marker-audio-qualified.log`. Four equivalent concurrent captures observe the real final marker (`A4-capture-marker-audio-verification.json`); continuous fixture audio permits holding the displayed marker without starving FFmpeg. Immediate Stop remains a negative control; real ended/no-successor/final-frame/closed-output assertions and deadlines remain intact. Intermediate paused-without-audio and short-segment-loop stress timeouts are rejected experiments, not qualifying results or exceptions. Build/types/lint/audit/patch/format gates qualify their current owners.

## DEF-US1-046 — Browser configuration test assumes a combobox trigger

Status: Verified. Severity: Low. `A6-manual-fallback-browser-green.log` fails because the installed HeroUI Select exposes its trigger as a labelled button, while the test assumes combobox. The actual accessibility snapshot contains the expected new labels and values. Use the real accessible button role and retain every selection, disabled scheduling, persistence and save assertion. This unexpected fixture failure is not missing-behavior Red. Rerun the actual browser journey against the unchanged current production build.

DEF-US1-046 follow-up: corrected-role journey reaches Save, but the actual first-visit consent banner intercepts its click (`A6-manual-fallback-browser-role-fix.log`). Exercise the real Reject optional choice before configuring; do not force-click, hide the banner, or change timeouts.

## DEF-US1-047 — Expected Runner business denials use exceptions and unconditional error reporting

Status: Verified. Severity: Medium. User identified the new scheduled configuration FEATURE_RESTRICTED throw. The shared MCP boundary converts it safely, but it still uses an exception for an expected denial; Runner action catches also call captureUnexpectedError unconditionally. Replace expected new policy denials with explicit safe results, preserve transaction rollback and authority checks, and add regressions proving expected denials are not reported while unexpected failures remain observable.

DEF-US1-046 verified: actual first-visit privacy choice, installed accessible Select triggers, saved key state and reload persistence pass in `A6-manual-fallback-browser-persistence.log`. No force click, timeout increase or declared scenario omission.

DEF-US1-047 progress: corrected direct-resource Red `A6-scheduled-denial-exact-code-red.log` proves FEATURE_RESTRICTED is thrown for valid, authorized scheduling input. New scheduling and existing remote-plan checks now return a safe branded resource denial before mutation/audit; MCP preserves its public isError envelope and denied metrics/activity. `A6-business-results-affected-green.log` passes all four configuration cases and Sentry controls; its sole failure is the obsolete Free configuration capability assertion (old paid-only policy). Update that assertion to the approved Free policy while retaining all remote Pro restrictions, then rerun owning files. Earlier missing retryKey evidence is explicitly rejected, not claimed as behavioral Red.

## DEF-US1-048 — Ingest fixture supplies a retry field that control deliberately excludes

Status: Verified. Severity: Low. `A6-single-ingest-red.log` is rejected as missing-behavior evidence: all control calls fail strict input parsing because the fixture added retryKey to revision-based control. Remove that unsupported field, retain current revision semantics, assert the actual expected denial code, and require positive Pro controls before implementing the ingest policy.

DEF-US1-048 follow-up: no retry field remains, but authentication still fails because returning an unawaited nested probe lets the enclosing finally restore fetch before its local OAuth calls. Diagnostic `A6-ingest-wire-diagnostic.log` reports no token payload, not a policy denial. Await the nested probe within the fetch guard; require empty transportErrors as a fixture precondition in every ingest case. Both earlier runs are rejected as behavior Red.

## DEF-US1-049 — Browser fixture races the real consent-save reload

Status: Verified. Severity: Low. Current-source browser completion run `A6-current-browser-refactor.log` reaches configuration, but Save retries across a same-URL navigation and finds reset form state. The consent component intentionally reloads after its asynchronous save. The fixture clicked Reject optional then immediately edited before that real reload. Await the actual load event concurrently with the choice, then require the reloaded configuration heading before editing. Keep the existing timeout, normal clicks and all persistence assertions; do not suppress product consent behavior.

DEF-US1-048 verified: all six initial positive controls authenticate and pass in `A6-single-ingest-authenticated-red.log`; only the four intended missing-ingest-policy behaviors fail. The ten-case post-implementation owner passes in `A6-single-ingest-green.log`. DEF-US1-049 verified by the current-source full browser journey in `A6-browser-consent-reload-green.log` (1pass,40.8s).

DEF-US1-047 verified: current-source 12 complete affected suites /169 cases pass (`A6-complete-affected-refactor.log`), including direct no-throw scheduling denial, preserved MCP error envelope, no state writes on denial and ten Sentry classification controls. Unexpected infrastructure and unrelated-component failures remain reported. Ingest and retained-source plan denials also return safe results before success audit; existing transaction-rollback exceptions remain caught at their established boundary and known Runner business denials are not captured by Sentry.

## DEF-US1-050 — Legacy native BDD still expects manual configuration to require a Runner grant

Status: Verified. Severity: Low. `A6-workflow-completion-coverage.log` full owning lane:391pass/1failure, BDD-US5-003 runners.feature manual configure_stream_session/no_runner_access. Expected test denial, actual authorized success is the approved new Free/manual policy. Preserve the scenario/artifact ID and example, change its expectation to safe success and title to reflect manual availability. Run its complete owning native feature without coverage before the required fresh completion lane; do not delete the example, restore the paid-only gate or waive the failed lane.

## DEF-US1-051 — Omitted control mode can hit a database constraint during a saved Scheduled edit

Status: Verified. Severity: Medium. Code inspection during A6 checkpoint found that explicit Scheduled/fallback input is safely rejected, but omitting controlMode on an existing Scheduled session preserves its stored control while accepting fallback mode. The database pair constraint then raises an unexpected save failure instead of an expected INVALID_INPUT result. Add both authenticated-entry regressions with unchanged stored revision/key/state before changing validation. Validate the effective existing control under the relevant lock/CAS and return a safe denial before mutation/audit; do not clear Scheduled implicitly or report the constraint as an unexpected Sentry issue.

## DEF-US1-052 — Checkpoint reporting helper passes coverage class instances to the raw JSON gate

Status: Verified. Severity: Low. First temporary A6 coverage helper reports Invalid executable source coverage for every selected source because Istanbul map.toJSON returns in-memory FileCoverage instances; spreading those instances in the existing gate drops prototype-backed counter fields. All owning tests passed; this is reporting setup failure, not an accepted coverage exception. Serialize to the actual Istanbul JSON contract before calling the unchanged repository gate, as the established A4 gate already does. Preserve the failed report/log and validate only after the current native workflow producer has completed. No repository policy, threshold, source counter or test is changed.

## DEF-US1-053 — Shared policy owners need their existing contract suites in scoped coverage

Status: Verified. Severity: Medium. All392 native workflows and422 affected/discovery tests pass, but unchanged canonical per-source thresholds still fail for shared workflow retry branches, tool fallback registration and input schema validation in `A6-scoped-coverage-qualified.json`. Admission97.53S/96.42B/100F/98.57L and Sentry100 satisfy their stricter gates. Add the existing whole-file retry/input/unknown-tool/contract owners rather than repeating unrelated repository suites or lowering thresholds. Keep the completed native workflow evidence at its single owning execution; collect only additional relevant current-source counters and verify mappings/source hashes before merging.

DEF050 verified: complete owning native feature73pass and fresh required workflow392pass (`A6-final-workflow-completion-coverage.log`). DEF051 verified: current13 configuration cases, nine action cases and ten Sentry cases pass in `A6-final-refactor-green.log`; current browser save/reload also passes. DEF052 verified by successful raw-JSON gate evaluation after serialization; subsequent failures are honest individual thresholds under DEF053, not invalid report objects. No product source or policy changed for that reporting correction.

DEF-US1-053 verified: `A6-scoped-coverage-pass.json` has ok:true/errors:[] under unchanged canonical source policies and stricter95 S/F/L,90 B for admission/benefit/Sentry critical checks. Existing contract/input/retry/discovery owners and two real commit/rollback characterizations close the gaps; workflow91.30B, all other scoped canonical branches94.11–100. Native392 passed once at its final source owner. No unrelated full repository rerun, source exclusion from the declared checkpoint, lower threshold, fabricated Red or foreign-source report was used. Full whole-feature/global release gates remain mandatory and not claimed by this scoped checkpoint.

## DEF-US1-054 — Native ATDD fixture is outside its step-discovery glob

Status: Verified. Severity: Low. `A7-free-acceptance-generation.log` reports "Can't guess test instance" because the new acceptance binding imports the recorded native fixture from BDD support, outside ATDD step discovery. Register a re-export in the existing ATDD support glob and import it from the binding. Reuse the same fixture; do not add a fake successful step or classify generation failure as a behavioral Red.

## DEF-US1-055 — Concurrency-denial acceptance was assigned to a client that cannot observe that decision

Status: Verified. Severity: Medium. A136/U136 observe the reason an additional start is denied after extended streaming. The native client polls permitted jobs and never receives the dashboard/MCP Start denial; admission is decided by the API. Preserve both IDs and outcomes, but move A136 to the native MCP ATDD owner and U136 to the direct admission service owner. Keep real native continuous playback across month boundaries under A135/U135. This changes evidence ownership only, without dropping runtime proof, adding a quota, creating a second execution owner or changing product requirements. Use a valid active lease plus controlled long-history fixture data for the admission observer; do not fake a server denial inside the client.

## DEF-US1-056 — Native fixture edit used the package working directory with root-relative paths

Status: Verified. Severity: Low. The first A7 native fixture edit exits FileNotFoundError before changing files; its following shell command starts the old two-case file because the shell did not stop on the edit failure. `A7-native-unlimited-hours-initial.log` is rejected as evidence for the new behavior. Separate root-relative fixture edits from the package test invocation and require successful edits before running the new whole-file owner. No production code was changed, and no new-case Red or Green is claimed from that run.

DEF-US1-056 follow-up: the first inner continuation invocation also used a root command with a package-relative test path. Its initial log is rejected as missing-file setup evidence. Keep root edits and package commands in separate calls with an explicit package working directory and a file-existence check. The actual unit belongs in the existing execution-runtime owner, so reuse its fixture instead of creating a speculative schedule module.

## DEF-US1-057 — A7 launched a broader app run than its checkpoint required

Status: Verified. Severity: Low. A7 changes the native workflow routing script and test owners while all118 retained application source digests are identical to A6. Starting the entire app coverage producer was unnecessary for the complete-affected-suite checkpoint. It was explicitly interrupted (exit1) after completed whole-file results were recorded. `A7-story-app-coverage.log` is not an overall Green or qualifying full coverage report, and its partial counters are not merged. Complete current native suites and394 native workflows pass. `A7-scoped-coverage-pass.json` verifies unchanged A6 owning application counters against exact source hashes and counter maps, then combines the current workflow owner under unchanged thresholds. `A7-refactored-app-inner-green.log` separately passes the changed admission-acceptance whole file. Preserve full application, integrated story and release validation as mandatory later gates; no threshold or requirement is waived.

## DEF-US2-058 — Destination probe object literals widened beyond the action input union

Status: Verified. Severity: Low. `B1-initial-types.log` reports four fixture type errors after the real save action gains its typed signature. Keep the fixture update object literal typed with `as const` and use an explicit credential-action union guard. `B1-editor-types.log` and the complete browser build type phase pass; no assertions or production input types are weakened.

## DEF-US2-059 — Client editor imported a server-internal DTO type

Status: Verified. Severity: Low. `B1-editor-lint.log` rejects a server-internal import even though it is type-only. Derive the client view type from the safe existing server-action result instead. `B1-editor-boundary-lint-green.log` has zero errors, retaining the existing RunnerStatus warning. No lint rule or client/server boundary is bypassed.

## DEF-US2-060 — Destination browser input selector also matched the legacy stream editor

Status: Verified. Severity: Low. `B1-name-boundaries-browser-first-green-attempt.log` fails all four cases with a strict locator ambiguity for RTMP URL. The newly created destination dialog and the existing stream configuration both use that label. Scope field and save-button locators to the actual dialog, keeping the real provider popup and all persistence assertions. Rerun the four owning cases without rebuilding unchanged runtime code. This is not a missing-behavior Red or a product failure.

DEF-US2-060 verification: `B1-name-boundaries-browser-dialog-green.log` passes all4 cases in55.8seconds. The locator is scoped to the actual dialog; no assertions, name bounds, database checks or runtime code are weakened.

## DEF-US2-061 — Runner browser setup races consent hydration

Status: Verified. Severity: Low. `B1-delete-browser-red.log` contains the intended missing Delete failure plus an unexpected81-character case failure: a consent banner appears after the fixture's immediate `isVisible()` check and intercepts Add destination. The four boundary cases already passed unchanged before the deletion test. Each scenario uses a fresh visitor context, so await the actual Reject optional control, submit that choice through the real UI and await its reload before continuing. Do not force-click, hide the banner, weaken the name checks or classify this timeout as product Red. `B1-delete-browser-consent-restored-red.log` verifies the corrected setup before deletion implementation.

DEF-US2-061 correction and verification: an unconditional banner expectation also fails because banner visibility is policy-dependent (`B1-delete-browser-consent-restored-red.log`). Use the existing public Cookie preferences keyboard flow on `/legal/cookies`, reject optional categories in the real preferences dialog and await reload before entering Runner configuration. `B1-delete-browser-preferences-red.log` restores all4 prior boundary cases with only the intended missing Delete failure; `B1-delete-browser-green.log` subsequently passes all5 cases. No consent product code, pointer-force option, timeout or persistence assertion is changed.

## DEF-US2-062 — Legacy conversion did not narrow nullable Runner and credential fields

Status: Verified. Severity: Low. `B1-legacy-types.log` reports nullable runnerId passed to an equality predicate and nullable encrypted bytes passed to the decryption helper in `src/server/runner/destinations.ts`. Use an explicit null-scope predicate and empty-input normalization for absent keys; preserve supported orphaned legacy metadata and unchanged input types. This is a static-check defect, not intended product Red.

DEF-US2-062 follow-up: `B1-legacy-types-fixed.log` narrows the remaining failure to the isolated action mock’s self-referential transaction initializer. Add its explicit Promise return annotation; no runtime contract or assertion changes.

DEF-US2-062 verification: `B1-legacy-types-verified.log` exits0; runtime destination/action owners pass28 tests in `B1-legacy-rekey-green.log`.

## DEF-US2-063 — Immediate destination RESTRICT prevents complete creator deletion

Status: Verified. Severity: High. `B1-legacy-browser-cascade-defect.log` passes all editor/persistence assertions but fails the actual account-cleanup endpoint for both the legacy-conversion and retained manual-fallback journey (HTTP500 instead of204), followed by global cleanup failure. PostgreSQL reports the composite destination FK RESTRICT as the cause when users cascade-delete sessions and destinations in one statement. This is a real account-lifecycle regression, not missing environment setup and not acceptable fixture-only cleanup. Preserve direct referenced-target deletion protection while permitting complete owner cascades: use PostgreSQL statement-end NO ACTION for that FK, with the existing explicit service reference rejection retained. Add a database regression for complete creator cascade and retain referenced-destination rejection. Edit schema source only; no generated migration. Current app/native reports remain frozen to their original inputs until their runs finish; affected browser source schema must be recreated from the final schema before verification.

DEF-US2-063 first correction: `B1-owner-cascade-green.log` still fails the account-delete assertion after NO ACTION. The isolated fixture now returns only PostgreSQL code/constraint diagnostics to identify any remaining owner dependency. A direct unbundled TSX invocation fails in Next RSC import setup (`B1-owner-cascade-diagnostic.log`); this is rejected setup evidence, never behavioral Red. Use the established compiled native probe route. Browser rerun continues independently on fresh schema.

DEF-US2-063 diagnosis: `B1-owner-cascade-constraints.log` confirms the corrected database has NO ACTION and session cascade, but nested owner cascades still check a target before its session references are removed. The initial extra regression assumed a privileged raw SQL target DELETE must enforce the application business rule; that is beyond the approved public contract and prevents conventional junction cleanup. Correct its observer to the actual owner-locked delete action, which must return RESOURCE_IN_USE and preserve references, followed by the actual complete owner SQL cascade. This retains every user-visible rejection/persistence assertion and the existing deletion workflows; it does not relax access control or expose a bypass through an application boundary. Both parent references use CASCADE for junction lifetime. No unsupported deferrable constraint, trigger, custom migration or approval override is introduced. First run the corrected real action/cascade test on NO ACTION to retain behavioral Red before changing the FK again. Diagnostic commands outside the checkout could not resolve dependencies; rejected setup logs are not product failures.

DEF-US2-063 verification: `B1-owner-cascade-final-green.log` passes23 whole-file tests, including actual RESOURCE_IN_USE rejection followed by complete owner cascade with zero targets/references. `B1-cascade-final-browser-green.log` passes all7 real journeys and cleanup. The browser run reuses unchanged UI/action runtime code on the freshly recreated database; only FK metadata changed since the compiled bundle. Final production build remains mandatory. No generated migration or cleanup bypass.

## DEF-US2-064 — URL trim removes forbidden controls before validation

Status: Verified. Severity: Medium. `B1-validation-matrix-red.log` shows a trailing literal newline is accepted because the schema trims before the URL helper checks controls. That mutation increments the revision and makes later invalid edits conflict. Validate the original bounded URL for controls before trimming and syntax normalization; preserve ordinary whitespace handling, safe results and rollback assertions.

DEF-US2-064 verification: `B1-validation-matrix-green.log` passes all24 owning cases; invalid matrix requests preserve the authoritative row.

## DEF-US2-065 — Validation fixture did not narrow action result unions

Status: Verified. Severity: Low. `B1-current-types.log` flags an inferred empty array and access to code on successful action results. Type the safe fixture observation array and narrow code with an in-check. Runtime assertions remain unchanged; rerun type checking. Scoped lint already passes in `B1-final-scoped-lint.log`.

DEF-US2-065 verification: `B1-MCP-normalization-types.log` exits0 after explicit observation typing/result narrowing.

## DEF-US2-066 — Free acceptance fixture seeds only the retired scalar credential

Status: Verified. Severity: Medium. `B1-final-workflow-first-failure.log` passes407 BDD cases but both native ATDD journeys report zero admissions instead of one. The fixture creates broadcasts through real MCP (now correctly normalized) then prepares valid private credentials using SQL only on stream_sessions. The selected authoritative destination therefore remains keyless, and Start correctly rejects it. Update only this fixture preparation to seed both owned representations with the same encrypted credential, maintaining credential/config revisions. Do not change the product credential guard or any concurrency/lease/terminal assertion. Run the whole two-scenario ATDD owner first, then repeat the milestone workflow coverage producer with clean job-owned output. The failed producer is archived under coverage/runner-B1-workflow-failed and is not qualifying merged coverage. Production source digests are unchanged.

DEF-US2-066 verification: `B1-ATDD-credentials-fixture-green.log` passes both complete owning scenarios in8.5seconds. All original lease/concurrency/terminal assertions remain intact; only prerequisite credential preparation changed. The full workflow coverage lane is rerun from clean owned output; its earlier failed counters are not merged.

## DEF-US2-067 — Direct diagnostic bypassed the established server probe build

Status: Verified. Severity: Low. The first B2 media-control diagnostic invoked the source directly with Node+tsx and React server conditions. Next client context initialization failed (`React.createContext` unavailable), before any product behavior ran. This is fixture setup evidence, never product Red. Use the established bundled `buildMcpCoverageProbes` adapter, as the owning Jest/workflow commands already do; qualify the existing single-target Free media path before recording the new multistream outer Red. The diagnostic log is `/tmp/B2-media-control.log` (subsequently replaced by the corrected diagnostic); no production source changed.

DEF-US2-067 verification: established compiled server adapter and non-recursive OS infrastructure alias pass the real single-target control (`tdd/evidence/B2-media-fixture-control.log`). All media assertions hold.

## DEF-US2-068 — Snapshot observer expected a lease before first dispatch

Status: Verified. Severity: Low. `B2-selected-targets-inner-green.log` reaches the final signature assertion: the observer compares the first heartbeat signature with the admission row read before dispatch, whose lease ID is correctly null. Read the independently persisted lease ID after dispatch. Keep all identity, target hash, credential snapshot and signature checks; target snapshot ID comparison is set-based while selection positions remain ordered. This is a fixture defect, not missing cryptographic verification.

DEF-US2-068 verification: both whole-file admission/selection tests pass in `tdd/evidence/B2-selected-targets-inner-green.log`, including independent persisted lease identity and immutable target hash verification.

## DEF-US2-069 — Native observer inferred a zero-argument engine factory

Status: Verified. Severity: Low. `/tmp/B2-native-types.log` reports tuple indexing errors because Jest infers the observer's zero-argument factory, despite the production factory receiving the assignment. Type its observed job parameter explicitly. Runtime tests already pass; rerun native typecheck without changing assertions or product policy.

## DEF-US2-070 — Failed multistream fixture left an unused receiver process

Status: Verified. Severity: Low. The first expected two-target media Red started only one target, leaving the unused receiver waiting for input. The parent then killed the driver before its sequential engine shutdown completed. Give the driver an owned process group and terminate that complete group during fixture cleanup; no unrelated process is signaled. The one identified orphan was terminated explicitly. `B2-multistream-cleanup-green.log` passes the unchanged real media assertions, and process inspection confirms zero remaining FFmpeg children. Product output-closure assertions run before fixture cleanup and remain intact.

DEF-US2-069 verification: the factory now observes the public FreeExecutionJob parameter, preserving optional destination typing; package typecheck passes (`/tmp/B2-native-types.log`).

## DEF-US2-071 — Independent-device media preparation reused an owner-wide retry key

Status: Verified. Severity: Low. `B2-independent-outer-baseline.log` passes the original two-target case but the two-device setup admits only one configuration. Both requests used the same owner-wide retry key with different runner IDs; the product correctly prevents mismatched retries. Make fixture keys device-specific. The distinct API state owner already passes both simultaneous admissions, isolated dispatch and independent Stop (`B2-independent-inner-baseline.log`). This setup failure is not product Red and does not justify a product change.

DEF-US2-071 diagnostic correction: the safe probe result showed both configurations rejected before retries. The custom RTMP media target is intentionally keyless, but fixture named-save requested replace with an empty key. Use clear for a keyless target, retaining replace for provider keys. The device-specific retry-key fix remains appropriate preparation for concurrent writes. Both are fixture corrections; no product policy changes.

## DEF-US2-072 — HeroUI test adapter dropped pressed-state accessibility metadata

Status: Verified. Severity: Low. `B2-selection-component-green.log` reaches the pressed-state assertion, but the repository's Button test adapter discards aria-pressed. Forward that real button attribute; preserve the selection, disabled-key and secret-free UI assertions. The preceding Red was absence of selectable destinations, not an import failure.

DEF-US2-071 verification: `B2-independent-outer-green.log` passes both native journeys; `B2-provider-outer-baseline.log` subsequently passes all5. No remaining FFmpeg children after the run.

## DEF-US2-073 — Output-process startup error could escape the local fan-out

Status: Verified. Severity: Medium. `B2-output-refactor-check.log` passes24 cases including queue isolation, bounded buffering, flush and shared encode, but the process-start observer triggers an unhandled child error. Contain startup errors in the affected destination, clear its queue, and preserve the other output. Do not forward raw process errors containing keys. Rerun the whole output/engine owners before continuing the slice checkpoint. B3 will add destination status/retry; this repair only contains the process fault.

## DEF-US2-074 — Browser fixture cleanup encountered a transport reset

Status: Verified. Severity: Low. `B2-browser-cleanup-reset.log` completes all seven product scenarios, but the invalid-name case's AfterScenario fails with `apiRequestContext.delete: read ECONNRESET` while deleting its disposable auth fixture. Six cases report success; assertions for the seventh completed before cleanup. The fixture DELETE is idempotent. Use Playwright's documented maxRetries=2 for that cleanup request: it retries ECONNRESET only, never HTTP error statuses or product assertions. Rerun the complete browser owner. Do not claim the failed execution as a passing browser checkpoint.

DEF-US2-072 verification: safe selection/component whole owners pass9 cases in `B2-public-selection-green.log`; actual browser pressed-state/setup and conversion pass in `B2-browser-green.log`.
DEF-US2-073 verification: whole native package35suites/170tests passes with unchanged TODO; output module is L100/B100/F100/S98.5, and complete ten-source policy gate passes.
DEF-US2-074 verification: all7 browser scenarios and cleanup pass in `B2-browser-green.log`; no assertion or server behavior relaxed.

## DEF-US2-075 — Active device reassignment could strand the original Stop route

Status: Verified. Severity: Medium. `B2-active-assignment-red.log` passes14 selection/privacy/provider/rollback cases but both MCP and legacy-dashboard assignment changes incorrectly succeed for a dispatched broadcast with globally scoped targets. The admission remains bound to the original device while the session moves, so future Stop could miss the original outputs. Under the existing creator lock, reject device/source reassignment while a nonterminal admission exists, with normal CONFLICT results and no partial revision/assignment change. Keep future destination edits and inactive reassignment available. Rerun the complete owning file and affected milestone suites before qualifying B2.

## DEF-US2-076 — Safe session projection left two status readers on the retired raw error field

Status: Verified. Severity: Low. `/tmp/B2-final-types.log` identifies the Runner list's two Boolean lastError reads after raw diagnostics were removed from the public session response. Use hasError in those status projections, preserving the same visible state without exposing raw process data. The new legacy-assignment fixture also needs its existing StreamMode enum type explicitly narrowed. Rerun types and affected owner tests; do not reintroduce the raw error field or weaken TypeScript.

## DEF-US2-077 — Generic workflow fixture used a placeholder ciphertext

Status: Verified. Severity: Medium. `B2-complete-workflow-coverage.log` passes410/414 scenarios; two generic Start scenarios fail INVALID_INPUT. The affected app owner (`test/mcp/workflows/runners.test.ts`) fails the same asynchronous Start assertion. Its fixture stores literal private-workflow-key in encrypted_stream_key; capture correctly cannot decrypt it. Prepare the existing synthetic key with the real encryptString function before seeding. Preserve every authorization/admission/async-state assertion. Run the whole app owner and native Runner workflow owner before repeating complete qualification. Failed producer counters are not qualifying evidence.

## DEF-US2-078 — Free acceptance fixture verifies the retired scalar target identity

Status: Verified. Severity: Low. The same complete native run fails both ATDDs at leaseVerified; the extended case returns before its duration assertions. It independently hashes the session ID from the old scalar job. New admissions correctly bind the selected named destination ID. Derive that ID from the earlier public configuration response and compute the expected hash with the original known fixture endpoint/key, never copying the job's asserted hash or signed claims. Keep all nonce/owner/device/session/generation/expiry/terminal and unlimited-hours checks. Run both whole owning ATDD scenarios first.

## DEF-US2-079 — Broadcast-control catch still logged expected limits and raw unknown diagnostics

Status: Verified. Severity: Medium. The broader workflow log exposed an expected RUNNER_CONCURRENCY_LIMIT console error. `B2-control-diagnostics-red.log` proves the dashboard catch both logs normal denials and forwards an unknown error's private detail to the reporter. Project known business errors directly to normal results before reporting. Preserve unexpected monitoring using a sanitized constant error, without raw ORM/process error objects or console logging. Whole action-owner tests must prove expected-denial silence and unexpected-error reporting/redaction, alongside actual resource integration tests. No business restriction or unknown-error reporting is removed.

## DEF-US2-080 — Media observer confused stopping liveness with completed output closure

Status: Verified. Severity: Low. `B2-complete-workflow-coverage-qualified.log` passes413/414 scenarios, but one independent device's final-frame observation is blue instead of green. The driver stops waiting when Engine.isRunning becomes false; closeOutputs sets that flag before capture/encoder/copy flushing completes. pollHeartbeat deliberately does not await media shutdown. Wait for the controller's generation-matched persisted terminal receipt (allOutputsClosed), then decode the completed receiver. Add safe RGB/complete observations and an explicit terminalObserved assertion. Preserve parallel independent-device execution and all media/cleanup assertions; do not serialize away product concurrency or weaken final-frame checks. Run all5 owning media scenarios under parallel workers before repeating the complete workflow producer. No production source change is required.

DEF-US2-075/076 verification: whole affected app producer passes424cases/25owners, including active and closed assignment, safe reads and status consumers; current types/lint and standalone/browser builds pass.
DEF-US2-077/078/079 verification: corrected focused owners pass15app cases,73native Runner workflow scenarios,2Free ATDD journeys and11action cases. The complete current workflow producer passes414scenarios with no skips/flaky cases (`B2-complete-workflow-coverage-final.log`).
DEF-US2-080 verification: durable generation/admission-matched journal lookup remains true after heartbeat acknowledgment. All5physical media scenarios pass with4workers (`B2-media-persisted-terminal-green.log`), then the complete414-scenario producer passes. No media/cleanup assertion is weakened and no product source changes for this fixture repair.

## DEF-US2-081 — Completed-slice source inventory omitted shared schema boundary evidence

Status: Verified. Severity: Low. The first combined gate reports shared schemas L94.28/B87.5, below unchanged L95/B90. Uncovered paths are inherited duration/timezone validation and public schema/default-filter access. Include the existing whole input-boundaries owner; add meaningful omitted-default/Creator Page field bounds and ambiguous legacy-plus-saved Runner selection samples. All31cases pass without production changes. The refreshed whole lease owner also passes18cases, including6new captured-snapshot fail-closed/signature observations. `B2-final-scoped-gate.json` passes all11 changed canonical source paths plus the retained ten-source native gate. No threshold or approved exception changes.

## DEF-US2-082 — Real output observer sampled before muxer progress tick

Status: Verified. Severity: Low. `B3-exhaustion-outer-red.log` contains the intended missing retry-exhaustion Red plus an unexpected existing FR008 result: healthy receiver bytes continue, but state is connecting. Progress-based telemetry intentionally arrives on FFmpeg's one-second progress tick; the observer samples250ms after a byte increment. Observe that tick within a bounded3seconds before taking the snapshot, retaining exact streaming/retrying and media assertions. Repeat the whole native owner; do not change production status to infer remote success from accepting local stdin bytes. The exhaustion case remains intended Red until bounded retries are implemented.

DEF-US2-082 verification: whole native owner in B3-exhaustion-outer-qualified-red.log now passes both retained receiver scenarios; only intended EC005 exhaustion remains Red (1failed/2passed). Exact streaming/retrying and delivery assertions unchanged.

## DEF-US2-083 — Markdown formatting changed native command paths

Status: Verified. Severity: Low. Formatting feedback found twelve registry command fields rendered src/**tests** as bold src/**tests** because the commands were not code spans. Restore the literal paths and protect the command cells with backticks. Executable test files and recorded command logs are unchanged. Repeat formatting and assert no src/**tests** paths remain; no production change or test rerun is needed for this metadata-only correction.

## DEF-US2-084 — Browser qualification overlapped a heavy standalone build

Status: Verified. Severity: Low. B3-final-browser-green.log passes8/9cases; the first deletion-preparation scenario fails its existing15-second dialog-closure assertion. Its snapshot has valid custom inputs and both Cancel/Save disabled, showing an in-flight save rather than a skipped click or returned product error. A simultaneous standalone Next build used15static workers; the owning CI browser-tests job instead needs browser-build and downloads its completed artifact. Serialize the local browser rerun after builds, retaining the exact production source, fixtures, assertions and deadlines. Do not infer a product regression from this mismatch or claim a timing waiver; if the same whole-owner failure persists in the corrected context, investigate the action/poll queue. Preserve this failed producer separately and exclude it from qualification.

DEF-US2-084 verification: the complete unchanged nine-journey browser owner passes9/9 in2.8minutes after the standalone build finishes (B3-qualified-browser-isolated.log), including the first previously failed scenario in26.9seconds. No application/fixture assertion/timeout changes; failed concurrent-build producer excluded. Local testing documentation records the CI-equivalent build/test order.

## DEF-US5-085 — Checkout result narrowing applied to portal URL

Status: Verified. Severity: Low. `C1-pro-setup-build.log` fails TypeScript at billing-panel.tsx:104 because a mechanical checkout consumer update also added an object-result branch to the unrelated portal URL, whose return type is string only. Restrict structured included-plan handling to generateCheckout callers and retain the portal string handling. Rerun the browser build and whole commercial owner; no tests or type checks are disabled.

## DEF-US5-086 — Billing journey used the wrong accessible role

Status: Verified. Severity: Low. While the first C1 billing Red producer was running, source inspection found the new journey selected Billing as a button; SettingsNavigation renders a HeroUI tab. Cancel that producer and select its actual tab role before claiming any product Red. Rerun the complete commercial browser owner; retain the original producer separately, with no production change or assertion weakening.

## DEF-US5-087 — New hardware onboarding expected an already connected device

Status: Verified. Severity: Low. `C1-onboarding-outer-green.log` passes4/5 journeys and the new Free creation reaches /dashboard/runners/<uuid>, but its final assertion expects Stream Configuration. The snapshot shows the correctly disconnected new device with Setup Your Runner, download buttons, and destinations. B3 manual configuration fixtures seed connected devices; this real creation does not. Verify the actual setup heading and all three OS download controls, preserving successful dashboard creation, URL and no-purchase checks. No product source change; rerun the whole browser owner against the same build.

## DEF-US5-088 — DOM role assertions used a Playwright-only option

Status: Verified. Severity: Low. `C1-guidance-build.log` fails TypeScript for the two new Testing Library getByRole calls because exact is not a ByRoleOptions property. The string name matcher is already exact by default; remove only the unsupported option, retaining identical accessible heading/link assertions. Repeat the whole enrollment owner and corrected build; no compiler or test gate is disabled.

## DEF-US5-089 — Public pricing overflows at mobile width

Status: Verified. Severity: Medium. Corrected build passes, then `C1-guidance-outer-qualified-green.log` passes5/6 journeys and reaches the new 390px responsive check; document.scrollWidth exceeds innerWidth. Earlier legacy-link and served-reference assertions pass. Retain the exact no-horizontal-overflow assertion, capture public element rectangles, identify the responsible layout and repair it. Repeat the whole browser owner and desktop/mobile visual review. No evidence yet establishes whether the overflow predates the Runner group; the approved mobile pricing surface must still fit.

DEF-US5-089 diagnosis: `C1-mobile-overflow-before.json` reports viewport390/document395 and identifies only the footer’s auto-sized flex child at395px. Constrain that existing max-width wrapper with w-full and min-w-0; no overflow is hidden and the page-level exact-width assertion remains unchanged. Scope includes this one shared footer sizing fix because it blocks the required pricing mobile review.

DEF-US5-089 verification: C1-mobile-fix-build.log passes; the unchanged exact-width assertion and all six browser journeys pass in C1-mobile-fix-browser.log. The mobile screenshot shows readable grouped Runner rows within 390px. No assertion or content is hidden.

## DEF-US5-090 — Native command repair still contained nested code spans

Status: Verified. Severity: Low. The post-format literal-path checker finds src/**tests** in registry command cells. The earlier DEF-US2-083 repair wrapped commands whose path substring was already in backticks, leaving nested code delimiters that formatting interpreted again. Canonicalize each native command cell to one code span with no inner delimiters and restore literal **tests**; run formatting twice and assert no corrupted path remains. Source code and executed native evidence are unchanged; no native rerun is needed for this metadata repair.

DEF-US5-090 verification: all40native command cells now have a single code span with no nested delimiters. Two consecutive Prettier passes retain literal src/**tests**; the second is unchanged. The 374primary IDs remain unique, and every C1 production hash matches the frozen producer source.

## DEF-US5-091 — Generated nested coverage entered changed-file formatting

Status: Verified. Severity: Low. The full changed-file format check finds generated native coverage HTML/JS/JSON under packages/runner/coverage because .gitignore only excludes root /coverage. Ignore coverage directories at any depth, consistent with the existing ESLint generated-output exclusion. Keep the actual test producers/reports and thresholds unchanged; generated coverage is not source to commit. Format the remaining versioned JSON/Markdown evidence, verifying parsed JSON equality and unchanged production hashes. Repeat the full changed-file check; do not filter production files or alter raw execution logs.

DEF-US5-091 verification: all248changed supported source/evidence files pass the real app:prettier:check command. Thirty archival JSON objects are deeply equal before/after formatting; all21current production hashes and literal native command paths remain unchanged. No test, coverage threshold or production file is excluded.

## DEF-US5-092 — Scoped-benefit workflow observes an unexpected Pro-control response

Status: Verified. Severity: Low. C2 lifetime service baseline passes27whole-file tests and the native workflow successfully saves Scheduled Runner control. Its unrelated-Pro check expects FEATURE_RESTRICTED under structuredContent.error, but observes undefined (`C2-lifetime-outer-baseline.log`). Capture the public MCP result before deciding whether this is an authorization regression or a wrong response-contract assumption. Do not weaken the denied-access assertion or change production until triaged. No new product Red is claimed from this failure yet.

DEF-US5-092 diagnosis: diagnostic response is JSON-RPC -32602 / This tool is unavailable. The existing MCP creator-capability filter hides disallowed Pro tools before the workflow handler. Assert control_overlay allowed:false/reason:FEATURE_RESTRICTED in get_capabilities plus the exact public unavailable-tool response, rather than expecting an unreachable workflow error shape. Scheduled control and grant isolation assertions remain; no production change.

DEF-US5-092 corrected diagnosis: the first inference about a plan-based tool filter was wrong. control_overlay is an internal dispatcher; only published verb tools such as pause_overlay are public. Therefore its capability entry is absent for every plan and calling it proves nothing about Pro isolation. Use pause_overlay with its published input schema, assert its capability is FEATURE_RESTRICTED, and assert the real tool returns the same normal restriction. Preserve scheduled-save/state/safety assertions and do not change production.

## DEF-US5-093 — Ended agency fixture omitted required removal chronology

Status: Verified. Severity: Low. `C2-agency-ended-inner-baseline.log` and the native owner fail on agency_license_allocations_grace_state before access assertions: the new removal_scheduled row omitted removal_requested_at. Seed a valid chronology (effective three days ago, removal requested two days ago, end one day ago). Preserve the constraint and original denied-Scheduled/basic-Free assertions; no schema or product change. Repeat both whole owners before claiming a baseline or mutation result.

## DEF-US5-094 — Scoped gate passed coverage class instances to raw-data validator

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C2 checkpoint tooling; no product failure.

Expected: the temporary checkpoint merger passes raw Istanbul counter objects to evaluateMcpCoverage. Actual: createCoverageMap.toJSON returned FileCoverage class values, so all five sources were rejected as Invalid executable source coverage. Reproduction: first node /tmp/clipify-C2-gate.mjs invocation. Correction: serialize and parse the merged map before validation, matching the persisted report format. The corrected validator reads all five sources and reports their real coverage; unchanged policy thresholds remain enforced. Follow-up diagnostic: tdd/evidence/C2-first-scoped-diagnostic.json. No production source or counter mutation.

## DEF-US5-095 — C2 surrounding workflow coverage producer omitted owning boundaries

Severity: Low. Status: Verified. Owner: Feature implementer. Source: C2 completed-slice coverage aggregation.

Expected: unchanged critical thresholds pass with complete owning evidence. Actual: the initial six-suite producer plus421 workflows misses generic retry and creator pagination/error branches; the first diagnostic remains retained in tdd/evidence/C2-first-scoped-diagnostic.json. No behavior failures or production changes. Supplement the producer with existing whole-file authority/read, retry/commit and pagination owners; strengthen the existing workflow-input-guards owner with trusted-session delegation, selector-bound replay and missing-resource rollback contracts. All supplementary cases are honest current-source baseline verification, not fabricated missing-feature Red. Admission coverage may reuse B3 only after exact source and counter-map verification. Do not lower thresholds or qualify before the combined gate passes.

DEF-US5-095 verification: all supplementary owners pass133,22and53cases (six overlapping unchanged guard cases counted once); current combined source gate passes all five unchanged critical policies. workflow.ts branches94.56%, creators.ts branches92.15%/functions100%, admission retained hash/counter maps match. Evidence: C2-support-coverage.log, C2-workflow-support-coverage.log, C2-final-support-coverage.log, C2-final-scoped-gate.json. No threshold reduction, source exclusion or production change.

## DEF-US5-096 — Snapshot projection used unused destructuring bindings

Severity: Low. Status: Verified. Owner: Feature implementer. C3 first-cycle static check.

Expected: scoped lint passes new expiry fixtures. Actual: C3-first-cycles-lint.log reports four no-unused-vars errors on the two stored-setting projections that intentionally exclude desired_state/configuration_revision. Rename ignored bindings with the repository's underscore convention; preserve all compared settings and assertions. Product behavior and test selection remain unchanged. Verify with the same scoped lint command.

DEF-US5-096 verification: identical scoped lint command passes with zero findings in C3-first-cycles-lint-restored.log.

## DEF-US5-097 — Native follow-up used a nonexistent protocol owner path

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C3 scheduled-end verification command.

Command from packages/runner: bun run test --runTestsByPath src/**tests**/execution-runtime.test.ts src/**tests**/protocol.test.ts --coverage=false. Expected: complete runtime/protocol owner checks after signed-end change. Actual: the24runtime cases pass but protocol.test.ts fails ENOENT; its real owner is heartbeat-protocol.test.ts. This is an incorrect test path, not intended product Red or runtime regression. Evidence C3-captured-end-native-green.log remains failed/does not qualify. Correct command names both existing whole-file owners; retain separate restored output and no source/test assertion change. The first defect-record write also used a root-relative path from the package working directory and failed before writing; corrected to the absolute feature path.

DEF-US5-097 verification: corrected two owning native files pass33tests in C3-captured-end-native-restored.log.

## DEF-US5-098 — Metadata reads queue concurrent queries on a transaction client

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C3 benefit metadata refactor.

Expected: transaction-bound benefit reads execute cleanly on their single Pg connection. Actual: C3-known-start-inner-green.log and outer-green.log pass19/6cases but warn that querying a client while its previous query is executing is deprecated and will fail with Pg9. The new metadata helper used Promise.all for three independent logical reads and for explicit-client bulk owners, although these share one physical transaction connection. Refactor those explicit-client operations to sequential awaits without changing selected sources, policy, tests or thresholds. Retain new-source whole-owner checks; no product Red is claimed for this library warning.

## DEF-US5-099 — New pending dispatch and metadata map need explicit fixture narrowing

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C3 type checkpoint.

Expected: TypeScript accepts tests that distinguish signed permits from normal pending dispatch. Actual: C3-known-start-types.log reports one possibly-undefined lease dereference in the existing runnerLeaseService.test.ts signature assertion and two possibly-missing bulk map entries in runner-commercial-probe.ts. A pending dispatch intentionally has no fresh lease. Add explicit runtime guards/owner-result assertions, retaining every signature, target/hash, owner and no-secret assertion. Do not cast away or weaken the new pending outcome. Verify both complete owners plus explicit typecheck; these are static integration errors, not intended behavior Red.

DEF098verification: current refactor19inner/6outer pass without the Pg concurrent-client deprecation; DEF099verification:44tests pass with explicit runtime guards and TypeScript exits0 in the restored evidence.

## DEF-US5-100 — Numeric v2 alone incorrectly disabled authorized legacy assignment delivery

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: C3 heartbeat fallback boundary.

Expected: a negotiated current signed client cannot fall back to unsigned execution, while existing scoped legacy assignment compatibility remains. Actual: C3-owner-snapshot-heartbeat-regression.log has1failure/30passes; U243's real heartbeat_isolation fixture advertises old partialv2 capability telemetry with no requestId/free_lease and has valid legacyRunner access, but ownCredentials becamefalse. The newly added protocolVersion!==2 condition conflated numeric version with completed signed negotiation. Reuse the full requestId/admissions/drain/runner_presentation/free_lease negotiation predicate for update-required and unsigned fallback, preserving existing own/foreign credential assertions. Current fully negotiated clients still cannot fall back without a valid/pending admission. Rerun whole heartbeat owner and current known-expiry workflow; do not weaken isolation assertions.

DEF100verification: whole heartbeat owner31pass and fully negotiated expiry workflow7pass; assignment credential/isolation assertions are unchanged.

## DEF-US5-101 — Revocation fixture branch inserted in unrelated transition loop

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C3 test fixture.

Expected: new revocation cases fail on fresh paid permission after revocation. Actual: C3-revocation-outer-red.log reports ReferenceError revokedBeforeDispatch in existing transition samples because the test-only branch matched the first job lookup instead of the known-expiry helper. Move the branch to its intended helper and use a lifetime grant for the revocation sample. Initial logs are excluded from intended Red evidence. Rerun both whole owners before production changes; no product source changed.

## DEF-US5-102 — Snapshot fixture lacked nullable verification narrowing

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C3 static check.

C3-poll-cache-types.log also reports before possibly null in the real owner snapshot probe. Add an explicit fixture verification guard for both signed profiles before elapsed-time calculations. Retain policy, signature, scope and expiry assertions; no cast or tolerance. Rerun TypeScript and owning workflow. The earlier type result is excluded as passing evidence.

DEF101/102 verification: C3-revocation-inner-green.log41pass, outer-green8pass; explicit root TypeScript exits0 in C3-poll-cache-types-restored.log. Earlier setup/static failures are retained and excluded.

## DEF-US5-103 — Authenticated browser privacy setup waited for an absent reload

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: SC005 browser fixture.

C3-commercial-browser-baseline.log times out in Given at page.waitForEvent(load) after rejecting optional cookies. Consent UI does not promise a document reload for an authenticated fixture; this is setup failure, not intended Runner Red. Observe the privacy dialog closing before navigating, keeping real user consent interaction. Rerun the complete SC005 browser feature using its full generated path so incidental native examples are not recollected. No product source change or wait-duration increase.

DEF103 follow-up: C3-commercial-browser-restored.log reaches preferences before client hydration, so its keypress does not open the dialog. Reuse existing ATDD networkidle/theme-class and visible-support-control readiness before the real preferences interaction. Do not count either failed setup as Runner Red; rerun the same complete browser owner.

DEF103 diagnosis correction: hydrated run reaches consent and then dashboard navigation is aborted by the consent refresh (C3-commercial-browser-hydrated.log). The original missing load was premature interaction rather than proof no refresh occurs. Use the existing ATDD sequence verbatim in behavior: hydrate, await successful /api/c15t/subjects POST plus navigation at domcontentloaded, then navigate to Runner. This supersedes the initial diagnosis; no Runner assertion has executed successfully yet.

## DEF-US5-104 — SC005 browser reloaded before its configuration action completed

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: SC005 browser fixture.

Consent-restored run reaches Runner, confirms retained destination and disabled Scheduled choice, but reloads immediately after Save and still observes Scheduled. Follow the existing Runner browser action pattern: assert local Manual selection, await matching session POST and success message before reload. This distinguishes real save denial from a test-induced request cancellation. Keep persisted configuration/legacy grant/basic Start assertions unchanged. No production code changed; previous failure does not qualify as product Red until request completion is observed. DEF103 consent setup now completes.

DEF103/104 verification: C3-commercial-browser-save-restored.log1genuine browser pass, action success observed before reload, fixture cleanup204. Current root types/scoped lint pass.

## DEF-US5-105 — Renewal fixture referenced a later shadowed elapsed clock

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C3 renewal test fixture.

C3-renewed-pending-outer-red.log9passes/1setup failure: ReferenceError monotonic before initialization. The shared owner-snapshot branch's later block-local clock shadows the existing execution clock throughout try. Rename the policy-cache clock distinctly; retain all renewal/generation/history assertions. Initial inner/outer logs are excluded as intended Red. No product code has changed. Rerun both complete owners before issuer changes.

DEF105verification: intended renewed-permit assertion Red after fixture repair, then49inner/10outer pass after the minimal issuer correction. No setup failure counted as product Red.

## DEF-US5-106 — Independent media journey stops before verified clip playback

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: B3 media regression at C3 checkpoint.

Command node scripts/run-coverage-lane.mjs workflows:430passes/1failure at BDD-US2-FR007, test/bdd/steps/runner-multistream-workflows.steps.ts57. Expected both independent broadcasts complete the already-playing clip and deliver the final green frame. Actual preserved observations show one broadcast green/ended and one blue, markerReleasedfalse, clipCompletedfalse, terminalObservedtrue. No assertion is weakened and the failed producer is excluded from qualification. Existing media fixture announces playing when a receiver file exceeds1024bytes; that proves output transport only, whereas CLI apply is asynchronous and first clip playback may not yet have begun. Add a real presentation snapshot started/non-ended barrier before declaring playing. Verify the complete multistream owner; investigate production further if the failure persists. No product-code Red is claimed from this diagnostic.

DEF106verification: all5real media scenarios pass after actual clip readiness; original assertions and deadlines preserved. The failed broad producer is retained and excluded; next complete workflow lane remains required.

## DEF-US5-107 — New ATDD readiness used five seconds despite owning browser dependency budget

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: C3 browser readiness.

C3-qualified-commercial-browser.log6passes/1failure: SC005heading assertion expires after5000ms immediately after reloading the expired Runner. Captured page is still Loading runner configuration, with no product error or redirect. Existing test/bdd/support/mcp-support.ts configures15seconds because browser actions may use the application ten-second dependency budget; generic auth ATDD expect remains5seconds and other auth steps use explicit longer readiness waits. Reuse the existing configured expect for this Runner browser owner. Keep all state/history/disabled-Scheduled/basic-Start assertions and overall action/test budgets unchanged. Fresh seven-scenario owner required before qualification; previous six-plus-one run is excluded.

DEF107verification: complete7scenario commercial browser owner passes in C3-qualified-commercial-browser-restored.log with the existing15second Runner readiness budget and unchanged assertions.

## DEF-US3-108 — First schedule probe lacked a resolvable service declaration

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D1 test setup.

The first new whole-file schedule command failed during esbuild because the future schedule module did not exist. This is setup evidence, excluded from intended Red. Added only a minimal unavailable-result declaration so the native probe compiles. Also separated shared-service availability from action-export availability: the inner observer must reach the service even while its outer action remains absent. `D1-permission-service-red.log` subsequently records the intended missing permission result (expected ACCESS_DENIED, received RESOURCE_UNAVAILABLE), and `D1-permission-bdd-red.log` records the absent action with 45 existing passes. No date, identity or schema implementation preceded these Reds. `D1-permission-service-green.log` verifies the minimal authorization gate.

## DEF-US3-109 — Calendar process fixture used an extensionless module re-export

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D1 calendar module refactor fixture.

D1-calendar-module-native-green.log has two setup failures/five passes: Node native type stripping cannot resolve the extensionless re-export after the pure calendar code moves to schedule-calendar.ts. Root/service32 cases remain Green. Point the outer process directly at the pure module's explicit .ts entry; retain the native inner wrapper import and all UTC/skip assertions. Earlier wrong working-directory preparation is also excluded; only clean reruns may qualify this refactor. No intended Red is claimed for these fixture failures.

## DEF-US5-110 — Dashboard retained raw Pro controls after a known billing deadline

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D1/D2 authoritative policy follow-through.

D1-known-expiry-browser-red.log: existing legacy-expiry acceptance passes, new known-paid-period example fails because Scheduled is still enabled while the persisted billing period has ended and raw users.plan remains Pro. Both records and saved settings are genuine disposable browser fixtures. Reuse the current authorized-owner Runner capability source in the dashboard's schedule/destination/control policy; do not alter billing history or rely on webhook arrival. Server capability/admission source already enforces this deadline; browser must present the same policy. Retain the complete two-example ATDD owner at the next browser Green gate.

## DEF-US3-111 — State-preservation observer compared refreshed policy timestamps

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D1 policy response fixture.

D1-policy-read-service-green.log has11 failed unchanged-state observations/22passes after policy metadata is added. The observer compares complete list responses, which now contain a fresh evaluatedAt timestamp; no settings failure or rejected input acceptance is observed. Compare direct persisted event rows, destination joins and successful schedule audit counts before/after instead. This strengthens rollback/state assertions and leaves every expected denial and validity boundary unchanged. Fresh complete service owner required; this failed producer is excluded from Green evidence.

DEF111 typing follow-through: D1-editor-types.log also catches the now-concrete snapshot result union at two fixture occurrence observers. Add an explicit fixture success guard before reading occurrences; do not cast away normal denial. A fresh root typecheck is required before browser build.

## DEF-US3-112 — Browser missing-target fixture clicks HeroUI's hidden checkbox input

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D1 editor browser fixture.

D1-editor-browser-diagnostic.log18passes/one fixture timeout: uncheck targets the visually hidden React Aria input while visible checkbox content intercepts the pointer. Use real keyboard focus/Space and assert the checked state changes before Save. No force option, pointer bypass, assertion removal or budget increase. The missing-target business result remains required. This diagnostic build precedes the later legacy-policy/date guard corrections and does not qualify the current source gate; the final complete browser owners must rerun from the current build.

DEF109verification: D1-calendar-module-native-restored.log7/7 in both whole native owners with explicit pure-module path; original skip/UTC assertions unchanged. DEF111verification: D1-policy-read-service-restored.log33/33, D1-editor-types-restored.log exit0, and later complete38case malformed-date Green retain strengthened direct database/audit observations.

## DEF-US3-113 — Signed-cache regression command named a nonexistent lease test

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D1 test command.

D1-signed-cache-green.log39actual tests pass/two real owners, but a third guessed path free-lease.test.ts does not exist, so the producer exits1 and cannot qualify. Locate actual test/app/lib/runnerLeaseService.test.ts and rerun the complete changed owners together with heartbeat and capability source owners. No assertion or product code changed to address the command error; no setup failure counts as intended Red.

DEF110/112verification: D1-final-browser-green.log32/32 from current build/fresh schema includes both expiry paths, keyboard-deselected destination rejection, all boundary/identity/DST/persistence scenarios and rollback. DEF113verification: correct owners pass119 and52 focused cases; later19native calendar cases use the correct package runner. Excluded wrong-path/runner outputs remain excluded. All113 recorded defects Verified; no approved exceptions.

## DEF-US3-114 — Static gate rejects client type boundaries and initial effect loading pattern

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D1 architecture/static gate.

D1-initial-global-lint.log five errors/nine warnings: three client imports from server internals (including erased types), one synchronous-effect rule and one explicit any in a native BDD callback. Three extra unused-row destructuring warnings are new; six warnings are retained baseline. Infer client DTO/policy types from permitted Server Action contracts, use an asynchronous subscription with request-generation cleanup, type the native serialized callback, and make the event response an explicit allowlist. No rule suppression or lint configuration change. Re-run exact affected service/native/browser owners, current build and static gate; prior source/coverage producer maps for changed schedules.ts must be excluded from current qualification.

## DEF-US3-115 — D1 merged coverage omits a retained wrapper and misses lease statement threshold

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D1 qualification.

D1-final-scoped-gate.log rejects missing src/server/entitlements.ts and lease.ts94.85% statements (required95%). All729app,433workflow,211native and32browser cases pass; this is a coverage gate failure, not intended Red. Collect fresh explicit source coverage for the unchanged wrapper through its complete existing downgrade-model owner, and add an honest retained security characterization proving an internal terminal acknowledgment without all-output closure cannot release occupancy or write state. Run the complete lease-service owner with coverage, merge only identical current counter maps and recheck unchanged thresholds. No production change or fabricated Red.

DEF114/115 verification: current32browser scenarios,729app cases/34owners,433workflow scenarios and211native cases/38owners pass (one unchanged TODO). Added terminal-closure characterization passes with all26lease cases; nine downgrade-model cases pass with explicit wrapper collection. Distinct app total730, not repeated-producer sum. D1-final-scoped-gate-restored.log/json qualifies all unchanged source thresholds; native twelve-source gate passes. Both current builds,93-file manifests,types,format,global lint0errors/6inheritedwarnings,High audits and11migration checks pass. All115defects Verified. No rule or threshold weakened.

## DEF-US3-116 — Loader-only Jest owner attempts to resolve installed Agenda ESM package

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 isolated loader harness.

D2-initial-component-green.log has one pure adapter pass and an unexpected loader suite resolution failure for @heroui-pro/react, whose package exports provide no Jest CommonJS route. This is not intended Red. Mock only the newly extracted calendar child in the loader lifecycle test; its pending-request/unmount/parent-policy assertions remain unchanged. Actual installed Agenda DOM/layout is exercised through the real browser owner, with no global vendor mock, module resolution change or test suppression. Rerun both complete component owners and actual mobile browser journey.

DEF116verification: both whole component owners pass2/2 and real installed Agenda mobile browser passes1/1. No vendor code is mocked in the browser.

## DEF-US3-117 — Pointer fixture scrolls the calendar grid but leaves it below the page viewport

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 pointer browser fixture.

D2-pointer-create-geometry-red.log fails the strengthened elementFromPoint check before dragging: the intended day is below the browser viewport. The preceding missing-dialog output is excluded as unproven pointer Red. Scroll the whole calendar region into view, then scroll its real time grid and verify both drag endpoints hit the intended day. No forced click, timeout increase or pointer interception bypass. Re-run baseline browser before adding the missing onEventCreate binding. Inner adapter Red remains valid.

DEF117verification: D2-pointer-create-validated-red.log proves both endpoints hit the day before missing-editor Red; D2-pointer-create-browser-green.log3/3 then proves the same real gesture opens/saves correct bounds. Original unvalidated pointer log remains excluded.

## DEF-US3-118 — Child event button bypasses Agenda's suppression of the click following a drag

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D2 pointer movement integration.

D2-move-browser-green.log8pass/one failure: validated one-hour drag opens the editor but Start remains12:00 instead of13:00. The child button calls onEdit independently after the move callback, replacing the proposed draft with old values; Agenda suppresses its own post-drag selection click only. Remove the child's separate click handler and use Agenda onEventSelect for pointer and native button keyboard activation. Keep selectedEventId controlled at null so repeated activation of the same event still opens the editor. Preserve real drag geometry/assertions and rerun all nine Agenda scenarios; no vendor patch, timeout increase or assertion weakening.

DEF118verification: D2-move-click-restored-browser.log9/9 after current rebuilt source; dragged13:00–14:00 persists, ordinary event click and keyboard routes remain Green. Scoped lint/type/build pass. All118recorded defects Verified.

## DEF-US3-119 — Weekly guidance fixture uses an incomplete recurrence trigger name

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 guidance browser fixture.

D2-authoring-browser-baselines-guidance-red.log has three retained authoring passes, one valid missing-guidance Red for another timezone, and one unexpected weekly setup timeout. The HeroUI trigger includes the current value before Recurrence; reuse the existing verified /Recurrence$/ locator. Re-run the weekly baseline before product guidance changes; exclude this setup timeout from intended Red. No timeout increase, forced action or product assertion change.

DEF119verification: D2-ambiguous-gesture-validated-red.log reaches the expected missing-guidance assertion in both cases; D2-guidance-browser-green.log17/17 then restores all current browser paths. All119recorded defects Verified.

## DEF-US3-120 — Resume observer lets an existing thrown recovery denial abort the shared contract batch

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 direct shared-control observer.

D2-resume-inner-red-baseline.log encounters the legacy reserveBroadcastAdmission RUNNER_RECOVERY_REQUIRED exception during the pending-drain vector. Because the observation escaped, the memoized contract never completes and unrelated tests retry the same fixture. Stop that producer; record the one exact known denial as legacyThrown in the observer, rethrow every unrelated exception, and explicitly require the new scheduled Resume path to return a normal business result. Re-run the whole owner; exclude the interrupted batch as intended Red. Do not suppress or normalize arbitrary product failures. Outer D2-resume-browser-red.log independently proves the missing Resume control.

## DEF-US3-121 — Resume browser observer races the telemetry action

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 Resume browser observer.

D2-resume-browser-green.log retains17 successful Agenda scenarios and one unexpected database observation before the Resume action settles. The browser is still showing the disabled in-flight Resume control with no business error; its generic dashboard POST waiter can match the existing two-second telemetry poll. Move the existing exact success-feedback assertion before the database observation to await the requested operation's semantic completion. Preserve all original state/identity/end assertions, with no sleeps, forced actions, retries or product changes. Re-run only DEC008; retain the17 unchanged scenario successes.

DEF120/121 verification: D2-resume-inner-green.log81/81; D2-resume-settled-browser-green.log1/1 retains all occurrence/end/session assertions. Prior17 unchanged browser cases passed D2-resume-browser-green.log. No product change for the telemetry observer race.

## DEF-US3-122 — Stop fixture mixes text and admission enum parameter types

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 Stop fixtures.

D2-stop-suppression-inner-red.log fails before observations with PostgreSQL42P08: the same parameter is assigned to runner_admission_state and compared as text in CASE. Interrupt the repeating shared observer producer and explicitly cast both uses in unit/browser fixture SQL. Exclude this setup batch from intended Red. No product mutation or assertion change. Re-run the owning whole file and actual browser Stop examples.

DEF122verification: intended Red reached both corrected unit/browser fixtures; D2-stop-suppression-inner-green.log83/83 and D2-stop-suppression-browser-green.log3/3 verify active Stop, undispatched cancellation and explicit Resume. Build and scoped lint succeed.

## DEF-US3-123 — Calendar projection coverage omits safe negative boundaries

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 adapter coverage gate.

D2-qualified-planner-coverage.log passes7cases with94.73% statements,100% functions/lines but80% branches, below the planned85% general changed-module floor. Add honest baseline checks for disabled events, nonintersecting viewport days, zero/negative resize and display-only midnight edge. No production behavior changes, fake Red or threshold exception. Rerun only the complete planner owner with coverage; its current result replaces that owner's earlier7case execution in the aggregate. All other frozen qualification inputs stay unchanged.

DEF123verification: D2-qualified-planner-restored-coverage.log12/12 and100% statements/branches/functions/lines. Production adapter unchanged. No lower threshold. Current12case owner replaces earlier7case result; only its test input receives a recorded supplemental fingerprint.

## DEF-US3-124 — Captured-expiry transition fixture lacks the now-required active schedule

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D2 broader transition/workflow fixture.

D2-qualified-affected-coverage.log reaches TRANSITION_FIXTURE_PAID_START_UNAVAILABLE in the preexisting scheduled transition vector. Its Given marks a session Scheduled, requests Running without any calendar event, then retrofits a random occurrence/end onto a reservation. D2 correctly rejects the out-of-window request. Interrupt affected producers before repeating stale fixture executions; browser source is unaffected and its52journeys continue. Replace only this setup with a real current owned calendar window and owned target joins, preserving all C3 accepted-paid/expiry/signature/end/closure assertions. No product guard weakening or fabricated admission capture. Verify the whole commercial-transitions owner before restarting broader coverage with the corrected fixture. Interrupted partial producers are excluded qualification evidence.

DEF124 scoped verification: D2-transition-fixture-restored.log6/6 passes after creating a real current UTC event and owned target joins before Start; no posthoc admission mutation. Original expiry/signature/physical-closure assertions retained. D2-initial-affected-coverage-interrupted.log and D2-initial-workflows-interrupted.log preserve interrupted evidence; initial workflow directory archived separately so the next producer begins with no foreign raw coverage. Broader current-fixture verification pending.

## DEF-US3-125 — Unbounded dashboard telemetry queues ahead of schedule controls

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D2 Runner dashboard polling.

D2-qualified-browser-green.log finishes50/52; pointer move and resize save remain disabled/pending past the unchanged15s semantic completion timeout. CI browser-tests runs separately from coverage jobs; local shared host load is32 on16available CPUs with both producers active. Checking the actual page reveals an independent product defect: a two-second interval launches another three-action poll even while its predecessor is pending. Installed Next16 docs explicitly serialize client Server Actions. D2-polling-overlap-red.log proves it deterministically on the actual rendered RunnerPage with controlled deferred getRunner: expected2total calls(initial+one pending telemetry), received5after8s. No component implementation mirror or artificial test seam. Add one in-flight guard/finally release to the existing page poll, preserve recovery/interval/unmount behavior, then rerun its complete owner and actual browser journeys. Do not change timeouts, retries or assertions. Existing app/workflow producers do not import this client page; their production server counters stay identical. The changed page receives a new owner/build/browser fingerprint before qualification.

DEF125 inner Green: D2-polling-overlap-green.log1/1. The same actual-page test now proves one pending telemetry batch across8s, refresh resumes after completion, and unmount prevents further polls. Minimal guard/finally release; no framework/test timeout or save behavior changes. Current browser rebuild and outer verification pending.

DEF115 D2 coverage assembly verification: the initial gate correctly rejects the missing pure-wrapper report. An attempted D1 reuse is rejected because its input record lacks Jest configuration fingerprints; no retained report is merged. Fresh D2-qualified-downgrade-coverage.log9/9 with explicit95/95/95/90thresholds yields100%all metrics. D2-scoped-coverage-qualified.json/log passes every current server module. DEF124 now Verified by804cases/39owners and433current workflow scenarios. Native configuration reuse additionally verifies three tracked configuration files against the unchanged feature baseline.

DEF125 outer verification: D2-polling-qualified-browser-green.log52/52 passes against the guarded-page build. D2-final-scoped-gate.json qualifies current fingerprints, production build and all affected evidence. All125canonical defects Verified.

## DEF-US3-126 — Scoped cache verification command references a nonexistent owner

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 local command.

D3-cache-authorization-command-failure.log executes the real schedule owner successfully20/20 but also requests nonexistent packages/runner/src/**tests**/protocol.test.ts. This is a command/setup error, not intended product Red and not qualified Green. Preserve it separately; rerun the real schedule, heartbeat-protocol and execution-runtime owners discovered with rg. Cache positive-behavior Red remains D3-cache-authorization-red.log. No product change is justified by the nonexistent path.

DEF126 verification: D3-cache-authorization-green.log54/54 and D3-cache-validation-baseline.log70/70 pass through the actual three native owners. The command failure remains preserved and excluded.

## DEF-US3-127 — Current Stop promotes every future authorization into a physical drain

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D3 future/current Stop routing.

Command: source documented local environment; MCP_TEST_TEMPLATE_ID=local-clipify-D3-cache-issuance-v2; bun run test --runInBand --runTestsByPath test/server/runner/schedules.test.ts --coverage=false. D3-future-authorization-stop-red.log observes PostgreSQL23505 on runner_admissions_open_session_unique rather than the intended narrow assertion that future rows remain authorized. requestBroadcastDrain applies to every nonterminal row, promoting several future authorizations into draining beside current output. Interrupt repeated probe setup failures; preserve the raw output, observe only this exact known constraint at the fixture boundary, and prove the new contract assertion before fixing the drain predicate. No index relaxation for physical output and no broad error swallowing. Other exceptions must still abort.

DEF127 verification: D3-future-authorization-stop-contract-red.log82existing pass and one deliberate boundary assertion fails after observing only the known23505. Narrow physical drain excludes authorized records; D3-future-authorization-stop-green.log83/83 passes. D3-authorized-terminal-reconciliation-green.log119/119 over schedules+heartbeat subsequently confirms current-source correction. Physical-output unique protection remains enforced; original interrupted raw error output is retained.

## DEF-US3-128 — New schedule observer uses string literals instead of the typed stream enum

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 test fixture types.

D3-candidate-app-types.log reports TS2322 for desiredState/actualState in the unknown-cached-output observer. The PostgreSQL column's TypeScript contract requires StreamState even though the runtime literal is identical. Add a type-only import and explicit enum type assertions; this changes no generated JavaScript behavior or production source. Preserve the initial type-check failure and require a fresh type check after the current isolated Next build completes. The affected server owner also needs current-source validation for the type-only fixture input. Do not classify this as an intended product Red or restart unrelated successful native/media checks.

## DEF-US3-129 — Browser file filter includes native workflow aliases

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 qualification command.

D3-initial-browser-selection-interrupted.log selected100cases because a filename-only filter also matched mcp-workflows/runner-free-pro. Interrupt that producer after2cases rather than duplicate native workflow ownership. The incomplete run is excluded from all qualification counts. Restrict the filter to direct .features-gen/(bdd|atdd)/ runner-free-pro and runner-boundaries files and verify the expected52-case list before execution. This is a selection error, not a product-test Red or reason to alter product behavior/timeouts.

DEF128 verification: D3-candidate-app-types-restored.log exits0, D3-candidate-native-types-restored.log exits0 and D3-fixture-enum-owner-restored.log94/94 passes after the type-only correction. The completed current production build also passes its TypeScript phase and93-file action manifest.

DEF129 verification: D3-corrected-browser-inventory.log52tests/3direct browser files and D3-candidate-browser.log52executed confirm the corrected selection; the independent reload timing failure remains DEF132.

## DEF-US3-130 — Candidate formatting check finds three unformatted files

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 static qualification.

D3-candidate-format-check.log identifies schedules.ts, lease.ts and the schedule observer. Apply Prettier and retain pre-format files locally. D3-format-executable-identity.json proves identical compiled JavaScript before/after for all three. Coverage source positions still change: discard old maps for the two production modules and require fresh owning coverage rather than relabeling stale maps. Other immutable producer evidence is retained only with exact input identity. Initial static failure remains preserved.

DEF130 verification: D3-qualified-format.log exits0, D3-qualified-global-lint.log exits0 with0errors/6inheritedwarnings, D3-qualified-app-types.log and D3-qualified-native-types.log both exit0. Current root coverage passes D3-current-root-coverage-gate.log; intended mutations restore exactly and157native cases pass.

## DEF-US3-131 — Two new native test declarations violate repository lint rules

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 test declarations.

D3-candidate-global-lint.log reports the reserved local name module in the CLI observer and explicit any in the malformed-cache fixture. Rename the local compiled module and type the mutation input structure; no rule suppression or product behavior change. Run both complete owners, native types, lint and formatting again. Six inherited warnings remain separate from these two errors; no successful native/media owner unrelated to these declarations needs duplication.

DEF131 verification: D3-qualified-format.log exits0, D3-qualified-global-lint.log exits0 with0errors/6inheritedwarnings, D3-qualified-app-types.log and D3-qualified-native-types.log both exit0. Current root coverage passes D3-current-root-coverage-gate.log; intended mutations restore exactly and157native cases pass.

## DEF-US3-132 — Full browser qualification times out waiting for schedule reload

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D3 browser milestone.

D3-candidate-browser.log51/52passes. The1440-minute event is actually persisted correctly; after reload the schedule stays Loading schedule beyond15seconds and the Saved schedules list is absent. The initial failure context was read at test-results/browser/runner-boundaries.feature--6a710-on-1440-minutes-is-accepted-bdd-chromium: telemetry was live, configuration was present, Add schedule was disabled and Loading schedule remained visible. The next Playwright invocation cleaned its prior binary attachments before they were copied; only the raw failure log and this observed context are retained. Do not claim the deleted screenshot/video are available. No assertion/timeout is changed. Compare the isolated browser CI job with the local concurrent application/native workflow producers, then reproduce the exact case with other owning producers finished before deciding whether product or fixture changes are justified. Failed/interrupted results do not qualify the gate.

DEF132 verification: D3-qualified-browser.log52/52 passes in9.8minutes against the final rebuilt source with no other owning producers running, unchanged assertions/timeouts and no product change. CI browser-tests also runs separately with its own loopback DB/server. D3-final-scoped-gate.json verifies final source/input identity and all required gates. The failed concurrent51/52 run remains excluded.

## DEF-US3-133 — New denial observer requests a state forbidden by the database

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 coverage fixture.

D3-cache-input-denials-fixture-failure.log hits stream_sessions_scheduled_clips_only while trying to turn a Scheduled session into fallback mode. The invariant is enforced by PostgreSQL, so this is an invalid Given, not an intended product Red. Stop the producer, remove only that impossible persisted-state vector, and keep the schema constraint intact. The supported Manual-selection, owned-source, private-capture and suppression boundaries remain in the owner. No constraint bypass or generic exception handling is introduced.

DEF133 verification: D3-critical-final-boundaries-coverage.log103schedule cases pass with database constraints intact.

## DEF-US3-134 — Supplemental pure protocol coverage invokes the full root gate

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 coverage command.

D3-root-protocol-final-coverage.log has43passing cases but the direct Jest coverage command correctly fails inherited gallery and other full-root inventory requirements. This is a wrong-entry-point qualification failure, not a product Red or justification to change thresholds. Rerun the same whole owner through scripts/run-mcp-coverage.mjs --partial-lane, retaining the unchanged merged feature/critical thresholds at the final gate. Exclude the failed direct command from qualification.

DEF134 verification: D3-root-protocol-scoped-coverage.log43/43 passes through the partial-lane owner and D3-current-root-coverage-gate.log passes unchanged protocol critical thresholds.

## DEF-US3-135 — Source-denial fixture guesses an unsupported enum value

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 coverage fixture.

D3-cache-input-denials-enum-fixture-failure.log rejects overlays.status=suspended because status_options supports only active and paused. Stop the failing producer. Inspect the actual shared StatusOptions enum and use paused for the legitimate saved-source boundary; do not alter the enum or weaken the database constraint. Preserve this fixture failure separately and rerun the complete schedule owner.

DEF135 verification: D3-cache-input-denials-valid-baselines.log99/99 and D3-critical-final-boundaries-coverage.log103schedule cases confirm the supported Paused source state.

## DEF-US3-136 — Empty-observation test omits the helper's explicit client argument

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D3 coverage fixture.

D3-lease-boundary-baselines.log37existing/new cases pass and one supplemental case fails because readRunnerOutputStates requires(client,ownerId,sessionIds), while the new test passed(ownerId,sessionIds). Inspect its actual signature and pass the typed mocked db client. Keep the no-database-work assertion; do not change production or report this as intended product Red.

DEF136 verification: D3-lease-boundary-restored.log38/38 and D3-critical-final-boundaries-coverage.log38lease cases confirm the correct explicit client API.

## DEF-US3-137 — Heartbeat outcome fixture enters paid acknowledgment without a transaction mock

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D4 fixture.

`D4-server-outcome-red.log` contains the intended lease persistence Red plus an unexpected heartbeat fixture failure: its default paid entitlement permits acknowledgment and reaches a deliberately absent transaction mock. The parsing-boundary test intended the existing Free protocol-negotiation rejection. Set the fixture's entitlement to Free explicitly; keep finite valid outcomes accepted and unknown values rejected. Do not classify the transaction mock failure as product Red.

DEF137 verification: `D4-server-outcome-green.log` passes all71cases across the whole heartbeat and lease owners after the explicit Free fixture correction.

## DEF-US3-138 — Stall fixture retains the completion-marker auto-resume

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D4 real-media fixture.

`D4-timeout-runtime-baseline.log`: 5 existing cases pass, new EC009 fails because the encoded final-marker fixture resumes a paused clip once drain begins, so the clip genuinely completes. This is an invalid stall Given, not missing product behavior. Disable marker release only in the timeout mode, rewind/pause at a known in-progress timestamp, and let the initial drain snapshot settle before advancing the injected watchdog clock. Retain actual Chromium, capture, FFmpeg and production drain bridge. Rerun the complete owning file; failed evidence is excluded.

DEF138 follow-up: `D4-timeout-runtime-fixed.log` still fails in fixture wait after the browser closes: rewind was not awaited before capturing drain state. Add explicit paused/not-seeking/not-ended in-progress precondition and validate the real bridge's generation/playing clip before requesting drain. This failure remains fixture evidence, not a successful runtime check.

DEF138 diagnostic: `D4-timeout-probe-diagnostic.log` shows rewind enters a seek that does not complete on the fixture's non-range HTTP source; this fixture never needed seeking. Remove rewind, retain the actual in-progress pause and explicit non-ended/started bridge precondition, with marker auto-resume disabled only for timeout. No production timeout or test budget is increased.

DEF138 verification: `D4-timeout-probe-paused.log` proves real paused media closes with playback_timeout, no next clip, and all output resources closed. `D4-timeout-runtime-green.log` passes all6whole-owner runtime cases after removing unsupported fixture seeking and disabling timeout-mode marker release.

## DEF-US3-139 — Watchdog fixture uses a permissive helper key alias

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D4 actual CLI fixture.

`D4-watchdog-probe-baseline.log` and `D4-watchdog-fixture-diagnostic.log` cannot start because the fixture's `fixture` key alias is accepted by directly injected verifier maps but is correctly rejected by the CLI's trusted-key configuration parser, which requires the public DER SHA256 sixteen-character fingerprint. Use the actual fingerprint for the signed job, manifest and configured public key map. Preserve the production key parser and exact CLI helper prefix. This is fixture setup evidence, not missing product Red or a reason to weaken trust.

DEF139 verification: `D4-watchdog-real-key.log` passes with unchanged CLI key parser, starts real encoded output 2,551ms after the cached window begins, captures the final green frame, drains with normal encoder exit0 and closes all output resources without another clip. Owning ATDD whole-file execution follows; standalone probe is not substituted for that gate.

## DEF-US3-140 — Exact-end fixture releases its marker before recording the active clip

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D4 exact-end media fixture.

`D4-exact-end-probe-red.log` times out because the first marker can auto-release before the fixture records indexAtStop; it then waits for a second clip whose marker is intentionally no longer released. This is fixture setup failure, not the intended player boundary Red. Arm exact-end marker release only after recording the active clip; await a boundary-evaluated event after the player's advancement decision, preserving the real ended callback and media output. Independent `D4-exact-end-unit-red.log` already proves the missing exact-end canAdvance guard. Keep production unchanged until valid outer Red.

DEF140 verification: `D4-exact-end-valid-runtime-red.log` reaches the intended nextClipStarted assertion (8pass/1Red) after the armed fixture records and completes its actual current clip. Setup failure is excluded from product Red.

## DEF-US3-141 — New typed test doubles add four unused-parameter warnings

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D4 static gate.

`D4-candidate-lint.log` has0errors/10warnings versus the retained0errors/6warnings baseline. Four new warnings come from `_job`/`_policy` in the runtime policy observer and `_url`/`_init` in the terminal request observer. Remove the unused callback parameters and type the captured Jest argument arrays at the assertions. Preserve mock observations and all assertions. Wait for the current native coverage producer to complete before changing these two fixture inputs, then rerun both complete owners with coverage and global lint; do not invalidate running evidence silently. The remaining six warnings are the previously retained baseline.

DEF141 static verification: `D4-remediation-lint.log` returns to the exact inherited baseline, zero errors and six warnings. `D4-remediation-native-types.log` passes, and `D4-remediation-format-check.log` passes all thirty current slice code/fixture inputs. Complete typed-observer owners are included in the running ten-owner coverage remediation; final verification awaits that result.

## DEF-US3-142 — Actual-watchdog result is followed by asynchronous Engine cleanup output

Severity: Medium (fixture lifecycle). Status: Verified. Owner: Feature implementer. Scope: D4 native milestone fixture.

`D4-candidate-native-coverage.log` fails ATDD-US3-SC003 at JSON.parse: expected a final structured JSON line, actual final line begins `[Engine] St`. Earlier scoped owner passed. This is not intended behavior Red. Retain full raw probe output, inspect whether asynchronous watchdog startup/shutdown outlives the recorded result, and ensure all fixture-owned work is settled before publishing structured proof. A parser-only workaround must not conceal a still-running output. Leave unaffected app/workflow producers running; do not qualify this native run or change frozen inputs while it executes.

DEF142 diagnosis: `D4-watchdog-tail-diagnostic.log` captures the actual cause: the structured result itself reports runtimeExpired=false/allOutputsClosed=false and is followed by finally's emergency cleanup. The fixture advances a clock based on the original cache request then invokes controller.tick once; restored signed clock anchors can differ by fractions of a millisecond, so that one call may precede the actual original-end guard and return before the real250ms watchdog drains. Preserve production deadlines. For actual-watchdog mode, let that real watchdog drive end and await the matching persisted terminal proof before publishing results; clear its timer after terminal proof. Do not force-close media to manufacture success or merely parse around trailing logs. All clip-final-frame and no-next assertions remain.

DEF142 focused verification: `D4-watchdog-settled-baseline.log` passes the complete real-media ATDD owner (1/1, 22.103s), including matching persisted terminal closure, current-clip final-frame preservation and no subsequent clip. All eight owners sharing the probe plus both changed typed observers are now running with coverage in `D4-remediation-native-coverage.log`; final defect verification awaits that complete affected execution. Production inputs remain unchanged.

DEF141/142 complete verification: `D4-remediation-native-coverage.log` passes all ten affected complete owners, 64/64 tests, including every shared real-media drain-probe consumer and both typed observer files. `D4-native-current-inventory.json` replaces these ten owners and verifies retained production/input hashes for the remaining 31 unchanged passing owners: 41 suites,326pass,1 inherited TODO. `D4-native-merged-gate.json` confirms unchanged coverage thresholds with matching counter maps. Raw decoder diagnostics did not fail any owner or remove final-frame/physical-closure assertions.

## DEF-US3-143 — D4 coverage collector omits the direct downgrade-policy module

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D4 coverage gate configuration.

`D4-scoped-coverage-evaluation.log` fails with `Missing required source coverage: src/server/entitlements.ts` even though all 1,008 affected app cases and 433 workflow scenarios pass. The existing default collection includes app entitlement resolution but omits the separately owned direct downgrade module. Preserve the required source inventory and thresholds. Execute both complete direct downgrade owners with explicit collection of that module, then merge only compatible current-source maps. This is missing gate evidence, not intended product Red; no production change is warranted.

DEF143 verification: `D4-downgrade-coverage.log` passes both complete direct owners (15/15). Explicit source collection restores the required policy module. `D4-scoped-coverage-candidate.json` now passes all unchanged critical thresholds with compatible maps and zero errors. The fifteen cases are reruns of the existing 1,008-case app inventory and are not added to the distinct count.

## DEF-US3-144 — Handoff fixture reaches its end boundary too near clip completion

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D5 test Given.

`D5-handoff-outer-red.log` unexpectedly passes11/11. `D5-handoff-diagnostic.log` shows timeAtStop=11.534s of12s: real output buffering postpones the ready check until the final marker, allowing Chromium startup to hide an early next-execution dispatch. Do not invent product Red or count this as a verified characterization. Keep the first final marker held for seven seconds after the boundary (well inside the60s progress budget) and observe actual next engine activation as well as encoder opening. Retain final frame and closure assertions. Production source is unchanged; rerun the whole owner for decisive intended behavior evidence.

DEF144 verification: `D5-handoff-valid-outer-red.log` reaches the intended observable failure, nextExecutionBeforeClipEnd=true and nextOutputBeforeClipEnd=true, with actual first final-frame preservation/closure still passing. Whole owner10pass/1intendedRed. This replaces the weak initial Given; no production change preceded valid Red.

## DEF-US3-145 — Fixture patch precondition did not stop the enclosing shell

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D5 local test orchestration.

The first continuity-fixture edit script expected `if (` where the embedded browser source has `if(`. It aborted before writing any source. The enclosing shell then formatted and started the unchanged prior12-case owner. That unintended run was terminated immediately and retained in `D5-continuity-unintended-unchanged-run.log`; it is excluded from Red/Green qualification. Corrected the exact fixture precondition, executed the edit separately, and verified successful formatting plus `node --check` before starting the intended new13-case owner. No production source changed and no product regression is claimed. Keep dependent edits and test launches separate unless shell failure is explicitly gated.

## DEF-US3-146 — Continuity journal comparison lacks explicit occurrence narrowing

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D5 native types.

`D5-continuity-inner-green.log` passes96/96, but `D5-continuity-native-types.log` rejects two accesses to optional existing.occurrence. Add an explicit missing-occurrence rejection before accessing its end/start, preserving mismatched journal-identity rejection. Re-run the complete affected native owners and native type check before the actual-media Green run. This is a development static-gate failure, not intended behavior Red.

DEF146 verification: `D5-continuity-inner-type-fix-green.log` passes96/96 complete affected native cases; `D5-continuity-type-fix.log` exits0. The explicit absent-occurrence rejection preserves the signed/journal binding instead of asserting optional state away.

## DEF-US3-147 — Partial shared-occurrence receipt retry erases an acknowledgement

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D5 continuity durability.

`D5-receipt-retry-red.log` has42pass/1intended failure. After physical shared output closure, saving the following occurrence's terminal fails. The first receipt is acknowledged before retry. Retry attempts to rewrite its stopped state through draining, then overwrites its terminal from a stale in-memory record and loses acknowledged=true. Keep already durable terminals intact, skip renewed drain intent once physical closure is known, and persist only missing member receipts. Retain exact physical-close-once and per-member original-end/identity guarantees. No broad suite qualification is claimed until the affected owner and focused media cases pass.

DEF147 controlled fix: `D5-receipt-retry-inner-green.log` passes97/97 complete affected native cases and `D5-receipt-retry-native-types.log` exits0. Physical closure is not repeated; existing durable stopped records (including acknowledgement) are retained and only missing terminals are persisted. Focused three-case media regression is executing before Verified status.

DEF147 verification: `D5-receipt-retry-media-green.log` passes3/3 focused actual-watchdog media cases (83.589s) after97case native Green and successful native types. The receipt acknowledgement and no-repeated-physical-close assertions pass; no normal or expired handoff/continuity case regresses.

## DEF-US3-148 — Stale-Stop characterization assumes an explicit false suppression flag

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D5 test assertion.

`D5-stale-stop-baseline.log` has69pass/1unexpected fixture assertion: unsuppressed journal occurrences omit the optional flag rather than storing false. The stale command was correctly rejected. Assert the actual semantic condition (suppressed is not true), keeping active state, physical-close count and current-member-only suppression assertions. No production edit; this is not intended product Red. Re-run the complete owner and kill the stale-member guard mutant before verification.

DEF148 verification: corrected complete owner passes70/70; stale-member guard mutant is killed and exactly restored; restored owner passes70/70.

## DEF-US3-149 — Initial active-journal save failure leaves started output open

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D5 first shared activation durability.

`D5-initial-storage-red.log` has73pass/1intended failure: the engine starts, then a controlled first active-state persistence failure escapes apply without first closing outputs. Catch that save failure, use the existing immediate physical-close and terminal durability path, then return an unsuccessful Start. Preserve pending future members and propagate genuine inability to close/persist terminal proof. Verify the complete affected native owners, types and real transition media before marking Verified.

## DEF-US3-150 — Continuity permission closure violates prefer-const

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D5 static qualification.

`D5-lint.log` reports one blocking prefer-const error at execution-runtime.ts:265, with the same six inherited warnings. The forward local execution binding is assigned once after Engine construction; its permission callback intentionally supports consultation before construction returns. After active producers finish, refactor the forward capture into an initialized constant holder while preserving that early fallback and exact physical execution binding. Re-run affected whole owners, real transition media, native types and lint. Do not edit source during active candidate producers, disable the rule or count this failed lint output as qualified.

DEF149 verification: complete native package passes365cases/42owners plus one inherited TODO in D5-candidate-native-coverage.log; unchanged native coverage thresholds pass in D5-native-candidate-gate.json. This includes all actual-media transition cases on the fixed source, following125case controlled Green and passing types/format.

## DEF-US3-151 — Changed-file formatting includes raw reports and unformatted planning updates

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D5 format qualification.

`D5-changed-format-check.log` finds73 formatting failures: manual planning/report Markdown plus raw machine-produced JSON and the append-only execution ledger. Format the manually maintained Markdown. Add narrowly scoped generated-report/append-only-ledger exclusions alongside existing generated output exclusions so producer bytes and the required append-only history remain intact. Product code, tests, ordinary documentation, registry, test list, plan and defect summary remain checked. This changes no test, coverage threshold or product assertion and does not qualify the original failed format run. Re-run the complete changed-file check; verify all374 registry IDs survive formatting.

DEF150 verification: all14 complete affected native owners pass after the sole runtime capture refactor; merged42owner inventory retains365passed/1inheritedTODO and unchanged coverage thresholds. Native types and zero-error/six-inherited-warning lint pass.

DEF151 verification: D5-qualified-format-check.log passes all367changed-file inputs under narrowly scoped raw-report/append-only-ledger exclusions. All374 registry IDs are preserved; product/test/manual-doc formatting remains checked.

## DEF-US3-152 — Pause probe uses another service's clock argument convention

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 internal fixture.

`D6-pause-inner-red.log` fails with client.transaction not a function: the new probe passed a clock callback as the snapshot service's client argument. Its established signature takes a Date third and client fourth. This is fixture/setup failure, excluded from intended Red. Pass the Date correctly and read retained saved events through the existing list service (snapshot does not return events). No Pause implementation/schema/UI has been added; only the symbol declaration returns a business failure. Re-run the complete focused owner and confirm the intended missing-Pause success assertion before production work.

DEF152 verification: corrected full focused owner reaches the intended false-success assertion in D6-pause-valid-inner-red.log and D6-pause-revision-inner-red.log, after authentication/save/future-authority preconditions pass. No real Pause implementation preceded valid internal Red.

## DEF-US3-153 — Typed calendar response fixture omits new automation projection

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 type qualification.

`D6-pause-app-types.log` reports TS2322 only in the pre-existing typed RunnerSchedule load-cancellation fixture: the successful read response now includes the safe automation array. Add automation:[] to the existing no-session-control fixture; preserve all stale-load assertions and production response typing. This is static fixture maintenance after118affected tests Green, not intended product Red. Re-run that complete component owner and app types before the browser build.

DEF153 verification: complete component owner passes1/1 in D6-pause-component-type-fix-green.log; D6-pause-type-fix.log exits0. Production response typing and original load-cancellation assertion are retained.

## DEF-US3-154 — Unconditional deadline await changes synchronous safety fencing

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D6 native deadline propagation.

`D6-pause-exact-inner-green.log` unexpectedly fails three existing runtime cases after adding `await execution.deadlineUpdate` unconditionally in tick: awaiting undefined yields before existing immediate permission fencing/drain dispatch, causing missing immediate drain assertions and a dependent timeout. This is a code regression, excluded from intended Red. Await only an actual pending deadline propagation and clear the settled promise by identity; preserve immediate fencing when no update exists. Re-run the complete runtime/presentation/engine owners and native static checks before the media Green.

DEF154 controlled verification: D6-pause-exact-inner-fixed-green.log passes all101 cases in the complete runtime, presentation and Engine owners. Conditional await preserves immediate existing fencing. Genuine media and refreshed static checks remain pending before Verified.

DEF154 verification: all101 affected native cases and3 genuine media cases pass with anchored deadline propagation; refreshed native types and scoped lint pass. Immediate permission fencing and drain assertions remain intact.

## DEF-US3-155 — Replay observer tears down an in-flight second Chromium launch

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 native media fixture.

`D6-logical-stop-outer-red.log` passes the four established media cases but the new alias replay exits with Chromium extension ERR_FILE_NOT_FOUND. The real watchdog dispatches apply asynchronously; three cache reads do not imply a wrongly admitted second capture has finished startup. Fixture teardown can remove its isolated extension directory while that launch is pending. This setup/cleanup failure is excluded from intended Red. Observe and allow any wrongly admitted second capture to finish startup before emergency cleanup; use a separately signed disposable replay output so it cannot overwrite the first capture's already closed media proof. Preserve expected no-restart assertions and rerun the complete owner before production work.

DEF155 verification: D6-logical-stop-valid-outer-red.log reaches only intended outputStarts/restartedAfterStop assertion failures, with valid cache acceptance, Stop persistence, original clip/final encoded frame/closure and4established cases passing. No startup/extension/cleanup error remains.

## DEF-US3-156 — Owner Resume media precondition produces no fresh encoded output

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 native media evidence.

`D6-owner-resume-outer-red.log`, whole owner `packages/runner/test/bdd/runner-schedule-owner-resume.test.ts`, BDD-US3-EC010, fails at OWNER_RESUME_FRESH_MEDIA_NOT_READY rather than the intended durable Resume control assertion. Native and server intended Reds remain valid, but this outer failure is excluded from Red evidence. Inspect actual Engine/capture/encoder/journal state, repair the evidence precondition if necessary, then rerun this owner before production Resume changes. Also add the missing successful cold-child Resume control observation; assertions remain unchanged.

DEF156 diagnosis: D6-owner-resume-encoder-diagnostic.log shows two real encoder starts, resumed video playback, active journal and live capture, with encoded progress reaching242KiB but file size zero: FFmpeg buffers the small file while the fixture holds the final marker. Observe resumed playback/capture first, then close the physical Engine without owner Stop and require fresh encoded bytes after file flushing. This retains the cold-restart assertion and original signed window; no production change or deadline relaxation.

DEF156 follow-up: first repair still closed the resumed encoder immediately (`Engine.stop`), which deliberately aborts buffered output rather than flushing. Use the actual Engine drain to finish/flush the current clip while leaving the controller journal active (no second owner Stop), and reset the fixture final-frame observer for this new capture. The cold process still must reconstruct accepted Resume state independently. D6-owner-resume-valid-outer-red.log remains invalid precondition evidence.

DEF156 verification: D6-owner-resume-valid-control-red.log now reaches only missing durable occurrence/Resume metadata and consequent cold-restart pipeline assertions. Original owner Stop, signed Resume, fresh resumed capture flushed to encoded media, replacement cache and new process/cache restore all succeed. This is valid expected outer Red.

## DEF-US3-157 — Shared-session media observer references a fixture-block local

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 native media evidence.

D6-same-session-media-baseline.log, BDD-US3-OPT046, fails with ReferenceError at the new observation's `sessionId`, which is scoped inside the fixture setup block. This is excluded from product Red. Read the existing executionJob.id in the observation instead; rerun the whole new media owner. Root D6-same-session-contract-red.log independently reaches the intended missing future-cache and second-member receipt assertions,2expected failures. No production continuity change yet.

DEF157 verification: D6-same-session-media-restored-baseline.log passes the whole genuine media owner in21.943s, proving same session/two logical receipts/one unchanged capture and encoder/continued clip playback. Existing runtime behavior is honest BASELINE; no native production change needed for same-session membership.

## DEF-US3-158 — Continuity probe omits its automatic-delivery observation

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 contract fixture/TDD evidence.

D6-same-session-purpose-red.log's third assertion received undefined because automaticDelivery was calculated but omitted from the returned observation. This is invalid Red for signed-purpose separation; the first two continuity Reds remain valid and their production fixes now pass in D6-same-session-contract-green.log. Correct the returned observation and remove the prematurely added automatic-lease guard until its corrected test proves the intended missing behavior. Retain this ordering correction explicitly; do not count the undefined observation as product evidence.

## DEF-US3-159 — Future same-session rights bypass invalid current capture resources

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D6 schedule-cache issuance regression.

D6-same-session-affected-green.log (whole schedules/continuity/automation/admission owners) passes178 cases but fails3 established TDD-US3-FR012 input-denial vectors: paused current source, missing captured source and unreadable current encrypted targets return2future entries instead of0. Existing assertions are retained; the new independent future-occurrence selection must also require every open current capture's retained source and encrypted target snapshot to remain readable. Implement this guard before further story work, then rerun the entire changed schedules owner with the new continuity owner. Other4owners' successful results remain retained.

DEF158 verification: corrected third purpose contract passes in D6-same-session-affected-green.log and D6-current-capture-restored-green.log; its valid missing-behavior Red remains D6-same-session-valid-purpose-red.log.

DEF159 verification: D6-current-capture-restored-green.log passes109/109 across complete schedules and continuity owners, retaining all3original input-denial assertions and all3new shared-session/purpose contracts. Unavailable current retained sources or targets block future rights; valid adjacent rights remain stable.

## DEF-US3-160 — Continuity constraint observer assumes a second resource owner exists

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 fixture setup.

D6-same-session-negative-baseline.log fails all13 cases because the shared observer throws CONTINUITY_FOREIGN_OWNER_FIXTURE_MISSING. The disposable authorization fixture has one domain resource owner even though it contains additional authentication identities. Seed an explicit disposable foreign domain user with the repository's established minimal users fixture fields before attempting the cross-owner FK vector. No production change; these failures are excluded from product evidence.

DEF160 verification: D6-same-session-negative-restored-baseline.log passes all13 cases; a real foreign resource owner is seeded, and the actual composite foreign key rejects cross-owner continuity linkage. D6-same-session-restored-green.log retains all119 current owning cases Green.

## DEF-US3-161 — Dynamic continuity preparation skips Pause during capture startup

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D6 native lifecycle regression.

D6-starting-pause-red.log passes89 cases (including stalled extension/no late revival) but the new controlled startup Pause case fails: while Engine.start is pending, verified one-window refresh does not shorten the previously prepared two-window renderer deadline to21000. Dynamic preparation narrowed the pre-existing starting/active handling to active only. Restore safe starting-state trimming/deadline delivery while retaining the rule that a fresh unanchored capture cannot be extended without an accepted matching identity. Rerun the complete runtime owner before further changes.

DEF161 verification: D6-starting-pause-green.log passes90 complete runtime cases, restoring21000 deadline propagation while Engine.start is unresolved. The independent delayed-extension case also proves native closure at the original end, a pending/unactivated future identity, no late revival and a later separate permitted capture.

## DEF-US3-162 — New player documents retain the original schedule boundary

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D6 renderer deadline replacement.

D6-replaced-bootstrap-red.log passes23 existing Engine cases and fails2 intended next-document boundary cases (shorter and longer): current-page update changes the live bridge, but the registered evaluateOnNewDocument script still restores the original44980 boundary after navigation. Register the new verified absolute browser end before removing its predecessor; keep one generation bootstrap plus one current boundary script. Preserve the initial native/browser clock mapping, generation binding and native independent fence. No user-facing reload controls or deadline extensions are introduced. Installed Puppeteer Page types verify the supported removeScriptToEvaluateOnNewDocument identifier API.

## DEF-US3-163 — New-document Engine test harness violates strict typing and lint

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 test code gates.

D6-replaced-bootstrap-native-types.log reports5 possibly-undefined execution/deadline accesses; D6-replaced-bootstrap-lint.log reports6 explicit-any errors in the new observer callback types. The115Engine/runtime assertions and genuine media owner pass, but gate qualification is withheld. Use unknown callback arguments and explicit snapshot/deadline precondition narrowing, then rerun the complete Engine owner plus type/lint checks. No production change for this defect.

DEF162/DEF163 verification: D6-replaced-bootstrap-restored-green.log passes157 current Engine/runtime/journal/schedule cases; restored native types and scoped lint pass. D6-replaced-bootstrap-media-green.log retains the real one-capture/two-member continuity journey after the Engine change. Shorter and longer replacement boundaries survive a new document, and repeated updates retain only2bootstrap scripts.

## DEF-US3-164 — Fallback safety fixture violates the Scheduled-only-clips schema guard

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 authorization fixture.

D6-pause-safety-baseline.log cannot complete its shared observer: changing only mode to failsafe while control_mode remains scheduled violates stream_sessions_scheduled_clips_only. This is an invalid fixture, not product Red. Seed the real supported Manual/failsafe combination for this unavailable-automation vector, retaining the existing database guard and expected INVALID_INPUT result; rerun the whole automation owner.

DEF164 verification: D6-pause-safety-restored-baseline.log10cases and D6-pause-free-safety-restored-green.log10cases pass against the real Manual/failsafe state, without weakening Scheduled-only-clips schema enforcement.

## DEF-US3-165 — D6 recovery materialization replaced the calendar baseline owner

Severity: High. Status: Verified. Owner: Feature implementer. Scope: D6 test ownership/coverage regression.

The full native candidate passes49suites/369cases/1inherited TODO in796.4s, but D6 native coverage evaluation fails because schedule.ts has no coverage. Comparing D5 and D6 owner inventories proves schedule.test.ts dropped39existing calendar cases and contains only6new recovery cases. This is a real test-coverage regression, not an accepted exclusion. Recover the original calendar owner byte-for-byte from the Jest source map matching the independently retained D5 SHA256 a474535fe8c2e7fc87026ccf315df9fe7d2b504e0378f97f1c04bd5f05b3a534. Restore that owner and move all6recovery cases unchanged to schedule-recovery.test.ts. D6-calendar-owner-restoration.json records provenance and both hashes. Rerun both complete owners with coverage and reconcile every D5 assertion against the current native inventory. Retain unchanged successful owners only after exact input/counter-map identity checks; do not rerun all16minutes merely to recover two test owners. No production source change, removed assertion or lowered coverage threshold is authorized by this repair.

DEF165 verification: D6-calendar-owner-restored-coverage.log passes both complete owners/45cases. Reconciled current native inventory is50owners/408pass/1inherited TODO. All39original calendar cases retain exact D5 source checksum; every other D5 assertion remains, with only the documented CON008→EC010/CON008 shared-label rename. Production source is unchanged; the moved6case recovery file is byte-identical to its candidate source. Counter-map identity merge restores calendar coverage. Separate unchanged-threshold gaps are tracked as DEF166.

## DEF-US3-166 — Native milestone coverage narrowly misses required statement/branch thresholds

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D6 coverage strength.

D6-native-merged-gate.json has complete module coverage after DEF165 restoration, but execution-runtime statements94.3%miss95% and ordinary aggregate branches84.63%miss85%. Do not lower thresholds or exclude source. Add meaningful fault/guard checks for pending-identity storage failure, renderer update rejection, invalid deadline, pre-browser deadline installation and foreign generation protection. These characterize existing required fail-closed behavior; no production change is presumed. Run complete changed owners with coverage, preserve all prior assertions and match current-source counter maps before merging.

DEF166 verification: D6-native-strength-coverage.log123complete cases plus current types/scoped lint pass; strict matching-map merged coverage passes all unchanged thresholds (ordinary92.02S/85.29B; every critical module95/90). D6-current-fault-results.json12current faults killed/restored with status1 and matching source hashes; D6-current-faults-restored-green.log221cases. D6-native-current-inventory.json reconciles50owners/413pass/1unchanged TODO and every prior D5 case. No production source change for coverage remediation.

## DEF-US3-167 — Application lease mock omits ordered admission selection

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 application checkpoint.

D6-candidate-affected-coverage.log reports20 runnerLeaseService cases failing before their intended assertion because the test query builder lacks orderBy. Production now orders logical continuity members by their immutable end. Extend the mock query API without dropping assertions; rerun the complete owner.

DEF167 verification: D6-app-repair-final-coverage.log passes all190cases across five complete affected owners with the original child timeouts. Existing assertions are retained. No coverage result from the timed-out concurrent attempt is accepted.

## DEF-US3-168 — Commercial transition observer omits signed occurrence identity

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 commercial transition observer.

The same checkpoint fails U22 signedEnd equality. The verifier now requires ordinary scheduled permits to bind occurrenceId and scheduledStart, but this observer constructs its expected identity without those fields. Read both from the immutable admission capture and retain signature/end/shutdown assertions; rerun the whole commercial owner and its owning workflow/browser scenarios.

DEF168 verification: D6-app-repair-final-coverage.log passes all190cases across five complete affected owners with the original child timeouts. Existing assertions are retained. No coverage result from the timed-out concurrent attempt is accepted.

## DEF-US3-169 — Instrumented commercial observer times out during concurrent milestone producers

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 local execution environment.

D6-app-repair-green.log passes61/61 complete cases. The coverage rerun overlaps the433-scenario workflow producer and production browser build; its scheduled-transition child exceeds the unchanged30-second probe limit (ETIMEDOUT). Jest then cannot JSON-serialize the child error because it is circular. This is unexpected setup/resource evidence, not intended product Red. Retain the failed log, finish active producers, then rerun this complete two-owner coverage checkpoint in isolation with the original limits. Do not broaden timeouts or accept absent coverage/results.

DEF169 verification: D6-app-repair-final-coverage.log passes all190cases across five complete affected owners with the original child timeouts. Existing assertions are retained. No coverage result from the timed-out concurrent attempt is accepted.

## DEF-US3-170 — Automation service client type rejects supported transactional safety observer

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D6 build/type gate.

D6-current-browser-build.log fails TS2345 at runner-schedule-automation-probe.ts62/64: the service client annotation requires a full database including $client, while its transaction-only implementation supports the actual Drizzle transaction passed by rollback safety observers. Accept the existing QueryClient union for this service, preserving real nested transaction/savepoint behavior without casts. Original failing type gate is retained. Rerun app types, whole affected schedule/automation/continuity and commercial/lease owners, coverage and browser build. The partially interrupted workflow run is diagnostic only, not a completed milestone.

DEF170 verification: D6-final-app-types.log exits0. D6-app-repair-final-coverage.log190cases and D6-automation-fixture-coverage.log10current cases pass; D6-automation-type-only-proof.json verifies byte-identical executable production source. D6-app-current-inventory.json qualifies48owners/1032pass and preserves all1008prior cases, normalizing only seven runtime-generated UUID labels with multiplicity retained.

## DEF-US3-171 — Automation probe early failure references an uninitialized observer map

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 test fixture/type gate.

D6-current-app-types.log now exposes TS2448/TS2454 at automation probe24: the early failure return references safetyControls before its declaration. Declare the empty observer map before that early return; retain all assertions and transaction rollback vectors. No production behavior changes. Rerun app type check and the complete automation owner with coverage before accepting current evidence.

DEF171 verification: D6-final-app-types.log exits0. D6-app-repair-final-coverage.log190cases and D6-automation-fixture-coverage.log10current cases pass; D6-automation-type-only-proof.json verifies byte-identical executable production source. D6-app-current-inventory.json qualifies48owners/1032pass and preserves all1008prior cases, normalizing only seven runtime-generated UUID labels with multiplicity retained.

## DEF-US3-172 — Default scoped collector omits pure downgrade source

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: D6 coverage inventory.

D6-app-only-diagnostic-coverage.json deliberately excludes pending workflow counters and identifies src/server/entitlements.ts as missing. The default MCP collection manifest omits this pure source, although its complete property owner already passes. As in D5, explicitly collect the existing complete pure owner for this source; merge only its current matching counters. Do not lower thresholds, invent tests or count the repeated owner as additional cases. The two other application-only branch gaps remain pending actual workflow coverage.

DEF172 verification: D6-downgrade-coverage.log passes the unchanged complete9case pure owner and collects100%statements/branches/functions/lines for entitlements.ts. This is the same existing owner, not nine additional feature cases. Current counters supplement the explicit feature source inventory; thresholds are unchanged.

DEF172 permanent default-ownership follow-up: E1-downgrade-collector-red.log records24 passing cases and the intended missing-manifest failure. Add the flat source to both canonical/default collectors; E1-downgrade-collector-green.log passes25 cases, and E1-downgrade-coverage.log passes34 cases across the unchanged nine-case downgrade owner and the complete collector owner. The flat module again has100% every metric, now mandatory by default. This replaces the need for the D6 explicit-source workaround without removing its historical evidence.

## DEF-US3-173 — Interrupted workflow counters contaminate a later complete coverage lane

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: D6 evidence isolation.

D6-final-workflows.log passes433/433, but after collection completes, strict merging rejects schedules.ts counter maps: import/type-only parameter positions belong to the earlier interrupted producer rather than the current source. run-coverage-lane.mjs resets only lane.json and the final report before building, leaving the interrupted raw directory available to the reporter. Raw reports are consumed/deleted during successful collection, so the mixed report cannot be safely disaggregated. Reject this report as coverage evidence while retaining its genuine passing scenario result. D6-workflow-reset-red.log records the intended one-case failure for the missing reset helper. Add isolated cleanup of the owned raw/probe/collector/result artifacts before a workflow producer, retaining other lanes; rerun the complete producer from clean state. Keep counter-map equality and all thresholds unchanged. The earlier branch-gap diagnostic preceded final collector completion and is provisional, not a final coverage result.

DEF173 verification: the clean D6-final-workflows.log passes all433 scenarios in10.5minutes. D6-clean-workflow-initial-map-check.json remaps a completed current child through the real collector and matches every statement/function/branch map. D6-scoped-coverage-candidate.json and D6-final-scoped-gate.json now pass with no foreign counters or lowered thresholds. The rejected mixed run remains diagnostic only. The isolated cleanup regression, current types, lint and formatting pass.

## DEF-US4-174 — Presentation fixture cleanup expects a body-bearing success status

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 browser fixture.

E1-standby-red.log reaches the intended presentation assertion (expected200, actual404), but its AfterScenario incorrectly expects200 from the existing auth-fixture DELETE endpoint, which correctly returns204. Correct the cleanup expectation and repeat the complete focused feature before accepting clean feature Red. No product change is involved.

DEF174 verification: E1-standby-clean-red.log has only the intended Then assertion (expected200, actual404); the corrected204cleanup succeeds. No product code existed for this endpoint. The earlier dual-failure run is diagnostic only.

## DEF-US4-175 — Native transport assertion does not narrow its nullable result

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 test typing.

`E1-native-bootstrap-types.log` reports TS18047 at presentation-bootstrap.test.ts:13: Jest toEqual does not narrow the nullable transport result for TypeScript. The runtime owner passes2 tests; use optional access in the assertion so a missing result still fails the expectation without a compiler error. Re-run the whole transport owner and native type check; no product behavior or threshold changes.

DEF175 verification: `E1-native-bootstrap-typed-green.log` passes2/2 and `E1-native-bootstrap-types-green.log` exits0. No product change.

## DEF-US4-176 — Standby owner edit overwrites scenario-matrix semantics

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 traceability.

A previous broad owner-path edit correctly updated the artifact registry but also replaced FR-016 and the Given/action/result description in its separate scenario-matrix row with an executable path/command. Restore the requirement and behavior columns and point the matrix execution owner at the focused presentation steps. Keep the registry command and stable ID. `E1-traceability-matrix-repair.json` verifies the repaired semantic fields and all374 unique primary artifact IDs; no tests, role mappings or gate thresholds changed.

## DEF-US4-177 — Ordinary idle fixture incorrectly requires playable-video DOM

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 ordinary browser characterization.

`E1-ordinary-browser-baseline.log` passes the authenticated standby case but the ordinary-overlay case incorrectly expects2 video nodes from an empty playlist in initial standby. OverlayViewport only creates video elements after playable media is available. This is not evidence of missing attribution behavior. Replace the invalid video readiness check with the existing player start-control initialization, retain HTTP200 and all negative attribution/generation checks, and rerun the complete focused feature against the same successful current build. No product change or intended Red is claimed.

DEF177 verification: `E1-ordinary-browser-corrected-baseline.log` passes2/2 against the unchanged successful `E1-ordinary-browser-build.log` build. Actual idle player controls initialize and ordinary output has neither attribution nor private-generation markup. Product source remained unchanged.

## DEF-US4-178 — Playable browser fixture has malformed SQL string delimiters

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 test setup.

`E1-playback-fixture-format.log` rejects two single-quoted TypeScript strings containing SQL string literals. No browser/product execution occurred. Use template-literal SQL text with parameterized values, then require formatting, generation and the complete focused owner before accepting playback evidence. This is setup correction, not product Red.

## DEF-US4-179 — Browser steps use a Runner control without their local Window type

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 test typing.

`E1-playback-browser-build.log` fails TypeScript because startRunnerPlayback is runtime-installed by OverlayPlayer but is not in the application's global Window declaration. Native Engine's declaration is outside the app compiler's ownership. Give only these browser steps a local Window intersection, preserving runtime checks; rerun app types/build and focused browser evidence. This is test setup, not an intended product Red.

DEF178/179 verification: E1-playback-fixture-format-fixed.log/E1-playback-fixture-typed-format.log pass; E1-playback-fixture-types.log exits0. E1-playback-browser-typed-build.log succeeds, and E1-playback-browser-typed-baseline.log passes all3 actual browser cases, including real MP4 currentTime advancement and visible attribution. No product change or artificial Red was claimed for these setup corrections.

## DEF-US4-180 — Native fallback probe leaves capture WebSocket listener open

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 native media fixture lifecycle.

`E1-fallback-browser-baseline.log` retains3 passing browser cases but the new native journey reaches both live-forwarder closures and its temporary directory is removed, while the child remains alive until its90second watchdog. The probe closes Engine/proxy/FFmpeg but omits the shared puppeteer-stream wss listener; existing drain-probe.mjs explicitly closes that owner. Add equivalent capture-server closure to the new probe and rerun the complete focused feature before accepting any pixel result. This timeout is test cleanup, not product Red or an accepted successful run.

DEF180 verification: E1-fallback-cleanup-baseline.log passes4/4 actual browser/native journeys in37.8s; the native21second journey exits normally after closing the capture WebSocket owner. It asserts plain red live/returned encoded frames (over50,000 red pixels, fewer than5 white), and actually playing blue fallback with over40 white attribution pixels. No product change or intended feature Red was claimed for the cleanup correction.

## DEF-US4-181 — Native CI/local profile omits the presentation signing prerequisite

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 native workflow environment.

`E1-private-multistream-workflows.log` rejects all5 actual media cases after the shared native HTTP fixture starts calling the real private presentation endpoint. The native local profile supplies no JWT_SECRET (measured length0); the browser profile already supplies its fixed non-production key. The endpoint correctly refuses to sign without a sufficiently long key, so this is missing setup, not product Red. Add the same fixed test key to the three disposable-database CI jobs and native/Jest local instructions/profile, retaining signing-key validation and browser/native environment separation. Rerun the complete five-scenario owner from a fresh job namespace before accepting qualification. The independent-case detached-frame diagnostic occurred during failed startup/retry cleanup; verify whether it disappears with the prerequisite before attributing a separate regression.

DEF181 verification: E1-private-multistream-keyed-workflows.log passes the complete5case actual native owner in2.0minutes after supplying the documented fixed test key, including independent devices. The detached-frame startup diagnostic does not recur. Real endpoint signing checks remain unchanged; no error suppression or threshold reduction. Native CI/local docs now carry the missing prerequisite.

## DEF-US4-182 — Supplemental deployment test conflates string and boolean sentinels

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E1 coverage characterization.

`E1-app-boundaries-baseline.log` passes75 cases but the new Node test assumes the literal string "false" disables a deployment ID. Installed Next's build/define-env.js:95 emits boolean false, which the existing unknown-value sanitizer already handles. process.env stores strings, and a valid string identifier remains an identifier. Test source-commit fallback with the explicit ID absent; retain existing boolean/sanitizer coverage and production behavior. Re-run all4 current whole owners. This incorrect test assumption is not product Red.

DEF182 verification: E1-app-boundaries-corrected-baseline.log passes all76 cases across4 complete owners, retaining every previous case and production sentinel behavior.

## DEF-US4-183 — Appearance setup assumes a connected-only dashboard heading

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 browser fixture navigation.

`E2-top-left-outer-fixture-failure.log` fails in the navigation step at `Stream Configuration`, before the new corner selector assertion. The reused presentation fixture has no recent heartbeat, so the existing dashboard shows Setup Your Runner while still showing its owner-scoped Destinations section. `E2-owner-navigation-fixture-failure.md` retains the real DOM and original test source. Check the existing Destinations heading instead; retain every new corner, persistence, preview and generated-output assertion unchanged. No production change or intended product Red is claimed for this attempt. Rerun the whole focused owner and verify it reaches the expected missing-selector assertion before implementation.

DEF183 verification: E2-top-left-outer-red.log reaches the intended Then assertion `The owner must have an attribution corner selector`, failing on the missing control. The navigation step passes against unchanged production source; every placement/persistence/preview/generated assertion remains intact. This verifies the fixture correction, not the unimplemented feature.

## DEF-US4-184 — New technical test-list rows have an extra column

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 tracking/patch orchestration.

The state updater rejects U278 with `AssertionError: ('U278', 0)` because seven newly added rows included a seventh dependency column in the existing six-column format. The shell batch continued after the metadata exception, creating an unreferenced persistence draft and running the still-Red profile owner; no profile schema or callable save export was applied. E2-profile-first-blocked-patch.log retains six prior passing cases and the expected absent-save failure and is excluded as Green evidence. Correct the rows, retain dependency text in the existing notes column, and use fail-fast shell batches. E2-list-format-correction.json verifies all seven rows and a successful U278=RED update. The intended first-save Red predates every persistence draft; no missing Red is reconstructed.

## DEF-US4-185 — Appearance test fixture types fail the integrated build

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 test typings.

`E2-A17-browser-build.log` compiles product code but rejects the test geometry's widened corner literal, probe principal's widened session kind and write-only inferred result variable when assigned the default read with null profile ID. The focused runtime owners pass57 cases; this is an unexpected static gate failure, not intended product Red. Preserve every assertion and fixture behavior, narrow the two discriminant literals and annotate the observation with the actual exported read/write result union. Rerun whole focused owners and current-source build; retain the failed build evidence. No assertion/typecheck bypass or migration change.

DEF185 verification: E2-A17-typed-fixtures-green.log passes all57 cases across the three complete focused owners. E2-A17-browser-build-restored.log passes the current-source build, including TypeScript and patched-dependency validation. All runtime assertions remain unchanged; failed build evidence remains retained.

## DEF-US4-186 — Authenticated appearance preview inherits the default frame denial

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E2 preview integration.

`E2-top-left-browser-green-attempt.log` passes save/status/reload and persisted Top left but cannot find attribution inside the actual preview iframe. The site-wide fallback headers deny every route not explicitly embed-enabled; the new authenticated preview was missing its narrow exception. `E2-preview-frame-failure.md` retains the DOM and failure. Add SAMEORIGIN / frame-ancestors self only for `/runner/preview/:runnerId` and exclude exactly that route shape from the fallback. The generated native presentation and other private pages retain DENY. Keep all saved preference/geometry/private-output assertions unchanged, rebuild and rerun the whole browser owner. No general third-party embedding permission.

DEF186 verification: E2-A17-preview-header-build.log passes current-source compile/types/build. E2-top-left-browser-header-restored.log passes1 complete browser journey, including attribution inside the actual iframe and private generated output. Authentication and all original assertions are unchanged; private generated routes retain the fallback framing denial. The inherited lazy-module/provider diagnostics match the existing baseline rationale above.

## DEF-US4-187 — Owner-path updater also changes same-shaped scenario matrix rows

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: traceability metadata.

An owner-path update selected every matching ten-column artifact row, including the Scenario Coverage Matrix. Inspection finds28 rows containing execution commands or owner paths in Source/Scenario columns, including earlier schedule/commercial updates and current appearance rows. Restore those two fields from each artifact's unique declared acceptance behavior and criteria in test-list.md, retain execution solely in the primary registry, and reconcile available concrete step bindings. E2-scenario-matrix-field-repair.json records each before/after row, unambiguous behavior binding and the byte-identical primary registry hash. All28 rows repaired; primary IDs/statuses/evidence/commands unchanged. Future owner-field edits must be scoped to the registry section, never row width alone. No product source, runtime test or qualification threshold changed.

## DEF-US4-188 — Readability media fixture queries serialized JSON text as native JSON

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 controlled-media fixture seam.

`E2-readability-media-seam-failure.log` retains6 passing journeys but both real clip playback/native fallback fail after the fixture provider starts choosing media by seeded clip title. A direct read of the disposable database confirms clip_data is text, and PostgreSQL reports42883 for text ->> unknown. `E2-media-seam-sql-diagnosis.json` and the two failure contexts retain the diagnosis. Decode the existing seeded JSON text explicitly in this test-only query; retain owner/id restrictions, actual media playback, pixel/clock assertions and product code. Rerun the complete8case presentation/corner owners before adding readability evidence. This is fixture regression evidence, never intended feature Red.

DEF188 verification: E2-readability-media-seam-restored-green.log passes all8 complete prior corner/presentation journeys in1.6minutes, including actual clip playback and encoded native live/fallback/return. Only the fixture JSON-text projection was corrected. All product code and original pixel/clock assertions remain unchanged.

## DEF-US4-189 — Readability probe attempts a forbidden cross-origin canvas read

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 visual measurement fixture.

`E2-readability-light-canvas-failure.log` passes all4 prior corner journeys and reaches actual playback but getImageData throws SecurityError because the Twitch-style media origin differs from the viewer. This is browser security/setup evidence, not intended readability Red. Keep the player and its origin protections unchanged. Read the actual playing video's URL/intrinsic dimensions and renderer CSS/geometry, fetch only the owned loopback controlled media response and decode its first static fixture frame with FFmpeg in the test worker; verify decoded dimensions against Chrome before computing fixture contrast. Preserve the4.5:1 threshold, opacity/size/clip assertions and actual playback controls. Retain the failure context and rerun the complete5case browser owner; only the expected numeric readability assertion may count as feature Red.

DEF189 verification: E2-readability-light-outer-red.log retains4 prior corner passes and reaches the intended numeric contrast failure1.6886777734688359 versus4.5 after actual decoded light pixels, playback clocks and rendered dimensions/opacity pass. The test fetches only the actual owned loopback static media response and validates decoded dimensions against Chrome; no player/CORS/style mutation. The prior canvas exception is excluded from product Red evidence.

## DEF-US4-190 — Matrix binding editor assumes every scenario is Positive

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 metadata patch guard.

The dark-example patch stops before bddgen at an assertion expecting DEC011's sampling column to say Positive. Its declared classification is correctly Boundary/state. The feature/step additions already applied, but no test or product change ran after that guard. Preserve Boundary/state and all Source/GivenWhen/primary execution fields; update only the concrete step binding. E2-readability-matrix-binding-correction.json verifies the primary registry unchanged and exactly2 readability examples, preventing duplicate insertion when resuming the failed batch. No intended Red or Green is claimed for the stopped patch.

## DEF-US4-191 — Precise surface metrics are measured but omitted from the probe result

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 mobile readability measurement.

`E2-readability-mobile-probe-failure.log` reports NaN in all3 prior desktop examples because a string patch added the surface DOMRect declaration but did not match the formatted multiline result fields. The new mobile example separately reaches its missing360px host width assertion; the whole failed run is excluded as intended feature Red until prior cases are restored. Explicitly serialize surface.width/height with an exact-match patch guard; retain all size/half-pixel agreement, contrast and physical viewport bounds assertions. Rerun the whole4case owner before changing any product CSS. No product regression, threshold reduction or data-schema change is claimed.

DEF191 verification: E2-readability-mobile-outer-red.log restores all3 previous desktop cases and fails only the intended new mobile host-width assertion(expected360,actual264). Precise surface metrics are finite and all strengthened agreement/contrast/dimension assertions pass before that new boundary; no product CSS changed before this valid Red.

## DEF-US4-192 — Collision fixture describes paid title placement that Free runtime normalizes

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 collision sampling accuracy.

Inspection of FREE_OVERLAY_RUNTIME_PATCH confirms that the Free renderer intentionally normalizes title/channel positions and ignores paid fixture position edits. The first bottom-right title Red/Green remains valid, but newer preference examples must not claim the title itself moves to each corner. Remove ineffective paid fixture edits, describe the four saved attribution preferences accurately, and assert clearance against both actually visible Free title/channel panels. Keep actual runtime authority unchanged; do not grant Pro just to manufacture a Free scene. Existing successful runs are retained as preference-only partial evidence, superseded by strengthened whole-owner runs. No product failure or new intended Red is claimed.

DEF192 verification: `E2-collision-free-panels-fixture-green.log` passes all3 current preference examples with both actual visible title/channel rectangles and unchanged12-reference-pixel clearance. Ineffective paid configuration fixture edits removed; Free runtime authority remains unchanged. Prior preference-only passes are superseded, not counted as complete corner-collision evidence.

## DEF-US4-193 — General layout readiness marker uses the attribution-only prefix

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 presentation marker compatibility.

`E2-collision-blocked-inner-green.log` is a rejected Green attempt:21 cases pass, but the retained clean-presentation owner rejects data-runner-attribution-layout=clean because clean output must contain no attribution marker. Preserve the existing assertion and use the general data-runner-layout-status namespace for layout readiness. No threshold/assertion weakening and no claimed intended product Red. Re-run all22 owning cases and current build/browser matrix before verifying the fix.

DEF193 verification: `E2-collision-blocked-inner-restored.log` passes22 unchanged owning assertions, rebuilt current source/types pass, and `E2-collision-blocked-browser-green.log` passes all6 corner/dynamic/blocked browser cases. Clean output has no attribution-prefixed marker; general layout state uses data-runner-layout-status.

## DEF-US4-194 — Owner-card unit uses a Playwright option in Testing Library

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 owner-card test typing.

`E2-save-preflight-build.log` compiles product code but full TypeScript rejects exact:true on Testing Library getByRole (TS2769). The23 scoped unit cases passed; browser execution never began. Remove only the unsupported option; the string role name still selects the same exact Save appearance control. Preserve all bounded-wait/no-persistence/retry assertions. Re-run the changed whole-file unit and rebuilt10-case corner/collision browser owner. This is a test authoring defect, not intended feature Red or a retained product regression.

DEF194 verification: changed whole-file unit passes (`E2-preview-loading-typed-unit.log`), current build/types pass (`E2-save-preflight-restored-build.log`), and all10 actual corner/collision browser cases pass (`E2-save-preflight-browser-green.log`), including blocked-save owner message and unchanged real PostgreSQL profile. Only the unsupported query option was removed.

## DEF-US4-195 — Lifecycle DOM fixture omits the browser default opacity

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 client lifecycle unit fixture.

`E2-collision-standby-conflict-inner-red.log` is rejected as intended Red: the initial blocked precondition is not established because JSDOM returns an empty computed opacity for an unstyled test panel; the actual browser default is1. Explicitly set opacity1 on the external player-panel fixture. Keep geometry, actual React lifecycle/MutationObserver and all assertions unchanged. No product code changes until the corrected run first establishes the collision, then fails only after removing the panel for standby. The physical browser outer Red already verifies this lifecycle gap.

DEF195 verification: `E2-collision-standby-conflict-inner-corrected-red.log` establishes the initial blocked error successfully and fails only at the second assertion after standby removes the panel. Product code was unchanged until this valid state-lifecycle Red; the original setup failure remains excluded.

## DEF-US4-196 — Resize boundary assertion reads before effects settle and uses a camel-case CSS key

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 settings-card resize unit.

`E2-card-resize-baseline.log` retains8 passes but both new viewport cases read initial scale(0), before the asynchronous ResizeObserver effect settles, and toHaveStyle expects CSS property spelling transform-origin. This is not intended product Red: the same720p/1080p behavior already passes at the real browser boundary. Await observable settled styles and use the canonical CSS key while retaining exact360/canvas scales and full width/height assertions. No product changes. Verify the entire Card owner and mutation sensitivity before closure.

DEF196 verification: `E2-card-resize-corrected.log`10Green with exact dimensions/scales preserved. Deliberately replacing scaling with scale(1) kills only2 resize cases while8 retained cases pass (`E2-card-resize-fault.log`); exact-restored10Green in `E2-card-resize-restored.log`. No product fix or intended missing-feature Red was claimed.

## DEF-US4-197 — Application candidate uses the initial E1 owner list instead of its final inventory

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 gate inventory assembly.

`E2-app-owner-inventory-gap.json` detects61 candidate owners versus62 required before any current full qualification is claimed. The temporary candidate orchestrator read E1-app-owners.json (initial57) rather than the final58-owner qualified inventory; test/app/lib/deployment.server.test.ts was added at the earlier repair checkpoint. No product assertion has failed. Preserve the active61-owner run, execute the omitted entire owner under identical source/tooling inputs, and reconcile all prior1161 cases and compatible coverage maps before passing T677. No full producer replay or missing-case waiver.

DEF197 verification: retained candidate61 owners/1214 passes; `E2-app-deployment-supplement-coverage.log` runs the omitted entire5-case owner Green. `E2-app-current-inventory.json` verifies62 complete owners/1219 passes, all1161 E1 cases retained,1574 source/test/tooling inputs unchanged and only7 previously recorded runtime UUID label normalizations. `E2-app-coverage-merge.json` verifies compatible counter maps across29 current affected sources with no foreign/missing map. Template cleanup exits0. No reduced sample, waiver or repeated61-owner producer.

## DEF-US4-198 — Native media fixture omits the new presentation layout-readiness marker

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 native package and MCP multistream media fixtures.

Command: `bun run --cwd packages/runner test --runInBand --coverage --collectCoverageFrom=src/**/*.ts --coverageDirectory=coverage/runner-E2-candidate --json --outputFile=specs/004-runner-free-pro/tdd/evidence/E2-native-candidate-results.json`. Native BDD cached schedule cases fail `Cached scheduled start missed thirty-second SLO` at test/support/drain-probe.mjs:551. Expected current Green versus actual startup refusal: the fixture private page declares its generation but omits data-runner-layout-status, so the correctly strict production guard refuses it. The unbranded synthetic page should declare clean layout. Stop the doomed producer (exit130; child processes verified gone), update only that external fixture declaration, retain all auth/generation/drain assertions and30s SLO, run the whole cached-schedule owner without coverage then rerun the complete native gate. Never weaken the production readiness predicate or treat this setup mismatch as intended product Red. Initial partial log retained/excluded as `E2-native-fixture-missing-marker-rejected.log`; it never qualifies the native gate.

DEF198 focused verification: `E2-native-fixture-cached-owner-green.log` passes the entire BDD-US3-FR012 owner using actual local encoded media in20.459s, retaining the original timeout/clip-completion/final-frame/no-next-clip assertions. Only the unbranded external page now declares clean readiness. No orphan test-browser processes remain. Complete native gate verification is pending; previous rejected input manifest/log remain immutable.

DEF198 complete verification: `E2-native-candidate-coverage.log` passes all51 owners/438 cases plus1 unchanged inherited TODO in803.012s. `E2-native-current-inventory.json` retains all438 E1 cases and verifies103 current native execution inputs; the sole title extension retains cookie/navigation checks and adds layout readiness assertions. `E2-native-candidate-gate.json` passes unchanged critical95/90 and ordinary90/85 coverage thresholds. All198 canonical defects are Verified; no deferred/accepted exception.

DEF198 reopened at the workflow boundary: first fresh433-scenario producer reports428 passes and5 failures, all runner-multistream.feature cases. Dispatch/configuration are accepted; native capture fails because test/support/mcp/runner-multistream-media.ts:81 has a second unbranded synthetic private page without layout readiness. The production guard is correct. Full marker search finds exactly2 synthetic private-page body templates (this workflow helper and the now-correct native drain helper); the real production renderer declares pending/placed/blocked/clean itself. Preserve rejected workflow log/input manifest, update only this Pro unbranded fixture with clean readiness, run all5 owning scenarios without coverage then fresh complete433 coverage. Native51-owner qualification stays valid: this helper is not among its103 inputs. No guard/timeout/assertion weakening.

DEF198 workflow focused verification: `E2-multistream-fixture-owner-green.log` passes all5 complete actual media scenarios in1.9m: one capture to2 destinations,2 independent broadcasts, YouTube/Twitch/custom RTMP. Original audio/final-frame/source-prefix/stop assertions pass. Failed workflow job and focused-job template cleanup both exit0. The restored complete433-scenario gate remains mandatory.

## DEF-US4-199 — Encoded attribution sampling needs current-position/frame diagnosis

Severity: Low (confirmed probe phase/position mismatch). Status: Verified. Owner: Feature implementer. Scope: E2 actual native fallback browser gate.

Whole4-case `runner-presentation.feature` run has3 DOM cases Green and encoded live/fallback/return fails expected attributionWhitePixels>40 versus0 in E2-presentation-encoded-region-rejected.log. Authentication, actual selected-clip playback, blue encoded media and DOM attribution visibility pass. The probe reads the DOM rectangle once and accepts the first blue decoded1fps frame; E2 now moves attribution to avoid dynamic panels, so timing/position correspondence must be established before classifying this as missing encoded branding. All pixel thresholds and phase assertions remain unchanged. Move diagnostic attachment/output before assertions so failure observations are retained, rerun the whole owner, inspect actual coordinates/global white pixels before any product or sampling change. No intended feature Red claimed.

DEF199 diagnosis: exact decoded PNG E2-encoded-fallback-placement-diagnostic.png visibly contains the top-right Clipify badge, and E2-encoded-position-diagnostic.json has63 total white pixels,0 in the earlier bottom-right rectangle, live/returned0. DOM before encoding is bottom-right (top0.8481); DOM after the encoded phase is top-right (top0.0222). The product correctly avoids title/channel panels; the probe samples position before its encoded phase is available. Gate actual blue encoded media before reading its current DOM rectangle, then independently count that frame region with the unchanged>40 threshold. No product change, pixel-gated wait, timeout increase or rejected-Red reclassification. Whole4-case verification pending.

DEF199 verification: whole4-case owner Green in37.3s (`E2-presentation-browser-restored.log`). Actual fallback has63 white attribution pixels in the current top-right rectangle; both live/returned phases have0. The before/after sampled rectangles now match exactly. Existing>40 and<5 thresholds remain; no attribution-pixel-gated wait or product change. All3 exact decoded PNGs and JSON are retained under current E2 paths; original E1 observation checksum remains byte-identical. Helper formatting changes no bytes.

## DEF-US4-200 — Local coverage orchestration passes Istanbul wrapper instances instead of raw maps

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 local post-producer coverage adapter.

Command: `node /tmp/clipify-E2-app-workflow-gate.mjs`. All433 workflow cases pass, but the temporary adapter supplies map.toJSON() wrapper instances to the strict raw-map validator, reporting Invalid executable source coverage for all29 files. The serialized persisted report already passes evaluateMcpCoverage with unchanged classifications/thresholds. Normalize the adapter to plain serialized raw counters exactly like the retained E1 adapter; keep validator/counters/maps/thresholds unchanged. Verify byte-identical raw report and rerun only the postprocessing check, not the successful1219/438/433 producers. `E2-coverage-adapter-rejected.log` retains the rejected attempt.

DEF198 final workflow verification: fresh complete433-case producer passes9.8m, no missing/skipped/flaky cases; current-input verification and template cleanup pass. Native51/438 and restored5-case multistream evidence remain current for their scopes.

DEF200 verification: the strict29-source gate passes after normalizing only the in-memory adapter representation. The persisted raw merged report SHA256 is byte-identical before/after; validator, maps, counters, all thresholds and producer outputs remain unchanged. No producer rerun required. `E2-app-workflow-gate-check.log` ok:true/errors:[]. All200 canonical defects Verified.

## DEF-US4-201 — SSR fixture passes children through the React factory props argument

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E2 full lint gate.

`bun run app:lint` rejects test/server/runner/branding.test.ts:50 with react/no-children-prop; the6 other warnings match the retained E1 baseline. Pass children through React.createElement's third argument. Keep the other props checked with satisfies/Omit; the assertion to the renderer props type only accounts for the factory supplying the required child. Preserve all markup assertions and production code. Run the whole21-case owner without coverage, then static gates; do not weaken/disable lint or replay unaffected successful producers. Rejected output retained in E2-ssr-test-lint-rejected.log.

DEF201 verification: the complete21-case SSR/branding owner passes without coverage (`E2-ssr-test-whole-green.log`); app typecheck and full lint pass with zero errors and the same6 inherited warnings. No product source or assertion changed. All201 defects Verified.

## DEF-US4-202 — New Pro browser command anchors a relative path against absolute discovered files

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 outer-test discovery command.

`bunx playwright test --project=bdd-chromium '^.features-gen/bdd/runner-free-pro.feature.spec.js$' --grep 'A Pro owner chooses a clean generated presentation'` reports `Error: No tests found.` The runner matches absolute file paths; this is no product Red. Preserve E3-A18-discovery-rejected.log and correct only the command path regex to `/bdd/runner-free-pro.feature.spec.js$`. Verify exactly1 discovered new case, then execute unchanged tests against unchanged runtime.

DEF202 verification: corrected discovery lists exactly1 new browser case; execution reaches its intended missing-control assertion. Original rejected command output remains excluded.

## DEF-US4-203 — Browser helper clicks HeroUI's covered switch input

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 opt-in browser interaction.

The2-case Pro browser run retains clean-output Green, but opt-in times out at `attribution.setChecked(enabled)`: HeroUI's visible switch thumb intercepts pointer events over its native input. This is not the intended missing-renderer Red. Preserve E3-A133-pointer-interception-rejected.log, use the real accessible keyboard interaction (focus and Space when a change is needed), assert the resulting checked state, and rerun both unchanged cases. No force click, synthetic change event, timeout increase or runtime change.

DEF203 verification: same2 cases execute with actual keyboard interaction; checked state persists through save/reload and opt-in now fails at the intended missing-branding preview assertion. Clean-output regression remains Green.

## DEF-US4-204 — Shared HeroUI unit double erases switch semantics and events

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 draft-preview component unit setup.

The11-case component owner retains10 passes but the new draft-choice test cannot find a switch. The real browser already verifies that control; the shared `test/__mocks__/heroui-react.cjs` falls back to a generic div for Switch and drops isSelected/onChange. This is not missing product behavior. Extend the existing shared double with the native controlled checkbox/switch contract and compound presentation slots, then rerun the unchanged whole owner to reach the actual missing draft-query assertion. Keep the real browser owner authoritative for HeroUI interaction; do not add a separate local component double or change production to satisfy the mock.

DEF204 verification: unchanged11-case owner reaches intended draft-query assertion, retaining all10 prior passes. Controlled switch state changes correctly; actual HeroUI semantics remain browser-owned.

## DEF-US4-205 — New unit fixture declarations fail full TypeScript validation

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 browser-build static gate.

The94 application cases pass, but the browser build rejects2 test declarations: Testing Library findByRole does not accept Playwright's exact option, and the generated-surface input array widens to string[] rather than the literal surface union. Preserve E3-A133-test-types-rejected.log. Remove only the unsupported option (string accessible-name matching remains exact by default) and retain literal types with as const. No product source, assertion, filter or type-check suppression changes. Run both whole owning files without coverage, then rebuild and execute both current Pro browser cases.

DEF205 verification: `E3-U133-typed-owners-green.log` passes both whole owners/34 cases; current browser build completes TypeScript and patched-dependency checks successfully (`E3-A133-browser-build.log`). No runtime/assertion/type-suppression change. Pro browser feature qualification remains a separate pending gate.

## DEF-US4-206 — Expiry fixtures ignore the established partner Pro grace period

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 finite-validity test fixtures.

The31-case owner-read Green attempt retains30 passes but returns validUntil exactly7 days later than expected. `grantAccessEndsAt` correctly adds the established7-day transition period to partner Pro grants. The fixture needs a finite trial grant, which has no partner grace. The browser expiry fixture uses the same mistaken grant kind; retain/exclude E3-A180-partner-period-rejected.log as full entitlement-expiry proof, though its historical captured-deadline observation remains diagnostic. Correct only those two new fixtures to reverse_trial. Rerun the31-case whole owner and the corrected outer scenario against the preserved successful pre-expiry E3-A133 browser build. The clock/policy inner Reds preceded production changes and remain valid; do not fabricate a new pre-source outer timestamp or change the real grace policy. Build the expiry runtime only after corrected outer evidence is captured.

DEF206 verification: finite trial owner-read whole31-case owner passes with exact validUntil. Corrected browser fixture positively plays cleanly before the real paid deadline and reaches the missing-badge assertion against the retained pre-expiry browser build. Runtime build ID and actual correction timing are retained; only app clock/policy inner Reds are claimed pre-source after this fixture repair. Partner grace and original failed evidence remain unchanged.

## DEF-US4-207 — Native output opens before the playing-content layout is measured

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E3 actual generated-output startup audit / prior A178 invalid-configuration contract.

`E3-startup-audit-red.log` fails accepted=false versus true at the actual Engine/private-page boundary. Retained `E3-startup-audit-observations.json` shows the matching generation has2 overlay panels and blocked layout, yet accepted=true and encoderOpened=true. Receiver bytes were0 when observed; do not claim an encoded bad frame. Initial standby readiness does not establish playing-layout readiness. Fix must preserve capture-before-playback/source-prefix order, wait for the fresh content phase and its matching measured layout before opening encoder/destinations, clean up capture, and return an ordinary configuration refusal rather than throwing a user error. Add frontend protocol unit evidence before its code, then the native whole-file guard Red/Green, then actual scenario and unchanged live/fallback regression. T678 remains blocked until verified.

## DEF-US4-208 — Early Red leaves a one-shot deferred media fixture for the next case

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 player whole-file test setup.

The new content-phase case correctly fails at absent metadata, but its not-yet-consumed mockImplementationOnce leaks into the next retained standby case, producing an unrelated second failure. Preserve E3-U291-deferred-fixture-rejected.log. Arrange that one-shot deferred media response only after the initial metadata assertion and before the playback action, then rerun the same complete59-case owner. No production change, assertion removal, test filtering or relaxed wait is needed; the valid product Red must retain58 prior cases Green.

DEF208 verification: complete59-case owner retains58 prior passes and fails only the new absent Runner metadata assertion. No product source changed before the corrected Red.

DEF207 refined diagnosis: actual13-case check retains12 passes and the same startup failure. PlayerOverlay has no panel DOM during its1s delayed entry; the early measurement therefore cannot see future bounds. Add test-first Runner-only pre-fade geometry with identical scale/position/theme, retaining ordinary timing and all source-prefix/pixel assertions. Preserve E3-startup-delayed-panel-rejected.log/results and current observations.

## DEF-US4-209 — Decoration fixture measures a reserved title before its displayed panel

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 decoration browser owner.

The complete two-case owner retains one pass but the shadow case throws on a null displayed-panel ancestor. The title now truthfully exists inside the inert pending reservation before entry; a title-only visibility wait does not establish that its ancestor is the displayed panel. Preserve E3-decoration-timing-rejected.log/results.json. Scope the existing title locator to the actual displayed panel, retain every shadow/clearance assertion and rerun both cases. Explicit paid attribution in both fixtures preserves their pre-existing branded intent after Pro defaults clean.

DEF207 verification: E3-reserved-layout-browser-results.json passes all13 current collision/presentation cases. E3-startup-qualified-observations.json records accepted=false, encoderOpened=false, zero receiver bytes and matching-generation blocked layout with2 panels. Whole8 app owners176 cases and native Engine34 cases pass; E3-decoration-browser-results.json retains both physical decoration cases. No encoded invalid frame claimed.

DEF209 verification: both unchanged decoration scenarios pass after waiting for the actual displayed panel; shadow geometry and clearance assertions remain intact.

## DEF-US4-210 — Renewed paid generated playback uses its historical appearance deadline

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E3 effective appearance renewal.

E3-renewal-browser-audit-results.json retains the genuine expiry pass but the added renewal boundary fails expected zero attribution badges versus one after the former deadline. The real finite trial was extended before expiry; the page continues using the historical captured paid deadline without authoritative refresh. Preserve captured admission/source/target ownership and clip continuity; add authenticated owner-bound appearance freshness without restarting playback. Failed refresh must retain the last known finite expiry. Red precedes all renewal production changes.

DEF210 verification: E3-renewal-browser-green-results.json passes both actual finite-expiry and renewed-benefit scenarios on E3-renewal-browser-build.log current runtime. The original marked video keeps advancing with the same execution generation in both. Four whole app owners88 plus expanded2 owners18 retain94 distinct cases; full affected appearance gate remains pending.

## DEF-US4-211 — Manifest-check process starts before its temporary working directory exists

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 read-only build-manifest gate command setup.

Tool process creation rejected workdir /tmp/clipify-E3-browser-action-check before its directory-creation shell could execute. No product or test code ran; E3-action-check-cwd-rejected.txt preserves setup evidence, excluded from product Red. Create the disposable directory/symlink from the existing repository cwd, then execute the unchanged read-only check there. E3-final-browser-actions.log passes. Browser producer and its source remain unchanged.

## DEF-US4-212 — E3 startup metadata and expiry code fail the mandatory React lint gate

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E3 full app lint.

`bun run app:lint` returns11 errors and the6 retained warnings:4 explicit-any declarations in the native Engine guard fixture,6 render-time ref access findings propagated from Runner content metadata in overlayPlayer.tsx, and1 synchronous effect state-update finding in runnerGeneratedPresentation.tsx. These are E3 changes and block T678; functional Greens alone do not qualify the slice. Preserve E3-final-app-lint.log as rejected gate evidence. Wait for the active immutable browser producer, then use React state for rendered content epoch, an external clock subscription for paid expiry, and erased unknown types for fixture callbacks. No lint suppressions, rule changes, weakened assertions or threshold reductions. Rerun whole owners, lint and current-source browser/coverage gates.

DEF212 focused verification:75 complete component cases pass after React-owned content epoch / external paid-clock subscription refactoring; full app lint now has0 errors and the same6 warnings. Native fixture types emit byte-identical executable JavaScript through the actual configured Jest transformer (E3-native-fixture-type-review.json). No rules or assertions were disabled. Full current-source appearance qualification remains pending.

## DEF-US4-213 — Native startup additions leave ordinary branch coverage below the required floor

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E3 native coverage gate.

All35 instrumented owners pass403 cases plus the inherited TODO, but the unchanged13-source coverage gate reports ordinary aggregate branches84.47 below85 (713/844). Critical thresholds pass. Preserve E3-native-initial-current-coverage-gate.json and initial reports. Add missing initial-metadata, delayed readiness success/failure and revoked-permission boundary checks to the whole existing Engine owner, with no production or threshold changes. Rerun the full owning Engine file and35-owner coverage inventory; retain the already-qualified physical media owners only with explicit source/ownership proof.

## DEF-US4-214 — Added native metadata fixtures omit the generated root's content descendant

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 complementary Engine boundary tests.

The42-case whole owner fails9 cases with33 passes. New fixtures expose getAttribute on the root instead of its queried content descendant, causing a TypeError and capture retries; deferred cases consequently time out and contaminate one later legacy assertion. Preserve E3-native-added-fixture-rejected.log and exclude the whole attempt from product Red and qualification. Fix only the two new DOM fixtures to reproduce the real root/content nesting, retaining all assertions and the deferred readiness fence. No production change, timeout increase or filter. Rerun the complete42-case owner before coverage.

DEF214 verification: unchanged42-case owner passes in0.465s after correcting only the two new root/content fixture shapes. All assertions, normal refusal checks and deferred readiness fencing remain intact; no production/timing/filter changes.

DEF213 verification: all35 current instrumented owners pass411 cases plus the inherited TODO. Ordinary branches86.01 exceed unchanged85; all13-source thresholds pass. The combined51-owner inventory retains every439 previous pass and adds8 meaningful boundary cases for447 distinct passes. Its16 physical media owners retain identical executed production/helper inputs; explicit type-only and added-case reviews preserve the original manifests. No duplicate physical execution is claimed.

## DEF-US4-215 — Diagnostic coverage adapter passes class instances into the strict JSON checker

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 temporary source-coverage diagnostic.

The first app-only diagnostic incorrectly flags all31 checked source entries as invalid because CoverageMap.toJSON retains FileCoverage instances in memory. The existing strict checker requires plain JSON, as the E2 adapter already provided. Preserve E3-app-only-coverage-diagnostic.log; deep JSON serialization restores the intended data representation. E3-app-only-coverage-diagnostic-fixed.log contains no invalid-source errors and exposes actual coverage results. This was tooling input shape, not a product Red; no checker, counter, threshold or source was changed.

## DEF-US4-216 — Current appearance counters and a planned critical statement floor need additional evidence

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E3 app coverage.

The complete64-owner run passes1263 cases, but the app-only diagnostic identifies UI gaps independent of workflow coverage: generated-surface branches89.38 versus90; panel branches76.66 versus85; core player statements88.96 versus retained89.02/functions87.87 versus88.2, including an unexercised Runner Stop epoch callback. Add meaningful indefinite-renewal, right/bottom/default/no-fade and Stop assertions without production changes. The mandatory critical statement95 floor also needs explicit verification; the prior wrapper used the shared helper's90 default and retained destination statements94.63. Add a safe persisted-URL rejection baseline and require the full current workflow merge before any current qualification. Expected workflow-owned app-only shortfalls remain diagnostic, not falsely final failures. No floor/configuration/exception is relaxed.

## DEF-US4-217 — Persisted-URL baseline returns before its later fixture decryption binding initializes

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E3 added destination fixture.

The4-owner run retains96 passes but the one new persisted-URL baseline raises a fixture ReferenceError for decryptString before initialization after the real save already returns. Preserve E3-app-strength-fixture-rejected.log and exclude it from product Red. Assert the retained credential's original nonempty ciphertext bytes and non-plaintext storage directly; this matches the unchanged-credentials contract and avoids the later helper binding. Keep every public refusal/revision/storage assertion and rerun complete owners with required coverage. No production change, filter or weakened assertion.

DEF217 verification: current four whole owners pass97 cases with coverage. The persisted unsafe URL returns structured INVALID_INPUT; the entire stored row, original nonempty encrypted credential and configuration revision remain unchanged. No production or assertion suppression.

DEF216 verification: E3-app-workflow-coverage-gate.json passes all32 collected sources after the current433-scenario owning workflow execution. Declared critical S/F/L95 and B90 are enforced explicitly. Generated/panel thresholds pass; new core Runner counters are100% with all measured E2 whole-core floors preserved. Current64-owner1267-case inventory retains every prior case. No source/configuration/floor reduction or duplicate workflow label execution.

DEF212 final verification: current E3-final-browser-current-inventory.json qualifies all83 cases/9 owners, retains every78 E2 case, zero retries/skips and unchanged1578 runtime/test inputs. Current whole component/core source gates, 32-source app/workflow coverage, native447 qualification and full lint0 errors/6 retained warnings pass. React-owned epochs and external paid-clock subscription preserve actual playing clips, required expiry branding and clean renewal.

## DEF-US4-218 — Appearance editor fixture omits the new required color field

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 browser-build TypeScript gate.

The color build fails with seven TS2345 diagnostics in test/app/components/runnerBrandingPreview.test.tsx: its shared mocked profile lacks the newly required standbyBackgroundColor. This is a fixture contract update, not an intended product Red. Preserve E4-color-browser-build.log. Add the standard #000000 field to that shared fixture, retain all assertions, run its complete owning file and rebuild. No production workaround, type cast, filter or skipped test.

DEF218 verification: all11 complete editor cases pass in E4-color-editor-green.log; E4-color-browser-build-retry.log passes compilation, full TypeScript and patched dependency validation. Shared fixture gains only standard color; every assertion remains.

## DEF-US4-219 — WebSocket adapter reads a lazy Next.js route before its module is ready

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E4 actual browser server runtime.

E4-color-browser-green.log and E4-standby-owner-baseline.log contain intermittent unhandled E1421 lazy-userland rejections despite passing browser assertions. Installed next-ws importRouteModule awaits require() but reads routeModule.userland without awaiting its ensureUserland hook. Next16.3.8 exposes userland through LazyModule.assertLoaded. Reproduce the installed adapter upgrade callback against the real Next LazyModule with deferred loading; then apply a reproducible dependency patch that awaits the hook inside the existing import error boundary. Preserve compatibility with synchronous older modules and handle load failure by closing the socket. Rebuild and verify actual browser/WebSocket journeys before closing. No suppression of errors or assertions.

DEF219 verification: E4-nextws-green.log passes6 adapter/resolver cases; E4-nextws-runtime-green.log passes21 existing runtime cases. E4-nextws-browser-build.log passes compilation/TypeScript and2 patched-dependency validations. E4-nextws-browser-green.log passes the actual standby journey; the complete server log is checked for absence of unhandledRejection and the exact lazy-module invariant. Original failing cases/logs remain.

## DEF-US4-220 — Generated standby image URL omitted from component destructuring

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 first image Green attempt.

E4-image-inner-green.log retains117 passes but the existing paid-color transition case raises ReferenceError because standbyBackgroundImageUrl was added to the prop type and renderer use without destructuring it. Preserve the failed seven-owner attempt as rejected Green, not intended product Red. Add the missing destructured prop without weakening assertions; rerun the complete client and server renderer owners, then current browser build and standby image journey. Upload/profile persistence already passed its whole owner and is unchanged by this correction.

## DEF-US4-221 — Installed Sharp ESM types require a named OutputInfo import

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 image build type gate.

E4-image-browser-build.log fails TS2503 at branding-assets.ts:32 because default-import namespace sharp.OutputInfo is unavailable in installed Sharp0.35.5 ESM declarations. Use its named type OutputInfo; preserve runtime code and assertions. No type bypass or dependency downgrade. Rerun current browser build and image journey; the original failure remains retained.

DEF220/221 verification: corrected whole renderer owners16/16, current full browser build/types/2-patch validation, and both real standby browser cases pass. E4-image-type-only-review.json proves the Sharp type import repair emits identical executable JavaScript to the tested inner service. Original rejected Green and build failures are retained.

## DEF-US4-222 — Cleanup-failure fixture initially omits its injected delete exception

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 extra cleanup-failure test.

The first8-case attempt retains7 passes but the new cleanup-failure case sees only1 asset because its proxy did not inject the delete failure at all. Preserve E4-asset-cleanup-failure-red.log as rejected fixture evidence, not product Red. Add the intended exception inside the existing delete proxy; keep every assertion and rerun the whole owner before production changes. Expected product Red must be the propagated post-commit exception, not asset-count mismatch caused by a successful cleanup.

DEF222 verification: corrected8-case owner retains7 passes and reaches the intended cleanupThrew=true assertion failure; the injected exception is now observed after the real profile commit. E4-asset-cleanup-failure-product-red.log is valid product Red; the original mismatched asset-count attempt remains rejected.

## DEF-US4-223 — Active presentation policy refresh does not renew the scoped ten-minute cookie

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: E4 long-lived generated standby and policy continuity.

The real signer/verifier issues600-second presentation credentials. E4-cookie-renewal-clock-red.log retains6 policy cases but the new long-lived case fails because an otherwise authorized refresh at9minutes returns no renewed cookie. Private asset and policy requests can lose authorization at the original cookie deadline during an ongoing broadcast. Add a new signed same-identity cookie only after current execution/owner revalidation, preserving600-second individual TTL, path/HttpOnly/SameSite and paid validity. Verify original-cookie expiry, denied/revoked refusal and paid downgrade independently. This extends existing U294/EXP001 duration evidence; no new subscription rights or output admission.

DEF223 verification: current policy9/9 and related three-owner66-case composite pass; E4-cookie-browser-build.log passes build/types/2-patch validation; current standby browser3/3 explicitly checks actual renewal headers and scoped HttpOnly/SameSite/Max-Age600. The controlled real-signature test retains individual expiry and paid downgrade, and expired/revoked requests receive no renewal. T1046 awaits the full E4 checkpoint as declared.

## DEF-US4-224 — Image-refusal assertion also matches the Next route announcer

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4-BND017 browser fixture.

Command: bunx playwright test --config playwright.config.ts --project=bdd-chromium /bdd/runner-standby-bytes-boundaries.feature.spec.js$ --workers=1. The first whole-file run passes both accepted sizes, but the oversized-file assertion fails with a strict-mode locator violation: getByRole(alert) selects both the correct visible size refusal and Next's route announcer. This is unexpected fixture failure, not product Red. Preserve E4-BND017-browser-baseline.log. Target the actual image-validation error text, retain every stored-profile, asset and reloaded-image assertion, and rerun the complete byte-boundary browser file. No production edit, retries, skip or reduced sample.

DEF224 verification: E4-BND017-browser-green.log passes all3 byte-boundary browser cases; the explicit visible image-validation error and unchanged old profile/assets/reloaded screen are asserted. All11 API cases remain passing in E4-BND017-inner-baseline.log. No production change or manufactured Red.

## DEF-US4-225 — Empty-playlist browser fixture requires the internal empty phase despite explicit standby entry

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 FR019 browser fixture.

Command: bunx playwright test --config playwright.config.ts --project=bdd-chromium /bdd/runner-standby.feature.spec.js$ --workers=1. The new FR019 browser case deletes every owned playlist clip and reaches the active presentation showing its saved background and message, but its assertion requires data-runner-content-phase=empty. Assigned presentations explicitly enter initialStandby, so the supported no-content standby phase is standby. This is an unexpected test assumption, not missing product behavior. Preserve E4-empty-playlist-browser-baseline.log and its failure context. Assert a nonplaying standby/empty phase while retaining the exact empty-database precondition, configured image/color/message and no-playback assertions, then rerun the whole owner. The independent component test separately verifies empty phase, detects removal of empty-phase handling and passes after exact source restoration.

DEF225 verification: E4-empty-playlist-browser-green.log passes all6 real standby cases, including the exact empty-owned-playlist precondition, configured background/color/message and nonplaying state. Component18/18 pass after the empty-phase-removal mutant is detected and the exact original source restored. Original fixture failure remains retained, not product Red.

## DEF-US4-226 — Component fixture copies Playwright's exact role option into Testing Library

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 empty-playlist fixture type check.

E4-boundary-typecheck.log fails TS2769 at runnerGeneratedPresentation.client.test.tsx:16: Testing Library ByRoleOptions does not accept Playwright's exact option. The literal name already uses Testing Library's exact matching default. Remove only the unsupported option, retaining the named-image and exact source-URL assertions; rerun the complete component owner and type check. This is a test typing failure, not product Red. No production edit or type cast.

DEF226 verification: E4-empty-playlist-inner-types-green.log passes18/18; E4-boundary-typecheck-green.log passes the full TypeScript check. The role query still names the exact background image and asserts its saved URL. The prior controlled mutation result remains valid because the correction changes no behavioral assertion.

## DEF-US3-227 — Active schedule fixture overlaps its own retained Sunday recurrence

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 broad app qualification, test/server/runner/schedules.test.ts through runner-schedule-contract-probe.ts.

Command: node /tmp/clipify-E4-app-coverage.mjs (67 complete owners,39 sources, required thresholds separate). The existing contract fixture builds a dynamic active interval around Date.now on the same Runner as its earlier weekly Sunday02:30–03:30 Europe/Berlin event. On2026-10-18 between00:30 and01:30UTC that weekly occurrence is active, so its timezone edit is locked; the subsequent dynamic interval overlaps it and correctly returns INVALID_INPUT.16 cases then fail at fixture setup rather than their assertions;48 repeated log occurrences are not48 distinct failing tests. Preserve E4-app-complete-coverage.log/results; this is not intended product Red. Isolate active/ended lock fixtures on their own Runner/session/destination, retain every original assertion, and rerun their complete owner at the known failing Sunday clock. App/native product behavior and overlap policy must remain unchanged. The independently running110-case browser checkpoint is interrupted before modifying shared support and retained as incomplete; restart with fresh consistent inputs after the fixture repair. No threshold, retry, skip or exception is introduced.

DEF227 clock-reproduction refinement: the repaired normal owner passes106/106. The first Sunday-clock whole-owner attempt passes102 but4 paid-expiry checks fail because its fixture sets expiry using PostgreSQL host now() while the controlled JavaScript clock is earlier. Preserve E4-schedule-fixture-sunday-green.log as rejected fixture evidence, not a paid-expiry product regression. Use the same JavaScript fixture clock for the explicitly expired billing row, retaining its exact expired-policy/edit/snapshot assertions. Historical editable weekly tests also receive their intended fixed pre-occurrence authoring clock; live lock/drain cases remain on a dedicated Runner, and resize supplies its matching end date across midnight. No production change or assertion reduction.

DEF227 verification: all106 whole schedule cases pass normally in E4-schedule-fixture-owner-green.log and again at the formerly colliding Sunday01:15UTC in E4-schedule-fixture-sunday-v2-green.log. Active move/resize/configuration/delete and drain/closure refusal assertions are retained, including valid resize end dates across midnight. Historical draft edits use a fixed pre-occurrence clock and the expired billing row uses the same test clock. The first67-owner attempt is retained as rejected (66 files/1308 cases passing,16 fixture failures); its coverage is diagnostic only. Interrupted browser evidence has20 passes,90 unexecuted/interrupted,0 failures; no completed qualification claimed. No production or threshold change.

## DEF-US4-228 — First E4 coverage diagnostic leaves new standby paths below required floors

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 affected-source coverage gate.

E4-app-first-coverage-diagnostic.log / E4-app-only-coverage-diagnostic.json report uncovered asset GET authorization/delivery, optional appearance parsing, next-start selection and editor controls. The first source collection also contains DEF227 fixture failures and therefore cannot qualify a release; unchanged resource/workflow source gaps still require the current single owning workflow coverage lane. Keep all39 declared sources, critical S/F/L95 B90 and ordinary90/85 plus measured legacy floors. Add meaningful whole-owner access/state/error/normalization checks under the existing contracts, exercise deliberate faults, then collect current successful affected coverage. Do not drop sources, lower floors, duplicate native workflow ownership or count failed-source coverage as qualifying evidence.

## DEF-US4-229 — WebSocket lazy-module fixture uses forbidden require-style imports

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: E4 full ESLint gate, test/support/runner-next-ws-lazy-probe.cjs.

E4-current-eslint.log reports6 no-require-imports errors and6 retained baseline warnings. Replace the fixture's six synchronous imports with standard dynamic imports inside its existing async entry, retaining the exact installed next-ws/server CJS export target and real Next LazyModule, all scenarios and assertions. Do not disable lint rules or change production adapter behavior. Its only code reference is test/mcp/unit/next-ws-lazy-route.test.ts; no selected browser/native workflow imports or executes this child fixture. Re-run that whole3-case owner and full lint. Preserve existing110-case browser/434-case workflow reports with a reviewed unit-only input delta plus identical remaining source/build/fixture hashes; this is a dependency-scope correction, not a coverage or execution exception.

DEF229 verification: E4-nextws-fixture-import-green.log passes all3 real adapter/LazyModule cases; E4-current-eslint-green.log has0 errors and6 retained warnings. E4-retained-execution-input-review.json verifies the only change among3846 browser and817 workflow captured inputs is this unexecuted child unit fixture, whose sole consumer is the separately verified unit owner. All actual browser/workflow runtime, compiled build and selected fixture hashes remain identical. E4-browser-current-inventory.json retains all83 E3 cases among110 current passes across16 whole owners, with no retries/skips. No execution or coverage exception.

DEF228 verification: E4-final-app-complete-results.json passes1393/1393 cases across72 whole owners; E4-final-app-current-inventory.json retains all1267 E3 cases with only the previously reviewed runtime UUID label normalization. E4-final-app-workflow-coverage-gate.json passes all39 declared sources with critical S/F/L95 B90, ordinary90/85 and unchanged measured legacy-player floors. The single workflows owner passes434/434, retaining all433 E3 scenarios; no failed diagnostic report is merged as qualifying evidence. All11 strengthened-source checks meet floors, including branding-profile100% after reference/refusal/conflict/cleanup checks. Overall release qualification still requires remaining build/native/integrated gates.

## DEF-US1-230 — Native artifact fingerprint ignores current worktree changes

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: F1 packaging source identity, scripts/fingerprint-runner.mjs.

The old script enumerates tracked files and reads HEAD blobs, so modified, newly added and removed Runner execution modules can retain an obsolete artifact identity. F1-runner-fingerprint-red.log reproduces all3 defects with real disposable Git repositories; the unrelated/generated-output control passes. Enumerate tracked plus nonignored untracked files, omit removed paths and hash current file bytes. Keep base commit as provenance and public-key inputs unchanged. F1-runner-fingerprint-green.log passes4/4. Native verification-key packaging regression and full CI/platform qualification remain required; a local fingerprint fix is not a platform-matrix pass.

## DEF-US1-231 — Adding the native CI check can mask a failed coverage conjunction

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: F1 mandatory CI Test guard.

The new trailing native condition exposed Bash errexit behavior: a failed left operand in the prior coverage/browser AND list does not exit before the following condition. F1-ci-retained-coverage-refusal-red.log executes the actual YAML guard and detects the coverage failure escaping while9 other policy cases pass. Use separate required coverage and browser test commands before the native condition. F1-ci-retained-coverage-refusal-green.log passes10/10; F1-complete-script-policy-gates.log retains all68 script checks. No failed prerequisite may be masked by the native result.

## DEF-US4-232 — Default collection omits the newly required branding upload route

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: F1 full coverage inventory wiring.

F1-current-gate-owners-green.log has33 passing cases and1 unexpected failure: the existing whole-inventory test finds src/app/api/runner/branding-assets/route.ts in the new strict manifest but outside default collection. Add that exact route to Jest's existing collection, retain all thresholds and rerun the complete owner. F1-current-gate-owners-v2-green.log passes34/34 across the coverage and Runner fingerprint owners. Full six-lane execution is still required; the earlier failed log is retained and does not qualify coverage.

## DEF-US1-233 — Ordinary browser entry points can repeat native workflow evidence

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: F1 complete browser ownership.

The CI BDD shard helper filters native files, but ordinary BDD/ATDD project entries have no exclusion and the ATDD CI path also selects all files. F1-browser-native-owner-routing-red.log exercises actual configurations and proves both browser projects accept native workflow paths while the existing mocked inventory case passes. Exclude mcp-workflows in both ordinary projects; explicitly retain them in the native MCP configuration. F1-browser-native-owner-routing-v2-green.log passes the complete2-case owner. Actual Playwright collection proves907 browser BDD/ATDD cases with0 native files, and434/434 retained native workflow cases in F1-browser-native-collection-proof.json. This is collection proof, not a substitute for final execution. No scenario is skipped or discarded; ownership is corrected.

## DEF-US1-234 — Routing fixture forgets hidden generated-directory matching

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: F1 actual-configuration routing unit fixture.

The first restored routing owner still fails because its micromatch probe omits dot-directory matching for .features-gen, despite correct browser ignore configuration. Retain F1-browser-native-owner-routing-green.log as rejected fixture evidence. Match hidden generated directories explicitly in the fixture; do not weaken the expected exclusions. The complete2-case owner passes in F1-browser-native-owner-routing-v2-green.log, and actual Playwright collection independently confirms the intended907 browser/434 native split.

## DEF-US1-235 — Full database lane OAuth discovery probe exceeds its subprocess deadline

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: F1 full database-1 local execution, test/mcp/contract/oauth.test.ts.

F1-full-database-1.log records an unexpected15-second providerProbe spawnSync ETIMEDOUT for TDD-US1-001 issuer/resource metadata while multiple owning lanes and native media execute on the same host and disposable PostgreSQL service. This is not an intended product Red. Compare the owning CI job (separate PostgreSQL service/host), retain the complete failed attempt, inspect any other failures, and rerun the full owner/lane in isolation with unchanged assertions and timeouts. Contention or cold fixture setup is a hypothesis, not a proven root cause. Do not qualify the failed report or weaken coverage/source-inventory gates.

Verification: `tdd/evidence/F1-v2-full-database-1.log` completes all51 collected owners:50 pass/661 cases; the8 inherited environment-conditional onboarding cases are separately scheduled with disposable fixtures and do not include the OAuth owner. Complete `test/mcp/contract/oauth.test.ts` passes with unchanged assertions and15-second subprocess deadline. The v1 shared-host root cause remains unproven; its failed evidence remains excluded.

## DEF-US3-236 — Full native coverage cold restart observes active admission without encoded media

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: F1 full native coverage, test/bdd/runner-schedule-recovery.test.ts.

F1-full-native.log fails the real cold-process restart case for FR015/OPT045: cache restoration/output-start intent/active pipeline are observed, but encodedOutput, realCapture and realEncoder are false and suppressed is absent. The same complete physical owner passed in E4's38-case isolated physical run. Keep the real media/journal expectations, inspect the actual probe and reproduce the whole owning file and complete native coverage in the owning CI-equivalent isolation before classifying code versus fixture/environment behavior. Shared-host contention and bounded observation timing are hypotheses only. No test, timeout or production change is authorized merely to hide this failure; no failed-source coverage qualifies.

Verification: Frozen v2 complete native coverage passes all52 owners/450 tests plus the sole inherited TODO, including all6 restart-recovery cases and the owner-resume case, with unchanged native source/assertions/deadlines. Evidence: `tdd/evidence/F1-v2-full-native.log` and native `coverage/runner-feature/jest-results.json`. The prior shared-host timing cause remains unproven; failed v1 evidence is retained and never qualifies v2. Local complete lanes now execute sequentially, matching CI host isolation.

## DEF-US4-237 — Disabled MCP imports Runner credential encryption during privacy cleanup

Severity: Medium. Status: Verified. Owner: Feature implementer. Scope: F1 cross-feature production dependency initialization.

The complete database-2 lane fails both ready/legacy TDD-PRIVACY-006 cases. Owning CI deliberately supplies no ENCRYPTION_SECRET, and the probe deliberately sets production mode with MCP disabled. F1-disabled-cleanup-isolated-red.log reproduces both failures in isolation without coverage, proving a code regression rather than a missing test secret. New Runner admission/schedule/destination/lease imports eagerly initialize credential cryptography when only the disabled service response/privacy cleanup is needed. Keep the encryption module's production guard unchanged. Move the internal recovery signal into the existing lightweight error module while preserving its admission export; load credential cryptography only in the credential operations that use it. The first class-only attempt remains rejected because direct Runner resource imports still initialize schedules/destinations. Full scoped cleanup/admission/destination/transaction regression and a new complete frozen candidate are required before closure.

DEF237 scoped verification: F1-disabled-cleanup-crypto-regressions-green.log passes92/92 across5 complete cleanup/destination/admission/transaction files, without ENCRYPTION_SECRET, assertion edits or timeout changes. src/app/lib/encryption.ts retains its exact original SHA256; its production guard is unchanged. Dynamic crypto imports are limited to actual destination credential handling, Free lease capture and schedule cache issuance. The workflow recovery signal is lightweight and its original admission export remains compatible. Full new-candidate coverage, lease/schedule regressions and global gates remain required before final closure.

Final verification: complete frozen v2 database-2 passes477 tests including both privacy cleanup cases, all six app lanes and434 workflow cases pass, and F1-v2-merged-coverage.log passes unchanged global/per-path/MCP/player gates with39 declared feature sources. Native52 owners/450 tests and13-source unchanged coverage pass. The encryption guard remains byte-identical; no test secret, assertion change or timeout workaround was used for disabled-MCP cases.

## DEF-US3-238 — Two unquoted registry paths render the tests directory as emphasis

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: F1 physical-owner audit, TDD-US3-OPT047 and TDD-US4-OPT094 registry metadata.

F1-physical-owner-path-audit.json checks681 owning references and finds2 unparseable owners. Manual review shows Markdown formatting changed unquoted **tests** into **tests** in both owner and command fields. The actual completed test commands and physical files are unchanged. Restore the literal native paths and quote both entire owner/command cells as inline code, then format and rerun the path audit. No source or executable test changes.

Verification: F1-physical-owner-path-audit.json now checks683 physical owner references with no missing or unparseable paths, including both restored literal `__tests__` paths. Registry formatting completed; no executable source changed.

## DEF-US3-239 — Browser playlist-add expiry owner never reaches its lock wait

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: F1 full BDD browser shard1, existing `test/bdd/steps/mcp-playlist-add-expiry.steps.ts`, BDD-EXPIRY-005 token/grant/active examples.

Command `node scripts/run-browser-shard.mjs bdd-chromium 1/3` under the documented disposable browser environment completes272 passing cases and3 failing examples; each fails on `result.waited === true` receiving false, including both configured CI retries. This is an unexpected gate failure, not intended product Red. The same three cases pass in complete frozen-v2 Jest quiet coverage. Preserve the full failed raw report/HTML/JUnit and compare direct probe runtime/environment before deciding whether the fault is application behavior, fixture configuration or execution ownership. No assertion, deadline or coverage floor changes. Full shard evidence remains rejected; later shards are pending. Initial investigation replays the unchanged actual probe under browser versus isolated test environments.

Investigation: owning CI browser job explicitly sets MCP_COVERAGE_PROBE_DIRECTORY and runs buildMcpCoverageProbes without instrumentation. The initial local browser environment omitted both, so runMcpProbe used on-demand Node/tsx sources. Direct active-authority replay reproduces waited:false while providerCalls:1, credentialUsed:true and the correct mutation succeeds; full Jest bundled probes pass. Preparing the exact CI compiled probes and setting the missing variable makes the complete3-case browser owner pass with retries disabled (F1-v2-playlist-expiry-ci-parity-green.log/results.json), without source/assertion/deadline changes. Reclassify as Low local setup parity. Feature quickstart now contains the prerequisite. All browser projects are rerunning with the corrected execution inputs; failed initial reports are retained and excluded.

Complete verification: F1-v2-fresh-browser-bdd-chromium-1-3-results.json passes275/275 first-attempt cases with0 failures/retries/skips, including all3 playlist-add expiry examples. The exact current source remains frozen; only CI-equivalent compiled-probe and fresh-job database inputs differ from the rejected attempts. No source, assertion, deadline or coverage-policy edit.

## DEF-US5-240 — Existing account-deletion ATDD loses the dialog after clicking

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: corrected CI-parity full browser ATDD attempt, ATDD-US5-004 Example1 in `test/atdd/steps/auth-engine-rewrite.steps.ts`.

`node scripts/run-browser-shard.mjs atdd-chromium 1/1` reaches the paid-through deletion choice and times out180seconds in dialog.getByPlaceholder(username).fill. Snapshot shows the correct Settings username and enabled focused Schedule Account Deletion button, but no dialog. This owner passed in the preceding complete22-case attempt. The current retry is retained, not qualified. Investigate consent-triggered navigation/page readiness versus application state and fixture reuse; no diagnosis or deadline/assertion change is assumed. A separate browser diagnostic captures page errors and first/second-click outcomes against the local fixture server.

Verification: F1-v2-fresh-browser-atdd-chromium-1-1-results.json completes22/22 first-attempt cases with0 failures/retries/skips, including both deletion choices. Fixture metadata records a fresh disposable database and the wrapper closes/drops it after the owning job, matching CI job isolation. Earlier successful and failed/flaky attempts are retained, and the flaky attempt never qualifies. Exact missing-dialog cause remains unproven; no source, timeout, assertion or retry allowance was changed. Qualifying local browser jobs now require fresh per-job fixtures, not accumulated state from prior complete attempts.

## DEF-US5-241 — Supplemental auth fixture omits provider settings and account timestamp

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: local-only `/tmp/clipify-F1-auth-fixture.ts` supplemental execution of11 pre-existing environment-conditional auth tests.

First setup supplies AUTH_TEST_DATABASE_URL but omits fake Twitch settings and DATABASE_URL for the actual child auth adapter, so1/8 onboarding cases correctly rejects configuration. Supply both URLs pointing at the same owned disposable fixture and explicit fake auth credentials; all8 complete onboarding cases pass in F1-v2-auth-fixture-ci-parity.log. The subsequent provider fixture SQL omits account.updated_at, which has no database default; setup rejects before its3 tests run. Add required creation/update timestamps to that synthetic seed, rerun the complete remaining owner and retain every failed setup log. No application/test source, assertion, timeout or real credential change.

Verification: all8 onboarding and3 provider-credential cases pass without skips in the two qualified result files. F1-v2-complete-test-inventory-gate.json maps these11 exact case names back to the original conditional cases, with no duplicate or foreign evidence. Only disposable fixture inputs changed.

## DEF-US5-242 — Manual pricing screenshot helper evaluates during consent reload

Severity: Low. Status: Verified. Owner: Feature implementer. Scope: local-only `/tmp/clipify-F1-pricing-preview.ts` manual visual capture.

The public pricing preview helper clicks Reject optional and waits for network idle without first binding the resulting navigation; its later document-width evaluation sees an execution context destroyed by that reload. This does not fail a product test: complete913 browser-project cases already passed. Preserve the rejected empty preview metadata/log, bind and await the consent navigation explicitly, then recapture desktop/mobile and inspect them. No application/test-source, assertion, timeout or required gate edit.

Verification: final F1-v2-pricing-preview.json records both desktop1440/mobile390 views, visible Runner group and retained annual price, and document widths equal to viewport widths. Both final PNGs were visually inspected. Consent navigation is awaited explicitly. The final preview uses local Stripe price fixtures matching the existing2EUR/month and20EUR/year test catalog; no checkout action is taken. Earlier helper failures and absent-catalog states are excluded from visual qualification. F1-v2-fixture-cleanup.json confirms all owned browser databases and template identifiers are absent after cleanup. No application or executable test source changed.
