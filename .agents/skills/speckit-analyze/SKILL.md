---
name: speckit-analyze
description: Perform a non-destructive cross-artifact consistency and quality analysis
  across spec.md, plan.md, and tasks.md after task generation.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: preset:test-first-governance
---

# Speckit Analyze Skill

# Test-First Analysis Wrapper

Apply these checks in addition to the core cross-artifact analysis.

## Additional Critical Findings

Report a CRITICAL issue if any of the following are true:

- `specs/<feature>/test-traceability.md` is missing, lacks any required normalized section, still contains unresolved required placeholders, or is stale relative to spec.md, plan.md, tasks.md, or execution evidence.
- `specs/<feature>/defect-log.md` is missing, lacks required defect summary/detail/triage/verification sections, or is stale relative to unexpected failures, blocked gates, accepted risks, or verification evidence.
- `specs/<feature>/test-summary.md` is missing, lacks required execution/coverage/defect/risk/evidence/recommendation sections, or is stale relative to traceability, defect log, CI evidence, or gate results.
- For project/release convergence, `reports/test-summary.md` or `reports/releases/<release-id>/test-summary.md` is missing, lacks aggregate feature/execution/coverage/defect/risk/evidence/recommendation sections, or is stale relative to included feature summaries or CI artifacts.
- Within the traceability artifact, artifact commands, statuses, or evidence paths are copied into Source Coverage Map rows instead of being stored once in the Evidence Artifact Registry.
- A source or applicability row references an artifact ID missing from the registry, or an executable artifact has more than one registry entry.
- The Scenario Coverage Matrix is missing, incomplete, or lacks scenario/example rows for required BDD/ATDD evidence.
- A Scenario Coverage Matrix row lacks a primary source ID, covered input/class, evidence polarity, interface, or rationale.
- A scenario outline omits required examples and does not record an approved sampling strategy.
- A broad umbrella scenario is the only evidence for multiple unrelated FRs, SCs, ECs, input classes, externally visible option combinations, interfaces, outcomes, or error messages.
- A required quality gate lacks exactly one current entry in Quality Gate Results.
- Any story heading, source reference, or task label violates Spec Kit's `User Story 1` / `US1` / `[US1]` convention.
- A parallel alias such as `US-001` is introduced for a core `US1` story.
- Any necessary preset-specific test, scenario, Gherkin tag, or binding ID is inconsistent with its core source ID.
- Any published identifier is renumbered or reused for a different artifact.
- Any executable product-test artifact does not have exactly one owning suite (`TDD`, `BDD`, or `ATDD`).
- Equivalent tests, scenarios, bindings, or fixtures are duplicated solely to satisfy multiple practice labels.
- Any user story lacks an explicit `Required` or `N/A` decision for BDD or ATDD.
- Any `Required` BDD or ATDD decision lacks Gherkin scenario evidence mapped to that role, regardless of owning suite.
- Separate scenarios, bindings, tasks, commands, or reports exist only because both BDD and ATDD are `Required`, although one artifact fully covers both intents and records an equivalence rationale.
- Shared BDD/ATDD evidence lacks an explicit rationale explaining why the behavior example and stakeholder acceptance boundary are equivalent.
- Any BDD or ATDD `N/A` lacks a concrete rationale and alternative evidence, or conflicts with observable behavior or a stakeholder acceptance boundary.
- Any BDD or ATDD Gherkin scenario lacks stable tags for suite, user story, and requirement/success/edge-case ID.
- Any scenario-specific ID tag is placed at feature level, inherited by multiple scenarios, or attached to more than one `Scenario` or `Scenario Outline`.
- Any Gherkin scenario lacks an executable test binding or planned binding task.
- Any implementation task appears before required test tasks for the same story.
- Any FR/SC/EC has zero mapped test artifacts.
- Any source marked `TDD` required lacks coverage-complete implementation-level test inventory or task coverage for its behavior, boundaries, invalid inputs, state transitions, integration contracts, expected error sources, or edge/error cases.
- Any FR/SC/EC has mapped artifacts but lacks scenario/example coverage required by its BDD or ATDD applicability decision.
- Coverage lacks approved thresholds or permits regression below the accepted baseline.
- Any quality gate lacks a command or a justified `N/A`, blocking behavior, or an evidence-retention destination.
- Any threshold exception lacks scope, rationale, compensating evidence, approval, or expiry/follow-up.
- Per-story generated reports are required without an audit or regulatory retention rationale.
- Any unexpected test or gate failure lacks a defect entry or explicit non-defect rationale.
- Any open Critical or High defect lacks a verified fix, rejection rationale, or approved risk acceptance.
- The test summary recommends `Go` while required evidence is missing, failed, blocked, stale, or contradicted by unaccepted Critical/High defects.
- The overall test summary recommends `Go` while any included feature summary, required gate, CI artifact, or unaccepted Critical/High defect contradicts the recommendation.
- The overall test summary output path does not match the declared destination mode and release ID, or the destination decision is missing during convergence.
- Overall Test Plan, Test Inventory, Requirements Traceability Matrix, Test Execution, or Defect reports are duplicated at project/release level without an explicit audit, regulatory, customer, or tool-integration requirement.
- Defect counts, exception counts, execution totals, or release-impact decisions differ between `defect-log.md`, `test-summary.md`, and `test-traceability.md`.
- Test directories do not make TDD/BDD/ATDD ownership clear.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before analysis)**:

- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_analyze` key
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `$speckit-git-commit`.
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

    Wait for the result of the hook command before proceeding to the Goal.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Goal

Identify inconsistencies, duplications, ambiguities, and underspecified items across the three core artifacts (`spec.md`, `plan.md`, `tasks.md`) before implementation. This command MUST run only after `$speckit-tasks` has successfully produced a complete `tasks.md`.

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report. Offer an optional remediation plan (user must explicitly approve before any follow-up editing commands would be invoked manually).

**Constitution Authority**: The project constitution (`.specify/memory/constitution.md`) is **non-negotiable** within this analysis scope. Constitution conflicts are automatically CRITICAL and require adjustment of the spec, plan, or tasks—not dilution, reinterpretation, or silent ignoring of the principle. If a principle itself needs to change, that must occur in a separate, explicit constitution update outside `$speckit-analyze`.

## Execution Steps

### 1. Initialize Analysis Context

Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` once from repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS. Derive absolute paths:

- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md

Abort with an error message if any required file is missing (instruct the user to run missing prerequisite command).
For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

### 2. Load Artifacts (Progressive Disclosure)

Load only the minimal necessary context from each artifact:

**From spec.md:**

- Overview/Context
- Functional Requirements
- Success Criteria (measurable outcomes — e.g., performance, security, availability, user success, business impact)
- User Stories
- Edge Cases (if present)

**From plan.md:**

- Architecture/stack choices
- Data Model references
- Phases
- Technical constraints

**From tasks.md:**

- Task IDs
- Descriptions
- Phase grouping
- Parallel markers [P]
- Referenced file paths

**From constitution:**

- Load `.specify/memory/constitution.md` for principle validation

### 3. Build Semantic Models

Create internal representations (do not include raw artifacts in output):

- **Requirements inventory**: For each Functional Requirement (FR-###) and Success Criterion (SC-###), record a stable key. Use the explicit FR-/SC- identifier as the primary key when present, and optionally also derive an imperative-phrase slug for readability (e.g., "User can upload file" → `user-can-upload-file`). Include only Success Criteria items that require buildable work (e.g., load-testing infrastructure, security audit tooling), and exclude post-launch outcome metrics and business KPIs (e.g., "Reduce support tickets by 50%").
- **User story/action inventory**: Discrete user actions with acceptance criteria
- **Task coverage mapping**: Map each task to one or more requirements or stories (inference by keyword / explicit reference patterns like IDs or key phrases)
- **Constitution rule set**: Extract principle names and MUST/SHOULD normative statements

### 4. Detection Passes (Token-Efficient Analysis)

Focus on high-signal findings. Limit to 50 findings total; aggregate remainder in overflow summary.

#### A. Duplication Detection

- Identify near-duplicate requirements
- Mark lower-quality phrasing for consolidation

#### B. Ambiguity Detection

- Flag vague adjectives (fast, scalable, secure, intuitive, robust) lacking measurable criteria
- Flag unresolved placeholders (TODO, TKTK, ???, `<placeholder>`, etc.)

#### C. Underspecification

- Requirements with verbs but missing object or measurable outcome
- User stories missing acceptance criteria alignment
- Tasks referencing files or components not defined in spec/plan

#### D. Constitution Alignment

- Any requirement or plan element conflicting with a MUST principle
- Missing mandated sections or quality gates from constitution

#### E. Coverage Gaps

- Requirements with zero associated tasks
- Tasks with no mapped requirement/story
- Success Criteria requiring buildable work (performance, security, availability) not reflected in tasks

#### F. Inconsistency

- Terminology drift (same concept named differently across files)
- Data entities referenced in plan but absent in spec (or vice versa)
- Task ordering contradictions (e.g., integration tasks before foundational setup tasks without dependency note)
- Conflicting requirements (e.g., one requires Next.js while other specifies Vue)

### 5. Severity Assignment

Use this heuristic to prioritize findings:

- **CRITICAL**: Violates constitution MUST, missing core spec artifact, or requirement with zero coverage that blocks baseline functionality
- **HIGH**: Duplicate or conflicting requirement, ambiguous security/performance attribute, untestable acceptance criterion
- **MEDIUM**: Terminology drift, missing non-functional task coverage, underspecified edge case
- **LOW**: Style/wording improvements, minor redundancy not affecting execution order

### 6. Produce Compact Analysis Report

Output a Markdown report (no file writes) with the following structure:

## Specification Analysis Report

| ID  | Category    | Severity | Location(s)      | Summary                      | Recommendation                       |
| --- | ----------- | -------- | ---------------- | ---------------------------- | ------------------------------------ |
| A1  | Duplication | HIGH     | spec.md:L120-134 | Two similar requirements ... | Merge phrasing; keep clearer version |

(Add one row per finding; generate stable IDs prefixed by category initial.)

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
| --------------- | --------- | -------- | ----- |

**Constitution Alignment Issues:** (if any)

**Unmapped Tasks:** (if any)

**Metrics:**

- Total Requirements
- Total Tasks
- Coverage % (requirements with >=1 task)
- Ambiguity Count
- Duplication Count
- Critical Issues Count

### 7. Provide Next Actions

At end of report, output a concise Next Actions block:

- If CRITICAL issues exist: Recommend resolving before `$speckit-implement`
- If only LOW/MEDIUM: User may proceed, but provide improvement suggestions
- Provide explicit command suggestions: e.g., "Run $speckit-specify with refinement", "Run $speckit-plan to adjust architecture", "Manually edit tasks.md to add coverage for 'performance-metrics'"

### 8. Offer Remediation

Ask the user: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply them automatically.)

### 9. Check for extension hooks

After reporting, check if `.specify/extensions.yml` exists in the project root.

- If it exists, read it and look for entries under the `hooks.after_analyze` key
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `$speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Operating Principles

### Context Efficiency

- **Minimal high-signal tokens**: Focus on actionable findings, not exhaustive documentation
- **Progressive disclosure**: Load artifacts incrementally; don't dump all content into analysis
- **Token-efficient output**: Limit findings table to 50 rows; summarize overflow
- **Deterministic results**: Rerunning without changes should produce consistent IDs and counts

### Analysis Guidelines

- **NEVER modify files** (this is read-only analysis)
- **NEVER hallucinate missing sections** (if absent, report them accurately)
- **Prioritize constitution violations** (these are always CRITICAL)
- **Use examples over exhaustive rules** (cite specific instances, not generic patterns)
- **Report zero issues gracefully** (emit success report with coverage statistics)

## Context

$ARGUMENTS

## Additional Output Tables

Add these tables to the report:

### Test Evidence Coverage Summary

| Artifact ID  | Owning Suite | Evidence Roles | Status   | Evidence | Blocking Gaps |
| ------------ | ------------ | -------------- | -------- | -------- | ------------- |
| TDD-US1-001  | TDD          | TDD            | [status] | [path]   | [gaps]        |
| ATDD-US1-001 | ATDD         | ATDD, BDD      | [status] | [path]   | [gaps]        |

### Quality Gate Decisions

| Gate            | Applicability  | Threshold/Policy         | Evidence Destination | Exception      | Gap?     |
| --------------- | -------------- | ------------------------ | -------------------- | -------------- | -------- |
| Coverage        | Required       | [line/branch + baseline] | [location]           | [none/details] | [yes/no] |
| Static Analysis | [Required/N/A] | [severity policy]        | [location]           | [none/details] | [yes/no] |
| Security        | [Required/N/A] | [severity policy]        | [location]           | [none/details] | [yes/no] |
| Runtime Smoke   | [Required/N/A] | [pass policy]            | [location]           | [none/details] | [yes/no] |

### Source Coverage Summary

| Source ID | Source Type            | Artifact IDs | Coverage Intent | Gap?     |
| --------- | ---------------------- | ------------ | --------------- | -------- |
| FR-001    | Functional Requirement | [ids]        | [intent]        | [yes/no] |

### TDD Inventory Coverage Summary

| Source ID | Required TDD Behavior / Case                    | TDD Artifact ID(s) | Coverage Complete? | Gap?     |
| --------- | ----------------------------------------------- | ------------------ | ------------------ | -------- |
| FR-001    | [behavior, boundary, contract, or error source] | TDD-US1-001        | [yes/no]           | [yes/no] |

### Scenario Coverage Matrix Summary

| Scenario / Example ID    | Primary Source ID | Evidence Roles | Covered Inputs / Classes | Interface   | Sampling / Sharing Rationale | Gap?     |
| ------------------------ | ----------------- | -------------- | ------------------------ | ----------- | ---------------------------- | -------- |
| ATDD-US1-001:example-001 | FR-001            | ATDD, BDD      | [classes]                | [interface] | [rationale]                  | [yes/no] |

### Defect Report Summary

| Defect ID   | Severity   | Priority   | Status   | Release Impact | Evidence / Verification | Gap?     |
| ----------- | ---------- | ---------- | -------- | -------------- | ----------------------- | -------- |
| DEF-US1-001 | [severity] | [priority] | [status] | [impact]       | [links]                 | [yes/no] |

### Test Summary Report Check

| Report Area               | Status                         | Evidence    | Gap?     |
| ------------------------- | ------------------------------ | ----------- | -------- |
| Execution totals          | [current/stale/missing]        | [links]     | [yes/no] |
| Coverage and traceability | [current/stale/missing]        | [links]     | [yes/no] |
| Defect and risk summary   | [current/stale/missing]        | [links]     | [yes/no] |
| Release recommendation    | [Go/No-Go/Conditional/invalid] | [rationale] | [yes/no] |

### Overall Test Summary Check

| Report Area                                   | Status                         | Evidence                   | Gap?     |
| --------------------------------------------- | ------------------------------ | -------------------------- | -------- |
| Included feature report links                 | [current/stale/missing]        | [links]                    | [yes/no] |
| Aggregate execution totals                    | [current/stale/missing]        | [CI/features]              | [yes/no] |
| Aggregate coverage, gates, defects, and risks | [current/stale/missing]        | [CI/features]              | [yes/no] |
| Duplicate overall report types avoided        | [yes/no]                       | [rationale]                | [yes/no] |
| Destination decision                          | [rolling/release/missing]      | [output path + release ID] | [yes/no] |
| Project/release recommendation                | [Go/No-Go/Conditional/invalid] | [rationale]                | [yes/no] |
