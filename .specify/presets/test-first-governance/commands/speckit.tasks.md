# Test-First Tasks Wrapper

Apply these requirements in addition to the core task-generation workflow.

## Critical Override: Tests Are Not Optional

If the core command or template says tests are optional, replace that rule with this preset rule: tests are mandatory. Generate coverage-complete TDD tasks for production logic, covering every required TDD inventory item rather than a minimum count. Generate coverage-complete, non-duplicative scenario tasks needed to cover all `Required` ATDD and BDD evidence roles; preserve justified `N/A` decisions and report missing or contradictory rationales as blocking gaps.

## Mandatory Incremental Task Ordering

For each user story:

1. Create a coverage-complete, non-duplicative set of scenario specifications covering all required ATDD acceptance and BDD behavior evidence roles before production implementation begins.
2. Add a `[GATE]` task that records artifact definitions in the Evidence Artifact Registry, source relationships in the Source Coverage Map, and scenario/example rows in the Scenario Coverage Matrix, and confirms `defect-log.md` and `test-summary.md` are initialized.
3. Divide implementation into the smallest meaningful behavior slices that can be independently verified.
4. For each slice, generate one ordered Red-Green-Refactor cycle:
   1. `[ATDD]`, `[BDD]`, and/or `[TDD]` tasks add only the executable bindings and tests needed for that slice.
   2. Suite execution tasks prove the new evidence fails for the intended missing behavior and update its registry status to `Red`.
   3. Production implementation tasks make the smallest change needed to pass that evidence.
   4. Suite execution tasks confirm the slice is `Green` and update its registry evidence.
   5. Refactor tasks improve the design and rerun the relevant evidence while it remains green.
5. Repeat the cycle for the next slice. Do not accumulate every failing test for the story before beginning production implementation.
6. After all slices are green, add `[GATE]` validation tasks for the full test suite, coverage, linting, formatting, and every gate marked `Required`.
7. Finish with `[GATE]` tasks that record final artifact results in the registry, gate results in Quality Gate Results, update `defect-log.md` for open/verified/deferred defects, update `test-summary.md` with execution totals, risks, evidence links, and recommendation, and perform the story-level report review.

## Core-Compatible Suite Markers

Preserve the core task format and place the suite marker as the first token of the description for test and gate tasks:

```text
- [ ] T### [P?] [US#?] [TDD|BDD|ATDD|GATE] Description with exact file path
```

`[TDD]`, `[BDD]`, `[ATDD]`, and `[GATE]` do not replace or alter core `T###`, `[P]`, or `[US1]` identifiers. `[GATE]` is allowed only for non-product validation tasks and MUST state the protected suite or evidence destination.

The label identifies primary suite ownership. If an artifact supports multiple evidence roles, create one task under its owning-suite label, record the roles in its registry entry, and reference the artifact ID from each covered source. Do not generate equivalent tasks or artifacts solely to satisfy multiple labels.

If an artifact supports both BDD and ATDD roles, also record why the behavior example and stakeholder acceptance boundary are equivalent. Create distinct scenario tasks when requirements, success criteria, edge/error conditions, input classes, externally visible option combinations, interfaces, outcomes, or error messages differ materially.

Preserve core Spec Kit story labels such as `[US1]`, `[US2]`, and `[US3]`. Use the same story identifier in suite-owned artifact IDs such as `TDD-US1-001`, `BDD-US1-001`, and `ATDD-US1-001`. Do not introduce a parallel `US-001` alias.

## Required Per-Story Coverage

Each user story MUST include complete planned coverage for:

- scenario tasks covering every `Required` BDD and ATDD evidence role with matrix rows for required examples and edge/error cases; one owning-suite task MAY cover both roles only with an explicit equivalence rationale;
- `[TDD]` tasks for every required TDD inventory item, including happy paths, boundaries, invalid inputs, state transitions, integration contracts, expected error sources, and every edge/error case that requires implementation-level evidence;
- a red-state run before the production change for each behavior slice, with evidence retained in task/PR/CI output or an audit-required report;
- a green-state run immediately after the corresponding minimal production change;
- a `[GATE]` task updating the traceability registry and coverage map before implementation and registry/gate results after execution;
- `[GATE]` report tasks keeping `defect-log.md` and `test-summary.md` current with defects, execution evidence, risks, exceptions, and the release recommendation.

{CORE_TEMPLATE}

## Additional Completion Report Fields

Include in the task generation completion report:

- Count of `[TDD]`, `[BDD]`, `[ATDD]`, and `[GATE]` tasks
- Confirmation that `[TDD]` tasks cover every required TDD inventory item rather than only a happy-path/error-path minimum
- Confirmation that no implementation task precedes its required tests
- List of Gherkin feature files, their owning suites, and their BDD/ATDD evidence roles
- List of scenario coverage matrix rows or row counts by source ID, including any approved sampling strategies
- List of BDD/ATDD `N/A` decisions with rationale and alternative evidence
- List of gate applicability decisions, commands, thresholds, and evidence destinations
- Confirmation that traceability creation and update tasks use `specs/<feature>/test-traceability.md`
- Confirmation that report creation and update tasks use `specs/<feature>/defect-log.md` and `specs/<feature>/test-summary.md`
- Confirmation that task-story labels and suite-owned artifact IDs reuse the same core story identifier
