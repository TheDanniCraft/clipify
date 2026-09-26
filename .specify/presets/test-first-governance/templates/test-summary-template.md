# Test Summary Report: [FEATURE NAME]

**Feature**: [link to spec.md]  
**Plan**: [link to plan.md]  
**Traceability**: [link to test-traceability.md]  
**Defect Log**: [link to defect-log.md]  
**Created**: [DATE]  
**Last Updated**: [DATE]

## Executive Summary

| Item                         | Result                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| Overall Test Status          | [Pass/Fail/Blocked/Conditional Pass]                       |
| Release Recommendation       | [Go/No-Go/Conditional Go]                                  |
| Scope Covered                | [user stories, requirements, success criteria, edge cases] |
| Primary Evidence Location    | [CI run, artifact bundle, PR, reports]                     |
| Open Critical / High Defects | [count and links]                                          |
| Approved Exceptions          | [count and links]                                          |

Summarize the evidence in plain language: what was tested, what passed, what remains risky, and whether the feature is ready for release or merge.

## Scope and References

| Report / Artifact               | Location               | Purpose                                                                                       |
| ------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| Test Plan                       | [plan.md]              | Scope, strategy, tools, environments, gates, thresholds, and retention policy                 |
| Test Inventory and Traceability | [test-traceability.md] | Planned/executed artifacts, source mappings, scenario matrix, applicability, and gate results |
| Defect Log                      | [defect-log.md]        | Defects, triage, risk acceptance, and verification closure                                    |
| CI / Raw Evidence               | [CI/artifact links]    | Reproducible command output, runner reports, coverage, lint/static/security/smoke evidence    |

## Test Scope

| Source ID | Source Type            | Included? | Evidence Summary                | Exclusions / N/A Rationale   |
| --------- | ---------------------- | --------- | ------------------------------- | ---------------------------- |
| US1       | User Story             | [Yes/No]  | [mapped test/scenario/gate IDs] | [N/A or exclusion rationale] |
| FR-001    | Functional Requirement | [Yes/No]  | [mapped test/scenario/gate IDs] | [N/A or exclusion rationale] |
| SC-001    | Success Criterion      | [Yes/No]  | [mapped test/scenario/gate IDs] | [N/A or exclusion rationale] |
| EC-001    | Edge Case              | [Yes/No]  | [mapped test/scenario/gate IDs] | [N/A or exclusion rationale] |

## Execution Summary

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

## Coverage and Traceability Summary

| Coverage Area                    | Result                  | Evidence                      | Gap / Exception |
| -------------------------------- | ----------------------- | ----------------------------- | --------------- |
| TDD inventory completeness       | [Pass/Fail/Blocked]     | [IDs or traceability section] | [gap/none]      |
| Requirement-to-test mapping      | [Pass/Fail/Blocked]     | [Source Coverage Map]         | [gap/none]      |
| BDD/ATDD scenario coverage       | [Pass/Fail/Blocked/N/A] | [Scenario Coverage Matrix]    | [gap/none]      |
| Coverage thresholds and baseline | [Pass/Fail/Blocked]     | [coverage report]             | [gap/exception] |
| Quality gate completeness        | [Pass/Fail/Blocked]     | [Quality Gate Results]        | [gap/exception] |

## Defect Summary

| Severity | Open    | Fixed Awaiting Verification | Verified | Deferred / Accepted | Release Impact |
| -------- | ------- | --------------------------- | -------- | ------------------- | -------------- |
| Critical | [count] | [count]                     | [count]  | [count]             | [impact]       |
| High     | [count] | [count]                     | [count]  | [count]             | [impact]       |
| Medium   | [count] | [count]                     | [count]  | [count]             | [impact]       |
| Low      | [count] | [count]                     | [count]  | [count]             | [impact]       |

## Risks, Exceptions, and Limitations

| ID       | Type                                           | Description   | Impact   | Mitigation / Compensating Evidence | Owner   | Expiry / Follow-up |
| -------- | ---------------------------------------------- | ------------- | -------- | ---------------------------------- | ------- | ------------------ |
| RISK-001 | [risk/threshold exception/deferred defect/N/A] | [description] | [impact] | [mitigation/evidence]              | [owner] | [date/task]        |

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

- **Go**: all required evidence is Green, no blocking defects remain, and exceptions are approved.
- **Conditional Go**: only approved, scoped exceptions remain with compensating evidence and follow-up.
- **No-Go**: required evidence is missing, failed, stale, or blocked; or unaccepted Critical/High defects remain.

## Approvals

| Role                        | Name   | Decision                | Date   | Notes   |
| --------------------------- | ------ | ----------------------- | ------ | ------- |
| Engineering Owner           | [name] | [Approved/Rejected/N/A] | [date] | [notes] |
| Product / Stakeholder Owner | [name] | [Approved/Rejected/N/A] | [date] | [notes] |
| Quality / Release Owner     | [name] | [Approved/Rejected/N/A] | [date] | [notes] |

## Required Checks

- [ ] Test plan, traceability, defect log, and raw evidence links are present.
- [ ] Every required TDD, BDD, ATDD, and quality-gate result is summarized with evidence.
- [ ] Coverage, scenario, and source-mapping summaries match `test-traceability.md`.
- [ ] Defect counts and release-impact decisions match `defect-log.md`.
- [ ] Every exception has scope, owner, rationale, compensating evidence, and follow-up or expiry.
- [ ] The release recommendation follows the stated Go / Conditional Go / No-Go policy.
