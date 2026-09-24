---

## Test-First Architecture & Quality Plan _(mandatory)_

### Test Suite Directory Structure

The selected project structure MUST expose clear ownership for all test artifacts.

```text
tests/
|-- tdd/
|   |-- unit/
|   |-- component/
|   |-- integration/
|   |-- contract/
|   |-- property/
|   |-- negative/
|   `-- fixtures/
|-- bdd/
|   |-- features/
|   |   |-- user-stories/
|   |   |-- business-rules/
|   |   `-- edge-cases/
|   |-- steps/
|   `-- support/
|-- atdd/
|   |-- features/
|   |   |-- acceptance/
|   |   `-- regression/
|   |-- steps/
|   `-- support/
|-- support/
|   |-- fixtures/
|   |-- helpers/
|   `-- runner-adapters/
`-- [reports/]  # only when versioned report retention is required
    |-- tdd/
    |-- bdd/
    `-- atdd/
```

If the repository uses a platform-specific convention, keep the platform convention but preserve visible `tdd`, `bdd`, and `atdd` ownership when those suites produce artifacts. Do not create empty BDD or ATDD directories when the practice is entirely `N/A`. Create a reports directory only when the evidence-retention policy requires versioned local reports.

Suite directories identify primary ownership, not mutually exclusive test types. Shared fixtures, helpers, environment setup, and runner adapters MUST live under `tests/support/` or an equivalent shared path unless they are genuinely suite-specific. The plan MUST identify and remove equivalent scenarios or tests duplicated only to satisfy multiple practice labels.

### Minimum Professional Test Reports

The feature MUST maintain the minimum professional reporting set while avoiding unnecessary document sprawl:

| Professional Report               | Feature Artifact                                         | Required Sections / Scope                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Plan                         | `plan.md`                                                | scope, strategy, suite ownership, tools, commands, environments, quality gates, thresholds, risks, entry/exit expectations, and evidence retention                   |
| Test Inventory / Test Case Report | `specs/<feature>/test-traceability.md`                   | evidence artifact registry with IDs, owning suites, roles, paths, commands, statuses, evidence links, and notes                                                      |
| Requirements Traceability Matrix  | `specs/<feature>/test-traceability.md`                   | source coverage map, scenario coverage matrix, BDD/ATDD applicability, and normalized source-to-artifact relationships                                               |
| Test Execution Report             | `specs/<feature>/test-traceability.md` plus CI artifacts | Red/Green/Blocked statuses, command evidence paths, quality-gate results, raw runner output links, and retained CI artifacts                                         |
| Defect Report                     | `specs/<feature>/defect-log.md`                          | defect summary, severity/priority policy, detailed reproduction, triage, release impact, risk acceptance, and verification closure                                   |
| Test Summary Report               | `specs/<feature>/test-summary.md`                        | executive summary, scope, execution totals, coverage/traceability status, defect summary, risks/exceptions, environment, evidence index, and Go/No-Go recommendation |

CI artifacts and machine-readable tool reports are raw evidence referenced by these reports. Create additional standalone reports only when audit, regulatory, customer, or tool-integration needs are declared in the plan.

Project or release-level aggregation is handled later by `/speckit.converge` through a single overall Test Summary Report at `reports/test-summary.md` or `reports/releases/<release-id>/test-summary.md`. Do not create overall traceability, inventory, execution, or defect reports during feature planning unless an external requirement is declared.

Declare the destination decision before convergence:

| Setting              | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| Overall summary mode | [rolling/release]                                                          |
| Release ID           | [N/A or release-id]                                                        |
| Output path          | [reports/test-summary.md or reports/releases/<release-id>/test-summary.md] |
| Rationale            | [why this destination is appropriate]                                      |

Use `rolling` with `reports/test-summary.md` when the project wants one latest aggregate report. Use `release` with `reports/releases/<release-id>/test-summary.md` when the project wants versioned release evidence. If no release ID is provided, default to `rolling`.

### BDD and ATDD Applicability

For every user story, carry forward the specification's BDD and ATDD decisions:

| User Story | BDD            | ATDD           | Scenario Evidence ID(s)           | N/A Rationale                        | Alternative Evidence    |
| ---------- | -------------- | -------------- | --------------------------------- | ------------------------------------ | ----------------------- |
| US1        | [Required/N/A] | [Required/N/A] | [IDs and BDD/ATDD evidence roles] | [concrete rationale when applicable] | [TDD/gate artifact IDs] |

The plan MUST NOT turn an approved `N/A` into ceremonial scenarios. If planning reveals observable behavior or a stakeholder acceptance boundary, change the decision to `Required` and update the specification.

A `Required` decision does not require a scenario owned by that practice. When one scenario fully covers both behavior and acceptance intent, assign it one owning suite, map both evidence roles, record an explicit equivalence rationale, and use its owning-suite path, command, and report. Create separate BDD and ATDD artifacts when their examples, execution boundaries, assertions, interfaces, or acceptance outcomes differ materially.

### Scenario Coverage Matrix

The plan MUST carry forward or refine the specification's scenario coverage matrix in `specs/<feature>/test-traceability.md`:

| Scenario / Example ID    | Owning Suite | Evidence Role(s) | Primary Source ID | Covered Inputs / Classes    | Positive / Negative / Boundary | Interface             | Rationale           |
| ------------------------ | ------------ | ---------------- | ----------------- | --------------------------- | ------------------------------ | --------------------- | ------------------- |
| BDD-US1-001:example-001  | BDD          | BDD              | FR-001            | [supported option/class]    | Positive                       | [CLI/API/UI]          | [coverage reason]   |
| ATDD-US1-001:example-001 | ATDD         | ATDD             | SC-001            | [acceptance workflow/class] | Positive                       | [end-to-end boundary] | [acceptance reason] |

Planning MUST verify that:

- every source marked `TDD` required has enough planned TDD artifacts to cover implementation-level behavior, boundaries, invalid inputs, state transitions, integration contracts, expected error sources, and edge/error cases;
- every user-visible FR has at least one BDD scenario or scenario-outline example unless BDD is justified `N/A`;
- every buildable SC has ATDD scenario evidence unless ATDD is justified `N/A`;
- every EC/error condition has a negative or boundary row;
- every scenario outline enumerates all required examples or records an approved sampling strategy;
- required externally visible combinations use full coverage or justified pairwise/risk-based sampling;
- broad umbrella scenarios are not the only evidence for unrelated FRs, SCs, or ECs.

### Traceability Materialization

Before planning completes:

1. Resolve the template named `test-traceability-template` through Spec Kit's template resolver.
2. Resolve the templates named `defect-log-template` and `test-summary-template`.
3. Create `specs/<feature>/test-traceability.md`, `specs/<feature>/defect-log.md`, and `specs/<feature>/test-summary.md` from the resolved content.
4. Populate the Evidence Artifact Registry with each planned artifact ID, owning suite, evidence roles, path, and execution command.
5. Populate the Source Coverage Map with every known FR/SC/US/EC and its artifact IDs.
6. Populate the Scenario Coverage Matrix with scenario/example rows, primary source IDs, input classes, interfaces, and sampling or shared-evidence rationales.
7. Populate BDD/ATDD applicability decisions and Quality Gate Results without copying artifact execution fields into source mappings.
8. Initialize `defect-log.md` with zero known defects or known planning defects and preserve its severity/priority, triage, release-impact, and verification sections.
9. Initialize `test-summary.md` with report links, planned scope, planned evidence locations, and a non-final status such as `Blocked` or `Not Run`.
10. Use `Planned` for required evidence not yet executed; do not invent Red/Green results during planning.

All populated IDs MUST reuse core forms where available (`US1`, `FR-001`, and `SC-001`) and use preset-specific forms only where necessary (`EC-001`, `TDD-US1-001`, `BDD-US1-001`, and `ATDD-US1-001`).

If a report file already exists, update it in place and preserve valid registry and gate execution history, defect history, risk-acceptance decisions, approvals, and evidence links.

### Test Tooling and Gate Decisions

| Practice/Gate   | Applicability  | Tool and Required Command                                 | Threshold                       | Evidence Retention   | Rationale                     |
| --------------- | -------------- | --------------------------------------------------------- | ------------------------------- | -------------------- | ----------------------------- |
| TDD             | Required       | [runner + command]                                        | all planned tests pass          | [CI output/artifact] | production logic              |
| BDD             | [Required/N/A] | [owning-suite command(s), shared when applicable, or N/A] | all mapped BDD evidence passes  | [CI output/artifact] | [decision]                    |
| ATDD            | [Required/N/A] | [owning-suite command(s), shared when applicable, or N/A] | all mapped ATDD evidence passes | [CI output/artifact] | [decision]                    |
| Coverage        | Required       | [tool + command]                                          | [line/branch thresholds]        | [CI artifact]        | changed production code       |
| Lint/Format     | Required       | [tools + commands]                                        | zero blocking findings          | [CI output]          | source consistency            |
| Static Analysis | [Required/N/A] | [tool + command or N/A]                                   | [severity policy]               | [CI output/artifact] | [stack/risk rationale]        |
| Security        | [Required/N/A] | [tool + command or N/A]                                   | [severity policy]               | [CI artifact]        | [threat-surface rationale]    |
| Runtime Smoke   | [Required/N/A] | [runner + command or N/A]                                 | all declared checks pass        | [CI artifact]        | [runnable-artifact rationale] |

### Risk-Based Threshold Policy

The plan MUST declare coverage thresholds based on change scope, risk, and the existing project baseline:

- Recommended starting guardrails for changed production code are **90% line** and **85% branch** coverage; they are not universal constants.
- Coverage MUST NOT regress below the accepted project baseline.
- Lower thresholds require a scoped exception with rationale, compensating evidence, approver, and expiry or follow-up task.
- BDD scenario execution: **100% of planned BDD scenarios pass**.
- ATDD scenario execution: **100% of planned ATDD scenarios pass**.
- Lint/format: **0 blocking findings**.
- Required static analysis/type checking: **0 blocking findings** under the declared severity policy.
- Required runtime smoke: **all declared smoke checks pass**.
- Security-sensitive code paths: include negative tests for authentication, authorization, validation, injection, path traversal, secrets handling, and persistence failures where applicable.

### Evidence Retention

The authoritative evidence is the exact command, exit status, and reproducible output referenced by `specs/<feature>/test-traceability.md`. Store machine-readable reports as CI artifacts by default. Commit generated reports only when an explicit audit or regulatory retention policy requires versioned evidence.

### Red-Green-Refactor Execution Model

For each user story:

1. Define the required ATDD and BDD Gherkin scenarios before production implementation begins.
2. Divide the story into the smallest meaningful behavior slices that can be implemented and verified independently.
3. For each slice, add only the executable ATDD/BDD bindings and TDD tests needed to drive that slice.
4. Run that evidence, confirm it fails for the intended missing behavior, and record `Red`.
5. Implement the smallest production change needed to make the slice pass.
6. Run the slice evidence, record `Green`, and refactor while keeping the relevant suites green.
7. Repeat steps 3-6 for the next slice instead of accumulating all failing tests before any production code is written.
8. At story completion, run the full TDD suite and all executable evidence mapped to required BDD/ATDD roles, plus coverage, linting, formatting, and every gate marked `Required`.
