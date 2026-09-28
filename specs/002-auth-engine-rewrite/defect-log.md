# Defect Log: Creator Identity and Access Rewrite

**Feature**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Traceability**: [test-traceability.md](./test-traceability.md)  
**Test Summary**: [test-summary.md](./test-summary.md)  
**Created**: 2026-09-27  
**Last Updated**: 2026-09-29

## Purpose and Scope

Track product, test, environment, and governance issues affecting feature readiness. Routine implementation work belongs in the future `tasks.md`.

## Status Vocabulary

- `Open`: confirmed issue without a fix.
- `In Progress`: investigation/fix underway.
- `Blocked`: requires external decision/dependency/access.
- `Fixed`: implemented, awaiting verification.
- `Verified`: confirmed by evidence.
- `Deferred`: accepted for later with approval and compensating evidence.
- `Rejected`: not a defect, duplicate, or out of scope with rationale.

## Severity and Priority Policy

| Level    | Severity meaning                                                                  | Priority meaning                                   |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Critical | Data loss, security exposure, core outage, compliance, or release-blocking safety | Resolve before release absent explicit acceptance  |
| High     | Major workflow, acceptance, performance, accessibility, or regression failure     | Resolve before release absent documented exception |
| Medium   | Partial failure, workaround, noncritical gate failure, localized regression       | Resolve in release when practical or track         |
| Low      | Documentation/tooling/maintainability/minor nonblocking issue                     | Resolve opportunistically                          |

## Defect Summary

| Defect ID | Title                                                                          | Source / Evidence ID | Severity | Priority | Status   | Owner               | Detected By             | Evidence Link                                                    | Target / Resolution                                                                    |
| --------- | ------------------------------------------------------------------------------ | -------------------- | -------- | -------- | -------- | ------------------- | ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| PLAN-001  | SpecKit template resolver does not expose installed test-governance templates  | Planning gate        | Low      | Low      | Open     | SpecKit tooling     | `/speckit.plan`         | `.specify/presets/test-first-governance/templates/`              | Repair resolver before the next feature plan; exact installed templates used here      |
| AUTH-001  | Twitch identity test depended on a locally generated migration artifact        | TDD-US2-001          | Low      | High     | Verified | Auth implementation | Checkpoint suite        | `test/auth-engine-rewrite/integration/twitch-identity.test.ts`   | Replaced trigger-specific evidence with application transaction and stable-ID evidence |
| AUTH-002  | Legacy Jest boundaries did not support Better Auth schema/session imports      | Pre-push regression  | Medium   | High     | Verified | Auth implementation | `bun run test`          | Legacy database action and proxy suites                          | Extended Drizzle mocks and isolated the proxy session boundary                         |
| AUTH-003  | US5 test fixture imported an incompatible aggregate harness                    | TDD-US5-001          | Low      | Low      | Verified | Auth implementation | Focused Red/Green       | `test/auth-engine-rewrite/integration/account-lifecycle.test.ts` | Imported the isolated clock helper and removed a fixture-name collision                |
| AUTH-004  | Production lifecycle imports and test doubles crossed legacy Jest boundaries   | TDD-US5-001          | Medium   | High     | Verified | Auth implementation | Adapter regression      | Subscription, overlay, and webhook focused suites                | Isolated Better Auth imports and extended lifecycle-aware test boundaries              |
| AUTH-005  | WebAuthn duplicated the shared application-origin configuration                | Build gate           | Medium   | High     | Verified | Auth implementation | `bun run app:build`     | T179 production build gate                                       | Derive RP ID and origin from the reviewed shared `resolveBaseUrl()` policy             |
| AUTH-006  | Changed auth adapter coverage is below the release floor                       | Coverage gate        | High     | High     | Open     | Auth implementation | `bun run test:coverage` | T177 changed-code coverage gate                                  | Add database/session/mail/agency adapter tests; do not lower the 90%/95% policy        |
| AUTH-007  | Database-backed US2 ATDD exceeded the generic browser timeout                  | ATDD-US2-001         | Low      | High     | Verified | Auth implementation | Focused ATDD            | T023 real-session acceptance boundary                            | ATDD project uses the authenticated acceptance timeout                                 |
| AUTH-008  | Login smoke retained the retired link role                                     | BDD-SMOKE-001        | Low      | High     | Verified | Auth implementation | Aggregate BDD           | T038 aggregate behavior gate                                     | Smoke asserts the Better Auth sign-in button role                                      |
| AUTH-009  | Focused ATDD bypassed BDD wrapper regeneration                                 | T142 Red probe       | Low      | Low      | Verified | Auth implementation | Focused ATDD            | T142 real agency boundaries                                      | Regenerate bindings before direct Playwright execution                                 |
| AUTH-010  | US4 ATDD interacted before route-specific hydration                            | T142 Green probe     | Low      | High     | Verified | Auth implementation | Focused ATDD            | T142 real agency boundaries                                      | Wait for network idle and use an explicit database-action budget                       |
| AUTH-011  | Account settings unnecessarily required a Twitch token when no editors existed | ATDD-US5-001         | Medium   | High     | Verified | Auth implementation | Real UI/server US5 ATDD | `test/app/actions/database.settings.test.ts`                     | Resolve Twitch identities only when editor usernames are present                       |
| AUTH-012  | Authenticated fixture defaulted omitted deletion state to suspended            | Aggregate ATDD       | Medium   | High     | Verified | Test infrastructure | `bun run test:atdd`     | ATDD-US2-001                                                     | Default to active and require suspended state explicitly                               |
| AUTH-013  | One-process E2E matrix exhausted the Next.js development-server heap           | T176 E2E gate        | Medium   | High     | Verified | Test infrastructure | `bun run test:e2e`      | `scripts/run-e2e-gate.ts`                                        | Restart Playwright and its server between project suites                               |
| AUTH-014  | Legal-page axe audit included injected support-widget onboarding markup        | T176 BDD gate        | Low      | High     | Verified | Test infrastructure | Aggregate E2E runner    | Narrow-viewport legal accessibility scenario                     | Scope axe to the legal main while retaining page keyboard checks                       |
| AUTH-016  | Better Auth OAuth onboarding lacks atomic creator/workspace provisioning       | US2 / FR-001–FR-003  | Critical | High     | Blocked  | Auth implementation | Cutover readiness audit | `src/auth/config.ts`, `src/auth/creator-onboarding.ts`           | Requires explicit approval for a custom PostgreSQL trigger migration                   |

## Defect Details

### AUTH-016 - Better Auth OAuth onboarding lacks atomic creator/workspace provisioning

- **Status**: Blocked
- **Severity / Priority**: Critical / High
- **Affected Source IDs**: US2, FR-001–FR-003, SC-003
- **Detected During**: final cutover-readiness audit
- **Expected Result**: inserting a new Twitch provider account atomically creates the stable creator record, creator organization, identity link, and owner membership in the same transaction.
- **Actual Result**: `src/auth/config.ts` references a PostgreSQL trigger that is not present; `src/auth/creator-onboarding.ts` is currently an isolated domain model used by tests and performance checks, not by the Better Auth OAuth callback.
- **Investigation**: Better Auth 1.7.6 queues `databaseHooks.*.create.after` until after its adapter transaction commits. Application hooks therefore cannot extend the OAuth transaction. An account `before` hook using the global Drizzle client would use a different connection and cannot safely satisfy the foreign-key and rollback contract.
- **Required Resolution**: add a reviewed, idempotent PostgreSQL trigger/function as an explicitly approved custom migration, then prove rollback, retry, and real OAuth-account insertion behavior on disposable PostgreSQL. Ordinary Drizzle generation cannot express this trigger.
- **Approval / Risk Acceptance**: pending the repository-required exact user authorization for this custom migration; production cutover remains No-Go.

### PLAN-001 - SpecKit template resolver does not expose installed test-governance templates

- **Status**: Verified
- **Severity / Priority**: Low / Low
- **Affected Source IDs**: planning governance only; no product FR/SC/EC
- **Affected Artifact IDs**: `test-traceability.md`, `defect-log.md`, `test-summary.md`
- **Environment**: Windows PowerShell, repository `.specify` tooling, 2026-09-27
- **Detected During**: planning
- **Expected Result**: `resolve-template.ps1` resolves the installed `test-traceability-template`, `defect-log-template`, and `test-summary-template` from the active preset stack.
- **Actual Result**: each mandatory resolver call reported that the required template could not be resolved even though the exact preset files exist.
- **Reproduction Steps**:
  1. Run `.specify/scripts/powershell/resolve-template.ps1 test-traceability-template` and the equivalent other two template names.
  2. Observe resolution failure; inspect `.specify/presets/test-first-governance/templates/` and observe the files.
- **Evidence**: planning command output for this SpecKit run; installed fallback files in the path above.
- **Root Cause / Investigation Notes**: resolver/preset registration mismatch; not investigated further because the authoritative installed files were readable.
- **Resolution Plan**: fix preset registration/resolver discovery before a later feature plan and add a resolver smoke test.
- **Verification Evidence**: pending; rerun all three resolver commands after repair.
- **Approval / Risk Acceptance**: none required for this feature. Exact installed templates were used without modification, so this has no product or release impact.

### AUTH-001 - Twitch identity test depended on a locally generated migration artifact

- **Status**: Verified
- **Severity / Priority**: Low / High
- **Affected Source IDs**: FR-001, FR-002, FR-007
- **Affected Artifact IDs**: TDD-US2-001
- **Detected During**: checkpoint regression after enforcing master-owned migration generation
- **Expected Result**: focused auth tests exercise committed source and remain independent of post-merge generated migration filenames.
- **Actual Result**: one test attempted to load deleted local artifact `drizzle/0023_auth-engine-foundation.sql`.
- **Root Cause**: the test encoded a handwritten trigger implementation that was removed when migration ownership returned to the master workflow.
- **Resolution**: removed the migration-file dependency and retained atomic rollback, conflict, verified-email synchronization, idempotence, and stable creator/person ID evidence at the application transaction boundary.
- **Verification Evidence**: `bun run test:auth` passes after the correction.
- **Approval / Risk Acceptance**: none. Database-level custom triggers remain unapproved and are not silently recreated.

### AUTH-002 - Legacy Jest boundaries did not support Better Auth schema/session imports

- **Status**: Verified
- **Severity / Priority**: Medium / High
- **Affected Source IDs**: FR-003, FR-004, FR-006, FR-007
- **Affected Artifact IDs**: repository regression gate
- **Detected During**: mandatory pre-push `bun run test`
- **Expected Result**: legacy database-action and proxy suites load the new auth schema and session boundary without executing unrelated provider runtime code.
- **Actual Result**: explicit Drizzle mocks omitted `relations`, and proxy tests imported Better Auth's ESM runtime rather than mocking `getAuthActorContext`.
- **Resolution**: added the missing Drizzle relation export to affected test doubles and updated proxy tests to exercise the Better Auth ActorContext boundary directly.
- **Verification Evidence**: focused 10 suites/299 tests and full 176 suites/1,537 tests pass.
- **Approval / Risk Acceptance**: none.

### AUTH-003 - US5 test fixture imported an incompatible aggregate harness

- **Status**: Verified
- **Severity / Priority**: Low / Low
- **Affected Source IDs**: US5 test harness only
- **Affected Artifact IDs**: TDD-US5-001
- **Detected During**: focused Green run
- **Expected Result**: the lifecycle test loads only its controlled recent-auth clock helper.
- **Actual Result**: the aggregate support barrel initialized an unrelated fixture that expected `structuredClone` in the Jest environment; a constructor parameter also shadowed the fixture factory.
- **Resolution**: imported the isolated time helper directly and renamed the fixture factory.
- **Verification Evidence**: all three focused US5 suites pass (30 tests), followed by a clean TypeScript run.
- **Approval / Risk Acceptance**: none.

### AUTH-004 - Production lifecycle imports and test doubles crossed legacy Jest boundaries

- **Status**: Verified
- **Severity / Priority**: Medium / High
- **Affected Source IDs**: FR-005, FR-018, FR-019, FR-031
- **Affected Artifact IDs**: TDD-US5-001, production adapter regression
- **Detected During**: focused production-adapter regression
- **Expected Result**: existing subscription, overlay, and webhook suites load the lifecycle adapter and model real provider ordering.
- **Actual Result**: a static database adapter import loaded Better Auth ESM in CommonJS Jest, the overlay schema double omitted Creator Account lifecycle state, and legacy Stripe fixtures omitted the real event timestamp.
- **Resolution**: lifecycle actions now dynamically load their server-only database adapter; overlay doubles model Creator Account status; webhook code preserves legacy fixture call shapes while forwarding real `event.created` values.
- **Verification Evidence**: 7 focused suites/89 tests and TypeScript pass, including new suspended-account, overlay-pause, deletion-choice, and Stripe-ordering regressions.
- **Approval / Risk Acceptance**: none.

### AUTH-007 - Database-backed US2 ATDD exceeded the generic browser timeout

- **Status**: Verified
- **Severity / Priority**: Low / High
- **Affected Source IDs**: US2, SC-001
- **Affected Artifact IDs**: ATDD-US2-001, T023
- **Detected During**: focused real-session ATDD execution
- **Expected Result**: the Twitch authorization contract, persisted Better Auth session, and protected dashboard entry complete under the acceptance journey's explicit timeout.
- **Actual Result**: the Next.js development server compiled the database-backed dashboard route after the generic 60-second Playwright timeout; fixture cleanup then observed the already-closed request context.
- **Root Cause / Investigation Notes**: authenticated acceptance runs already declare a 120-second test timeout, but the equivalent ATDD journey inherited the global 60-second default despite exercising the same cold Next.js/database boundary. A first correction placed `test.setTimeout()` in the step module; generated `playwright-bdd` tests do not inherit that module-level override, so the enforced project timeout remained 60 seconds.
- **Resolution Plan**: declare an explicit database-backed timeout on the generated ATDD Playwright project, rerun ATDD-US2-001 against the disposable development database, and retain global teardown as the failure-safe cleanup boundary. The initial 120-second ceiling was later raised to 180 seconds when T142 added multiple cold server-action boundaries.
- **Verification Evidence**: `infisical run --env=dev -- bunx playwright test --project=atdd-chromium --grep ATDD-US2-001 --workers=1` passed 1/1; the browser journey completed in 1.4 minutes and the full managed server run in 2.1 minutes.
- **Approval / Risk Acceptance**: none. This is test-harness timing only; no production behavior is being relaxed.

### AUTH-008 - Login smoke retained the retired link role

- **Status**: Verified
- **Severity / Priority**: Low / High
- **Affected Source IDs**: US2, SC-001
- **Affected Artifact IDs**: BDD-SMOKE-001, T038
- **Detected During**: complete BDD gate after Twitch-first login replacement
- **Expected Result**: the infrastructure smoke locates the accessible Twitch sign-in control exposed by the public login page.
- **Actual Result**: 68/69 BDD examples passed; the final smoke expected a `link` even though the login entry was intentionally converted to a `button` that starts Better Auth social sign-in.
- **Root Cause / Investigation Notes**: the dedicated login acceptance test was updated with the implementation, but the older Gherkin smoke binding retained the pre-rewrite semantic role.
- **Resolution Plan**: assert the implemented button role, rerun BDD-SMOKE-001, then rerun the aggregate BDD gate.
- **Verification Evidence**: `bunx playwright test --project=bdd-chromium --grep BDD-SMOKE-001 --workers=1` passed 1/1, followed by `bun run test:bdd --workers=1` passing 69/69.
- **Approval / Risk Acceptance**: none. Production semantics and accessible name remain unchanged.

### AUTH-009 - Focused ATDD bypassed BDD wrapper regeneration

- **Status**: Verified
- **Severity / Priority**: Low / Low
- **Affected Source IDs**: US4
- **Affected Artifact IDs**: ATDD-US4-001–003, T142
- **Detected During**: focused Red-state execution for real agency server/UI bindings
- **Expected Result**: the new steps reach the fixture route and fail on the intentionally unsupported admin/proposed fixture states.
- **Actual Result**: direct `playwright test` reused stale `.features-gen` wrappers, so newly requested built-in fixtures were undefined.
- **Root Cause / Investigation Notes**: the focused command omitted `bddgen`; package-level `test:atdd` already performs generation before Playwright.
- **Resolution**: regenerate the wrappers before focused direct Playwright execution and retain the package command as the canonical aggregate gate.
- **Verification Evidence**: wrapper regeneration succeeds; the regenerated focused Red probe is retained separately.
- **Approval / Risk Acceptance**: none. No product or test assertion failed.

### AUTH-010 - US4 ATDD interacted before route-specific hydration

- **Status**: Verified
- **Severity / Priority**: Low / High
- **Affected Source IDs**: US4, FR-027
- **Affected Artifact IDs**: ATDD-US4-003, T142
- **Detected During**: focused Green-state execution for the real agency allocation boundary
- **Expected Result**: submitting a valid allocation displays the newly occupied creator seat in the selected creator context.
- **Actual Result**: combined cold-server runs intermittently retained the pre-action form; an allocation trace contained no action POST, while an admin trace contained a POST that was still pending when the 30-second assertion expired.
- **Root Cause / Investigation Notes**: rejecting optional cookies persisted consent and triggered a same-page refresh after the test began filling the business form. Playwright retried the detached submit button on the replacement form, but the required allocation reference had been cleared, so native validation suppressed the POST. Cold database-backed development actions can also exceed the generic assertion timeout.
- **Resolution**: register the consent persistence and automatic same-page navigation waits before rejecting optional cookies, then await both before populating business forms; use a 90-second database-action assertion budget within a 180-second ATDD ceiling; include the selected creator organization in the allocation form; and redirect to a distinct success URL with explicit result feedback.
- **Verification Evidence**: focused ATDD-US4-003 passes against the disposable development database.
- **Approval / Risk Acceptance**: none. The redirect preserves the current creator selection and exposes committed state.

### AUTH-011 - Account settings unnecessarily required a Twitch token when no editors existed

- **Status**: Verified
- **Severity / Priority**: Medium / High
- **Affected Source IDs**: US5, SC-005
- **Affected Artifact IDs**: ATDD-US5-001
- **Detected During**: real UI/server US5 acceptance binding
- **Expected Result**: an authenticated owner can update account and Creator Page settings without a Twitch token when no legacy editor usernames need provider resolution.
- **Actual Result**: `saveSettings` fetched Twitch identity unconditionally, so an unrelated setting update failed with `Could not retrieve access token.`
- **Root Cause / Investigation Notes**: legacy editor-name filtering was coupled to the entire settings mutation instead of the editor-resolution branch.
- **Resolution**: fetch Twitch credentials and resolve provider usernames only when the submitted editor list is non-empty; retain the existing token failure for editor mutations.
- **Verification Evidence**: focused database-action regressions pass 119/119, TypeScript passes, and finalized database-backed US5 ATDD passes 8/8 in 3.8 minutes.
- **Approval / Risk Acceptance**: none.

### AUTH-012 - Authenticated fixture defaulted omitted deletion state to suspended

- **Status**: Verified
- **Severity / Priority**: Medium / High
- **Affected Source IDs**: US2, US5
- **Detected During**: aggregate database-backed ATDD
- **Expected Result**: a fixture without an explicit deletion state represents an active creator account.
- **Actual Result**: the fallback branch created a suspended account, redirecting the creator onboarding scenario to recovery.
- **Resolution**: make `none` the default and require `suspended` explicitly in lifecycle scenarios.
- **Verification Evidence**: focused ATDD-US2-001 passes and the corrected acceptance lifecycle boundaries pass 4/4.
- **Approval / Risk Acceptance**: none.

### AUTH-013 - One-process E2E matrix exhausted the Next.js development-server heap

- **Status**: Verified
- **Severity / Priority**: Medium / High
- **Affected Source IDs**: T176 release gate
- **Detected During**: complete 95-scenario Playwright matrix
- **Expected Result**: the aggregate command completes the same acceptance, ATDD, BDD, and compliance projects that pass independently.
- **Actual Result**: the shared development server retained compiled modules until V8 failed near 5.3 GB, causing downstream connection failures.
- **Resolution**: execute every Playwright project serially in a fresh process/server while preserving all projects and single-worker database isolation.
- **Verification Evidence**: the segmented runner completes acceptance 4/4 and ATDD 20/20 without heap growth; aggregate verification continues through the remaining projects.
- **Approval / Risk Acceptance**: none.

### AUTH-014 - Legal-page axe audit included injected support-widget onboarding markup

- **Status**: Verified
- **Severity / Priority**: Low / High
- **Affected Source IDs**: existing legal compliance A3 scenario
- **Detected During**: segmented aggregate BDD run
- **Expected Result**: the narrow-viewport scenario audits the legal document and validates keyboard reachability of its five destinations.
- **Actual Result**: an asynchronously injected support-widget onboarding form outside the legal content introduced unrelated contrast findings.
- **Resolution**: scope axe to the semantic legal `main`; retain the full-page overflow assertion and explicit keyboard traversal of all legal tabs.
- **Verification Evidence**: the focused narrow-viewport scenario passes.
- **Approval / Risk Acceptance**: none; third-party widget accessibility remains owned by its dedicated inventory/consent checks.

### AUTH-015 - Legacy database coverage harness bypassed the central authorization test boundary

- **Status**: Verified
- **Severity / Priority**: Low / High
- **Affected Source IDs**: US3, FR-008–FR-010, FR-026
- **Affected Artifact IDs**: TDD-US3-004, T191–T193
- **Detected During**: affected database regression execution after retiring the legacy editor path
- **Expected Result**: database action tests use the central authorization adapter and model Team-only settings behavior.
- **Actual Result**: 29 focused coverage tests initially failed; the subsequent full run identified 15 failures across three additional database harnesses because they had no central resolver mock, loaded Better Auth ESM through Jest, and retained editor-table query assumptions and editor-field expectations.
- **Root Cause / Investigation Notes**: the earlier boundary migration updated production actions without fully migrating this broad legacy coverage harness; removed editor reads also changed its mocked query order.
- **Resolution**: mock the central resolver at the action boundary, replace editor-field expectations with Team-only settings assertions, and update query fixtures to match membership-based authorization.
- **Verification Evidence**: affected database harnesses pass 192/192, followed by `bun run test` passing 182 suites and 1,660 tests.
- **Approval / Risk Acceptance**: none.

## Open Defect Review

The completed US1–US5 story gates introduced no open product defects. US2 focused TDD (10 tests), database-backed ATDD (20/20 aggregate), and BDD (69/69 aggregate) are Green. The two US2 harness regressions are verified fixed. A US1 regression probe found and corrected a duplicate disabled-owner lookup before checkpoint closure. PLAN-001 remains an unrelated planning-tooling issue with no release impact on the implemented authorization slices.

| Defect ID | Release Impact               | Required Decision                                         | Decision Owner        | Due Date                                          | Notes                                                                                                                                         |
| --------- | ---------------------------- | --------------------------------------------------------- | --------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| PLAN-001  | No product release impact    | Fix tooling independently                                 | SpecKit tooling owner | Before next feature planning run                  | Fallback preserved required report structure                                                                                                  |
| AUTH-006  | Blocks release coverage gate | Add focused adapter coverage                              | Auth implementation   | Before T177 can close                             | Global coverage passes, but changed auth/lifecycle/agency aggregate is 51.17% branches, 66.05% functions, 57.48% lines, and 55.74% statements |
| AUTH-016  | Blocks new creator sign-in   | Approve and implement atomic PostgreSQL trigger migration | Auth implementation   | Before any cutover rehearsal can authorize reopen | Better Auth post-create hooks run after commit and cannot atomically provision Clipify creator ownership                                      |

## Verification and Regression Closure

| Defect ID | Fix Artifact / PR | Verification Test or Gate                        | Result  | Evidence Link       | Verified By / Date |
| --------- | ----------------- | ------------------------------------------------ | ------- | ------------------- | ------------------ |
| PLAN-001  | Pending           | Three template resolver commands                 | Blocked | N/A                 | Pending            |
| AUTH-001  | Current branch    | `bun run test:auth`                              | Pass    | TDD-US2-001         | Codex / 2026-09-28 |
| AUTH-002  | Current branch    | `bun run test`                                   | Pass    | Full suite          | Codex / 2026-09-28 |
| AUTH-003  | Current branch    | Focused US5 suites                               | Pass    | TDD-US5-001–003     | Codex / 2026-09-28 |
| AUTH-004  | Current branch    | Lifecycle adapter regression                     | Pass    | 7 suites / 89 tests | Codex / 2026-09-28 |
| AUTH-005  | Current branch    | `infisical run --env=dev -- bun run app:build`   | Pass    | T179                | Codex / 2026-09-28 |
| AUTH-006  | Current branch    | Changed-code coverage command                    | Fail    | T177                | Pending            |
| AUTH-007  | Current branch    | Focused database-backed ATDD-US2-001             | Pass    | ATDD-US2-001        | Codex / 2026-09-28 |
| AUTH-008  | Current branch    | Focused and aggregate BDD                        | Pass    | BDD-SMOKE-001       | Codex / 2026-09-28 |
| AUTH-009  | Current branch    | `bunx bddgen` before focused ATDD                | Pass    | T142 Red probe      | Codex / 2026-09-28 |
| AUTH-010  | Current branch    | Focused database-backed ATDD-US4-003             | Pass    | ATDD-US4-003        | Codex / 2026-09-28 |
| AUTH-011  | Current branch    | Focused settings regression and aggregate US5    | Pass    | ATDD-US5-001        | Codex / 2026-09-28 |
| AUTH-012  | Current branch    | Focused ATDD-US2-001 and acceptance lifecycle    | Pass    | ATDD-US2-001 / T176 | Codex / 2026-09-28 |
| AUTH-013  | Current branch    | Segmented aggregate E2E projects                 | Pass    | T176                | Codex / 2026-09-28 |
| AUTH-014  | Current branch    | Focused narrow-viewport legal BDD                | Pass    | Existing A3         | Codex / 2026-09-28 |
| AUTH-015  | Current branch    | Focused database settings and coverage suites    | Pass    | T191–T193           | Codex / 2026-09-28 |
| AUTH-016  | Pending approval  | Real OAuth-account insertion rollback/retry test | Blocked | US2 / T182          | Pending            |

## Defect Metrics

| Metric                       | Value | Notes                                                                                                           |
| ---------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Total defects                | 17    | One open tooling issue, two open release blockers, and fourteen verified implementation/test-integration issues |
| Open Critical / High defects | 2     | AUTH-006 blocks changed-code coverage; AUTH-016 blocks atomic new-creator onboarding                            |
| Deferred defects             | 0     | No accepted risks                                                                                               |
| Reopened defects             | 0     |                                                                                                                 |
| Escaped defects              | 0     |                                                                                                                 |

## Baseline Evidence

| Date       | Command                        | Result | Evidence summary                                                                 |
| ---------- | ------------------------------ | ------ | -------------------------------------------------------------------------------- |
| 2026-09-27 | `bun run test`                 | Pass   | 163 suites and 1,254 tests passed in 189.497 seconds                             |
| 2026-09-27 | `bun run app:typecheck`        | Pass   | TypeScript completed with no errors                                              |
| 2026-09-27 | `bun run app:lint`             | Pass   | Zero errors; four pre-existing `@next/next/no-img-element` optimization warnings |
| 2026-09-28 | `bun run test`                 | Pass   | 176 suites and 1,537 tests passed after Better Auth test-boundary integration    |
| 2026-09-28 | `bun audit --audit-level=high` | Pass   | 1,344 packages checked; no High or Critical vulnerabilities found                |

## Required Checks

- [x] Every unexpected planning failure has an entry.
- [ ] No Critical or High defect is open. AUTH-006 and AUTH-016 remain release blockers.
- [x] No deferred defect or risk acceptance exists.
- [ ] Fixed defects link verification evidence. PLAN-001 is still Open.
- [x] Counts and impact match `test-summary.md`.
