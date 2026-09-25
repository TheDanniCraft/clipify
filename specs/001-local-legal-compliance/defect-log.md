# Defect Log: Local Legal and Privacy Center

**Feature**: [spec.md](spec.md)

**Plan**: [plan.md](plan.md)

**Traceability**: [test-traceability.md](test-traceability.md)

**Test Summary**: [test-summary.md](test-summary.md)

**Created**: 2026-09-24

**Last Updated**: 2026-09-25

## Purpose and Scope

Track product, test, environment, and governance issues that affect feature readiness. Routine implementation work belongs in the future `tasks.md`.

## Status Vocabulary

- `Open`, `In Progress`, `Blocked`, `Fixed`, `Verified`, `Deferred`, and `Rejected` follow the Spec Kit test-first governance meanings.

## Severity and Priority Policy

| Level    | Severity Meaning                                                                                                     | Priority Meaning                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Critical | Data exposure, invalid consent activation, destructive rights handling, or release-blocking legal/compliance failure | Must be resolved before release unless explicitly accepted by the accountable operator |
| High     | Major user-visible policy/control failure, unknown optional tracking, severe accessibility failure                   | Resolve before release unless a documented exception exists                            |
| Medium   | Partial flow failure, contained inconsistency, or non-critical quality-gate failure                                  | Resolve in release when practical or assign follow-up                                  |
| Low      | Cosmetic, documentation, or low-risk maintainability issue                                                           | Resolve opportunistically                                                              |

## Defect Summary

No product defects are known. Two local environment issues were recorded during verification.

| Defect ID | Title                                                                | Source / Evidence ID | Severity | Priority | Status   | Owner       | Detected By           | Evidence Link         | Target / Resolution                    |
| --------- | -------------------------------------------------------------------- | -------------------- | -------- | -------- | -------- | ----------- | --------------------- | --------------------- | -------------------------------------- |
| ENV-001   | Damaged Windows ACLs denied Next.js access to installed modules      | Browser gate         | Low      | Low      | Verified | Engineering | Playwright web server | Isolated ATDD rerun   | Reset inherited ACLs; scenarios passed |
| ENV-002   | Playwright web-server teardown hangs on Windows after all tests pass | Full E2E gate        | Low      | Medium   | Verified | Engineering | `bun run test:e2e`    | Two clean local exits | Explicit managed-server shutdown       |

## Planning Tool Issue

`setup-plan.ps1` and the template resolver fail in the current Windows environment while invoking the discovered `python3.exe` shim. The prescribed templates were read directly and materialized manually. This does not affect the application but should be reported upstream or fixed separately if future Spec Kit automation must run unchanged.

## Open Defect Review

No defects remain open.

## Verification and Regression Closure

ENV-001 was closed after resetting inherited dependency ACLs and rerunning the affected ATDD scenarios successfully. ENV-002 was closed after the loopback-only Playwright server gained explicit global teardown; two consecutive full E2E runs each passed 21 tests and exited zero on Windows.

## Defect Metrics

| Metric                       | Value | Notes                                      |
| ---------------------------- | ----- | ------------------------------------------ |
| Total product defects        | 0     | No product failure observed                |
| Open Critical / High defects | 0     | Must remain zero or be explicitly accepted |
| Deferred defects             | 0     | None                                       |
| Reopened defects             | 0     | None                                       |
| Escaped defects              | 0     | Feature not released                       |

## Required Checks

- [x] Every unexpected failing test or gate has a defect entry or documented non-defect rationale.
- [x] Every Critical or High defect is verified, rejected, or explicitly accepted.
- [x] Every deferred defect has owner, rationale, compensating evidence, and follow-up.
- [x] Every fixed defect links verification evidence.
- [x] Counts and release decisions match `test-summary.md`.
