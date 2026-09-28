# Defect Log: Creator Identity and Access Rewrite

**Feature**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Traceability**: [test-traceability.md](./test-traceability.md)  
**Test Summary**: [test-summary.md](./test-summary.md)  
**Created**: 2026-09-27  
**Last Updated**: 2026-09-28

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

| Defect ID | Title                                                                         | Source / Evidence ID | Severity | Priority | Status   | Owner               | Detected By       | Evidence Link                                                    | Target / Resolution                                                                    |
| --------- | ----------------------------------------------------------------------------- | -------------------- | -------- | -------- | -------- | ------------------- | ----------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| PLAN-001  | SpecKit template resolver does not expose installed test-governance templates | Planning gate        | Low      | Low      | Open     | SpecKit tooling     | `/speckit.plan`   | `.specify/presets/test-first-governance/templates/`              | Repair resolver before the next feature plan; exact installed templates used here      |
| AUTH-001  | Twitch identity test depended on a locally generated migration artifact       | TDD-US2-001          | Low      | High     | Verified | Auth implementation | Checkpoint suite  | `test/auth-engine-rewrite/integration/twitch-identity.test.ts`   | Replaced trigger-specific evidence with application transaction and stable-ID evidence |
| AUTH-002  | Legacy Jest boundaries did not support Better Auth schema/session imports     | Pre-push regression  | Medium   | High     | Verified | Auth implementation | `bun run test`    | Legacy database action and proxy suites                          | Extended Drizzle mocks and isolated the proxy session boundary                         |
| AUTH-003  | US5 test fixture imported an incompatible aggregate harness                   | TDD-US5-001          | Low      | Low      | Verified | Auth implementation | Focused Red/Green | `test/auth-engine-rewrite/integration/account-lifecycle.test.ts` | Imported the isolated clock helper and removed a fixture-name collision                |

## Defect Details

### PLAN-001 - SpecKit template resolver does not expose installed test-governance templates

- **Status**: Open
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
- **Verification Evidence**: all three focused US5 suites pass (29 tests), followed by a clean TypeScript run.
- **Approval / Risk Acceptance**: none.

## Open Defect Review

The completed US1 and US3 gates introduced no product defects. A US1 regression probe found and corrected a duplicate disabled-owner lookup before checkpoint closure; the 167-fixture parity rerun is Green. PLAN-001 remains an unrelated planning-tooling issue with no release impact on the implemented authorization slices.

| Defect ID | Release Impact            | Required Decision         | Decision Owner        | Due Date                         | Notes                                        |
| --------- | ------------------------- | ------------------------- | --------------------- | -------------------------------- | -------------------------------------------- |
| PLAN-001  | No product release impact | Fix tooling independently | SpecKit tooling owner | Before next feature planning run | Fallback preserved required report structure |

## Verification and Regression Closure

| Defect ID | Fix Artifact / PR | Verification Test or Gate        | Result  | Evidence Link   | Verified By / Date |
| --------- | ----------------- | -------------------------------- | ------- | --------------- | ------------------ |
| PLAN-001  | Pending           | Three template resolver commands | Blocked | N/A             | Pending            |
| AUTH-001  | Current branch    | `bun run test:auth`              | Pass    | TDD-US2-001     | Codex / 2026-09-28 |
| AUTH-002  | Current branch    | `bun run test`                   | Pass    | Full suite      | Codex / 2026-09-28 |
| AUTH-003  | Current branch    | Focused US5 suites               | Pass    | TDD-US5-001–003 | Codex / 2026-09-28 |

## Defect Metrics

| Metric                       | Value | Notes                                                          |
| ---------------------------- | ----- | -------------------------------------------------------------- |
| Total defects                | 4     | One open tooling issue; three verified test-integration issues |
| Open Critical / High defects | 0     | No product execution has occurred                              |
| Deferred defects             | 0     | No accepted risks                                              |
| Reopened defects             | 0     |                                                                |
| Escaped defects              | 0     |                                                                |

## Baseline Evidence

| Date       | Command                 | Result | Evidence summary                                                                 |
| ---------- | ----------------------- | ------ | -------------------------------------------------------------------------------- |
| 2026-09-27 | `bun run test`          | Pass   | 163 suites and 1,254 tests passed in 189.497 seconds                             |
| 2026-09-27 | `bun run app:typecheck` | Pass   | TypeScript completed with no errors                                              |
| 2026-09-27 | `bun run app:lint`      | Pass   | Zero errors; four pre-existing `@next/next/no-img-element` optimization warnings |
| 2026-09-28 | `bun run test`          | Pass   | 176 suites and 1,537 tests passed after Better Auth test-boundary integration    |

## Required Checks

- [x] Every unexpected planning failure has an entry.
- [x] No Critical or High defect is open.
- [x] No deferred defect or risk acceptance exists.
- [ ] Fixed defects link verification evidence. PLAN-001 is still Open.
- [x] Counts and impact match `test-summary.md`.
