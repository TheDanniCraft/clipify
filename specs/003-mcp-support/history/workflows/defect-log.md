# Defect log: MCP workflows

## Policy

Critical: authority/credential violations. High: core workflow blocked. Medium: secondary behavior. Low: polish. Unexpected failures get stable DEF IDs; no silent skips.

## Defects

No known implementation defects at planning. Sandbox execution requires authorized escalation because bwrap namespaces are disabled; this does not block isolated local work.

## Release impact

No-Go until mandatory evidence is executed. No accepted exceptions.

### DEF-004-001 — Native acceptance harness environment (Medium, resolved)

Bun react-server imports lack useEffect; compiled Node bundles placed under /tmp lacked dependency resolution. Use established builder with test-results/mcp-workflows/probes within checkout. Expected Red now reaches actual authenticated MCP handler. Commands and retained logs are in tdd/cycle-log.md. No product bypass.

### DEF-004-002 — Optional runtime metadata (Medium, verified)

A valid now-playing report without creator/thumbnail metadata was rejected. Optional metadata now defaults to null; runtime-state-green.log verifies the projection.

### DEF-004-003 — Revision schema integration (Medium, verified)

Early type gate found missing revision in default-settings output and two gallery builders, plus two non-module tests sharing a global clips name. The default-settings assertion was observed Red before adding revision=1; fixture builders now supply defaults and test files declare module scope. Schema/default tests passed and `test-results/mcp-workflows/typecheck.log` completed successfully.

### DEF-004-004 — Saved gallery dates on Free (High, verified)

The new MCP date adapter added absent keys as undefined, making the existing Free normalization treat them as explicit edits and clear saved Pro dates. gallery-paid-red.log reproduces the failure. Adapter now includes date keys only when explicitly supplied; scoped paid-field checks and the 53-case gallery acceptance run passed.

### DEF-004-005 — Queue ordering and cursor precision (Medium, verified)

Actual MCP queue-fifo-red.log reproduces UUID ordering placing a later queued clip first. Fix must order by queue insertion timestamp with a stable tie-breaker and preserve PostgreSQL microsecond precision across signed pagination.

FIFO Green evidence: `test-results/mcp-workflows/queue-fifo-green.log` verifies two pages across viewer/moderator queues separated by one PostgreSQL microsecond. Broader regression is in progress.

### DEF-004-006 — Legacy risk expectation integration (Medium, verified)

`mcp-compatibility.log`: 12 failures in tool-risk.test.ts, 792 other checks passed. The original risk assertion applies original tool semantics to new discovery/live-control tools. Retain all original fifteen assertions and enumerate independent risk profiles for all 34 new tools, including a catalogue coverage check; no production hints or thresholds weakened.

### DEF-004-007 — Native browser gallery entry imports (Medium, verified)

New browser-gallery-revisions native probe fails before the action because Node ESM cannot resolve extensionless next/cache. Add the installed next/cache.js alias to the established probe builder; this executes the real installed module and does not mock cache behavior. No browser production change until the intended behavioral Red is observed.

DEF-004-006 verification: `tool-risk-compatibility-green.log`, 51 checks passed across the full 49-tool catalogue, coverage completeness and unknown-tool rejection.

DEF-004-007 verification: installed Next baseline import and real work storage allow the action to execute; intended missing-revision and stale-overwrite failures are recorded in browser-gallery-revisions-red.log.

### DEF-004-008 — Concurrency fixture row lifetime (Low, verified)

The gallery-race fixture removes its initial gallery, so reading that former row revision failed before the quota assertion. Optional row projection fixes the fixture; retained `gallery-quota-race-fixture-failure.log`. Corrected intended Red in `gallery-quota-race-red.log` shows trusted session creation incorrectly required OAuth retry identity.

### DEF-004-009 — Native settings cookie scope (Low, verified)

The settings browser fixture reached verified headers but requireUser also reads cookies. Missing RequestCookies in native request storage prevented behavioral evidence. Supply the installed RequestCookies implementation as in existing native browser tests; original failure retained in browser-settings-fixture-failure.log.

DEF-004-009 verification: corrected fixture reaches intended missing revision=2 Red in browser-settings-revisions-red.log.

### DEF-004-010 — Native server navigation export (Medium, verified)

Runner browser action import loaded the client next/navigation export under react-server, causing createContext failure before behavior. Match installed Next compiler alias: next/dist/api/navigation.react-server.js. Original fixture failure retained in browser-runner-fixture-failure.log; no production action changes before intended Red.

DEF-004-010 verification: resolve the installed server API to concrete `next/dist/client/components/navigation.react-server.js`; native runner test reaches intended revision=1 versus required=2 Red.

### DEF-004-011 — Enrollment fixture required origin (Low, verified)

Native enrollment fixture omitted the schema-required api_base and failed before authorization. Supply the fixture loopback origin; original failure retained in runner-enrollment-fixture-failure.log. No production behavior changed before intended revision Red.

DEF-004-011 verification: corrected schema-valid fixture reaches intended missing runner revision Red in runner-enrollment-revision-red.log.

### DEF-012 — Strengthened BDD assertion input narrowing

Final TypeScript check found the generic BDD world input values were not narrowed to strings before indexing assertion maps. The runtime acceptance smoke passed, but static validation failed. Added explicit string narrowing; verified by `test-results/mcp-workflows/typecheck-final-fixed.log` (exit 0). Evidence: `test-results/mcp-workflows/typecheck-final.log`.

### DEF-013 — Workflow suites bypassed database capacity lane

The actual-runner test reproduced three workflow workers despite a one-worker PostgreSQL budget. Added workflow suites to the existing database lane, which also provides compile-once native probes. Red: `test-results/mcp-workflows/workflow-scheduler-red.log`; Green: `test-results/mcp-workflows/workflow-scheduler-green.log` (both actual-runner cases passed).

### DEF-014 — Gallery editor expected legacy save signature

Full regression found the existing gallery UI assertion expected two save arguments; the editor correctly sends the observed revision as its third argument to prevent stale browser overwrites. Updated the assertion to require revision 1 while preserving the content/publication expectations. Red: `test-results/mcp-workflows/coverage-final.log`, GalleryEditor save case; verified by `gallery-editor-compatibility-green.log`, all 8 editor tests passed.

### DEF-015 — OAuth negative case used newly supported explicit scope

Full actual-provider regression correctly accepted registration requesting `overlay-secret:read`, now an explicitly consented supported scope for private OBS source retrieval. Replaced the negative example with unsupported `runner-credential:read`; no provider or consent enforcement was weakened. Red: `coverage-final.log`, OAuth invalid-registration case. Verified by `oauth-registration-compatibility-green.log` (5 selected cases passed) and `discovery-contract-compatibility-green.log` (25 cases passed). Updated original BDD unsupported-scope example as well.

### DEF-016 — Preview boundary confused activity with resource writes

The Free-quota characterization assumed a successful read preview creates no audit event. Actual MCP read activity correctly records one event. Added actual playlist revision readback and require unchanged count/revision alongside the expected read activity event. Product logic unchanged. Red: `additional-boundaries-jest.log`; verified by `jest-delta.log`, all 9 discovery-boundaries tests passed.

### DEF-017 — Official SDK expected the original 15-tool catalogue

Both real SDK transport modes successfully read/edit/enforce quota/revoke, but the legacy assertion expected 15 registered tools. Require the new exact count 49, preserving all mutation, quota and revocation assertions. Red: `coverage-final.log`, client-profiles suite. Verified: `client-profiles-compatibility-green.log`, all 6 cases passed.

### DEF-018 — Native tool discovery expected only the original tools

The shared discovery catalogue fixture executed its original 15 result checks correctly but expected discovery to contain only those 15 names. Require all 49 explicitly enumerated supported definitions, preserving credential exclusion and the original result/risk assertions. Red: `coverage-final.log`, tool-results-catalogue suite. Verified: `tool-results-compatibility-green.log`, all 36 cases passed.

### DEF-019 — Live-preview fixture SQL string quoting

Formatter rejected nested quote delimiters in the new controlled-cache fixture before test execution. Corrected the TypeScript SQL literal delimiter. Product code unchanged. Evidence: `format-product-options.log`; Verified by `format-final-corrections.log` and `typecheck-delta.log`.

### DEF-020 — Stream configuration audit selected the overlay ID

Actual-handler evidence reproduced stream-session configuration audit target_id equaling its overlay ID because a generic selector precedence chose overlay before session. Select the session ID (or new returned session ID) for stream-session tools. Red: `configure-audit-target-red.log`; verified by `configure-audit-target-green.log` (4 cases), `bdd-delta.log` and `bdd-options-corrected.log` for existing/new session configuration.

### DEF-021 — Duplicate IDs within one provider page escaped validation

Fresh provider-boundary TDD and actual MCP BDD reproduced a provider page with two equal clip IDs being accepted. The pre-page seen check only covered earlier pages. Check the shared seen set while adding each row so within-page duplicates fail as SERVICE_UNAVAILABLE. Red: `provider-boundaries.log` and `provider-duplicate-bdd-red.log`; verified by `provider-boundaries-green.log` (15 unit cases) and `bdd-delta.log`, boundaries provider-duplicate example.

### DEF-022 — Legacy onboarding subprocess used client module conditions

A disposable loopback fixture unblocked the 11 pre-existing skipped auth integration cases: 10 passed, but the real OAuth-user creation subprocess imported server-only modules under Bun client conditions. Moved that invocation to the existing compile-once real Node server probe mechanism, retaining Better Auth internalAdapter and database trigger assertions. Initial evidence: `auth-legacy-fixture.log`. No production authentication was replaced. Verified: `auth-legacy-fixture-green.log`, all 11 tests passed without skips using synthetic encrypted credentials and a disposable loopback schema.

### DEF-023 — Gallery option assertion ignored contrast normalization

The actual MCP paid-option sequence set both card and text colours to `#123456`. The shared gallery normalizer correctly changed the text to white for contrast, but the new assertion expected the requested value verbatim. Retained failing evidence: `bdd-delta.log`, options Example #1. Correct the specific expected normalized text colour to `#FFFFFF`, retaining exact values and revisions for all 19 options. Production code unchanged; verified by `bdd-options-corrected.log`, all 5 corrected cases passed.

### DEF-024 — Existing-page fixture used a nonexistent SQL table

Four new Creator Page option examples failed during fixture setup because the handwritten insert named `settings`; the schema table is `"userSettings"`. Correct the test fixture identifier, retaining the actual database schema and all ownership/settings assertions. Evidence: `bdd-delta.log`, options Examples #18, #19, #21, #22. Production code unchanged; verified by `bdd-options-corrected.log`, all 5 corrected cases passed.

### DEF-025 — Retry characterization assumed audit deduplication

The new creation replay check correctly received the identical gallery response but expected one activity event. The workflow records each successful agent call, including a replay, so two events are expected. Require the identical response and both events; production retry behavior unchanged. Evidence: `jest-delta.log`, plan-boundaries creation replay. Verified: `plan-boundaries-green.log`, all 3 cases passed.

### DEF-026 — Expired retry fixture violated minimum retention

The new expiry characterization changed only expires_at, violating the actual minimum 24-hour retention constraint. Model a genuinely old retry by moving created_at 25 hours back alongside the past expiry. Production retention constraint unchanged. Evidence: `last-boundaries.log`, ordering-retry expiry case. Verified: `retry-expiry-green.log`, selected case passed; the two other cases passed in `last-boundaries.log`.
