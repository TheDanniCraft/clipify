# Implementation Plan: Local Legal and Privacy Center

**Branch**: `gamescom-improvements` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-local-legal-compliance/spec.md`

## Summary

Replace all GoAdopt-hosted documents and privacy-request links with one local, versioned English Clipify document set. Independently author reviewed legal content from verified product facts and EU/German requirements, while expanding the existing service registry only as needed to render accurate storage, recipient, transfer, and consent-status disclosures. c15t remains the unchanged consent engine; the legal pages only read its categories and open its existing preferences dialog. Add read-only browser audits so undeclared storage, scripts, or origins block the documentation release. Regional policy variants remain out of scope until a concrete later trigger requires them.

## Technical Context

**Language/Version**: TypeScript 6, React 19, Next.js 16 App Router, Node.js production runtime, Bun package/script runner

**Primary Dependencies**: `@c15t/nextjs`, `@c15t/backend`, HeroUI v3, existing React Markdown/rendering dependencies; planned dev-only `@playwright/test` and `playwright-bdd`

**Storage**: Version-controlled structured legal content and compliance registry; existing PostgreSQL/c15t consent persistence remains unchanged; automated browser audits inspect cookie/local/session-storage names but never retain values

**Testing**: Jest 30 with Testing Library for TDD; Playwright plus executable Gherkin bindings for shared ATDD/BDD evidence and runtime compliance audit

**Target Platform**: Modern supported desktop/mobile browsers; Linux production container; Windows/Linux developer and CI environments

**Project Type**: Next.js full-stack web application

**Performance Goals**: Legal pages server-render without third-party dependencies; registry rendering adds no external request; the cookie policy performs no runtime device-storage inspection; audit runtime remains suitable for PR CI

**Constraints**: English-only first release; no new legal CMS/service/container; no automatic data deletion/export; no storage values collected; no universal compliance claim; no changes to c15t categories, persistence, API, reload, activation, revocation, cleanup, or UI semantics

**Scale/Scope**: Five public legal/privacy routes, one English document set, current consent categories and services, representative public/authenticated flows, EU/EEA and German legal baseline

## Constitution Check

The ratified Clipify constitution and active repository rules define the binding gates:

- Gitmoji commits and existing project conventions remain mandatory.
- Production logic follows red-green-refactor with recorded Red evidence.
- BDD and ATDD are Required for all four user stories; shared ATDD-owned scenarios carry both roles where behavior and release acceptance are identical.
- Legal facts are not invented; operator-confirmed fields block publication when incomplete.
- No new service, database, or generic abstraction is introduced without demonstrated need.
- Consent and privacy changes fail closed: missing state or integration failure does not activate optional processing.

**Pre-design result**: PASS. No constitutional violation is required.

**Post-design result**: PASS. Design reuses the existing application, treats c15t as an unchanged dependency, keeps legal prose reviewable, limits new dependencies to development browser testing, and adds blocking evidence for document accuracy.

## Project Structure

### Documentation (this feature)

```text
specs/001-local-legal-compliance/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── compliance-registry.md
│   ├── legal-routes.md
│   └── privacy-requests.md
├── checklists/
│   └── requirements.md
├── test-traceability.md
├── defect-log.md
└── test-summary.md
```

### Source Code (repository root)

```text
src/app/
├── legal/
│   ├── layout.tsx
│   ├── privacy/page.tsx
│   ├── cookies/page.tsx
│   ├── terms/page.tsx
│   └── privacy-requests/page.tsx
├── components/
│   ├── ConsentManager.tsx
│   └── legal/
│       ├── LegalDocument.tsx
│       ├── LegalNavigation.tsx
│       └── ServiceDisclosureTable.tsx
└── lib/
    ├── consent/
    │   └── registry.ts
    └── legal/
        ├── documents.ts
        ├── scope.ts
        ├── policyRelease.ts
        └── validation.ts

test/
├── app/
│   ├── components/legal/
│   └── lib/
├── atdd/
│   ├── features/local-legal-compliance.feature
│   ├── steps/local-legal-compliance.steps.ts
│   └── support/
├── compliance/
│   ├── inventory-audit.test.ts
│   └── fixtures/
└── support/
    ├── consent.ts
    └── browserEvidence.ts

scripts/
└── validate-legal-content.ts
```

**Structure Decision**: Keep the feature inside the existing App Router application. Structured legal content and validation live under `src/app/lib/legal`; presentation lives under local route/components; existing Jest conventions remain under `test/app`; browser-owned acceptance and audit evidence gains visibly owned `test/atdd` and `test/compliance` directories. No separate backend or package is introduced.

## Implementation Phases

### Phase 1: Inventory and factual baseline

1. Inventory processing, recipients, storage, origins, retention, and current legal links from code and representative browser flows.
2. Record operator-confirmation fields for controller identity, contact, age rule, retention, billing/cancellation/refund behavior, runner responsibilities, governing law, and dispute handling.
3. Use existing GoAdopt documents only as a private checklist for Clipify-specific facts and missing subjects; do not import or publish their prose.
4. Record the operator's German establishment, EU/EEA baseline, official sources, and concrete triggers that would require a future scope review.

### Phase 2: Registry and validation core

1. Red: add schema/invariant tests for documents, services, storage patterns, legal scope, versioning, and material changes.
2. Green: expand the existing consent registry and add structured legal metadata with the minimum fields required by the tests.
3. Refactor: create a read-only document projection from the existing service/category declarations without moving or changing c15t runtime behavior.
4. Add a build validation script that fails on placeholders, missing fields, unbounded patterns, inconsistent consent classification, or orphaned disclosures.

### Phase 3: Local legal and rights experience

1. Red: add component/route tests for local navigation, document metadata, required topics, cookie-preference entry points, authoritative inventory presentation, and request-channel behavior.
2. Green: implement shared legal layout and the privacy, cookie, terms, and privacy-request pages.
3. Write one independent English document set from verified facts and EU/German source requirements.
4. Embed service/storage tables from the registry and omit partial runtime device inspection from the public policy.
5. Replace GoAdopt links in consent UI, footer, login, and machine-readable site documents.

### Phase 4: Existing consent-interface integration

1. Red: cover category rendering, the legal preference entry point, and the unavailable-interface fallback.
2. Green: connect the cookie policy and footer to the existing c15t preferences dialog without adding state or changing its behavior.
3. Explicitly disclose always-on cookieless self-hosted Plausible behavior rather than presenting a nonfunctional toggle.
4. Add a regression boundary proving the legal feature does not mutate c15t configuration, persistence, API, reload, activation, revocation, or cleanup code.

### Phase 5: Browser audit and release evidence

1. Add Playwright/`playwright-bdd` as development dependencies and scripts for ATDD and compliance audit.
2. Bind the approved Gherkin scenarios to real browser flows; one ATDD-owned execution path provides both BDD and ATDD evidence where declared.
3. Capture cookie metadata, storage names, scripts, and relevant external origins without values in a read-only audit.
4. Compare observations to exact/bounded declarations and fail on unknown or forbidden behavior.
5. Run accessibility, 320-pixel layout, no-script legal-content, source-link, build, and dependency gates.
6. Populate traceability, defect log, and test summary from actual evidence; merge remains No-Go until all required gates are Green and operator facts are approved.

## Legal Baseline and Future Review Triggers

| Scope            | Decision                 | Product implication                                                                                         |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Operator         | Established in Germany   | German and EU/EEA rules are the directly relevant baseline                                                  |
| Public documents | One English document set | No UK, US, Brazilian, Canadian, or other regional copies in this feature                                    |
| Consent design   | Strict EU/German default | Optional terminal access remains off until affirmative consent unless a reviewed exemption applies          |
| Future review    | Trigger-based            | Reassess only for local establishment/targeting, statutory thresholds, materially new processing, or advice |

This scope avoids speculative document sprawl. It does not claim that EU alignment automatically satisfies every law worldwide; it records why one EU/German-baseline set is proportionate for Clipify now.

## Complexity Tracking

No constitution violation or additional production service is planned. The only new tooling is development-only real-browser acceptance/audit support, justified because unit tests cannot observe third-party runtime storage and network behavior.

---

## Test-First Architecture & Quality Plan _(mandatory)_

### Test Suite Directory Structure

```text
test/
├── app/                         # TDD owner: Jest unit/component/integration tests
│   ├── components/legal/
│   └── lib/
├── atdd/                        # ATDD owner; scenarios also carry BDD role
│   ├── features/
│   ├── steps/
│   └── support/
├── compliance/                  # TDD/integration owner for browser inventory rules
└── support/                     # shared fixtures/helpers, no evidence ownership
```

No duplicate `test/bdd` tree is created: all required BDD behavior is fully represented by ATDD-owned Gherkin scenarios whose end-to-end assertions are the same stakeholder acceptance boundary.

### Minimum Professional Test Reports

| Professional Report                    | Feature Artifact       | Scope                                                         |
| -------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Test Plan                              | `plan.md`              | Strategy, ownership, tools, gates, risks, entry/exit criteria |
| Inventory/Traceability/Execution Index | `test-traceability.md` | Planned artifacts, source mapping, scenarios, gate evidence   |
| Defect Report                          | `defect-log.md`        | Unexpected failures, triage, risk acceptance, verification    |
| Test Summary                           | `test-summary.md`      | Execution totals, coverage, defects, risks, Go/No-Go          |

| Setting              | Value                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Overall summary mode | rolling                                                                                        |
| Release ID           | N/A                                                                                            |
| Output path          | `reports/test-summary.md` during later convergence                                             |
| Rationale            | The branch is not tied to a named product release; one current aggregate report is appropriate |

### BDD and ATDD Applicability

| User Story | BDD      | ATDD     | Scenario Evidence ID(s) | N/A Rationale | Alternative Evidence                                                                  |
| ---------- | -------- | -------- | ----------------------- | ------------- | ------------------------------------------------------------------------------------- |
| US1        | Required | Required | ATDD-US1-001–003        |               | Shared ATDD-owned scenarios fully prove visible behavior and release acceptance       |
| US2        | Required | Required | ATDD-US2-001–004        |               | Shared ATDD-owned scenarios cover document categories and existing-dialog integration |
| US3        | Required | Required | ATDD-US3-001–002        |               | Shared ATDD-owned scenarios prove request and contractual access boundaries           |
| US4        | Required | Required | ATDD-US4-001–004        |               | Shared ATDD-owned scenarios prove audit and release gates                             |

### Test Tooling and Gate Decisions

| Practice/Gate    | Applicability | Tool and Required Command                                         | Threshold                                                                                           | Evidence Retention                      | Rationale                                  |
| ---------------- | ------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| TDD              | Required      | `bun run test -- --runInBand`                                     | All planned tests pass                                                                              | CI test log                             | Production logic and validation            |
| BDD              | Required      | `bun run test:atdd`                                               | 100% mapped BDD-role scenarios pass                                                                 | Playwright HTML/JUnit artifact          | Same scenarios express observable behavior |
| ATDD             | Required      | `bun run test:atdd`                                               | 100% mapped ATDD scenarios pass                                                                     | Playwright HTML/JUnit artifact          | Stakeholder release boundaries             |
| Compliance audit | Required      | `bun run test:compliance`                                         | Zero unknown/forbidden storage, scripts, or origins                                                 | JSON diff plus browser trace on failure | Runtime declaration alignment              |
| Coverage         | Required      | `bun run test:coverage`                                           | Existing global baseline must not regress; changed legal/consent logic ≥90% lines and ≥85% branches | `coverage/` CI artifact                 | Risk-based changed-code protection         |
| Lint             | Required      | `bun run app:lint`                                                | Zero errors                                                                                         | CI log                                  | Source consistency                         |
| Format           | Required      | `bunx prettier --check .`                                         | Zero differences                                                                                    | CI log                                  | Deterministic formatting                   |
| Static analysis  | Required      | `bun run app:typecheck`                                           | Zero errors                                                                                         | CI log                                  | Type contract integrity                    |
| Security         | Required      | `bun audit --audit-level=high` plus negative privacy tests        | Zero unaccepted high/critical findings                                                              | CI log/artifact                         | New browser tooling and privacy surface    |
| Accessibility    | Required      | ATDD accessibility assertions plus keyboard/manual preview review | Zero serious/critical automated violations; all declared keyboard checks pass                       | Playwright report/screenshots           | Public legal access                        |
| Runtime smoke    | Required      | `bun run app:build` and local/preview route smoke                 | Build and all declared routes pass                                                                  | Build log and Playwright report         | Deployable artifact and local routes       |

### Risk-Based Threshold and Exception Policy

- Changed legal/consent production code: at least 90% line and 85% branch coverage.
- Existing repository global thresholds remain binding and may not regress.
- Every mapped BDD and ATDD scenario must pass; no sampling exception applies to the displayed consent categories.
- Unknown optional storage or external origin is release-blocking.
- Critical/high privacy, security, legal-content, or accessibility defects block release unless the accountable operator explicitly accepts a scoped risk with compensating evidence and expiry/follow-up.
- Any lower coverage threshold needs scope, rationale, compensating tests, approver, and expiry recorded in `defect-log.md` and `test-summary.md`.
- Tool noise must be triaged as a defect or documented non-defect; it cannot be silently ignored.

### Evidence Retention

- CI retains Jest/coverage output, Playwright HTML/JUnit results, compliance JSON diffs, and failure traces/screenshots for the normal repository artifact period.
- Version control retains spec, plan, registry, policy content, policy versions, change classification, traceability index, defect decisions, and test summary.
- Browser audit evidence never stores cookie or web-storage values.
- Generated reports are committed only when they are the feature's required Markdown records; raw runner output remains a CI artifact.

### Red-Green-Refactor Execution Model

For each user story, implement one behavior slice at a time:

1. Add or bind only the scenario and TDD test needed for the next slice.
2. Run the smallest command and record that it fails for the intended missing behavior (`Red`).
3. Implement the minimum production change to pass (`Green`).
4. Refactor while keeping the slice Green.
5. Repeat for the next slice; do not accumulate all failing tests before implementation.
6. At story completion, run the mapped Jest tests and ATDD scenarios.
7. At feature completion, run every required gate and update traceability, defects, and summary from evidence.

### Entry Criteria

- Spec/checklist approved for planning.
- Operator facts are explicitly marked confirmed or pending; pending required fields block publication, not implementation scaffolding.
- Test dependencies and representative non-production accounts are available.
- No unresolved `NEEDS CLARIFICATION` marker exists.

### Exit Criteria

- All planned TDD artifacts and ATDD/BDD scenarios are Green.
- Every FR, SC, US, and EC maps to current evidence.
- No GoAdopt user-facing link or runtime request remains in covered flows.
- Compliance audit has zero undeclared/forbidden findings.
- Required operator facts, EU/German legal-scope review, policy version, and material-change decision are approved.
- Zero unaccepted critical/high defects; test summary recommends Go.
