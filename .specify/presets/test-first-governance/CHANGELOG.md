# Changelog

## 1.3.0 - 2026-07-08

- Recommend installing this preset at the highest priority among all installed presets so its quality, reliability, traceability, release-readiness, and mandatory test-first governance takes precedence across the delivery workflow.
- Replace "minimum non-duplicative" BDD/ATDD scenario generation with coverage-complete, non-duplicative scenario generation.
- Replace per-story minimum TDD task wording with coverage-complete TDD inventory and task generation.
- Add scenario granularity rules requiring BDD coverage for user-visible requirements, supported user-facing option classes, and edge/error conditions.
- Add ATDD coverage rules for buildable success criteria, end-to-end story acceptance, externally visible option combinations, and release-boundary evidence.
- Require scenario outlines to enumerate required examples or record an approved sampling strategy such as pairwise, boundary-value, or risk-based representative coverage.
- Add a Scenario Coverage Matrix to the traceability template so each scenario or scenario-outline example records its primary source ID, covered inputs/classes, polarity, interface, and rationale.
- Add minimum professional test report governance with feature-level defect log and test summary report templates.
- Require planning to materialize `test-traceability.md`, `defect-log.md`, and `test-summary.md`, while treating CI artifacts as raw execution evidence.
- Add an overall test summary template and converge wrapper for project/release aggregation without duplicating overall traceability, inventory, execution, or defect reports.
- Add an explicit Overall Test Summary Destination decision so users choose rolling `reports/test-summary.md` or release-specific `reports/releases/<release-id>/test-summary.md` output.
- Require broad umbrella scenarios to be reported as blocking gaps when they are the only evidence for unrelated FRs, SCs, ECs, inputs, interfaces, outcomes, or error messages.
- Tighten shared BDD/ATDD evidence rules so one scenario may satisfy both roles only when traceability records an explicit equivalence rationale.
- Update specify, plan, tasks, analyze, implement, checklist, constitution, README, and preset metadata wording to align with the stricter scenario coverage model.

## 1.2.0 - 2026-07-06

- Replace batch-all-tests-first task ordering with incremental Red-Green-Refactor cycles scoped to the smallest meaningful behavior slice.
- Keep required BDD and ATDD scenarios defined before implementation while allowing their executable bindings and TDD tests to be introduced in the cycle that implements the corresponding behavior.
- Retain full-suite quality gates and final traceability validation at user-story completion.
- Define BDD and ATDD `Required` decisions as evidence obligations rather than requirements for separate suite-owned artifacts.
- Allow one Gherkin scenario to satisfy both BDD and ATDD when it fully covers both behavior and stakeholder-acceptance intent, while retaining exactly one owning suite.
- Require traceability to record every evidence role and prohibit duplicate scenarios, bindings, tasks, commands, or reports created only to satisfy practice labels.
- Move each scenario-specific Gherkin ID tag directly above its `Scenario` or `Scenario Outline` so it identifies exactly one scenario.
- Keep reusable suite, user-story, requirement, success-criterion, and edge-case tags at feature level where Gherkin inheritance applies.
- Normalize feature traceability into an evidence artifact registry, a source-to-artifact coverage map, BDD/ATDD applicability decisions, and separate quality-gate results.
- Store commands, execution status, and evidence once per artifact or gate instead of repeating mutable results across source-mapping rows.
- Reorganize and streamline the README around installation, workflow, governed behavior, generated artifacts, and CI enforcement while retaining the Motivation and Approach sections.
- Align specification and planning addenda so specification defines traceability inputs while planning owns traceability materialization, and normalize generated template text to avoid corrupted tree/arrows.

## 1.1.0 - 2026-07-06

- Clarify that the preset governs Spec Kit artifacts and agent instructions, while mechanical enforcement requires project CI checks and branch protection.
- Replace overstated "enforces" wording with "governs" in preset metadata and documentation.
- Distinguish complementary TDD, BDD, and ATDD practices from primary suite ownership.
- Allow one artifact to support multiple evidence roles while prohibiting label-driven duplication of tests, scenarios, bindings, and shared support code.
- Make BDD and ATDD applicability explicit instead of requiring both indiscriminately for every story.
- Permit governed `N/A` decisions for technical-only work when backed by a concrete rationale and alternative TDD or quality-gate evidence.
- Materialize the traceability template at `specs/<feature>/test-traceability.md` during planning.
- Require task-generation, implementation, and analysis workflows to maintain and validate traceability statuses and execution evidence.
- Replace universal coverage constants with risk-based approved thresholds, baseline protection, and governed exceptions.
- Make stack- and risk-dependent quality gates explicitly applicable or justified `N/A`.
- Prefer reproducible task, PR, and CI evidence over committed per-story generated reports unless audit retention requires them.
- Reuse core Spec Kit identifiers (`US1`, `FR-001`, `SC-001`, and `T###`) without parallel aliases.
- Introduce new identifiers only where necessary: `EC-001` for edge-case traceability and `<SUITE>-US1-001` for executable evidence.
- Keep test, scenario, Gherkin, binding, task, and traceability references consistent with their core source identifiers.
- Treat suite markers as task-description extensions without altering core `T###`, `[P]`, or `[US1]` identifiers.
- Prepare the README for release with Motivation and Approach sections, complete installation and licensing guidance, and removal of the Community Catalog Entry Example and Release Checklist sections.
- Add a branded header image to the README.

## 1.0.0 - 2026-07-05

- Initial Test-First Governance preset.
- Adds mandatory TDD, BDD, ATDD, Gherkin, traceability, coverage, linting, static analysis, and runtime smoke gates.
