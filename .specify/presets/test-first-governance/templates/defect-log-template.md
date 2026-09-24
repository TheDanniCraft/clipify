# Defect Log: [FEATURE NAME]

**Feature**: [link to spec.md]  
**Plan**: [link to plan.md]  
**Traceability**: [link to test-traceability.md]  
**Test Summary**: [link to test-summary.md]  
**Created**: [DATE]  
**Last Updated**: [DATE]

## Purpose and Scope

Track defects, unexpected test failures, escaped issues, accepted risks, and verification evidence for this feature. Record only product, test, environment, or governance issues that affect feature readiness; routine implementation tasks belong in `tasks.md`.

## Status Vocabulary

- `Open`: confirmed issue without an implemented fix.
- `In Progress`: fix or investigation is underway.
- `Blocked`: progress needs an external decision, dependency, access, or environment change.
- `Fixed`: fix is implemented and awaiting verification.
- `Verified`: fix is confirmed by linked evidence.
- `Deferred`: accepted for later work with approval and compensating evidence.
- `Rejected`: triaged as not a defect, duplicate, or out of scope with rationale.

## Severity and Priority Policy

| Level    | Severity Meaning                                                                                                           | Priority Meaning                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Critical | Data loss, security exposure, unavailable core workflow, legal/compliance risk, or release-blocking safety issue           | Must be resolved before release unless explicitly accepted by the accountable approver |
| High     | Major user-visible failure, broken acceptance criterion, severe performance/accessibility failure, or high-risk regression | Resolve before release unless a documented exception exists                            |
| Medium   | Partial workflow failure, workaround exists, non-critical quality gate failure, or localized regression                    | Resolve in the current release when practical or track as follow-up                    |
| Low      | Cosmetic, documentation, low-risk maintainability, or minor non-blocking issue                                             | Resolve opportunistically                                                              |

## Defect Summary

| Defect ID   | Title         | Source / Evidence ID          | Severity                   | Priority                   | Status | Owner   | Detected By       | Evidence Link            | Target / Resolution  |
| ----------- | ------------- | ----------------------------- | -------------------------- | -------------------------- | ------ | ------- | ----------------- | ------------------------ | -------------------- |
| DEF-US1-001 | [short title] | [FR-001 / TDD-US1-001 / gate] | [Critical/High/Medium/Low] | [Critical/High/Medium/Low] | Open   | [owner] | [suite/gate/user] | [task/PR/CI/report link] | [target or decision] |

## Defect Details

### DEF-US1-001 - [Title]

- **Status**: [Open/In Progress/Blocked/Fixed/Verified/Deferred/Rejected]
- **Severity / Priority**: [severity] / [priority]
- **Affected Source IDs**: [US1, FR-001, SC-001, EC-001]
- **Affected Artifact IDs**: [TDD-US1-001, BDD-US1-001, ATDD-US1-001, gate name]
- **Environment**: [OS/runtime/browser/service/test environment]
- **Detected During**: [planning/specification/Red run/Green run/regression/gate/review/production feedback]
- **Expected Result**: [expected observable behavior]
- **Actual Result**: [actual observable behavior]
- **Reproduction Steps**:
  1. [step]
  2. [step]
- **Evidence**: [links to logs, CI artifacts, screenshots, traces, task/PR comments]
- **Root Cause / Investigation Notes**: [known cause or current hypothesis]
- **Resolution Plan**: [fix, mitigation, deferral, rejection, or follow-up]
- **Verification Evidence**: [test/gate IDs and execution evidence proving closure]
- **Approval / Risk Acceptance**: [approver, date, rationale, expiry or follow-up when deferred]

## Open Defect Review

| Defect ID   | Release Impact                                       | Required Decision              | Decision Owner | Due Date | Notes   |
| ----------- | ---------------------------------------------------- | ------------------------------ | -------------- | -------- | ------- |
| DEF-US1-001 | [blocks release / risk accepted / no release impact] | [fix/defer/reject/accept risk] | [owner]        | [date]   | [notes] |

## Verification and Regression Closure

| Defect ID   | Fix Artifact / PR | Verification Test or Gate | Result              | Evidence Link | Verified By / Date |
| ----------- | ----------------- | ------------------------- | ------------------- | ------------- | ------------------ |
| DEF-US1-001 | [link]            | [TDD/BDD/ATDD/gate ID]    | [Green/Blocked/N/A] | [evidence]    | [name/date]        |

## Defect Metrics

| Metric                       | Value   | Notes                                              |
| ---------------------------- | ------- | -------------------------------------------------- |
| Total defects                | [count] | [scope]                                            |
| Open Critical / High defects | [count] | Must be zero or explicitly accepted before release |
| Deferred defects             | [count] | Must have approver, rationale, and follow-up       |
| Reopened defects             | [count] | [trend/risk]                                       |
| Escaped defects              | [count] | Issues found after the intended verification stage |

## Required Checks

- [ ] Every unexpected failing test or gate has a defect entry or documented non-defect rationale.
- [ ] Every Critical or High defect is `Verified`, `Rejected`, or explicitly accepted with approver, rationale, compensating evidence, and follow-up.
- [ ] Every deferred defect has scope, owner, target follow-up, and risk acceptance.
- [ ] Every fixed defect links to verification evidence in `test-traceability.md` or CI artifacts.
- [ ] Defect counts and release-impact decisions match `test-summary.md`.
