# Clipify Constitution

## Core Principles

### I. Test-First Delivery (NON-NEGOTIABLE)

Every production behavior change MUST begin with an executable test that is observed failing for
the intended reason. Implementation MUST then make the smallest change needed to pass, followed by
refactoring while the relevant suites remain green. Tests MUST NOT be weakened, skipped, deleted,
or filtered merely to obtain a passing result. When specification, test, and implementation
disagree, the approved specification determines which artifact must change.

Rationale: a recorded Red -> Green -> Refactor cycle provides stronger evidence than tests added
after implementation and prevents false confidence from tests that never exercised the defect.

### II. User Behavior Is Executable Evidence

User-visible behavior and business rules MUST be specified through BDD when applicable.
Stakeholder-facing acceptance criteria and release boundaries MUST be specified through ATDD when
applicable. Those scenarios MUST exercise the highest verified real entry point. Technical-only
work MAY mark BDD or ATDD `N/A` only with a concrete rationale and alternative executable evidence.

Rationale: unit correctness does not prove that the composed application behaves as users and
stakeholders expect.

### III. Tests Are Deterministic and Isolated

Tests MUST NOT depend on production credentials, interactive secret access, shared databases, or
mutable production state. Network, clock, process, filesystem, browser, and database boundaries
MUST be controlled through established project fixtures or isolated local services. Every test MUST
clean up the resources it owns.

Rationale: reproducible tests distinguish product failures from environment failures and remain
safe to execute locally and in CI.

### IV. Quality Evidence Is Traceable

Every requirement, acceptance criterion, governed edge case, test artifact, defect, and quality
gate MUST have a stable traceable relationship. Evidence MUST identify its owning suite, verified
command, current result, and retained report or artifact. Missing or contradictory traceability is
a blocking defect, not documentation polish.

Rationale: delivery decisions require evidence that can be followed from intent through execution
without duplicating or guessing records.

### V. Changes Stay Small and Reviewable

Each change MUST be scoped to one coherent behavior or infrastructure outcome. Implementations MUST
prefer the simplest design that satisfies the approved specification and verified tests. New
abstractions, dependencies, exceptions, and duplicated test artifacts require an explicit
rationale. Existing coverage thresholds and safety checks MUST NOT be weakened as a shortcut.

Rationale: small changes make failures diagnosable, reviews meaningful, and rollback safe.

## Engineering Constraints

- Bun is the repository package manager and command runner unless a documented runtime
  incompatibility requires the application process itself to use Node.js.
- Application Jest tests MUST reuse `jest.setup.ts`, the PGlite environment, and existing fixture
  builders where applicable. Browser acceptance tests MUST use the isolated Playwright environment.
- Production secrets and shared state MUST NOT be injected into tests or committed evidence.
- Security, privacy, consent, and legal-document behavior MUST receive risk-proportionate negative,
  boundary, and integration coverage.
- Property-based tests MUST be used for genuine invariants when they improve confidence; artificial
  demonstration properties are prohibited.
- Mutation testing is a separate capability gate. Until it is available, the highest-risk changes
  MUST use recorded deliberate-mutant spot checks where test strength needs additional proof.

## Development Workflow

1. Resolve the active feature specification and plan before implementation begins.
2. Derive coverage-complete TDD, BDD, and ATDD evidence obligations with stable identifiers.
3. Place every test task before its corresponding implementation task.
4. Execute one behavior at a time through Red -> Green -> Refactor and record the evidence.
5. Run the relevant fast file or scenario command during the inner loop.
6. Run complete affected suites, coverage, lint, formatting, type checking, browser acceptance, and
   other applicable gates before the slice is considered complete.
7. Update traceability, defects, and the feature test summary before a Go recommendation.
8. A failed mandatory gate blocks completion unless a scoped exception and compensating evidence
   are explicitly approved and recorded.

## Governance

This constitution governs feature specifications, implementation plans, task ordering,
implementation, review, and release-readiness decisions. Repository guidance and local practices
MUST conform to it.

Amendments require an explicit proposal, impact report, migration plan for affected active work,
and user approval. Semantic versioning applies to governance changes: MAJOR for incompatible
principle removals or redefinitions, MINOR for new principles or materially expanded obligations,
and PATCH for non-semantic clarification. Every review MUST verify constitution compliance, and any
approved exception MUST identify its scope, owner, expiry or follow-up, risk, and compensating
evidence.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25

---

## Test-First Governance Principles _(mandatory)_

### Principle TF-1: Tests Are Executable Requirements

All implementation work MUST be preceded by executable tests. TDD, BDD, and ATDD are complementary
development practices, not mutually exclusive test types. Every executable product-test artifact
MUST have exactly one owning suite (`TDD`, `BDD`, or `ATDD`) for directory, task, command, and report
routing. An artifact MAY provide evidence for multiple practices, requirements, or acceptance
criteria, and the traceability artifact MUST record those relationships. A `Required` practice
creates an evidence obligation, not a requirement for a separately owned artifact. Equivalent
tests MUST NOT be duplicated across suites merely to satisfy labels.

### Principle TF-2: ATDD Acceptance Before Implementation

Every stakeholder-facing acceptance criterion, release boundary, and externally observable success
criterion MUST map to Gherkin scenario evidence with the `ATDD` evidence role before implementation
starts. Each user story MUST mark ATDD as `Required` or `N/A`. `N/A` is allowed only for
technical-only work with no stakeholder-facing acceptance boundary and MUST include a concrete
rationale plus alternative TDD or quality-gate evidence.

### Principle TF-3: BDD Behavior Before Implementation

Every user-visible behavior, business rule, alternate flow, and observable error flow MUST map to
Gherkin scenario evidence with the `BDD` evidence role before implementation starts. Each user
story MUST mark BDD as `Required` or `N/A`. `N/A` is allowed only for technical-only work with no
observable behavior or business rule and MUST include a concrete rationale plus alternative TDD or
quality-gate evidence. Scenarios providing BDD evidence MUST be mirrored by executable step
definitions or equivalent test bindings.

One scenario MAY carry both `BDD` and `ATDD` evidence roles when it fully covers both intents. It
MUST retain one owning suite, and traceability MUST record both roles plus an explicit rationale
explaining why the behavior example and stakeholder acceptance boundary are equivalent. Separate
scenarios are required when behavior examples, acceptance evidence, interfaces, outcomes, or error
messages differ materially.

### Principle TF-4: TDD Red-Green-Refactor Discipline

Unit, component, integration, contract, property-based, and negative-path tests MUST be created
before the corresponding production code. Each implementation task MUST follow Red -> Green ->
Refactor: write failing tests, implement the smallest change that passes, then refactor while
keeping the full suite green.

### Principle TF-5: Gherkin-to-Test Mirroring

Identifiers defined by core Spec Kit MUST be reused: `User Story 1` / `US1` / `[US1]`, `FR-001`,
`SC-001`, and `T###`. This preset adds `EC-001` because core Edge Cases have no stable identifier,
and adds suite-owned executable IDs such as `TDD-US1-001`, `BDD-US1-001`, and `ATDD-US1-001`.
Identifiers are stable and MUST NOT be renumbered or reused after publication.

Every BDD and ATDD Gherkin scenario MUST have a stable scenario ID tag and an implemented executable
test or step binding using the same ID. Each scenario-specific ID tag MUST appear immediately above
exactly one `Scenario` or `Scenario Outline`; it MUST NOT be placed at feature level, where it would
be inherited by every scenario. The suite tag (`@BDD` or `@ATDD`) identifies the scenario's owning
suite; it does not prohibit the scenario from supporting additional evidence roles. Suite, core
user-story (`@US1`), and relevant requirement or success-criterion tags (`@FR-001`, `@SC-001`, or
`@EC-001`) MAY be placed at feature level and inherited by its scenarios.

BDD and ATDD scenario sets MUST be coverage-complete before implementation starts. Scenario
outlines MUST enumerate required examples or record an approved sampling strategy such as pairwise
coverage, boundary-value coverage, or risk-based representative coverage. Broad umbrella scenarios
MUST NOT be the only evidence for unrelated functional requirements, success criteria, or
edge/error conditions.

### Principle TF-6: Quality Gates Are Mandatory

The plan MUST declare applicability, commands, thresholds, blocking behavior, and evidence
retention for coverage, linting, formatting, static analysis/type checking, security validation,
and runtime smoke checks. Coverage is mandatory for changed production code. Other gates are
mandatory when applicable to the selected stack or risk surface; `N/A` requires a concrete
technical rationale. Threshold exceptions MUST be scoped, approved, and backed by compensating
evidence.

Quality gates are guards around TDD and every required BDD/ATDD suite, not substitutes for product
tests. Reproducible command output and CI artifacts are preferred over committed per-story reports
unless audit or regulatory requirements demand versioned evidence.

### Principle TF-7: Traceability Is Non-Negotiable

Every feature MUST maintain `specs/<feature>/test-traceability.md` as its canonical
requirement-to-test traceability artifact. It MUST separate the evidence artifact registry,
source-to-artifact coverage map, scenario coverage matrix, BDD/ATDD applicability decisions, and
quality-gate results. Commands, execution statuses, and evidence paths MUST be stored once in the
owning artifact or gate entry rather than copied into source mappings. Every Functional
Requirement, Success Criterion requiring buildable work, User Story, Edge Case, and externally
visible error condition MUST map to planned evidence before implementation and to execution
evidence before completion. Planning creates the artifact from the resolved
`test-traceability-template`; task generation and implementation keep it current. Missing, stale,
duplicated, under-covered, or dangling traceability data is a blocking issue.

### Principle TF-8: Professional Test Reports Are Complete

Every feature MUST maintain the minimum professional test report set without creating unnecessary
duplicate documents. The implementation plan acts as the Test Plan.
`specs/<feature>/test-traceability.md` acts as the combined Test Inventory, Requirements
Traceability Matrix, Test Execution evidence index, Scenario Coverage Matrix, and Quality Gate
Results report. `specs/<feature>/defect-log.md` acts as the Defect Report, including
severity/priority policy, triage, release impact, accepted risks, and verification closure.
`specs/<feature>/test-summary.md` acts as the Test Summary Report, including execution totals,
coverage and traceability status, defect summary, risks/exceptions, evidence links, approvals when
applicable, and Go/No-Go recommendation.

At project or release level, only one aggregate Test Summary Report is created by default. The
destination MUST be explicit: `rolling` mode writes `reports/test-summary.md`, while `release` mode
with a release ID writes `reports/releases/<release-id>/test-summary.md`. The aggregate summary
references feature reports and CI artifacts rather than duplicating overall test-plan, inventory,
traceability, execution, or defect reports. CI artifacts and tool-generated reports are raw
evidence referenced by these reports unless audit, regulatory, customer, or tool-integration needs
require additional standalone reports.
