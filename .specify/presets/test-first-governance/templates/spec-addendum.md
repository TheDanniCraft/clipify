---

## Test-First Specification Addendum _(mandatory)_

### Test Classification and Applicability Matrix

For every User Story, Functional Requirement, Success Criterion requiring buildable work, Edge Case, and Error Condition, define the required test coverage before planning.

| Source ID | Source Type            | Description            | TDD      | BDD            | ATDD           | Test Intent / N/A Rationale                                  |
| --------- | ---------------------- | ---------------------- | -------- | -------------- | -------------- | ------------------------------------------------------------ |
| US1       | User Story             | [story summary]        | Required | [Required/N/A] | [Required/N/A] | [evidence intent or concrete N/A rationale]                  |
| FR-001    | Functional Requirement | [requirement summary]  | Required | [Required/N/A] | [Required/N/A] | [what proves it works or why a practice does not apply]      |
| EC-001    | Edge Case              | [edge/error condition] | Required | [Required/N/A] | [Required/N/A] | [what proves safe handling or why a practice does not apply] |

Rules:

- Reuse core story identifiers such as `US1`; do not introduce a parallel alias.
- Each executable test artifact MUST declare exactly one owning suite: `TDD`, `BDD`, or `ATDD`.
- Required evidence MAY name multiple practices, and one artifact MAY support multiple evidence roles or source IDs.
- A `Required` BDD or ATDD decision MUST map to coverage-complete scenario evidence for that role, but it does not require a separately owned artifact.
- One scenario MAY satisfy both BDD and ATDD only when it fully covers both intents and the traceability artifact records why the behavior example and stakeholder acceptance boundary are equivalent.
- Do not create equivalent copies of an artifact solely to place it in more than one suite.
- TDD is required for production logic.
- BDD is required for user-visible behavior, business rules, alternate flows, and observable error behavior.
- ATDD is required for stakeholder-facing acceptance criteria and release boundaries.
- BDD or ATDD MAY be `N/A` only for technical-only work lacking the corresponding behavior or acceptance boundary. Every `N/A` MUST state a concrete rationale and alternative TDD or quality-gate evidence.
- Required BDD and ATDD entries MUST use Gherkin syntax and MUST have stable scenario IDs.
- TDD entries MUST cover happy paths, boundary values, invalid inputs, state transitions, integration contracts, and expected error sources.
- TDD entries MUST be coverage-complete for the implementation-level behavior. Do not limit the inventory to one happy-path test and one negative-path test when additional cases are needed.
- At least one negative-path test MUST exist for every requirement with validation, permissions, input parsing, persistence, external I/O, concurrency, or failure modes.

### Scenario Granularity Rules

BDD coverage MUST include:

- at least one scenario or scenario-outline example for each user-visible functional requirement;
- at least one positive behavior example for each supported user-facing option or equivalence class;
- at least one separate negative-path scenario or example for each edge/error condition;
- separate scenarios when the observable behavior, trigger, interface, expected result, or error message differs materially.

ATDD coverage MUST include:

- at least one stakeholder-facing scenario for each success criterion requiring buildable work;
- at least one end-to-end acceptance scenario per user story marked ATDD `Required`;
- full or justified pairwise coverage for required combinations of externally visible options;
- explicit benchmark, persistence, recovery, and release-boundary evidence when those appear in success criteria.

Scenario outlines MUST enumerate all required examples unless the spec records an approved sampling strategy such as pairwise coverage, boundary-value coverage, or risk-based representative coverage. Do not collapse materially different requirements, edge cases, input classes, output types, interfaces, or acceptance boundaries into one umbrella scenario solely to reduce scenario count.

### ATDD Acceptance Evidence _(Gherkin, mandatory when ATDD is Required)_

Create an ATDD-owned stakeholder-facing scenario under `tests/atdd/features/` when distinct acceptance evidence is needed. A scenario owned by BDD MAY instead satisfy the ATDD role when it fully proves the same stakeholder-facing outcome and traceability records both roles.

```gherkin
@ATDD @US1 @FR-001 @SC-001
Feature: [Feature capability]
  @ATDD-US1-001
  Scenario: [Stakeholder-visible acceptance outcome]
    Given [initial business state]
    When [stakeholder action or system trigger]
    Then [observable acceptance result]
    And [measurable success or invariant]
```

### BDD Behavior Evidence _(Gherkin, mandatory when BDD is Required)_

Create a BDD-owned behavior example under `tests/bdd/features/` when distinct behavior evidence is needed. A scenario owned by ATDD MAY instead satisfy the BDD role when it fully proves the same user-visible behavior or business rule and traceability records both roles.

```gherkin
@BDD @US1 @FR-001
Feature: [User behavior or business rule]
  @BDD-US1-001
  Scenario: [Concrete behavior example]
    Given [context]
    When [behavior occurs]
    Then [expected behavior]
```

### TDD Test Inventory _(mandatory)_

Define the implementation-level tests required before code is written.

| Test ID     | Source ID(s) | Test Level        | Path                             | Intent                | Expected Initial Failure                     |
| ----------- | ------------ | ----------------- | -------------------------------- | --------------------- | -------------------------------------------- |
| TDD-US1-001 | FR-001, US1  | Unit              | tests/tdd/unit/test_[name].[ext] | [what it verifies]    | [missing implementation / failing assertion] |
| TDD-US1-002 | EC-001       | Negative/Boundary | tests/tdd/unit/test_[name].[ext] | [edge/error handling] | [missing validation / wrong error]           |

Add one row per required implementation-level behavior, boundary, invalid input, state transition, integration contract, expected error source, or edge/error case. The two rows above are examples only; the required count is determined by coverage, not by a preset minimum.

### Scenario Coverage Matrix _(mandatory for BDD/ATDD Required decisions)_

Define scenario-level or scenario-outline-example-level coverage before planning.

| Scenario / Example ID    | Owning Suite | Evidence Role(s) | Primary Source ID | Covered Inputs / Classes    | Positive / Negative / Boundary | Interface             | Rationale                      |
| ------------------------ | ------------ | ---------------- | ----------------- | --------------------------- | ------------------------------ | --------------------- | ------------------------------ |
| BDD-US1-001:example-001  | BDD          | BDD              | FR-001            | [supported option/class]    | Positive                       | [CLI/API/UI]          | [why this example is required] |
| ATDD-US1-001:example-001 | ATDD         | ATDD             | SC-001            | [acceptance workflow/class] | Positive                       | [end-to-end boundary] | [why this proves acceptance]   |

Rules:

- A scenario MAY tag multiple related source IDs, but each matrix row MUST declare one primary source ID.
- A scenario outline MUST list the required example rows or an approved sampling strategy.
- Every edge/error condition MUST have its own row or its own scenario-outline example.
- Broad umbrella scenarios cannot be the only evidence for multiple unrelated FRs, SCs, or ECs.
- Shared BDD/ATDD evidence MUST include an explicit equivalence rationale in the Rationale column.

### Specification Traceability Inputs

Before specification is considered complete:

- Every `FR-###` MUST have at least one `TDD`, `BDD`, or `ATDD` test mapping.
- Every `Required` TDD source has enough planned inventory rows to cover its implementation-level behavior, not just a generic minimum.
- Every user story MUST record a `Required` or justified `N/A` decision for BDD and ATDD.
- Every `Required` decision MUST map to at least one scenario carrying the corresponding evidence role; the scenario MAY be owned by another suite.
- Every `Required` BDD/ATDD decision MUST have scenario coverage matrix rows proving the required behavior, acceptance, example, edge-case, and sampling coverage.
- Every Gherkin scenario MUST have suite, user story, and requirement tags directly or by feature-level inheritance.
- Every scenario-specific ID tag MUST appear immediately above exactly one `Scenario` or `Scenario Outline`, never at feature level.
- All expected error sources, edge cases, and boundary conditions MUST have planned evidence.
- Every executable artifact MUST have one owning suite, with all additional evidence roles represented through traceability rather than duplicated tests.
