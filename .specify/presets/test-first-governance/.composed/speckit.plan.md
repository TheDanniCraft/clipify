---
description: Execute the implementation planning workflow using the plan template
  to generate design artifacts.
handoffs:
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
scripts:
  sh: scripts/bash/setup-plan.sh --json
  ps: scripts/powershell/setup-plan.ps1 -Json
  py: scripts/python/setup_plan.py --json
---

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

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before planning)**:

- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_plan` key
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. **Setup**: Run `{SCRIPT}` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, FEATURE_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Re-evaluate Constitution Check post-design

## Mandatory Post-Execution Hooks

**You MUST complete this section before reporting completion to the user.**

Check if `.specify/extensions.yml` exists in the project root.

- If it does not exist, or no hooks are registered under `hooks.after_plan`, skip to the Completion Report.
- If it exists, read it and look for entries under the `hooks.after_plan` key.
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue to the Completion Report.
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Mandatory hook** (`optional: false`) — **You MUST emit `EXECUTE_COMMAND:` for each mandatory hook**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## Completion Report

Command ends after Phase 1 design. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Define interface contracts** (if project has external interfaces) → `/contracts/`:
   - Identify what interfaces the project exposes to users or other systems
   - Document the contract format appropriate for the project type
   - Examples: public APIs for libraries, command schemas for CLI tools, endpoints for web services, grammars for parsers, UI contracts for applications
   - Skip if project is purely internal (build scripts, one-off tools, etc.)

3. **Create quickstart validation guide** → `quickstart.md`:
   - Document runnable validation scenarios that prove the feature works end-to-end
   - Include prerequisites, setup commands, test/run commands, and expected outcomes
   - Use links or references to contracts and data model details instead of duplicating them
   - Do not include full implementation code, model/service/controller bodies, migrations, or complete test suites
   - Keep this artifact as a validation/run guide; implementation details belong in `tasks.md` and the implementation phase

**Output**: data-model.md, /contracts/*, quickstart.md

## Key rules

- Use absolute paths for filesystem operations; use project-relative paths for references in documentation
- ERROR on gate failures or unresolved clarifications

## Done When

- [ ] Plan workflow executed and design artifacts generated
- [ ] Extension hooks dispatched or skipped according to the rules in Mandatory Post-Execution Hooks above
- [ ] Completion reported to user with branch, plan path, and generated artifacts

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
