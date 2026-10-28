# Local test setup

Application development and test fixtures use different databases. The test
commands need the same prerequisites that `.github/workflows/ci.yml` provisions:
Node 24.21.0, Bun 1.4.2, PostgreSQL, and Chromium with its operating-system
libraries. Installing JavaScript dependencies alone does not provide the database
service or browser libraries. A green CI run therefore does not establish that a
new workspace is ready to run the same tests locally.

These instructions use disposable loopback PostgreSQL and fixed non-production
credentials. Never use an application, Infisical, production or shared development
database as a test fixture. Do not generate migrations or run `db:push:e2e`
locally; that schema-push command is restricted to its owning CI job.

## Install prerequisites on Ubuntu

```sh
bun install --frozen-lockfile
sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-18
bunx playwright install --with-deps chromium
```

CI currently uses PostgreSQL 18 for native/coverage jobs and PostgreSQL 16 for
browser jobs. These local instructions use 18 for both. The owning CI jobs remain
the required version-specific release validation. Other operating systems need
their native PostgreSQL installation and the same Playwright dependency setup.

## Runner package prerequisites

The guarded Playwright server generates a disposable Ed25519 signing key for
authenticated Runner browser requests. These tests do not need deployment signing
credentials.

The Runner has its own lockfile and dependency tree. The root install does not
refresh `packages/runner/node_modules`. Before Runner checks, install its locked
dependencies and validate the patched versions:

```sh
(cd packages/runner && bun install --frozen-lockfile && bun audit --audit-level=high && bun run patches:validate)
(cd packages/runner && node check-native.mjs && bun run typecheck && bun run test)
```

The native dependency audit is separate from the root audit. The capture library
retains its compatible Puppeteer API while sharing the Runner’s declared
`@puppeteer/browsers` downloader through a package override, removing the older
downloader and its vulnerable archive dependency. Keep real browser capture compatibility
checks when changing that override. With root Playwright prerequisites installed, run:

```sh
node packages/runner/test/support/capture-probe.mjs
```

This probe captures real WebM from a disposable loopback page and closes its
browser, HTTP server and capture socket. Set `RUNNER_CHROME_PATH` to an explicit
Chrome executable to run without resolving root Playwright. It does not contact
streaming services.

A patch version mismatch means the installed package differs from the declared
patch target. Refresh the locked install; keep the patch guard and lockfile intact.
Real media integration tests also need FFmpeg on `PATH` (Ubuntu: `sudo apt-get
install -y --no-install-recommends ffmpeg`). Native packaging and platform smoke
use the Node 24 targets from `.github/workflows/runner-native.yml`.

At a completed feature or release checkpoint, run the native package's complete
coverage owner separately from the application lanes:

```sh
(cd packages/runner && bun run test:coverage)
```

This command runs the whole native inventory, enforces the existing critical
95/90 and ordinary 90/85 floors, and writes its report and source identity to
`packages/runner/coverage/runner-feature/`. It rejects missing sources, skipped
cases, inconsistent inventories and changed inputs during execution. The one
pre-existing updater TODO remains explicitly identified; it is not a general
allowance for new TODOs. Use the regular `test` command with whole-file paths and
`--coverage=false` during development.

## Start a disposable localhost cluster

Run from the repository root in Bash. Keep these shell variables in this terminal:

```sh
export CLIPIFY_TEST_PG_BIN=/usr/lib/postgresql/18/bin
export CLIPIFY_TEST_PG_ROOT=/tmp/clipify-test-postgres
mkdir -p "$CLIPIFY_TEST_PG_ROOT"
if [ ! -f "$CLIPIFY_TEST_PG_ROOT/data/PG_VERSION" ]; then
  "$CLIPIFY_TEST_PG_BIN/initdb" -D "$CLIPIFY_TEST_PG_ROOT/data" -U clipify_mcp --auth=trust
fi
if ! "$CLIPIFY_TEST_PG_BIN/pg_ctl" -D "$CLIPIFY_TEST_PG_ROOT/data" status; then
  "$CLIPIFY_TEST_PG_BIN/pg_ctl" -D "$CLIPIFY_TEST_PG_ROOT/data" \
    -l "$CLIPIFY_TEST_PG_ROOT/server.log" \
    -o "-h 127.0.0.1 -p 54419 -k $CLIPIFY_TEST_PG_ROOT -c max_connections=200" -w start
fi
"$CLIPIFY_TEST_PG_BIN/pg_isready" -h 127.0.0.1 -p 54419
```

The service binds only to 127.0.0.1. Trust authentication is confined to this
throwaway local test cluster. Create its empty fixture-control database once:

```sh
"$CLIPIFY_TEST_PG_BIN/createdb" -h 127.0.0.1 -p 54419 -U clipify_mcp clipify_mcp_fixture
```

On reuse, an “already exists” response for that database is expected. Do not
replace the URL with an application database. Native cases create and remove
unique databases through `test/support/mcp/postgres.ts`; schema templates only
accelerate their initialization and are not shared mutable test data.

## Native and Jest environment

Use a separate shell from browser tests. Browser-only values such as
`NEXT_PUBLIC_BASE_URL`, `DATABASE_URL`, `APP_ENV` and `E2E_TEST_MODE` can change
application fixture behavior and must not leak into the native/Jest CI-equivalent
environment.

```sh
export MCP_TEST_DATABASE_URL=postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture
export MCP_TEST_TEMPLATE_ID=local-clipify-tests
export MCP_PROBE_RUNTIME=node
export JWT_SECRET=clipify-e2e-jwt-secret-not-for-production
```

The fixed non-production `JWT_SECRET` also belongs to native/Jest jobs: actual
Runner media workflows bootstrap the authenticated presentation, whose private
cookie requires a signing key. Browser-only exports are still kept separate.

`MCP_TEST_TEMPLATE_ID` must be present for the CI-equivalent test harness. The
mocked database-budget test inherits it; without it the nested runner enters a
template-ownership/cleanup path instead of the job-owned path used in CI. That
extra cleanup needs the real fixture service even though the capacity is mocked.
Each parallel job needs its own ID. Clear leftover instrumentation variables before a normal
no-coverage development check:

```sh
unset NODE_V8_COVERAGE MCP_V8_COVERAGE_DIR MCP_COVERAGE_PROBE_DIRECTORY MCP_PROBE_COVERAGE_PROVIDER
bun run test --runInBand --runTestsByPath test/mcp/unit/test-runner-database-budget.test.ts --coverage=false
bunx bddgen --config playwright.mcp.config.ts
bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runners --workers=1
```

Use whole-file Jest checks during development. Name filters can exit successfully
with no tests executed, so they are not a valid isolated Red proof. Git hooks do not repeat the complete application gate. Push after the affected
whole-file checks pass; a ready PR must pass complete GitHub validation before merge.
The full local command is for a specific CI reproduction, an explicit request,
or shared execution changes whose affected owners cannot be bounded. It is not
a routine push checkpoint. To reproduce that complete gate locally when needed:

```sh
bun run test:coverage
```

When investigating coverage specifically, invoke the coverage wrapper so native
application probes contribute their original-source counters. Scoped coverage is
optional during normal development; complete coverage remains owned by CI:

```sh
node scripts/run-mcp-coverage.mjs --runTestsByPath test/server/runner/admission.test.ts
```

Raw `bun run test ... --coverage` collects Jest counters but does not instrument
its native application probes. It cannot qualify the canonical MCP coverage gate.
A scoped report may also lack other required source owners; combine only matching
current-source owning reports and enforce all original thresholds at the final
gate. Run whole-file development checks without coverage as shown above.

CI instead owns duration-planned coverage lanes and merges their current-source
reports. Native workflows have one BDD/coverage owner and are excluded from
browser shards. Browser projects are invoked through `scripts/run-browser-shard.mjs`
when reproducing CI ownership, rather than executing native workflows twice.

Each coverage lane records both the commit tree and a fingerprint of the actual
tracked/untracked execution inputs and Node runtime. Keep source, tests, scripts,
configuration and dependencies fixed while producing or merging a checkpoint.
The merge requires all planned owning inventories and matching fingerprints;
an unchanged HEAD does not make results from different working files compatible.
Spec Kit progress/evidence updates can continue while the product inputs stay
fixed.

Run local browser suites after all Next.js builds finish. CI downloads a completed
browser build in a separate job; compiling another app build concurrently can
delay server actions beyond browser assertion deadlines on the same machine.

Use `bun run test:e2e:build` to match the shared CI browser build. Deployment
recovery must also work without `SOURCE_COMMIT`, `SENTRY_RELEASE` or
`NEXT_DEPLOYMENT_ID`; supplying a local-only deployment ID does not verify that
case. Check both configured and absent metadata when changing recovery.

## Disposable browser database

Browser fixture safety requires a uniquely named `mcp_<32 hex characters>`
database locally. Initialize it from the existing test schema helper; this is not
a generated migration. The command prints only a local disposable URL:

```sh
export DATABASE_URL="$(bun --conditions=react-server -e '
  import { randomUUID } from "node:crypto";
  import { Pool } from "pg";
  import { initializeMcpFixtureSchema } from "./test/support/mcp/postgres.ts";
  const control = new URL("postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture");
  const name = `mcp_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: control.href });
  await admin.query(`CREATE DATABASE "${name}"`);
  control.pathname = `/${name}`;
  const pool = new Pool({ connectionString: control.href });
  try { await initializeMcpFixtureSchema(pool); }
  finally { await pool.end(); await admin.end(); }
  console.log(control.href);
')"
export MCP_BROWSER_DATABASE_URL="$DATABASE_URL"
export MCP_BROWSER_PROVIDER_FIXTURE=true
export APP_ENV=test
export E2E_TEST_MODE=true
export DISABLE_BACKGROUND_JOBS=true
export RUNNER_ARTIFACT_SOURCE=local
export BETTER_AUTH_SECRET=clipify-local-test-secret-not-for-production
export RATE_LIMIT_HASH_SECRET=clipify-local-rate-limit-not-for-production
export TWITCH_CLIENT_ID=isolated-browser-client
export TWITCH_CLIENT_SECRET=isolated-browser-client-secret
export JWT_SECRET=clipify-e2e-jwt-secret-not-for-production
export ENCRYPTION_SECRET=clipify-e2e-encryption-secret-not-for-production
export NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3107
export SENTRY_DSN=
export SENTRY_AUTH_TOKEN=
export SENTRY_RELEASE=
bun run test:acceptance
```

Public/browser-only checks can use the established unreachable database fallback,
but it does not support authenticated creator acceptance. Chromium's executable
being installed does not prove its OS libraries are available; use
`playwright install --with-deps chromium`, as CI does. Missing `libnspr4.so` is an
environment failure, not an application assertion failure.

Recreate the uniquely named browser database after changing `src/db/schema.ts`
or `src/db/auth-schema.ts`; its schema is derived at initialization. Native
case templates already incorporate those schema files into their identity. Do not
patch a shared database or generate migrations to refresh test fixtures.

After the isolated browser build, generate Gherkin bindings and run the owning
browser shards without native workflow duplication:

```sh
bunx bddgen
node scripts/run-browser-shard.mjs atdd-chromium 1/1
node scripts/run-browser-shard.mjs bdd-chromium 1/1
node scripts/run-browser-shard.mjs compliance-chromium 1/1
```

## Cleanup and a new terminal

Environment exports apply only to the current shell. A new agent command or
terminal must repeat them, or source a local temporary environment file containing
these same non-production values. Do not commit that file. A workspace restart
may stop PostgreSQL; check `pg_isready` before claiming a baseline.

Clean job-owned schema templates after the test processes finish:

```sh
node scripts/cleanup-mcp-fixture-template.mjs
```

Global Playwright teardown removes authenticated fixture records and stops its
loopback server. Once all local checks finish, shut down the throwaway cluster:

```sh
"$CLIPIFY_TEST_PG_BIN/pg_ctl" -D "$CLIPIFY_TEST_PG_ROOT/data" -m fast -w stop
```

The uniquely named browser database lives only inside this disposable cluster.
Remove the `/tmp/clipify-test-postgres` directory when you intentionally discard
the entire stopped fixture. Never apply these cleanup commands to another cluster.

## Diagnosing a different local result from CI

Compare the exact commit and owning job, then Node/Bun versions, fixture listener,
template ID, browser libraries and test command. Do not change assertions to
compensate for missing services. Record an incomplete run as incomplete; a failed
prerequisite does not prove a product regression or invalidate a previous green
CI run. The TDD profile records verified commands and current observations; it
must not credit unexecuted full-suite gates.

## Native Runner media tests

Linux tests do not validate Windows process replacement or packaged executable
behavior. Changes to that code require the real Windows job in Native Runner
validation; report its result separately from Linux unit/media checks. A Linux
Docker daemon alone cannot run Windows containers.

The Runner package installs its own test browser; these tests use its actual
Puppeteer capture dependency and do not need the root Playwright installation.
From the repository root:

```sh
cd packages/runner
bun install --frozen-lockfile
node test/support/prepare-media.mjs
```

On Debian/Ubuntu, install FFmpeg and the downloaded browser's declared libraries:

```sh
runner_test_chrome="$(node test/support/prepare-media.mjs)"
sudo apt-get update
sudo apt-get install -y --no-install-recommends ffmpeg
sudo apt-get satisfy -y --no-install-recommends "$(paste -sd, "$(dirname "$runner_test_chrome")/deb.deps")"
```

`RUNNER_CHROME_PATH` and `RUNNER_FFMPEG_PATH` can select existing local binaries.
The prepared browser version follows the capture package's installed Puppeteer
revision. The tests own their loopback HTTP server, temporary profile, journal,
media files, Chromium and FFmpeg processes.

During development, run the changed behavior's whole file without coverage:

```sh
bun run test --runTestsByPath src/__tests__/execution-journal.test.ts --coverage=false
bun run test --runTestsByPath test/bdd/runner-free-pro.test.ts --coverage=false
```

Use the complete affected native suite at a finished component checkpoint;
complete coverage and application-wide gates remain mandatory at their declared
completion milestones. The root MCP command scenarios have their own focused
`runner-stop-control.feature`; registration/recovery scenarios remain in
`runner-free-pro.feature`. Real native media journeys have a separate execution
owner from those business-control scenarios.

The authority catalogue scenarios in `mcp-support/read_authority.feature` and
`mcp-support/mutation_authority.feature` execute only in the native workflow owner.
Their 110 read cases and 83 mutation cases replace the duplicate Jest catalogues;
BDD/ATDD/TDD traceability points to that one execution. Genuine UI scenarios remain
browser-owned. `scripts/test-execution.cjs` supplies the shared ownership patterns
and timing classification to both local runners and CI.

Browser scheduling uses recent successful CI timings, with
`scripts/test-duration-baseline.json` as the fallback. CI creates one immutable plan
for every browser matrix job, targeting five minutes of estimated BDD test work
per shard. Shard counts grow with measured work; there is no artificial job ceiling. Setup, builds and queues are additional; the
job summary reports any over-budget shard rather than omitting tests. The other
coverage and browser lanes retain their complete inventories and thresholds.

Mark a feature `@shard:scenario` only after verifying that every scenario owns an
independent fixture. The guide feature has that property; its former 12.7-minute
file can therefore split across workers. Other files stay grouped to preserve
shared setup. Every planned selector is resolved through Playwright before running.
The final gate verifies that the collected BDD reports cover the complete current
scenario inventory exactly once before saving new scheduling timings. Timing
caches never substitute for passing test results.

Squash is the only merge method. The `🏷️ PR title` check validates the resulting
commit subject, including title edits. The checked-in Gitmoji list comes from
`https://gitmoji.dev/api/gitmojis`; it does not require network access during CI.

## Validation strategy

Use the smallest real test boundary that proves the behavior. Keep pure rules and
large input matrices in fast unit or native integration tests. Use real browser
journeys for rendered controls, navigation, accessibility and recovery. Use real
Chromium/FFmpeg/native processes for capture, scheduling and delivery boundaries;
those tests must not be replaced by mocks merely to meet a time target.

TDD, BDD and ATDD describe evidence roles, not three mandatory executions of the
same behavior. Each executable artifact has one owning suite. Requirements can
reference the same passing artifact across practices. When consolidating tests,
compare the actual case sets and retained assertions, then update traceability and
commands. Removing a duplicate must not remove a distinct boundary or error case.

During development, observe a focused failing whole-file test, implement the fix,
and rerun the affected files. Keep failing Red work local. Local hooks run the
migration guard and staged-file checks. Draft CI gives scoped feedback; ready PRs
must pass complete validation, coverage, type checks, lint, build and applicable
platform journeys before a squash merge. The Gitmoji PR-title check is mandatory
and title edits do not restart the expensive pipeline.

Parallelize independent work, not shared timing-sensitive resources. Application
coverage plans unit/database/timing lanes from measured work. Native workflows
plan protocol and isolated media jobs from elapsed work, preserving shared fixture
groups. Runner tests keep files intact and derive the number of isolated jobs from
successful per-file timings, then merge coverage. The ordinary complete local Runner command remains available. Runner
shard results must match the current whole-file inventory, source fingerprint,
Node/platform/image and artifact hashes. Its aggregate gate retains every existing
critical/global coverage threshold and the single inherited TODO allowance.

All planners target five minutes of estimated work, with immutable plans and
explicit fixture independence. There is no fixed total-job budget or arbitrary
per-suite shard ceiling. Planned jobs and simultaneously running jobs are different:
GitHub schedules available capacity and queues excess jobs. A Pro account supports
up to 40 simultaneous standard runners; public-repository minutes do not remove
that technical limit. This is a work target, not a wall-clock deadline.
Builds, queueing, setup, long individual cases and exhausted capacity can exceed
it. Report those costs and optimize the bottleneck; never silently drop scenarios,
lower coverage thresholds or treat additional runners as a substitute for reducing
waste. More jobs are useful only when they reduce time to the green merge gate.

All coverage producers must contribute their exact disjoint inventory. Gates
reject missing, duplicated, skipped or foreign execution evidence and mismatched
inputs. Timing history may influence scheduling only, with safe baseline fallback;
it is never proof that a test passed. Reusing passing results requires complete
matching execution inputs and a separately reviewed policy. Approximate change
selection must not replace the full merge gate without validated dependency
mapping, an unknown-impact full-run fallback and explicit approval.

CI publishes a timing table separating job creation-to-start waiting, test steps,
and setup/other work. Creation-to-start can include dependency waiting, so it is
not presented as pure runner-queue latency. GitHub
[documents the actual account concurrency limits](https://docs.github.com/en/actions/reference/limits);
planned jobs may exceed those limits and wait without enlarging test batches.

Track slowest jobs and files, setup versus execution time, shard imbalance and
flakes from successful CI reports. Optimize fixture startup and repeated work
before increasing capacity. Keep a few representative end-to-end journeys and
move additional policy combinations to the lowest sufficient layer as features
grow. A test suite is part of the product's maintenance budget, not an unlimited
list of equally expensive browser scenarios.

### Select local tests

1. Start with the changed behavior's complete owning test files, without coverage.
   Include its failure and permission boundaries, not only the new happy path.
2. Follow callers and execution ownership. For ordinary direct imports, Jest's
   `--findRelatedTests` can help discover affected whole files. For MCP probes,
   shared fixtures and dynamically dispatched scenarios, inspect their callers
   and BDD bindings explicitly; the static Jest graph can miss subprocess owners.
3. At a completed slice, run the affected suites and relevant real browser or
   media scenarios. A backend-only change does not require every unrelated UI
   journey. Shared test-harness or dependency changes may require broader owners.
4. After a failure, fix it and rerun the affected whole files. Do not repeat
   unchanged successful suites without a concrete reason. A full local run is
   reserved for an explicit request, CI reproduction, or impact that cannot be
   bounded to affected owners.
5. Push after the affected checks pass. GitHub runs the full validation and
   coverage gate before merge; local focused evidence does not replace it.

For example, changing MCP consent activation requires the OAuth/connection
contract and integration owners, plus any existing creator-selection and agency
consent scenarios that exercise that behavior. It does not require local Runner
capture, updater or unrelated application suites. A change to the visible consent
flow also requires its real consent-browser journeys.
