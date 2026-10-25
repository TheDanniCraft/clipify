# Implementation Plan: User tours

**Branch**: `feat/user-tour` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

## Summary

Add a native floating guide panel with five expandable sections and Driver.js spotlights. Mount an account-keyed client provider in the authenticated dashboard layout. Keep tour state separate from successful domain outcomes. Existing create/save handlers report owned-resource outcomes through a typed context; no tour initiates a mutation itself. Stable data-tour attributes anchor guidance. Persist versioned progress locally with guarded parsing and writes. No schema changes or generated migrations.

## Technical Context

TypeScript 6, Next.js 16.4.2 App Router, React 19, HeroUI 3, Driver.js 1.10.2. Browser-local account-scoped storage. Existing Plausible integration for non-sensitive events. Jest/Testing Library for state and component tests; Playwright BDD for real browser acceptance. Desktop and narrow browser viewports; opt-in, no automatic spotlight. Lazy-load spotlight code. Next client/server guide and usePathname reference reviewed before implementation.

## Constitution Check

Required: spec/plan before code, failing executable tests before each behavior, Gherkin with one browser owner for BDD/ATDD, isolated loopback test databases, stable requirement IDs, no threshold reductions. Existing owner checks, revision conflicts and plan gates remain authoritative. Post-design review: no exceptions needed. Usertour service integration deferred because fixed code-owned journeys need no external authoring backend; Driver.js avoids maintaining spotlight geometry ourselves.

## Project Structure

- `src/app/lib/userTour.ts`: catalog, validation, transitions and route resolution.
- `src/app/components/user-tour/`: provider, panel, spotlight adapter and styles.
- Existing dashboard layout, table, overlay/theme/playlist pages: targets and successful-action reports.
- `test/app/lib/userTour.test.ts`: TDD-owned state/validation evidence.
- `test/app/components/user-tour/`: TDD-owned integration and adapter evidence.
- `test/bdd/features/user-tour/guide.feature` and `test/bdd/steps/user-tour.steps.ts`: browser-owned BDD and ATDD evidence, one execution path.

## Test Plan

For each slice: add the whole-file test, run without coverage, record intended red, implement minimal behavior, run green, refactor while green. Browser scenarios are specified before implementation and bound incrementally. Never count a tooltip view as a successful action. Scope includes clipboard denial, create/save conflicts, empty clips, missing targets, inaccessible resources, storage corruption and account isolation.

| Gate            | Command                                                                                                                                | Policy / evidence                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Inner loop      | `bun run test --runInBand <whole-file>`                                                                                                | Required, no coverage, all tests in file                                                               |
| Affected suites | `bun run test:affected ef3efa18`                                                                                                       | Required after complete slice                                                                          |
| Browser         | `bun run test:e2e:build` then `bunx bddgen` then `bunx playwright test --project=bdd-chromium .features-gen/bdd/user-tour --workers=1` | Required, disposable loopback fixture database; playwright-report and test-results/browser             |
| Coverage        | `bun run test:coverage`                                                                                                                | Required before merge; unchanged repository thresholds and merged lane evidence; test-results/coverage |
| Lint            | `bun run app:lint`                                                                                                                     | Required, zero errors                                                                                  |
| Format          | `bun run app:prettier:check`                                                                                                           | Required                                                                                               |
| Types           | `bun run app:typecheck`                                                                                                                | Required                                                                                               |
| Build           | `bun run app:build`                                                                                                                    | Required                                                                                               |
| Security        | `bun run audit:high` and owner/secret negative tests                                                                                   | Required; no URL/name/secret analytics                                                                 |
| Runtime smoke   | browser journeys above                                                                                                                 | Required; real targets/popovers and keyboard/Escape verified                                           |

Block merge for missing or failed gates. Keep runner reports as raw evidence and record commands/status in test-traceability.md; no inferred passes. No threshold exceptions. Overall summary destination: rolling, `reports/test-summary.md`, no release ID. Convergence will update that aggregate; this feature retains its own reports.

## UX revision

Retain the native guide state and lazy Driver adapter. Add validated per-account skipped task IDs and a completed-task handoff; preserve existing persisted completions. First-use checklist visibility is on; spotlights stay opt-in. Use installed HeroUI Button, Checkbox, Chip, Link and ProgressBar. Do not replace domain controls for guide purposes.

Remove discovery-driven routing; actual Add/create and navigation buttons own navigation during tours. Initial task selection can return to the task's starting page. Teach source, filters and saving separately. Existing access gates remain authoritative, including read-only highlighting of locked controls. Website code-copy reports from ToolsClient only after clipboard success. Public website instructions and optional galleries/tools/support introductions extend the catalog to five sections, with 24/7 still excluded. Consent preference events suspend guide UI and pause active tasks. Reserve the bottom-right corner for the progress launcher and move feedback within that same dock.

Validation: nine revision-state cases, provider skip/resume/consent/handoff cases and locked-control adapter coverage, all affected whole-file suites, 32 owning browser scenarios, lint/format/type/build. Full merge coverage/Test and the existing dependency-security requirements remain unchanged.
