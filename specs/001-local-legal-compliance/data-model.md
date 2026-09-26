# Data Model: Local Legal and Privacy Center

No new production database table is required for the first release. Existing c15t consent persistence remains authoritative for saved consent records. The following models are version-controlled application data and validation contracts.

## LegalDocument

Represents one public policy or contract document.

| Field                 | Type                   | Rules                                                                       |
| --------------------- | ---------------------- | --------------------------------------------------------------------------- |
| `id`                  | stable identifier      | Unique; one of privacy, cookies, terms, privacy-requests, imprint           |
| `title`               | text                   | Non-empty, English in this release                                          |
| `route`               | local route            | Must be unique and Clipify-controlled                                       |
| `version`             | policy version         | Required; monotonically changes for material revisions                      |
| `effectiveDate`       | date                   | Required; cannot be a placeholder or invalid date                           |
| `scope`               | applicability notes    | Identifies the EU/German baseline without a universal guarantee             |
| `sections`            | ordered content blocks | Required topics vary by document type                                       |
| `ownerConfirmedFacts` | fact references        | Every business/legal claim requiring operator input has confirmation status |
| `changeClass`         | editorial or material  | Material changes require a policy-release decision                          |

## ServiceDeclaration

Represents one service or processing activity visible in consent and legal disclosures.

| Field                | Type                      | Rules                                                                     |
| -------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `id`                 | stable identifier         | Unique and immutable after publication                                    |
| `name`               | text                      | User-facing name                                                          |
| `provider`           | provider record           | Identifies Clipify/self-hosted or external provider                       |
| `category`           | consent category          | Necessary, functionality, measurement, or a future reviewed category      |
| `purpose`            | text                      | Specific and understandable; generic purposes fail validation             |
| `processingPurposes` | list                      | Maps technical behavior to privacy-policy purposes                        |
| `legalBasis`         | reviewed basis            | Uses the EU/German baseline and is not inferred at runtime                |
| `dataCategories`     | list                      | Complete for the declared integration                                     |
| `storage`            | StorageDeclaration list   | Empty only when the service truly stores/accesses no terminal information |
| `networkOrigins`     | bounded origin list       | Exact origins or intentionally constrained patterns                       |
| `recipient`          | recipient details         | Includes processor/controller role where known                            |
| `hostingRegions`     | list                      | Verified regions, not assumptions                                         |
| `transferMechanism`  | optional transfer details | Required when international transfer disclosure applies                   |
| `retention`          | duration or criterion     | Must be specific enough to understand                                     |
| `consentRequired`    | boolean                   | Must agree with runtime activation                                        |
| `revocation`         | behavior record           | Stop behavior and removable storage cleanup                               |
| `policyReferences`   | document/section IDs      | Connects declaration to user-facing disclosure                            |

## StorageDeclaration

Represents terminal storage or access behavior.

| Field               | Type                                                                                | Rules                                        |
| ------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| `type`              | cookie, local storage, session storage, script/tag, pixel, link decoration, or none | `none` cannot include a key                  |
| `name`              | exact key                                                                           | Preferred when stable                        |
| `pattern`           | bounded pattern                                                                     | Anchored and reviewed; cannot be a catch-all |
| `domain`            | domain scope                                                                        | Required for cookies/external access         |
| `lifetime`          | duration or session                                                                 | Required where technically meaningful        |
| `httpOnly`          | boolean/unknown                                                                     | Disclosed when applicable                    |
| `purpose`           | text                                                                                | Must map to the parent service purpose       |
| `removableOnRevoke` | boolean                                                                             | False requires rationale                     |

## ComplianceScopeReview

| Field              | Type            | Rules                                                                     |
| ------------------ | --------------- | ------------------------------------------------------------------------- |
| `baseline`         | stable scope ID | EU/EEA and Germany for this release                                       |
| `operatorBasis`    | text            | Records the operator's German establishment                               |
| `documentStrategy` | strategy        | One English document set; no regional variants                            |
| `futureTriggers`   | list            | Establishment, targeting, thresholds, new processing, or qualified advice |
| `lastReviewed`     | date            | Required for release                                                      |
| `sourceReferences` | official links  | Primary EU/German sources                                                 |

## PolicyRelease

| Field                    | Type                        | Rules                                                     |
| ------------------------ | --------------------------- | --------------------------------------------------------- |
| `releaseId`              | stable identifier           | Unique within policy history                              |
| `effectiveDate`          | date                        | Required                                                  |
| `documentVersions`       | mapping                     | Covers every published legal document                     |
| `registryRevision`       | source revision             | Points to the reviewed declaration snapshot               |
| `materialChanges`        | change records              | Empty or reviewed                                         |
| `renewedConsentDecision` | yes/no with rationale       | Required for each material consent-affecting change       |
| `scopeReview`            | compliance scope record     | Confirms the EU/German baseline and one-document strategy |
| `auditEvidence`          | evidence references         | Must be Green before publication                          |
| `approvals`              | operator/reviewer decisions | Required before release                                   |

## ComplianceAuditResult

| Field                 | Type                   | Rules                                                                |
| --------------------- | ---------------------- | -------------------------------------------------------------------- |
| `flowId`              | stable flow identifier | Identifies the inspected route and preconfigured integration context |
| `observedCookies`     | name/domain/flags      | Values are never retained                                            |
| `observedWebStorage`  | type/name              | Values are never retained                                            |
| `observedScripts`     | URL/origin             | Normalized before comparison                                         |
| `observedOrigins`     | origin/method/class    | Excludes reviewed first-party asset noise                            |
| `matchedDeclarations` | mapping                | One declaration per observed behavior or explicit platform exception |
| `differences`         | findings               | Unknown, forbidden, missing, or unexpectedly active                  |
| `result`              | pass/fail/blocked      | Any unknown optional behavior fails                                  |

## State Transitions

### Legal change

`draft → factual review → legal-scope review → audit pending → approved → effective → superseded`

- Missing required facts block transition from draft.
- Material changes require a renewed-consent/additional-notice decision before approval.
- Failed compliance audit blocks approval.
