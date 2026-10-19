# Runner UX and integration audit

Source: `78025d38`, reviewed against the feature diff from `origin/master`, the existing overlay theme editor, installed HeroUI 3.2.6 and HeroUI Pro beta.10, and the user's review. This is an audit, not implementation completion evidence. No production accounts or data were inspected or changed.

## Corrective implementation checkpoint (2026-10-18)

The audit below records the rejected original implementation. Corrections are now implemented in `6f87bd3b`/`9433536e`; final validation is ongoing. Do not read the historical verdict as the state of the corrected editor or mark release gates passed from scoped feedback.

| Finding | Implemented correction                                                                     | Corrective verification                                                                                |
| ------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| UX-01   | Inline destination creation/selection; actionable missing source; Save distinct from Start | Real first-run Free/Pro acceptance and no-source flow; final captures inspected                        |
| UX-02   | Remove standalone Runner product/entitlement/agency allocations; effective Pro only        | Retired-access, commercial, entitlement, billing and notification owners pass; no live records changed |
| UX-03   | Stable iframe URL/key, revisioned same-origin draft messages and acknowledgments           | Preview route/message owners pass; browser counts document requests during edits                       |
| UX-04   | Catch/finally lifecycle, preserved draft, retryable feedback; independent refresh recovery | Recovery owner passes; injected failed-save browser acceptance passes                                  |
| UX-05   | Missing-source action and matching preview readiness/placement prerequisite                | Preview owners and no-source browser acceptance pass                                                   |
| UX-06   | One setup shell, adjacent destinations and focused Appearance/Schedule modals              | Real desktop/mobile acceptance implemented; final captures inspected                                   |
| UX-07   | Pro DropZone, shared color picker, HeroUI date/time/timezone controls                      | Installed component browser flows plus widget owners pass                                              |
| UX-08   | Secondary fields and shared picker composition                                             | Component checks pass; final light/dark captures inspected                                             |
| UX-09   | Installed Agenda navigation, Today and day/week/month views; native grid scrolling         | Complete 42-case Runner browser regression owner passes                                                |
| UX-10   | Shared selected local timezone and searchable validated timezone input                     | Browser non-UTC, invalid-zone, DST and local-boundary cases pass                                       |
| UX-11   | Separate human-readable start/end dates and weekly end days; stable IDs                    | Browser multi-day/week, move/resize, locked-event and continuation cases pass                          |
| UX-12   | Extract exact theme color editor and retain constrained authentic overlay preview          | Shared picker, asset and preview contract owners pass; final captures inspected                        |
| UX-13   | Shared owner policy, known-expiry refresh and authoritative denial invalidation            | Expiry/renewal browser cases pass; expanded downgrade acceptance passes                                |
| UX-14   | Named actions, HeroUI event buttons, keyboard/focus and upload feedback                    | Complete Runner keyboard/pointer regression passes; real acceptance 3/3 passes                         |
| UX-15   | Current configured theme tokens, including enrollment follow-through                       | Source sweep and enrollment owner pass; final captures inspected                                       |
| UX-16   | Real-component acceptance and inspected visual evidence required by AGENTS.md              | Runner browser 42/42; push feedback 201 suites/3,043 cases; full gates still pending                   |

The earlier browser freeze is not conclusively reproduced. The correction removes observed per-keystroke document navigation; that result does not prove every possible performance issue is resolved. Ordinary migration generation remains workflow-owned after merge. No production cleanup or generated migration is performed here.

## Historical audit verdict

Do not release the current Runner UX. Passing scoped tests established individual behaviors, but did not establish a coherent setup flow, design-system consistency, or visual quality. The earlier readiness claim was too strong.

The scope is the changed Runner settings, enrollment, appearance, scheduling, destinations, billing and entitlement surfaces, their server boundaries, and relevant regression-test ownership. This is not a renewed exhaustive security or native execution-protocol audit.

## Findings and required corrections

### UX-01 — High: first-run configuration is a disabled-button dead end

`src/app/dashboard/runners/[id]/page.tsx`: `streamConfigValid` requires an overlay and selected or legacy destination; Save Configuration is disabled when false. `runnerDestinationSelection.tsx` has no inline create action. A new Runner has no selected destination, while the only Add destination action is in a separate section below appearance and the calendar.

Integrate a HeroUI destination picker with an adjacent create/manage action into broadcast setup. Select the created destination after success. Show missing prerequisites at their controls, without a general plan explainer. The initial setup must lead directly to a valid saved Manual broadcast.

Verify: a fresh Free account with one overlay and no destinations can create a destination, save Manual configuration and start; a fresh account with no overlay has an explicit create-source action.

### UX-02 — High: legacy entitlement policy conflicts with the requested product cleanup

`src/server/runner/capabilities.ts:9` explicitly computes advanced Runner access from `proAccess || runnerAccess`. `benefits.ts` resolves legacy grants and agency allocations. `runnerAccess` remains in entitlement resolution, `RunnerAccess`/`RunnerSelfHosted` remain in `src/app/lib/types.ts`, and Billing still displays owned historical Runner products.

The current spec explicitly requires this in FR-018/021/022. Therefore a Free-labelled account with a valid legacy Runner grant can use scheduling, custom standby and watermark removal. This is not evidence of an unauthorized Free toggle bypass. It is a retained policy that no longer matches the user's stated expectation, and account labels make it confusing.

Reconcile the spec, capability resolver, account/billing presentation, grant handling and tests together. Inventory existing grants/allocations and any actual billing references before retiring compatibility paths. Do not delete entitlement tables wholesale: they also hold unrelated benefits. Schema changes belong in schema sources; ordinary generated migrations remain workflow-owned. No account/grant deletion was performed during this audit.

Verify separate fixtures for plain Free, Pro, Runner-only grant, expired grant and agency allocation. UI controls and server authorization must agree in each case.

### UX-03 — High: preview navigation on every edit

`src/app/components/runner/RunnerBrandingPreview.tsx` includes message, colors, asset IDs, corner and preview mode in both the iframe key and URL. Each message keystroke remounts/navigates the iframe rather than updating a stable preview. The preview also renders the actual generated presentation and may run clip playback.

Keep the preview mounted; reuse the existing overlay preview/editor architecture and update draft presentation without a navigation per keystroke. Profile rendering, requests and CPU before calling the reported browser freeze resolved. The exact cause of the user's freeze is not established by source inspection alone.

Verify: typing a message does not produce one document navigation per character; switching modes and changing assets leaves one active preview, without accumulating playback or listeners.

### UX-04 — High: failed configuration requests can leave Save stuck

`RunnerPage.handleSave` sets `isSaving` before awaiting `upsertStreamSession` and clears it only after resolution. It has no catch/finally. A rejected server action can leave the save control pending and produce no actionable recovery. Similar bare awaits occur in action and refresh paths.

Use try/catch/finally for request lifecycle, preserve drafts, surface a local retryable failure and keep Save distinct from Start readiness. Do not turn expected business denials into thrown errors or Sentry incidents.

Verify rejected save and post-save refresh independently; the user can retry without reloading or losing their inputs.

### UX-05 — High: appearance saving can be impossible without a preview

`RunnerBrandingPreview` enables Save appearance when a profile is loaded, even if no overlay/source exists. Saving requires a matching preview iframe status and polls for up to five seconds. With no source, no preview mounts and the save cannot succeed.

Represent the missing source explicitly and keep save prerequisites consistent with preview availability. Validate only operations that actually require preview collision checks; retain server validation.

Verify first-run/no-source, delayed preview, failed preview, valid placement, blocked placement, and clean Pro appearance.

### UX-06 — Medium: page composition does not form a coherent editor

`RunnerPage` renders the main settings card, appearance, schedule and destination cards as direct siblings. Its outer flex container has no spacing gap. Width constraints and spacing differ between panels. Appearance has its own action/preview controls, while schedule creation depends on configuration saved elsewhere.

Use one consistent editor shell with HeroUI tabs or clearly separated modes for Broadcast, Appearance and Schedule. Keep a stable preview and contextually relevant actions. Integrate destination management with the broadcast selector. Verify desktop and narrow layouts, action placement, scrolling and empty states.

### UX-07 — Medium: native controls replace available HeroUI components

`runner/StandbyEditor.tsx` exposes two native file inputs and a native color input. `runnerScheduleAgenda.tsx` exposes a native date input, timezone select and plain event button. `runnerSchedule.tsx` uses generic Input types for dates, times and the weekly end offset.

Use HeroUI Pro DropZone for upload interaction, the existing theme color picker, HeroUI date/time components and NumberField where a numeric value remains appropriate. Native inputs internal to accessible library components are expected; exposed hand-styled replacements are the problem.

The installed package already exports DropZone and Agenda toolbar/navigation components. No missing library or need for user-supplied source blocks this work.

### UX-08 — Medium: secondary field styling is inconsistent

The standby message TextArea, destination-editor Inputs and schedule-editor Inputs lack explicit secondary field styling, unlike the established overlay theme editor. The theme editor uses `ColorField.Group variant='secondary'` and consistent field composition.

Reuse existing field components and set the appropriate secondary variant on controls placed on card surfaces. Check light/dark themes, focus, error, disabled and populated states in the actual browser. Classes that resemble a component are not a substitute for its API.

### UX-09 — Medium: Agenda's built-in controls are bypassed

`runnerScheduleAgenda.tsx` uses Agenda's time grid but recreates its toolbar and forces day on mobile/week on desktop. It omits the built-in Heading, Navigation, NavButton, TodayButton, ViewSelector and month layout. Plain Previous/Next buttons and native controls replace available compound components.

Use the documented installed Agenda anatomy with day/week/month selection, icon navigation and Today. Preserve responsive defaults without removing a supported view. Validate keyboard use, touch, event details and cross-day rendering in Chromium.

### UX-10 — Medium: calendar and event editor default to different timezones

Agenda initializes `today('UTC')` and timezone `UTC`; new-event drafts use the browser's local date and timezone. Calendar timezone choices only include UTC and already-saved event zones. A new account cannot choose its local zone there unless it already has a corresponding event.

Use a shared selected timezone, defaulted from the user's environment/preferences, for calendar and event editor. Use a searchable timezone selector. Test a non-UTC browser and local midnight boundaries, plus DST transitions.

### UX-11 — Medium: cross-day configuration exposes storage concepts

The data/planner supports multi-day events, but weekly editing exposes `End day offset` with values 0–7. Events are projected into day segments; continuation state suppresses resize handles but is not presented as a clear multi-day editing interaction.

Provide human-readable start/end dates and times, including weekly end-day selection, while preserving one stable event identity. Use Agenda's spanning patterns where suitable. Keep adjoining scheduled windows continuous and preserve existing DST/backend semantics. Do not claim the backend lacks multi-day support; the deficiency is its presentation and manipulation.

### UX-12 — Medium: overlay editor and color-picker foundations were not reused

The established overlay theme page has `ThemeColorInput`, remembered colors, ColorArea/ColorSlider/ColorSwatchPicker, and `OverlayStylePreview` with drag/resize/keyboard interaction. Runner adds its own color input and preview composition instead. Those existing helpers are local functions, so reuse should extract shared components rather than import an entire page module.

Reuse that foundation for appearance, preview treatment and constrained placement. If attribution is repositioned by dragging, keep the placement/collision/readability constraints enforced. Review the actual rendered attribution against the existing overlay visual language; API-level geometry assertions do not establish visual quality.

### UX-13 — Medium: capability state is duplicated and can become stale

The parent learns policy through the schedule child's `onPolicyChange`. Appearance independently loads `runnerPro` once and does not consume the returned `validUntil`. Scheduling does schedule an expiry refresh. An account can consequently see controls from different capability snapshots until a reload; server enforcement does not make that UI consistent.

Resolve one owner-scoped capability snapshot for the editor, pass it to all surfaces and refresh on known expiry or authoritative denial. Free locks must be actionable upgrades; true mode incompatibility must remain distinct from a paid lock.

### UX-14 — Medium: accessibility and feedback need real-component validation

The icon-only back control has no explicit accessible label. Calendar event content uses a plain button inside the Agenda event interaction. Draft upload feedback, saving dependencies and keyboard navigation have not been validated as a complete flow using the actual component implementation.

Label icon actions, use the library's supported interactive composition, provide upload progress/error feedback and verify keyboard focus after dialogs and locks. Run accessible-name, keyboard and focus checks against installed HeroUI, not just its test doubles.

### UX-15 — Medium: legacy color utilities lack matching theme definitions

Runner surfaces use `text-muted-foreground`, `text-primary` and `border-divider`. A search of application CSS and the installed HeroUI styles found no corresponding `--color-muted-foreground`, `--color-primary` or `--color-divider` theme definitions. Some uses predate this feature, but the new calendar and destination surfaces propagate them.

Use the current configured tokens and inspect the compiled/computed styles in both themes. Keep valid library APIs: the installed button CSS explicitly supports `ghost` and `danger`, so those variants are not findings. Ensure labels, field boundaries and disabled states retain visible contrast.

### UX-16 — High: validation overstates UX readiness

Root tests map HeroUI to test doubles. The Runner polling test replaces whole UI surfaces, including the upgrade modal. The new control-selection test supplies a custom Select implementation. These tests are useful for state logic, but cannot prove actual popover/modal behavior, visual hierarchy, drag interactions or component styling. Previous browser assertions establish selected flows, not a complete fresh-account setup or visual review.

Require real-browser acceptance through fresh setup, save, free lock/upgrade, Pro scheduling, destination creation/selection, appearance uploads, timezone navigation, and expiry. Add failure-path tests for pending-state recovery and preview navigation. Review screenshots at desktop/mobile sizes in both themes before release.

## Correction order

1. Resolve the legacy entitlement/product-policy mismatch and establish shared owner capabilities.
2. Repair first-run setup, destination selection/creation and save/error recovery.
3. Recompose the page around the existing editor and HeroUI components.
4. Replace native upload/color/calendar controls and repair timezone/multi-day interactions.
5. Stabilize preview updates and inspect attribution rendering/performance.
6. Run actual component/browser acceptance and visual/accessibility review, then the owning release gates.

Do not mark these findings resolved merely because mocked tests remain green. Each requires its stated user-visible behavior and relevant browser evidence.

## Browser evidence

Audited the current source in real headless Chromium against an isolated loopback PostgreSQL fixture, using the installed HeroUI components and the Next.js development server. Screenshots were inspected, not only captured. These observations are UX reproduction evidence, not a substitute for final production-build acceptance.

- Plain Free: selecting Scheduled opened the existing upgrade dialog and retained Manual; the watermark-removal switch was absent.
- A new Runner had zero destination choices, disabled Save Configuration and disabled Add schedule. On the desktop capture, Appearance started around y=1023, Schedule around y=1811 and Destinations around y=2621.
- Adding a valid Runner-only legacy grant exposed the attribution switch; Add schedule remained disabled because no broadcast configuration had yet been saved. This reproduces the two separate capability/setup issues.
- Typing five characters into the standby message generated five preview document-navigation requests.
- The mobile viewport was 390px wide with no document-level horizontal overflow. That passing geometry check did not make the stacked layout, controls or scrolling usable.
- No page JavaScript exception was observed during this probe. The user's PC freeze was not reproduced or explained conclusively.

Evidence: [browser observations](evidence/ux-audit/browser-observations.json), [Free desktop](evidence/ux-audit/free-desktop.png), [legacy-grant mobile](evidence/ux-audit/legacy-mobile.png).

Library cross-check: installed `@heroui-pro/react/dist/components/agenda/index.d.ts` exports the native Agenda Header/Heading/Navigation/NavButton/TodayButton/ViewSelector and month components; `components/drop-zone/index.d.ts` exports DropZone. The official [HeroUI Pro Agenda release documentation](https://docs.heroui.pro/docs/react/releases/beta-4) describes the same view/navigation and drag support. Existing application reuse references are `ThemeColorInput` and `OverlayStylePreview` in `src/app/dashboard/overlay/[overlayId]/theme/page.tsx`.

Probe limitations: the first probe completed the Runner observations above. Its `free.locked` count was an immediate, non-waiting query before the option-selection locator waited for the menu; do not interpret that value as proof that the lock is absent. A follow-up attempt to wait explicitly stopped at the cookie-preference dialog setup before reaching Runner, so it contributes no additional Runner result. That test-setup timeout is not classified as a product regression. Final acceptance still needs the hardened browser fixture and the complete intended journeys.

## Corrected visual review

Final production-build real-component acceptance passes 3/3. Inspected [Free appearance](evidence/ux-correction/free-appearance-desktop.png), [Pro appearance](evidence/ux-correction/pro-appearance-desktop.png), [light desktop setup](evidence/ux-correction/free-setup-light-desktop.png), [mobile setup](evidence/ux-correction/pro-setup-mobile.png) and [mobile calendar](evidence/ux-correction/pro-schedule-mobile.png). These show the shared controls, consistent surfaces and spacing, readable generated attribution, stable authentic preview and native Agenda navigation. The Pro appearance capture is scrolled to its saved color/message controls; upload controls remain above in the same modal, not a separate card. Browser acceptance also exercises actual file upload and the shared color popover. The focus-restoration assertion waits for the library transition before Escape closes the parent destination dialog.

The broader browser sweep additionally caught the modal-padding regression in the 360px preview. The correction retains full-width mobile preview and the original physical text/edge/canvas assertions; complete collision/readability/upload-boundary/pause owners pass 35/35. This supersedes the initial narrow-screen capture as readability qualification. See [mobile regression Red](evidence/ux-correction/mobile-regression-red.log), [whole-owner Green](evidence/ux-correction/mobile-readability-upload-owners-35.log) and [busy-frame 360px preview](evidence/ux-correction/E2-readable-busy-360-preview.png). No readability threshold or output assertion was lowered.

Inspected the complete final mobile Appearance composition as well: [controls](evidence/ux-correction/pro-appearance-mobile-controls.png), [preview](evidence/ux-correction/pro-appearance-mobile-preview.png) and [measured geometry](evidence/ux-correction/mobile-appearance-observations.json). The390px viewport, document and preview agree, with preview x0. This separate observation uses its own disposable fixture and cleans it up; it is not added to acceptance totals.

## Follow-up review implementation (2026-10-19)

Implemented the requested icon-only Unlink with shared Tooltip, full-width Appearance action within configuration, shared Pro crown, centered content-sized modal with internal scrolling, installed HeroUI preview Tabs and four visual Radio corner choices. The user selected four visual corners instead of free dragging. The existing shared Pro color picker remains in the standby controls. No branding policy, collision/readability threshold or persistence schema changes.

Real editor acceptance passes3/3 with measured full-width action, centered geometry, icon/upgrade flow, pointer and keyboard corner selection, arrow-operated Tabs, iframe navigation count0, uploads/color editing and390px mobile preview. Complete affected branding/collision/readability/standby owners pass27/27. Component/state owners pass31/31. Full CI39218922432 qualifies the final source9b49c632, including native450/52, every application coverage/browser owner and merged thresholds. Native matrix39218915226, CodeQL and CodeFactor also pass.

Inspected [Free desktop](evidence/ux-correction/review-free-appearance-desktop.png), [Pro desktop](evidence/ux-correction/review-pro-appearance-desktop.png), [Pro mobile controls and shared color picker](evidence/ux-correction/review-pro-mobile-controls.png), [unobstructed Free mobile preview](evidence/ux-correction/review-free-mobile-preview.png), [light desktop configuration](evidence/ux-correction/review-setup-light-desktop.png) and [mobile configuration](evidence/ux-correction/review-setup-mobile.png). The Pro desktop capture is intentionally scrolled to the saved fields and visual corner controls; upload/color controls remain above within the same modal. Clean captures wait for the actual save toast to expire rather than hiding application elements.
