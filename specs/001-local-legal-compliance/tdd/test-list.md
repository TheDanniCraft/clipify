---
feature: 001-local-legal-compliance
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 12
planned_at: 218692f
updated_at: 218692f6
suite_baseline: green
---

# Test List: Local Legal and Privacy Center

## Outer loop: acceptance behaviors

One behavior represents each acceptance criterion in `spec.md`, in criterion order. The existing Playwright-BDD pipeline owns the executable Gherkin artifact; each scenario also carries the ATDD evidence role required by the specification and constitution.

| id  | behavior                                                                                                                                                          | traces                                      | kind    | state | test                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------- | ----- | ----------------------------------------------------------------------------------- |
| A1  | From any public page, legal navigation reaches Clipify-hosted privacy, cookie, terms, imprint, and privacy-request pages                                          | US1, FR-001, FR-002, SC-001, SC-002         | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US1-001`                   |
| A2  | A privacy or cookie-policy service disclosure shows its purpose, data/storage categories, provider/recipient, retention, consent status, and transfer information | US1, FR-004, FR-005, FR-006, FR-007, SC-006 | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US2-002`                   |
| A3  | Legal pages remain readable, navigable, and operable with keyboard/assistive technology and at a 320 CSS-pixel viewport                                           | US1, FR-003, SC-009                         | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US1-001 @A3`               |
| A4  | The cookie policy shows every category with its services, storage, purpose, provider, and consent status                                                          | US2, FR-006, FR-007, FR-011, SC-003         | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US2-001 @A4`               |
| A5  | Selecting cookie preferences from a legal page opens the existing c15t dialog without navigating away                                                             | US2, FR-009, SC-002, SC-004                 | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US2-003 @A5`               |
| A6  | When the consent interface is unavailable, full legal disclosures remain readable and no saved preference is claimed                                              | US2, EC-001, EC-004, SC-004                 | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US1-002 @ATDD-US2-004 @A6` |
| A7  | The privacy-request page explains applicable EU-baseline rights, qualifications, contact, verification, response stages, and complaint options                    | US3, FR-014, FR-015, SC-007                 | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US3-001 @A7`               |
| A8  | A person without an account can use an accessible email route to start a privacy request                                                                          | US3, FR-014, FR-015, SC-007                 | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US3-001 @A8`               |
| A9  | Rights guidance qualifies applicability and lawful exceptions instead of promising an unconditional result                                                        | US3, EC-006, EC-007                         | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US3-001 @A9`               |
| A10 | A changed storage key, script, or external origin is reported against the reviewed declaration and blocks release when undeclared                                 | US4, FR-018, FR-019, SC-005                 | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US4-001 @A10`              |
| A11 | A material purpose, recipient, legal-basis, or consent-category change requires a policy-version review and a recorded renewed-consent/notice decision            | US4, FR-017, EC-005, SC-008                 | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US4-002 @A11`              |
| A12 | The cookie policy keeps the reviewed inventory authoritative and exposes neither a current-device snapshot nor storage values                                     | US4, FR-008, EC-003                         | example | DONE  | `test/bdd/features/local-legal-compliance.feature::@ATDD-US1-003 @A12`              |

A1 planning unblock: U32-U37 now cover the missing shared layout, legal navigation, and four new public route compositions. Its recorded Red remains valid until those behaviors and the existing imprint route work end to end.

Historical evidence classification: A2, A3, A4, and A6-A11 are `TEST_AFTER`. Their executable acceptance coverage is Green, but their original missing-binding failures were test-construction failures after the product behavior existed and are not behavior-level Red evidence. Cycle 52 strengthens A3 post-audit and likewise does not rewrite that history.

## Inner loop: unit behaviors

### `src/app/lib/legal/documents.ts`

| id  | behavior                                                                                                                                               | traces                 | kind    | state | test                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------- | ----- | --------------------------------------------------------------------------------------------- |
| U1  | The manifest exposes exactly the five required, unique Clipify-controlled legal routes                                                                 | FR-001, SC-001         | example | DONE  | `test/app/lib/legalDocuments.test.ts::exposes exactly the five required unique local routes`  |
| U2  | Every document has a non-placeholder English title, version, effective date, update date, and scope                                                    | FR-003, FR-020, EC-008 | example | DONE  | `test/app/lib/legalDocuments.test.ts::provides publishable metadata for every legal document` |
| U3  | Privacy content contains every required operator, processing, transfer, retention, security, rights, complaint, withdrawal, children, and change topic | FR-004, FR-005         | example | DONE  | `test/app/lib/legalContent.test.ts::covers every required privacy and processing topic`       |

### User-facing legal-link consumers

| id  | behavior                                                                                              | traces         | kind     | state | test                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------- | -------------- | -------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| U4  | Footer, login, consent UI, and machine-readable documents contain local legal URLs and no GoAdopt URL | FR-002, SC-001 | contract | DONE  | `test/app/lib/legalLinkMigration.test.ts::uses local legal routes and contains no GoAdopt URL in user-facing sources` |

### `src/app/lib/consent/registry.ts`

| id  | behavior                                                                                                                                                        | traces                 | kind     | state | test                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U5  | Every service declaration supplies all mandatory identity, purpose, provider, data, recipient, region, retention, consent, revocation, policy, and audit fields | FR-007, FR-020, SC-006 | contract | DONE  | `test/app/lib/consentRegistry.test.ts::rejects incomplete mandatory disclosure fields`                                                                          |
| U6  | A necessary service is valid only with a reviewed user-requested or security-critical necessity rationale                                                       | FR-012                 | example  | DONE  | `test/app/lib/consentRegistry.test.ts::requires a reviewed necessity rationale`                                                                                 |
| U7  | A no-storage declaration rejects cookie or web-storage keys                                                                                                     | FR-006, FR-007         | example  | DONE  | `test/app/lib/consentRegistry.test.ts::rejects storage keys on a no-storage declaration`                                                                        |
| U8  | Any accepted dynamic storage pattern is anchored, bounded, and rejects unrelated generated names                                                                | FR-007, EC-002         | property | DONE  | `test/app/lib/consentRegistry.test.ts::accepts only bounded matching storage patterns`; `test/app/lib/consentRegistry.test.ts::rejects unsafe storage patterns` |
| U9  | Every external origin maps to exactly one service or an explicit reviewed platform exception                                                                    | FR-007, FR-019, SC-005 | example  | DONE  | `test/app/lib/consentRegistry.test.ts::assigns each external origin to exactly one service`                                                                     |
| U10 | Every service maps to at least one policy section and one audit flow                                                                                            | FR-023                 | example  | DONE  | `test/app/lib/consentRegistry.test.ts::maps every service to existing policy sections and reviewed audit flows`                                                 |

### Authoritative inventory without device inspection

| id  | behavior                                                                                                  | traces         | kind       | state      | test                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------- | -------------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| U11 | Historical inspector behavior; superseded by the approved decision not to expose runtime device state     | FR-008, EC-003 | retired    | SUPERSEDED | Removed `test/app/components/legal/DeviceStorageInspector.test.tsx`                                                   |
| U12 | The cookie policy renders the complete reviewed inventory and no “Activity visible on this device” region | FR-008, EC-003 | regression | DONE       | `test/app/legal/legalRoutes.test.tsx::renders cookie route`; `test/bdd/features/local-legal-compliance.feature::@A12` |

### `src/app/lib/legal/consentProjection.ts`

| id  | behavior                                                                                                                               | traces                 | kind     | state | test                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| U13 | The projection returns the existing c15t category names, descriptions, services, and current selections without creating consent state | FR-010, FR-011, SC-003 | contract | DONE  | `test/app/lib/legalConsentProjection.test.ts::projects existing categories without creating consent state`   |
| U14 | Necessary and always-on cookieless measurement are disclosed truthfully without an ineffective optional toggle                         | FR-012, FR-013         | example  | DONE  | `test/app/lib/legalServiceClassification.test.ts::discloses necessary and cookieless measurement truthfully` |

### `src/app/components/legal/CookiePreferencesLink.tsx`

| id  | behavior                                                                                                                       | traces                 | kind     | state | test                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | -------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| U15 | Activating the legal-page control invokes only the existing c15t open-dialog integration and preserves the current legal route | FR-009, FR-010, SC-004 | contract | DONE  | `test/app/components/legal/CookiePreferencesLink.test.tsx::opens the existing dialog without leaving the legal route` |
| U16 | If the c15t dialog integration is unavailable, the control reports unavailability without claiming or writing a saved choice   | EC-001, EC-004, SC-004 | example  | DONE  | `test/app/components/legal/CookiePreferencesLink.test.tsx::reports an unavailable dialog without saving a choice`     |

### Existing c15t consent boundary

| id  | behavior                                                                                                                                       | traces | kind     | state | test                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ----- | -------------------------------------------------------------------------------------- |
| U17 | Legal-document modules cannot mutate c15t categories, defaults, persistence, API, reload, activation, revocation, cleanup, or dialog semantics | FR-010 | contract | DONE  | `test/app/lib/legalConsentBoundary.test.ts::keeps legal modules read-only toward c15t` |

### `src/app/lib/legal/rights.ts`

| id  | behavior                                                                                                                                                                                 | traces                         | kind     | state | test                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------- | ----- | ------------------------------------------------------------------------------------------------------ |
| U18 | Rights guidance covers all supported request intentions, a durable email channel, verification, processing stages, complaint routes, and no-account access                               | FR-014, FR-015                 | contract | DONE  | `test/app/lib/legalRights.test.ts::provides the complete request process without requiring an account` |
| U19 | Initial request guidance rejects passwords, authentication secrets, Twitch tokens, and full payment credentials and requires sufficient identity/authority before disclosure or deletion | FR-015, EC-006                 | example  | DONE  | `test/app/lib/legalRights.test.ts::requires safe and proportionate identity verification`              |
| U20 | Rights, timelines, deletion, portability, restriction, and objection remain qualified by applicability, lawful exceptions, and retention duties                                          | FR-014, FR-015, EC-006, EC-007 | example  | DONE  | `test/app/lib/legalRights.test.ts::qualifies rights and outcomes`                                      |

### `src/app/lib/legal/terms.ts`

| id  | behavior                                                                                                                                                                                                            | traces | kind     | state | test                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ----- | ---------------------------------------------------------------------- |
| U21 | Terms include service, eligibility, accounts, external platforms, acceptable use, content, billing, cancellation, runner duties, availability, suspension, termination, mandatory-law liability, and dispute topics | FR-016 | contract | DONE  | `test/app/lib/legalTerms.test.ts::contains every required terms topic` |

### `src/app/lib/legal/versioning.ts`

| id  | behavior                                                                                                                                                                                                                  | traces         | kind    | state | test                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------- | ----- | --------------------------------------------------------------------------------- |
| U22 | Each broadened purpose, new data/recipient/transfer, optional-to-necessary/category move, longer retention, sale/sharing, advertising, or profiling change requires a version change and recorded consent/notice decision | FR-017, EC-005 | example | DONE  | `test/app/lib/legalVersioning.test.ts::requires review for material change`       |
| U23 | Typographical, display-only, and meaning-preserving restrictive-pattern changes remain editorial                                                                                                                          | FR-017         | example | DONE  | `test/app/lib/legalVersioning.test.ts::keeps meaning-preserving change editorial` |

### `test/compliance/support/inventoryAudit.ts`

| id  | behavior                                                                                                            | traces                 | kind     | state | test                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| U24 | An observed exact storage name or approved origin matches its single reviewed declaration                           | FR-018, FR-019, SC-005 | example  | DONE  | `test/compliance/inventory-audit.test.ts::matches an exact storage name and approved origin once`                  |
| U25 | A bounded pattern accepts matching dynamic keys and rejects generated non-matching keys                             | FR-019, EC-002         | property | DONE  | `test/compliance/inventory-audit.test.ts::matches bounded dynamic names and rejects non-matches`                   |
| U26 | Unknown or forbidden storage, script, or origin produces a flow-specific finding and failed audit result            | FR-018, FR-019, SC-005 | example  | DONE  | `test/compliance/inventory-audit.test.ts::fails with flow-specific findings for unknown or forbidden observations` |
| U27 | Audit evidence contains normalized names, origins, classifications, and matches but no cookie or web-storage values | FR-008, FR-018         | example  | DONE  | `test/compliance/inventory-audit.test.ts::produces value-free normalized evidence`                                 |

### `src/app/lib/legal/validation.ts`

| id  | behavior                                                                                                              | traces                         | kind     | state | test                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------- | ----- | ----------------------------------------------------------------------------- |
| U28 | A missing mandatory document or service field fails publication with the missing field identified                     | FR-020, EC-008, SC-008         | example  | DONE  | `test/app/lib/legalPublication.test.ts::identifies a missing mandatory field` |
| U29 | An inconsistent reference, orphaned disclosure, pending operator fact, or failed audit blocks policy-release approval | FR-020, FR-023, EC-008, SC-008 | contract | DONE  | `test/app/lib/legalPublication.test.ts::blocks publication`                   |

### `src/app/lib/legal/scope.ts`

| id  | behavior                                                                                                                                                                     | traces         | kind     | state | test                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------- | ----- | ---------------------------------------------------------------------------------------- |
| U30 | The release contains exactly one English document set, records the EU/EEA and German baseline and future review triggers, and makes no guaranteed-worldwide-compliance claim | FR-021, SC-010 | contract | DONE  | `test/app/lib/legalScope.test.ts::defines one scoped English EU and German document set` |

### `src/app/lib/legal/provenance.ts`

| id  | behavior                                                                                                                                         | traces         | kind     | state | test                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------- | ----- | --------------------------------------------------------------------------------------------------- |
| U31 | Every published document has independent-authorship source notes and every consent-affecting declaration has disclosure and audit evidence links | FR-022, FR-023 | contract | DONE  | `test/app/lib/legalTraceability.test.ts::records complete document provenance and service evidence` |

### `src/app/components/legal/LegalDocumentLayout.tsx`

| id  | behavior                                                                                                                          | traces                 | kind    | state | test                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------- | ----- | ------------------------------------------------------------------------------------------- |
| U32 | The shared legal-document layout renders the document title, version, effective date, and applicability scope in semantic regions | FR-003, FR-020, EC-008 | example | DONE  | `test/app/components/legal/LegalDocumentLayout.test.tsx::renders document metadata`         |
| U33 | The shared legal navigation exposes exactly the five canonical local legal destinations and identifies the current document       | FR-001, SC-001, SC-002 | example | DONE  | `test/app/components/legal/LegalDocumentLayout.test.tsx::renders complete legal navigation` |

### Public App Router legal pages

| id  | behavior                                                                                                                                             | traces                         | kind    | state | test                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------- | ----- | -------------------------------------------------------------------- |
| U34 | The privacy route server-renders its manifest metadata and ordered privacy sections through the shared legal layout                                  | FR-001, FR-003, FR-004, FR-005 | example | DONE  | `test/app/legal/legalRoutes.test.tsx::renders privacy route`         |
| U35 | The cookie route server-renders its manifest metadata and authoritative disclosure region through the shared legal layout                            | FR-001, FR-003, FR-006         | example | DONE  | `test/app/legal/legalRoutes.test.tsx::renders cookie route`          |
| U36 | The terms route server-renders its manifest metadata and required terms content through the shared legal layout                                      | FR-001, FR-003, FR-016         | example | DONE  | `test/app/legal/legalRoutes.test.tsx::renders terms route`           |
| U37 | The privacy-request route server-renders its manifest metadata, qualified rights guidance, and durable contact route through the shared legal layout | FR-001, FR-003, FR-014, FR-015 | example | DONE  | `test/app/legal/legalRoutes.test.tsx::renders privacy-request route` |

## Invariants and edge cases still to place

- None. Every specified edge case is assigned to an outer or inner behavior.

## Out of scope

- Changes to c15t categories, defaults, persistence, API, reload, activation, revocation, cleanup, or preference-dialog semantics: this feature consumes that boundary read-only.
- Automated authenticated data export or deletion: the first release provides a qualified email-based request process.
- Separate regional documents, geolocation-based variants, or a guaranteed worldwide-compliance claim: one English EU/EEA and German-baseline set is intentional.
- A new legal CMS, database table, service, or container: reviewed TypeScript content stays in the existing application.
- Republishing substantially identical GoAdopt prose: prior documents are a private factual checklist only.
- Exhaustively crawling every possible application state: the compliance audit covers reviewed representative public/authenticated flows and declared service states.

## Verification commands

Copied from `.specify/memory/tdd-profile.md` at planning time:

- Application single test: unavailable; Jest name filtering can false-green when no test matches.
- Application file: `bunx jest {file} --runInBand`
- Application full suite: `bun run test:coverage`
- Application coverage: `bun run test:coverage`
- Browser single test: `bunx playwright test {file} --project=acceptance-chromium -g "{name}"`
- Browser file: `bunx playwright test {file} --project=acceptance-chromium`
- Browser full suite: `bun run test:e2e`
- Browser acceptance: `bun run test:acceptance`
- Browser BDD generation and suite: `bun run test:bdd`
- Property tests: `fast-check` with `@fast-check/jest`, executed through the application file command.
- Mutation: unavailable; use recorded deliberate-mutant spot checks for the highest-risk changed behaviors until mutation tooling is bootstrapped.
