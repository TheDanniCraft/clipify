# Test-First Specification Wrapper

Apply these requirements in addition to the core specification workflow.

## Critical Overrides

- Treat TDD evidence as mandatory for production logic.
- Every user story MUST mark BDD and ATDD as `Required` or `N/A`.
- Mark BDD `Required` for user-visible behavior, business rules, alternate flows, and observable errors.
- Mark ATDD `Required` for stakeholder-facing acceptance criteria and release boundaries.
- Every user-visible behavior, alternate flow, business rule, and error flow MUST map to coverage-complete Gherkin scenario evidence carrying the BDD role.
- Permit `N/A` only for technical-only work with no corresponding observable behavior or stakeholder acceptance boundary. Record a concrete rationale and alternative TDD or quality-gate evidence.
- Every functional requirement and edge/error condition MUST be testable and mapped to TDD, BDD, or ATDD evidence in the Test Classification Matrix.
- Assign one owning suite to each planned executable artifact. An artifact MAY support multiple evidence roles or source IDs.
- Treat `Required` as an evidence obligation, not a requirement for a separately owned artifact. One scenario MAY satisfy both BDD and ATDD only when it fully covers both intents and traceability records an explicit equivalence rationale.
- Do not duplicate equivalent artifacts merely to satisfy multiple practice labels.
- Do not collapse materially different requirements, edge cases, input classes, output types, interfaces, or acceptance boundaries into one umbrella scenario solely to reduce scenario count.
- Scenario outlines MUST enumerate all required examples unless the spec records an approved sampling strategy such as pairwise coverage, boundary-value coverage, or risk-based representative coverage.
- BDD coverage MUST include positive behavior examples for each supported user-facing option or equivalence class and negative-path examples for each edge/error condition.
- ATDD coverage MUST include stakeholder-facing evidence for each buildable success criterion and full or justified pairwise coverage for required externally visible option combinations.
- TDD coverage MUST enumerate every required implementation-level behavior, boundary, invalid input, state transition, integration contract, expected error source, and edge/error case instead of stopping at a minimum count.

## Scenario ID Rules

Use stable IDs and Gherkin tags:

- Reuse core identifiers: `US1`, `FR-001`, and `SC-001`.
- Add `EC-001` only for edge-case traceability because core has no edge-case ID.
- ATDD feature-level tags: `@ATDD @US1 @FR-001 @SC-001`; scenario-level ID: `@ATDD-US1-001`.
- BDD feature-level tags: `@BDD @US1 @FR-001`; scenario-level ID: `@BDD-US1-001`.
- Edge/error scenarios: include the applicable `@EC-001`.
- Place each scenario-level ID immediately above exactly one `Scenario` or `Scenario Outline`. Never place a scenario-specific ID above `Feature`, because feature tags are inherited by every scenario.
- IDs are stable after publication and MUST NOT be shortened, renumbered, or reused.

{CORE_TEMPLATE}

## Additional Specification Validation

After the core specification quality validation, perform this blocking test-first validation:

- [ ] Every user story records BDD and ATDD as `Required` or justified `N/A`
- [ ] Every `Required` decision maps to at least one planned Gherkin scenario carrying that evidence role, regardless of owning suite
- [ ] Every `Required` BDD/ATDD decision has scenario coverage matrix rows proving required behavior, acceptance, example, edge-case, and sampling coverage
- [ ] Every `N/A` decision identifies alternative TDD or quality-gate evidence
- [ ] Every FR/SC/EC has a mapped test suite and test intent
- [ ] Every source marked `TDD` required has complete TDD inventory coverage rather than only a generic happy-path/error-path minimum
- [ ] Every expected error source has a negative-path test plan
- [ ] Every scenario outline enumerates required examples or records an approved sampling strategy
- [ ] Shared BDD/ATDD evidence records why behavior and acceptance intent are equivalent
- [ ] Every planned executable artifact has one owning suite
- [ ] Multi-role evidence is mapped without duplicate artifacts
- [ ] Core identifiers are reused wherever available
- [ ] Every scenario-specific ID is attached to exactly one scenario rather than inherited from a feature
- [ ] New identifiers are introduced only where necessary and remain consistent across tests, scenarios, tags, bindings, and traceability

If any item fails, update `spec.md` before reporting completion.
