![Test-First Governance Preset for GitHub Spec Kit](assets/spec-kit-preset-test-first-governance-header.jpg)

# Test-First Governance Preset for GitHub Spec Kit

## Motivation

Spec-Driven Development makes intent explicit before implementation, but a specification alone does not prove that the resulting software is correct, resilient, or complete. This preset strengthens the path from specification to implementation with test-first executable evidence, requirement-to-test traceability, and risk-based quality gates.

The goal is a robust and repeatable delivery workflow in which expected failures are observed before production changes, requirements remain connected to current evidence, and completion depends on declared tests and quality checks passing.

## Approach

The preset strengthens the existing [GitHub Spec Kit](https://github.com/github/spec-kit) workflow rather than replacing it:

- **Test-Driven Development (TDD)** applies incremental Red-Green-Refactor cycles to production logic.
- **Behavior-Driven Development (BDD)** expresses applicable user-visible behavior and business rules as executable Gherkin examples.
- **Acceptance Test-Driven Development (ATDD)** defines executable stakeholder-facing acceptance evidence before implementation.
- **Traceability** connects stories, requirements, edge cases, scenarios, tests, and current execution evidence.
- **Risk-based quality gates** apply coverage, linting, formatting, static analysis, security, and runtime checks according to the project's stack and risk surface.

## Requirements and Installation

This preset requires GitHub Spec Kit `>=0.12.11`. It governs generated artifacts and agent instructions; it does not install the test runners or analysis tools selected during planning.

### Recommended priority

Install this preset with a high priority—preferably the highest priority among all installed presets. Its purpose is to materially improve the quality, reliability, traceability, and release readiness of the generated implementation workflow. Because these concerns apply across the entire delivery process, its governance should take precedence over conflicting or weaker guidance from any lower-priority preset, not only presets focused on testing.

The examples below use priority `5`. If any other installed preset has priority `5` or higher, assign this preset a higher supported value or lower the other preset's priority so that this preset remains the highest-priority preset. Review the resolved output whenever presets are added or reprioritized to confirm that their combined guidance remains compatible with this preset's mandatory test-first governance.

After a release tag is published, install it directly with:

```bash
specify preset add --from "https://github.com/ka-zo/spec-kit-preset-test-first-governance/archive/refs/tags/<release-tag>.zip" --priority 5
```

If the preset is available in your configured catalog:

```bash
specify preset add test-first-governance --priority 5
```

Priority `5` is the recommended default: it allows the preset's mandatory test-first rules to supersede lower-priority optional-test wording while remaining composable with unrelated presets.

## Recommended Workflow

```text
/speckit.constitution
/speckit.specify
/speckit.clarify
/speckit.plan
/speckit.checklist
/speckit.tasks
/speckit.analyze
/speckit.implement
/speckit.converge
```

This preset strengthens `constitution`, `specify`, `plan`, `checklist`, `tasks`, `analyze`, `implement`, and `converge`. It does not modify `clarify`; `clarify` is an optional but recommended step before planning.

## Default Behavior and Overrides

This preset does not define special CLI flags. Users guide it by adding normal text to the relevant Spec Kit command. The table below lists the main behaviors most users may want to tune; later commands may refine earlier defaults when the decision naturally becomes clearer.

| Behavior                         | Description                                                                                   | Default Behavior                                                                                                                                                                                                                 | How To Change The Behavior                                                                                                                                    | Effect / Impact                                                                                                     | Recommended Command                                                                         | Example Override                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| BDD and ATDD applicability       | Decides when behavior and acceptance evidence are required.                                   | BDD is required for user-visible behavior and business rules. ATDD is required for stakeholder acceptance criteria and release boundaries. Technical-only work may mark either as `N/A` with rationale and alternative evidence. | State which stories, requirements, or success criteria are `Required` or `N/A`, and explain every `N/A`.                                                      | Controls whether Gherkin scenarios, bindings, scenario matrix rows, and executable BDD/ATDD evidence are generated. | `/speckit.specify`, because applicability depends on feature intent.                        | `Mark BDD N/A for this internal refactor because there is no user-visible behavior; use TDD and coverage evidence instead.`             |
| Test coverage expectations       | Defines how complete the TDD and scenario coverage must be.                                   | TDD is mandatory for production logic. BDD/ATDD scenario sets are coverage-complete, non-duplicative, and enumerate required examples unless an approved sampling strategy is recorded.                                          | Name additional risk areas, negative paths, contracts, state transitions, property tests, or sampling strategies such as pairwise or boundary-value coverage. | Expands or focuses the planned test inventory, scenario examples, generated tasks, and coverage matrix rows.        | `/speckit.specify` for required behavior, then `/speckit.plan` for test levels and tooling. | `Use pairwise scenario-outline examples for browser x role x locale combinations, plus boundary-value examples for upload size limits.` |
| Test and quality tooling         | Selects runners and gates used to produce evidence.                                           | Use stack-native tools. Coverage, linting, and formatting are required; static analysis, security, and runtime smoke are required when applicable.                                                                               | Name tools, commands, gate policies, and any justified `N/A` gates.                                                                                           | Determines suite commands, quality-gate tasks, evidence links, and pass/fail criteria.                              | `/speckit.plan`, because tooling depends on stack and risk surface.                         | `Use pytest, pytest-bdd, coverage.py, ruff, mypy, and bandit; runtime smoke is Required for the packaged API service.`                  |
| Coverage and threshold policy    | Sets numeric coverage expectations and exception handling.                                    | Recommended starting guardrails are 90% line and 85% branch coverage for changed production code, with no baseline regression.                                                                                                   | Provide different thresholds, baseline policy, exception scope, approver, expiry, and compensating evidence.                                                  | Changes coverage gate pass/fail criteria and what must be documented for exceptions.                                | `/speckit.plan`, because thresholds depend on project risk and current baseline.            | `Coverage thresholds: 95% line, 90% branch for changed auth code; lower branch coverage requires security-owner approval.`              |
| Evidence retention and reports   | Controls where evidence and professional test reports are stored.                             | Feature reports live under `specs/<feature>/`: `test-traceability.md`, `defect-log.md`, and `test-summary.md`. Raw runner output is retained as CI artifacts by default.                                                         | Specify committed report retention, CI artifact paths, issue tracker links, approval roles, or an alternate canonical report convention.                      | Affects where Red/Green evidence, defects, risks, approvals, and release evidence are recorded and reviewed.        | `/speckit.plan` for policy; `/speckit.implement` for updates.                               | `Retain raw pytest, coverage, and bandit output as CI artifacts; link GitHub issue IDs from defect-log.md.`                             |
| Overall test summary destination | Controls where project/release-level aggregate test results are written.                      | If no release ID is supplied, convergence defaults to `rolling` and writes `reports/test-summary.md`. Release mode writes `reports/releases/<release-id>/test-summary.md`.                                                       | Provide `rolling` or `release`, a release ID when needed, and an output path matching the selected mode.                                                      | Determines whether `/speckit.converge` updates one latest summary or creates versioned release evidence.            | `/speckit.converge`, because release intent is usually known after implementation.          | `Overall Test Summary Destination: release. Release ID: v1.3.0. Output path: reports/releases/v1.3.0/test-summary.md.`                  |
| Extra overall reports            | Controls whether project/release-level reports beyond the aggregate test summary are created. | Do not create separate overall test-plan, inventory, traceability, execution, or defect reports. Use the aggregate summary plus feature reports and CI artifacts.                                                                | Declare the audit, regulatory, customer, or tool-integration requirement that needs an additional overall report.                                             | Prevents duplicate report sets while allowing externally required documentation.                                    | `/speckit.converge`, because this is a release or audit decision.                           | `Customer contract requires an overall defect report; generate it from feature defect logs and link it from the overall test summary.`  |

## Governance Scope

- **TDD** is mandatory for production logic and must be coverage-complete for the implementation-level behavior, including happy paths, boundaries, edge cases, contracts, and expected error sources.
- **BDD** is required for applicable user-visible behavior, business rules, alternate flows, and observable errors.
- **ATDD** is required for applicable stakeholder-facing acceptance criteria and release boundaries.
- **Quality gates** include risk-based coverage, linting, formatting, static analysis/type checking, security validation, applicable runtime smoke checks, and traceability.

Each user story marks BDD and ATDD as `Required` or `N/A`. `N/A` is allowed only for technical-only work when the corresponding observable behavior or stakeholder acceptance boundary does not exist, and it requires a concrete rationale plus alternative TDD or quality-gate evidence.

Every executable test artifact has one **owning suite** for its path, command, and reporting route. One scenario may satisfy both BDD and ATDD when it fully covers both intents and traceability records why the behavior example and stakeholder acceptance boundary are equivalent; this avoids duplicating the scenario, binding, task, command, or report.

TDD inventories are coverage-complete rather than merely minimal; generated tasks must include every required implementation-level behavior, boundary, invalid input, state transition, integration contract, and expected error source. BDD and ATDD scenario sets are also coverage-complete rather than merely minimal. Scenario outlines enumerate required examples or record an approved sampling strategy such as pairwise coverage, boundary-value coverage, or risk-based representative coverage. Broad umbrella scenarios are blocking gaps when they are the only evidence for unrelated requirements, success criteria, edge cases, inputs, interfaces, outcomes, or error messages.

## Generated Artifacts and Conventions

### Test Suite Ownership

```text
tests/
├── tdd/
├── bdd/
├── atdd/
├── support/
└── [reports/]  # only when versioned report retention is required
```

Platform-specific layouts are allowed when suite ownership remains visible. BDD-owned artifacts belong under `tests/bdd/`, and ATDD-owned artifacts belong under `tests/atdd/`, or equivalent platform-specific paths. A secondary BDD or ATDD evidence role does not require another directory or a duplicate artifact. Shared fixtures, helpers, and runner adapters belong under `tests/support/` or an equivalent shared path. CI artifacts are the default evidence-retention mechanism, so a committed reports directory is normally unnecessary.

### Feature Traceability

Planning creates one canonical artifact for each feature:

```text
specs/<feature>/test-traceability.md
```

It maps FR/SC/US/EC source identifiers to registered test and scenario artifacts while keeping current execution and quality-gate results in their owning entries. It also includes a Scenario Coverage Matrix so individual scenarios and scenario-outline examples declare their primary source, covered input class, interface, polarity, and rationale. Task generation plans updates, implementation records Red/Green evidence, and analysis reports missing, stale, under-covered, duplicated, or dangling traceability data as blocking governance issues. See the [traceability template](templates/test-traceability-template.md) for its normalized structure.

### Professional Test Reports

The preset keeps the minimum professional reporting set explicit while avoiding duplicated documents:

| Report                            | Feature Artifact                                         |
| --------------------------------- | -------------------------------------------------------- |
| Test Plan                         | `plan.md`                                                |
| Test Inventory / Test Case Report | `specs/<feature>/test-traceability.md`                   |
| Requirements Traceability Matrix  | `specs/<feature>/test-traceability.md`                   |
| Test Execution Report             | `specs/<feature>/test-traceability.md` plus CI artifacts |
| Defect Report                     | `specs/<feature>/defect-log.md`                          |
| Test Summary Report               | `specs/<feature>/test-summary.md`                        |

`defect-log.md` records defects, unexpected failures, severity/priority, release impact, risk acceptance, and verification closure. `test-summary.md` records execution totals, coverage and traceability status, defect summary, risks/exceptions, evidence links, approvals when applicable, and the Go/No-Go recommendation. CI artifacts and tool-generated outputs remain raw evidence referenced by these reports unless audit, regulatory, customer, or tool-integration needs require additional standalone reports.

At project or release level, the preset creates only one aggregate report by default:

```text
reports/test-summary.md
```

For versioned releases, use:

```text
reports/releases/<release-id>/test-summary.md
```

The overall test summary aggregates feature summaries, feature traceability reports, feature defect logs, and CI artifacts. It does not duplicate overall test-plan, inventory, traceability, execution, or defect reports unless audit, regulatory, customer, or tool-integration requirements explicitly call for them.

Users control the aggregate report location with an Overall Test Summary Destination decision in `plan.md` or the `/speckit.converge` request:

| Mode      | Release ID     | Output Path                                     |
| --------- | -------------- | ----------------------------------------------- |
| `rolling` | `N/A`          | `reports/test-summary.md`                       |
| `release` | `<release-id>` | `reports/releases/<release-id>/test-summary.md` |

If no release ID is provided, convergence defaults to `rolling` and writes `reports/test-summary.md`. If a release ID is provided for versioned evidence, convergence writes `reports/releases/<release-id>/test-summary.md`.

### Identifier and Gherkin Rules

- Reuse core Spec Kit identifiers: `User Story 1`, `US1`, `[US1]`, `FR-001`, `SC-001`, and `T###`.
- Add `EC-001` only when an edge case needs a stable traceability identifier.
- Use owning-suite test and scenario IDs such as `TDD-US1-001`, `BDD-US1-001`, and `ATDD-US1-001`.
- Reuse source IDs as Gherkin tags, for example `@BDD @US1 @FR-001`.
- Place each unique scenario ID, such as `@BDD-US1-001`, immediately above its `Scenario` or `Scenario Outline`.

Published identifiers are stable: never renumber or reuse them when artifacts move or requirements change. Reusable suite, story, requirement, success-criterion, and edge-case tags may be placed above `Feature` and inherited by its scenarios.

## Quality Gates and Enforcement Boundary

Every project declares gate applicability, commands, thresholds, blocking behavior, and evidence retention during planning. Coverage is mandatory for changed production code; 90% line and 85% branch coverage are recommended starting guardrails rather than universal constants. Lower thresholds require a documented, approved exception and compensating evidence.

Runtime smoke, security, and tool-specific static-analysis gates are required when applicable to the stack and risk surface. A gate may be `N/A` only with a concrete technical rationale. Red-state and final results should normally be retained as reproducible CI output or CI artifacts rather than committed per-story reports.

The preset cannot prevent contributors from bypassing the workflow. For mechanical enforcement, configure the selected test and quality-gate commands as required CI checks and, where available, protect the target branch against failing or missing checks.

## Local Preset Development

From this repository root:

```bash
specify preset add --dev . --priority 5
specify preset resolve spec-template
specify preset resolve tasks-template
specify preset info test-first-governance
```

## License

This preset is available under the [MIT License](LICENSE).
