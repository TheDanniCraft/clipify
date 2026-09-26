# Overall Test Summary Report: [PROJECT OR RELEASE NAME]

**Release / Build**: [version, release ID, commit SHA, or build ID]  
**Report Scope**: [project/release/milestone/date range]  
**Overall Summary Mode**: [rolling/release]  
**Release ID**: [N/A or release-id]  
**Output Path**: [reports/test-summary.md or reports/releases/<release-id>/test-summary.md]  
**Created**: [DATE]  
**Last Updated**: [DATE]  
**Primary CI Evidence**: [CI run, artifact bundle, dashboard, or report index]

## Executive Summary

| Item                                 | Result                               |
| ------------------------------------ | ------------------------------------ |
| Overall Test Status                  | [Pass/Fail/Blocked/Conditional Pass] |
| Release Recommendation               | [Go/No-Go/Conditional Go]            |
| Features Included                    | [count and scope]                    |
| Features Excluded                    | [count and rationale]                |
| Open Critical / High Defects         | [count and links]                    |
| Approved Exceptions / Accepted Risks | [count and links]                    |
| Primary Evidence Location            | [CI/artifact/report links]           |

Summarize whether the project or release is ready, what evidence supports that decision, and which risks or exceptions remain.

## Destination Decision

| Setting              | Value                                                                      | Rationale                                                                     |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Overall summary mode | [rolling/release]                                                          | [rolling for latest aggregate status, release for versioned release evidence] |
| Release ID           | [N/A or release-id]                                                        | [required when mode is release]                                               |
| Output path          | [reports/test-summary.md or reports/releases/<release-id>/test-summary.md] | [must match mode and release ID]                                              |

Use `reports/test-summary.md` for a rolling/latest project summary. Use `reports/releases/<release-id>/test-summary.md` for versioned release evidence.

## Included Feature Reports

| Feature   | Spec / Plan | Feature Test Summary | Traceability           | Defect Log      | Status                          | Release Impact |
| --------- | ----------- | -------------------- | ---------------------- | --------------- | ------------------------------- | -------------- |
| [feature] | [links]     | [test-summary.md]    | [test-traceability.md] | [defect-log.md] | [Pass/Fail/Blocked/Conditional] | [impact]       |

## Aggregate Execution Summary

| Suite / Gate    | Required?      | Command / CI Job | Planned     | Passed   | Failed  | Blocked   | Evidence Link |
| --------------- | -------------- | ---------------- | ----------- | -------- | ------- | --------- | ------------- |
| TDD             | Required       | [command/job]    | [count]     | [count]  | [count] | [count]   | [link]        |
| BDD             | [Required/N/A] | [command/job]    | [count]     | [count]  | [count] | [count]   | [link]        |
| ATDD            | [Required/N/A] | [command/job]    | [count]     | [count]  | [count] | [count]   | [link]        |
| Coverage        | Required       | [command/job]    | [threshold] | [result] | [gap]   | [blocked] | [link]        |
| Lint / Format   | Required       | [command/job]    | [policy]    | [result] | [gap]   | [blocked] | [link]        |
| Static Analysis | [Required/N/A] | [command/job]    | [policy]    | [result] | [gap]   | [blocked] | [link]        |
| Security        | [Required/N/A] | [command/job]    | [policy]    | [result] | [gap]   | [blocked] | [link]        |
| Runtime Smoke   | [Required/N/A] | [command/job]    | [policy]    | [result] | [gap]   | [blocked] | [link]        |

## Aggregate Coverage and Traceability

| Area                             | Result                  | Evidence                       | Gap / Exception |
| -------------------------------- | ----------------------- | ------------------------------ | --------------- |
| Feature report completeness      | [Pass/Fail/Blocked]     | [links]                        | [gap/none]      |
| Requirement-to-test traceability | [Pass/Fail/Blocked]     | [feature traceability reports] | [gap/none]      |
| TDD inventory completeness       | [Pass/Fail/Blocked]     | [feature summaries]            | [gap/none]      |
| BDD/ATDD scenario coverage       | [Pass/Fail/Blocked/N/A] | [feature summaries]            | [gap/none]      |
| Coverage thresholds and baseline | [Pass/Fail/Blocked]     | [coverage report]              | [gap/exception] |
| Quality gate completeness        | [Pass/Fail/Blocked]     | [CI and feature summaries]     | [gap/exception] |

## Aggregate Defect Summary

| Severity | Open    | Fixed Awaiting Verification | Verified | Deferred / Accepted | Release Impact |
| -------- | ------- | --------------------------- | -------- | ------------------- | -------------- |
| Critical | [count] | [count]                     | [count]  | [count]             | [impact]       |
| High     | [count] | [count]                     | [count]  | [count]             | [impact]       |
| Medium   | [count] | [count]                     | [count]  | [count]             | [impact]       |
| Low      | [count] | [count]                     | [count]  | [count]             | [impact]       |

## Cross-Feature Risks and Exceptions

| ID       | Source                | Type                                           | Description   | Impact   | Mitigation / Compensating Evidence | Owner   | Expiry / Follow-up |
| -------- | --------------------- | ---------------------------------------------- | ------------- | -------- | ---------------------------------- | ------- | ------------------ |
| RISK-001 | [feature/report/gate] | [risk/threshold exception/deferred defect/N/A] | [description] | [impact] | [mitigation/evidence]              | [owner] | [date/task]        |

## Environment and Tooling

| Area               | Value                                             |
| ------------------ | ------------------------------------------------- |
| Runtime / Platform | [version]                                         |
| Test Tools         | [tools and versions]                              |
| Test Data          | [fixtures, anonymized data, generated data, seed] |
| External Services  | [mocked/real/service versions]                    |
| Build / Commit     | [commit SHA, build ID, artifact version]          |

## Release Recommendation

State the recommendation and rationale:

- **Go**: all included feature summaries are `Go` or justified `Conditional Go`, all required gates pass, no unaccepted Critical/High defects remain, and all exceptions are approved.
- **Conditional Go**: only approved, scoped exceptions remain with compensating evidence and follow-up.
- **No-Go**: any required evidence is missing, failed, stale, or blocked; or unaccepted Critical/High defects remain.

## Approvals

| Role                        | Name   | Decision                | Date   | Notes   |
| --------------------------- | ------ | ----------------------- | ------ | ------- |
| Engineering Owner           | [name] | [Approved/Rejected/N/A] | [date] | [notes] |
| Product / Stakeholder Owner | [name] | [Approved/Rejected/N/A] | [date] | [notes] |
| Quality / Release Owner     | [name] | [Approved/Rejected/N/A] | [date] | [notes] |

## Required Checks

- [ ] Every included feature links to current `test-summary.md`, `test-traceability.md`, and `defect-log.md` reports.
- [ ] Overall summary mode, release ID, and output path are declared and consistent.
- [ ] Aggregate execution totals match CI evidence and included feature summaries.
- [ ] Aggregate coverage, traceability, gate, defect, risk, and exception summaries match feature reports and CI artifacts.
- [ ] No overall defect, traceability, inventory, or execution report is duplicated unless an audit, regulatory, customer, or tool-integration requirement is declared.
- [ ] The release recommendation follows the stated Go / Conditional Go / No-Go policy.
