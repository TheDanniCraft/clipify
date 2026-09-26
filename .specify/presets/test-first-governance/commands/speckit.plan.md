# Test-First Planning Wrapper

Apply these requirements in addition to the core planning workflow.

## Mandatory Planning Outputs

The implementation plan MUST include:

- test directory structure with visible ownership for every applicable suite;
- selected tools and commands for TDD, BDD, ATDD, coverage, linting, formatting, static analysis/type checking, security, and runtime smoke validation;
- gate applicability, blocking behavior, risk-based thresholds, and exception policy;
- CI output or artifact locations and any explicit versioned-report retention requirement;
- red-green-refactor execution model for every user story;
- a materialized `specs/<feature>/test-traceability.md` with an evidence artifact registry, source-to-artifact coverage map, scenario coverage matrix, applicability decisions, and quality-gate results;
- a materialized `specs/<feature>/defect-log.md` for defect triage, release-impact decisions, accepted risks, and verification closure;
- a materialized `specs/<feature>/test-summary.md` for execution summary, coverage summary, defect summary, risks/exceptions, evidence links, and Go/No-Go recommendation;
- BDD and ATDD applicability decisions, including rationale and alternative evidence for every `N/A`.
- coverage-complete, non-duplicative scenario mappings showing how every `Required` BDD/ATDD role is satisfied, which suite owns each artifact, and which scenario/example rows cover each source.

## Minimum Professional Test Reports

Create and maintain the minimum professional reporting set for the feature:

- `plan.md` acts as the Test Plan: scope, strategy, tools, environments, gates, thresholds, and evidence-retention policy.
- `specs/<feature>/test-traceability.md` acts as the combined Test Inventory, Requirements Traceability Matrix, execution evidence index, scenario coverage matrix, and quality-gate results report.
- `specs/<feature>/defect-log.md` acts as the Defect Report: defects, unexpected failures, severity/priority, triage, risk acceptance, and verification closure.
- `specs/<feature>/test-summary.md` acts as the Test Summary Report: execution results, coverage/traceability status, defect status, risks/exceptions, evidence references, and release recommendation.

Do not create extra standalone reports unless the plan declares an audit, regulatory, customer, or tool-integration reason. CI artifacts and machine-readable runner outputs remain raw evidence referenced by these reports.

Project or release-level aggregation is handled later by `/speckit.converge` through a single overall Test Summary Report at `reports/test-summary.md` or `reports/releases/<release-id>/test-summary.md`. Do not create overall traceability, inventory, execution, or defect reports during feature planning unless an external requirement is declared.

Declare the destination decision before convergence:

| Setting              | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| Overall summary mode | [rolling/release]                                                          |
| Release ID           | [N/A or release-id]                                                        |
| Output path          | [reports/test-summary.md or reports/releases/<release-id>/test-summary.md] |
| Rationale            | [why this destination is appropriate]                                      |

Use `rolling` with `reports/test-summary.md` when the project wants one latest aggregate report. Use `release` with `reports/releases/<release-id>/test-summary.md` when the project wants versioned release evidence. If no release ID is provided, default to `rolling`.

## Mandatory Report Creation

Before reporting planning complete:

1. Resolve `test-traceability-template` through Spec Kit's template resolver (for example, `specify preset resolve test-traceability-template`).
2. Resolve `defect-log-template` and `test-summary-template` through Spec Kit's template resolver.
3. Materialize the resolved templates at `specs/<feature>/test-traceability.md`, `specs/<feature>/defect-log.md`, and `specs/<feature>/test-summary.md`.
4. Populate the Evidence Artifact Registry with planned artifact IDs, owning suites, evidence roles, paths, and commands.
5. Populate the Source Coverage Map with all known source IDs and their artifact IDs.
6. Populate the Scenario Coverage Matrix with scenario/example rows, primary source IDs, input classes, interfaces, and sampling or shared-evidence rationales.
7. Populate applicability decisions and Quality Gate Results without duplicating mutable artifact execution fields in source mappings.
8. Initialize `defect-log.md` with zero known defects or known planning defects, severity/priority policy, and release-impact review placeholders.
9. Initialize `test-summary.md` with report references, planned scope, planned evidence locations, and `Blocked` or `Not Run` status; do not claim Pass or Go during planning.
10. Set unexecuted required evidence to `Planned`; do not claim Red, Green, Pass, or Go results during planning.

If these report artifacts already exist, update them in place and preserve valid execution history, defect history, risk-acceptance decisions, approvals, and evidence links.

## Tool Selection Guidance

Choose stack-native tools. Examples:

- Python: pytest, pytest-bdd/behave, coverage.py, ruff, mypy/pyright, bandit where applicable.
- TypeScript/JavaScript: Vitest/Jest, Cucumber.js/Playwright, c8/nyc, ESLint, TypeScript compiler, dependency audit where applicable.
- Java: JUnit, Cucumber JVM, JaCoCo, Checkstyle/SpotBugs/Error Prone where applicable.
- .NET: xUnit/NUnit/MSTest, SpecFlow/Reqnroll, Coverlet, dotnet format, analyzers.
- Go: go test, godog, coverage, go vet, staticcheck.

{CORE_TEMPLATE}

## Additional Planning Gate

Before completing the plan, verify:

- [ ] The plan makes tests mandatory, not optional
- [ ] Every required BDD and ATDD evidence role maps to an executable binding and owning-suite command
- [ ] The Scenario Coverage Matrix covers every required BDD/ATDD behavior, acceptance boundary, edge/error condition, and required example class
- [ ] Every scenario outline enumerates required examples or records an approved sampling strategy
- [ ] Shared BDD/ATDD evidence has one owning suite and one execution path, with both roles recorded in traceability
- [ ] Shared BDD/ATDD evidence records why behavior and acceptance intent are equivalent
- [ ] Every BDD/ATDD `N/A` remains justified and is not contradicted by the planned behavior
- [ ] Coverage thresholds protect changed code and the accepted project baseline
- [ ] Every gate has a command or a justified `N/A`, plus blocking behavior and evidence retention
- [ ] Lower threshold exceptions identify scope, rationale, compensating evidence, approver, and expiry/follow-up
- [ ] `specs/<feature>/test-traceability.md` contains complete registry, coverage-map, scenario-matrix, applicability, and gate sections with no duplicated execution state
- [ ] `specs/<feature>/defect-log.md` exists, uses the defect-log template sections, and is initialized for known defects or zero known defects
- [ ] `specs/<feature>/test-summary.md` exists, uses the test-summary template sections, links the plan/traceability/defect reports, and remains non-final until execution evidence exists
- [ ] The plan declares the Overall Test Summary Destination decision or states that convergence will default to `rolling` at `reports/test-summary.md`
