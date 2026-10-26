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

## Limits and merge requirements

External OBS/website setup is instructional and self-reported. No schema or generated migrations changed; the existing account content-state table stores the guide. Server write failure keeps ordered retryable events and optimistic session state. Complete account persistence is verified after acknowledged writes.

Keep the PR draft pending the complete merge coverage/Test and dependency-security gates. The baseline audit reproduces the original three high advisories in follow-redirects and transitive zod. No dependency changes, accepted risk exception or release approval is claimed for this revision.
