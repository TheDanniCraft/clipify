# Evidence registry

One native integration scenario owns BDD and ATDD for each identical headless observable boundary; no duplicate browser evidence. Artifact definitions precede production implementation.

| Artifact        | Source map / scenario examples                                                                            | Owner command                      | State |
| --------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----- |
| U1 oauth-policy | FR-001/002 EC-001/002; admin/nonadmin/foreign admin identity; machine/user token resources and scope sets | Jest oauth-policy whole file       | Green |
| U2 grants       | FR-001/003 EC-002/003/004; active/missing/disabled creator, exact expiry, revoke and audit                | Jest grants whole file             | Green |
| U3 gateway      | FR-003/004 EC-001/003/004/005/006/007; token, input, page, rate, resource and response boundaries         | Jest gateway whole file            | Green |
| U4 SDK          | FR-005 EC-001/005/006; all token/HTTP/cache/abort/redaction cases                                         | Jest SDK whole file                | Green |
| U5 container    | FR-006/007/008 SC-001/003; image and package execution, isolated networks and both DBs                    | native container smoke             | Green |
| A1 integrated   | FR-001..008 SC-001..004 EC-001..007 applicable examples above                                             | native integration + runtime smoke | Green |

## Quality gates

Affected tests required locally; complete coverage with unchanged thresholds, lint, format, TypeScript, build, OAuth/search regressions, native Docker and current-source CI required before merge. No browser UI gate: no visible screen changes. No platform-specific Windows changes. Mutation runner unavailable; highest-risk policy mutants get explicit checks. This report retains results only after execution.

## Executable scenario mapping

The Gherkin contract is documentary; the assert-based native owner provides BDD/ATDD-equivalent execution, not generated step bindings.

- BDD-US1-001: test/support/connected-apps/security.ts provisions through the real administrator session and checks anonymous, viewer, cross-origin and public machine-registration denial.
- BDD-US2-001: scripts/test-connected-app-containers.mjs executes the independently built Awards image for matching/empty search, foreign creator and revoked-grant denial; security.ts verifies real signed tokens/JWKS and grant authority.
- BDD-US3-001: the same owner creates two Compose projects, checks both database ports and both cross-database connection denials, then removes projects/volumes/network. Existing show files and data are not touched.

Execution output: tdd/evidence/container-report.json and awards-two-project-runtime.log. Exact local commands/results are in test-summary.md. Initial CLI history remains TEST_AFTER, not a Green discipline gate.
