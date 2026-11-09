# Tasks: Event Platform

Implementation paths below name current owners; related UI lives in src/app/components/events. Checked test tasks record focused Red/Green evidence only. BDD and implementation tasks remain open until their full acceptance boundary is verified.

## Setup

- [x] T001 Record approved scope and add Mobbin guidance in AGENTS.md and specs/007-event-platform/spec.md
- [ ] T002 [GATE] Complete plan and normalized evidence in specs/007-event-platform/test-traceability.md

### FR-001 — US1

- [ ] T003 [US1] [BDD] Bind BDD-US1-001, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T004 [US1] [TDD] [U1] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T005 [US1] Implement FR-001 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-002 — US1

- [ ] T006 [US1] [BDD] Bind BDD-US1-002, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T007 [US1] [TDD] [U2] Write focused tests in test/server/events/tour.test.ts and record intended Red in tdd/cycle-log.md
- [x] T008 [US1] Implement FR-002 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-003 — US1

- [ ] T009 [US1] [BDD] Bind BDD-US1-003, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T010 [US1] [TDD] [U3] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T011 [US1] Implement FR-003 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-004 — US1

- [ ] T012 [US1] [BDD] Bind BDD-US1-004, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T013 [US1] [TDD] [U4] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [x] T014 [US1] Implement FR-004 in src/server/events/persistence.ts and src/app/components/events/EventEditor.tsx and relevant callers/UI; prove Green and refactor

### FR-005 — US1

- [ ] T015 [US1] [BDD] Bind BDD-US1-005, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T016 [US1] [TDD] [U5] Write focused tests in test/server/events/policy.test.ts and record intended Red in tdd/cycle-log.md
- [x] T017 [US1] Implement FR-005 in src/app/lib/events.ts and relevant callers/UI; prove Green and refactor

### FR-006 — US1

- [ ] T018 [US1] [BDD] Bind BDD-US1-006, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T019 [US1] [TDD] [U6] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T020 [US1] Implement FR-006 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-007 — US2

- [ ] T021 [US2] [BDD] Bind BDD-US2-007, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T022 [US2] [TDD] [U7] Write focused tests in test/server/events/participant-auth.test.ts and record intended Red in tdd/cycle-log.md
- [x] T023 [US2] Implement FR-007 in src/server/events/participant.ts and src/auth/config.ts and relevant callers/UI; prove Green and refactor

### FR-008 — US2

- [ ] T024 [US2] [BDD] Bind BDD-US2-008, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T025 [US2] [TDD] [U8] Write focused tests in test/server/events/sources.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T026 [US2] Implement FR-008 in src/server/events/sources.ts and relevant callers/UI; prove Green and refactor

### FR-009 — US2

- [ ] T027 [US2] [BDD] Bind BDD-US2-009, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T028 [US2] [TDD] [U9] Write focused tests in test/server/events/youtube.test.ts and test/server/events/connections.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T029 [US2] Implement FR-009 in src/server/events/sources.ts and relevant callers/UI; prove Green and refactor

### FR-010 — US2

- [ ] T030 [US2] [BDD] Bind BDD-US2-010, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T031 [US2] [TDD] [U10] Write focused tests in test/server/events/sources.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T032 [US2] Implement FR-010 in src/server/events/sources.ts and relevant callers/UI; prove Green and refactor

### FR-011 — US2

- [ ] T033 [US2] [BDD] Bind BDD-US2-011, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T034 [US2] [TDD] [U11] Write focused tests in test/server/events/uploads.test.ts, upload-provider.test.ts, storage-security.test.ts and upload-route.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T035 [US2] Implement FR-011 in src/server/events/uploads.ts, upload-provider.ts, media.ts and storage-http.ts and relevant callers/UI; prove Green and refactor

### FR-012 — US2

- [ ] T036 [US2] [BDD] Bind BDD-US2-012, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T037 [US2] [TDD] [U12] Write focused tests in test/server/events/persistence.test.ts and record intended Red in tdd/cycle-log.md
- [x] T038 [US2] Implement FR-012 in src/server/events/submissions.ts and relevant callers/UI; prove Green and refactor

### FR-013 — US3

- [ ] T039 [US3] [BDD] Bind BDD-US3-013, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T040 [US3] [TDD] [U13] Write focused tests in test/server/events/persistence.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T041 [US3] Implement FR-013 in src/server/events/submissions.ts and relevant callers/UI; prove Green and refactor

### FR-014 — US3

- [ ] T042 [US3] [BDD] Bind BDD-US3-014, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T043 [US3] [TDD] [U14] Write focused tests in test/server/events/persistence.test.ts and review-ui.test.tsx and record intended Red in tdd/cycle-log.md
- [x] T044 [US3] Implement FR-014 in src/server/events/review.ts and relevant callers/UI; prove Green and refactor

### FR-015 — US3

- [ ] T045 [US3] [BDD] Bind BDD-US3-015, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T046 [US3] [TDD] [U15] Write focused tests in test/server/events/freeze.test.ts and record intended Red in tdd/cycle-log.md
- [x] T047 [US3] Implement FR-015 in src/server/events/freeze.ts and relevant callers/UI; prove Green and refactor

### FR-016 — US4

- [ ] T048 [US4] [BDD] Bind BDD-US4-016, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T049 [US4] [TDD] [U16] Write focused tests in test/server/events/persistence.test.ts and record intended Red in tdd/cycle-log.md
- [x] T050 [US4] Implement FR-016 in src/server/events/voting.ts and relevant callers/UI; prove Green and refactor

### FR-017 — US4

- [ ] T051 [US4] [BDD] Bind BDD-US4-017, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [x] T052 [US4] [TDD] [U17] Write focused tests in test/server/events/media.test.tsx and public-page.test.tsx and record intended Red in tdd/cycle-log.md
- [ ] T053 [US4] Implement FR-017 in src/server/events/voting.ts and relevant callers/UI; prove Green and refactor

### FR-018 — US5

- [ ] T054 [US5] [BDD] Bind BDD-US5-018, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T055 [US5] [TDD] [U18] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T056 [US5] Implement FR-018 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-019 — US5

- [ ] T057 [US5] [BDD] Bind BDD-US5-019, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T058 [US5] [TDD] [U19] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T059 [US5] Implement FR-019 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-020 — US5

- [ ] T060 [US5] [BDD] Bind BDD-US5-020, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T061 [US5] [TDD] [U20] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T062 [US5] Implement FR-020 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-021 — US5

- [ ] T063 [US5] [BDD] Bind BDD-US5-021, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T064 [US5] [TDD] [U21] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T065 [US5] Implement FR-021 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-022 — US5

- [ ] T066 [US5] [BDD] Bind BDD-US5-022, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T067 [US5] [TDD] [U22] Write focused tests in test/server/events/chat.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T068 [US5] Implement FR-022 in src/server/events/chat.ts and relevant callers/UI; prove Green and refactor

### FR-023 — US6

- [ ] T069 [US6] [BDD] Bind BDD-US6-023, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T070 [US6] [TDD] [U23] Write focused tests in test/server/events/publication.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T071 [US6] Implement FR-023 in src/server/events/publication.ts and relevant callers/UI; prove Green and refactor

### FR-024 — US6

- [ ] T072 [US6] [BDD] Bind BDD-US6-024, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T073 [US6] [TDD] [U24] Write focused tests in test/server/events/mcp.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T074 [US6] Implement FR-024 in src/server/events/mcp.ts and relevant callers/UI; prove Green and refactor

### FR-025 — US1

- [ ] T075 [US1] [BDD] Bind BDD-US1-025, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T076 [US1] [TDD] [U25] Write focused tests in test/server/events/ui.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T077 [US1] Implement FR-025 in src/server/events/ui.ts and relevant callers/UI; prove Green and refactor

### EC-001 — US1

- [ ] T078 [US1] [BDD] Bind BDD-US1-026, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T079 [US1] [TDD] [U26] Write focused tests in test/server/events/policy.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T080 [US1] Implement EC-001 in src/app/lib/events.ts and relevant callers/UI; prove Green and refactor

### EC-002 — US2

- [ ] T081 [US2] [BDD] Bind BDD-US2-027, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T082 [US2] [TDD] [U27] Write focused tests in test/server/events/storage.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T083 [US2] Implement EC-002 in src/server/events/uploads.ts, upload-provider.ts, media.ts and storage-http.ts and relevant callers/UI; prove Green and refactor

### EC-003 — US2

- [ ] T084 [US2] [BDD] Bind BDD-US2-028, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T085 [US2] [TDD] [U28] Write focused tests in test/server/events/submissions.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T086 [US2] Implement EC-003 in src/server/events/submissions.ts and relevant callers/UI; prove Green and refactor

### EC-004 — US3

- [ ] T087 [US3] [BDD] Bind BDD-US3-029, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T088 [US3] [TDD] [U29] Write focused tests in test/server/events/review.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T089 [US3] Implement EC-004 in src/server/events/review.ts and relevant callers/UI; prove Green and refactor

### EC-005 — US3

- [ ] T090 [US3] [BDD] Bind BDD-US3-030, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T091 [US3] [TDD] [U30] Write focused tests in test/server/events/freeze.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T092 [US3] Implement EC-005 in src/server/events/freeze.ts and relevant callers/UI; prove Green and refactor

### EC-006 — US4

- [ ] T093 [US4] [BDD] Bind BDD-US4-031, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T094 [US4] [TDD] [U31] Write focused tests in test/server/events/voting.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T095 [US4] Implement EC-006 in src/server/events/voting.ts and relevant callers/UI; prove Green and refactor

### EC-007 — US5

- [ ] T096 [US5] [BDD] Bind BDD-US5-032, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T097 [US5] [TDD] [U32] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T098 [US5] Implement EC-007 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### EC-008 — US5

- [ ] T099 [US5] [BDD] Bind BDD-US5-033, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T100 [US5] [TDD] [U33] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T101 [US5] Implement EC-008 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### EC-009 — US6

- [ ] T102 [US6] [BDD] Bind BDD-US6-034, enumerate source options and relevant failures in test/bdd/steps/events.steps.ts
- [ ] T103 [US6] [TDD] [U34] Write focused tests in test/server/events/publication.test.ts and record intended Red in tdd/cycle-log.md
- [ ] T104 [US6] Implement EC-009 in src/server/events/publication.ts and relevant callers/UI; prove Green and refactor

## Final validation

- [ ] T105 [GATE] Rehearse complete pilot via real browser, review desktop/mobile and themes; update test-summary.md and defect-log.md
- [ ] T106 [GATE] Run affected tests, review CI gates and open normal GitHub PR once complete

## Dependencies

Configuration/policy → auth/sources/storage/submissions → review/freeze → voting → presenter/chat → publication/MCP. UI follows shared service contracts. Independent research may run in parallel; mutation/test execution has one owner per boundary.
