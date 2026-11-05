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

## 2026-11-05 approved follow-up

User approved C with dense 25/50-row clip tables, compact existing pagination, category art/name resolution, compact account identity and sticky editor actions. Stream detail adds chronological moments built from owned clips, not a Twitch Recap integration. Portrait editor uses synchronized original/canvas previews, full or stacked gameplay/camera source crops, adjustable split, metadata text positions and a reusable channel preset. Use installed HeroUI controls and shared editor layout. Normalized finite crop coordinates validated at the export trust boundary; original source and original download unchanged. Manual FFmpeg rendering takes only previously authorized, byte-bounded local media, with bounded time, threads, output size, concurrency and cleanup. Store channel preset in existing user_content_states with authorization; no schema migration. Free watermark and automated/social exports remain undecided and unimplemented.

Acceptance: preview and output agree on crop/split/text; controls work by keyboard and pointer; corrupt presets recover; failed exports preserve edits; foreign clips/layout requests denied; abort kills renderer and removes temp files; original and portrait exports share creator budgets. Browser checks cover390/1440px, both themes, category cold cache,25+ rows/pagination, preset reload and rendered MP4 dimensions/audio.

## Export queue refinement

Keep the existing binary API for callers. The dashboard opts into bounded newline progress metadata followed by raw archive bytes on the same authorized request. Never base64-encode video. Validate progress count, indices, metadata size, complete summary, declared byte count and archive/media signatures before download. Abort propagates through the response reader and existing provider/render pipeline.

A creator-keyed client provider in DashboardShell holds a sequential queue and bounded session history. Keep only the latest downloadable Blob for 60 seconds; earlier/expired batches can be exported again. No background worker, schema or new dependency. Apply a weighted reservation through existing persisted rate-limit counters; rejected reservations roll back atomically. Existing default authentication limiter behavior stays unchanged.

Home insights: retain the existing overview/broadcast independent requests and creation-window calculations. Add the all-time ranking to the same authorized cache read. Compose a second pair of equally sized HeroUI cards for Top clips and Creator Page insights, with compact icon shortcuts above. The analytics child uses the existing creator-specific action, reads only when server-resolved feature access allows it, and keeps loading/failure/retry independent of clips. Preserve public analytics consent gating; no new collection, schema, provider or dependency.

Composition expansion: add a version2 composition schema alongside the old version1 layout, with normalized source and destination rectangles, Desktop/Mobile dimensions, ordered video/text/logo layers and bounded validated input. Source and destination geometry stay independent. Share locked-ratio resize and snapping helpers between interaction modes. Convert old cover crops into explicit source crops so migration preserves framing. Reuse user_content_states for individual named template rows, per-format defaults and separate per-clip/per-template override rows; no generated migration or new dependency. Existing authorization remains authoritative.

Export settings builds a clip-major plan of (clip, output) files, splits at50 files and submits one plan per batch to the existing export endpoint with bounded incremental progress. Preserve the legacy request API. The server validates owned clips/templates/overrides, reserves the account job/volume budget once for the whole batch and reuses the existing authorized single-file preparation internally. Never accept a client-controlled limiter bypass. Build one ZIP with distinct MP4 filenames and a manifest when multiple outputs are selected. Rendering/preview use the same layer order, contain geometry and widgets. Logo sources come only from the authorized creator's trusted profile metadata, never layout URLs. Preserve bounds, abort propagation, cleanup, draft recovery and old renderer behavior.

Reuse the approved HeroUI editor gutters, guards, preview retry, fields and modals. Global layout management is independent of selected clips; a reference clip previews it. Clip detail entry opens an override of a chosen template. Export dialog lists Original and grouped named Desktop/Mobile choices, with create/manage paths for absent layouts. Remove the old selection-bound portrait warning/action.

## Paired-template follow-up implementation

Keep existing v2 template keys and their compatibility composition field. Persist validated compositions.desktop and compositions.mobile under the same named template ID; populate the missing counterpart on read for existing single-format entries and preserve the other composition when saving. Store one default template key, reading historical per-format defaults as fallback. Clip overrides append their format to the existing creator/template/clip key. Read compatible historical overrides without applying them to the other orientation; reset only the requested format. No schema or generated migration change is needed.

Export outputs carry templateId and explicit format, and resolve the corresponding composition/override on the server. Original remains untouched. The dialog applies selected format checkboxes to selected template collections, rather than selecting separate format-specific templates. Refresh removes unavailable template IDs without choosing another collection silently.

Use installed HeroUI Autocomplete with debounced server title search; retain an out-of-page selected reference only outside active search so nonmatching queries can show an honest empty state. Use a shared deterministic color mapping for source crops, output frames and the layer list, independent of stacking order. Move Clip layouts below Runner and use the composition icon consistently. Trusted CDN previews stream through an authenticated same-origin route with strict host/redirect/MIME/size/time/range bounds, preserving the existing playback transport for other resolved sources.

Validation owners: paired-layout-editor.spec.ts (both themes and390/1440, actual signed-CDN fixture without CORS headers), clip-composition-interaction.spec.ts, creator-layout.spec.ts, clip-layout-isolation.spec.ts, and the shared US4 Gherkin export owner. Unit/action/API owners cover paired saves, format overrides, stream rejection/cancellation bounds, live search and stale selections. Keep required CI source inventories and thresholds unchanged.

Interaction revision (approved2026-11-05): output-frame shape drives source crop aspect through the existing composition helpers; source adjustments preserve output frames, and output moves preserve crops. Native pointer capture is backed by window capture-phase release/cancellation/blur and primary-button-state checks. Both panes share move/resize snapping and eight handles with native cursors. Reference selection lives in the paired-template parent. Identity-only colors survive collection changes. Channel metadata renders as one avatar/name block through both canvas and the existing FFmpeg composition pipeline; title/clipper use bounded background blocks. No schema migration or new dependency is required.
