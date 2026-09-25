# Cycle Log: Local Legal and Privacy Center

Append only. Newest last. Every future entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `bun run test:coverage` -> 140 suites passed, 0 failed; 1,148 tests passed, 0 failed; 0 snapshots
- coverage: 75.47% statements, 68.22% branches, 73.52% functions, 78.83% lines
- commit: `218692f`
- recorded: cycle 0, before local legal-document implementation; Jest runtime 183.468 seconds

## Notes and deviations

- No feature behavior was credited as already covered. Existing consent tests verify parts of the current c15t runtime, but they do not prove the new legal-document, disclosure, audit, or read-only projection requirements.
- The profile has no safe Jest single-test-by-name command; inner cycles must use the verified whole-file command.
- Mutation tooling is not installed. Where test strength needs extra proof, record deliberate-mutant spot checks until the separate mutation bootstrap is complete.

## Outer loop opened: A1 reaches every local legal destination

- test: `test/bdd/features/local-legal-compliance.feature::@ATDD-US1-001` (new)
- red: `bunx playwright test .features-gen/local-legal-compliance.feature.spec.js --project=bdd-chromium -g "A visitor reaches every local legal destination"`
  -> `Expected: "/legal/privacy"` / `Received: "https://hub.goadopt.io/document/3852d930-97b9-46c2-950d-823e62515ab4?language=en"` (1 failed)
- green: pending the inner behaviors that create the local manifest, routes, and navigation
- refactor: pending
- commit: none; the working tree contains pre-existing uncommitted feature and test-infrastructure work

## Cycle 1: U1 exposes exactly the five required local routes

- test: `test/app/lib/legalDocuments.test.ts::exposes exactly the five required unique local routes` (new)
- red: `bunx jest test/app/lib/legalDocuments.test.ts --runInBand`
  -> `Expected: ["/legal/privacy", "/legal/cookies", "/legal/terms", "/legal/privacy-requests", "/imprint"]` / `Received: []` (1 failed)
- green: `src/app/lib/legal/documents.ts` now exports the five stable manifest IDs and Clipify-controlled routes. File run -> 1 passed; full `bun run test:coverage` -> 141 suites and 1,149 tests passed in 140.488 seconds
- refactor: none needed; the manifest is the smallest data shape required by U1
- commit: none; the working tree contains pre-existing uncommitted feature and test-infrastructure work
- note: the first run failed on the intentionally absent module and was not counted as Red. A subsequent Green attempt exposed unsupported `toHaveSize`; the assertion was corrected to compare `Set.size` without weakening the requirement.

## Cycle 2: U2 provides publishable metadata for every legal document

- test: `test/app/lib/legalDocuments.test.ts::provides publishable metadata for every legal document` (new)
- red: `bunx jest test/app/lib/legalDocuments.test.ts --runInBand`
  -> `Expected: Any<String>` / `Received: undefined` at `document.title` (1 failed, 1 passed)
- green: `src/app/lib/legal/documents.ts` now gives every manifest entry a non-empty title, semantic policy version, ISO effective/update dates, and the single English EU/EEA/German scope statement. File run -> 2 passed; full `bun run test:coverage` -> 141 suites and 1,150 tests passed in 175.436 seconds
- refactor: shared identical release metadata through `initialPolicyMetadata`; suite remained green
- commit: none; the working tree contains pre-existing uncommitted feature and test-infrastructure work

## Cycle 3: U3 covers every required privacy and processing topic

- test: `test/app/lib/legalContent.test.ts::covers every required privacy and processing topic` (new)
- red: `bunx jest test/app/lib/legalContent.test.ts --runInBand`
  -> expected the 19 required section IDs, received `[]` (1 failed)
- green: `src/app/lib/legal/documents.ts` now contains independently written structured summaries for the controller, data, purposes/bases, product processing, recipients/transfers, retention/security, rights/complaints/withdrawal, children, and material-change topics. File run -> 1 passed; full `bun run test:coverage` -> 142 suites and 1,151 tests passed in 168.978 seconds
- refactor: none needed; one ordered section collection is the minimum model required by U3
- commit: none; the working tree contains pre-existing uncommitted feature and test-infrastructure work
- note: the first run attempted to read the not-yet-exported collection and was not counted as Red; an empty typed export produced the recorded assertion failure.

## Cycle 4: U4 keeps user-facing legal destinations local

- test: `test/app/lib/legalLinkMigration.test.ts::uses local legal routes and contains no GoAdopt URL in user-facing sources` (new)
- red: `bunx jest test/app/lib/legalLinkMigration.test.ts --runInBand`
  -> `Expected pattern: not /goadopt\.io/i` while the collected footer, consent, login, and machine-readable sources still contained `hub.goadopt.io` (1 failed)
- green: footer, login, consent UI, `llms.txt`, and `llms-full.txt` now use Clipify-hosted privacy, cookie, terms, and privacy-request destinations. File run -> 1 passed; full `bun run test:coverage` -> 143 suites and 1,152 tests passed in 152.963 seconds
- refactor: centralized application route strings in `legalDocumentRoutes` and reused them from the manifest and TypeScript consumers. The focused test remained green; post-refactor full `bun run test:coverage` -> 143 suites and 1,152 tests passed in 165.104 seconds
- commit: none; the working tree contains pre-existing uncommitted feature and test-infrastructure work

## Blocker after cycle 4

- A1 remains Red because its acceptance scenario requires five live local pages, but the inner behavior list covers only their manifest, content data, and link migration.
- The production work needed to close A1 spans the uncompleted shared shell and privacy/cookie route tasks (`T020`-`T022`) plus terms and privacy-request routes scheduled later (`T081`, `T088`). Those route-rendering behaviors have no corresponding inner behavior/test marker, so implementing them here would violate the one-behavior test-first loop and the command's checkbox-only task-edit boundary.
- No acceptance assertion was weakened and no untested route implementation was added. Refresh the TDD plan so route rendering is decomposed into testable inner behaviors and ordered before A1 can close.

## Cycle 5: U5 provides complete service declarations

- test: `test/app/lib/consentRegistry.test.ts::provides complete declarations` (new)
- red: `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
  -> `Expected: ObjectContaining ... "purpose": Any<String>` while `consent-storage` contained only the legacy display fields (1 failed)
- green: every necessary and optional service now provides category, purpose, data classes, recipient, regions, retention, legal basis, consent requirement, revocation, policy references, and audit flows. File run -> 1 passed
- refactor: none needed; fields remain colocated with their existing service definitions
- commit: none, per user instruction

## Cycle 6: U6 requires a reviewed necessity rationale

- test: `test/app/lib/consentRegistry.test.ts::requires a reviewed necessity rationale` (new)
- red: `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
  -> `Expected: ObjectContaining { "necessityRationale": StringMatching /(user-requested|security-critical)/i }` for `consent-storage` (1 failed, 1 passed)
- green: both necessary services now state a reviewed user-requested or security-critical rationale. File run -> 2 passed
- refactor: none needed; the rationale is an explicit declaration field
- commit: none, per user instruction

## Cycle 7: U7 rejects keys on a no-storage declaration

- test: `test/app/lib/consentRegistry.test.ts::rejects storage keys on a no-storage declaration` (new)
- red: `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
  -> `Expected value: "A no-storage service cannot declare cookie or web-storage keys."` / `Received array: []` (1 failed, 2 passed)
- green: declaration validation now rejects named cookie, local-storage, or session-storage entries when the service claims no storage. File run -> 3 passed
- refactor: introduced the smallest structural validator seam needed for subsequent registry invariants
- commit: none, per user instruction

## Cycle 8: U8 accepts only bounded matching storage patterns

- test: `test/app/lib/consentRegistry.test.ts::accepts only bounded matching storage patterns` (new, property)
- red: `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
  -> `Expected: true` / `Received: false` for `chatwoot_campaigns_widget-123:ts` (1 failed, 3 passed)
- green: exact names and anchored bounded regular expressions can match observations; unanchored, wildcard-all, invalid, or unrelated generated names cannot match. File run -> 4 passed
- refactor: extracted `isBoundedStoragePattern` so validation and matching share one rule
- commit: none, per user instruction

## Cycle 9: U9 assigns every external origin to one service

- test: `test/app/lib/consentRegistry.test.ts::assigns each external origin to exactly one service` (new)
- red: `bunx jest test/app/lib/consentRegistry.test.ts --runInBand`
  -> `Expected length: 1` / `Received length: 0` for the first declared external origin (1 failed, 4 passed)
- green: services now declare reviewed origins and the lookup returns the single owning declaration. File run -> 5 passed
- refactor: replaced a tuple-cast lookup with an explicit equality predicate; file remained 5/5 green
- commit: none, per user instruction

## Existing coverage credited: U10 disclosure and audit mapping

- `test/app/lib/consentRegistry.test.ts::provides complete declarations` already asserts a non-empty `policyReferences` and `auditFlows` collection for every necessary and optional service.
- No duplicate test was added; the focused registry file remained 5/5 green.

## Cycle 10: U11 renders storage names and types without values

- test: `test/app/components/legal/DeviceStorageInspector.test.tsx::renders storage names and types without values` (new)
- red: `bunx jest test/app/components/legal/DeviceStorageInspector.test.tsx --runInBand`
  -> `TestingLibraryElementError: Unable to find an element with the text: c15t` (1 failed)
- green: the client component renders only an observation's name and human-readable storage type; the value is never placed in the DOM and no network call is made. File run -> 1 passed
- refactor: centralized the three storage-type labels in a typed map
- commit: none, per user instruction
- note: the first run failed because jsdom did not define `fetch`; that setup failure was corrected before recording the assertion Red above.

## Cycle 11: U12 labels incomplete inspection as supplemental

- test: `test/app/components/legal/DeviceStorageInspector.test.tsx::labels unavailable browser visibility as supplemental` (new)
- red: `bunx jest test/app/components/legal/DeviceStorageInspector.test.tsx --runInBand`
  -> `TestingLibraryElementError: Unable to find an element with the text: /supplemental/i` (1 failed, 1 passed)
- green: the inspector always explains its limited browser visibility and authoritative declared inventory, and reports unavailability without claiming that nothing is stored. File run -> 2 passed
- refactor: none needed; the disclosure is a small semantic section
- commit: none, per user instruction

## Cycle 12: U13 projects existing consent state read-only

- test: `test/app/lib/legalConsentProjection.test.ts::projects existing categories without creating consent state` (new)
- red: `bunx jest test/app/lib/legalConsentProjection.test.ts --runInBand`
  -> expected necessary/functionality/measurement selections, received `Array []` (1 failed)
- green: the projection reads the three existing c15t categories, their display details, declarations, and supplied selections without mutating the frozen input. File run -> 1 passed
- refactor: category order is centralized as a typed constant
- commit: none, per user instruction

## Cycle 13: U14 discloses necessary and cookieless measurement truthfully

- test: `test/app/lib/legalServiceClassification.test.ts::discloses necessary and cookieless measurement truthfully` (new)
- red: `bunx jest test/app/lib/legalServiceClassification.test.ts --runInBand`
  -> the necessary projection lacked `userConfigurable: false` (1 failed)
- green: necessary is explicitly non-configurable, while self-hosted cookieless Plausible is disclosed separately as always-on, consent-free, storage-free, and without an ineffective optional toggle. File run -> 1 passed
- refactor: kept always-on disclosures separate from c15t category projection to avoid inventing consent state
- commit: none, per user instruction

## Cycle 14: U15 opens the existing dialog in place

- test: `test/app/components/legal/CookiePreferencesLink.test.tsx::opens the existing dialog without leaving the legal route` (new)
- red: `bunx jest test/app/components/legal/CookiePreferencesLink.test.tsx --runInBand`
  -> `Unable to find an accessible element with the role "button" and name "Cookie preferences"` (1 failed)
- green: the legal-page button invokes c15t's existing `openDialog` integration and does not navigate. File run -> 1 passed
- refactor: none needed; the component remains a single boundary control
- commit: none, per user instruction

## Cycle 15: U16 reports an unavailable dialog without saving

- test: `test/app/components/legal/CookiePreferencesLink.test.tsx::reports an unavailable dialog without saving a choice` (new)
- red: `bunx jest test/app/components/legal/CookiePreferencesLink.test.tsx --runInBand`
  -> `TypeError: openDialog is not a function`, and no status element was rendered (1 failed, 1 passed)
- green: an unavailable integration produces an accessible status message and performs no storage write or false save. File run -> 2 passed
- refactor: extracted one guarded click handler and kept c15t as the only dialog owner
- commit: none, per user instruction

## Cycle 16: U17 enforces the read-only c15t boundary

- test: `test/app/lib/legalConsentBoundary.test.ts::keeps legal modules read-only toward c15t` (new)
- red: `bunx jest test/app/lib/legalConsentBoundary.test.ts --runInBand`
  -> expected the deliberate `localStorage.setItem` mutant to report `consent persistence`, received `Array []` (1 failed)
- green: the boundary scanner rejects direct consent persistence, action, cleanup, reload, and backend capabilities while current legal sources remain violation-free. File run -> 1 passed
- refactor: centralized named forbidden capabilities in one immutable rule list
- commit: none, per user instruction

## Cycle 17: U18 provides the complete no-account request process

- test: `test/app/lib/legalRights.test.ts::provides the complete request process without requiring an account` (new)
- red: `bunx jest test/app/lib/legalRights.test.ts --runInBand`
  -> expected the eight supported intentions, received `Array []` (1 failed)
- green: the guidance now provides all request intentions, a durable email address without account requirement, four processing stages, and complaint routes. File run -> 1 passed
- refactor: represented the reviewed process as immutable structured content
- commit: none, per user instruction

## Cycle 18: U19 requires safe proportionate verification

- test: `test/app/lib/legalRights.test.ts::requires safe and proportionate identity verification` (new)
- red: `bunx jest test/app/lib/legalRights.test.ts --runInBand`
  -> expected the prohibited initial credential list, received `undefined` (1 failed, 1 passed)
- green: guidance now forbids passwords, authentication secrets, Twitch tokens, and full payment credentials and requires sufficient identity and authority before disclosure or deletion. File run -> 2 passed
- refactor: none needed; safety guidance remains explicit data
- commit: none, per user instruction

## Cycle 19: U20 qualifies rights and outcomes

- test: `test/app/lib/legalRights.test.ts::qualifies rights and outcomes` (new)
- red: `bunx jest test/app/lib/legalRights.test.ts --runInBand`
  -> `Expected pattern: /where applicable/i` / `Received string: ""` (1 failed, 2 passed)
- green: applicability, lawful exceptions, retention duties, extensions, partial fulfillment, refusal, and complaint routes are all explicitly qualified. File run -> 3 passed
- refactor: grouped qualifications into independently reviewable immutable statements
- commit: none, per user instruction
- note: the first attempt called `join` on the absent property and was not counted; an empty typed collection produced the recorded assertion Red.

## Cycle 20: U21 contains every required terms topic

- test: `test/app/lib/legalTerms.test.ts::contains every required terms topic` (new)
- red: `bunx jest test/app/lib/legalTerms.test.ts --runInBand`
  -> expected the 14 required topic IDs, received `Array []` (1 failed)
- green: independently authored structured terms now cover service scope, eligibility, accounts, external platforms, acceptable use, content, billing, cancellation, Runner duties, availability, suspension, termination, mandatory-law liability, governing law, and disputes. File run -> 1 passed
- refactor: kept each reviewable topic in a single ordered section collection
- commit: none, per user instruction

## Cycle 21: U22 requires review for every material change class

- test: `test/app/lib/legalVersioning.test.ts::requires review for material change` (new table-driven examples)
- red: `bunx jest test/app/lib/legalVersioning.test.ts --runInBand`
  -> `Expected classification: "material"` / `Received classification: "editorial"` (10 failed)
- green: all ten specified material-change classes require a version change and a recorded consent-or-notice decision. File run -> 10 passed
- refactor: none yet; the conservative implementation intentionally leaves the editorial boundary for U23
- commit: none, per user instruction

## Cycle 22: U23 preserves the editorial boundary

- test: `test/app/lib/legalVersioning.test.ts::keeps meaning-preserving change editorial` (new table-driven examples)
- red: `bunx jest test/app/lib/legalVersioning.test.ts --runInBand`
  -> expected classification `editorial`, received `material` for all three boundary cases (3 failed, 10 passed)
- green: typographical, display-only, and meaning-preserving restrictive-pattern changes remain editorial while all material cases stay green. File run -> 13 passed
- refactor: extracted the reviewed editorial classes into a typed set
- commit: none, per user instruction

## Cycle 23: U24 matches exact storage and origins once

- test: `test/compliance/inventory-audit.test.ts::matches an exact storage name and approved origin once` (new)
- red: `bunx jest test/compliance/inventory-audit.test.ts --runInBand`
  -> `Expected: "pass"` / `Received: "fail"` (1 failed)
- green: each observation passes only when exactly one reviewed declaration owns its exact storage name or origin. File run -> 1 passed
- refactor: kept deterministic matches and flow-specific differences as separate collections
- commit: none, per user instruction

## Cycle 24: U25 matches bounded dynamic observations

- test: `test/compliance/inventory-audit.test.ts::matches bounded dynamic names and rejects non-matches` (new, property)
- red: `bunx jest test/compliance/inventory-audit.test.ts --runInBand`
  -> property failed with seed `-631376027`, path `0:0:0`, counterexample `["a"]`; matching `chatwoot_a` was reported as fail (1 failed, 1 passed)
- green: audit matching reuses the reviewed anchored/bounded registry matcher; generated matching names pass and unrelated names fail. File run -> 2 passed
- refactor: reused the production matching rule rather than duplicating regular-expression safety in audit code
- commit: none, per user instruction

## Cycle 25: U26 reports unknown and forbidden observations

- test: `test/compliance/inventory-audit.test.ts::fails with flow-specific findings for unknown or forbidden observations` (new)
- red: `bunx jest test/compliance/inventory-audit.test.ts --runInBand`
  -> expected structured flow-specific findings, received opaque strings (1 failed, 2 passed)
- green: unknown, forbidden, and ambiguous observations now produce structured findings with flow, kind, observed identifier, and reason; any finding fails the audit. File run -> 3 passed
- refactor: introduced a typed `InventoryFinding` boundary
- commit: none, per user instruction

## Cycle 26: U27 emits value-free normalized evidence

- test: `test/compliance/inventory-audit.test.ts::produces value-free normalized evidence` (new)
- red: `bunx jest test/compliance/inventory-audit.test.ts --runInBand`
  -> expected normalized evidence, received `undefined` (1 failed, 3 passed)
- green: matched evidence contains flow, kind, normalized name/origin, owner, and classification; observation values never enter the result. File run -> 4 passed
- refactor: introduced a dedicated `InventoryEvidence` type separate from raw observations
- commit: none, per user instruction

## Cycle 27: U28 identifies missing publication fields

- test: `test/app/lib/legalPublication.test.ts::identifies a missing mandatory field` (new table-driven examples)
- red: `bunx jest test/app/lib/legalPublication.test.ts --runInBand`
  -> expected `valid: false` and the missing document/service path, received `valid: true` and no errors (2 failed)
- green: required document and service fields now fail validation with stable field-specific diagnostics. File run -> 2 passed
- refactor: shared deterministic field loops for documents and services
- commit: none, per user instruction

## Cycle 28: U29 blocks inconsistent release inputs

- test: `test/app/lib/legalPublication.test.ts::blocks publication` (new table-driven examples)
- red: `bunx jest test/app/lib/legalPublication.test.ts --runInBand`
  -> expected `valid: false`, received `true` for inconsistent reference, orphan, pending fact, and failed audit (4 failed, 2 passed)
- green: all four release inconsistencies now block approval with actionable diagnostics. File run -> 6 passed
- refactor: normalized document/service IDs into sets for deterministic reference validation
- commit: none, per user instruction

## Cycle 29: U30 defines one scoped English document set

- test: `test/app/lib/legalScope.test.ts::defines one scoped English EU and German document set` (new)
- red: `bunx jest test/app/lib/legalScope.test.ts --runInBand`
  -> expected one English non-regional document set, received `Array []` (1 failed)
- green: scope records one English set, the EU/EEA and German baseline, four concrete future-review triggers, and no guaranteed worldwide-compliance claim. File run -> 1 passed
- refactor: represented the scope decision as one immutable review record
- commit: none, per user instruction

## Cycle 30: U31 records complete provenance and evidence links

- test: `test/app/lib/legalTraceability.test.ts::records complete document provenance and service evidence` (new)
- red: `bunx jest test/app/lib/legalTraceability.test.ts --runInBand`
  -> expected the five published document IDs, received `Array []` (1 failed)
- green: every published document now has independent-authorship source notes and every declared consent service carries disclosure and audit evidence links. File run -> 1 passed
- refactor: derived both records from the canonical document and consent registries to prevent a parallel inventory
- commit: none, per user instruction

## Cycle 31: U32 renders semantic legal-document metadata

- test: `test/app/components/legal/LegalDocumentLayout.test.tsx::renders document metadata` (new)
- red: `bunx jest test/app/components/legal/LegalDocumentLayout.test.tsx --runInBand`
  -> module resolution failed because the shared legal-document layout did not exist
- green: the shared layout renders a semantic main/article, title, version, effective date, and applicability scope. File run -> 1 passed
- refactor: isolated deterministic UTC legal-date formatting in the layout module
- commit: none, per user instruction

## Cycle 32: U33 exposes complete local legal navigation

- test: `test/app/components/legal/LegalDocumentLayout.test.tsx::renders complete legal navigation` (new)
- red: `bunx jest test/app/components/legal/LegalDocumentLayout.test.tsx --runInBand`
  -> no accessible legal-document links existed (1 failed, 1 passed)
- green: the layout renders exactly the five canonical manifest destinations and marks only the current document with `aria-current=page`. File run -> 2 passed
- refactor: generated navigation directly from the canonical document manifest
- commit: none, per user instruction

## Cycle 33: U34 server-renders the privacy route

- test: `test/app/legal/legalRoutes.test.tsx::renders privacy route` (new)
- red: `bunx jest test/app/legal/legalRoutes.test.tsx --runInBand`
  -> module resolution failed because the local privacy route did not exist
- green: the route exports local metadata and renders all canonical privacy sections in order through the shared layout. File run -> 1 passed
- refactor: composed the route exclusively from the manifest and reviewed section registry
- commit: none, per user instruction

## Cycle 34: U35 server-renders the authoritative cookie route

- test: `test/app/legal/legalRoutes.test.tsx::renders cookie route` (new)
- red: `bunx jest test/app/legal/legalRoutes.test.tsx --runInBand`
  -> module resolution failed because the local cookie route did not exist
- green: the route exports local metadata and renders the authoritative category/service inventory plus the supplemental device view through the shared layout. File run -> 2 passed
- refactor: projected disclosures from the canonical consent registries instead of duplicating category membership
- commit: none, per user instruction

## Cycle 35: U36 server-renders the terms route

- test: `test/app/legal/legalRoutes.test.tsx::renders terms route` (new)
- red: `bunx jest test/app/legal/legalRoutes.test.tsx --runInBand`
  -> module resolution failed because the local terms route did not exist
- green: the route exports local metadata and renders every reviewed terms topic in order through the shared layout. File run -> 3 passed
- refactor: composed terms from the canonical structured terms registry
- commit: none, per user instruction

## Cycle 36: U37 server-renders the qualified privacy-request route

- test: `test/app/legal/legalRoutes.test.tsx::renders privacy-request route` (new)
- red: `bunx jest test/app/legal/legalRoutes.test.tsx --runInBand`
  -> module resolution failed because the local privacy-request route did not exist
- green: the route exports local metadata and renders the no-account email channel, safe verification guidance, process stages, qualifications, and complaint routes. File run -> 4 passed
- refactor: composed the route from the canonical rights-guidance record
- commit: none, per user instruction

## Cycle 37: A1 closes local legal navigation

- acceptance: `@ATDD-US1-001`
- inherited red: the scenario was recorded Red while local privacy, cookie, terms, and privacy-request routes were absent
- green: `bunx playwright test --project=bdd-chromium --grep "ATDD-US1-001"` -> 1 passed; all five local destinations resolve from public legal navigation
- refactor: none
- commit: none, per user instruction

## Cycle 38: A2 proves a complete service disclosure

- acceptance: `@ATDD-US2-002` (new)
- red: `bunx bddgen` -> three missing step definitions; after binding, the initial card locator matched the enclosing document article and failed strictness
- green: scoped the assertion to the service heading's direct article; `bunx playwright test --project=bdd-chromium --grep "ATDD-US2-002"` -> 1 passed
- refactor: reused the canonical cookie-policy disclosure instead of adding acceptance-only data
- commit: none, per user instruction

## Cycle 39: A3 proves narrow and keyboard-accessible legal content

- acceptance: `@ATDD-US1-001 @A3` (new scenario)
- red: `bunx bddgen` -> three missing step definitions
- green: `bunx playwright test --project=bdd-chromium --grep "@A3"` -> 1 passed at a 320 CSS-pixel viewport with semantic main/article/navigation, no horizontal overflow, and five focusable destinations
- refactor: kept viewport and focus assertions at the shared layout boundary
- commit: none, per user instruction

## Cycle 40: A4 proves complete category and service disclosure

- acceptance: `@ATDD-US2-001 @A4` (new scenario)
- red: `bunx bddgen` -> two missing step definitions
- green: `bunx playwright test --project=bdd-chromium --grep "@A4"` -> 1 passed; all three canonical categories and every registered service expose their reviewed operating details
- refactor: bindings derive expected categories and services directly from the canonical registry
- commit: none, per user instruction

## Cycle 41: A5 opens the existing preferences dialog in place

- acceptance: `@ATDD-US2-003 @A5` (new scenario)
- red: after binding, `bunx playwright test --project=bdd-chromium --grep "@A5"` timed out waiting for a legal-page Cookie preferences control
- green: composed the existing headless c15t control into the cookie policy; targeted browser run -> 1 passed and the URL remained `/legal/cookies`
- refactor: reused `CookiePreferencesLink` and the existing provider/dialog instead of creating consent state
- commit: none, per user instruction

## Cycle 42: A6 keeps disclosures usable without the consent backend

- acceptance: `@ATDD-US1-002 @ATDD-US2-004 @A6` (new scenario)
- red: `bunx bddgen` -> two missing step definitions
- green: with all `/api/c15t/**` requests aborted, `bunx playwright test --project=bdd-chromium --grep "@A6"` -> 1 passed; the server-rendered inventory remained readable and no saved-preference claim appeared
- refactor: modeled backend failure at the browser network boundary without adding test-only production behavior
- commit: none, per user instruction

## Cycle 43: A7 proves the complete privacy-request process

- acceptance: `@ATDD-US3-001 @A7` (new scenario)
- red: `bunx bddgen` -> three missing step definitions
- green: `bunx playwright test --project=bdd-chromium --grep "@A7"` -> 1 passed; supported intentions, proportionate verification, response stages, and complaint routes are public
- refactor: assertions consume the canonical rights-guidance record
- commit: none, per user instruction

## Cycle 44: A8 proves the no-account request channel

- acceptance: `@ATDD-US3-001 @A8` (new scenario)
- red: `bunx bddgen` -> two missing step definitions
- green: `bunx playwright test --project=bdd-chromium --grep "@A8"` -> 1 passed; the public page exposes an accessible `mailto:` contact and states that no Clipify account is required
- refactor: assertions use the durable contact from the canonical rights guidance
- commit: none, per user instruction

## Cycle 45: A9 proves qualified privacy-rights outcomes

- acceptance: `@ATDD-US3-001 @A9` (new scenario)
- red: `bunx bddgen` -> two missing step definitions
- green: `bunx playwright test --project=bdd-chromium --grep "@A9"` -> 1 passed; applicability, lawful exceptions, retention duties, and qualified partial/refusal outcomes are shown without unconditional promises
- refactor: assertions consume the canonical qualification list
- commit: none, per user instruction

## Cycle 46: A10 blocks undeclared browser behavior

- acceptance: `@ATDD-US4-001 @A10` (new scenario)
- red: `bunx bddgen` -> three missing step definitions
- green: `bunx playwright test --project=bdd-chromium --grep "@A10"` -> 1 passed; an unknown storage key and origin produce flow-specific findings and fail the release gate
- refactor: reused the same deterministic audit boundary exercised by property and unit tests
- commit: none, per user instruction

## Cycle 47: A11 requires review for every material change class

- acceptance: `@ATDD-US4-002 @A11` (new four-example outline)
- red: `bunx bddgen` -> two missing parameterized step definitions
- green: `bunx playwright test --project=bdd-chromium --grep "@A11"` -> 4 passed for purpose, recipient, legal-basis, and category changes; focused Jest versioning run -> 14 passed
- refactor: added legal-basis change to the typed material-change vocabulary and reused one deterministic classifier
- commit: none, per user instruction

## Cycle 48: A12 renders a supplemental value-free device view

- acceptance: `@ATDD-US1-003 @A12` plus focused component test
- red: browser run found no approved storage name in the supplemental view; focused Jest test failed because automatic inspection was absent
- green: the inspector now matches browser-visible names against bounded reviewed declarations and renders only name/type; focused Jest -> 8 passed and `bunx playwright test --project=bdd-chromium --grep "@A12"` -> 1 passed
- refactor: centralized approved storage matching through the canonical registry and never retained inspected values
- commit: none, per user instruction

## Cycle 49: U8 pins every unsafe storage-pattern boundary

- test: `test/app/lib/consentRegistry.test.ts::rejects unsafe storage pattern` (audit-strengthening regression cases)
- baseline: `bunx jest test/app/lib/consentRegistry.test.ts --runInBand` -> 10 passed because the required guard already existed
- mutant red: after temporarily removing the leading-anchor check, `bunx jest test/app/lib/consentRegistry.test.ts --runInBand` -> `Expected value: "Storage patterns must be anchored and bounded."` / `Received array: []` (1 failed, 9 passed)
- green: restored the production guard exactly; focused file -> 10 passed
- refactor: none needed; the table names each reviewed unsafe boundary
- commit: none, per user instruction
- note: this is an honest post-audit regression-strengthening cycle, not retroactive test-first evidence for the original implementation

## Cycle 50: U5 requires substantive disclosure and concrete storage declarations

- test: `test/app/lib/consentRegistry.test.ts::rejects incomplete mandatory disclosure fields`
- red: focused Jest run failed because Sentry Replay declared session storage without naming its browser-storage key
- green: declared the SDK's `sentryReplaySession` session-storage key; focused file -> 11 passed
- mutant red: after temporarily emptying Chatwoot's purpose, the focused run failed on the trimmed non-empty requirement (1 failed, 10 passed)
- refactor: restored the substantive purpose and kept the contract table-driven across every service
- commit: none, per user instruction
- note: this is post-audit test strengthening; the initial missing Sentry storage declaration produced a genuine Red failure

## Cycle 51: U10 resolves every policy and audit reference

- test: `test/app/lib/consentRegistry.test.ts::maps every service to existing policy sections and reviewed audit flows`
- baseline: focused Jest run passed because the existing mappings already resolved
- mutant red: a temporary nonexistent privacy section failed the policy-target assertion (1 failed, 11 passed)
- mutant red: a temporary unknown audit flow failed the reviewed-flow assertion (1 failed, 11 passed)
- green: restored both canonical mappings; focused file -> 12 passed
- refactor: the test derives valid privacy and cookie targets from the canonical document/category registries
- commit: none, per user instruction
- note: this is an honest post-audit regression-strengthening cycle, not retroactive test-first evidence for the original mappings

## Cycle 52: A3 proves sequential keyboard navigation

- acceptance: `@ATDD-US1-001 @A3` at a 320 CSS-pixel viewport
- baseline: the strengthened scenario passed after replacing per-element programmatic focus with actual `Tab` key traversal
- mutant red: temporarily assigning `tabIndex={-1}` to the Cookie Policy link caused the targeted Playwright scenario to fail
- green: restored the canonical link; targeted Playwright scenario -> 1 passed
- refactor: retained the existing semantic landmark and overflow assertions alongside real sequential focus movement
- commit: none, per user instruction
- note: no project-selected automated accessibility scanner is installed; the scanner portion of T156 remains an explicit infrastructure dependency rather than being silently simulated

## Historical evidence correction: acceptance scenarios implemented test-after

- A2, A3, A4, and A6-A11: Cycles 38-40 and 42-47 recorded missing or incomplete step bindings after the corresponding product behavior already existed. Those failures are test-construction failures, not behavior-level Red evidence. The scenarios remain Green acceptance coverage and are classified `TEST_AFTER`.
- A3 Cycle 52: the real Tab traversal and deliberate mutant strengthen regression coverage after implementation; they do not retroactively establish test-first ordering.
- `ATDD-US3-002`: the terms scenario is Green but was added after its route/content implementation and has no behavior-level Red evidence; classified `TEST_AFTER`.
- `ATDD-US4-003`: the publication-metadata scenario is Green but was added after validator behavior existed and has no behavior-level Red evidence; classified `TEST_AFTER`.
- `ATDD-US4-004`: the regional-scope scenario is Green but was added after scope behavior existed and has no behavior-level Red evidence; classified `TEST_AFTER`.
- This correction is append-only and supersedes any interpretation of the earlier missing-binding entries as product Red evidence.

## Cycle 53: Publication validation rejects the complete invalid-input matrix

- tests: `test/app/lib/legalPublication.test.ts` expanded across every required document/service field, empty arrays, placeholders, unsafe patterns, classification conflicts, and orphaned references
- red: focused Jest run -> 21 failed / 10 passed, with each new case exposing a missing validator boundary
- green: expanded `validatePolicyRelease`; focused file -> 31 passed
- refactor: canonicalized field, array, date, route, category, scope, pattern, reference, and classification checks in one validator
- commit: none, per user instruction

## Cycle 54: Production build validates the canonical policy release first

- test: `test/app/lib/legalPublicationBuildGate.test.ts`
- red: the build wrapper contained no legal validation boundary and the fixture runner was absent
- green: the build wrapper now runs `scripts/validate-legal-content.ts` before Next; focused build-gate tests -> 2 passed and `bun run app:build` -> exit 0 after validating 5 documents and 6 services
- refactor: one canonical `policyRelease` connects legal documents, the service registry, references, operator confirmation, and audit status
- commit: none, per user instruction

## Cycle 55: Browser-backed compliance evidence cannot pass vacuously

- tests: compliance unit matrix cases, the real Playwright compliance journey, and `@A10`
- red: focused unit run -> 2 failed because `runComplianceGate` and mandatory flow/kind coverage did not exist
- green: unit audit -> 6 passed; `bun run test:compliance` -> 6 unit checks plus 1 browser audit passed; targeted A10 -> 1 passed
- refactor: public, valid-authentication, and consent-enabled contexts now inventory cookies, local/session storage, scripts, and origins without values; the same gate rejects injected undeclared drift
- discovery: the audit exposed missing necessary authentication-cookie disclosures and c15t's cookie/local-storage dual persistence; both are now canonical registry entries
- commit: none, per user instruction

## Cycle 56: A3 combines real keyboard navigation with automated accessibility analysis

- acceptance: `@ATDD-US1-001 @A3` at 320 CSS pixels
- green: injected axe-core into the live page, required zero serious/critical violations, retained real Tab traversal, and passed the targeted scenario
- full checkpoint: `bun run test:bdd` -> 19 passed with scenario-owned US/FR/SC tags
- note: this is post-audit acceptance strengthening, not retroactive test-first evidence
- commit: none, per user instruction

## Cycle 57: Playwright owns a deterministic cross-platform server lifecycle

- red: every browser test body passed, but Playwright remained blocked at `Terminating the WebServer` on Windows until the exact child tree was externally terminated
- green: a loopback-only E2E server and global teardown close Next explicitly before Playwright's Windows `taskkill` fallback
- verification: `bun run test:e2e` -> 21 passed and exit 0 twice consecutively; next-ws receives the custom HTTP server through its process-global bridge
- commit: none, per user instruction

## Cycle 58: Test cleanup is guaranteed

- test: `test/app/components/legal/DeviceStorageInspector.test.tsx`
- green: `fetch` restoration and browser-storage clearing now run from `afterEach`; focused file -> 3 passed
- note: cleanup strengthening was test-after and does not claim a new behavior-level Red
- commit: none, per user instruction

## Cycle 59: The reviewed service inventory is pinned

- test: `test/app/lib/consentRegistry.test.ts::pins the reviewed service inventory before validating each declaration`
- baseline: focused Jest run passed with the reviewed necessary and optional service IDs
- mutant red: temporarily renaming `sentry-rum` caused the exact-inventory assertion to fail (1 failed, 12 passed)
- green: restored the canonical ID; focused file -> 13 passed
- integrity: the production registry SHA-256 matched before and after the mutation
- commit: none, per user instruction
- note: this is post-audit test strengthening and does not retroactively claim test-first history for the registry

## Cycle 60: Legal route entry points remain consent-read-only

- test: `test/app/lib/legalConsentBoundary.test.ts`
- baseline: the expanded route, component, and library scan passed
- mutant red: temporarily adding a consent-persistence call to `src/app/legal/privacy/page.tsx` caused the focused test to fail with the route path and forbidden capability
- green: removed the mutant; focused file -> 1 passed
- integrity: the route SHA-256 matched before and after the mutation
- commit: none, per user instruction

## Cycle 61: A6 exercises the failed consent backend

- acceptance: `@ATDD-US1-002 @ATDD-US2-004 @A6`
- red: the first strengthened scenario expected the legal preference trigger itself to disappear; the browser proved c15t deliberately keeps its offline dialog available
- green: the scenario now observes the failed `/api/c15t/**` request, opens the offline privacy dialog, proves `c15t` storage is unchanged without a save action, and confirms no success claim; targeted Playwright -> 1 passed
- refactor: request evidence is isolated per Playwright page in a `WeakMap`
- commit: none, per user instruction
- note: the backend is demonstrably unavailable while the safe client-side preference UI remains readable by design

## Cycle 62: A1 proves local navigation with browser request evidence

- acceptance: `@ATDD-US1-001 @A1`
- green: the strengthened scenario clicked through all five legal destinations, recorded browser requests, and accepted only the local Clipify origin
- mutant red: temporarily replacing the Privacy Policy route with a GoAdopt URL failed the live-link assertion before external navigation
- restored green: targeted Playwright -> 1 passed
- integrity: the legal manifest SHA-256 matched before and after the mutation
- commit: none, per user instruction

## Cycle 63: The production build wrapper owns the publication gate

- test: `test/app/lib/legalPublicationBuildGate.test.ts`
- red: the controlled invalid fixture was ignored by the wrapper, which validated canonical data and attempted a real Next build
- green: test-only, `NODE_ENV=test`-guarded dependency seams now feed the invalid release into the real wrapper and substitute a sentinel Next executable; focused Jest -> 1 passed
- proof: the wrapper exits 1 with `documents.privacy.title is required`, while `NEXT_BUILD_SENTINEL_INVOKED` is absent
- refactor: production builds ignore both controlled-test environment variables and retain the canonical validator and Next executable
- commit: none, per user instruction

## Cycle 64: Service disclosures have stable accessible boundaries

- acceptance: `@A2` and `@A4`
- red: role-and-name article locators could not find service details because the articles had no accessible names
- green: each service article is labelled by its service heading; targeted Playwright -> 2 passed
- refactor: removed DOM parent-axis coupling from both acceptance assertions
- commit: none, per user instruction

## Cycle 65: GoAdopt removal is enforced across user-facing app sources

- test: `test/app/lib/legalLinkMigration.test.ts`
- baseline: the deterministic recursive `src/app` scan passed while retaining all required local-route assertions
- mutant red: temporarily adding a GoAdopt URL to a legal route entry point failed with the exact source path
- green: removed the mutant; focused Jest -> 1 passed
- integrity: the route SHA-256 matched before and after the mutation
- commit: none, per user instruction

## Cycle 66: Browser inventory capture is deterministic and self-cleaning

- acceptance: `test/compliance/inventory-audit.spec.ts`
- green: `bun run test:compliance` passed twice consecutively (6 unit checks plus 1 real browser inventory each run)
- refactor: every isolated browser context now closes in `finally`; request origins are captured from Playwright events registered before navigation; each flow waits for document readiness, and the consent-enabled flow additionally waits for the Chatwoot script, storage, and ready object
- commit: none, per user instruction
- note: this is reliability strengthening of an existing Green acceptance journey

## Cycle 67: Publication validation pins the complete valid baseline

- test: `test/app/lib/legalPublication.test.ts::accepts the exact complete release baseline`
- baseline: focused Jest -> 32 passed with the complete reviewed release returning exactly `{ valid: true, errors: [] }`
- mutant red: reversing the operator-confirmation boundary made the new positive baseline fail and exposed the false acceptance of an unconfirmed release
- restored green: focused Jest -> 32 passed
- integrity: the validator SHA-256 matched before and after the mutation
- commit: none, per user instruction
- note: this positive oracle closes the invalid-only test smell; it is post-audit strengthening

## Cycle 68: Cookie preference component tests restore browser history

- test: `test/app/components/legal/CookiePreferencesLink.test.tsx`
- green: focused Jest -> 2 passed
- refactor: each test captures its incoming URL and restores it from `afterEach`, including failing assertion paths
- commit: none, per user instruction
- note: teardown reliability strengthening; no new product behavior was introduced

## Cycle 69: Final implementation checkpoint

- Jest coverage: 159 suites / 1,238 tests passed; 75.86% statements, 68.65% branches, 74.38% functions, 79.17% lines
- browser/E2E: 21/21 passed with clean managed-server teardown
- compliance stability: two consecutive runs passed (6 unit checks plus 1 browser audit each)
- static gates: typecheck, Prettier, and lint passed; lint retains four unrelated image warnings
- production build: legal validation passed for 5 documents and 6 services, followed by a successful Next.js 16.3.4 build
- dependency audit: 1,313 packages checked; no high/critical vulnerabilities
- integrity: `git diff --check` passed apart from line-ending notices
- commit: none, per user instruction
