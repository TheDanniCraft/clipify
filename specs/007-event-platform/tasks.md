# Tasks: Event Platform

Implementation paths below name current owners; related UI lives in src/app/components/events. Checked test tasks record focused Red/Green evidence only. BDD and implementation tasks remain open until their full acceptance boundary is verified.

## Setup

- [x] T001 Record approved scope and add Mobbin guidance in AGENTS.md and specs/007-event-platform/spec.md
- [x] T002 [GATE] Complete plan and normalized evidence in specs/007-event-platform/test-traceability.md

### FR-001 — US1

- [x] T003 [US1] [BDD] Verify FR-001 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T004 [US1] [TDD] [U1] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [x] T005 [US1] Implement FR-001 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-002 — US1

- [x] T006 [US1] [BDD] Verify FR-002 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T007 [US1] [TDD] [U2] Write focused tests in test/server/events/tour.test.ts and record intended Red in tdd/cycle-log.md
- [x] T008 [US1] Implement FR-002 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-003 — US1

- [x] T009 [US1] [BDD] Verify FR-003 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T010 [US1] [TDD] [U3] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [x] T011 [US1] Implement FR-003 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-004 — US1

- [x] T012 [US1] [BDD] Verify FR-004 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T013 [US1] [TDD] [U4] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [x] T014 [US1] Implement FR-004 in src/server/events/persistence.ts and src/app/components/events/EventEditor.tsx and relevant callers/UI; prove Green and refactor

### FR-005 — US1

- [x] T015 [US1] [BDD] Verify FR-005 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T016 [US1] [TDD] [U5] Write focused tests in test/server/events/policy.test.ts and record intended Red in tdd/cycle-log.md
- [x] T017 [US1] Implement FR-005 in src/app/lib/events.ts and relevant callers/UI; prove Green and refactor

### FR-006 — US1

- [x] T018 [US1] [BDD] Verify FR-006 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T019 [US1] [TDD] [U6] Write focused tests in test/server/events/configuration.test.ts and record intended Red in tdd/cycle-log.md
- [x] T020 [US1] Implement FR-006 in src/app/lib/eventConfiguration.ts and relevant callers/UI; prove Green and refactor

### FR-007 — US2

- [x] T021 [US2] [BDD] Verify FR-007 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T022 [US2] [TDD] [U7] Write focused tests in test/server/events/participant-auth.test.ts and record intended Red in tdd/cycle-log.md
- [x] T023 [US2] Implement FR-007 in src/server/events/participant.ts and src/auth/config.ts and relevant callers/UI; prove Green and refactor

### FR-008 — US2

- [x] T024 [US2] [BDD] Verify FR-008 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T025 [US2] [TDD] [U8] Write focused tests in test/server/events/sources.test.ts and record intended Red in tdd/cycle-log.md
- [x] T026 [US2] Implement FR-008 in src/server/events/sources.ts and relevant callers/UI; prove Green and refactor

### FR-009 — US2

- [x] T027 [US2] [BDD] Verify FR-009 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T028 [US2] [TDD] [U9] Write focused tests in test/server/events/youtube.test.ts and test/server/events/connections.test.ts and record intended Red in tdd/cycle-log.md
- [x] T029 [US2] Implement FR-009 in src/server/events/sources.ts and relevant callers/UI; prove Green and refactor

### FR-010 — US2

- [x] T030 [US2] [BDD] Verify FR-010 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T031 [US2] [TDD] [U10] Write focused tests in test/server/events/sources.test.ts and record intended Red in tdd/cycle-log.md
- [x] T032 [US2] Implement FR-010 in src/server/events/sources.ts and relevant callers/UI; prove Green and refactor

### FR-011 — US2

- [x] T033 [US2] [BDD] Verify FR-011 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T034 [US2] [TDD] [U11] Write focused tests in test/server/events/uploads.test.ts, upload-provider.test.ts, storage-security.test.ts and upload-route.test.ts and record intended Red in tdd/cycle-log.md
- [x] T035 [US2] Implement FR-011 in src/server/events/uploads.ts, upload-provider.ts, media.ts and storage-http.ts and relevant callers/UI; prove Green and refactor

### FR-012 — US2

- [x] T036 [US2] [BDD] Verify FR-012 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T037 [US2] [TDD] [U12] Write focused tests in test/server/events/persistence.test.ts and record intended Red in tdd/cycle-log.md
- [x] T038 [US2] Implement FR-012 in src/server/events/submissions.ts and relevant callers/UI; prove Green and refactor

### FR-013 — US3

- [x] T039 [US3] [BDD] Verify FR-013 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T040 [US3] [TDD] [U13] Write focused tests in test/server/events/persistence.test.ts and record intended Red in tdd/cycle-log.md
- [x] T041 [US3] Implement FR-013 in src/server/events/submissions.ts and relevant callers/UI; prove Green and refactor

### FR-014 — US3

- [x] T042 [US3] [BDD] Verify FR-014 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T043 [US3] [TDD] [U14] Write focused tests in test/server/events/persistence.test.ts and review-ui.test.tsx and record intended Red in tdd/cycle-log.md
- [x] T044 [US3] Implement FR-014 in src/server/events/review.ts and relevant callers/UI; prove Green and refactor

### FR-015 — US3

- [x] T045 [US3] [BDD] Verify FR-015 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T046 [US3] [TDD] [U15] Write focused tests in test/server/events/freeze.test.ts and record intended Red in tdd/cycle-log.md
- [x] T047 [US3] Implement FR-015 in src/server/events/freeze.ts and relevant callers/UI; prove Green and refactor

### FR-016 — US4

- [x] T048 [US4] [BDD] Verify FR-016 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T049 [US4] [TDD] [U16] Write focused tests in test/server/events/persistence.test.ts and record intended Red in tdd/cycle-log.md
- [x] T050 [US4] Implement FR-016 in src/server/events/voting.ts and relevant callers/UI; prove Green and refactor

### FR-017 — US4

- [x] T051 [US4] [BDD] Verify FR-017 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T052 [US4] [TDD] [U17] Write focused tests in test/server/events/media.test.tsx and public-page.test.tsx and record intended Red in tdd/cycle-log.md
- [x] T053 [US4] Implement FR-017 in src/server/events/voting.ts and relevant callers/UI; prove Green and refactor

### FR-018 — US5

- [x] T054 [US5] [BDD] Verify FR-018 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T055 [US5] [TDD] [U18] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [x] T056 [US5] Implement FR-018 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-019 — US5

- [x] T057 [US5] [BDD] Verify FR-019 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T058 [US5] [TDD] [U19] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [x] T059 [US5] Implement FR-019 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-020 — US5

- [x] T060 [US5] [BDD] Verify FR-020 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T061 [US5] [TDD] [U20] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [x] T062 [US5] Implement FR-020 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-021 — US5

- [x] T063 [US5] [BDD] Verify FR-021 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T064 [US5] [TDD] [U21] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [x] T065 [US5] Implement FR-021 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### FR-022 — US5

- [x] T066 [US5] [BDD] Verify FR-022 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T067 [US5] [TDD] [U22] Write focused tests in test/server/events/chat-buffer.test.ts and test/server/events/chat-catalog.test.ts and record intended Red in tdd/cycle-log.md
- [x] T068 [US5] Implement FR-022 in src/server/events/chat.ts and relevant callers/UI; prove Green and refactor

### FR-023 — US6

- [x] T069 [US6] [BDD] Verify FR-023 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T070 [US6] [TDD] [U23] Write focused tests in test/server/events/persistence.test.ts and test/server/events/discovery.test.ts and record intended Red in tdd/cycle-log.md
- [x] T071 [US6] Implement FR-023 in src/server/events/lifecycle.ts and relevant callers/UI; prove Green and refactor

### FR-024 — US6

- [x] T072 [US6] [BDD] Verify FR-024 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T073 [US6] [TDD] [U24] Write focused tests in test/server/events/mcp.test.ts and record intended Red in tdd/cycle-log.md
- [x] T074 [US6] Implement FR-024 in src/server/events/mcp.ts and relevant callers/UI; prove Green and refactor

### FR-025 — US1

- [x] T075 [US1] [BDD] Verify FR-025 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T076 [US1] [TDD] [U25] Write focused tests in test/server/events/ui.test.ts and record intended Red in tdd/cycle-log.md
- [x] T077 [US1] Implement FR-025 in src/server/events/ui.ts and relevant callers/UI; prove Green and refactor

### EC-001 — US1

- [x] T078 [US1] [BDD] Verify EC-001 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T079 [US1] [TDD] [U26] Write focused tests in test/server/events/policy.test.ts and record intended Red in tdd/cycle-log.md
- [x] T080 [US1] Implement EC-001 in src/app/lib/events.ts and relevant callers/UI; prove Green and refactor

### EC-002 — US2

- [x] T081 [US2] [BDD] Verify EC-002 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T082 [US2] [TDD] [U27] Write focused tests in test/server/events/storage-security.test.ts and test/server/events/uploads.test.ts and record intended Red in tdd/cycle-log.md
- [x] T083 [US2] Implement EC-002 in src/server/events/uploads.ts, upload-provider.ts, media.ts and storage-http.ts and relevant callers/UI; prove Green and refactor

### EC-003 — US2

- [x] T084 [US2] [BDD] Verify EC-003 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T085 [US2] [TDD] [U28] Write focused tests in test/server/events/persistence.test.ts and test/server/events/concurrency.test.ts and record intended Red in tdd/cycle-log.md
- [x] T086 [US2] Implement EC-003 in src/server/events/submissions.ts and relevant callers/UI; prove Green and refactor

### EC-004 — US3

- [x] T087 [US3] [BDD] Verify EC-004 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T088 [US3] [TDD] [U29] Write focused tests in test/server/events/persistence.test.ts and record intended Red in tdd/cycle-log.md
- [x] T089 [US3] Implement EC-004 in src/server/events/review.ts and relevant callers/UI; prove Green and refactor

### EC-005 — US3

- [x] T090 [US3] [BDD] Verify EC-005 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T091 [US3] [TDD] [U30] Write focused tests in test/server/events/freeze.test.ts and record intended Red in tdd/cycle-log.md
- [x] T092 [US3] Implement EC-005 in src/server/events/freeze.ts and relevant callers/UI; prove Green and refactor

### EC-006 — US4

- [x] T093 [US4] [BDD] Verify EC-006 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T094 [US4] [TDD] [U31] Write focused tests in test/server/events/persistence.test.ts and test/server/events/concurrency.test.ts and record intended Red in tdd/cycle-log.md
- [x] T095 [US4] Implement EC-006 in src/server/events/voting.ts and relevant callers/UI; prove Green and refactor

### EC-007 — US5

- [x] T096 [US5] [BDD] Verify EC-007 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T097 [US5] [TDD] [U32] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [x] T098 [US5] Implement EC-007 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### EC-008 — US5

- [x] T099 [US5] [BDD] Verify EC-008 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T100 [US5] [TDD] [U33] Write focused tests in test/server/events/presenter.test.ts and record intended Red in tdd/cycle-log.md
- [x] T101 [US5] Implement EC-008 in src/server/events/presenter.ts and relevant callers/UI; prove Green and refactor

### EC-009 — US6

- [x] T102 [US6] [BDD] Verify EC-009 through the concrete owning browser/native scenarios in test-traceability.md; keep one executable owner for shared BDD/ATDD
- [x] T103 [US6] [TDD] [U34] Write focused tests in test/server/events/persistence.test.ts and test/server/events/discovery.test.ts and record intended Red in tdd/cycle-log.md
- [x] T104 [US6] Implement EC-009 in src/server/events/lifecycle.ts and relevant callers/UI; prove Green and refactor

## Final validation

- [x] T105 [GATE] Rehearse complete pilot via real browser, review desktop/mobile and themes; update test-summary.md and defect-log.md
- [x] T106 [GATE] Run affected tests, review CI gates and open normal GitHub PR once complete

## Dependencies

Configuration/policy → auth/sources/storage/submissions → review/freeze → voting → presenter/chat → publication/MCP. UI follows shared service contracts. Independent research may run in parallel; mutation/test execution has one owner per boundary.

## Phase 1: Convergence

Assessment: 25 FRs, 9 edge cases, 6 stories and 5 success criteria; the five implementation/validation plan decisions and thirteen constitution principles were considered. No additional event type, billing tier, provider index or optional interaction is required. Remaining findings are partial gaps, not new product scope.

- [x] T107 CRITICAL Reconcile the actual owning browser/native artifacts, task completion and test list in test-traceability.md, tdd/test-list.md, test-summary.md and defect-log.md; materialize reports/test-summary.md. Record verification-first UI checks honestly instead of claiming retrospective Red evidence per Constitution I, IV, TF-7 and TF-8 (contradicts).
- [x] T108 Add local error/retry recovery for unavailable image/audio/video content in EventMedia.tsx, preserving show navigation, with a focused failing test before the fix per EC-008 (partial).
- [x] T109 Exercise real clip autocomplete/link-rule rejection and statistics-slide editing/presentation in the browser, and include Twitch emote rendering in the signed-chat journey per FR-008, FR-019, FR-022 and Constitution II (partial).
- [x] T110 Verify the final current-step visibility fix and completed pilot/browser journeys, inspect both themes and viewport screenshots, then update the normal reviewable PR and its gate evidence without weakening thresholds per FR-025, SC-001 through SC-005 and plan: completion boundary (partial).
- [x] T111 Reject disabled-host stale-page writes and source requests through the shared public-event guard, locking creator lifecycle before event rows, with a real PostgreSQL Red/Green check per EC-001, EC-003 and Constitution III (contradicts).

Completion evidence: normal [PR #560](https://github.com/TheDanniCraft/clipify/pull/560) is open. Thirteen Awards browser journeys, the affected whole-file service/native checks, both themes and desktop/mobile inspection are complete. Full CI caller findings and their corrections are documented in tdd/cycle-log.md; the required replacement CI result is tracked on the PR. Task completion does not authorize merge or deployment before that gate passes.

## Event editor follow-up

- [x] T112 Fix all visible HeroUI Event switches and verify the actual control, including the Pro upgrade interaction.
- [x] T113 Provide Event-scoped grouped sidebar navigation while preserving drafts, global account controls and mobile access; inspect Payloadbay PR 13 and Mobbin references.
- [x] T114 Add a real presentation preview beside ordered slide tiles and focused inline chat settings; simplify empty Review states and library metadata.
- [x] T115 Add a revocable, read-only shared preview capability, including protected root-candidate media and denial of publishing/group originals.
- [x] T116 Add the requested nineteen-category Babbler example through the same authorized dashboard/MCP service, with all-time creator clips and labelled demo data.
- [x] T117 Verify contextual Google Drive/YouTube scopes using installed-provider and real browser authorization redirects without using live provider accounts as fixtures.
- [x] T118 Rehearse all affected Event browser journeys, record the follow-up evidence and push the completed slice to PR #560.

Creating the example in the user's actual account is an external follow-up after the connected MCP server exposes the branch's Event actions. Authentication now succeeds for the approved creator, but its deployed capability list contains no Event operations. No direct shared-database seeding substitutes for that authorized route.

## Presenter feedback — 11 November 2026

- [x] T119 Sequence title movement before media appears, preload the next six nominee images, preserve text scale during shared-layout flights, return the outgoing card before lifting the next, use a stable nominee order independent of votes, and add Space/Escape playback navigation with a compact close control. Verify title/media separation, image preloading, text scale during flight and the real keyboard flow.
- [x] T120 Add a per-category presenter choice between showing nominees and showing only the winner, including data awards.
- [x] T121 For data-award nominees, support automatic top clips from the frozen snapshot or explicit team selections. Count the winner toward the total nominee limit, allowing four additional selections for a five-entry show and all selected entries when unlimited. Permit low-view clips in team selections when they satisfy the configured source rules.
- [x] T122 Show storage connection actions in the context of the selected S3/Google Drive storage location and show YouTube linking when required by the configured source. Reuse Better Auth and its production proxy.
- [x] T123 Add optional Twitch poll/prediction authorization through Better Auth, requesting the appropriate manage scopes only when needed. Configure the connection centrally and activation per category slide.
- [x] T124 Enforce Twitch's complete-option limits before allowing a slide interaction: two to five poll choices or two to ten prediction outcomes. Keep every nominee included and revalidate the actual nominees when starting an interaction.
- [x] T125 Add an optional slide navigation lock until its poll finishes or prediction entry window closes, then resolve predictions when the award winner is revealed. Keep the host's show sequence operable on provider failures.

## Reveal and reverse-navigation follow-up

- [x] T126 Replace unstable shared card projection with a short focused reveal while retaining the nominee strip. Reserve title/result space, keep the final score readable without a temporary zero, integrate placement labels, and restore previous steps/media returns without replaying entrances. Verify early/intermediate/final frames and immediate/repeated backwards navigation with real components.
- [x] T127 Update the YouTube connection-start browser fixture to configure a YouTube category before testing its contextual connection action; retain the actual failure-recovery and Better Auth consent assertions.

- [x] T128 Restore the requested single-card flight between the main presentation area and its reserved nominee slot. Return the outgoing card before raising the next, animate position/width without scaling captions, retain stable result geometry and instant Back/Escape recovery, and verify actual in-flight frames and one card per nominee.

- [x] T129 Preserve the complete featured wrapper height during single-card flights so placement labels remain above the card without a landing jump. Make first place explicit with a trophy announcement and stronger winner emphasis. Sample label/card geometry during the flight and retain all existing presenter journeys.

- [x] T130 Resolve chatters' active 7TV badges from the official API with bounded cached lookups and graceful provider failure, render alongside Twitch badges/emotes, and verify the signed EventSub-to-browser journey.
- [x] T131 Keep enabled chat mounted alongside the entire show, including nominee overview, media and reveals, and enable chat for the owned Babbler demo. Preserve the preview's read-only capability boundary and verify both themes and responsive layouts.

- [x] T132 Replace chat polling and preview placeholders with a capability-checked live WebSocket subscription on the existing endpoint. Keep text independent of badge lookup latency, preserve messages across reconnects, recheck/revoke access, clean up subscriptions, and verify draft-preview chat plus signed EventSub delivery without enabling write controls.

- [x] T133 Use event-authorized native Twitch clip playback across presenter/preview/review/voting, preserve volume/mute and optional streaming audio leveling, verify quiet/loud output plus mute/volume/bypass/cleanup in Chromium, and inspect real controls in light/dark desktop/mobile presenter and voting journeys. Keep YouTube embeds and other preview webhooks unchanged.

- [x] T134 Let the presenter use ultrawide viewports without a fixed 16:9 canvas; remove ultrawide page/stage caps, size nominees with available height and keep chat readable. Verify both themes at 3440×1440 and 5120×1080 alongside the existing mobile/desktop journeys, preserving flights, reveals, keyboard playback and media proportions.

- [x] T135 Complete the approved bronze/silver/gold ceremony: anticipation on the empty stage, single-card entrance, post-arrival score and winner emphasis, gold spotlight and finite confetti. Unify winner-only data awards, retain manual navigation/media, and verify Back/reduced-motion behavior and real browser flight/placement geometry in both themes and all existing viewport sizes.
