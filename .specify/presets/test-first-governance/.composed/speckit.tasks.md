---
description: Generate an actionable, dependency-ordered tasks.md for the feature based
  on available design artifacts.
handoffs:
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: speckit.implement
    prompt: Start the implementation in phases
    send: true
scripts:
  sh: scripts/bash/setup-tasks.sh --json
  ps: scripts/powershell/setup-tasks.ps1 -Json
  py: scripts/python/setup_tasks.py --json
---

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

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before tasks generation)**:

- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_tasks` key
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

1. **Setup**: Run `{SCRIPT}` from repo root and parse FEATURE_DIR, TASKS_TEMPLATE_CONTENT, TASKS_TEMPLATE, and AVAILABLE_DOCS list. `FEATURE_DIR` and `TASKS_TEMPLATE` must be absolute paths when provided. `AVAILABLE_DOCS` is a list of document names/relative paths available under `FEATURE_DIR` (for example `research.md` or `contracts/`). For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (interface contracts), research.md (decisions), quickstart.md (test scenarios)
   - **IF EXISTS**: Load `/memory/constitution.md` for project principles and governance constraints
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map interface contracts to user stories
   - If research.md exists: Extract decisions for setup tasks
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)

4. **Generate tasks.md**: Use TASKS_TEMPLATE_CONTENT (from the JSON output above) as the structure. For compatibility with older setup scripts that omit TASKS_TEMPLATE_CONTENT, read TASKS_TEMPLATE instead. Fill with:
   - Correct feature name from plan.md
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
   - Each phase includes: story goal, independent test criteria, tests (if requested), implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Dependencies section showing story completion order
   - Parallel execution examples per story
   - Implementation strategy section (MVP first, incremental delivery)

## Mandatory Post-Execution Hooks

**You MUST complete this section before reporting completion to the user.**

Check if `.specify/extensions.yml` exists in the project root.

- If it does not exist, or no hooks are registered under `hooks.after_tasks`, skip to the Completion Report.
- If it exists, read it and look for entries under the `hooks.after_tasks` key.
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

Output path to generated tasks.md and summary:

- Total task count
- Task count per user story
- Parallel opportunities identified
- Independent test criteria for each story
- Suggested MVP scope (typically just User Story 1)
- Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, labels, file paths)

Context for task generation: {ARGS}

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**Tests are OPTIONAL**: Only generate test tasks if explicitly requested in the feature specification or if user requests TDD approach.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] marker**: Include ONLY if task is parallelizable (different files, no dependencies on incomplete tasks)
4. **[Story] label**: REQUIRED for user story phase tasks only
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label
   - User Story phases: MUST have story label
   - Polish phase: NO story label
5. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
- ✅ CORRECT: `- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- ✅ CORRECT: `- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ❌ WRONG: `- [ ] Create User model` (missing ID and Story label)
- ❌ WRONG: `T001 [US1] Create model` (missing checkbox)
- ❌ WRONG: `- [ ] [US1] Create User model` (missing Task ID)
- ❌ WRONG: `- [ ] T001 [US1] Create model` (missing file path)

### Task Organization

1. **From User Stories (spec.md)** - PRIMARY ORGANIZATION:
   - Each user story (P1, P2, P3...) gets its own phase
   - Map all related components to their story:
     - Models needed for that story
     - Services needed for that story
     - Interfaces/UI needed for that story
     - If tests requested: Tests specific to that story
   - Mark story dependencies (most stories should be independent)

2. **From Contracts**:
   - Map each interface contract → to the user story it serves
   - If tests requested: Each interface contract → contract test task [P] before implementation in that story's phase

3. **From Data Model**:
   - Map each entity to the user story(ies) that need it
   - If entity serves multiple stories: Put in earliest story or Setup phase
   - Relationships → service layer tasks in appropriate story phase
   - For each field with constraints in data-model.md (max length, nullable/required, enum values, validation rules), quote the constraint verbatim in the task description so it is not left to implementation-time discretion

4. **From Setup/Infrastructure**:
   - Shared infrastructure → Setup phase (Phase 1)
   - Foundational/blocking tasks → Foundational phase (Phase 2)
   - Story-specific setup → within that story's phase

### Phase Structure

- **Phase 1**: Setup (project initialization)
- **Phase 2**: Foundational (blocking prerequisites - MUST complete before user stories)
- **Phase 3+**: User Stories in priority order (P1, P2, P3...)
  - Within each story: Tests (if requested) → Models → Services → Endpoints → Integration
  - Each phase should be a complete, independently testable increment
- **Final Phase**: Polish & Cross-Cutting Concerns

## Done When

- [ ] tasks.md generated with all phases, task IDs, and file paths
- [ ] Extension hooks dispatched or skipped according to the rules in Mandatory Post-Execution Hooks above
- [ ] Completion reported to user with task count, story breakdown, and MVP scope

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
