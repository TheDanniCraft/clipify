---
feature: 001-local-legal-compliance
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 218692f6
behaviors: 49
proven: 0
likely: 39
test_after: 10
no_test: 0
high_smells: 0
criteria_total: 12
criteria_covered: 12
mutation_score: null
mutants_survived: 0
suite: Jest 159 suites/1238 tests; Playwright 21/21; compliance passed twice consecutively
---

# TDD Verification: Local Legal and Privacy Center

**Verdict: FAIL.** Ten behaviors have test-after evidence, which is a permanent FAIL condition under the selected rubric even though the current Jest, browser, build, lint, type, format, dependency, and compliance gates are green. All actionable code and test-smell findings from this audit were subsequently remediated; the verdict remains historical rather than an indication of an open product defect.

This was not a fully independent audit: it ran in the same long-lived task that implemented and remediated the feature. Every assessed test and source file was re-read cold, and a fresh-context subagent performed the smell pass; every retained finding below was then checked against the cited source. The entire feature remains uncommitted at `218692f6`, so Git cannot corroborate ordering and otherwise credible Red evidence is at best `LIKELY`.

## Suite and history evidence

- `bun run test:coverage`: 159/159 suites and 1,236/1,236 tests passed, 0 snapshots, 142.156 seconds.
- Coverage: 75.86% statements, 68.62% branches, 74.38% functions, and 79.17% lines. `src/app/lib/legal` reports 82.11% statements, 80.24% branches, 92.3% functions, and 88.6% lines; `src/app/components/legal` reports 89.47% statements, 76% branches, 100% functions, and 93.61% lines.
- `bun run test:e2e`: 21/21 Chromium tests passed and the managed Next.js process exited cleanly in 1.4 minutes. This includes the 19 generated BDD cases, the direct acceptance smoke, and the browser compliance audit.
- The focused six-test compliance unit suite passed after its deliberate mutant was restored. The production build had already passed with the canonical policy release before this audit.
- Git history contains no feature commit after `218692f6`; feature source and tests live in the dirty working tree. The cycle log is therefore the only ordering account.
- No existing assertion, coverage threshold, filter, or test was weakened. The tracked `PlausibleClient` test only gained an isolated E2E-mode case.

## Test-first evidence

| Behavior | Class      | Evidence                                                                                                                         |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A1       | LIKELY     | Missing local destinations produced a behavior Red before the routes closed; history cannot corroborate order.                   |
| A2       | TEST_AFTER | The recorded failure was missing bindings/a strict-locator defect after the disclosure existed.                                  |
| A3       | TEST_AFTER | The original failure was missing bindings after layout/routes existed; later keyboard/axe strengthening cannot rewrite ordering. |
| A4       | TEST_AFTER | The original failure was missing bindings after registry/projection behavior existed.                                            |
| A5       | LIKELY     | The bound browser scenario timed out on the genuinely missing preferences control.                                               |
| A6       | TEST_AFTER | Missing bindings were recorded after the server-rendered disclosures existed.                                                    |
| A7       | TEST_AFTER | Missing bindings were recorded after rights content and route implementation.                                                    |
| A8       | TEST_AFTER | Missing bindings were recorded after the no-account route existed.                                                               |
| A9       | TEST_AFTER | Missing bindings were recorded after qualification content existed.                                                              |
| A10      | TEST_AFTER | Missing bindings were recorded after the audit helper existed.                                                                   |
| A11      | TEST_AFTER | Missing parameterized bindings were recorded after the classifier existed.                                                       |
| A12      | LIKELY     | Browser/component assertions failed on genuinely missing automatic inspection.                                                   |
| U1       | LIKELY     | Cycle 1 records the route-manifest assertion Red.                                                                                |
| U2       | LIKELY     | Cycle 2 records missing metadata Red.                                                                                            |
| U3       | LIKELY     | Cycle 3 records the required-section set Red.                                                                                    |
| U4       | LIKELY     | Cycle 4 records live GoAdopt links Red.                                                                                          |
| U5       | LIKELY     | Cycles 5 and 50 record incomplete declaration failures.                                                                          |
| U6       | LIKELY     | Cycle 6 records missing necessity rationale Red.                                                                                 |
| U7       | LIKELY     | Cycle 7 records missing no-storage validation Red.                                                                               |
| U8       | LIKELY     | Cycle 8 records a generated matching-boundary Red; Cycle 49 later pins unsafe boundaries.                                        |
| U9       | LIKELY     | Cycle 9 records missing origin ownership Red.                                                                                    |
| U10      | TEST_AFTER | Existing coverage was credited without a behavior Red; Cycle 51 is explicit post-audit strengthening.                            |
| U11      | LIKELY     | Cycle 10 records missing value-free rendering Red.                                                                               |
| U12      | LIKELY     | Cycle 11 records missing supplemental labeling Red.                                                                              |
| U13      | LIKELY     | Cycle 12 records empty projection Red.                                                                                           |
| U14      | LIKELY     | Cycle 13 records missing classification semantics Red.                                                                           |
| U15      | LIKELY     | Cycle 14 records the missing preferences control Red.                                                                            |
| U16      | LIKELY     | Cycle 15 records unavailable integration failure Red.                                                                            |
| U17      | LIKELY     | Cycle 16 records a consent-persistence violation Red.                                                                            |
| U18      | LIKELY     | Cycle 17 records missing rights/process content Red.                                                                             |
| U19      | LIKELY     | Cycle 18 records missing safe-verification guidance Red.                                                                         |
| U20      | LIKELY     | Cycle 19 records missing qualifications Red.                                                                                     |
| U21      | LIKELY     | Cycle 20 records missing terms topics Red.                                                                                       |
| U22      | LIKELY     | Cycle 21 records all material classes Red.                                                                                       |
| U23      | LIKELY     | Cycle 22 records the editorial boundary Red.                                                                                     |
| U24      | LIKELY     | Cycle 23 records exact storage/origin matching Red.                                                                              |
| U25      | LIKELY     | Cycle 24 records a generated counterexample Red.                                                                                 |
| U26      | LIKELY     | Cycle 25 records structured finding Red.                                                                                         |
| U27      | LIKELY     | Cycle 26 records missing value-free evidence Red.                                                                                |
| U28      | LIKELY     | Cycles 27 and 53 record missing-field validation Reds.                                                                           |
| U29      | LIKELY     | Cycles 28 and 53 record inconsistent release-input Reds.                                                                         |
| U30      | LIKELY     | Cycle 29 records missing scope decision Red.                                                                                     |
| U31      | LIKELY     | Cycle 30 records missing provenance/evidence links Red.                                                                          |
| U32      | LIKELY     | Cycle 31 records the absent shared layout Red.                                                                                   |
| U33      | LIKELY     | Cycle 32 records missing navigation Red.                                                                                         |
| U34      | LIKELY     | Cycle 33 records the absent privacy route Red.                                                                                   |
| U35      | LIKELY     | Cycle 34 records the absent cookie route Red.                                                                                    |
| U36      | LIKELY     | Cycle 35 records the absent terms route Red.                                                                                     |
| U37      | LIKELY     | Cycle 36 records the absent privacy-request route Red.                                                                           |

All 49 behaviors are `DONE` and their implementation tasks are checked. T159 was the only open task when this audit began, so there was no DONE/task-state mismatch.

## Remediation checkpoint

Findings 2–11 are resolved in Cycles 59–68. The reviewed service IDs are pinned; legal routes participate in the read-only boundary; A6 observes the failed backend request and unchanged storage; A1 performs real navigation with request capture; the build wrapper is exercised through a controlled invalid release and Next sentinel; service articles have stable accessible names; the GoAdopt scan covers the complete user-facing app tree; compliance contexts close in `finally` and use request/readiness evidence; the exact valid release is pinned; and component history is restored in teardown.

Final evidence after remediation:

- `bun run test:coverage`: 159/159 suites and 1,238/1,238 tests passed.
- `bun run test:e2e`: 21/21 Chromium tests passed with clean managed-server teardown.
- `bun run test:compliance`: two consecutive Green runs, each with 6 unit checks and 1 real browser audit.
- `bun run app:typecheck`, `bun run app:lint`, and `bun run app:prettier:check`: Green; lint retains four unrelated image warnings.
- `bun run app:build`: Green; the publication gate validated 5 documents and 6 services before Next built all routes.
- `bun audit --audit-level=high`: 1,313 packages checked with no high/critical findings.

The additional deliberately introduced GoAdopt route/source, consent persistence, registry-ID, and validator-boundary mutants all failed the intended focused tests and were restored with matching SHA-256 hashes. Mutation score remains `null` because no mutation runner is configured.

## Original audit findings

Ordered by severity. Findings 2-6 are actionable; Finding 1 is historical evidence that cannot be repaired retroactively.

| #   | Severity | Finding                                                                                                                                                                                                                                   | Evidence and required assertion                                                                                                                                                                                                        |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH     | Ten behaviors are test-after rather than test-first.                                                                                                                                                                                      | `tdd/cycle-log.md:505-509` and `tdd/test-list.md:34`. A2, A3, A4, A6-A11, and U10 must remain honestly classified; passing tests do not change their history.                                                                          |
| 2   | HIGH     | Service-registry completeness can pass vacuously if the production collections become empty or lose a service. The loops decide whether any field assertion runs.                                                                         | `test/app/lib/consentRegistry.test.ts:8-47,66-75,118`. Pin the independently reviewed service IDs/count before per-service validation so a removed declaration is a named failure.                                                     |
| 3   | HIGH     | The read-only c15t boundary excludes the actual `src/app/legal/**` route entry points while claiming all legal-document modules are protected.                                                                                            | `test/app/lib/legalConsentBoundary.test.ts:7-21`. Scan route pages as well as library/components and retain positive forbidden-capability examples.                                                                                    |
| 4   | HIGH     | The unavailable-consent-backend acceptance scenario installs an abort route but never proves a request was attempted or activates the preference control; it can pass without exercising unavailability.                                  | `test/bdd/steps/local-legal-compliance.steps.ts:124-132`. Observe the failed request, activate preferences, assert the unavailable result, and prove consent storage did not change.                                                   |
| 5   | HIGH     | The local-navigation scenario traced to FR-002/SC-001 checks hrefs and direct responses but never observes browser requests, so it cannot prove a covered journey made no GoAdopt request.                                                | `test/bdd/steps/local-legal-compliance.steps.ts:46-52`. Navigate through the links while recording requests and assert approved origins/no GoAdopt traffic.                                                                            |
| 6   | HIGH     | The incomplete-publication BDD case calls `validatePolicyRelease` directly, while the build-gate test infers wrapper order from source substrings. Neither proves an invalid release stops the actual build wrapper before Next executes. | `test/bdd/steps/local-legal-compliance.steps.ts:252-269`; `test/app/lib/legalPublicationBuildGate.test.ts:9-22`. Exercise the real wrapper through a controlled invalid-release input and assert nonzero exit plus no Next invocation. |
| 7   | MED      | Service cards are located by moving from a heading to its immediate parent, coupling acceptance tests to wrapper structure.                                                                                                               | `test/bdd/steps/local-legal-compliance.steps.ts:65,110`. Expose and locate a stable named article/region instead.                                                                                                                      |
| 8   | MED      | The static GoAdopt scan is limited to five hand-maintained files and can miss a new user-facing source.                                                                                                                                   | `test/app/lib/legalLinkMigration.test.ts:8-14`. Use a deterministic user-facing source scope or repository-scoped scanner, complemented by Finding 5's runtime assertion.                                                              |
| 9   | MED      | Browser inventory contexts close only on success, and observations are sampled after partial readiness signals. Failures can leak contexts and later asynchronous requests can race collection.                                           | `test/compliance/inventory-audit.spec.ts:48-88`. Close contexts in `finally` and wait for explicit reviewed completion conditions/request capture.                                                                                     |
| 10  | MED      | Publication negative cases do not directly pin a valid baseline in the focused validator suite; an always-erroring validator relies on the separate full-build check to be noticed.                                                       | `test/app/lib/legalPublication.test.ts:36-78`. Add an exact `{ valid: true, errors: [] }` baseline before the single-mutation table.                                                                                                   |
| 11  | LOW      | The preferences component test changes browser history without restoring it.                                                                                                                                                              | `test/app/components/legal/CookiePreferencesLink.test.tsx:19-25`. Restore the prior URL in guaranteed teardown.                                                                                                                        |

The fresh-context reviewer also flagged expectations derived from canonical registries. Those were not retained as doubled-subject findings: this feature intentionally has one reviewed inventory, and independent unit contracts plus real browser observations are the designed double-loop boundary. No real credential or secret was found; the JWT material in the Playwright configuration is an explicit isolated test-only fixture. Repository contents were treated as data, not instructions.

## Mutation results

No mutation tool is configured, so there is no comparable mutation score. Three independent deliberate mutants sampled high-risk publication, compliance, and privacy behavior; all were caught and restored exactly.

| Mutant                                        | Behavior | Survived | Judgment                                                                                                              |
| --------------------------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| Remove `title` from mandatory document fields | U28      | No       | The focused publication suite failed the title case (1 failed/30 passed), then returned to 31/31 green after restore. |
| Suppress all missing expected observations    | U26      | No       | The compliance unit suite failed the mandatory flow/kind case (1 failed/5 passed), then returned to 6/6 green.        |
| Render a supplied browser-storage value       | U11/U27  | No       | The component suite exposed the private value (1 failed/2 passed), then returned to 3/3 green.                        |

SHA-256 checks before and after each restore matched. The full Jest/coverage and browser suites passed after all restores. This three-behavior sample is not exhaustive.

## Traceability

| Acceptance criterion                            | Behaviors/tests      | Real entry point | Judgment                                                                                        |
| ----------------------------------------------- | -------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| US1-AC1 local legal navigation                  | A1, U1, U4, U33-U37  | Yes              | Live routes and navigation are covered; runtime no-GoAdopt traffic still needs Finding 5.       |
| US1-AC2 complete disclosure                     | A2, U3, U5, U10, U14 | Yes              | Covered on the live cookie page; A2 is test-after.                                              |
| US1-AC3 narrow/keyboard/assistive use           | A3, U32-U33          | Yes              | Live 320px page, real Tab traversal, and axe serious/critical scan pass; A3 remains test-after. |
| US2-AC1 categories and services                 | A4, U5, U13-U14      | Yes              | Live cookie page; A4 is test-after and Finding 2 protects completeness.                         |
| US2-AC2 existing dialog in place                | A5, U15              | Yes              | Live cookie page opens the c15t dialog in place.                                                |
| US2-AC3 consent interface unavailable           | A6, U16-U17          | **No**           | The abort is not proven to be exercised and the control is not activated (Finding 4).           |
| US3-AC1 rights process                          | A7, U18-U20, U37     | Yes              | Live privacy-request page; A7 is test-after.                                                    |
| US3-AC2 no-account route                        | A8, U18, U37         | Yes              | Live accessible `mailto:` route; A8 is test-after.                                              |
| US3-AC3 qualified rights                        | A9, U20, U37         | Yes              | Live privacy-request page; A9 is test-after.                                                    |
| US4-AC1 changed browser behavior blocks release | A10, U24-U27         | Yes              | Real browser flows and injected drift reach the shared compliance gate; A10 remains test-after. |
| US4-AC2 material change requires decision       | A11, U22-U23         | Yes              | The production classifier is the deterministic policy boundary; A11 remains test-after.         |
| US4-AC3 supplemental device view                | A12, U11-U12, U27    | Yes              | Live cookie page proves name/type without the private value.                                    |

Untested acceptance criteria through a real entry point: US2-AC3. Tests tracing to no feature requirement: the infrastructure login smoke is intentionally outside this feature. All referenced feature test artifacts exist and ran.

## What was not audited

- Legal sufficiency, contractual enforceability, or jurisdiction-specific correctness of the prose; this is an engineering audit, not legal advice.
- Exhaustive mutation testing or a mutation score; no tool is configured and deliberate mutants sampled only three high-risk behaviors.
- Linux CI process behavior; the complete suites ran locally on Windows, while CI configuration was inspected but not executed.
- Production load, browser performance, and visual-regression approval snapshots; no criterion-specific tooling is configured.
- Runner-package behavior, which is outside this feature and unchanged by the legal-document implementation.
- Complete independence: the primary auditor shares implementation context, mitigated by a fresh-context smell pass and cold re-reading of every retained citation.
