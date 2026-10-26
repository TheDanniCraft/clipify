# Tasks: User tours

Tests precede their implementation. US2 and US3 depend on the US1 guide infrastructure. No parallel implementation agents.

- [x] T001 [GATE] Initialize spec, design, scenarios and traceability in specs/005-user-tour/
- [x] T002 [TDD] Write failing progress/parser/catalog tests in test/app/lib/userTour.test.ts
- [x] T003 [GATE] Record intended state-test red in specs/005-user-tour/tdd/cycle-log.md
- [x] T004 [US1] Implement state/catalog in src/app/lib/userTour.ts and run green/refactor
- [x] T005 [TDD] Write failing provider and spotlight tests in test/app/components/user-tour/
- [x] T006 [US1] Implement panel/provider/adapter in src/app/components/user-tour/ and run green/refactor
- [x] T007 [BDD] Bind core journey scenarios in test/bdd/steps/user-tour.steps.ts and observe red
- [x] T008 [US1] Wire successful overlay actions and targets in src/app/components/OverlayTable/index.tsx and src/app/dashboard/overlay/[overlayId]/page.tsx
- [x] T009 [TDD] Add failing theme and playlist integration tests in test/app/dashboard/
- [x] T010 [US2] Wire appearance targets and save outcomes in src/app/dashboard/overlay/[overlayId]/theme/page.tsx
- [x] T011 [US3] Wire playlist targets, save/order/association outcomes in src/app/dashboard/playlist/[playlistId]/page.tsx
- [x] T012 [BDD] Complete browser bindings and run all feature scenarios in test/bdd/steps/user-tour.steps.ts
- [ ] T013 [GATE] Run required affected suites, browser, coverage, lint, format, types and build from specs/005-user-tour/plan.md
- [x] T014 [GATE] Update traceability, defects and summary in specs/005-user-tour/ and prepare draft PR

T013: affected tests, all feature browser examples, lint, formatting, types and builds verified locally; full merge coverage/Test and baseline security remediation remain pending. T014: reports and draft PR description prepared.

## UX revision

- [x] R001 Record revised first-use, corner, skip/resume, normal-control and discovery requirements.
- [x] R002 Observe six failing state tests, implement step routing, handoffs and separate skips.
- [x] R003 Replace guide controls with HeroUI checkboxes/buttons/progress; remove application Save replacements.
- [x] R004 Add website code-copy and optional gallery/tools/support introductions, consent handoff and locked-filter protection.
- [x] R005 Verify affected tests, all 32 owning browser examples, visuals, lint/format/types/build and record draft review evidence.

## Quiet checklist and account-persistence revision

- [x] Q001 Inspect Usertour source, Userflow and comparable primary documentation; record decisions.
- [x] Q002 Replace chips/cards/footer with a ring, single HeroUI accordion and skip popover.
- [x] Q003 Persist validated account events in the existing content-state table with authenticated writes, row locking, retry and legacy migration.
- [x] Q004 Replace guide-driven page changes with normal links, tabs, edit controls and menu actions; replay creation at Add Overlay.
- [x] Q005 Add account, concurrency, navigation, native ARIA and focus regression coverage.
- [x] Q006 Complete current affected tests, all 39 browser examples, visual review, lint/format/types/build and evidence update.

## Personalization and checkpoint refinement

- [x] P001 Keep section label and progress with persisted account state.
- [x] P002 Add filters before styling and Back for review from save steps.
- [x] P003 Start styling in place and resume the checkpoint through normal Theme Studio navigation.
- [x] P004 Highlight the full styling workspace and explain its groups without nested subtasks.
- [x] P005 Verify affected suites, owning browser cases, presentation, lint/types/build and push the draft update.

## Dropdown and progress consistency

- [x] D001 Preserve the spotlight mask and elevate native portal controls.
- [x] D002 Show section progress with partial active-task credit and no replay double count.
- [x] D003 Verify the real dropdown, outside dismissal, selection and database reload in browser case 042; run affected suites and checks.

## Universal HeroUI navigation and consistent progress format

- [x] H001 Keep the ring and launcher accessible name in section percent in all states.
- [x] H002 Replace Driver’s visible native buttons with React/HeroUI actions.
- [x] H003 Permit Back after the first action in every task and replan real navigation across pages.
- [x] H004 Verify model, portal controls, relevant browser journeys, visual presentation and required checks before pushing.

## Remove duplicate filter onboarding

- [x] F001 Keep filters only in Choose your clips; appearance has one styling task.
- [x] F002 Preserve completed filter work and map old active checkpoints to the core flow.
- [x] F003 Verify affected suites, owning styling/filter browser cases and checks; push the draft update.
