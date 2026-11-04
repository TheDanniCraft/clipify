# Implementation Plan: Creator Library and Bulk Export

**Branch**: `features/clip-export`, created from clean `origin/master` at `b6c8e591`; unrelated fix-branch commits are excluded.
**Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

## Summary

Replace the dashboard's table-as-home navigation with one shared HeroUI Pro sidebar/search shell, preserve existing resource editors, expose a searchable creator clip inventory, add a bounded manual MP4 ZIP export, and compose Home/Streams from available Twitch broadcasts and cached clip data. Automation is explicitly later.

The user subsequently authorized full implementation, commit, push and a draft PR, after preparation finishes. The original planning-only boundary has been superseded by that explicit go. Keep all unrelated changes and automatic publishing out of this feature.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React 19.3.1, Next 16.4.3; repository Bun runner, CI Node24/Bun1.4.2.
**Primary Dependencies**: installed HeroUI3/HeroUI Pro Sidebar and Command, Zod4, Drizzle/PostgreSQL, fflate0.8, existing Twitch credential/cache/rate-limit services.
**Storage**: Existing Twitch JSON cache; request-local export buffers; no new table, persistent media, worker queue or provisioned service.
**Testing**: Jest30 plus existing setup/PGlite, real-component Playwright1.64/playwright-bdd9 browser journeys.
**Target Platform / Type**: Existing deployed web app; responsive desktop/mobile browsers, Node route runtime for export.
**Performance Goals**: Warm 10k-clip fixture -> correct 25-row page <=2s. At most two media fetches, 30s/file and120s/export; benchmark memory for 128MiB media plus ZIP/client copies. Browser read hard cap130MiB.
**Constraints**: 50 clips,32MiB/file,128MiB aggregate media,1MiB manifest,130MiB final archive; no new dependencies, transcoding or automated publishing. UI must explain caps before starting.
**Scale/Scope**: Four stories; entire dashboard shell regression surface, dedicated existing-resource list routes, Home, Streams/detail, Inventory and one export endpoint.

## Constitution Check

Before research: test-first work, isolated data, traceability and smallest coherent slices required. After design: no production code changed; planned evidence has one suite owner, browser scenarios carry both roles where outcomes coincide; no schema or migration generation. No exception approved. The reference is pinned and product defaults are explicit. Implementation preparation runs TDD setup/baseline before the final read-only analysis; feature product evidence remains **Not Run** until implementation. Do not mark a quality gate Green based on document generation.

## Project Structure

```text
specs/006-clip-library-export/
  spec.md plan.md research.md data-model.md tasks.md quickstart.md
  contracts/creator-library.md
  scenarios/us1.feature us2.feature us3.feature us4.feature
  test-traceability.md defect-log.md test-summary.md
  checklists/requirements.md
src/app/components/
  dashboardNavbar.tsx dashboardShell.tsx dashboardEditorLayout.tsx
  creator/clipInventory.tsx creator/clipExport.tsx
src/app/dashboard/
  layout.tsx page.tsx clips/page.tsx streams/page.tsx streams/[videoId]/page.tsx
  overlays/page.tsx playlists/page.tsx galleries/page.tsx runners/page.tsx
src/app/actions/creatorLibrary.ts
src/app/api/clips/export/route.ts
src/server/creator-library.ts
src/server/clip-export.ts
src/auth/permissions.ts
src/server/resources/clip-discovery.ts (reuse, only change when needed)
test/app/components/dashboardShell.test.tsx
test/server/creator-clips.test.ts creator-overview.test.ts clip-export.test.ts
test/bdd/features/clip-library/us1.feature us2.feature us3.feature us4.feature
test/bdd/steps/clip-library.steps.ts
test/bdd/support/clip-library.ts
```

Paths are intended targets; reuse/extract existing components before creating another. Existing tests at `test/app/components/dashboardNavbar.test.tsx`, `test/app/dashboard/`, `test/acceptance/dashboard-editor-layout.spec.ts` and user-tour features remain owning regression evidence; update them when behavior moves. No new MCP workflow/export capability or Runner changes in this release.

## Implementation Strategy and Dependencies

1. Preparation resolves reference/defaults and verifies the test profile/baseline. Read the pinned reference, current installed API examples and whole caller surface before edits.
2. US3 builds authorized inventory and search actions, metadata, filters/page URL, preview, explicit selection and reset/recovery. Render the working page inside the current DashboardNavbar; add its entry to the existing dashboard resource actions until final shell composition. Reuse existing clip discovery and authorization.
3. US4 adds explicit export permissions/roles, official provider boundary, bounded archive/endpoint, then the client partial/reconnect/cancel/retry UI in the working inventory.
4. US2 first preserves the existing resource table at `/dashboard/overlays` with current chrome, then adds available-broadcast list/detail and the honest clip-focused Home. Reuse the inventory/export query and controls.
5. US1 composes one shared sidebar/search shell over these real pages and existing resource editors, extracting remaining dedicated resource lists and preserving all DashboardNavbar callers, account/admin/agency/tour/guard behavior. Reuse the completed authorized clip search service. No placeholder page, dead destination or forward dependency.
6. Run final owning suites/coverage/browser/static/CI gates and reconcile reports.

Dependency order is **US3 -> US4 -> US2 -> US1 -> full gates**. This is a delivery dependency, not a change in business priority. Inventory and export are independently useful before the shell composition. The manual-export MVP is US3+US4; all four stories remain required for this full feature. The final navigation can therefore pass its acceptance criteria without waiting on future unbuilt pages.

## Test Plan and Execution Model

The canonical inventory and mappings are [test-traceability.md](test-traceability.md). Before a story's production work, materialize its Gherkin from `scenarios/`, expand every required class to named examples, and bind IDs through `test/bdd/steps/clip-library.steps.ts`. Use the real Next dashboard, real installed components, authenticated sessions and disposable DB fixtures. Intercept only external Twitch API/media boundaries with deterministic test video bytes; do not mock the component under acceptance test. Inspect actual ZIP entries and manifest, not a success toast alone.

One behavior slice at a time: add the smallest failing whole-file test and relevant browser binding; execute and record the intended assertion failure; implement only that behavior; run the entire changed test file without coverage and relevant scenario; refactor while green. Record source SHA, command, intended failure and passing evidence in the `tdd/cycle-log.md` baseline followed by append-only implementation cycles. No red pushes. First characterize existing navigation/role behavior before moving code.

Every scenario may support BDD+ATDD because its actual user-visible result is the stakeholder criterion; browser BDD owns execution once. No redundant standalone ATDD suite or native MCP scenario. Unit/contract tests own security and memory invariants; browser evidence owns visible recovery. Independent higher-risk interfaces retain separate tests.

## Tools, Gates and Environment

[quickstart.md](quickstart.md) defines commands and documented setup. Apply `docs/local-testing.md` exports separately for each tool call, verify loopback PostgreSQL/job-owned template/Chromium dependencies, never use Infisical or shared/production credentials for tests. Existing Next local guide and installed component examples must be read before implementation. Local unavailable prerequisites are setup blockers, not intended Red failures.

All required gates and thresholds are listed once in traceability. Preserve merged CI lane ownership, source/execution identity manifests and thresholds; add new production source files to the correct coverage inventory rather than excluding them. Root global floors currently50 branch/65 function/60 line/60 statement; higher existing path thresholds remain. Shared shell/config scope requires the full application owner. Relevant existing editor, tour, context, agency and upgrade browser journeys are mandatory, beyond the new feature scenarios.

Security requires export denial, cross-creator ID rejection, current-grant recheck, redirect/SSRF checks, token redaction, actual-byte caps, malformed media and cancellation cleanup tests plus dependency audit. Mutation tooling is absent; deliberately mutate ownership, exact-ID mapping and actual-byte guards and prove their owning tests fail, restoring code afterwards. No new dependency is planned.

New tests must integrate into current CI browser/coverage inventories and check-generated-scenario validation as applicable; do not invent an unexecuted lane. Draft PR only when later requested; ready_for_review invokes the full required Test gate. No merge before full coverage, all owning scenarios, lint, format, types, build and required CI finish. Linux/native/Windows claims must remain separate; v1 has no Runner runtime changes.

## Evidence and Reporting

Artifact ownership/commands/current statuses: `test-traceability.md`. Triage and release-impact decisions: `defect-log.md`. Execution/coverage/risk recommendation: `test-summary.md`. No extra report set. Retain CI coverage, Playwright traces/screenshots/JUnit and gate outputs under existing `coverage/`, `playwright-report/` and `test-results/` upload rules, currently30 days for owning coverage/browser artifacts. Commit the three concise reports with stable CI links when implementation finishes; do not commit generated binaries or claim permanent raw-artifact retention.

Overall summary destination: **rolling**, `reports/test-summary.md`, no release ID; convergence later references these feature reports. No overall report created during this planning pass.

## Risks and Complexity Tracking

- Sidebar source is pinned to PR#13 head; match interactions with Clipify components. Future changes/merge of the reference do not silently expand this feature.
- All-plan manual export and available-broadcast history are explicit reversible defaults; permanent history/automation require a future specification.
- Bounded in-memory ZIP is intentionally small; two server copies plus browser Blob can still be material on mobile. Measure actual memory at byte-cap fixtures. If bounds fail acceptance, reduce copies with fflate's incremental API within this contract before proposing persistent infrastructure.
- Current cache reader scans whole-owner JSON. Benchmark before adding query complexity; do not promise unbounded-history scalability.
- Available Twitch VODs and latest known view counters cannot prove permanent stream history or a future24h automation threshold.
- Permission additions touch role editors, authorization fixtures and possibly consent registries; audit every `Permission` consumer. No automatic grant to custom roles or analytics-only users.

## Next command boundary

After this preparation, the human-facing next command is `$speckit-implement`. It consumes the explicit test/Red/production/Green tasks and TDD list; no separate planning command or manual test-scaffolding step is required. Existing disabled extension hooks stay disabled. Any TDD runner invoked internally belongs to the subsequently authorized implementation, never this preparation pass. Do not run `$speckit-tdd-run` or write feature test bindings now.

Authenticated browser fixture exemplar: `test/bdd/support/user-tour.ts`, `test/bdd/steps/user-tour.steps.ts` and `test/support/user-tour/server.mjs` exercise the real built Next app with disposable PostgreSQL and the guarded auth-fixture route. Reuse that lifecycle (or extract its small shared server helper where required) for clip-library browser evidence. Do not substitute the in-memory authWorld fixture from auth-engine-rewrite for real rendered dashboard acceptance.

## Source ownership registration during implementation

`jest.config.cjs` does not currently collect arbitrary new src/server or dashboard/API paths, and `scripts/check-mcp-coverage.mjs::readMcpSourceManifest` explicitly selects many existing files. Register the new server library/export code, creator actions, export route, permission registry and new/changed dashboard routes plus shell/client components in those existing owners as each slice lands; do not assume directory discovery already includes them. New authorization/export server paths are critical under the existing95-line/90-branch and90-statement/function policy; ordinary new UI paths use the existing90-line/85-branch and90-statement/function policy. Preserve existing stricter path/Runner floors. Existing large legacy files such as twitch.ts keep their established policy; prove the new private-preview branch through whole-file tests and deliberate-mutant evidence rather than raising an unrelated legacy file's entire floor. Run existing coverage-gate/inventory checks and require actual counters for every registered path. This is registration in existing guards, not permission to bypass or lower them.

## Clean-base alignment before implementation

The original full baseline was executed at9f6107a3 on an unrelated fix branch and remains labeled as such; it is not credited to clean master or the future feature. The new feature branch starts at master b6c8e591, with its locked Next16.4.3/HeroUI3.2.7/Auth1.7.12 dependencies installed. Clip-cache, Twitch, authorization and permission APIs were unchanged; navigation changes are limited to an updated help URL and existing analytics modernization. Recheck current owning whole-file baseline tests, keep the same A/U/scenario/task identifiers, and require complete current-source coverage/browser/static validation again before push. No unrelated fix commits are carried into the PR.

### Sidebar and individual-download follow-up

Reuse the existing HeroUI Pro sidebar for URL-addressable Settings and Tools sections. Keep Settings drafts mounted across query-only navigation and keep its unsaved-change guard for leaving the resource. Reuse DashboardEditorLayout for owned clip details and a shared stable ClipPlayer for preview/detail.

The existing export HTTP route accepts an explicit MP4 format for one clip. It reuses the complete authorization, provider batching, host validation, media byte validation, cancellation, size/deadline bounds and final authorization path. Existing database rate-limit counters bind manual jobs and provider calls to creator identity across members/instances. No generated schema work is required. ZIP errors use ControlledModal and the house toast helper; refresh failures retain successful inventory data. Stable scrollbar gutters are verified against the installed Sentry dialog.
