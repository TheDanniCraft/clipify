# Test-First Governance Wrapper

Before and after executing the core constitution workflow, ensure the project constitution contains non-negotiable principles for:

- test-first implementation;
- explicit suite ownership while treating TDD, BDD, and ATDD as complementary practices;
- mandatory Gherkin when BDD or ATDD applies, with governed `N/A` decisions for technical-only work;
- coverage-complete BDD/ATDD scenario sets, required example coverage, and approved sampling strategies;
- Gherkin scenario ID to executable test mirroring;
- reuse of core identifiers and stable preset-specific IDs only where core has no equivalent;
- risk-based coverage, linting, formatting, applicable static-analysis/security/runtime gates, lifecycle-managed traceability, the minimum professional test report set, and a single aggregate project/release test summary.

If the constitution omits these principles, add them or report a blocking governance gap.

{CORE_TEMPLATE}

## Additional Done Criteria

- [ ] Constitution makes TDD mandatory for production logic and defines BDD/ATDD applicability
- [ ] Constitution requires concrete rationale and alternative evidence for BDD/ATDD `N/A`
- [ ] Constitution requires one owning suite per executable artifact and prohibits label-driven duplication
- [ ] Constitution permits one scenario to satisfy both BDD and ATDD roles only when it fully covers both intents and records an equivalence rationale
- [ ] Constitution requires scenario outlines to enumerate required examples or record an approved sampling strategy
- [ ] Constitution reuses core `US1`, `FR-001`, `SC-001`, and `T###` identifiers
- [ ] Constitution limits new IDs to `EC-001` and `<SUITE>-US1-001` forms
- [ ] Constitution requires each scenario-specific ID to be attached to exactly one scenario, never inherited from a feature
- [ ] Constitution states that quality gates are mandatory and blocking
- [ ] Constitution requires explicit gate applicability, threshold exceptions, and evidence-retention policy
- [ ] Constitution defines `specs/<feature>/test-traceability.md` as the canonical normalized traceability artifact
- [ ] Constitution separates artifact execution state, source mappings, scenario coverage matrix, applicability decisions, and quality-gate results
- [ ] Constitution requires the minimum professional test report set: test plan, traceability/inventory/execution report, defect log, and test summary report
- [ ] Constitution requires only one aggregate project/release Test Summary Report by default and prohibits duplicate overall traceability, inventory, execution, or defect reports without a declared external requirement
- [ ] Constitution requires an explicit overall-summary destination decision for rolling vs release output path
