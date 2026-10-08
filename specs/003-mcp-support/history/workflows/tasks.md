# Tasks: MCP workflows

## Phase 1: Setup

- [x] T001 Resolve templates and record accepted scope in specs/004-mcp-workflows/spec.md
- [x] T002 Research existing shared-service boundaries in specs/004-mcp-workflows/research.md
- [x] T003 [GATE] Initialize plan and traceability/report registry in specs/004-mcp-workflows/test-traceability.md

## Phase 2: Foundation

- [x] T004 [TDD] Add strict catalogue/schema/consent/risk tests and record Red in test/mcp/workflows/catalogue.test.ts
- [x] T005 Implement and verify new catalogue/schemas/scopes in src/server/mcp/workflows/catalogue.ts

## Phase 3: Remote control

- [x] T006 [US1] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/remote.feature and record inventory in specs/004-mcp-workflows/test-traceability.md
- [x] T007 [US1] [TDD] Add tests and matching BDD binding for get_overlay_runtime; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T008 [US1] Implement get_overlay_runtime through shared backend policy in src/server/resources/remote.ts
- [x] T009 [US1] [GATE] Verify Green and refactor get_overlay_runtime; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T010 [US1] [TDD] Add tests and matching BDD binding for get_overlay_queues; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T011 [US1] Implement get_overlay_queues through shared backend policy in src/server/resources/remote.ts
- [x] T012 [US1] [GATE] Verify Green and refactor get_overlay_queues; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T013 [US1] [TDD] Add tests and matching BDD binding for control_overlay; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T014 [US1] Implement control_overlay through shared backend policy in src/server/resources/remote.ts
- [x] T015 [US1] [GATE] Verify Green and refactor control_overlay; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T016 [US1] [TDD] Add tests and matching BDD binding for enqueue_overlay_clip; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T017 [US1] Implement enqueue_overlay_clip through shared backend policy in src/server/resources/remote.ts
- [x] T018 [US1] [GATE] Verify Green and refactor enqueue_overlay_clip; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T019 [US1] [TDD] Add tests and matching BDD binding for clear_overlay_queue; observe expected Red in test/mcp/workflows/remote.test.ts
- [x] T020 [US1] Implement clear_overlay_queue through shared backend policy in src/server/resources/remote.ts
- [x] T021 [US1] [GATE] Verify Green and refactor clear_overlay_queue; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T022 [US1] [GATE] Run full affected evidence/coverage and update specs/004-mcp-workflows/test-summary.md

## Phase 4: Find and import clips

- [x] T023 [US2] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/discovery.feature and record inventory in specs/004-mcp-workflows/test-traceability.md
- [x] T024 [US2] [TDD] Add tests and matching BDD binding for search_clips; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T025 [US2] Implement search_clips through shared backend policy in src/server/resources/discovery.ts
- [x] T026 [US2] [GATE] Verify Green and refactor search_clips; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T027 [US2] [TDD] Add tests and matching BDD binding for resolve_clip; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T028 [US2] Implement resolve_clip through shared backend policy in src/server/resources/discovery.ts
- [x] T029 [US2] [GATE] Verify Green and refactor resolve_clip; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T030 [US2] [TDD] Add tests and matching BDD binding for preview_playlist_import; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T031 [US2] Implement preview_playlist_import through shared backend policy in src/server/resources/discovery.ts
- [x] T032 [US2] [GATE] Verify Green and refactor preview_playlist_import; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T033 [US2] [TDD] Add tests and matching BDD binding for commit_playlist_import; observe expected Red in test/mcp/workflows/discovery.test.ts
- [x] T034 [US2] Implement commit_playlist_import through shared backend policy in src/server/resources/discovery.ts
- [x] T035 [US2] [GATE] Verify Green and refactor commit_playlist_import; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T036 [US2] [GATE] Run full affected evidence/coverage and update specs/004-mcp-workflows/test-summary.md

## Phase 5: Galleries and website embeds

- [x] T037 [US3] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/galleries.feature and record inventory in specs/004-mcp-workflows/test-traceability.md
- [x] T038 [US3] [TDD] Add tests and matching BDD binding for list_galleries; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T039 [US3] Implement list_galleries through shared backend policy in src/server/resources/galleries.ts
- [x] T040 [US3] [GATE] Verify Green and refactor list_galleries; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T041 [US3] [TDD] Add tests and matching BDD binding for get_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T042 [US3] Implement get_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T043 [US3] [GATE] Verify Green and refactor get_gallery; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T044 [US3] [TDD] Add tests and matching BDD binding for create_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T045 [US3] Implement create_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T046 [US3] [GATE] Verify Green and refactor create_gallery; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T047 [US3] [TDD] Add tests and matching BDD binding for update_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T048 [US3] Implement update_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T049 [US3] [GATE] Verify Green and refactor update_gallery; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T050 [US3] [TDD] Add tests and matching BDD binding for delete_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T051 [US3] Implement delete_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T052 [US3] [GATE] Verify Green and refactor delete_gallery; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T053 [US3] [TDD] Add tests and matching BDD binding for publish_gallery; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T054 [US3] Implement publish_gallery through shared backend policy in src/server/resources/galleries.ts
- [x] T055 [US3] [GATE] Verify Green and refactor publish_gallery; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T056 [US3] [TDD] Add tests and matching BDD binding for get_gallery_embed; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T057 [US3] Implement get_gallery_embed through shared backend policy in src/server/resources/galleries.ts
- [x] T058 [US3] [GATE] Verify Green and refactor get_gallery_embed; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T059 [US3] [TDD] Add tests and matching BDD binding for get_gallery_preview; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T060 [US3] Implement get_gallery_preview through shared backend policy in src/server/resources/galleries.ts
- [x] T061 [US3] [GATE] Verify Green and refactor get_gallery_preview; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T062 [US3] [TDD] Add tests and matching BDD binding for get_overlay_embed; observe expected Red in test/mcp/workflows/galleries.test.ts
- [x] T063 [US3] Implement get_overlay_embed through shared backend policy in src/server/resources/galleries.ts
- [x] T064 [US3] [GATE] Verify Green and refactor get_overlay_embed; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T065 [US3] [GATE] Run full affected evidence/coverage and update specs/004-mcp-workflows/test-summary.md

## Phase 6: Creator Pages

- [x] T066 [US4] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/creator-pages.feature and record inventory in specs/004-mcp-workflows/test-traceability.md
- [x] T067 [US4] [TDD] Add tests and matching BDD binding for get_creator_page; observe expected Red in test/mcp/workflows/creator-pages.test.ts
- [x] T068 [US4] Implement get_creator_page through shared backend policy in src/server/resources/creator-pages.ts
- [x] T069 [US4] [GATE] Verify Green and refactor get_creator_page; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T070 [US4] [TDD] Add tests and matching BDD binding for update_creator_page; observe expected Red in test/mcp/workflows/creator-pages.test.ts
- [x] T071 [US4] Implement update_creator_page through shared backend policy in src/server/resources/creator-pages.ts
- [x] T072 [US4] [GATE] Verify Green and refactor update_creator_page; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T073 [US4] [TDD] Add tests and matching BDD binding for publish_creator_page; observe expected Red in test/mcp/workflows/creator-pages.test.ts
- [x] T074 [US4] Implement publish_creator_page through shared backend policy in src/server/resources/creator-pages.ts
- [x] T075 [US4] [GATE] Verify Green and refactor publish_creator_page; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T076 [US4] [GATE] Run full affected evidence/coverage and update specs/004-mcp-workflows/test-summary.md

## Phase 7: Runner setup and streaming

- [x] T077 [US5] [BDD] Specify all positive/negative and option cases in test/bdd/features/mcp-workflows/runners.feature and record inventory in specs/004-mcp-workflows/test-traceability.md
- [x] T078 [US5] [TDD] Add tests and matching BDD binding for get_runner_setup; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T079 [US5] Implement get_runner_setup through shared backend policy in src/server/resources/runners.ts
- [x] T080 [US5] [GATE] Verify Green and refactor get_runner_setup; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T081 [US5] [TDD] Add tests and matching BDD binding for list_runners; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T082 [US5] Implement list_runners through shared backend policy in src/server/resources/runners.ts
- [x] T083 [US5] [GATE] Verify Green and refactor list_runners; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T084 [US5] [TDD] Add tests and matching BDD binding for get_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T085 [US5] Implement get_runner through shared backend policy in src/server/resources/runners.ts
- [x] T086 [US5] [GATE] Verify Green and refactor get_runner; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T087 [US5] [TDD] Add tests and matching BDD binding for create_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T088 [US5] Implement create_runner through shared backend policy in src/server/resources/runners.ts
- [x] T089 [US5] [GATE] Verify Green and refactor create_runner; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T090 [US5] [TDD] Add tests and matching BDD binding for update_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T091 [US5] Implement update_runner through shared backend policy in src/server/resources/runners.ts
- [x] T092 [US5] [GATE] Verify Green and refactor update_runner; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T093 [US5] [TDD] Add tests and matching BDD binding for delete_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T094 [US5] Implement delete_runner through shared backend policy in src/server/resources/runners.ts
- [x] T095 [US5] [GATE] Verify Green and refactor delete_runner; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T096 [US5] [TDD] Add tests and matching BDD binding for unlink_runner; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T097 [US5] Implement unlink_runner through shared backend policy in src/server/resources/runners.ts
- [x] T098 [US5] [GATE] Verify Green and refactor unlink_runner; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T099 [US5] [TDD] Add tests and matching BDD binding for list_stream_sessions; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T100 [US5] Implement list_stream_sessions through shared backend policy in src/server/resources/runners.ts
- [x] T101 [US5] [GATE] Verify Green and refactor list_stream_sessions; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T102 [US5] [TDD] Add tests and matching BDD binding for get_stream_session; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T103 [US5] Implement get_stream_session through shared backend policy in src/server/resources/runners.ts
- [x] T104 [US5] [GATE] Verify Green and refactor get_stream_session; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T105 [US5] [TDD] Add tests and matching BDD binding for configure_stream_session; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T106 [US5] Implement configure_stream_session through shared backend policy in src/server/resources/runners.ts
- [x] T107 [US5] [GATE] Verify Green and refactor configure_stream_session; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T108 [US5] [TDD] Add tests and matching BDD binding for control_stream_session; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T109 [US5] Implement control_stream_session through shared backend policy in src/server/resources/runners.ts
- [x] T110 [US5] [GATE] Verify Green and refactor control_stream_session; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T111 [US5] [TDD] Add tests and matching BDD binding for get_runner_snapshot; observe expected Red in test/mcp/workflows/runners.test.ts
- [x] T112 [US5] Implement get_runner_snapshot through shared backend policy in src/server/resources/runners.ts
- [x] T113 [US5] [GATE] Verify Green and refactor get_runner_snapshot; update specs/004-mcp-workflows/tdd/cycle-log.md
- [x] T114 [US5] [GATE] Run full affected evidence/coverage and update specs/004-mcp-workflows/test-summary.md
- [x] T115 [GATE] Run affected compatibility, coverage, types, lint, format, build and migration-policy gates in specs/004-mcp-workflows/test-traceability.md
- [x] T116 [GATE] Update tool docs, llms and capability/pricing descriptions in src/app/llms-full.txt/llms-full.txt
- [x] T117 [GATE] Refresh Graphify and overall observed test summary in reports/test-summary.md
- [x] T118 [GATE] Complete traceability/defect review and record remaining external-only blockers in specs/004-mcp-workflows/test-summary.md

## Dependencies and parallelism

Foundation precedes stories. Run one behavior slice at a time, with tests before production. Independent lint/types and independent reads may run concurrently. Do not run multiple database-heavy full suites concurrently. Story services remain separable for follow-up review.

## Additional US3 completeness: public player integration

- [x] T119 [US3] [TDD] Add actual-handler public player embed evidence in test/mcp/workflows/galleries.test.ts
- [x] T120 [US3] Implement get_player_embed without private OBS credentials in src/server/resources/galleries.ts
- [x] T121 [US3] [GATE] Verify public player formats and scopes in test/bdd/features/mcp-workflows/galleries.feature

## Browser and workflow integration discovered during execution

- [x] T122 [US3] Coordinate browser gallery revisions and reject stale edits; native and existing action evidence in browser-gallery-revisions-green.log
- [x] T123 [US3] Share browser/principal creation quota lock; native concurrency evidence in gallery-quota-race-green.log
- [x] T124 [US3] Advance linked-gallery revisions during playlist deletion; linked-gallery-revision-green.log
- [x] T125 [US4] Advance settings revisions, reject stale upserts and update browser state; browser-settings-stale-green.log
- [x] T126 [US5] Advance browser stream configuration and reject stale edits; browser-runner-stale-green.log
- [x] T127 [US5] Coordinate browser start/stop revisions; browser-runner-control-stale-green.log
- [x] T128 [US5] Version browser unlink and owned-session shutdown; browser-runner-unlink-green.log
- [x] T129 [US5] Version device naming/enrollment while preserving ordinary heartbeat versions; runner-heartbeat-revision-green.log and runner-enrollment-revision-green.log
- [x] T130 [US3/US5] Reject retained creation retries for deleted resources; retry-liveness-green.log
- [x] T131 [US1] Extend read/edit consent presets and readable scope labels without silently granting consequential operations; consent-presets-green.log and consent-labels-green.log
- [x] T132 [US1] Complete typed readable activity labels for all tools; activity-labels-green.log
- [x] T133 [US1] Report live gallery limits and remote/Runner feature restrictions; capabilities-green.log
- [x] T134 [US5] Preserve reported actual state and version entitlement shutdown intent; runner-suspension-revision-green.log and runner-heartbeat-expiry-green.log
- [x] T135 [GATE] Reconcile detailed option/edge scenarios, complete coverage and finalize source-frozen regression evidence

- [x] T136 [GATE] Classify workflow fixtures in the capacity-aware database lane; actual-runner Red/Green retained in workflow-scheduler-red.log and workflow-scheduler-green.log
