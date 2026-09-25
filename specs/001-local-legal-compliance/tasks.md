# Tasks: Local Legal and Privacy Documents

**Input**: Design documents from `specs/001-local-legal-compliance/`

**Scope boundary**: This feature replaces hosted GoAdopt legal-document links with locally maintained legal pages. The existing c15t consent engine is a read-only source for categories, registered services, and the existing preferences dialog. These tasks MUST NOT change c15t categories, defaults, persistence, APIs, activation, revocation, reload behavior, cleanup, or preference-dialog semantics.

**Tests**: Mandatory. Every production slice follows Red → Green → Refactor. The existing Playwright-BDD feature owns each browser artifact and also carries the ATDD evidence role because each browser-visible scenario is the stakeholder acceptance boundary.

## Format

`- [ ] T### [P?] [US#?] [TDD|BDD|ATDD|GATE] Description with exact file path`

- **[P]**: May run in parallel because the task touches different files and has no unfinished dependency.
- **[US#]**: Maps the task to a user story from `spec.md`.
- **Suite marker**: Required as the first description token for test and non-product quality-gate tasks.

---

## Phase 1: Setup (Shared Test Infrastructure)

**Purpose**: Add only the test tooling and directory structure needed to implement the feature test-first.

- [x] T001 Add `@playwright/test` and `playwright-bdd` as development dependencies in `package.json` and update `bun.lock`
- [x] T002 Add the feature to the existing `test:bdd` pipeline and add the `test:compliance` script in `package.json`
- [x] T003 [P] Configure the Playwright BDD runner, web server, trace retention, and report paths in `playwright.config.ts`
- [x] T004 [P] Create shared BDD/ATDD browser fixtures without feature behavior in `test/bdd/support/fixtures.ts`
- [x] T005 [P] Create shared legal-document test builders without production behavior in `test/support/legalDocuments.ts`
- [x] T006 [GATE] Run the existing Jest suite with `bun run test -- --runInBand` and record the pre-feature baseline in `specs/001-local-legal-compliance/test-summary.md`

**Checkpoint**: Test infrastructure is available and the existing baseline is known; no legal-document production behavior has been added.

---

## Phase 2: Foundational Governance (Blocking Prerequisites)

**Purpose**: Establish the canonical evidence relationships before any user-story implementation.

**⚠️ CRITICAL**: No user-story production work begins until this phase is complete.

- [x] T007 [GATE] Confirm all FR, SC, EC, user-story, TDD, and ATDD identifiers remain uniquely mapped in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T008 [GATE] Confirm the canonical test commands, thresholds, evidence paths, and Red/Green status vocabulary in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T009 [GATE] Confirm `specs/001-local-legal-compliance/defect-log.md` and `specs/001-local-legal-compliance/test-summary.md` link back to `specs/001-local-legal-compliance/plan.md` and `specs/001-local-legal-compliance/test-traceability.md`
- [x] T010 [GATE] Record the immutable scope boundary—local documents only, c15t read-only, EU/EEA and German baseline, one English document set—in `specs/001-local-legal-compliance/test-traceability.md`

**Checkpoint**: Traceability and reporting artifacts are ready to receive Red and Green evidence.

---

## Phase 3: User Story 1 — Understand Local Legal Disclosures (Priority: P1) 🎯 MVP

**Goal**: Visitors can reach readable, local privacy and cookie documents that accurately describe Clipify's operator, processing, services, storage, and current product behavior without relying on GoAdopt.

**Independent test**: From the public site, visit every local legal route and footer/login consent link; verify required topics, metadata, responsive/keyboard access, no GoAdopt navigation, and safe supplemental device-storage disclosure.

### Scenario Specification

- [x] T011 [US1] [ATDD] [A1] [A3] Define `@ATDD-US1-001` for local legal navigation, required metadata, English content, 320px layout, and keyboard access in `test/bdd/features/local-legal-compliance.feature`
- [x] T012 [US1] [ATDD] [A6] Define `@ATDD-US1-002` for readable disclosures when JavaScript or the consent backend is unavailable, without claiming a saved preference, in `test/bdd/features/local-legal-compliance.feature`
- [x] T013 [US1] [ATDD] [A12] Define `@ATDD-US1-003` for a clearly supplemental, partial device-storage view in `test/bdd/features/local-legal-compliance.feature`
- [x] T014 [US1] [GATE] [A1] [A3] [A6] [A12] Register ATDD-US1-001–003 as the shared BDD-owned ATDD/BDD evidence and add their source relationships and examples in `specs/001-local-legal-compliance/test-traceability.md`

### Slice 1 — Local Document Model, Privacy Content, and Public Routes

- [x] T015 [US1] [ATDD] [A1] [A3] Implement failing bindings for `@ATDD-US1-001` route, metadata, accessibility, and responsive assertions in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T016 [P] [US1] [TDD] [U1] [U2] Create failing `TDD-US1-001` tests for the legal-document manifest, canonical local routes, titles, versions, effective dates, and update dates in `test/app/lib/legalDocuments.test.ts`
- [x] T017 [P] [US1] [TDD] [U3] Create failing `TDD-US1-002` tests for all required privacy-policy topics and verified operator/processing disclosures in `test/app/lib/legalContent.test.ts`
- [x] T018 [US1] [GATE] [A1] [A3] [U1] [U2] [U3] [U32] [U33] [U34] [U35] Run `@ATDD-US1-001`, `TDD-US1-001`, `TDD-US1-002`, and the legal layout/route tests; confirm failures are caused only by missing local documents and record Red in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T019 [US1] [U1] [U2] [U3] Implement typed document metadata, versioning fields, operator facts, and independently authored privacy content in `src/app/lib/legal/documents.ts`
- [x] T142 [P] [US1] [TDD] [U32] Create a failing component test for semantic title, version, effective-date, and scope rendering in `test/app/components/legal/LegalDocumentLayout.test.tsx`
- [x] T143 [P] [US1] [TDD] [U33] Create a failing component test for the five canonical destinations and current-document state in `test/app/components/legal/LegalDocumentLayout.test.tsx`
- [x] T020 [P] [US1] [A1] [A3] [U32] [U33] Implement the shared responsive legal-document shell and section navigation in `src/app/components/legal/LegalDocumentLayout.tsx`
- [x] T144 [P] [US1] [TDD] [U34] Create a failing route-component test for server-rendered privacy metadata and ordered sections in `test/app/legal/legalRoutes.test.tsx`
- [x] T021 [P] [US1] [A1] [A2] [U3] [U34] Implement the local privacy-policy page and metadata in `src/app/legal/privacy/page.tsx`
- [x] T145 [P] [US1] [TDD] [U35] Create a failing route-component test for server-rendered cookie metadata and its authoritative disclosure region in `test/app/legal/legalRoutes.test.tsx`
- [x] T022 [P] [US1] [A1] [A2] [A4] [U1] [U2] [U35] Implement the local cookie-policy page and metadata shell in `src/app/legal/cookies/page.tsx`
- [x] T023 [US1] [GATE] [A2] [A3] [U1] [U2] [U3] [U32] [U33] [U34] [U35] Rerun the document and legal layout/route tests to Green; record that `@ATDD-US1-001` remains the expected outer Red until the terms and privacy-request routes are composed in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T024 [US1] [A1] [A3] [U32] [U33] Refactor shared legal-section rendering and semantics while keeping slice evidence green in `src/app/components/legal/LegalDocumentLayout.tsx`

### Slice 2 — Remove GoAdopt Navigation

- [x] T025 [US1] [TDD] [U4] Create failing `TDD-US1-003` tests proving all user-facing legal and privacy-request links resolve locally and no GoAdopt URL remains in `test/app/lib/legalLinkMigration.test.ts`
- [x] T026 [US1] [GATE] [U4] Run `TDD-US1-003`; confirm the current hosted links produce the intended Red result and record it in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T027 [P] [US1] [A1] [U4] Replace hosted legal links with local routes in `src/app/components/footer.tsx`
- [x] T028 [P] [US1] [A1] [U4] Replace hosted privacy and terms links with local routes in `src/app/login/page.tsx`
- [x] T029 [P] [US1] [A1] [U4] Replace hosted privacy links with local routes in `src/app/components/ConsentManager.tsx`
- [x] T030 [P] [US1] [U4] Update machine-readable legal URLs in `src/app/llms.txt/llms.txt` and `src/app/llms-full.txt/llms-full.txt`
- [x] T032 [US1] [U4] Refactor the shared legal-route constants without changing destinations in `src/app/lib/legal/documents.ts`

### Slice 3 — Service Registry Disclosure and Supplemental Device View

- [x] T033 [US1] [ATDD] [A6] [A12] Implement failing bindings for `@ATDD-US1-002` and `@ATDD-US1-003` in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T034 [P] [US1] [TDD] [U5] [U6] [U7] [U8] [U9] [U10] Create failing `TDD-US1-004` tests for complete, consistent purpose/provider/storage/recipient/retention/legal-basis disclosure metadata in `test/app/lib/consentRegistry.test.ts`
- [x] T035 [P] [US1] [TDD] [U11] [U12] Create failing `TDD-US1-005` tests proving the device inspector lists only approved keys/patterns, never values, and labels its view as partial in `test/app/components/legal/DeviceStorageInspector.test.tsx`
- [x] T036 [US1] [GATE] [A2] [A6] [A12] [U5] [U6] [U7] [U8] [U9] [U10] [U11] [U12] Run `@ATDD-US1-002`, `@ATDD-US1-003`, `TDD-US1-004`, and `TDD-US1-005`; confirm intended Red failures and record them in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T037 [US1] [U5] [U6] [U7] [U8] [U9] [U10] Add document-only disclosure metadata to existing service definitions without changing consent behavior in `src/app/lib/consent/registry.ts`
- [x] T038 [P] [US1] [A2] [A4] [U5] [U9] [U10] Implement the read-only service and storage disclosure view in `src/app/components/legal/ServiceDisclosure.tsx`
- [x] T039 [P] [US1] [A12] [U11] [U12] Implement the safe, value-free, supplemental browser storage inspector in `src/app/components/legal/DeviceStorageInspector.tsx`
- [x] T040 [US1] [A2] [A4] [A12] [U5] [U10] [U11] [U12] Compose verified service disclosures and the supplemental device view into `src/app/legal/cookies/page.tsx`
- [x] T041 [US1] [GATE] [A2] [A6] [A12] [U5] [U6] [U7] [U8] [U9] [U10] [U11] [U12] Rerun `@ATDD-US1-002`, `@ATDD-US1-003`, `TDD-US1-004`, and `TDD-US1-005`; record Green evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T042 [US1] [A2] [A4] [A12] [U5] [U10] [U11] [U12] Refactor disclosure presentation while preserving registry completeness and value-free inspection in `src/app/components/legal/ServiceDisclosure.tsx` and `src/app/components/legal/DeviceStorageInspector.tsx`

### User Story 1 Completion

- [x] T044 [US1] [GATE] [A2] Run the complete-service-disclosure acceptance scenario to Green and record its evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T045 [US1] [GATE] [A3] Run the keyboard, accessibility, and 320px acceptance scenario to Green and record defects and release impact in `specs/001-local-legal-compliance/defect-log.md`
- [x] T046 [US1] [GATE] Record US1 execution totals, coverage, risks, evidence links, and Go/No-Go recommendation in `specs/001-local-legal-compliance/test-summary.md`

**Checkpoint**: Local privacy/cookie disclosures are independently usable and no public navigation depends on GoAdopt.

---

## Phase 4: User Story 2 — Review Services and Open Existing Preferences (Priority: P1)

**Goal**: Visitors see a read-only explanation of the existing c15t categories and can open the existing c15t preference dialog without creating a second consent state or changing c15t behavior.

**Independent test**: Open the cookie policy, inspect necessary/functionality/measurement disclosures, launch the existing preferences dialog, and verify the legal page remains readable with an honest fallback when that dialog is unavailable.

### Scenario Specification

- [x] T047 [US2] [ATDD] [A4] Define `@ATDD-US2-001` for read-only projection of the existing c15t categories and current selection state in `test/bdd/features/local-legal-compliance.feature`
- [x] T048 [US2] [ATDD] [A2] [A4] Define `@ATDD-US2-002` as a scenario outline with explicit necessary, functionality, and measurement examples in `test/bdd/features/local-legal-compliance.feature`
- [x] T049 [US2] [ATDD] [A5] Define `@ATDD-US2-003` for opening the existing c15t preferences dialog from the legal page in `test/bdd/features/local-legal-compliance.feature`
- [x] T050 [US2] [ATDD] [A6] Define `@ATDD-US2-004` for an unavailable preferences dialog with readable documents and no false save state in `test/bdd/features/local-legal-compliance.feature`
- [x] T051 [US2] [GATE] [A2] [A4] [A5] [A6] Register ATDD-US2-001–004 as the shared BDD-owned ATDD/BDD evidence and enumerate every outline example in `specs/001-local-legal-compliance/test-traceability.md`

### Slice 1 — Read-Only Category Projection and Classification

- [x] T052 [US2] [ATDD] [A2] [A4] Implement failing bindings for `@ATDD-US2-001` and the three `@ATDD-US2-002` examples in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T053 [P] [US2] [TDD] [U13] Create failing `TDD-US2-002` tests for a read-only projection of current c15t category names, descriptions, services, and selection state in `test/app/lib/legalConsentProjection.test.ts`
- [x] T054 [P] [US2] [TDD] [U14] Create failing `TDD-US2-004` tests for truthful necessary/always-on classifications without fake toggles in `test/app/lib/legalServiceClassification.test.ts`
- [x] T055 [US2] [GATE] [A2] [A4] [U13] [U14] Run `@ATDD-US2-001`, `@ATDD-US2-002`, `TDD-US2-002`, and `TDD-US2-004`; record intended Red results in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T056 [US2] [U13] [U14] Implement pure read-only legal projection helpers over existing c15t categories and service metadata in `src/app/lib/legal/consentProjection.ts`
- [x] T057 [US2] [A2] [A4] [U13] [U14] Render projected categories, current selections, and necessary/always-on explanations without controls in `src/app/components/legal/ConsentCategoryDisclosure.tsx`
- [x] T058 [US2] [A2] [A4] [U13] [U14] Integrate the projection into the cookie policy without changing consent state in `src/app/legal/cookies/page.tsx`
- [x] T059 [US2] [GATE] [A2] [A4] [U13] [U14] Rerun `@ATDD-US2-001`, `@ATDD-US2-002`, `TDD-US2-002`, and `TDD-US2-004`; record Green evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T060 [US2] [U13] [U14] Refactor projection and classification rendering while keeping the slice green in `src/app/lib/legal/consentProjection.ts` and `src/app/components/legal/ConsentCategoryDisclosure.tsx`

### Slice 2 — Existing Preferences Dialog and Unavailable Fallback

- [x] T061 [US2] [ATDD] [A5] [A6] Implement failing bindings for `@ATDD-US2-003` and `@ATDD-US2-004` in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T062 [P] [US2] [TDD] [U15] [U16] Create failing `TDD-US2-001` tests proving the legal-page control invokes only the existing `CookiePreferencesLink` integration and reports unavailable integration honestly in `test/app/components/legal/CookiePreferencesLink.test.tsx`
- [x] T063 [P] [US2] [TDD] [U17] Create failing `TDD-US2-003` boundary tests proving legal helpers cannot mutate c15t consent state, storage, or APIs in `test/app/lib/legalConsentBoundary.test.ts`
- [x] T064 [US2] [GATE] [A5] [A6] [U15] [U16] [U17] Run `@ATDD-US2-003`, `@ATDD-US2-004`, `TDD-US2-001`, and `TDD-US2-003`; record intended Red results in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T065 [US2] [A5] [U15] Implement the legal-page preferences control by reusing the existing c15t open-dialog event in `src/app/components/legal/CookiePreferencesLink.tsx`
- [x] T066 [US2] [A6] [U16] Add an honest unavailable-dialog state that preserves document access and never claims a saved choice in `src/app/components/legal/CookiePreferencesLink.tsx`
- [x] T067 [US2] [A5] [A6] [U15] [U16] Add the existing-preferences control to the cookie policy in `src/app/legal/cookies/page.tsx`
- [x] T068 [US2] [GATE] [A5] [A6] [U15] [U16] [U17] Rerun `@ATDD-US2-003`, `@ATDD-US2-004`, `TDD-US2-001`, and `TDD-US2-003`; record Green evidence and confirm no c15t runtime file changed outside document metadata in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T069 [US2] [U15] [U16] Refactor the preferences control and fallback copy while preserving the existing c15t integration contract in `src/app/components/legal/CookiePreferencesLink.tsx`

### User Story 2 Completion

- [x] T070 [US2] [GATE] [A4] Run the complete category/service disclosure acceptance scenario to Green and retain its evidence in `specs/001-local-legal-compliance/test-summary.md`
- [x] T071 [US2] [GATE] [A5] Run the existing-preferences-dialog acceptance scenario to Green and update its status in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T072 [US2] [GATE] [A6] Run the unavailable-interface acceptance scenario to Green and record defects and c15t-boundary decisions in `specs/001-local-legal-compliance/defect-log.md`
- [x] T073 [US2] [GATE] Record US2 execution totals, coverage, risks, evidence links, and Go/No-Go recommendation in `specs/001-local-legal-compliance/test-summary.md`

**Checkpoint**: Legal pages explain and launch the existing c15t experience without becoming a consent engine.

---

## Phase 5: User Story 3 — Exercise Privacy Rights and Review Terms (Priority: P2)

**Goal**: Visitors can understand how to submit a qualified privacy request and can review the applicable service terms before using an account, paid plan, or self-hosted runner.

**Independent test**: Reach the privacy-request and terms routes without an account; verify identity-verification, retention, applicability, contact, account, billing, acceptable-use, and runner clauses.

### Scenario Specification

- [x] T074 [US3] [ATDD] [A7] [A8] [A9] Define `@ATDD-US3-001` for a no-account privacy-request journey including verification, qualifications, retention, response process, and contact method in `test/bdd/features/local-legal-compliance.feature`
- [x] T075 [US3] [ATDD] Define `@ATDD-US3-002` for reviewing account, paid-plan, and self-hosted-runner terms before commitment in `test/bdd/features/local-legal-compliance.feature`
- [x] T076 [US3] [GATE] [A7] [A8] [A9] Register ATDD-US3-001–002 as shared BDD-owned ATDD/BDD evidence and map all qualifications and terms topics in `specs/001-local-legal-compliance/test-traceability.md`

### Slice 1 — Privacy Requests

- [x] T077 [US3] [ATDD] [A7] [A8] [A9] Implement failing bindings for `@ATDD-US3-001` in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T078 [US3] [TDD] [U18] [U19] [U20] Create failing `TDD-US3-001` tests for request types, identity verification, prohibited credentials, legal-retention exceptions, applicability qualifications, response process, and contact details in `test/app/lib/legalRights.test.ts`
- [x] T079 [US3] [GATE] [A7] [A8] [A9] [U18] [U19] [U20] Run `@ATDD-US3-001` and `TDD-US3-001`; confirm intended Red failures and record them in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T080 [US3] [U18] [U19] [U20] Implement independently authored privacy-request guidance and qualifications in `src/app/lib/legal/rights.ts`
- [x] T146 [US3] [TDD] [U37] Create a failing route-component test for privacy-request metadata, qualified rights guidance, and the durable contact route in `test/app/legal/legalRoutes.test.tsx`
- [x] T081 [US3] [A1] [A7] [A8] [A9] [U18] [U20] [U37] Implement the public privacy-request route and metadata in `src/app/legal/privacy-requests/page.tsx`
- [x] T082 [US3] [GATE] [A1] [A7] [A8] [A9] [U18] [U19] [U20] [U37] Rerun `@ATDD-US3-001`, `TDD-US3-001`, and the privacy-request route test; record Green evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T083 [US3] [U18] [U19] [U20] Refactor rights guidance for clarity without broadening legal promises in `src/app/lib/legal/rights.ts`

### Slice 2 — Terms of Service

- [x] T084 [US3] [ATDD] Implement failing bindings for `@ATDD-US3-002` in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T085 [US3] [TDD] [U21] Create failing `TDD-US3-002` tests for operator, eligibility, account, subscription, billing, cancellation, acceptable-use, availability, liability, termination, governing-law, and self-hosted-runner topics in `test/app/lib/legalTerms.test.ts`
- [x] T086 [US3] [GATE] [U21] Run `@ATDD-US3-002` and `TDD-US3-002`; confirm intended Red failures and record them in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T087 [US3] [U21] Implement independently authored service terms with verified product and operator facts in `src/app/lib/legal/terms.ts`
- [x] T147 [US3] [TDD] [U36] Create a failing route-component test for terms metadata and required terms content in `test/app/legal/legalRoutes.test.tsx`
- [x] T088 [US3] [A1] [U21] [U36] Implement the public terms route and metadata in `src/app/legal/terms/page.tsx`
- [x] T089 [US3] [GATE] [A1] [U21] [U36] Rerun `@ATDD-US3-002`, `TDD-US3-002`, and the terms route test; record Green evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T090 [US3] [U21] Refactor terms section structure while preserving every verified topic in `src/app/lib/legal/terms.ts`

### Cross-Story Local-Navigation Completion

- [x] T031 [US3] [GATE] [A1] [U4] Rerun `TDD-US1-003` and `@ATDD-US1-001` after all five local routes exist; record Green evidence and the zero-GoAdopt scan result in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T043 [US3] [GATE] [A1] Run the local-navigation acceptance scenario to Green and record its browser evidence and zero-GoAdopt result in `specs/001-local-legal-compliance/test-traceability.md`

### User Story 3 Completion

- [x] T091 [US3] [GATE] [A7] Run the complete rights/process acceptance scenario to Green and retain its evidence in `specs/001-local-legal-compliance/test-summary.md`
- [x] T092 [US3] [GATE] [A8] Run the no-account email-route acceptance scenario to Green and update its status in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T093 [US3] [GATE] [A9] Run the qualified-rights acceptance scenario to Green and record defects and qualification risks in `specs/001-local-legal-compliance/defect-log.md`
- [x] T094 [US3] [GATE] Record US3 execution totals, coverage, risks, evidence links, and Go/No-Go recommendation in `specs/001-local-legal-compliance/test-summary.md`

**Checkpoint**: Privacy-rights guidance and service terms are local, public, and independently testable.

---

## Phase 6: User Story 4 — Keep Disclosures Aligned With Product Behavior (Priority: P2)

**Goal**: Maintainers can detect disclosure drift, block incomplete publication, evaluate material changes, and retain evidence that the single English EU/German-baseline document set is independently authored and current.

**Independent test**: Run the publication validator and a read-only browser audit; prove unknown storage/origins and missing metadata fail, approved patterns pass, material changes trigger review, and the one-document scope is explicit.

### Scenario Specification

- [x] T095 [US4] [ATDD] [A10] Define `@ATDD-US4-001` with explicit unknown-key, approved-pattern, and unknown-origin examples in `test/bdd/features/local-legal-compliance.feature`
- [x] T096 [US4] [ATDD] [A11] Define `@ATDD-US4-002` with material purpose, recipient, legal-basis, and consent-category change examples in `test/bdd/features/local-legal-compliance.feature`
- [x] T097 [US4] [ATDD] Define `@ATDD-US4-003` for missing document and service disclosure metadata in `test/bdd/features/local-legal-compliance.feature`
- [x] T098 [US4] [ATDD] Define `@ATDD-US4-004` for one English EU/EEA and German-baseline document set without a worldwide-compliance claim in `test/bdd/features/local-legal-compliance.feature`
- [x] T099 [US4] [GATE] [A10] [A11] Register ATDD-US4-001–004 as shared BDD-owned ATDD/BDD evidence and enumerate every boundary/transition example in `specs/001-local-legal-compliance/test-traceability.md`

### Slice 1 — Versioning and Material-Change Review

- [x] T100 [US4] [ATDD] [A11] Implement failing bindings for `@ATDD-US4-002` in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T101 [US4] [TDD] [U22] [U23] Create failing `TDD-US4-001` tests for material document revisions and the editorial-change boundary in `test/app/lib/legalVersioning.test.ts`
- [x] T102 [US4] [GATE] [A11] [U22] [U23] Run `@ATDD-US4-002` and `TDD-US4-001`; confirm intended Red failures and record them in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T103 [US4] [A11] [U22] [U23] Implement deterministic revision metadata and material-change classification in `src/app/lib/legal/versioning.ts`
- [x] T104 [US4] [GATE] [A11] [U22] [U23] Rerun `@ATDD-US4-002` and `TDD-US4-001`; record Green evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T105 [US4] [U22] [U23] Refactor material-change rules into explicit reviewed constants while keeping evidence green in `src/app/lib/legal/versioning.ts`

### Slice 2 — Read-Only Browser Documentation Audit

- [x] T106 [US4] [ATDD] [A10] Implement failing bindings for `@ATDD-US4-001` unknown-key, approved-pattern, and unknown-origin examples in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T107 [US4] [TDD] [U24] [U25] [U26] [U27] Create failing `TDD-US4-002` tests for exact keys, bounded key patterns, approved origins, unknown observations, and value-free evidence in `test/compliance/inventory-audit.test.ts`
- [x] T108 [US4] [GATE] [A10] [U24] [U25] [U26] [U27] Run `@ATDD-US4-001` and `TDD-US4-002`; confirm intended Red failures and record them in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T109 [US4] [A10] [U24] [U25] [U26] Implement read-only storage/origin observation and deterministic comparison against approved declarations in `test/compliance/support/inventoryAudit.ts`
- [x] T110 [US4] [A10] [U24] [U26] Implement the Playwright documentation-audit journey without consent mutation in `test/compliance/inventory-audit.spec.ts`
- [x] T111 [US4] [U27] Add sanitized JSON evidence output containing names, origins, classifications, and matches—but never stored values—in `test/compliance/support/evidenceWriter.ts`
- [x] T112 [US4] [GATE] [A10] [U24] [U25] [U26] [U27] Rerun `@ATDD-US4-001`, `TDD-US4-002`, and `bun run test:compliance`; record Green only with zero unknown/forbidden observations in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T113 [US4] [U24] [U25] [U26] [U27] Refactor audit matchers and evidence normalization while keeping all boundary examples green in `test/compliance/support/inventoryAudit.ts`

### Slice 3 — Publication, Scope, and Provenance Gates

- [x] T114 [US4] [ATDD] Implement failing bindings for `@ATDD-US4-003` and `@ATDD-US4-004` in `test/bdd/steps/local-legal-compliance.steps.ts`
- [x] T115 [P] [US4] [TDD] [U28] [U29] Create failing `TDD-US4-003` tests for missing required fields, inconsistent references, pending operator facts, and failed audits blocking publication in `test/app/lib/legalPublication.test.ts`
- [x] T116 [P] [US4] [TDD] [U30] Create failing `TDD-US4-004` tests for one English set, EU/EEA and German baseline, future triggers, and absence of worldwide/regional compliance promises in `test/app/lib/legalScope.test.ts`
- [x] T117 [P] [US4] [TDD] [U31] Create failing `TDD-US4-005` tests for document provenance and declaration-to-evidence traceability completeness in `test/app/lib/legalTraceability.test.ts`
- [x] T118 [US4] [GATE] [U28] [U29] [U30] [U31] Run `@ATDD-US4-003`, `@ATDD-US4-004`, and `TDD-US4-003–005`; confirm intended Red failures and record them in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T119 [US4] [U28] [U29] [U30] Implement publication completeness and safe-scope validation in `src/app/lib/legal/validation.ts`
- [x] T120 [US4] [U31] Implement provenance and declaration-to-evidence records in `src/app/lib/legal/provenance.ts`
- [x] T121 [US4] [U28] [U29] Add the legal publication validator to the production build path in `next.config.ts`
- [x] T122 [US4] [GATE] [U28] [U29] [U30] [U31] Rerun `@ATDD-US4-003`, `@ATDD-US4-004`, and `TDD-US4-003–005`; record Green evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T123 [US4] [U28] [U29] Refactor validation diagnostics for actionable failures while keeping publication blocked on every incomplete or overbroad case in `src/app/lib/legal/validation.ts`

### User Story 4 Completion

- [x] T124 [US4] [GATE] [A10] Run the disclosure-drift acceptance scenario to Green and retain its compliance-audit evidence in `specs/001-local-legal-compliance/test-summary.md`
- [x] T125 [US4] [GATE] [A11] Run the material-change review acceptance scenario to Green and update its status in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T126 [US4] [GATE] [A12] Run the supplemental-device-view acceptance scenario to Green and record defects, audit findings, and separate future consent-engine work in `specs/001-local-legal-compliance/defect-log.md`
- [x] T127 [US4] [GATE] Record US4 execution totals, coverage, risks, evidence links, and Go/No-Go recommendation in `specs/001-local-legal-compliance/test-summary.md`

**Checkpoint**: Publication drift is detectable and blocking without modifying c15t or claiming universal legal compliance.

---

## Phase 7: Polish and Cross-Cutting Release Gates

**Purpose**: Validate the integrated feature and finalize canonical evidence.

- [x] T128 [P] [GATE] Run `bun run test -- --runInBand` and record the complete TDD/Jest result in `specs/001-local-legal-compliance/test-summary.md`
- [x] T129 [P] [GATE] [A1] [A2] [A3] [A4] [A5] [A6] [A7] [A8] [A9] [A10] [A11] [A12] Run `bun run test:bdd` and prove 100% of registered BDD scenarios/examples and their shared ATDD roles pass in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T130 [P] [GATE] Run `bun run test:compliance` and attach sanitized zero-unknown inventory evidence to `specs/001-local-legal-compliance/test-summary.md`
- [x] T131 [P] [GATE] Run `bun run test:coverage`; prove no baseline regression and at least 90% line/85% branch coverage for changed legal/document-projection logic in `specs/001-local-legal-compliance/test-summary.md`
- [x] T132 [P] [GATE] Run `bun run app:lint` and `bunx prettier --check .`; record zero source/test lint and format errors in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T133 [P] [GATE] Run `bun run app:typecheck`; record zero source/test type errors in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T134 [P] [GATE] Run `bun audit --audit-level=high`; record zero unaccepted high/critical dependency findings in `specs/001-local-legal-compliance/test-summary.md`
- [x] T135 [P] [GATE] Run `bun run app:build`; verify publication validation and all legal routes succeed in `specs/001-local-legal-compliance/test-summary.md`
- [x] T136 [GATE] Perform the manual 320px, desktop, keyboard, no-script, consent-backend-unavailable, and existing-preferences-dialog checks from `specs/001-local-legal-compliance/quickstart.md` and record results in `specs/001-local-legal-compliance/test-summary.md`
- [x] T137 [GATE] Scan the repository for remaining GoAdopt URLs, scripts, and request-page references; record zero user-facing dependencies in `specs/001-local-legal-compliance/test-summary.md`
- [x] T138 [GATE] Review the Scenario Coverage Matrix and prove every required behavior, acceptance boundary, edge/error case, and approved example is represented in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T139 [GATE] Review traceability and prove every FR/SC/US/EC maps to one canonical registered artifact with current status and evidence in `specs/001-local-legal-compliance/test-traceability.md`
- [x] T140 [GATE] Reconcile unexpected failures, open/deferred defects, risk acceptances, and verification evidence in `specs/001-local-legal-compliance/defect-log.md`
- [x] T141 [GATE] Finalize execution totals, coverage/traceability status, quality gates, defect counts, risks/exceptions, evidence links, and the release Go/No-Go recommendation in `specs/001-local-legal-compliance/test-summary.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundational Governance**: Depends on Phase 1 and blocks all production work.
- **Phase 3 — US1**: Starts after Phase 2 and is the MVP foundation for the local documents.
- **Phase 4 — US2**: Starts after Phase 2; integration into the cookie page requires the US1 cookie-page shell.
- **Phase 5 — US3**: Starts after Phase 2 and can proceed independently of US2.
- **Phase 6 — US4**: Starts after Phase 2; publication/audit validation consumes the document and registry artifacts from US1–US3.
- **Phase 7 — Release Gates**: Runs after every story selected for the release is complete.

### User Story Dependencies

- **US1 (P1)**: No story dependency; delivers the first independently useful local legal-document increment.
- **US2 (P1)**: Depends on the US1 cookie-policy route for UI composition, but its read-only projection and boundary tests are independently executable.
- **US3 (P2)**: No dependency on US2; its two local routes can be implemented after the shared foundation.
- **US4 (P2)**: Consumes final declarations and routes from US1–US3 to enforce release governance.

### Mandatory Within-Slice Order

1. Define the scenario and register its intended evidence.
2. Add only the executable ATDD bindings and TDD tests needed for the current slice.
3. Run them and prove the failure is caused by missing behavior; record **Red**.
4. Add the smallest production implementation that satisfies the slice.
5. Rerun the same evidence and record **Green**.
6. Refactor only while the same evidence remains green.
7. Do not begin the next slice while the current slice is Red.

### Parallel Opportunities

- T003–T005 can run in parallel after dependency installation.
- Within US1 slice 1, T016–T017 and T020–T022 can run in parallel after their respective prerequisites.
- T027–T030 touch independent consumers and can run in parallel.
- T034–T035 and T038–T039 touch independent test/component files and can run in parallel.
- T053–T054 and T062–T063 can run in parallel within their respective US2 slices.
- After Phase 2, US3 content work can proceed independently while US1/US2 work continues, provided shared-file edits are serialized.
- T115–T117 can run in parallel; T128–T135 can run in parallel after all implementation phases are green.

---

## Parallel Examples

### US1 Document Foundation

```text
T016: TDD-US1-001 in test/app/lib/legalDocuments.test.ts
T017: TDD-US1-002 in test/app/lib/legalContent.test.ts

After Red is recorded:
T020: Shared shell in src/app/components/legal/LegalDocumentLayout.tsx
T021: Privacy route in src/app/legal/privacy/page.tsx
T022: Cookie route in src/app/legal/cookies/page.tsx
```

### US4 Publication Gates

```text
T115: Publication completeness tests in test/app/lib/legalPublication.test.ts
T116: Scope tests in test/app/lib/legalScope.test.ts
T117: Provenance tests in test/app/lib/legalTraceability.test.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phases 1 and 2.
2. Complete US1 one slice at a time with recorded Red/Green evidence.
3. Stop and validate the local privacy/cookie routes independently.
4. Continue with US2 so local disclosures can launch the existing c15t preferences dialog.

### Incremental Delivery

1. **US1** replaces hosted disclosure navigation and provides local privacy/cookie documents.
2. **US2** adds truthful read-only consent-category projection and preference-dialog access.
3. **US3** adds privacy-request guidance and terms.
4. **US4** adds drift detection, publication validation, and provenance governance.
5. **Phase 7** decides whether the complete set is releasable.

### Guardrails

- Never copy GoAdopt text verbatim; author content from verified Clipify facts and the documented legal baseline.
- Never infer a saved preference from local browser state or the legal pages.
- Never store or emit cookie/local-storage values in audit evidence.
- Never add a second consent state, toggle, persistence mechanism, or API.
- Never change c15t runtime behavior as part of this feature; record any such audit finding as separate future work.
- Never claim worldwide compliance or create country-specific document variants without a concrete future trigger and separate review.

---

## Notes

- `[P]` tasks touch different files and have no unfinished dependency.
- The single Playwright-BDD feature owns the executable artifacts and carries both BDD and ATDD evidence roles; duplicate scenarios are intentionally omitted and this equivalence is recorded in traceability.
- Every TDD inventory item and every ATDD scenario/example from `spec.md` has a distinct task.
- Red/Green results, commands, and evidence paths belong in the canonical registry rather than being duplicated across reports.
- Commit boundaries should follow completed green slices or coherent story checkpoints and use the repository's Gitmoji convention.

---

## Phase 8: TDD remediation

**Blocking status**: The feature is not done until Findings 1-7 in `tdd/verification.md` are cleared. Historical test-after ordering cannot be retroactively changed; it must be recorded honestly while the missing real behaviors are implemented through new Red-Green cycles.

- [x] T148 [GATE] [HIGH] Correct the Cycle Log and traceability status for Finding 1 so A2, A3, A4, and A6-A11 are explicitly recorded as test-after rather than behavior-level Red; verify with `rg -n "A2|A3|A4|A6|A7|A8|A9|A10|A11" specs/001-local-legal-compliance/tdd/{test-list,cycle-log,verification}.md specs/001-local-legal-compliance/test-traceability.md`
- [x] T149 [GATE] [HIGH] Correct Finding 2 by appending honest evidence entries for `ATDD-US3-002`, `ATDD-US4-003`, and `ATDD-US4-004` and removing the unsupported Red claim from `specs/001-local-legal-compliance/test-traceability.md`; verify with `rg -n "ATDD-US3-002|ATDD-US4-003|ATDD-US4-004" specs/001-local-legal-compliance/tdd/cycle-log.md specs/001-local-legal-compliance/test-traceability.md`
- [x] T150 [US4] [TDD] [HIGH] For Finding 3, add a failing build-boundary test, then wire validated canonical release data into the production build path so an invalid release makes the build exit non-zero; verify with `bunx jest test/app/lib/legalPublicationBuildGate.test.ts --runInBand` and `bun run app:build`
- [x] T151 [P] [US4] [TDD] [HIGH] For Finding 4, add failing cases for every required document/service field, pending placeholder, unbounded pattern, inconsistent consent classification, and orphaned disclosure before expanding `validatePolicyRelease`; verify with `bunx jest test/app/lib/legalPublication.test.ts --runInBand`
- [x] T152 [US4] [ATDD] [HIGH] For Finding 5, drive a real compliance-gate scenario Red, then inventory cookies, local/session storage, scripts, and origins across declared public, authenticated, and consent-enabled flows; require the expected non-empty observation matrix and prove an injected undeclared item blocks the actual gate with `bun run test:compliance`
- [x] T153 [US1] [TDD] [U8] [HIGH] For Finding 6, add failing registry tests for unanchored, wildcard-all, invalid, and overlong storage patterns, then verify with `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
- [x] T154 [US1] [TDD] [U5] [U10] [HIGH] For Finding 7, require trimmed non-empty values and every FR-007 declaration field, including storage/origin and first-/third-party status, then verify with `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
- [x] T155 [BDD] [MED] Resolve Finding 8 by moving US/FR/SC tags from the feature to their owning scenarios while preserving one stable scenario ID per scenario; verify generated tags with `bun run test:bdd`
- [x] T156 [US1] [ATDD] [A3] [MED] Resolve Finding 9 with real Tab traversal and an automated accessibility check against the live 320px legal page; verify with `bunx playwright test --project=bdd-chromium --grep "@A3"`
- [x] T157 [GATE] [MED] Resolve Finding 10 so a clean `bun run test:e2e` starts and stops its managed Next server and exits zero twice consecutively on Windows and CI Linux
- [x] T158 [TDD] [LOW] Resolve Finding 11 by moving `fetch` and browser-storage cleanup into guaranteed test teardown; verify with `bunx jest test/app/components/legal/DeviceStorageInspector.test.tsx --runInBand`
- [x] T159 [GATE] Rerun `/speckit.tdd.verify` after T148-T158 and retain the new verdict in `specs/001-local-legal-compliance/tdd/verification.md`

---

## Phase 9: TDD remediation follow-up

**Blocking status**: The formal verdict remains `FAIL` because Finding 1 is immutable historical test-after evidence. The feature's actionable test gaps are not complete until Findings 2-6 are cleared.

- [x] T160 [US1] [TDD] [HIGH] Resolve Finding 2 by pinning the independently reviewed necessary/optional service IDs before iterating disclosure assertions in `test/app/lib/consentRegistry.test.ts`; prove removing any service fails with `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
- [x] T161 [US2] [TDD] [HIGH] Resolve Finding 3 by extending the read-only consent-boundary scan to `src/app/legal/**` route entry points and retaining positive forbidden-capability cases; verify with `bunx jest test/app/lib/legalConsentBoundary.test.ts --runInBand`
- [x] T162 [US2] [ATDD] [HIGH] Resolve Finding 4 by making `@A6` observe an attempted failed consent-backend request, activate Cookie preferences, assert the unavailable state, and prove consent storage is unchanged; verify with `bunx playwright test --project=bdd-chromium --grep "@A6"`
- [x] T163 [US1] [ATDD] [HIGH] Resolve Finding 5 by recording browser requests while navigating all legal destinations and asserting approved Clipify origins with zero GoAdopt traffic; verify with `bunx playwright test --project=bdd-chromium --grep "@A1"`
- [x] T164 [US4] [TDD] [HIGH] Resolve Finding 6 with a controlled integration test that feeds an invalid release through `scripts/build-app.mjs`, proves nonzero exit, and proves Next was not invoked; verify with `bunx jest test/app/lib/legalPublicationBuildGate.test.ts --runInBand`
- [x] T165 [US1] [ATDD] [MED] Resolve Finding 7 by giving service disclosures a stable accessible article/region boundary and removing parent-axis locators; verify with `bunx playwright test --project=bdd-chromium --grep "@A2|@A4"`
- [x] T166 [US1] [TDD] [MED] Resolve Finding 8 by replacing the five-file GoAdopt scan with a deterministic user-facing source scan while retaining the required local-route assertions; verify with `bunx jest test/app/lib/legalLinkMigration.test.ts --runInBand`
- [x] T167 [US4] [ATDD] [MED] Resolve Finding 9 by closing browser contexts in guaranteed cleanup and waiting on reviewed request/readiness conditions before inventory capture; verify twice with `bun run test:compliance`
- [x] T168 [US4] [TDD] [MED] Resolve Finding 10 by pinning the exact valid policy-release baseline before the invalid-input table; verify with `bunx jest test/app/lib/legalPublication.test.ts --runInBand`
- [x] T169 [US2] [TDD] [LOW] Resolve Finding 11 by restoring browser history in guaranteed teardown in `test/app/components/legal/CookiePreferencesLink.test.tsx`; verify with `bunx jest test/app/components/legal/CookiePreferencesLink.test.tsx --runInBand`
