# Test Summary Report: Creator Library and Export

Feature: [spec.md](spec.md). Updated2026-11-03. Branch: `features/clip-export`. PR: [546](https://github.com/TheDanniCraft/clipify/pull/546).

## Delivery state

The feature provides Home clip metrics, available stream lists/details, a searchable clip inventory, authorized previews and bounded manual ZIP export. The rejected dashboard was audited against actual authenticated Mobbin references and the pinned Payload Bay sidebar. Search and utilities now belong to the sidebar; content uses consistent theme surfaces/gutters, compact filters and readable mobile metadata. Exact search results open the selected clip, and export/reconnect/retry/cancellation preserve selection. Existing editors and guide navigation remain in scope.

No schema or generated migration changed. Dependency overrides patch follow-redirects and transitive Zod. Automated publishing remains outside this manual-export feature.

Current recommendation: local validation complete; publication and required ready-for-review CI remain pending. The old draft preview and its passing CI do not validate these unpushed corrections. No merge or production release is authorized.

## Correction checkpoint evidence

- Production browser build and installed-dependency patch validation passed: `/tmp/clipify-ui-guide-layer-build.log`.
- All11 affected component files passed164 assertions: `/tmp/clipify-ui-complete-units.log`. Subsequent whole-file checks for the final guide/empty-state/navigation refinements passed73 assertions: `/tmp/clipify-ui-polish-unit.log`. These overlapping runs are not added together.
- Guide clipping correction passed56 provider/spotlight/portal assertions, including an observed failing portal-boundary assertion before the fix. Home’s active-mobile-guide tests pass12 assertions in their whole file.
- Feedback lifecycle intended Red and complete Green are recorded in [tdd/cycle-log.md](tdd/cycle-log.md). Exact preview identity/retry/late-result handling, utility portal movement and dashboard chat behavior have dedicated tests.
- The current acceptance owner passed38/38: `/tmp/clipify-ui-resume-acceptance.log` (7.6minutes). This includes eight light/dark responsive layouts,27 recovery cases and three existing editor/guard cases. Subsequent guide corrections move the expanded panel outside sidebar clipping and retain launcher interaction above the active tour overlay. All61 guide scenarios and11 layout/editor cases passed in `/tmp/clipify-ui-guide-layer-browser.log`; its two failures came from the stream test’s now-corrected assumption that the checklist was expanded on resource pages. The final core checkpoint passed all25 inventory scenarios in `/tmp/clipify-ui-inventory-final.log` (4.7minutes), with23 remaining core cases passing in `/tmp/clipify-ui-core-final.log`. The inventory rerun replaces its two transient interaction/locator failures; counts are not added across overlapping runs. Screenshots disable transitions to capture settled controls.
- The maximum-package browser checkpoint downloaded four complete32MiB MP4 files in a134221695-byte archive, with an accurate manifest. Observed download/inspection time:2287ms. Maximum sampled Chromium backing storage:271080416 bytes; JS used heap:29296500 bytes; embedder heap:10599536 bytes. These maxima are sampled metrics, not simultaneous whole-process RSS or a concurrency benchmark. Raw evidence is retained in the browser report and ignored dashboard audit artifacts.
- Final lint passed with zero errors and nine existing warnings: `/tmp/clipify-ui-final-lint.log`. Build typechecking passed. Migration policy passed13/13: `/tmp/clipify-ui-final-migration.log`.
- PR-owned formatting passed: `/tmp/clipify-ui-owned-format-final.log`. The default local formatter also discovers unrelated untracked private attachments; those files are excluded from this PR and left untouched. CI checks committed changes.
- Current-source Jest coverage covers the new preview and utility portal at100% statements/branches/functions/lines. Home:100% lines/statements/functions and91.3% branches; sidebar:99.13% lines and94.69% branches. The complete aggregate gate passed without changing any threshold.
- High/critical dependency audit passed: `/tmp/clipify-ui-audit.log`. Five findings below the configured severity remain outside that pass; no audit policy was weakened.

## Complete published-checkpoint coverage (8bf1654f)

`/tmp/clipify-ui-full-coverage.log` exited0:597 Jest suites and6668 tests passed, with one inherited skipped suite/three skipped tests;549 instrumented workflows and five serial media workflows passed. All existing global, critical and ordinary source thresholds passed. Before/after execution-input fingerprint: `ffb849db69679c21ae96d20f45f4b2df34fa79911120d52ff155f62a9055893e`. No earlier source's coverage report was reused. That fingerprint matched committed8bf1654f. Subsequent UI-017 changes have their own affected coverage and require a new full CI gate; this report is not reused as coverage of those changes.

## Earlier implementation baseline

Commit1219de42 passed complete application coverage:595 Jest suites /6657 tests,549 instrumented workflows and five serial media workflows, with all unchanged global/source-specific thresholds. Three inherited skipped tests remained. Its browser acceptance passed32/32 and core/guide BDD109/109; draft CI passed. This is historical evidence only, not coverage of the corrections above.

Ownership, exact-provider-ID and actual-byte spot mutants were killed and restored whole files passed during that baseline. Server maximum-package sampling included128MiB media with a426913792-byte RSS increase. Neither those spot mutants nor the two memory samples establish exhaustive mutation coverage or concurrent service capacity.

## Traceability and limits

The original181-example planning matrix and612 atomic tasks retain historical provenance. Current executable owners are mapped in [test-traceability.md](test-traceability.md); the customer-preview correction checklist is appended to tasks.md. Several characterizations followed production code. GOV-001 therefore records a historical test-first ordering deviation that later Green tests cannot erase. No claim of perfect historical TDD compliance or blanket completion of all original atomic rows is made.

Required full GitHub validation is separate from draft CI and local execution. Local browser fixtures use disposable loopback PostgreSQL18; CI owns PostgreSQL16 browser validation. Native Runner process/capture/update and real Windows checks are outside this web change. The browser reports download initiation, not completion of the user's save-to-disk operation. Live Twitch account authorization and production concurrency are not simulated as customer load evidence.

## Visual evidence

[design-review.md](design-review.md) links eight inspected Mobbin references and maps all audit findings to corrections. The rejected baseline/reference board is `test-results/dashboard-audit/audit.html`; new captures are preserved under `test-results/dashboard-audit/final-layouts/`. Home, Inventory, filters, populated selection, stream lists/details, drawer and collapsed rail were inspected in light/dark at390px,820px,1024px and1440px. Real interactions and error recovery supplement screenshot inspection; neither screenshots nor mocked tests alone establish UX acceptance.

## Ready-for-review CI follow-up

PR546 is published and ready for review. Its customer preview is https://beta-546.clipify.cloud.thedannicraft.de/dashboard. Initial full CI run41698287110 found the UI-017 hydration defect and FIXTURE-018 obsolete navigation in older browser owners. These are recorded in defect-log.md; a live preview and passing draft checks do not override a failed full gate.

The corrected production build and typecheck passed (`/tmp/clipify-ui-hydration-build.log`). Affected component coverage passed58 tests: portal/preview100% throughout; sidebar99.14% lines/94.69% branches; navigation100% lines/93.33% branches. Existing global and ordinary-source thresholds are unchanged. Complete ATDD passed22/22, including immediate agency input and an explicit no-hydration-error assertion. Updated resource, guide and acceptance browser checkpoints and the next required full CI gate are tracked separately.

Final affected coverage includes the guide provider, spotlight, progress reducer and persisted-progress integration owner:205 tests/13 suites passed with unchanged thresholds (`/tmp/clipify-ui-hydration-affected-final.log`). The broader local rerun discovered the mounted-host test fixture correction and is not treated as a clean full gate for the final source. The required published CI run must establish that gate. Actual pointer playlist dragging passed12/12 over three complete feature repetitions; this replaces synthetic drag dispatch while keeping persisted-order assertions.

Final production-browser checkpoint:74/74 passed in `/tmp/clipify-ui-hydration-final-browser.log`:61 guide cases, eight light/dark responsive layouts, two filtered bulk cases, two account-verification cases and the color-picker case. The account/color assertions retain their empty browser-error requirements. Fresh screenshots were inspected at390px,820px and1440px and preserved in `test-results/dashboard-audit/hydration-layouts/`; the complete report is in `test-results/dashboard-audit/hydration-report/`. The resource suite has a separate final checkpoint to avoid crediting the earlier mixed run as wholly green.

Final resource checkpoint:23/23 passed in `/tmp/clipify-ui-resource-final.log` (2.6minutes), covering overlay create-failure/retry, filtered and partial bulk operations, playlist revisions/deletion/actual dragging, SDK approval/edit/revoke and Runner onboarding. This is the clean complete owner run following the intermediate fixture corrections. All full CI failures from41698287110 have a passing local owning checkpoint; the next published full gate remains required.
