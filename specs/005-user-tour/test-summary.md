# Test summary: quiet account-backed onboarding

Current scope follows the latest user requirements: HeroUI ring, original support-widget positions, one accordion section, portal skip confirmation, indeterminate active checkboxes, no status clutter/completion cards, replay from Add Overlay and real navigation through app controls. Website/tools are merged into Explore. Account progress lives in PostgreSQL, with existing-user recognition and a one-time legacy import.

## Previous revision validation

The current affected run passed 20/20 suites and 470/470 tests, including five disposable PostgreSQL integration cases. The final ring slice passed its entire provider suite (14 tests); deleted-overlay recovery passed the entire overlay settings suite (98 tests, including one new regression).

The 39-example browser sweep passed 32 initially. After checkpoint and binding fixes, a targeted ten-example run passed nine, covering all initial failures except deleted-editor recovery. That last case exposed an existing infinite loader; the recovery state retains normal Dashboard navigation. The final recovery and explicit ring-size browser checks both passed (2/2). All 39 unique examples have green evidence across the full run and targeted reruns; this is not a single clean 39/39 sweep. Across these runs, each example retains one browser execution owner.

Changed TypeScript lint is clean. Full lint has five existing unrelated warnings. Standalone production build passed after the checkpoint fix. Browser production build and type checking passed for the final presentation/recovery slice. Desktop visual review confirms the 36px ring and original Sentry placement. Earlier 448-test/32-example evidence belongs to the previous candidate.

## Personalization refinement validation

Customization starts in place inside Theme Studio, resumes via its real entry button, preserves the save checkpoint and supports Back. Filters precede styling; the launcher persists the section and shows its own count. Styling highlights the workspace including preview rather than only Text Color. No nested task accordion is added.

The initial affected run passed 16 suites / 414 tests. The final model/provider/adapter whole-file run passed 43 tests in three suites, including section-count and Back callback assertions. Changed-source lint, browser production build/type checking, and standalone production build passed. Six owning browser examples were exercised: five passed initially, and the remaining resume case passed after waiting for editor readiness in its binding. Cases 040 and 041 extend the canonical registry to 41. A settled-animation screenshot is recorded for the full styling workspace.

## Dropdown and section-progress correction

Removed the CSS that made Driver's mask transparent while native Select/color popovers were open. Elevate portalled native controls above the mask; retain native outside dismissal and keyboard behavior. The ring now counts finished section tasks plus partial credit for the active unfinished task, without double counting replay. One of four completed plus a newly active next task displays 38%, retained after acknowledged database writes and reload.

Validation: 16 affected suites / 416 tests passed, source lint and browser/standalone production builds passed. All four affected Chromium examples (002, 018, 022, 042) passed. New case 042 checks visible mask opacity, actual option hit testing, outside dismissal, reopening/selection and database-backed progress after reload. Inspected /tmp/clipify-tour-dropdown.png. The canonical registry now has 42 examples. No schema or generated migration change is involved.

## HeroUI controls and universal Back

The launcher and its accessible name consistently use section percent, while the accordion keeps task counts. Driver’s native controls are disabled; actual HeroUI Buttons render via a React portal. Back is available at every action index after zero, including filters back to source. The previous event replans normal app navigation when reviewing a step on another page, including Theme Studio’s real back control.

The initial affected run passed 16 suites / 418 tests. The final spotlight whole-file suite passed 15 tests, including post-animation position refresh. The first browser sweep passed 6/11 and exposed Driver’s reserved-class event interception and portal-size positioning. With isolated data attributes and size/DOM observation, the next sweep passed 10/11. Driver sets its internal active target after the highlight animation, so a final onHighlighted refresh fixes the small edit-button overlap. Targeted cases 040, 043 and 044 then passed 3/3. All 11 unique affected browser examples have green evidence across these runs, not one clean 11-case sweep. Cases 043 and 044 extend the registry to 44 examples. Final browser and standalone production builds/type checks pass. Reviewed the settled HeroUI Back/Continue screenshot at /tmp/clipify-tour-hero-back.png; source lint is clean. Full merge coverage/owning-scenario gates remain pending.

## Remove duplicate filter onboarding

Filters belong only to Choose your clips in the first-overlay flow. Personalization now contains only Customize your look. Case 041 now checks the appearance-only section and its progress after reload. Older appearance.filters completions migrate to overlay.source; optional skips are discarded, and active filter/save checkpoints map to the corresponding core steps. Styling completion is retained.

Validation: all 16 affected suites / 419 tests passed, including saved-checkpoint compatibility. All four affected browser examples (018, 019, 041, 043) passed in one run, covering style save/defaults, no duplicate checklist task, persisted appearance progress and the canonical filter/Back flow. Browser production build/type checks, source lint and formatting pass. No schema change or generated migration is needed.

## Guided clip picker and observed playlist source

The clip task now follows Add Clips, search, full table/pagination selection, native confirmation, arrangement and save. Adding a valid selection advances automatically to arrangement without completing the task. Native Save remains authoritative. Guided modal controls stay in the owning React Aria focus scope, preserve grid/modal Tab behavior and scrolling, use side placement, and repair only the guide wrapper’s transient outside-modal inert state. The selection outline is inset so the modal’s scrolling does not clip it. Search uses secondary styling in both pickers; selection normalizes React Aria’s all token to actual page IDs.

Existing three-step arrangement/save checkpoints migrate to new indices. Closed modal checkpoints reopen through Add Clips; Back from search teaches Cancel before returning to entry. Section endings never launch another optional section.

Playlist-use observes the actual overlay type: selecting Playlist advances automatically, while a non-playlist type restores the source step without pausing. Invalid forward acknowledgement is disabled and guarded. Saved reads refresh the source observation from the owned overlay. The browser investigation also found a native editor crash from legacy preview clips missing creator fields during type changes; optional fields are normalized and stale preview responses are ignored.

Validation: the final complete affected run passed 16 suites / 428 tests; the targeted model/adapter/editor whole-file run passed 138 tests. All seven current owning Chromium examples (005, 020, 021, 022, 045, 046, 047) passed in one final run. Case 045 selects and saves 52 clips across pages; case 046 covers Back/cancel/reopen; case 047 covers automatic source advance and changing away without leaving the flow. The final outline-only visual rerun of 045 also passed, and its screenshot was inspected. Browser and standalone production builds/type checks, source lint and formatting pass. The push hook repeats the complete affected-suite check. Canonical browser registry: 47 examples. No database schema or generated migration changes.

## Welcome journey and Clipify Expert badge

The welcome offers Start guided tour and Maybe later while retaining the Pro trial message. Accounts without trial content receive one generic welcome. Decisions persist across reload and browser clearing; consent takes priority. Existing owned setup retains the minimized checklist. Starting teaches the first unfinished core task through native controls.

The server latches a durable, versioned completion timestamp only when every task across all four guide sections is completed. Skips do not qualify; optional sections are required for the Expert achievement while remaining optional for normal app use. Clipify Expert uses a graduation-cap icon in the existing automatic badge/member-card system and is retained during replay. A successful award acknowledgement shows one toast. The catalog adds one enum value; the post-merge migration workflow now watches catalog changes. Infisical development db:push applied the current schema; generated migrations remain untouched.

Affected validation covers 159 passing suites / 2329 tests across the complete affected run and final eight-case persistence rerun. Cold database setup exposed a five-second hook limit during pre-push; fixture setup/cleanup now use the existing database-suite convention of 35 seconds. Application assertion budgets and coverage thresholds are unchanged.

The final-source browser sweep passed 48/50 cases. The other two required browser setup corrections: await completed navigation in styling case 040, and clear consent local storage as well as cookies in welcome case 048. Both corrected cases passed in the targeted rerun on the same application build, so all 50 canonical browser behaviors are verified. Trial welcome and member-card badge screenshots were inspected. Both production builds/type checks, source lint and owned formatting pass. Full merge coverage/Test and final security gates remain pending.

## Limits and merge requirements

External OBS/website setup is instructional and self-reported. No new table or generated migration is introduced; the existing account content-state table stores the guide and earned timestamp. The catalog adds one badge enum value, with migration generation owned by the post-merge workflow. Server write failure keeps ordered retryable events and optimistic session state. Complete account persistence is verified after acknowledged writes.

Keep the PR draft pending the complete merge coverage/Test and dependency-security gates. The baseline audit reproduces the original three high advisories in follow-redirects and transitive zod. No dependency changes, accepted risk exception or release approval is claimed for this revision.

## Expert requires every guide

The Expert policy now requires all 11 tasks from the central journey catalog, including appearance, playlists, website tools and support. The server marks new awards with expertAwardVersion=2. Unversioned core-only timestamps are discarded; valid all-guide awards remain permanent through replay. Welcome, badge and toast copy describe the same requirement. The glyph is Tabler IconSchool (graduation cap). The badge slug and database enum are unchanged, so this refinement needs no schema push or generated migration.

The affected run passed 159 suites / 2333 tests with the existing one-suite/three-test skips. It covers each missing task, skipped-task rejection, previous award invalidation, the final task in a different section, account isolation and replay persistence.

Final verification: browser cases 048, 049 and revised 050 passed 3/3. The graduation-cap member-card screenshot was inspected. Browser and standalone production builds/type checks, affected-source lint, formatting and diff checks pass. No schema push is needed because the badge slug/enum is unchanged.

## Guided confirmations and honest Expert progress

A read-only development-state audit diagnosed the missing badge: eight completed tasks and three skips, while checklist checkboxes treated both as handled. The user clarified they had reset tasks for testing and may have skipped some. Historical skips are not rewritten because their originating action is unknown.

Explicit current/default confirmations now finish guides without changing native resource Save behavior. Manual Skip task remains excluded from Expert. The checklist labels skipped rows and shows the actual Expert completed/total count separately from section progress. Regression case 051 follows the exact eight-completed/three-skipped state through the three guided confirmations. Existing appearance/source cases now distinguish guide completion from a saved customization.

Final owning browser result: 051 passed, including the supported accessible skip description and the exact 8/11 → 11/11 award path. Combined with the six passing owning examples, all seven behaviors are verified. The final Expert-progress screenshot was inspected. The affected run passed 128 suites / 2013 tests; source lint, formatting, diff checks and browser production build/type checks pass. Account state was left untouched because historical skip origin is ambiguous.

Native playlist Save regression verified: active association now adopts the playlist actually saved on the matching guided overlay, even when the editor preselected a different playlist. Model/persistence tests include stale ID, wrong owner, other overlay and no-playlist cases. The affected run passed 128 suites / 2015 tests (one existing skipped suite, three skipped tests); owning browser cases 022, 047 and new 052 passed 3/3. Both production builds/type checks, lint, formatting and diff checks pass. No native selection/Save behavior or database schema changed. Development account state was inspected read-only and left untouched.

## Expanded discovery and full-CI coverage fix

The four new discovery tasks bring the catalog to 15 tasks across the same four sections. Runner, Settings, AI and Team/Editor guides use native tabs/menu entries and informational Done controls. No runner is created, no AI app is authorized, no settings are saved and no invitation is sent. Prior valid Expert awards remain permanent; new awards require all 15 tasks.

The four owning browser examples 053–056 and updated Expert examples 050–051 passed together (6/6). The broad affected run passed 158 suites / 2335 tests before the playlist coverage additions, with one pre-existing skipped suite and three skipped tests. Browser/standalone production builds and type checks pass.

The first ready-for-review full CI run passed every coverage producer and browser shard, but the final Test gate rejected playlist editor branch coverage of 83.94% against the existing 85% threshold. Added meaningful tests for native Select all across cache pages, middle/suffix category search and clearing the minimum-view filter. The playlist whole-file suite passes 48 tests; scoped coverage is now 187/218 branches (85.78%). Thresholds and CI gates are unchanged. Full CI must be rerun on the pushed source; the scoped collector is diagnostic evidence only.

The user explicitly requested not to merge yet. Keep the PR ready for full CI and user flow testing, with auto-merge disabled.
