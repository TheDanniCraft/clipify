---
detected_at: 9f6107a3
refreshed_on: 2026-11-03
ecosystems:
  - typescript-app
  - typescript-native-workflows
  - typescript-browser-acceptance
  - typescript-browser-bdd
default: typescript-app
stacks:
  typescript-app:
    cwd: .
    runner: jest
    single: null
    file: bun run test --runInBand --runTestsByPath {file} --coverage=false
    suite: bun run test:coverage
    watch: null
    coverage: bun run test:coverage
    mutation: null
    acceptance: null
    property: fast-check
    approval: null
    contract: null
    test_glob: "{test/**/*.test.{ts,tsx},src/**/__tests__/**/*.test.{ts,tsx}}"
    exemplar:
      unit: test/app/lib/consentOrigins.test.ts
      component: test/app/components/dashboardNavbar.test.tsx
      database-integration: test/server/memberNumbers.test.ts
      property: test/app/lib/consentRegistry.test.ts
    helpers:
      - jest.setup.ts
      - test/helpers/pgliteEnvironment.cjs
      - test/app/gallery/fixtures.ts
      - test/support/auth-engine-rewrite/database.ts
      - test/support/mcp/postgres.ts
    verified: [file, suite, coverage, property]
    suite_baseline: green
    suite_seconds: 2109
  typescript-native-workflows:
    cwd: .
    runner: playwright-bdd with native MCP probes
    single: null
    file: null
    suite: bun run test:coverage
    watch: null
    coverage: bun run test:coverage
    mutation: null
    acceptance: bun run test:coverage
    property: null
    approval: null
    contract: null
    test_glob: test/bdd/features/mcp-workflows/**/*.feature
    exemplar:
      bdd-feature: test/bdd/features/mcp-workflows/runners.feature
      bdd-steps: test/bdd/steps/mcp-workflows.steps.ts
    helpers:
      - test/support/mcp/postgres.ts
      - test/support/mcp/probe.ts
    verified: [suite, coverage, acceptance]
    suite_baseline: green
    suite_seconds: 2109
  typescript-browser-acceptance:
    cwd: .
    runner: playwright
    single: null
    file: bunx playwright test --project=acceptance-chromium {file} --workers=1
    suite: bun run test:acceptance
    watch: null
    coverage: null
    mutation: null
    acceptance: bun run test:acceptance
    property: null
    approval: null
    contract: null
    test_glob: test/acceptance/**/*.spec.ts
    exemplar:
      acceptance: test/acceptance/login.spec.ts
    helpers:
      - test/support/mcp/browser-database.cjs
      - test/support/mcp/postgres.ts
      - test/bdd/support/user-tour.ts
      - test/support/user-tour/server.mjs
    verified: [file, suite, acceptance]
    suite_baseline: green
    suite_seconds: 452
  typescript-browser-bdd:
    cwd: .
    runner: playwright-bdd with real browser
    single: null
    file: bunx bddgen && bunx playwright test --project=bdd-chromium {file} --workers=1
    suite: null
    watch: null
    coverage: null
    mutation: null
    acceptance: bunx bddgen && bunx playwright test --project=bdd-chromium {file} --workers=1
    property: null
    approval: null
    contract: null
    test_glob: test/bdd/features/**/*.feature
    exemplar:
      bdd-feature: test/bdd/features/login-smoke.feature
      bdd-steps: test/bdd/steps/login-smoke.steps.ts
      authenticated-browser: test/bdd/steps/user-tour.steps.ts
    helpers:
      - test/bdd/support/fixtures.ts
      - test/bdd/support/user-tour.ts
      - test/support/user-tour/server.mjs
      - test/support/mcp/browser-database.cjs
    verified: [file, acceptance]
    suite_baseline: green
    suite_seconds: null
verified: [file, suite, coverage, property, acceptance]
suite_baseline: green
suite_seconds: 2109
---

# TDD Stack Profile

## Verification scope and current baseline

Refreshed for creator-library planning at source HEAD `9f6107a3`. No application,
feature test, schema, migration, package, lockfile or test-configuration change was
made. This profile records current execution, not the old workspace's results.
The previous profile remains available in Git history at this source HEAD.

| Command or capability                          | Observed result                                                                                                                                                       | Evidence                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Full `bun run test:coverage` owner             | Exit0;555 Jest suites/6331 tests passed,1 suite/3 tests already skipped;434 native workflows passed (5 serial plus429 parallel),0 workflow skips/failures/flaky cases | /tmp/clipify-spec006-baseline.log; coverage/coverage-final.json; coverage/workflow-results-serial.json; coverage/workflow-results-parallel.json |
| Final combined coverage                        | Lines87.70%, branches80.51%, functions81.84%, statements85.39%; original global and per-source gates passed                                                           | coverage/coverage-final.json and final gate output in baseline log                                                                              |
| Application whole-file selector                | consentOrigins:3 passed                                                                                                                                               | /tmp/clipify-spec006-file.json                                                                                                                  |
| Known-name experiment                          | Exactly1 passed/2 skipped                                                                                                                                             | /tmp/clipify-spec006-single.json                                                                                                                |
| Nonexistent-name experiment                    | Exit0,0 executed/3 skipped; unsafe for Red proof, so single remains null                                                                                              | /tmp/clipify-spec006-zero.json                                                                                                                  |
| Existing component/database/property exemplars | Three files/35 tests passed unchanged                                                                                                                                 | /tmp/clipify-spec006-exemplars.json                                                                                                             |
| Full browser acceptance script                 | Guarded production build and27 acceptance tests passed; approximately452s including build                                                                             | /tmp/clipify-spec006-browser-baseline.log                                                                                                       |
| Browser whole-file selector                    | login.spec.ts:1 passed                                                                                                                                                | /tmp/clipify-spec006-browser-file.log                                                                                                           |
| Browser BDD selector/generator                 | bddgen succeeded; generated login-smoke.feature.spec.js:1 passed                                                                                                      | /tmp/clipify-spec006-bdd-baseline.log                                                                                                           |

The application and native workflow stacks intentionally share one complete
coverage execution owner; run that command once, not once per practice label.
The browser BDD green baseline denotes its verified smoke/file command, not all
BDD/ATDD/compliance release scenarios. The direct browser acceptance stack covers
its27-test project. Feature scenarios remain unimplemented and PENDING.

## Runtime and disposable prerequisites

Follow [docs/local-testing.md](../../docs/local-testing.md) before any future full
suite, native workflow or browser run. This run used Node24.21.0, Bun1.4.2,
PostgreSQL18 on loopback, installed Chromium plus its documented OS libraries,
and FFmpeg8.0.1. CI browser PostgreSQL16 remains a separate version-specific gate.
No production, shared-development or Infisical credentials were used.

The available host Node was22.23.4, so Node24 was copied from an already-present
node:24.21.0-bookworm image into a task-owned /tmp runtime. PostgreSQL used an
already-present postgres:18 image in a disposable task-labeled container bound
only to127.0.0.1:54419. Browser tests used a separate uniquely named mcp_ database
initialized by initializeMcpFixtureSchema, never a generated migration or db push.
Only repository-required operating-system test prerequisites were installed;
no JavaScript dependency was added or upgraded.

Required environment variable names, whose documented disposable values must be
reapplied per shell: MCP_TEST_DATABASE_URL, MCP_TEST_TEMPLATE_ID,
MCP_PROBE_RUNTIME and JWT_SECRET for native/Jest. Browser mode additionally uses
DATABASE_URL, MCP_BROWSER_DATABASE_URL, MCP_BROWSER_PROVIDER_FIXTURE, APP_ENV,
E2E_TEST_MODE, DISABLE_BACKGROUND_JOBS, RUNNER_ARTIFACT_SOURCE,
BETTER_AUTH_SECRET, RATE_LIMIT_HASH_SECRET, TWITCH_CLIENT_ID,
TWITCH_CLIENT_SECRET, ENCRYPTION_SECRET and NEXT_PUBLIC_BASE_URL, plus empty
Sentry upload/runtime settings as documented. Do not mix browser-only settings
into native/Jest. Do not copy a prior job's template identity. Cleanup removes
job-owned templates and the disposable fixture container after verification;
verify/recreate the fixtures before another execution.

## Conventions to match

- Root Jest30 uses Next's adapter, its existing setup and custom test-budget
  runner. Node tests declare their Node environment. Embedded database cases use
  pgliteEnvironment.cjs, which supplies the constructor; every test owns/closes
  its own instance. Reuse gallery buildClip/buildGallery and auth database
  FixtureBuilder helpers. Assertions/doubles are Jest/Testing Library; property
  assertions use the existing fast-check library. Every listed exemplar/helper
  was opened; the selected app exemplars were executed successfully.
- Native MCP examples execute the composed Node HTTP/protocol entry through
  probe.ts and disposable PostgreSQL. A native file selector was not separately
  refreshed, so file is null; the complete coverage owner did verify434 cases.
  These are not a substitute for rendered browser journeys.
- Browser acceptance uses the actual guarded built app. Browser BDD uses the
  generated .features-gen/bdd path or an unambiguous generated-file pattern as
  {file}; passing a raw source feature pathname need not match the generated
  test. Scope the clip-library generated file before its scenario ID: other
  project features use some identical feature-local labels.
- Reuse the real Next app lifecycle and authenticated fixture route illustrated
  by user-tour.ts/server.mjs for dashboard BDD. The auth-engine-rewrite in-memory
  authWorld is not proof of rendered dashboard behavior. Override only external
  provider/media boundaries through the established isolated fixture machinery.
- Run browser commands sequentially: their global server owns port3107. Build
  the app before browser execution; do not compile another app during journeys.

## Execution policy and missing capabilities

The full root owner took35m09s, so the user-provided AGENTS.md policy governs the
inner loop: changed whole-file tests without coverage, then complete affected
suites/owning coverage and real browser acceptance at completed slices, with full
owning CI validation before merge. No reduced threshold or skip was introduced.
Existing critical L95/B90 and ordinary L90/B85 source floors, statement/function
floors and any stricter path/Runner floor remain unchanged.

Jest single-name execution is deliberately null because a zero-match can falsely
succeed. Whole-file commands are the verified fallback. Browser name selectors,
watch, snapshots/approval and a dedicated contract tool were not separately
verified and remain null; example/contract assertions still use ordinary Jest.
StrykerJS is absent; mutation remains null. Implementation verification must use
recorded deliberate mutants for the highest-risk ownership, exact-ID and byte
limit guards. No mutation is meaningful before this feature has source code.

The independent packages/runner stack was not re-profiled because this feature
changes no native Runner runtime/process/capture/update code. Its old commands
are not silently promoted to current verification. A later Runner change needs
its current package test:coverage owner and real platform checks. Linux/browser
results do not establish Windows behavior or native packaging.

## Resolved setup observations

Inside the restricted sandbox Next's detached TypeScript --showConfig child
returned empty output; the same unchanged test passed when run with the required
execution permission. Missing Chromium OS libraries initially prevented launch;
following the repository prerequisites resolved that setup issue. One isolated
BDD probe overlapped another browser selector and hit EADDRINUSE; rerunning it
alone passed. These are documented environment/setup observations, not product
regressions or intended TDD Reds. The complete baseline commands above exited0.

## Constitution outcome

The existing Test-First Delivery/TF-1 through TF-8 principles already govern this
workflow. No competing principle, constitution amendment or approval is needed
or applied. All feature cycles remain pending in its TDD test list and may start
only under a subsequent implementation request.

## Clean-master implementation boundary

The feature branch was subsequently created from b6c8e591 with its locked Next16.4.3/HeroUI3.2.7/Auth1.7.12 dependencies. Five feature-owning existing test files passed142 tests unchanged; see /tmp/clipify-spec006-master-baseline.json. The full result above is historical at9f6107a3, not identical-source evidence for b6c8e591. Development uses the user-required whole-file inner loop from this green owning-file baseline; complete current-source coverage/browser/static gates must pass again before push.
