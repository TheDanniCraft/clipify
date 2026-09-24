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

{CORE_TEMPLATE}

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
