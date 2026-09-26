# Validation Quickstart: Local Legal and Privacy Center

This guide describes the planned validation workflow after implementation. Commands marked as new become available through the feature tasks.

## Prerequisites

- Install repository dependencies with the project-standard Bun workflow.
- Provide the normal development secrets through Infisical.
- Install the Playwright browser declared by the new ATDD setup.
- Use generated or non-production accounts and test data for authenticated flows.

## Fast feedback

```powershell
bun run test -- --runInBand test/app/lib/legalDocuments.test.ts test/app/lib/consentRegistry.test.ts
bun run app:typecheck
bun run app:lint
```

Expected outcome: document metadata, registry invariants, link migration, and type/lint gates pass.

## Acceptance and compliance audit

```powershell
bun run test:atdd
bun run test:compliance
```

Expected outcome:

- local legal links resolve without GoAdopt traffic;
- every configured category and declared service appears in the cookie policy;
- the existing preferences dialog opens from legal entry points without creating a second consent state;
- observed cookie names, web-storage names, scripts, and external origins match the compliance registry;
- legal content remains readable in the no-script case;
- privacy-request and terms acceptance scenarios pass.

## Full quality gates

```powershell
bun run test:coverage
bun run app:typecheck
bun run app:lint
bunx prettier --check .
bun audit --audit-level=high
bun run app:build
```

Expected outcome: all required tests and scenarios pass, changed legal/consent production code meets the feature coverage thresholds, no blocking static or dependency finding remains, and the production build succeeds.

## Manual preview review

1. Start with a clean browser profile.
2. Open each route in `contracts/legal-routes.md` at desktop width and 320 CSS pixels.
3. Navigate entirely by keyboard and confirm headings, landmarks, focus order, dialog behavior, and visible focus.
4. Open cookie preferences from the cookie policy and footer and confirm the existing c15t dialog opens without navigating away.
5. Simulate an unavailable preferences interface and confirm the legal content remains readable without a false saved state.
6. Confirm the device panel lists only names and types and is labeled supplemental.
7. Confirm no page or footer links to GoAdopt and no GoAdopt request appears in browser developer tools.
8. Review the policy version, effective date, operator facts, EU/German legal-scope record, and material-change decision.

## Evidence

Record commands, exit status, and CI artifact links in `test-traceability.md`. Record unexpected failures in `defect-log.md`. Update `test-summary.md` only from executed evidence; planning status remains No-Go until the required suite is Green.
