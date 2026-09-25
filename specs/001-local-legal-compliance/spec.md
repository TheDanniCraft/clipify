# Feature Specification: Local Legal and Privacy Center

**Feature Branch**: `gamescom-improvements`

**Created**: 2026-09-24

**Status**: Draft

**Input**: Replace GoAdopt-hosted legal documents and privacy requests with an independently maintained Clipify legal and privacy center. Reuse the consent inventory to disclose services and device storage accurately, support consent management from the cookie policy, and publish one English document set based on the German operator's EU legal baseline.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Understand Clipify's data practices (Priority: P1)

As a visitor or user, I can find understandable, current privacy and cookie information hosted by Clipify so that I know what data is processed, why it is processed, which services receive it, where it may be transferred, and what choices and rights I have.

**Why this priority**: Transparent information is the foundation for informed choices, legal accountability, and removing the GoAdopt dependency.

**Independent Test**: A new visitor can open every legal page from the public site, navigate its sections, identify the responsible entity and contact, and find every declared processing purpose and storage technology without visiting GoAdopt.

**BDD**: Required

**ATDD**: Required

**Acceptance Scenarios**:

1. **Given** a visitor is on any public Clipify page, **When** they use the legal navigation, **Then** they can reach the privacy policy, cookie policy, terms, imprint, and privacy-request information on Clipify-controlled pages.
2. **Given** a visitor opens the privacy or cookie policy, **When** they review a declared service, **Then** they can understand its purpose, data or storage categories, provider or recipient, retention information, consent status, and applicable transfer information.
3. **Given** a visitor uses a keyboard, assistive technology, or a narrow viewport, **When** they navigate a legal page, **Then** the content remains readable, navigable, and operable.

---

### User Story 2 - Review services and open existing preferences (Priority: P1)

As a visitor, I can understand which services and storage mechanisms Clipify uses and open the existing cookie-preferences dialog from the legal pages when I want to change my choice.

**Why this priority**: The new documents must connect understandable disclosures to the consent controls that already exist without rebuilding those controls inside this feature.

**Independent Test**: A visitor can inspect every declared category and service in the cookie policy and open the existing c15t preferences dialog from both the policy and footer. The feature does not alter c15t categories, defaults, persistence, API behavior, or service activation.

**BDD**: Required

**ATDD**: Required

**Acceptance Scenarios**:

1. **Given** a visitor opens the cookie policy, **When** they review a category, **Then** they can see the services, storage, purpose, provider, and consent status declared for it.
2. **Given** the visitor uses the cookie-preferences link, **When** the existing preferences dialog is available, **Then** that dialog opens without navigating away from the legal page.
3. **Given** the consent interface is temporarily unavailable, **When** the visitor opens the cookie policy, **Then** the complete legal disclosure remains readable and does not pretend that preferences were changed.

---

### User Story 3 - Exercise privacy rights (Priority: P2)

As a person whose data may be processed, I can find a Clipify-controlled request channel and understand how to request access, correction, deletion, portability, restriction, objection, or consent withdrawal where applicable.

**Why this priority**: Removing GoAdopt must not remove the existing privacy-request path or the accessible rights and complaint information required by the operator's legal baseline.

**Independent Test**: A visitor can reach the privacy-request page, select or understand the available request types, learn what verification is required, and contact the responsible address without a GoAdopt account or page.

**BDD**: Required

**ATDD**: Required

**Acceptance Scenarios**:

1. **Given** a visitor opens the privacy-request page, **When** they review the available rights, **Then** they see the EU-baseline rights, applicable qualifications, the contact channel, identity-verification expectations, and response process.
2. **Given** a person cannot use an authenticated workflow, **When** they need to submit a request, **Then** an accessible email-based route remains available.
3. **Given** a right is not universally applicable, **When** it is described, **Then** the page does not promise an unconditional outcome and explains that applicability and lawful exceptions may vary.

---

### User Story 4 - Keep disclosures aligned with the product (Priority: P2)

As the Clipify operator, I can update one reviewed service inventory and detect undeclared browser behavior so that the legal disclosures do not silently drift from the deployed product.

**Why this priority**: A static policy becomes misleading when services, storage keys, domains, or purposes change without coordinated updates.

**Independent Test**: Introducing an undeclared cookie, browser-storage key, third-party script, or network origin into a covered flow causes the compliance audit to fail; an approved inventory and policy-version update restores the gate.

**BDD**: Required

**ATDD**: Required

**Acceptance Scenarios**:

1. **Given** a declared service changes its storage or network behavior, **When** the compliance audit runs, **Then** the difference is reported against the reviewed inventory.
2. **Given** a processing purpose or consent category changes materially, **When** the change is prepared for release, **Then** a policy-version review and renewed-consent decision are required.
3. **Given** a visitor inspects activity on their device, **When** the browser cannot expose a storage item such as an HTTP-only cookie, **Then** the device view is clearly supplemental and the complete declared inventory remains visible.

### Edge Cases

- **EC-001**: JavaScript is disabled or the consent service is temporarily unavailable; legal content remains readable and does not claim that a preference was changed.
- **EC-002**: A service creates a dynamic or suffixed storage key; the inventory supports reviewed patterns without accepting unrelated keys.
- **EC-003**: A browser exposes only part of the device state; the page never presents runtime detection as the exhaustive legal inventory.
- **EC-004**: The existing c15t preferences interface is temporarily unavailable; the legal documents remain readable and the preference entry point fails clearly without simulating a saved choice.
- **EC-005**: A previously accepted purpose is materially changed; the old consent is not treated as authorization for the new purpose.
- **EC-006**: A privacy request cannot be safely fulfilled without identity verification or must be retained because of a legal obligation; the requester receives a clear process rather than an unconditional promise.
- **EC-007**: A requested right is limited by an exception or does not apply to the requester's situation; the page communicates scope without denying the general request channel.
- **EC-008**: A legal document or registry entry is incomplete at build time; publication fails instead of rendering placeholders or omitting required disclosures.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Clipify MUST host its privacy policy, cookie policy, terms of service, privacy-request information, and imprint on Clipify-controlled, publicly reachable pages.
- **FR-002**: All product links to superseded GoAdopt documents or request pages MUST be replaced, and normal user journeys MUST make no request to a GoAdopt domain.
- **FR-003**: Legal pages MUST be available in English, use clear language, expose an effective date and policy version, and remain usable on supported mobile and desktop layouts and with keyboard navigation.
- **FR-004**: The privacy policy MUST identify the responsible entity and contact; describe collected data categories and sources, purposes and legal bases, recipients and processors, international transfers and safeguards, retention criteria, security principles, applicable individual rights, complaint routes, consent withdrawal, children-related rules, and material-change handling.
- **FR-005**: The privacy policy MUST account for relevant processing in account authentication, Twitch integrations, payments, communications, support, security, consent records, analytics, observability, application logs, and self-hosted components based on verified product behavior.
- **FR-006**: The cookie policy MUST disclose cookies and all comparable terminal-storage or access technologies, including local storage, session storage, scripts, tags, pixels, link decoration, and external network services where present.
- **FR-007**: Every declared service MUST expose a reviewed category, purpose, provider, data or storage classes, storage names or bounded patterns, domain or origin, lifetime or retention criterion, first- or third-party status, recipient and location information, consent requirement, and revocation behavior where applicable.
- **FR-008**: The complete declared inventory MUST be the authoritative disclosure; any current-device view MUST be labeled supplemental, MUST NOT expose stored values, and MUST NOT transmit inspected values to the server.
- **FR-009**: Visitors MUST be able to open the existing cookie-preferences interface directly from the cookie policy and footer.
- **FR-010**: This feature MUST NOT change c15t categories, default choices, consent persistence, consent API behavior, reload behavior, service activation, revocation, or cleanup semantics.
- **FR-011**: The cookie policy MUST explain the currently configured categories and link each category to its declared services without duplicating consent state or introducing a second preference store.
- **FR-012**: Strictly necessary processing MUST be disclosed even when it does not require consent, and no service MAY be classified as necessary solely because it benefits Clipify.
- **FR-013**: Cookieless, self-hosted audience measurement that Clipify elects to run without optional consent MUST be disclosed separately with its rationale and actual data behavior; it MUST NOT be presented as an optional switch that has no effect.
- **FR-014**: Clipify MUST provide an accessible privacy-request route covering access, correction, deletion, portability, restriction, objection, and consent withdrawal where applicable, while preserving lawful exceptions and request-specific qualifications.
- **FR-015**: The privacy-request route MUST explain contact details, identity verification, expected processing stages, possible extensions or refusals, complaint options, and a route for people without an account.
- **FR-016**: Terms of service MUST document service scope, eligibility, account and external-platform dependencies, acceptable use, user content, paid-plan billing and cancellation rules, self-hosted runner responsibilities, availability and changes, suspension and termination, liability subject to mandatory law, and governing-law or dispute information.
- **FR-017**: Material changes to a processing purpose, recipient, consent category, or legal basis MUST require an explicit policy-version review and a recorded decision on whether renewed consent or additional notice is required.
- **FR-018**: The operator MUST have an automated read-only documentation audit covering representative public and authenticated flows and the service states needed to observe declared storage and origins; findings that require consent-engine changes MUST be recorded for separate work.
- **FR-019**: The automated audit MUST compare cookies, browser-storage names, external scripts, and relevant network origins against bounded reviewed declarations and fail on unknown or forbidden behavior.
- **FR-020**: Publication MUST fail when required legal metadata, referenced service disclosures, policy versioning, or mandatory contact information is missing or inconsistent.
- **FR-021**: The compliance model MUST publish one English legal-document set using EU/EEA and German data-protection and terminal-access rules as the operator's baseline; regional document variants are out of scope unless a later concrete legal or operational trigger requires them.
- **FR-022**: Legal prose MUST be independently authored from verified Clipify facts and official requirements; prior GoAdopt documents MAY be used as a private migration checklist but MUST NOT be published as a substantially identical copy.
- **FR-023**: The system MUST retain reviewable evidence connecting each consent-affecting service declaration to its user-facing disclosure and automated audit coverage.

### Key Entities

- **Legal Document**: A versioned public policy or contractual document with title, applicability scope, effective date, version, sections, responsible owner, and change classification.
- **Service Declaration**: The reviewed description of one processing or storage-producing service, including purpose, category, provider, data classes, recipients, regions, retention, legal basis, consent behavior, and technical origins.
- **Storage Declaration**: A cookie, local-storage, session-storage, or comparable terminal-access item identified by an exact name or bounded pattern, with domain, duration, purpose, and removal behavior.
- **Consent Category Reference**: A read-only projection of an existing c15t category and its declared services for display in the legal documents.
- **Policy Release**: A reviewed snapshot connecting effective legal text, service inventory, consent schema, material-change decision, and audit evidence.
- **Privacy Request Channel**: The published method and process through which a person can exercise potentially applicable privacy rights.
- **Compliance Audit Result**: Read-only evidence from representative browser flows showing declared and observed storage, scripts, origins, differences, and the documentation release outcome.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of public legal and privacy links resolve to Clipify-controlled pages, with zero GoAdopt requests during covered user journeys.
- **SC-002**: A visitor can reach every legal document and reopen cookie preferences within two interactions from any public page.
- **SC-003**: 100% of currently configured consent categories and declared services are represented in the cookie policy without creating an additional consent state.
- **SC-004**: The cookie policy and footer open the existing c15t preferences interface in 100% of supported UI tests, while a simulated unavailable interface leaves the documents readable and records no false preference change.
- **SC-005**: Every observed cookie, browser-storage name, external script, and reviewed external origin in covered flows maps to exactly one approved declaration or an explicitly documented platform exception.
- **SC-006**: 100% of published service declarations include all mandatory disclosure fields and are represented consistently in the consent details and cookie policy.
- **SC-007**: A privacy requester can identify the relevant request channel, verification expectations, and potential response outcomes in under three minutes without creating an account.
- **SC-008**: No policy release containing missing mandatory metadata, unreviewed material processing changes, or a failing compliance audit can pass the release gate.
- **SC-009**: Legal content remains fully readable and navigable at 320 CSS pixels width and by keyboard, and meets the project's automated accessibility checks for covered pages.
- **SC-010**: The final release publishes exactly one English legal-document set, records the EU/EEA and German baseline, and contains no unsupported claim of guaranteed worldwide compliance.

## Assumptions

- Clipify remains English-only for this feature; localization can be added through a later policy release.
- The operator is established in Germany, so EU/EEA and German requirements are the baseline for this feature.
- Clipify uses one English document set for all visitors. Separate regional documents and geolocation-based policy variants are out of scope.
- Other jurisdictions are reassessed only when a concrete trigger exists, such as local establishment or targeting, a statutory threshold, a materially new processing activity, or qualified legal advice.
- Clipify does not sell personal information or use cross-context behavioral advertising unless a verified product audit proves otherwise; the policies must state facts rather than rely on this assumption.
- The current consent platform remains the persistence and consent-record mechanism; this feature replaces GoAdopt documents and request pages, not the current consent engine.
- The first privacy-request implementation provides a clear email-based route; authenticated export or deletion automation is a separately scoped enhancement.
- Existing GoAdopt text is used only to recover Clipify-specific facts and missing topics. Public text is independently written and reviewed.
- Legal and business claims require operator confirmation and, where risk justifies it, qualified legal review; generated documents are not represented as legal advice or guaranteed compliance.

---

## Test-First Specification Addendum _(mandatory)_

### Test Classification and Applicability Matrix

| Source ID     | Source Type            | Description                                                     | TDD      | BDD      | ATDD     | Test Intent / N/A Rationale                                                        |
| ------------- | ---------------------- | --------------------------------------------------------------- | -------- | -------- | -------- | ---------------------------------------------------------------------------------- |
| US1           | User Story             | Understand local legal disclosures                              | Required | Required | Required | Content, navigation, accessibility, and disclosure acceptance evidence             |
| US2           | User Story             | Review services and open existing preferences                   | Required | Required | Required | Document projection, category disclosure, and existing-dialog integration evidence |
| US3           | User Story             | Exercise privacy rights                                         | Required | Required | Required | Rights content and reachable request-channel evidence                              |
| US4           | User Story             | Keep disclosures aligned                                        | Required | Required | Required | Registry, audit, material-change, and release-gate evidence                        |
| FR-001–FR-003 | Functional Requirement | Local documents, migration, presentation                        | Required | Required | Required | Route/link contract, responsive and accessible navigation scenarios                |
| FR-004–FR-008 | Functional Requirement | Privacy and storage disclosure completeness                     | Required | Required | Required | Schema validation, rendered policy scenarios, and device-inspector privacy checks  |
| FR-009–FR-013 | Functional Requirement | Existing consent integration and service classification         | Required | Required | Required | Read-only category projection, dialog entry, fallback, and disclosure scenarios    |
| FR-014–FR-016 | Functional Requirement | Rights and terms content                                        | Required | Required | Required | Required-section validation and user-facing request scenarios                      |
| FR-017–FR-020 | Functional Requirement | Versioning, audit, and publication gates                        | Required | Required | Required | Material-change and undeclared-behavior failure scenarios                          |
| FR-021–FR-023 | Functional Requirement | EU/German scope, independent authorship, traceability           | Required | Required | Required | Legal-scope record, provenance review, and declaration-to-evidence coverage        |
| SC-001–SC-010 | Success Criterion      | Release outcomes                                                | Required | Required | Required | Measured by the shared ATDD release suite and quality gates                        |
| EC-001–EC-008 | Edge Case              | Availability, detection, concurrency, legal scope, completeness | Required | Required | Required | Dedicated negative or boundary examples for every listed edge condition            |

All BDD and ATDD roles share the ATDD-owned end-to-end scenarios below because each observable behavior is also the stakeholder release boundary. Unit and integration behavior remains TDD-owned; equivalent Gherkin artifacts are not duplicated.

### ATDD and BDD Acceptance Evidence _(Gherkin)_

Planned owning artifact: `tests/atdd/features/local-legal-compliance.feature`. Each scenario is owned by ATDD and carries both ATDD and BDD evidence roles.

```gherkin
@ATDD @BDD @US1 @FR-001 @FR-002 @FR-003 @SC-001 @SC-002 @SC-009
Feature: Local legal center
  @ATDD-US1-001
  Scenario: A visitor reaches complete local legal information
    Given the visitor is on a public Clipify page
    When they follow each legal and privacy navigation entry
    Then every destination is hosted by Clipify and contains its required metadata
    And no covered journey requests a GoAdopt resource

  @ATDD-US1-002 @EC-001
  Scenario: Legal content remains available without client scripting
    Given client scripting is unavailable
    When the visitor opens each public legal document
    Then the legal content and contact route remain readable
    And no preference change is represented as saved

  @ATDD-US1-003 @EC-003
  Scenario: Device activity is clearly supplemental
    Given the browser cannot expose every stored item
    When the visitor compares current-device activity with the cookie policy
    Then the complete declared inventory remains visible
    And no storage value is displayed or transmitted

@ATDD @BDD @US2 @FR-009 @FR-010 @FR-011 @FR-012 @FR-013 @SC-003 @SC-004
Feature: Legal disclosures connect to existing preferences
  @ATDD-US2-001
  Scenario: The cookie policy displays every configured category
    Given Clipify has its existing c15t consent categories
    When the visitor opens the cookie policy
    Then each configured category and its declared services are visible
    And no second consent state is created by the legal page

  @ATDD-US2-002
  Scenario Outline: Each category has a complete legal disclosure
    Given the visitor has opened the cookie policy
    When they expand <category>
    Then its <expected-content> is visible
    Examples:
      | category           | expected-content                                      |
      | strictly necessary | purpose, storage, provider, and always-active status  |
      | functionality      | purpose, storage, provider, and optional status       |
      | measurement        | purpose, storage, provider, and measurement status    |

  @ATDD-US2-003 @EC-004
  Scenario: The legal page opens the existing preferences dialog
    Given the existing c15t preferences interface is available
    When the visitor selects cookie preferences from the legal page
    Then the existing preferences dialog opens
    And the visitor remains on the legal page

  @ATDD-US2-004
  Scenario: Legal content survives an unavailable preferences interface
    Given the existing c15t preferences interface is unavailable
    When the visitor opens the cookie policy
    Then all legal disclosures remain readable
    And no preference change is represented as saved

@ATDD @BDD @US3 @FR-014 @FR-015 @FR-016 @SC-007
Feature: Privacy rights and service terms
  @ATDD-US3-001 @EC-006 @EC-007
  Scenario: A person can start an appropriately qualified privacy request
    Given the person has no Clipify account
    When they open the privacy-request page
    Then they can identify a contact route and verification process
    And applicable rights, lawful exceptions, timelines, and complaint options are explained

  @ATDD-US3-002
  Scenario: Required service terms are available before use or purchase
    Given a visitor is considering a Clipify account or paid plan
    When they open the terms
    Then the service, billing, cancellation, external-platform, runner, termination, liability, and dispute topics are present

@ATDD @BDD @US4 @FR-017 @FR-018 @FR-019 @FR-020 @FR-021 @FR-022 @FR-023 @SC-005 @SC-006 @SC-008 @SC-010
Feature: Compliance evidence gates release
  @ATDD-US4-001 @EC-002
  Scenario: An undeclared browser behavior blocks release
    Given a covered flow creates an unknown storage name or external origin
    When the compliance audit runs
    Then the audit identifies the observed behavior and flow
    And the release gate fails until a bounded declaration is reviewed

  @ATDD-US4-002 @EC-005
  Scenario: A material purpose change requires policy review
    Given a declared purpose, recipient, legal basis, or consent category changes materially
    When the policy release is prepared
    Then the policy version must change
    And a renewed-consent or additional-notice decision must be recorded

  @ATDD-US4-003 @EC-008
  Scenario: Incomplete legal metadata blocks publication
    Given a legal document or service declaration is missing a mandatory field
    When publication validation runs
    Then publication fails with the missing field identified

  @ATDD-US4-004
  Scenario: One EU-baseline document set is approved
    Given a policy release is ready for approval
    When the legal-scope review is performed
    Then one English document set records the EU or EEA and German baseline
    And no regional policy variant is required without a documented future trigger
    And the documents do not claim guaranteed worldwide compliance
```

### TDD Test Inventory _(mandatory)_

| Test ID     | Source ID(s)                   | Test Level       | Planned Path                                              | Intent                                                                 | Expected Initial Failure                |
| ----------- | ------------------------------ | ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| TDD-US1-001 | FR-001, FR-003                 | Unit             | `src/app/lib/legal/documents.test.ts`                     | Validate required document metadata and local routes                   | Legal manifest does not exist           |
| TDD-US1-002 | FR-004, FR-005, FR-016         | Unit             | `src/app/lib/legal/content.test.ts`                       | Validate mandatory privacy and terms topics                            | Local legal content does not exist      |
| TDD-US1-003 | FR-002, SC-001                 | Integration      | `src/app/lib/legal/linkMigration.test.ts`                 | Detect GoAdopt URLs in user-facing sources                             | Existing links remain                   |
| TDD-US1-004 | FR-007, FR-008                 | Unit             | `src/app/lib/consent/registry.test.ts`                    | Validate disclosure completeness and safe device projection            | Registry lacks compliance fields        |
| TDD-US1-005 | EC-003, FR-008                 | Component        | `src/app/components/legal/DeviceStorage.test.tsx`         | Hide values and label incomplete browser visibility                    | Component is missing                    |
| TDD-US2-001 | FR-009, FR-010                 | Component        | `src/app/components/legal/CookiePreferencesLink.test.tsx` | Open the existing preferences interface without owning consent state   | Legal preference entry point is missing |
| TDD-US2-002 | FR-011, EC-004                 | Integration      | `src/app/lib/legal/consentProjection.test.ts`             | Project existing categories into documents and handle unavailable UI   | Read-only projection is missing         |
| TDD-US2-003 | FR-010                         | Regression       | `src/app/lib/legal/consentBoundary.test.ts`               | Prove document code cannot mutate c15t configuration or persistence    | Scope boundary is not enforced          |
| TDD-US2-004 | FR-012, FR-013                 | Unit             | `src/app/lib/legal/serviceClassification.test.ts`         | Validate necessary and always-on disclosure consistency                | Classification validation is missing    |
| TDD-US3-001 | FR-014, FR-015, EC-006, EC-007 | Unit             | `src/app/lib/legal/rights.test.ts`                        | Validate rights, qualifications, verification, and request route       | Rights manifest does not exist          |
| TDD-US3-002 | FR-016                         | Unit             | `src/app/lib/legal/terms.test.ts`                         | Validate business terms topics and operator-confirmed facts            | Terms content does not exist            |
| TDD-US4-001 | FR-017, EC-005                 | Unit             | `src/app/lib/legal/versioning.test.ts`                    | Classify material changes and require review decisions                 | Versioning rule is missing              |
| TDD-US4-002 | FR-018, FR-019, EC-002         | Integration      | `tests/compliance/inventory-audit.test.ts`                | Compare exact and bounded observed storage/origins                     | Browser audit is missing                |
| TDD-US4-003 | FR-020, EC-008                 | Build validation | `scripts/validate-legal-content.test.ts`                  | Reject incomplete or inconsistent publication inputs                   | Publication validator is missing        |
| TDD-US4-004 | FR-021, SC-010                 | Unit             | `src/app/lib/legal/scope.test.ts`                         | Require one EU/German-baseline document strategy without global claims | Legal-scope record is missing           |
| TDD-US4-005 | FR-022, FR-023                 | Quality gate     | `tests/compliance/provenance-and-traceability.test.ts`    | Require source notes and declaration-to-audit mappings                 | Evidence registry is missing            |

### Scenario Coverage Matrix _(mandatory)_

| Scenario / Example ID      | Owning Suite | Evidence Role(s) | Primary Source ID | Covered Inputs / Classes                           | Type              | Interface        | Rationale                                                                       |
| -------------------------- | ------------ | ---------------- | ----------------- | -------------------------------------------------- | ----------------- | ---------------- | ------------------------------------------------------------------------------- |
| ATDD-US1-001               | ATDD         | ATDD, BDD        | US1               | All local legal links and metadata                 | Positive          | Public UI        | Same end-to-end journey proves behavior and release acceptance                  |
| ATDD-US1-002               | ATDD         | ATDD, BDD        | EC-001            | No scripting or consent backend                    | Negative          | Public UI        | Verifies resilient disclosure and privacy-safe failure                          |
| ATDD-US1-003               | ATDD         | ATDD, BDD        | EC-003            | Partial browser visibility                         | Boundary          | Cookie policy UI | Prevents a misleading exhaustive claim                                          |
| ATDD-US2-001               | ATDD         | ATDD, BDD        | FR-010            | Existing c15t categories                           | Boundary          | Cookie policy UI | Proves the document is a read-only projection                                   |
| ATDD-US2-002:necessary     | ATDD         | ATDD, BDD        | FR-012            | Strictly necessary                                 | Positive          | Cookie policy UI | Required category disclosure                                                    |
| ATDD-US2-002:functionality | ATDD         | ATDD, BDD        | FR-011            | Functionality                                      | Positive          | Cookie policy UI | Required category disclosure                                                    |
| ATDD-US2-002:measurement   | ATDD         | ATDD, BDD        | FR-013            | Measurement                                        | Positive          | Cookie policy UI | Required category disclosure                                                    |
| ATDD-US2-003               | ATDD         | ATDD, BDD        | FR-009            | Existing preferences available                     | Positive          | Legal UI/c15t UI | Confirms integration without rebuilding c15t                                    |
| ATDD-US2-004               | ATDD         | ATDD, BDD        | EC-004            | Existing preferences unavailable                   | Negative          | Legal UI         | Legal content remains complete without a false save                             |
| ATDD-US3-001               | ATDD         | ATDD, BDD        | US3               | Unauthenticated and request-qualified rights       | Positive/boundary | Public UI/email  | Same journey proves rights access and release boundary                          |
| ATDD-US3-002               | ATDD         | ATDD, BDD        | FR-016            | Account, paid plan, runner                         | Positive          | Public UI        | Confirms stakeholder-required terms topics                                      |
| ATDD-US4-001               | ATDD         | ATDD, BDD        | FR-019            | Unknown exact key, allowed pattern, unknown origin | Negative/boundary | Audit gate       | Risk-based examples cover exact and bounded declarations                        |
| ATDD-US4-002               | ATDD         | ATDD, BDD        | EC-005            | Purpose, recipient, basis, category changes        | Transition        | Release workflow | Pairwise sampling is not used; all material classes are evaluated by rule tests |
| ATDD-US4-003               | ATDD         | ATDD, BDD        | EC-008            | Missing document and service fields                | Negative          | Build gate       | Prevents incomplete publication                                                 |
| ATDD-US4-004               | ATDD         | ATDD, BDD        | SC-010            | One English set and EU/German baseline             | Positive/boundary | Release review   | Proves the scoped legal strategy without regional document sprawl               |

### Specification Traceability Inputs

- Every functional requirement, success criterion, and edge case maps to either a listed TDD artifact, ATDD scenario, or both.
- The ATDD-owned Gherkin suite also carries BDD evidence because observable user behavior and stakeholder release acceptance are identical for these end-to-end flows; unit and integration behavior is not duplicated there.
- Scenario outline examples enumerate every existing consent category as a disclosure class. Material-change classes are exhaustively covered by rule tests and represented by one release-workflow scenario.
- Negative paths cover unavailable scripting, partial device visibility, unavailable preference UI, request qualifications, unknown observed behavior, material changes, and incomplete publication data.
- Every planned executable artifact has one owning suite.
