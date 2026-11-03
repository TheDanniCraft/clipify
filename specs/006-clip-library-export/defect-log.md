# Defect Log: Creator Library and Export

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Traceability**: [test-traceability.md](test-traceability.md) | **Summary**: [test-summary.md](test-summary.md)
**Created / Updated**: 2026-11-03

## Purpose and Scope

Track readiness blockers, unexpected failures and verified closure. Preparation and implementation checkpoints are distinguished. Expected missing-feature Reds are not incidents; unexpected fixture and execution-governance failures are tracked below.

## Status Vocabulary

Open, In Progress, Blocked, Fixed, Verified, Deferred, Rejected. Deferral requires named approver, scope, compensating evidence and follow-up; nothing is accepted by silence.

## Severity and Priority Policy

Critical: unauthorized access/data loss or core unavailability; High: unmet acceptance/security/accessibility boundary; Medium: localized failure with workaround; Low: cosmetic/documentation. Critical/High release failures block without explicit approved exception. Missing setup is environment evidence rather than product Red.

## Defect Summary

| ID          | Title                                        | Source | Severity / Priority | Status   | Owner                 | Evidence                               | Resolution                                                              |
| ----------- | -------------------------------------------- | ------ | ------------------- | -------- | --------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| DEF-US1-001 | Exact sidebar reference unresolved           | FR-001 | Medium / High       | Verified | Product + implementer | research.md; asynchronous URL question | Identify repo/PR and inspect the actual branch before UI implementation |
| PREP-002    | Conflicting scenario scope                   | FR-008 | High                | Fixed    | Implementer           | preparation analysis                   | One acceptance slice at a time                                          |
| DEF-US3-001 | Fixture table name                           | FR-007 | Medium              | Verified | Implementer           | corrected outer Red log                | Use userSettings                                                        |
| DEF-US3-002 | BDD callback declaration                     | FR-008 | Medium              | Verified | Implementer           | corrected17-example run                | Destructure registered fixtures                                         |
| DEF-US3-003 | Error-region locator                         | FR-008 | Medium              | Verified | Implementer           | 30/30 acceptance checkpoint            | Named export region avoids the Next route announcer                     |
| GOV-001     | Specific outer bindings followed query units | FR-008 | High                | Open     | Implementer           | cycle log                              | Audit and remediate before delivery                                     |

## Defect Details

### DEF-US1-001

Expected: reproduce the requested Payloadsbay sidebar/search behavior using Clipify components. Actual: spoken repository name is ambiguous and connected GitHub searches did not identify it. No external source was copied. Product URL requested during planning. Resolution: record actual PR URL/head SHA and relevant files/interactions in research.md, then finalize navigation acceptance. No substitute or waiver approved. Verification: user supplied payloadbay/payloadbay#13; actual sidebar/layout/search source inspected at1560be1e9ac0339ebeebc774b19f57c4d4fe80ff and pinned in research.md. Resolved during preparation; no runtime environment involved.

## Open Defect Review

No remaining product clarification blocker. All-plan export and available-broadcast history are documented autonomous v1 defaults; they are not falsely recorded as explicitly confirmed. Runtime baseline issues discovered during TDD setup must be recorded separately without altering feature behavior.

## Verification and Regression Closure

DEF-US1-001 is closed by the pinned reference inspection. Implementation must link each fix to its owning test/gate and CI source identity.

## Defect Metrics

Preparation defects are preserved above. Product fixes and final-checkpoint findings are recorded below. The final production build,32/32 layout/recovery/editor acceptance checks and109/109 core/guide examples pass; the full root coverage owner passed with exit0. GOV-001 remains open: later characterization and deliberate mutants cannot prove historical test-first ordering. The unchanged dependency audit is also open. No waiver, deferral or merge approval is recorded.

## Required Checks

- [x] Planning blocker recorded without claiming a product regression.
- [ ] All unexpected execution failures triaged with evidence.
- [ ] Blocking issues verified or explicitly accepted by a named owner.
- [ ] Final defect counts and release decisions reconciled with test-summary.md.

## Setup Verification Notes

The current baseline passed after preparing documented local prerequisites. Initial restricted-sandbox TypeScript subprocess output, absent Chromium libraries and one overlapping browser-selector port collision are resolved setup observations, not product defects or intended Reds. Exact results/rationale are recorded in tdd/cycle-log.md and the refreshed profile. No test, threshold or skip condition was changed. There are no open product clarification blockers. All four product surfaces are implemented; final complete validation and publication remain pending.

## DEF-US3-001 — Browser fixture table name (fixed)

The first BDD-US3-001 disabled-page example failed during fixture setup because it inserted into `settings` instead of the actual `userSettings` table. Corrected the fixture; rerunning both examples reached the expected missing Inventory heading assertion. Evidence: `/tmp/clipify-spec006-outer-red-corrected.log`. This setup failure is excluded from product Red evidence.

## PREP-002 — Conflicting scenario materialization scope (fixed)

T017/T029/T045/T005 required an entire story to be materialized before any product change, while acceptance-slice tasks explicitly kept later criteria inactive. Reconciled the four umbrella tasks to require each corresponding acceptance slice before its production behavior and all examples before story completion. This changes execution ordering wording only; no example, requirement or gate was removed.

## GOV-001 — Outer-loop binding completeness (open)

Only BDD-US3-001 is currently executable. Query units were started while the more specific BDD-US3-002/003/006 bindings remain planned; this is not credited as complete acceptance-first discipline. Preserve the unit Red/Green evidence, materialize and observe the relevant real-browser examples before further product changes, and audit this deviation in tdd/verification.md. No waiver, story completion, push or release is credited.

## DEF-US3-002 — BDD callback fixture declaration (fixed)

The first filter/validation bddgen run rejected a callback with a named `world` parameter; playwright-bdd requires destructured fixtures. Bound explicit destructured callbacks to the shared seed helper. The generator failure is setup evidence only, excluded from intended Red. Original log `/tmp/clipify-spec006-query-outer-red.log`; corrected run uses `/tmp/clipify-spec006-query-outer-red-corrected.log`.

## DEF-US3-003 — Field-error browser locator (fixed before UI implementation)

Initial invalid-query examples found Next’s empty route-announcer alert. Narrowed the expected alert to the visible Filter validation region and its specific error-field marker. This strengthens the assertion and allows user-facing field labels instead of requiring internal camelCase keys in UI text. No product UI exists yet and no passing assertion was weakened. Revalidate these bindings before crediting acceptance.

## DEF-US3-004 — Strict-reader fixture URL (fixed)

The resumed owner-read Green attempt returned an empty list because the old pure-query fixture used an empty thumbnail_url, which is invalid provider data. Kept the provider validation and corrected the fixture to a real approved HTTPS CDN shape. Expected owner-read behavior is unchanged. `/tmp/clipify-spec006-resume-U87-green.log` retains the unexpected failure; corrected run uses `resume-owner-fixed.log`. Prefix matching now uses PostgreSQL starts_with with bound values to avoid wildcard semantics in creator IDs.

## DEF-US3-005 — Installed control variant types (fixed)

Initial Inventory typecheck found secondary variants assigned to compound Trigger/Group rather than supported Select/NumberField roots, plus an optional category ID not narrowed before inArray. Moved variants to the installed root APIs and narrowed category IDs. No test weakened. `/tmp/clipify-spec006-ui-types.log` retains the original errors; next browser build verifies current code.

## DEF-US4-001 — Browser-facing request origin (verified)

Real-browser export received PERMISSION_DENIED before authentication; an unauthenticated same-origin probe also received403, proving the route-origin guard was responsible. Next’s request URL can retain its internal listener origin while the browser Host carries the actual public port. Reproduce this in route tests, derive expected origin from Host plus request protocol, and retain the cross-origin negative test. Selection fixture pointer interaction with React Aria’s visually hidden checkbox is changed to real keyboard Space interaction, with the same selected-ID assertions. Evidence `/tmp/clipify-spec006-export-browser.log`; no passing browser export claimed yet.

## DEF-US3-006 — Consent fixture reload expectation (fixed)

The export/selection test waited for a load event after rejecting optional cookies, but the consent component can update in place. This stalled the browser before selection. Follow the existing editor-layout browser pattern: click Reject optional and wait for the consent banner to disappear. Keep real keyboard checkbox interaction and all selected-ID/download assertions. No application behavior or test outcome weakened.

## DEF-US3-007 — Selection lost during query navigation (verified)

Browser BDD-US3-004 reached 0 selected instead of25 after pagination. Server page navigation remounted the inventory state. Keep this workspace mounted: load validated pages through its existing server action and synchronize the URL through Next-supported native History, with popstate restoration and request epochs. Filter/creator changes still clear selection; page changes preserve it. Retain exact selected-ID assertions. Evidence `/tmp/clipify-spec006-export-browser-retry.log`.

## DEF-US1-002 — Installed Sidebar accessibility roles (fixed)

The composed Sidebar renders React Aria’s treegrid/row semantics, while the initial binding assumed tree/treeitem. Browser snapshot confirms Creator navigation and all destinations are present. Corrected exact accessible roles and kept destination, URL, heading and aria-current assertions. Evidence `/tmp/clipify-spec006-all-core-browser.log`.

## DEF-US1-003 — Current-page attribute filtered from navigation row (fixed)

Installed Pro Sidebar sets data-current correctly but React Aria filters its aria-current prop from the generated row. Keep the exact current-page accessibility assertion; use the supported TreeItem render callback to retain all supplied DOM props and add aria-current on that row. No component behavior or expected outcome removed. Evidence `/tmp/clipify-spec006-core-browser-roles-fixed.log`.

## DEF-US4-002 — Table-driven array fixture packaging (fixed)

The expanded guard tests supplied selected-ID/cache-row arrays directly as Jest table rows, which spread their elements instead of passing an array argument. Wrapped each case as one argument; expected invalid-selection and ownership-denial behavior is unchanged. These fixture errors are not intended product Reds. `/tmp/clipify-spec006-export-guards.log`.

## Implementation corrections and current findings

| ID             | Finding                                                                                                            | Status   | Evidence and disposition                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEF-EXPORT-001 | Filename collision fallback could replace an existing ZIP entry                                                    | Verified | Intended Red and whole-file Green recorded in cycle-log.md; search continues until a unique sanitized filename exists.                                                |
| DEF-EXPORT-002 | Malformed Host and HTTPS proxy-origin handling could escape controlled denial or reject valid same-origin requests | Verified | Owning HTTP boundary tests and30/30 real acceptance pass; validated proxy scheme plus browser-facing Host determine origin.                                           |
| DEF-EXPORT-003 | Empty/malformed archive or already-expired retry deadline could produce misleading client recovery                 | Verified | Intended Reds in cycle-log.md; framing, bounded response validation and response-time clock correction have whole-file Greens.                                        |
| DEF-DATA-001   | Provider-deleted broadcast and invalid cached clip rows could imply available/complete data                        | Verified | Provider404 wins over stale availability; invalid entries independently invalidate completeness. Intended Reds and complete owner Greens are recorded.                |
| DEF-NAV-001    | Resource Back routes, fixed-stream filtering and saved local-date restoration could lose context                   | Verified | Canonical resource returns, fixed VOD scope and timezone-aware restored filters; whole-file and30/30 real acceptance checkpoints.                                     |
| DEF-HOME-001   | Retrying failed broadcasts unnecessarily replaced successful metrics                                               | Verified | Eight complete component checks Green after intended independent-retry Red; request effects are independent.                                                          |
| AUDIT-001      | Four high advisories in unchanged dependency graph                                                                 | Open     | `bun run audit:high` fails for follow-redirects1.16.0 and transitive Zod4.4.3. No manifest/lockfile changes are part of this feature. Retain as a merge-gate finding. |
| MOBBIN-001     | Optional reference tools initially unavailable/authentication required                                             | Verified | User completed normal OAuth; authenticated web screens and flows were inspected. Applied moves and exact references are in design-review.md.                          |

The private preview guard was moved into the registered critical `creator-library.ts` owner because the existing legacy Twitch action has a pre-existing Istanbul file exclusion. No exclusion or threshold was added or weakened. Fresh creator permission and exact clip ownership precede lazy playback-cache access;115 complete guard/playback tests passed. Final root coverage still owns the complete coverage decision.

## DEF-NAV-002 — Replayed playlist creation paused on its new resource list

The complete guide owner found that a completed playlist tour paused after Home -> Playlists despite retaining its existing playlist. Waiting for the observed navigation step did not resolve the failure. Diagnostic state showed index0, empty navigation and paused=true while the Create Playlist target existed. The shared routeForTask helper incorrectly classified an existing playlist's initial creation step as an editor step; the new resource-list pathname emitted a location event that paused it. Intended unit Red: `/tmp/clipify-spec006-playlist-replay-red.log`. Fix: index0 expects `/dashboard/playlists`; later steps keep the actual editor path. All76 affected unit tests passed (`...playlist-replay-green.log`), and the real replay scenario passed (`...replay-fixed-browser.log`). The final complete guide owner is rerun after the authorized Mobbin layout changes. Temporary diagnostic logging was removed.

## DEF-NAV-003 — Shell navigation could discard Gallery drafts without confirmation

Severity:High (unsaved draft loss); status:verified in the final32-case real-browser acceptance owner; complete coverage and CI remain separate gates. The Gallery editor wrapped its own navigation-guard provider inside the existing global provider. Shell sidebar/palette routing therefore used a different guard collection. Corrected browser fixtures first proved the field was dirty, then reproduced both navigation paths reaching Home without the required confirmation. Evidence: `/tmp/clipify-spec006-gallery-sidebar-guard-red.log`, `/tmp/clipify-spec006-gallery-search-red.log`. Reusing the app-wide provider is the shared fix; no new navigation system or duplicate confirmation was added. All29 affected unit tests and both1280px/390px installed-component regressions passed. Cancel retains the draft; explicit Discard does not save it. Early consent-reload and required-label fixture failures are not counted as product Reds.

## Final owner test corrections

The first complete coverage attempt failed the coverage-registration contract and an inventory recovery assertion. Jest now collects the registered permissions source; the recovery test waits for the enabled Reload action and proves its entered draft filter survives the failure and is submitted. Navbar coverage characterization covers existing organization/admin/campaign branches. The affected Navbar and inventory whole files passed44/44, and the coverage-registration whole file passed. These test/setup corrections are not historical product Reds. Final complete coverage is recorded in test-summary.md.
