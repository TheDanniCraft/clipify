# Implementation Plan: MCP Support

> Consolidated MCP server scope: 66 tools on `feature/mcp-support`. The original foundation, workflow expansion, feedback and focused editing tools belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

**Branch**: `feature/mcp-support` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: `specs/003-mcp-support/spec.md`. Setup resolved this directory through `.specify/feature.json`; its BRANCH output used the feature-directory label. Git reports `feature/mcp-support`, which remains the actual branch.

## Summary

Expose Clipify’s creator discovery, capabilities, overlay and playlist operations through an authenticated remote MCP endpoint. Reuse Better Auth for OAuth, and move browser mutations into shared backend services so scopes, creator/team/agency permissions, current owner entitlements, quotas and revision checks apply consistently. Consent selects multiple creators and individual permissions using Read / Read & edit presets; delete is a separate opt-in. Validate real ChatGPT web, Claude web, Codex CLI and independently registered custom client workflows before release.

## Technical Context

**Language/Version**: TypeScript 6.0.3; Next.js 16.3.6 / React 19.3.0; Bun package manager and test command runner; Node application runtime.

**Primary Dependencies**: Better Auth 1.7.7, Drizzle 0.45.3, pg 8.23.1 and Zod 4.6.5. Add exact matching `@better-auth/mcp` and `@better-auth/cimd` 1.7.7 if published peer metadata confirms compatibility. Add official `@modelcontextprotocol/server` v2 and dev-only `@modelcontextprotocol/client` v2 at the same verified published stable patch, pinned by lockfile. Registry publication and peer resolution must be checked before installation; source HEAD versions alone are not a publication guarantee. No dependencies installed during planning.

**Storage**: Existing PostgreSQL and Drizzle; provider-managed OAuth/JWKS tables plus Clipify grant/creator selection, retry records and resource revision fields. Reuse existing audit and database rate-limit tables.

**Testing**: Jest 30, existing Jest setup/PGlite fixtures, Playwright Chromium + playwright-bdd, SDK client and controlled OAuth fixtures. Real PostgreSQL 16 CI loopback service for independent-connection concurrency proofs. fast-check for permission/quota invariants when valuable.

**Target Platform**: Existing hosted Next.js Node deployment with Web Request/Response route at `/mcp`, HTTPS externally and loopback HTTP in tests. No new service or transport-session store.

**Project Type**: Existing web application with an additional authenticated integration interface.

**Performance Goals**: Controlled warmed run, 20 concurrent independent creator requests: p95 read response <=1 second and mutation <=2 seconds excluding Twitch/vendor latency; same-creator quota calls serialize correctly. Set dependency timeout to 10 seconds and return a safe error; request cancellation must release database work.

**Constraints**: Immediate grant revocation for subsequent calls; no secrets in tool results; no production credentials in tests; no generated migrations on this branch. Rate limiting must not mask the 20-request quota proof. All twelve stale-edit interface/resource combinations are mandatory.

**Scale/Scope**: 18 FRs, 5 success criteria, 21 edge cases and four user stories; stateless protocol on horizontally replicated Node instances with shared PostgreSQL enforcement. Initial lists default 25 records and max 100, opaque cursor pagination; input JSON max 256 KiB, names max existing 120 characters; playlist item limits follow current backend product rules. Enforce fixed registration 10/minute/network and 100/day/network, calls 120/minute/actor+client and 600/minute/network; application constants cannot be changed through environment values. Remove never-consented registrations after 24 hours and expired retries after >=24 hours; retain redacted activity under the existing privacy retention policy.

## Constitution Check

_GATE: reviewed before research and after design; design satisfies each rule below. Passing design review does not mean implementation tests have run._

- Test first: every production behavior begins with a recorded intended failing test; [test-traceability.md](test-traceability.md) carries all specification cases and added security boundaries.
- Observable behavior and stakeholder acceptance: all US1–US4 require BDD and ATDD. BDD owns scenarios and bindings; shared scenarios provide both roles, without parallel duplicate ATDD artifacts.
- Isolation: Jest uses existing setup and controlled PGlite fixtures; database concurrency and real HTTP cases use only local disposable PostgreSQL in CI. Real vendor acceptance uses purpose-created nonproduction creators and explicit human account setup, never CI production credentials.
- Traceability: preserve published scenario/test IDs; registry owns command/status/evidence fields; coverage map and matrix reference artifacts without copied execution states.
- Reviewable changes: one service boundary, no alternative MCP-specific commercial policy, no new microservice. Exact dependencies and schema changes are justified below.
- Migration ownership: edit schema sources only; no `drizzle-kit generate`, `db:generate`, generated `drizzle/` edits or guard overrides. CI uses its existing strictly guarded `db:push:e2e`; development push only disposable Infisical dev.
- Gates: no weakening existing coverage/lint/type/build/migration guards; scoped exceptions require user approval, scope, rationale, compensating evidence and expiry.

## Project Structure

### Documentation (this feature)

```text
specs/003-mcp-support/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/oauth.md
  contracts/tools.md
  contracts/backend.md
  test-traceability.md
  defect-log.md
  test-summary.md
  checklists/requirements.md
  tasks.md                 # generated later by speckit-tasks
```

### Source Code (repository root)

```text
src/auth/config.ts                       # provider plugins and JWT signing
src/auth/authorize-operation.ts          # explicit verified principal + session adapter
src/auth/mcp-principal.ts                # verified token -> live grant principal
src/server/resources/{overlays,playlists}.ts
src/server/resources/{quota,revision,errors}.ts
src/server/mcp/{server,tools,schemas,grants,retries,activity}.ts
src/app/mcp/route.ts                      # Node route; authenticated protocol boundary
src/app/.well-known/                      # discovery aliases to provider handlers
src/app/auth/mcp/consent/page.tsx
src/app/dashboard/settings/              # connected apps and activity controls
src/app/actions/database.ts              # thin authenticated browser adapters
src/db/{schema,auth-schema}.ts
scripts/check-mcp-coverage.mjs            # meaningful changed-file coverage gate
```

**Structure Decision**: Follow current `src/auth`, `src/server`, App Router and `test/` conventions. Read the installed Next.js route/server-function guides before implementation. Browser callers carry last-read revision; audit every existing action/copy/import/playlist-item path and indirect resource writer. Keep owner/team/agency resolution in one evaluator; OAuth identity must never be forged into a browser cookie session.

## Complexity Tracking

No constitution violations or exceptions. Additional tables are needed for creator-set consent and immediate token revocation, retry deduplication and durable metadata; provider OAuth tables remain provider-owned. A per-creator database row lock is necessary because count+insert and local mutexes cannot enforce a global limit across instances. Integer revisions are required because existing updatedAt fields are neither universally advanced nor reliable lost-update tokens.

## Architecture and Implementation Sequence

1. Lock down existing behavior with tests, extract a principal-based authorization evaluator and shared creator resource services. Preserve the current session wrapper and existing browser return contracts while translating structured errors into actionable browser feedback.
2. Lock the creator’s stable account row before creator quota operations, resolve current owner plan through the transaction, count and insert in that transaction. Route every supported creation path through the boundary. Use the same lock order for deletion, entitlement changes and reconciliation where their interaction affects quotas. Never lock a nonexistent overlay as the sole quota guard.
3. Add overlay and playlist integer revisions. Conditional compare-and-update/deletion where applicable must be atomic; playlist items lock/advance the parent revision. Every direct/indirect writer advances revisions, including playlist deletion detaching overlay references. Update browser data types, autosave, theme, table status, playlist rename/item callers; a conflict stops autosave and offers reload, rather than automatically overwriting with stale values.
4. Add provider auth/JWKS schema through supported Better Auth schema generation to `src/db/auth-schema.ts` only, inspect the diff, and preserve existing organization/passkey/OAuth proxy behavior. Configure JWT + `mcp()` + `cimd()`; do not also register `oauthProvider()`. Enable DCR and unauthenticated registration explicitly. Add canonical well-known aliases; issuer is the actual auth base URL, resource is canonical `https://clipify.us/mcp`.
5. Build server-owned consent state tied to OAuth client, authenticated user and authorization request. Validate CSRF/state/callback through provider mechanisms; map final scopes to existing permission vocabulary. Persist one immutable grant ID/generation and creator-set snapshot per approved authorization; issue binding claims via provider-supported hooks. Fail token issuance if binding cannot be durably committed. Never identify a grant using caller clientInfo or only subject+client. Expansion creates a new approved generation and invalidates old authority; removed access remains removed on every call.
6. Route verifies signature/issuer/audience/expiry, then resolves exact active grant/subject/client/generation online. Check creator-set and scope intersection plus live memberships/lifecycle/owner entitlements for each operation. Revoke marks the Clipify grant revoked and revokes provider refresh/consent records; JWT verification alone is insufficient. If provider revocation partially fails, local access stays revoked and expose retriable connection cleanup failure, never restore authority.
7. Build stateless SDK v2 server factory and transport with explicit `legacy: 'stateless'`. Support legacy initialization and modern discover traffic at one endpoint; only verified SDK-supported versions are advertised. Forward all auth context explicitly into the handler. No sampling, elicitation, tasks, subscriptions or server-to-client calls in initial scope. Browser CORS/origin checks use validated configured client origins, not arbitrary OAuth callback-origin trust or wildcard cookies.
8. Implement tools from the contracts; use strict allowlist DTOs, safe structured error results, cursor pagination and accurate tool annotations. Scoped retry records commit alongside creation and audit; authorize before replay lookup. Add connected-app/revoke/activity UI with accessible labels and existing locale conventions.
9. Complete independent PostgreSQL race evidence, full regressions, feature coverage gates and security negatives. Validate four real client hosts through the identical planned acceptance journey; record actual host versions, negotiated era, DCR/CIMD behavior and destructive confirmation UI without claiming annotations enforce prompts.

## Test-First Architecture & Quality Plan _(mandatory)_

### Test Suite Directory Structure

```text
test/mcp/                               # TDD-owned Jest tests
  unit/{schemas,scopes,errors,revision}.test.ts
  contract/{oauth,discovery,transport,tool-metadata}.test.ts
  integration/{resource-operations,authorization-entitlements,activity-rate-limits,retries}.test.ts
  property/{authorization,quota}.test.ts
  component/{consent,connections}.test.tsx
test/bdd/features/mcp-support/     # BDD-owned; also ATDD evidence
test/bdd/steps/mcp-support.steps.ts
test/bdd/support/mcp-support.ts
test/support/mcp/                        # shared fixtures / fake dependencies / custom client
```

ATDD is Required as an evidence role on these BDD-owned artifacts, not a second copy of the feature. Existing unrelated ATDD suites remain in regression runs. Each planned ID is bound explicitly; outlines run every enumerated example. No silent skipped tests. Use runtime fixtures plus PostgreSQL for real entry-point scenarios; PGlite is not a concurrency substitute.

### Minimum Professional Test Reports

The [traceability](test-traceability.md), [defect log](defect-log.md), and [test summary](test-summary.md) are materialized from resolved governance templates. This plan is the Test Plan. No extra aggregate inventory/report is created. Raw runner output is CI evidence; retain Red/Green references in `tdd/cycle-log.md` during implementation, without claiming cycles now.

| Setting              | Value                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Overall summary mode | rolling                                                                                    |
| Release ID           | N/A                                                                                        |
| Output path          | reports/test-summary.md                                                                    |
| Rationale            | No versioned release identifier was requested; convergence maintains one latest aggregate. |

### BDD and ATDD Applicability

US1, US2, US3 and US4 all require both roles. Each scenario has one BDD owner and command, and its exact observable success/error outcome is also the stakeholder acceptance boundary. All source/example mappings are in the canonical traceability artifact; no N/A practices and no approved sampling.

### Scenario Coverage Matrix

See [test-traceability.md](test-traceability.md). All outline examples are expanded to individual rows. Supplemental obligations cover missing validation sources, per-operation authorization, PostgreSQL locking, CIMD SSRF, consent CSRF and grant binding. Task generation must expand grouped TDD obligations into executable case examples without inventing a minimum test count. One umbrella assertion cannot satisfy materially different cases.

### Traceability Materialization

Registry includes all specification TDD rows, Gherkin IDs, supplemental implementation rows, and concrete paths/commands. Source Coverage Map references US/FR/SC/EC IDs, matrix references each outline example. Commands/statuses/evidence reside only in registry or gate entries. All product evidence is Planned, not executed.

### Test Tooling and Gate Decisions

| Gate                   | Applicability | Required command                                                                                                      | Threshold                                                                                                                                                                                                                       | Raw evidence                             |
| ---------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| TDD                    | Required      | `bunx jest test/mcp --runInBand`                                                                                      | All inventory cases pass; record intended Red first                                                                                                                                                                             | `test-results/mcp/jest.txt`              |
| BDD / ATDD shared      | Required      | `bun run test:bdd`                                                                                                    | 100% mapped scenarios/examples; no skipped or missing bindings                                                                                                                                                                  | `playwright-report/ and test-results/`   |
| PostgreSQL concurrency | Required      | `bunx playwright test --project=bdd-chromium .features-gen/bdd/mcp-support/ --grep "concurrent\|simultaneous\|stale"` | All quota/revision cases pass using independent PostgreSQL connections                                                                                                                                                          | `test-results/mcp/postgres-concurrency/` |
| Full regression        | Required      | `bun run test:e2e`                                                                                                    | All affected acceptance/BDD/ATDD suites pass                                                                                                                                                                                    | `playwright-report/`                     |
| Coverage               | Required      | `bun run test:coverage`                                                                                               | Existing global 50% branches / 65% functions / 60% lines/statements preserved; changed feature files >=90% lines/statements/functions and >=85% branches; auth/quota/revocation/revision modules >=95% lines and >=90% branches | `coverage/`                              |
| Lint                   | Required      | `bun run app:lint`                                                                                                    | Zero errors; no weakened rules                                                                                                                                                                                                  | `test-results/mcp/lint.txt`              |
| Format                 | Required      | `bun run app:prettier:check`                                                                                          | All changed files pass; also check untracked artifacts explicitly                                                                                                                                                               | `test-results/mcp/format.txt`            |
| Typecheck              | Required      | `bun run app:typecheck`                                                                                               | Zero errors                                                                                                                                                                                                                     | `test-results/mcp/typecheck.txt`         |
| Dependency security    | Required      | `bun run audit:high`                                                                                                  | No new unaccepted high/critical advisories; preserve existing explicitly scoped ignore                                                                                                                                          | `test-results/mcp/audit.txt`             |
| Security contracts     | Required      | `bunx jest test/mcp/contract --runInBand`                                                                             | All OAuth, token, scope, SSRF, CSRF and redaction negatives pass                                                                                                                                                                | `test-results/mcp/security.txt`          |
| Migration policy       | Required      | `bun run test:migration-policy`                                                                                       | All guard tests pass; no generated drizzle changes on feature branch                                                                                                                                                            | `test-results/mcp/migration-policy.txt`  |
| Build / runtime smoke  | Required      | `bun run app:build`                                                                                                   | Build and server-action manifest pass; isolated BDD read/create/revoke smoke passes                                                                                                                                             | `test-results/mcp/build.txt`             |
| Mutation strength      | Required      | `node scripts/run-mcp-mutants.mjs`                                                                                    | Recorded deliberate mutant checks for missing scope, wrong owner, missing grant check, unlocked quota and skipped revision comparison each produce a real failure before restoration                                            | `test-results/mcp/mutants/`              |
| Named clients          | Required      | `bunx playwright test --project=bdd-chromium .features-gen/bdd/mcp-support/ --grep "release connection journey"`      | Four real-client profiles completed; record host/version/date/negotiated protocol and approved/denied consent, read, mutation, revoke; prerequisites missing => Blocked                                                         | `test-results/mcp/client-matrix/`        |

All required gates block completion/release. Browser-generated feature filename and grep selectors must be verified by `bddgen` and nonempty discovery before use; no-tests-found or skipped-only runs cannot count as evidence. Named-host execution requires human/vendor fixtures: the command runs the journey bindings, but it cannot create real vendor accounts or prove a host using a mocked SDK. Record host evidence through the shared fixture/host adapter; absent host prerequisites mark that example Blocked. Do not silently substitute Claude Code for Claude web.

### Risk-Based Threshold Policy

Add coverage collection for `src/auth/**`, `src/server/mcp/**`, shared resource services and `/mcp`/consent/connection route components; existing Jest defaults omit much of this code. Implement `scripts/check-mcp-coverage.mjs` to enforce the feature changed-file limits from coverage-final.json, with tests proving uncovered/missing files fail and no source ignore pragmas masking new code. Add it to CI after `test:coverage`; preserve global and gallery-specific existing gates. Capture baseline before implementation and require no measured regression below it in affected files. No threshold exception is pre-approved.

Use deliberate mutants for security boundaries until mutation tooling is established; restore each mutant immediately and verify Green. Do not install mutation tooling merely for this planning task. Audit dependencies plus risk-proportionate review of auth, consent, SSRF, grant binding, quota and revision code. Any plausible validated high-impact security regression blocks release.

### Evidence Retention

CI jobs retain `coverage/`, `test-results/`, `playwright-report/`, JUnit and `test-results/mcp/` with command, SHA, timestamps, exit codes, versions and fixture configuration for 30 days. Upload on failure too. Red/Green log references immutable CI artifacts or captured local logs; never record cookies, token responses, secrets or private payloads. Real-client smoke notes/screenshots are redacted and kept in the same run evidence bundle; executable source tests and professional report indexes are versioned, raw reports are not. Existing CI browser-tests PostgreSQL setup and migration guard remain authoritative.

### Red-Green-Refactor Execution Model

For US1 drive discovery/registration, consent presets/creator selection, exchange/refresh, grant binding and revoke one behavior at a time. For US2 drive each overlay/playlist/item verb, DTO validation/redaction, retry and revision behavior. For US3 drive permission paths, effective-plan restrictions and independent database races. For US4 drive distributed rate limiting, connection controls and audit visibility/failure behavior. For every slice: add the real-entry-point Gherkin binding and corresponding focused Jest cases first, observe the intended failure, record Red, implement minimally, record Green, then refactor while affected suites stay green. Finish each story with full mapped evidence and applicable gates; task ordering must place tests before production changes.

## Post-Design Constitution Check

Design obligations satisfied; no unauthorized migration exceptions, no duplicate suite ownership, no production/test evidence falsely claimed. Dependency install metadata verification, live-host availability and eventual migrations are implementation/release gates with explicit fallback behavior, not unresolved product choices. Planning ends here; tasks and production code are not generated by this command.

## Corrected Incremental Execution Boundaries

Published task IDs remain stable after reordering; tasks.md document order and explicit dependencies define execution order. The spec contains all scenarios before production coding; runnable features are added per ready slice with matching bindings, preserving fail-on-gen. Never generate unbound future scenarios or disable the missing-step guard.

A tested creator-read pilot is implemented before consent journeys. Consent, grant issuance and exchange form one connected authorization slice with all required consent/token tests first. Resource validation/retry/revision/risk primitives are driven by focused inner tests; each public resource verb then has a separate outer Red/Green cycle covering its applicable primitive, ownership, validation and error examples. A partly exercised artifact remains Planned until all its enumerated cases have been implemented and run; a slice’s passing result must not be confused with whole-artifact Green.

Provider schema generation to src/db/auth-schema.ts is an explicit test-first task before plugin configuration. Generated drizzle/ migrations remain forbidden. Full mapped BDD/story-wide gates run after required bindings exist; intermediate slice gates run only ready files/scenarios plus existing regression suites, without skipped future scenarios.

Owner policy implementation detail verified by T359:mutation lock order includes users owner row after OAuth grant and creator lifecycle, before resources. Native plan/disabled writers acquire the same row lock without relying on application process mutexes. This does not cover membership, agency or entitlement-grant rows; those remain mandatory separate concurrency gates.

Expanded policy lock order verified incrementally through T364:OAuth grant, creator lifecycle, owner users row, actor memberships, current role definitions, applicable agency creator link, personal/global Pro grants and creator_pro allocations, then resource rows. Native policy updates acquire the corresponding PostgreSQL row locks. Applicable agency link precedes allocations to keep cascade deletion order consistent. This does not replace clock-expiry or complete provider endpoint concurrency gates.

Durable browser provider effects use src/server/resources/overlay-effects.ts and overlay-effect-scheduler.ts, with overlay_effect_jobs added only in src/db/schema.ts. The resource/audit commit stores intent; external app-token/EventSub HTTP occurs afterward, within one10second deadline, and provider failures retain retry work. Public save no longer starts a separate best-effort subscription. Read-only worker startup is independent of public MCP. Exact provider202/409/failure, preview/configuration/body/deadline/claim/current-reward boundaries have native loopback/network and source-schema acceptance evidence; live Twitch account acceptance is not inferred.

Coverage probes use the same installed Jest SWC/Istanbul transformation as parent tests. Identical raw counter metadata is merged before one source remap, preserving unexecuted source obligations. Ordinary native probes remain uninstrumented; legacy V8 collector calibration remains independent. Per-suite raw output isolation and automatic CPU/RAM/database worker budgets remain intact. No coverage threshold or source exclusion is changed.

---

## Consolidated workflow expansion

# Implementation Plan: MCP product workflows

## Summary

Extend the official SDK tool catalogue without creating a second OAuth stack. Extract principal-aware resource services for browser and OAuth use, reuse existing policy locks and commercial rules, and expose only narrowly projected results. Preserve the original feature’s evidence.

## Technical Context

TypeScript 6 / Next.js 16.3.6 / Bun / PostgreSQL + Drizzle / Better Auth 1.7.7 / official MCP SDK 2.3.0. No dependency upgrades required. Read installed Next route/server-action guides before changes. No generated migrations on the feature branch.

## Constitution Check

Test-first mandatory: one slice red-green-refactor at a time. Highest verified actual MCP entry for BDD/ATDD. Isolated PostgreSQL/PGlite fixtures and controlled provider boundaries. No lowered coverage/skip gates. Before writing production behavior record an intended failing assertion; missing module errors alone are not sufficient.

## Architecture and project structure

- src/server/mcp/workflows/: explicit schemas/catalogue and story adapters.
- src/server/resources/: principal-aware remote, discovery/import, gallery, Creator Page and runner services.
- src/app/actions/: browser wrappers call shared services where existing writes overlap.
- Existing websocket and runner preview uploads record safe state to shared bounded stores.
- Existing auth scopes and consent are extended, with no implicit approval migration.
- test/mcp/workflows/: Jest owning TDD; test/bdd/features/mcp-workflows and steps own BDD and equivalent ATDD.

## Test Plan and required gates

Inner loop uses `bun run test --runInBand test/mcp/workflows/<slice>.test.ts`. Actual-entry BDD uses generated Playwright scenarios/native Node probes with loopback fixture DB. Controlled network responses stand in for Twitch; tokens never appear in evidence.

| Gate          | Command                                                                                                  | Threshold                                                                                      | Blocking | Evidence                              |
| ------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------- |
| TDD           | bun run test --runInBand test/mcp/workflows                                                              | All pass                                                                                       | Yes      | test-results/mcp-workflows            |
| BDD/ATDD      | bunx bddgen; bunx playwright test --config playwright.mcp.config.ts --project bdd-chromium mcp-workflows | All mapped cases pass                                                                          | Yes      | test-results/mcp-workflows            |
| Coverage      | bun run test --coverage --runInBand test/mcp/workflows                                                   | Existing project thresholds plus new sources >=90 lines/functions/statements and >=80 branches | Yes      | coverage/mcp-workflows                |
| Types         | bun run app:typecheck                                                                                    | No errors                                                                                      | Yes      | test-results/mcp-workflows/types.log  |
| Lint          | bunx eslint <changed files>                                                                              | No blocking findings                                                                           | Yes      | test-results/mcp-workflows/lint.log   |
| Format        | bunx prettier --check <changed files>                                                                    | All pass                                                                                       | Yes      | test-results/mcp-workflows/format.log |
| Security      | permission/credential-negative scenarios; bun run test:migration-policy                                  | All pass                                                                                       | Yes      | story evidence                        |
| Runtime smoke | bun run app:build; actual SDK tool discovery/calls                                                       | Build and calls pass                                                                           | Yes      | test-results/mcp-workflows            |

Run scoped affected suites during development; full affected suites once after source freezes. Independent check commands may run concurrently within automatic worker/DB budgets. Historical 003 results are not counted as new 004 validation. No exceptions approved.

## Evidence retention

Retain red/green raw logs under test-results/mcp-workflows; keep journal references in tdd/cycle-log.md for before-production chronology, a declared audit need. Reports: test-traceability.md, defect-log.md and test-summary.md. Overall summary mode rolling; release ID N/A; output reports/test-summary.md, updated only with observed results.

## Execution phases

WF-US1 remote -> WF-US2 discovery/import -> WF-US3 galleries/embed -> WF-US4 Creator Pages -> WF-US5 runners. Each operation’s evidence precedes its production adapter. Foundation catalogue validation is its own slice. Final compatibility/quality/report phase. External-only installation/actual public-host checks are recorded as scoped blockers, not reasons to stop local work.

## Feedback tool implementation

Extend the existing workflow schema/catalogue/dispatcher and activity label with submit_feedback. Use creator:read for authorization, non-read-only/non-destructive/open-world annotations, and the shared application rate-limiter-flexible RAM engine with separate bounded feedback replay state. Better Auth rate limiting governs authentication routes, not this MCP business operation; its supported auth configuration remains unchanged. Use the existing Sentry SDK, with a controlled real SDK transport in actual MCP acceptance fixtures. No new dependencies, endpoint outside MCP, migrations, tables or feedback scope. Run targeted feedback/unit/schema/risk/catalogue compatibility, types, lint and build checks; retain Red before production changes.

## Focused editing refinement

Use narrow MCP façades over existing resource services, with shared field-group definitions and Zod-derived schemas. Preserve the internal broad backend contracts for browser and service callers while removing broad names from MCP registration. Reads and results project only the selected area. Audit mutations under the actual focused tool name in the same transaction. No new dependency, database table, OAuth scope, plan rule or environment switch is needed.

Register static prompts through the official SDK registerPrompt API and server instructions through McpServer options. Share the static examples with an initially collapsed HeroUI Accordion in connected-app settings. Keep account data and credentials out of prompt templates. Jest native OAuth entry-point checks and focused Playwright BDD cases cover the refinement; the SDK probe verifies prompt discovery on legacy and modern transports. Existing historical external acceptance blockers remain unchanged.

## MCP operational statistics and Grafana v6 (approved design, implementation pending)

The protected instance-health endpoint feeds InfluxDB and Grafana. Extend its
existing JSON snapshot additively with `mcp`; preserve authentication, no-store
headers and existing fields. `v6` means the next Grafana dashboard artifact,
`grafana/clipify-vm01-overview-v6.json`, following the repository's v5 dashboard.
It does not mean a new HTTP endpoint or breaking health schema version.

### Collection and bounded RAM storage

Use one process-local store shared by MCP entry points, retaining cumulative
counters since process startup and gauges. No new dependency, database table,
environment toggle, per-call network request or timer is required. Export an
immutable snapshot without resetting counters on read. Initialize the fixed
catalogue with zeroes; arbitrary tool names become `unknown`, and arbitrary
reasons become `other`. Use monotonic time for durations and UTC timestamps for
sample/process start times. Bound cardinality by the registered tool catalogue,
fixed operation categories, reason codes and histogram buckets.

Collect:

- Tool call attempts and completions, with successful, denied, failed and
  cancelled outcomes; known tool and read/write/destructive classification.
  Count each attempt once, including missing-scope/rate-limit denials before
  tool execution, invalid arguments and unknown tools. Request-level failures
  before a trustworthy tools/call can be identified remain request counters.
- HTTP request totals by fixed method/status class and authentication,
  validation, rate-limit and service-unavailable rejection reasons. Keep these
  separate from tool outcomes: HTTP 200 does not establish tool success.
- `tools/list`, prompt-list and prompt-get operations as separate counters;
  discovery is not a tool call.
- In-flight calls as a gauge, and last-used UTC timestamps per known tool.
- Call-duration sum in seconds, observation count and cumulative histogram
  buckets with fixed upper bounds 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5,
  5, 10, 30, 60 and an unbounded total bucket. Finish every observation once,
  including errors/cancellation, and define duration as arrival at the tool
  boundary through final outcome, including boundary checks and audit work.

Never collect arguments, results, tokens, callback URLs, raw errors, snapshots,
IP addresses or per-user/client/creator labels in RAM telemetry. Existing audit
records remain the durable, authorized source for historical activity. Metrics
collection must not change authorization, audit guarantees or tool behavior.

### InfluxDB ingestion contract and query semantics

Provide numeric counters/gauges in deterministic nested objects compatible
with the existing flattened JSON field convention. Define and document exact
field mappings, for example `mcp_calls_started_total`,
`mcp_calls_success_total`, `mcp_tools_<tool>_success_total`,
`mcp_duration_seconds_sum`, `mcp_duration_count` and
`mcp_duration_buckets_le_0_1_total`. Bucket identifiers must be fixed and safe;
use `le_inf` for the unbounded bucket instead of non-JSON Infinity.

Expose `sampledAt`, `processStartedAt` and a generated process instance ID.
Collector-supplied host/service/replica tags identify the target; process
identity distinguishes restarts. Do not tag by every deployment SHA, arbitrary
client name or request ID. Document the tradeoff if process ID is mapped to a
series tag: one additional series generation per restart, subject to retention.
The collector must poll each replica consistently; a load-balanced endpoint
that alternates independent RAM stores cannot yield valid counter rates.

Prefer cumulative counters over rolling 5-minute/1-hour values. In Flux,
normalize resets per source series with `increase()` before deriving rates or
aggregating replicas. Calculate calls/minute and selected-range totals from
counter increments; average latency is duration-sum increments divided by
observation-count increments. Aggregate bucket increments across the selected
window/replicas to estimate p95; never average independently computed p95s or
apply quantile to scrape samples of average latency. Zero completed calls has
no latency/error-rate sample, rather than a misleading zero or NaN. Preserve
missing scrape periods as gaps; do not manufacture traffic with fill-zero.
RAM measurements are best effort: calls between the final scrape and restart
can be lost. Use audit history for durable historical tool usage when needed.

The current repository dashboard uses Flux, bucket `clipify_monitor`,
measurement `clipify_vm01`, and datasource UID `efg3es37pgh6ob`. The external
collector configuration is not present in this repository: inspect its actual
flattening/tag/type rules before finalizing exported field mappings. Commit a
sample JSON snapshot, flattened mapping and collector integration guidance so
the external change is reviewable even if deployment access is unavailable.

References: https://docs.influxdata.com/flux/v0/prometheus/metric-types/counter/
and https://docs.influxdata.com/flux/v0/prometheus/metric-types/ .

### Admin interface and dashboard artifact

Add an admin-only MCP overview with calls, outcomes, in-flight calls, latency,
known rejection reasons, top tools and a sortable per-tool table. Label live
RAM data as this process since startup. Durable client/creator activity uses
the existing audit records and their access rules, not new RAM identity maps.

Create Grafana v6 with a distinct title/UID, following existing datasource,
bucket and measurement conventions. Preserve applicable v5 gallery/creator
panels and add MCP traffic, outcomes/error ratio, per-tool usage, denial
reasons, in-flight work, average/p95 duration and restart/scrape freshness
panels. Explain reset handling, histogram approximation and RAM loss in panel
descriptions. Do not overwrite v5 or publish to external Grafana automatically.

### Focused verification

Test exactly-once accounting across success, domain failures, permission and
rate-limit denials, invalid input, unknown tools, cancellation and audit failure;
ensure both SDK-supported call dispatch paths cannot count twice. Verify
concurrency, immutable/non-resetting snapshots, bounded unknown labels, bucket
monotonicity and sum/count consistency. Check additive health serialization,
internal authentication, admin authorization and redaction. Validate v6 JSON,
unique panel IDs/UID, exported field references and Flux fixture calculations
for normal traffic, process restart, replica aggregation, missing scrapes and
zero-call periods. Verify browser admin rendering with HeroUI components and
run scoped regression, types/lint/format and applicable existing coverage gates.
Live collector ingestion/Grafana query execution is a separate validation task;
if external access is unavailable, record that specific blocker and complete
all local implementation and fixture checks.

### URL-only onboarding alignment

Remove the hard-coded creator:read scope hint from the initial authentication
challenge; Better Auth protected-resource metadata already advertises all
resource scopes (excluding offline_access). Generic clients then request that
advertised set automatically, leaving per-creator Read/Write/Custom choices to
Clipify consent. Keep tool-specific insufficient-scope challenges and signed
OAuth scope-subset validation. A client intentionally requesting a smaller set
is a compatibility case, not the normal setup. Add discovery/consent regression
proof and replace normal CLI examples with URL plus login, without --scopes.

### Client adoption refinement

Read existing OAuth registrations, active unexpired grants and retained 30-day
MCP audit events. Group by normalized, self-reported app name instead of fixed
client IDs. Keep Custom applications and report unavailable deleted metadata.
The admin list paginates all groups; a one-minute coalesced health cache exports
all groups plus totals, without a Top-X limit. Export names as dynamic-slot string field
values, never tags, and serialize counters/gauges as floats. Adoption gauges are
database-wide and must not be summed across process scrapes. Preserve complete
admin session/role/Twitch verification and internal health authentication.

Client export refinement (2026-10-08): Export every application-name group in each one-minute health scrape, without a Top-X cap. Names remain field values. Influx retention is 30 days. Dashboard files must contain the complete importable dashboard, preserving existing panels.

## Acceptance scope amendment — 2026-10-08

The user explicitly replaced the original four-host release matrix with Codex-driven testing against the PR preview MCP server. ChatGPT web, Claude web and another custom host are deferred to follow-up compatibility work and are no longer merge prerequisites for this PR. Existing independent SDK denial/revocation contracts remain required automated coverage; this amendment does not claim those other products were tested. Historical test-first evidence exceptions and production migration/monitoring rollout requirements remain separate.

The real Codex CLI completed native dynamic registration, user consent and PKCE token exchange against `https://beta-496.clipify.cloud.thedannicraft.de/mcp`. The official SDK then used that grant for preview validation: 66 tools, six prompts, approved-creator reads and unapproved-creator denial; **35/35 disposable mutation checks passed** across overlays, playlists and galleries, including create retry identity, focused editing, stale-revision rejection, invalid input, Free quotas, paid-feature rejection and deletion with persisted absence. Existing development resources were backed up and restored. A subsequent real refresh returned HTTP 200, rotated the refresh token and successfully read the approved creator. No credentials or callback codes are retained in these documents.
