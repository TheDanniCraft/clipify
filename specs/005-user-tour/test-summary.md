# Test Summary: User tours UX revision

The revision follows the latest user feedback: first-use checklist visibility, corner progress launcher, HeroUI controls, manual skip/undo, direct task resume, completed-task handoffs and unchanged domain Save controls. Real controls now own style navigation; source and filters are separate steps; the copy target is the actual button. Optional public website installation and gallery/tools/support introductions extend the catalog to five sections. 24/7 stays deferred.

## Current validation

- Affected suites: 17 suites / 448 tests passed, without coverage.
- Final browser sweep: all 32 scenarios passed in one complete run (5.5 minutes, two workers), with a separate disposable database and server for each case. This supersedes the earlier 27/32 run.
- Visual review: desktop and 360×640 mobile; visible HeroUI checkboxes, corner progress launcher, separate feedback/chat targets, scrollable panel and real action anchors.
- Full lint: zero errors, five existing warnings. Feature-owned formatting and diff checks pass.
- TypeScript, E2E build and standalone production build pass. Build-time fixture database refusal logs do not indicate a production connection.

Current browser output is in test-results/browser and playwright-report. The previous complete revised sweep is preserved under test-results/user-tour/revision-sweep. No full coverage result is inferred from browser completion.

## Limits and merge requirements

Progress and skips are per account in this browser. OBS and website installation are instructional/self-reported; copying alone does not verify installation. No schema or generated migrations were changed. Existing plan permissions and consent choices remain authoritative.

Keep the PR draft until the required complete coverage/Test gate passes and the existing dependency advisories are resolved or explicitly accepted. The baseline audit found the same three high advisories in the original lockfile; this revision changes no dependencies. No risk exception or release approval is claimed.

See [traceability](test-traceability.md), [cycle log](tdd/cycle-log.md) and [defects](defect-log.md).
