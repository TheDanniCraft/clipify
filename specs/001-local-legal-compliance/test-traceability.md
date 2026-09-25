# Test Traceability: Local Legal and Privacy Center

**Feature**: [spec.md](spec.md)

**Plan**: [plan.md](plan.md)

**Defect Log**: [defect-log.md](defect-log.md)

**Test Summary**: [test-summary.md](test-summary.md)

**Last Updated**: 2026-09-25

## Scope Boundary

This feature publishes one English, Clipify-hosted document set using the EU/EEA and German operator baseline. Legal pages read the existing c15t categories and open its existing dialog but do not create or mutate consent state. Regional variants and worldwide-compliance promises are excluded until a recorded review trigger applies.

## Evidence Artifact Registry

`Green` means the owning executable passed; it does not imply test-first ordering. Valid Red evidence and Red-to-Green transitions are retained in [tdd/cycle-log.md](tdd/cycle-log.md). A2, A3, A4, and A6-A11 are explicitly classified `TEST_AFTER`. `ATDD-US3-002`, `ATDD-US4-003`, and `ATDD-US4-004` also have Green execution evidence but no behavior-level Red and are recorded as test-after rather than as TDD evidence.

| Artifact IDs     | Owner      | Artifact / command                                                                      | Status | Evidence                                            |
| ---------------- | ---------- | --------------------------------------------------------------------------------------- | ------ | --------------------------------------------------- |
| TDD-US1-001–005  | TDD        | Legal manifest, content, registry, migration, and device tests; `bun run test:coverage` | Green  | 159 suites / 1,238 tests passed                     |
| TDD-US2-001–004  | TDD        | Consent projection, classification, boundary, and preferences tests                     | Green  | Coverage report and cycle log                       |
| TDD-US3-001–002  | TDD        | Rights and terms tests                                                                  | Green  | Coverage report and cycle log                       |
| TDD-US4-001–005  | TDD        | Versioning, audit, publication, scope, and provenance tests                             | Green  | Coverage report and cycle log                       |
| ATDD-US1-001–003 | ATDD + BDD | `test/bdd/features/local-legal-compliance.feature`; `bun run test:bdd`                  | Green  | All mapped rows passed                              |
| ATDD-US2-001–004 | ATDD + BDD | Same owning feature and bindings                                                        | Green  | All mapped rows passed                              |
| ATDD-US3-001–002 | ATDD + BDD | Same owning feature and bindings                                                        | Green  | All mapped rows passed                              |
| ATDD-US4-001–004 | ATDD + BDD | Same owning feature and bindings                                                        | Green  | All mapped rows passed, including four A11 examples |

The Gherkin scenarios own both ATDD and BDD evidence because each visible behavior example is also its stakeholder release boundary; duplicate scenarios would provide no independent evidence.

### Historical test-order classification

| Evidence           | Classification | Retained evidence                                                                                       |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------- |
| A2, A3, A4, A6-A11 | TEST_AFTER     | Green browser executions are retained; missing step definitions are not counted as product-behavior Red |
| ATDD-US3-002       | TEST_AFTER     | Green terms-route scenario; no behavior-level Red was observed before implementation                    |
| ATDD-US4-003       | TEST_AFTER     | Green publication-metadata scenario; no behavior-level Red was observed before implementation           |
| ATDD-US4-004       | TEST_AFTER     | Green regional-scope scenario; no behavior-level Red was observed before implementation                 |

## Source Coverage Map

| Sources                                                                 | Canonical evidence                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| US1; FR-001–008; SC-001, SC-002, SC-006, SC-009; EC-001–004             | TDD-US1-001–005; ATDD-US1-001–003; ATDD-US2-002; A1–A3, A6, A12 |
| US2; FR-009–013; SC-003, SC-004; EC-001, EC-004                         | TDD-US2-001–004; ATDD-US2-001–004; A4–A6                        |
| US3; FR-014–016; SC-007; EC-006, EC-007                                 | TDD-US3-001–002; ATDD-US3-001–002; A7–A9                        |
| US4; FR-017–023; SC-005, SC-008, SC-010; EC-002, EC-003, EC-005, EC-008 | TDD-US4-001–005; ATDD-US4-001–004; A10–A12                      |

All FR-001–023, SC-001–010, EC-001–008, and US1–US4 identifiers have one canonical mapping above. Individual behavior-to-source mappings are retained in [tdd/test-list.md](tdd/test-list.md).

## Scenario Coverage Matrix

| Boundary                                                            | Scenario evidence              | Result |
| ------------------------------------------------------------------- | ------------------------------ | ------ |
| Local routes, metadata, narrow layout, keyboard access              | ATDD-US1-001                   | Green  |
| Consent-backend degradation and supplemental value-free device view | ATDD-US1-002–003, ATDD-US2-004 | Green  |
| Complete category/service disclosure and existing dialog            | ATDD-US2-001–003               | Green  |
| Privacy requests, no-account contact, qualifications                | ATDD-US3-001                   | Green  |
| Accounts, paid plans, and self-hosted Runner terms                  | ATDD-US3-002                   | Green  |
| Unknown storage/origin and material-change classes                  | ATDD-US4-001–002               | Green  |
| Missing publication metadata and reviewed regional scope            | ATDD-US4-003–004               | Green  |

## Quality Gate Results

| Gate                 | Command                             | Result | Evidence / note                                                            |
| -------------------- | ----------------------------------- | ------ | -------------------------------------------------------------------------- |
| TDD and coverage     | `bun run test:coverage`             | Green  | 159 suites, 1,238 tests; 75.86% statements / 68.65% branches overall       |
| BDD / ATDD           | `bun run test:bdd` and focused runs | Green  | 19 feature rows passed; scenario-owned US/FR/SC tags verified              |
| Compliance           | `bun run test:compliance`           | Green  | Two consecutive runs: 6 unit checks plus one three-flow browser audit each |
| Lint                 | `bun run app:lint`                  | Green  | 0 errors; 4 pre-existing image warnings                                    |
| Format               | `bun run app:prettier:check`        | Green  | All changed files formatted                                                |
| Type checking        | `bun run app:typecheck`             | Green  | 0 errors                                                                   |
| Dependency security  | `bun audit --audit-level=high`      | Green  | 1,313 packages checked; 0 high/critical findings                           |
| Production build     | `bun run app:build`                 | Green  | Next.js 16.3.4 build; all legal routes generated                           |
| GoAdopt scan         | Recursive `src/app` source test     | Green  | Zero matches; live A1 navigation also records zero GoAdopt requests        |
| Full browser command | `bun run test:e2e`                  | Green  | 21/21 passed with exit 0 on Windows; managed teardown verified             |

## Status and Retention

`Planned`, `Red`, `Green`, and `Blocked` use the test-first governance meanings. Raw coverage, Playwright reports, traces, screenshots, JUnit output, and sanitized compliance JSON are CI artifacts; versioned Red/Green evidence is retained in the cycle log.
