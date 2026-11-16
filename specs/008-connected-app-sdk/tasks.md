# Tasks: Connected application SDK milestone

## Setup

- [x] T001 [GATE] Specify and analyse bounded milestone in spec.md and plan.md.
- [x] T002 [GATE] Initialise evidence registry, test list and reports in specs/008-connected-app-sdk/.

## US1 — Administration and machine identity

- [x] T003 [US1] [TDD] [U1] Write failing machine/user OAuth isolation and own-admin tests in test/server/connected-apps/oauth-policy.test.ts.
- [x] T004 [US1] [U1] Implement scope/resource policy in src/server/connected-apps/oauth-policy.ts and provider config.
- [x] T005 [US1] [TDD] [U2] Write failing grant provision/revoke/expiry/creator checks in test/server/connected-apps/grants.test.ts.
- [x] T006 [US1] [U2] Add schema/service/admin route and session-file operator CLI.

## US2 — Search and SDK

- [x] T007 [US2] [TDD] [U3] Write failing gateway token/grant/input/response-boundary tests in test/server/connected-apps/gateway.test.ts.
- [x] T008 [US2] [U3] Extract shared cached search and implement bounded reusable gateway in src/server/connected-apps/.
- [x] T009 [US2] [TDD] [U4] Write failing SDK token/search/cache/error/abort tests in test/server/connected-apps/sdk.test.ts.
- [x] T010 [US2] [U4] Implement and package SDK in packages/sdk.

## US3 — Runtime boundary

- [x] T011 [US3] [BDD] [A1] Add executable native/Docker acceptance for contracts/milestone.feature.
- [x] T012 [US3] [U5] Implement headless independent Awards app/image/Compose in examples/babbler-awards.
- [x] T013 [US3] [GATE] [A1] Prove actual container search and private database boundaries with disposable fixtures.

## Final gates

- [x] T014 [GATE] Run affected whole-file OAuth/search/gateway/SDK suites and update test-summary.md.
- [x] T015 [GATE] Run lint/format/type checks, configure required coverage/CI owners and audit auth boundary.
- [ ] T016 [GATE] Update analysis.md, traceability, defect log, TDD verification and docs; open normal PR after local checks pass.

Dependencies: U1/U2 before U3 acceptance; U4 independent against fixed contract; U5 after SDK package. Independent ownership may run concurrently with one execution owner per suite. Each behavior gets observed Red before production and Green/refactor before push. No test-only Red is pushed.

## TDD remediation and merge gates

The feature is not certified complete while the blocking chronology exception remains unresolved. Existing U5 implementation and passing tests do not establish initial test-first delivery.

- [ ] T017 [GATE] Obtain an explicit project decision on disclosed TDD-001 (verification finding 1); preserve the original test-after evidence and decision, without manufacturing chronology.
- [ ] T018 [GATE] Require current-source full CI, merged coverage, build and static/security gates before merge; record the actual PR results.

- [x] T019 [GATE] Reproduce and repair all three failed CI-owner assumptions without weakening authority assertions; native contracts26 and policy11 pass.
- [ ] T020 [GATE] Prepare independent private repository/Coolify and verified demo-only copy; preserve source until destination verification and account for existing-show cutover.
