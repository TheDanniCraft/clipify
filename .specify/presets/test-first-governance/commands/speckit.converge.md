# Test-First Converge Wrapper

Apply these requirements in addition to the core convergence or release-readiness workflow.

## Overall Test Summary Only

For project, milestone, or release-level aggregation, create or update only one overall report by default:

```text
reports/test-summary.md
```

For versioned releases, use:

```text
reports/releases/<release-id>/test-summary.md
```

Do not create separate overall Test Plan, Test Inventory, Requirements Traceability Matrix, Test Execution, or Defect reports unless the project declares an audit, regulatory, customer, or tool-integration requirement. Those details remain authoritative in feature-level reports and CI/tool artifacts.

## Destination Decision

The user controls the output path through the Overall Test Summary Destination decision in the plan or convergence request:

| Setting              | Allowed Values                                                               | Rule                                                                                      |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Overall summary mode | `rolling` or `release`                                                       | `rolling` writes the latest aggregate report; `release` writes versioned release evidence |
| Release ID           | `N/A` or a stable release identifier                                         | Required when mode is `release`; ignored when mode is `rolling`                           |
| Output path          | `reports/test-summary.md` or `reports/releases/<release-id>/test-summary.md` | Derived from mode and release ID                                                          |

Use `reports/test-summary.md` when mode is `rolling` or no release ID is provided. Use `reports/releases/<release-id>/test-summary.md` when mode is `release` and a release ID is provided. If the user explicitly provides an output path, it MUST match the selected mode and release ID.

## Mandatory Overall Summary Creation

Before reporting convergence or release readiness complete:

1. Resolve `overall-test-summary-template` through Spec Kit's template resolver.
2. Read the Overall Test Summary Destination decision from `plan.md`, the convergence request, or an existing overall summary report.
3. Materialize or update the overall summary at the resolved output path.
4. Link every included feature's `specs/<feature>/test-summary.md`, `test-traceability.md`, and `defect-log.md`.
5. Aggregate TDD, BDD, ATDD, coverage, lint/format, static-analysis, security, runtime-smoke, and other required gate results from feature summaries and CI artifacts.
6. Aggregate open, fixed, verified, deferred, and accepted defects by severity from feature defect logs or the canonical issue tracker.
7. Record cross-feature risks, threshold exceptions, accepted defects, N/A decisions affecting release readiness, and compensating evidence.
8. Provide a Go, Conditional Go, or No-Go recommendation that is consistent with feature reports, CI artifacts, open defects, accepted risks, and gate results.

## Additional Convergence Gate

Before completing convergence, verify:

- [ ] Every included feature has current `test-summary.md`, `test-traceability.md`, and `defect-log.md` links
- [ ] Overall Test Summary Destination declares `rolling` or `release`, release ID when required, and the resolved output path
- [ ] The actual output path matches the destination decision
- [ ] Aggregate execution totals match CI evidence and feature summaries
- [ ] Aggregate coverage, traceability, quality-gate, defect, risk, and exception summaries match their source reports
- [ ] No unaccepted Critical or High defect remains open for the release
- [ ] No required evidence is missing, failed, stale, or blocked unless the recommendation is `No-Go` or explicitly `Conditional Go`
- [ ] The overall report does not duplicate overall traceability, inventory, execution, or defect reports without a declared external requirement

{CORE_TEMPLATE}
