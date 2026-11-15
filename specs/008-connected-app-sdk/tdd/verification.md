---
feature: 008-connected-app-sdk
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 0de55083
working_tree: uncommitted feature implementation
behaviors: 6
proven: 0
likely: 5
test_after: 1
no_test: 0
high_smells: 0
criteria_total: 3
criteria_covered: 3
mutation_score: null
mutants_survived: 0
suite: existing execution-owner logs reviewed; no duplicate execution
---

# TDD verification: Connected application SDK

**Verdict: FAIL.** The implementation has meaningful passing security and runtime tests, but the disclosed initial Awards CLI test-after delivery prevents certification of strict test-first delivery. The final runtime report proves both actual separate Compose projects and database isolation.

This is a fresh-context read-only review by an agent that did not implement these tests. The resolver selected this feature with `SPECIFY_FEATURE_DIRECTORY=specs/008-connected-app-sdk`. No higher-priority rubric override was present. HEAD is the unchanged master base; feature code is uncommitted, so history cannot corroborate ordering. Raw Red/Green logs, current source/tests, and the current history were compared. No source, test, configuration, database, or runtime mutation was performed by this reviewer.

## Test-first evidence

| Behavior | Class      | Evidence                                                                                                                                                                                                                                                                                                                                            |
| -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1       | LIKELY     | `/tmp/awards-container-red1.log`, container cycle log and final successful two-project Docker report (`/tmp/awards-two-project-runtime.log`).                                                                                                                                                                                                       |
| U1       | LIKELY     | Five observed auth Red/Green cycles in `/tmp/awards-auth-cycle.log`; no committed implementation chronology yet.                                                                                                                                                                                                                                    |
| U2       | LIKELY     | `/tmp/awards-grants-red.log`, `awards-grants-red2.log`, `awards-admin-red1.log`, `awards-storage-red1.log`; corresponding successful whole-file logs. Exact expiry boundary initially failed behaviorally.                                                                                                                                          |
| U3       | LIKELY     | `/tmp/awards-gateway-red1.log` and `awards-review-red.log`; the latter has seven real failing authority/error assertions before the corrected Green.                                                                                                                                                                                                |
| U4       | LIKELY     | SDK initial module/config/error/private-host/typed-error behaviors have recorded Reds (`/tmp/awards-sdk-cycle.log`). Later safety-deadline refresh, unknown-code redaction, stalled-fetch and cancellation checks were explicitly characterization of existing paths; these additional tests do not prove their own historical test-first ordering. |
| U5       | TEST_AFTER | Initial 11 CLI tests and later packaging/CLI characterization tests were explicitly test-after (`/tmp/awards-sdk-cycle.log`; `examples/babbler-awards/test/cli.test.mjs:6`). Container and packaging runtime failures do not retroactively establish test-first CLI delivery.                                                                       |

The test list aggregates many independently asserted behaviors into six rows; these counts describe those rows, not individual test cases. Missing-module Reds are distinguished from actual assertion Reds; sandbox/prerequisite failures are excluded. A later single commit may corroborate recorded cycles, but cannot change the disclosed test-after checks. Re-running a test or manufacturing a retrospective Red cannot repair historical chronology.

## Findings

| #   | Severity          | Finding and required action                                                                                                                                                                                                                                                                                                         | Evidence                                                                                                              |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH, discipline  | Strict TDD chronology is not satisfied for the original U5 Awards CLI delivery. Preserve the disclosure, distinguish test-after characterization from actual Red/Green behaviors in the evidence registry, and obtain an explicit project decision about this delivery exception; do not mark this audit PASS by rewriting history. | `examples/babbler-awards/test/cli.test.mjs:6`; `/tmp/awards-sdk-cycle.log`                                            |
| 2   | MED, traceability | `contracts/milestone.feature` is documentary Gherkin; no generated/bound step execution is claimed or established. The actual owner is native assert-based Docker acceptance. Record exact scenario-to-script assertion mappings and label BDD/ATDD equivalent honestly.                                                            | `contracts/milestone.feature`; `test/support/connected-apps/security.ts`; `scripts/test-connected-app-containers.mjs` |
| 3   | MED, evidence     | At first read the cycle log contained only a baseline and all behavior rows remained TODO. The final registry now retains owner logs under tdd/evidence, distinguishes characterization, and reconciles passing local checks from pending CI and the open chronology exception.                                                     | `tdd/cycle-log.md`; `tdd/test-list.md`; `tasks.md`                                                                    |

No concrete authentication bypass or HIGH test-smell was found in the reviewed policy, token verification, grant checks, SDK response validation or real runtime assertions. No existing assertion weakening, new skip, or threshold reduction was found in the inspected diff. Gateway unit doubles are complemented by real Better Auth issuance/JWKS checks, PostgreSQL and shared search in the native container owner; they are not reported as tautological end-to-end proof. Fixed disposable fixture passwords are not live credentials.

## Execution evidence

Owner logs show auth/regression 124 tests in four files passing (2.369s), SDK 43 tests passing (0.677s), root grant/storage/gateway 30 passing (2.903s), subsequent storage/gateway 26 passing (2.430s), and six native OAuth/search/export/coverage-input regression files with 75 passing (149.975s). These overlapping runs must not be added into a unique test count.

The final durable Docker report records two actual Compose projects, actual TLS, signed machine tokens, no creator login, private databases, matching and empty searches, foreign creator denial, revocation denial, cross-database connection denial, and 18 security checks. Its measured runtime is approximately 21.8 seconds. The fixture uses real native handlers with a test-only server-only marker preload, not a built Next server; route wiring has separate unit checks.

Scoped coverage is corroboration only. The measured command failed unchanged unrelated gallery floors because those sources were not collected in that scope; it is neither a full gate pass nor evidence that feature code broke gallery coverage. Complete merged coverage, static/build and CI gates remain required before merge.

The final two-project runtime evidence (`/tmp/awards-two-project-runtime.log`, `test-results/connected-apps/report.json`) resolves the initial topology discrepancy. The parent also reports a final combined 276 tests across 14 suites, 13 native CLI/package checks and successful type checking; these reported counts are supplementary until their durable registry links are reconciled.

## Mutation results

No mutation tool is configured. The auth author's deliberate mutant removed the administrator-role check; the ordinary-creator test caught it (`/tmp/awards-auth-mutant.log`), and subsequent complete auth files passed (`/tmp/awards-auth-final.log`). This is one sampled policy boundary, not an independent or exhaustive mutation result. This reviewer did not repeat it or mutate source while the execution owner was active. Grant expiry, response-boundary authority, SDK and packaging mutation strength remain unmeasured independently; no numerical score is warranted.

## Traceability

| Criterion                       | Existing real entry point and supporting tests                                                                                                                                                                                                                                     | Result                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| US1 / FR-001,002 / EC-001,002   | Fixture provisions through real session-authenticated admin handler; security script denies anonymous/viewer/cross-origin requests; OAuth policy/config/admin tests cover own-identity and creator lifecycle.                                                                      | Covered for described native boundary.                                                 |
| US2 / FR-003..005 / EC-003..006 | Real Awards image invokes packaged SDK, installed OAuth token endpoint/JWKS and gateway/shared cached search; security script and grant/storage/gateway/SDK units add malformed/expiry/error cases. Existing native search regressions preserve pagination/completeness semantics. | Covered, with scoped mutation and chronology limitations above.                        |
| US3 / FR-006..008 / EC-007      | Shipped independent Compose and image exist; final runtime executes two actual Compose projects and proves no published DB ports, separate private networks, own database query and denied cross-DB access. Regression owner runs existing OAuth/search/export files.              | Covered by final two-project execution; full CI remains a separate pending merge gate. |

FR-007 operator-only credential output has a subprocess test that checks file contents, mode 0600 and absent secret output. Existing-show preservation is supported by isolated additive working-tree scope and disposable fixtures; no production/show database was inspected or touched. SC-004 is a merge gate, currently pending, not a passing acceptance claim. Package reproducibility and CLI tests support FR-005/006/007 even though the broad test-list rows do not name their individual test paths. No orphan feature tests were identified; exact executable scenario binding remains the finding above.

## What was not audited

- No full suite, merged coverage gate, build, live deployment or production/show data inspection was run by this reviewer; the designated execution owner and CI retain ownership.
- No independent mutation execution, exhaustive branch-by-branch proof, load/concurrency stress or external penetration test was performed.
- No browser UX assessment applies to this headless milestone. The native fixture does not establish built Next server middleware behavior.
- Git cannot yet establish implementation/test order because the reviewed implementation is uncommitted. Current evidence supports LIKELY where Reds exist, never PROVEN.
