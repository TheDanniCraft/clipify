# Red-green-refactor journal

Raw logs retained under test-results/mcp-workflows. Entries added immediately after observed executions.

## Foundation catalogue

Before-production Red: `test-results/mcp-workflows/catalogue-red.log`, 40 expected missing-tool/scope/risk failures. Green: `catalogue-green.log`, 40 passed.

## Runtime store and read tool

Expected pre-production Red: `runtime-state-red.log` (three missing-function assertions) and `runtime-red.log` (actual OAuth/MCP response lacked requested structured content). Initial Bun and out-of-tree Node harness attempts were invalid environment failures, tracked as DEF-004-001; compiled Node probes inside test-results resolve them.

Runtime: actual HTTP read Green in runtime-green.log; optional metadata test initially exposed missing-null handling (DEF-004-002), corrected and all three state tests Green in runtime-state-green.log. Queue read: queues-red.log then queues-green.log (2 actual handler tests passed). Playback command Red: control-red.log, all nine command options plus offline failed before dispatch implementation.

Remote dispatch: control-green.log, all 10 command/offline cases passed. Twitch references: clip-references-red.log (9 intended missing resolver failures) -> clip-references-green.log (9 passed). Enqueue: enqueue-red.log -> enqueue-green.log. Clear queues: clear-queue-red.log (3 requested queues) -> clear-queue-green.log (3 passed). Full remote BDD/ATDD: remote-bdd.log, 39 passed using automatic DB/system worker budget in 1.5 minutes.

Discovery filter: discovery-filter-red.log (seven missing-filter assertions) -> discovery-filter-green.log (7 passed). Search: search-red.log -> search-green.log (real OAuth/MCP category/date workflow plus seven filtering cases). Resolve link: resolve-red.log -> resolve-green.log.

Import selection tokens: import-selection-red.log (6 intended missing implementation failures) -> import-selection-green.log (6 passed). Preview: import-preview-red.log -> import-preview-green.log. Commit: import-commit-red.log -> import-commit-green.log. Exact replay/tamper/stale-revision: import-invariants.log, 3 passed. Discovery BDD/ATDD: discovery-bdd.log, 25 passed in 1.0 minute. Shared schema revision/mode contracts: revision-schema-red.log -> revision-schema-green.log, 6 passed; no generated migrations. Gallery list and detail: gallery-list-red/green.log and gallery-get-red/green.log. Browser defaults require the new revision: settings-default-red.log observed missing value before the source fix.

TDD-US3-007 `get_gallery_embed`: actual missing-tool Red `test-results/mcp-workflows/get_gallery_embed-red.log` before adapter; Green `test-results/mcp-workflows/get_gallery_embed-green.log` after implementation.

TDD-US3-008 `get_gallery_preview`: actual missing-tool Red `test-results/mcp-workflows/get_gallery_preview-red.log` before adapter; Green `test-results/mcp-workflows/get_gallery_preview-green.log` after implementation.

TDD-US3-009 `get_overlay_embed`: actual missing-tool Red `test-results/mcp-workflows/get_overlay_embed-red.log` before adapter; Green `test-results/mcp-workflows/get_overlay_embed-green.log` after implementation.

TDD-US3-010 `get_player_embed`: actual missing-tool Red `test-results/mcp-workflows/get_player_embed-red.log` before adapter; Green `test-results/mcp-workflows/get_player_embed-green.log` after implementation.

TDD-US4-001 `get_creator_page`: actual missing-tool Red `test-results/mcp-workflows/get_creator_page-red.log` before adapter; Green `test-results/mcp-workflows/get_creator_page-green.log` after implementation.

TDD-US4-002 `update_creator_page`: actual missing-tool Red `test-results/mcp-workflows/update_creator_page-red.log` before adapter; Green `test-results/mcp-workflows/update_creator_page-green.log` after implementation.

TDD-US4-003 `publish_creator_page`: actual missing-tool Red `test-results/mcp-workflows/publish_creator_page-red.log` before adapter; Green `test-results/mcp-workflows/publish_creator_page-green.log` after implementation.

TDD-US5-001 `get_runner_setup`: actual missing-tool Red `test-results/mcp-workflows/get_runner_setup-red.log` before adapter; Green `test-results/mcp-workflows/get_runner_setup-green.log` after implementation.

TDD-US5-002 `list_runners`: actual missing-tool Red `test-results/mcp-workflows/list_runners-red.log` before adapter; Green `test-results/mcp-workflows/list_runners-green.log` after implementation.

TDD-US5-003 `get_runner`: actual missing-tool Red `test-results/mcp-workflows/get_runner-red.log` before adapter; Green `test-results/mcp-workflows/get_runner-green.log` after implementation.

TDD-US5-004 `create_runner`: actual missing-tool Red `test-results/mcp-workflows/create_runner-red.log` before adapter; Green `test-results/mcp-workflows/create_runner-green.log` after implementation.

TDD-US5-005 `update_runner`: actual missing-tool Red `test-results/mcp-workflows/update_runner-red.log` before adapter; Green `test-results/mcp-workflows/update_runner-green.log` after implementation.

TDD-US5-006 `delete_runner`: actual missing-tool Red `test-results/mcp-workflows/delete_runner-red.log` before adapter; Green `test-results/mcp-workflows/delete_runner-green.log` after implementation.

TDD-US5-007 `unlink_runner`: actual missing-tool Red `test-results/mcp-workflows/unlink_runner-red.log` before adapter; Green `test-results/mcp-workflows/unlink_runner-green.log` after implementation.

TDD-US5-008 `list_stream_sessions`: actual missing-tool Red `test-results/mcp-workflows/list_stream_sessions-red.log` before adapter; Green `test-results/mcp-workflows/list_stream_sessions-green.log` after implementation.

TDD-US5-009 `get_stream_session`: actual missing-tool Red `test-results/mcp-workflows/get_stream_session-red.log` before adapter; Green `test-results/mcp-workflows/get_stream_session-green.log` after implementation.

TDD-US5-010 `configure_stream_session`: actual missing-tool Red `test-results/mcp-workflows/configure_stream_session-red.log` before adapter; Green `test-results/mcp-workflows/configure_stream_session-green.log` after implementation.

TDD-US5-011 `control_stream_session`: actual missing-tool Red `test-results/mcp-workflows/control_stream_session-red.log` before adapter; Green `test-results/mcp-workflows/control_stream_session-green.log` after implementation.

TDD-US5-012 `get_runner_snapshot`: actual missing-tool Red `test-results/mcp-workflows/get_runner_snapshot-red.log` before adapter; Green `test-results/mcp-workflows/get_runner_snapshot-green.log` after implementation.

Workflow consent presets: intended missing gallery/runner scope Red in `test-results/mcp-workflows/consent-presets-red.log`; five preset/selection checks Green in `test-results/mcp-workflows/consent-presets-green.log`. Consequential controls, secret reads, credential rotation, deletion and gallery publication remain explicit selections.

Consent labels: intended missing accessible-name Red in `test-results/mcp-workflows/consent-labels-red.log`; five component cases Green in `test-results/mcp-workflows/consent-labels-green.log`. Existing HeroUI/HeroUI Pro form retained.

FIFO queue cursor: intended wrong-first-clip Red in `test-results/mcp-workflows/queue-fifo-red.log`; correct chronological pages with microsecond precision Green in `test-results/mcp-workflows/queue-fifo-green.log`.

Capability extension: intended missing gallery quota/feature denial Red in `test-results/mcp-workflows/capabilities-red.log`; both actual-MCP entitlement cases Green in `test-results/mcp-workflows/capabilities-green.log`.

Affected workflow regression: 127 tests / 12 suites passed in `test-results/mcp-workflows/workflow-regression.log`; subsequent capability-only suite passed two cases. Type gate after FIFO/capabilities passed in `test-results/mcp-workflows/typecheck-after-fifo.log`.

Audit target projection: three actual-read target-type/ID mismatches Red in `activity-targets-red.log`; all three Green in `activity-targets-green.log` after adding gallery/runner/session selectors to the shared MCP audit wrapper.

Browser gallery edits: intended unchanged revision/stale overwrite Red in `browser-gallery-revisions-red.log`; native plus existing gallery action tests 29 Green in `browser-gallery-revisions-green.log`. Gallery editor supplies its observed revision; atomic version predicate prevents stale browser overwrites.

Shared gallery creation: corrected intended session-authentication Red in `gallery-quota-race-red.log`; shared browser/principal quota plus gallery regressions 30 Green in `gallery-quota-race-green.log`. Both creation paths use one advisory quota lock. Trusted session operations do not retain OAuth retry records; OAuth identity-bound retries remain unchanged.

Linked gallery revisions: intended unchanged revision Red in `linked-gallery-revision-red.log`; 12 browser-gallery/deletion checks Green in `linked-gallery-revision-green.log`.

Browser settings revision: intended unchanged revision Red in `browser-settings-revisions-red.log`; 11 native/settings checks Green in `browser-settings-revisions-green.log`. Stale overwrite then observed Red in `browser-settings-stale-red.log`; 12 checks Green in `browser-settings-stale-green.log` after an atomic conflict-update predicate. Settings UI adopts the returned revision.

Browser runner configuration: intended unchanged session revision Red in `browser-runner-configure-red.log`; native and existing runner action checks Green in `browser-runner-configure-green.log`. Stale edit Red is retained in `browser-runner-stale-red.log`; its Green verification is running.

Browser runner integration: configure/stale, control/stale, unlink, auto-naming and enrollment cycles have retained intended Red and Green logs under test-results/mcp-workflows with matching operation prefixes. Native runner-control suite passed four cases; subsequent unlink/naming/enrollment scopes passed.

Entitlement shutdown: intended unchanged revision Red in runner-suspension-revision-red.log; native plus existing suspension assertions Green in runner-suspension-revision-green.log. Last device-reported actual state is retained. Expired-access heartbeat Red in runner-heartbeat-expiry-red.log; Green in runner-heartbeat-expiry-green.log. Repeated shutdown requests do not advance the version again.

Deleted resource retry: three actual MCP create/delete/replay cases Red in retry-liveness-red.log, all three Green in retry-liveness-green.log. Readable activity labels: four missing-label Red assertions in activity-labels-red.log, all 21 activity component cases Green in activity-labels-green.log.

## Workflow database scheduler

Actual Jest runner fixture reproduced missing workflow classification: expected one database worker, observed three ordinary workers. Added workflows to existing database classification after retained Red (`workflow-scheduler-red.log`). Green: `test-results/mcp-workflows/workflow-scheduler-green.log`, 2 actual-runner tests passed.

## Additional verification checkpoint

Existing implemented input boundaries: `input-boundaries.log`, 28 passing characterization cases. Additional OAuth consent scopes: `secondary-scopes.log`, 3 passing actual-handler cases. These checks extend verification and do not claim retrospective test-first chronology. Strengthened positive BDD outcome assertions: `bdd-outcome-smoke.log`, 39 passing cases. Types: `typecheck-final-fixed.log`; lint: `lint-final.log`; production build: `build-final.log`; server-action manifest: `action-manifest-final.log`; migration policy: `migration-policy-final.log`, all exit 0.

## Stream configuration audit identity

`configure-audit-target-red.log` reproduced the wrong resource identity through actual MCP SQL/audit readback before production changes. Updated session-tool target selection to prefer sessionId and use the returned ID for creation. Verified: `configure-audit-target-green.log`, all 4 cases passed.

## Duplicate provider clips

Provider TDD and actual owning BDD showed a duplicate-ID page succeeded, contrary to the malformed-provider contract (`provider-boundaries.log`, `provider-duplicate-bdd-red.log`). Added the within-page duplicate guard only after both retained Red executions. Verified: `provider-boundaries-green.log` (15 unit cases) and `bdd-delta.log` duplicate-provider example.
