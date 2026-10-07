# Quickstart Validation: MCP Support

> Consolidated MCP server scope: 50 tools on `feature/mcp-support`. The original 15-tool foundation, 34-tool workflow expansion and feedback tool belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

This guide separates runnable incremental checks from the required release journeys. Implementation remains in progress; an incremental passing check does not establish release readiness.

## Prerequisites

Use Bun and the repository’s Node runtime, install dependencies with `bun install --frozen-lockfile`, and use test-only configuration. Authenticated BDD/concurrency tests need disposable loopback PostgreSQL. The authoritative schema setup runs in GitHub Actions `browser-tests` with its guarded `bun run db:push:e2e`; that command must not be used outside its approved CI conditions. Local developer schema pushes, if needed, use only the disposable Infisical development database. Never use production credentials or generate migrations on this branch.

## Portable browser fixture setup

Opt into the controlled Twitch metadata fixture with `MCP_BROWSER_PROVIDER_FIXTURE=true`. Set `DATABASE_URL` (or `MCP_BROWSER_DATABASE_URL`) to a disposable PostgreSQL database on `127.0.0.1` named `mcp_` plus 32 lowercase hexadecimal characters. The shared validator rejects persistent databases, remote hosts and URL host overrides. The CI-only alternative requires `CI=true`, `CLIPIFY_E2E_SCHEMA_PUSH=1`, database/user `clipify_e2e` and loopback; this does not grant permission to run schema pushes locally.

The managed Playwright server applies the repository's adaptive compiler heap and test-only OAuth/provider settings. The test process also needs `APP_ENV=test` and `E2E_TEST_MODE=true` for native SDK fixture access. OAuth-owning scenarios disable retained traces; screenshots and redacted command results remain available. Reuse the same Better Auth secret when restarting against an existing disposable database: its JWKS private keys were encrypted with that secret. A fresh CI database starts with the managed fixture default. Do not delete or rotate production keys to make a test pass.

## Test-first inner loop

1. Select a stable inventory/scenario ID from [test-traceability.md](test-traceability.md).
2. Add its focused test and real-entry-point binding. Run the whole relevant file, e.g. `bunx jest test/mcp/contract/oauth.test.ts --runInBand`; no matching-file/skipped-only run counts.
3. Record the intended Red with command, commit and redacted output before implementing. Make it Green minimally, then refactor and rerun affected tests.
4. Generate Gherkin bindings with `bunx bddgen`; verify nonempty scenario discovery and run `bun run test:bdd` against isolated PostgreSQL. Generated paths must be inspected before relying on a grep command.

## End-to-end outcomes

- Discover `/mcp` without authentication: receive the OAuth challenge and follow provider metadata. Register a fresh public custom client and PKCE callback without a Clipify session; attempt a tool before consent and confirm rejection.
- Consent to two creators and Read; reads work only for those currently accessible creators. Writes and deletion fail. Customize Read & edit with explicit delete permission; edits work, deletion works only with the corresponding resource permission. A newly accessible third creator needs new consent.
- For a Free creator without a trial/grant/allocation, launch 20 independent creation requests with distinct retry keys: all browser, all MCP, then 10/10 mixed. Expect one resource and 19 plan-limit errors. Configure test throttles above this burst so quota enforcement is measured.
- Read an overlay revision in browser and client; save in one interface, submit the old revision from the other and confirm conflict/no overwrite. Repeat for playlists/items and same-interface pairs; fetch latest before retry.
- Lose a successful create response, replay its key and verify one resource and the same safe result. Revoke access and retry again: replay cannot reveal data under revoked authority.
- Revoke a connection and immediately call with its old access and refresh credentials. Both fail, while another connection remains usable. Remove team/agency access or expire entitlements and confirm the next mutation follows current rules.
- View authenticated success/denial activity through an authorized account; no raw tokens, secret URLs, private arguments or unrelated creator activity appear.

## Four real-client acceptance profiles

Configure ChatGPT web custom integration/developer mode, Claude web remote connector, Codex CLI MCP connection, and the independent custom SDK client against an HTTPS test deployment and isolated creator fixtures. Each profile executes BDD-US1-021 with read+mutation, denial and revocation, within five minutes of beginning the configured journey. Record product/build/date, protocol era, DCR/CIMD path and destructive-tool host prompt behavior. Real vendor sign-in is a separate prerequisite, not simulated by the SDK fixture. Missing access marks that profile Blocked and the release No-Go; no production secrets enter CI artifacts.

## Completion gates

Run the exact gates in [plan.md](plan.md): focused/all Jest, `bun run test:coverage` (real Node child coverage merged with Jest) plus `node scripts/check-mcp-coverage.mjs`, full BDD/ATDD/regression browser suites, lint, typecheck, changed-file formatting, dependency audit, migration-policy tests and build/server-action manifest. Record each result once in the registry or quality-gate entry. Retain raw artifacts and Red/Green references; update defect log and test summary. Planning itself supplies no Green or Go evidence.

Runnable Gherkin is materialized per ready slice under test/bdd/features/mcp-support/, while spec.md retains the entire mandatory catalogue. Preserve fail-on-gen. Published task IDs are stable and may appear out of numeric order after remediation; execute tasks.md document order.

## Current connection configuration

MCP uses the official `@modelcontextprotocol/server` SDK and Better Auth's `@better-auth/mcp`, `@better-auth/oauth-provider` and `@better-auth/cimd` packages. Better Auth owns OAuth discovery, registration, PKCE and signed token verification. Clipify owns selected creator grants, online revocation, shared plan enforcement and resource services. The endpoint is `/mcp`; a compatible custom public client can discover and register itself without being a named vendor.

MCP is always part of the application; there is no activation environment flag. Use one canonical `NEXT_PUBLIC_BASE_URL`; derive the issuer/resource from that URL rather than configuring unrelated identities. Inject `BETTER_AUTH_SECRET` (existing legacy `JWT_SECRET` remains supported by auth) and a separate `RATE_LIMIT_HASH_SECRET` of at least 32 characters. Keep deployment secrets out of fixtures and output. Optional `MCP_ALLOWED_ORIGINS` lists explicitly allowed browser origins; third-party OAuth redirect URIs do not belong in trusted origins.

Rate ceilings default to 10 registrations/minute/network, 100 registrations/day/network, 120 tool calls/minute/actor+client and 600 tool calls/minute/network. `MCP_REGISTRATIONS_PER_MINUTE`, `MCP_REGISTRATIONS_PER_DAY`, `MCP_CALLS_PER_MINUTE` and `MCP_CALLS_PER_NETWORK_MINUTE` can tighten these ceilings. Invalid settings or unavailable counters fail closed. `429` includes `Retry-After`. Better Auth's OAuth provider also applies its own registration budget (currently five/minute); clients must honor the returned `Retry-After` when either budget binds. Without an explicitly trusted proxy header, requests share a conservative unknown-network bucket; arbitrary forwarded headers cannot reset a budget. Set `MCP_TRUSTED_IP_HEADER` only behind ingress that strips client-supplied copies and writes one verified IP; comma-separated forwarding chains are rejected.

Free includes MCP under the same owner resource limits as the website: one overlay, one playlist and 50 clips per playlist. Delete scopes are separate opt-ins. Destructive MCP annotations communicate risk; whether a host asks for confirmation is controlled by that host.

## Implemented tool surface

The current server registers 15 tools:

| Area                               | Tools                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Creator selection and capabilities | `list_creators`, `get_capabilities`                                                       |
| Overlays                           | `list_overlays`, `get_overlay`, `create_overlay`, `update_overlay`, `delete_overlay`      |
| Playlists                          | `list_playlists`, `get_playlist`, `create_playlist`, `update_playlist`, `delete_playlist` |
| Playlist items                     | `add_playlist_items`, `remove_playlist_items`, `reorder_playlist_items`                   |

`get_capabilities` returns current backend limits, usage and permitted operations; consent does not override those limits. Creates require a retry key. Updates, deletes and playlist-item mutations require the latest configuration revision. Playlist item changes share `playlist-items:manage`; deletion has separate per-resource scopes.

`update_overlay` changes supported saved configuration, including filters, playback mode, playlist binding, player volume and theme fields, subject to the owner's current plan. It does not issue live remote-control commands or report current playback. Adding items appends validated Twitch clips to a saved playlist; it does not enqueue a clip into a live player queue.

Live playback state/commands/queues, clip search and automatic imports, gallery/Creator Page publication, analytics exports, Runner administration, Twitch reward creation, team/agency administration, billing and account security have no MCP tool in this feature. Secret-bearing embed/OBS URLs and access-key rotation are not exposed. Future tools need their own scopes, shared backend policy and acceptance evidence.

## Migration and rollout ordering

Keep MCP off until the complete release gates and schema readiness check pass. This feature branch edits schema sources only; the post-merge Generate Migrations workflow owns generated migrations. Apply that generated migration before starting application processes with this schema, including browser code: switching MCP off alone cannot make a new Drizzle select compatible with old tables. Drain old writer instances before enabling required revision comparisons; old tabs must reload rather than obtain an unconditional-write exception. The /mcp route now checks required source-schema columns and non-null integer revision defaults through read-only catalogue queries; missing or unavailable schema returns safe503. Browser writers require loaded revisions and show reload guidance. OAuth registration, JWKS, root discovery aliases and the direct provider authorization metadata URL now also check readiness, while ordinary authentication remains available. Deployment sequencing remains a separate release task.

## Runnable incremental commands

Set `MCP_TEST_DATABASE_URL` to a disposable loopback base database named `clipify_mcp_fixture` (or the existing CI `clipify_e2e`). Fixtures create/drop their own `mcp_*` databases and initialize schema from sources; this is not a generated migration or a production schema push. Then run `bunx jest test/mcp --runInBand`. `MCP_PROBE_RUNTIME=node` runs the same real probes on Node.

Generate scenarios with `bunx bddgen`; handler scenarios can run with `playwright.mcp.config.ts`. The actual browser consent scenario additionally needs an already-running isolated Next test server with matching test-only configuration and disposable database. The configuration neither starts nor tears down that server. Source/probe files must stay fixed throughout full coverage measurements; retain failed diagnostics and rerun after corrections.

Operational cleanup starts in Node runtime servers with background jobs allowed, independently of the public MCP feature flag. Read-only MCP schema readiness gates each sweep; incomplete schemas are skipped and retried at the next interval. Every 30 seconds it runs a non-overlapping bounded sweep (at most 500 rows per table), expiring never-consented unmanaged DCR clients after 24 hours and expired create retries/MCP rate counters. Consent, grant, credential, managed/trusted and CIMD clients are protected; non-MCP login counters remain owned by their existing lifecycle. A sweep uses one transaction and skips locked rows, so replica jobs can run safely and pick up skipped records later. Failed sweeps are reported and retried next interval. Separate bounded sweeps also retry revoked-provider credentials and enforce MCP activity retention.

The private MCP cleanup worker also retries provider credential removal for locally revoked grants every30 seconds, with a maximum500 rows per credential table per sweep. The grant remains revoked throughout failure/retry; active or unrelated credentials are preserved. Each cleanup job reports failures independently. MCP activity retention defaults to90days (MCP_ACTIVITY_RETENTION_DAYS whole1–365), bounded500-row sweeps, preserving unrelated audit purposes. Source-schema account/creator deletion removes orphan MCP activity; suspended recovery data remains. Cleanup remains independent of public request availability. Account purge remains owned by the existing account-lifecycle service; MCP cleanup and cascade behavior have their own native fixture checks.

Shared PostgreSQL pool bounds connection acquisition and each server-side statement to ten seconds. Restart existing app processes to adopt changed pool defaults; development HMR retains the global pool. Request-owned leases now cancel only matching active SQL on request/body abort, reject later queries/COMMIT and preserve independently borrowed work. Durable serialized provider refresh completes encrypted persistence outside the cancelled request scope; Twitch HTTP refresh is bounded to ten seconds including response consumption. These bounds do not establish a cumulative request deadline. Provider credential serialization uses session advisory locks and requires direct PostgreSQL or session pooling; transaction pooling is not supported for this lock lifecycle. Restart retained development pools before HTTP validation.

MCP operational activity uses an explicit90-day default retention period, configurable with `MCP_ACTIVITY_RETENTION_DAYS` from1 through365 whole days. Invalid settings prevent deletion. Each sweep removes at most500 expired MCP activity entries using skip-locked row selection; unrelated security/billing audits retain their own lifecycle. This implements the existing purpose/risk/configured operational-log policy, rather than asserting a previously fixed audit duration. The existing nonoverlapping30second worker runs this bounded sweep independently of operational/credential cleanup; account-purge cleanup remains separate.

The active bounded MCP worker also removes MCP activity after its actor or approved creator has been deleted from the source schema. Native FK cascades remove deleted actors’ grants, approvals, retries and OAuth credentials; creator deletion removes its approvals and retries without deleting another actor’s client connection. Suspended/recoverable accounts remain retained. This does not implement the existing overall account purge pipeline; Private cleanup remains independent of public request availability.

Provider coordination admission is per process/pool, bounded to ten seconds while queued, at most two lock holders with at least one connection reserved for Better Auth storage. The existing shared pool uses ten connections; credential coordination rejects configurations with fewer than two. Session advisory locks still coordinate across processes. This cached-credential liveness check is not the independent-creator release benchmark.

Anonymous OAuth registration is rate limited before reading metadata. Body processing is bounded to256KiB and10seconds, rejects cancelled requests, and returns invalid_client_metadata without creating a client on failure. Validated bounded bytes are passed to the original Better Auth registration handler; ordinary authentication routes retain their existing behavior.

Twitch refresh response consumption is capped at64KiB within the existing10second exchange deadline. Access tokens must be nonempty strings; optional rotated refresh tokens must be valid strings; expiry must be positive safe integer seconds with a representable date. Invalid metadata is rejected before Better Auth encrypted persistence, preserving prior credentials and releasing coordination. The64KiB limit is a Clipify resource bound.

Better Auth, its core, OAuth provider, MCP adapter, CIMD, passkey and Drizzle adapter are pinned to 1.7.7. The upstream adapter fix replaces the former local Drizzle patch; no Better Auth patch is registered. The existing Next.js patch remains. Run `bun run patches:validate` after installation. Rebuild and restart retained browser servers after dependency changes so they exercise the installed versions.

Client metadata DNS/header fetch waits race the provider cancellation signal with a10second fallback. The provider stillowns its tighter5second metadata deadline,5KiB body cap, schema/profile validation and public-address/TLS-pinned transport. OS DNS lookup may finish later, but authorization returns promptly and any later transport receives an aborted signal.

Metadata transport verification: isolated native TLS fixtures retain Host/SNI and certificate checks while routing through a test bridge. Rejected status or non-JSON bodies are cancelled through the supported fetch wrapper; 304 cache semantics and upstream schema/profile validation remain preserved. Evidence: test-results/mcp/cimd-https-*.txt. This does not establish external named-client acceptance.

## Development verification cadence

Use scoped verification for each implementation slice: its complete affected Jest files, the related existing regressions, and the exact mapped BDD examples. A selection must execute nonempty tests; setup failures, skipped-only runs, and unrun catalogue examples do not establish acceptance. For ordinary iterations, omit coverage collection and do not run the entire repository. Rerun a scoped check when its code or fixtures change or a failure needs verification.

Run independent type, lint, and formatting checks concurrently when they do not mutate shared artifacts. Parallelize isolated non-timing test files with a bounded worker count only after verifying fixture isolation. Keep performance measurements and timing-sensitive deadline/race tests in a dedicated quiet lane; background load must not alter their acceptance budgets. Browser tests sharing a Next server and fixture lifecycle need their own verified concurrency limit.

Run the complete regression suite and strict source coverage at integration milestones and on the final stable source snapshot. Repeat a complete measurement only after relevant changes, failures, or unresolved integration concerns justify it. Retain the exact source hashes and result so the tested snapshot stays identifiable. Scoped checks supplement the required final gates; they do not replace them or lower their thresholds.

Child-process coverage is now isolated by the absolute Jest suite path, and temporary nested measurements use their own output directories. Real concurrent read/update probes retain executed and cold functions separately. The default Jest and coverage commands choose workers automatically and use the installed Jest runner for every result. Ordinary files run first; ordinary MCP database files are bounded by disposable loopback PostgreSQL capacity; timing, load and race proofs run in an exclusive serial lane after the preceding phases. Capture only application probes, not the Jest process itself. Native test programs compile once per run, with a temporary cache removed afterward.

For an ordinary non-timing slice, run explicit complete files without coverage, for example `MCP_PROBE_RUNTIME=node bunx jest test/mcp/contract/discovery.test.ts test/mcp/unit/scopes.test.ts --maxWorkers=2`. For a necessary scoped coverage diagnosis, use `node scripts/run-mcp-coverage.mjs <affected-files> --maxWorkers=2 --coverageDirectory=test-results/mcp/<unique-run>/coverage`; the strict whole-feature gate is expected to fail when that slice leaves required source cold or missing. Such a diagnostic is never a release coverage pass. Do not include performance/deadline suites in this parallel lane. Four workers passed the same32non-timing calibration/collector checks in17.944s, compared with23.353s for2workers in one local comparison. Use up to4workers for ordinary isolated scopes after checking PostgreSQL connection capacity; this is not a full-suite throughput guarantee. Keep timing/performance acceptance separate.

Use streaming redacted logs to expose progress during long runs without recording fixture credentials. Current local retained examples include `coverage-two-worker-real-entry.txt` and `coverage-parallel-*.txt`. Full coverage and acceptance remain required at integration/final checkpoints.

## Automatic machine and database sizing

`bun run test` and `bun run test:coverage` now size workers from available CPU affinity, free RAM and Linux container CPU/hard/soft memory limits. They leave one CPU and memory headroom, budget roughly2GiB per worker including native child processes, and default to at most8ordinary workers. The count is recalculated at phase boundaries, not resized during an individual running test. An8GiB machine often selects1–2workers depending on free memory; a64GiB/128GiB machine can select more when CPU and free memory allow. Total installed RAM alone is not the deciding factor.

Set `MCP_TEST_WORKERS=2` to choose a lower budget; a larger positive count (maximum64) remains bounded by CPU and memory headroom. Existing explicit `--runInBand` remains serial. Database scopes reserve connection capacity for the shared server and control work, allow a conservative16connections per ordinary fixture and cap at4workers. The capacity probe is a bounded read-only query against the validated disposable loopback fixture base only; unavailable/unknown capacity falls back to1. No production schema or remote database is accessed by this sizing step. Quiet deadline/performance/concurrency proofs remain serial regardless of the ordinary worker count.

Workers exceeding512MB idle memory are recycled between files. CLI output reports the phase, number of suites and actual worker count, so the selected budget is visible. Browser/BDD worker concurrency remains explicit until the complete shared-server fixture set has been verified for parallel use; the Jest auto-sizing change does not claim browser isolation from hardware capacity alone.

Shared Pro browser reward changes now persist `overlay_effect_jobs` in the resource/audit transaction, keyed by overlay and committed revision. Stale/rolled-back/unchanged/cleared reward edits schedule no subscription. The private30second worker claims and renews durable leases before bounded app-token/EventSub delivery, persists retry on failures and skips obsolete rewards. Public save no longer starts duplicate best-effort delivery. Native loopback HTTP verifies profile/deadlines; no live Twitch acceptance is inferred. Ordinary generated migration remains master-workflow owned; deploy the final schema before activating the completed feature.

Coverage measurement now uses identical installed Jest instrumentation in parent and native child application code and merges raw counters before a single source remap. Native source definitions cannot gain a second false-cold copy from V8/Babel range differences. Fresh subset measurements still fail the full mandatory feature gate when other source remains cold/missing. Complementary measurements may be combined for the same source snapshot only with unchanged SHA hashes, identical counter metadata and disjoint executed test names; final whole-feature acceptance still requires its complete run.

Managed Playwright test servers now also size their default V8 heap from available memory using the same cgroup-aware detector: 35 percent of available memory, rounded down in 256 MiB steps, bounded from 512 MiB to 12 GiB. Explicit nonempty `NODE_OPTIONS` takes precedence. This sizes the compiler heap at startup; it does not increase browser worker concurrency or disable Next development memory restarts. Insufficient resources can still prevent application compilation; use a smaller test scope or a larger machine.

---

## Consolidated workflow expansion

# Validation

Use the commands and disposable-loopback fixture rules in plan.md. Run scoped tests first. Then verify actual SDK discovery and one positive/negative call per advertised tool. Connect an installed runner through the normal device flow for manual deployment verification; no production credentials or enrollment bypass.
