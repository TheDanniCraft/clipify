---
detected_at: 2786b3f8
refreshed_on: 2026-10-14
ecosystems:
  - typescript-app
  - typescript-native-workflows
  - typescript-browser
  - typescript-runner
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
      component: test/app/components/chatWidget.test.tsx
      database-integration: test/server/memberNumbers.test.ts
      property: test/app/lib/consentRegistry.test.ts
    helpers:
      - jest.setup.ts
      - test/helpers/pgliteEnvironment.cjs
      - test/app/gallery/fixtures.ts
      - test/support/auth-engine-rewrite/database.ts
    verified:
      - file
      - suite
      - coverage
      - property
    suite_baseline: green
    suite_seconds: 1596
  typescript-native-workflows:
    cwd: .
    runner: playwright-bdd with native MCP probes
    single: null
    file: bunx bddgen --config playwright.mcp.config.ts && bunx playwright test
      --config playwright.mcp.config.ts --project=bdd-chromium {file}
      --workers=1
    suite: bun run test:coverage
    watch: null
    coverage: bun run test:coverage
    mutation: null
    acceptance: bunx bddgen --config playwright.mcp.config.ts && bunx playwright
      test --config playwright.mcp.config.ts --project=bdd-chromium {file}
      --workers=1
    property: null
    approval: null
    contract: null
    test_glob: test/bdd/features/mcp-workflows/**/*.feature
    exemplar:
      bdd-feature: test/bdd/features/mcp-workflows/runners.feature
      bdd-steps: test/bdd/steps/mcp-workflows.steps.ts
    helpers:
      - test/bdd/support/mcp-support.ts
      - test/support/mcp/probe.ts
      - test/support/mcp/postgres.ts
      - test/support/mcp/fixtures.ts
    verified:
      - file
      - suite
      - coverage
      - acceptance
    suite_baseline: green
    suite_seconds: 1596
  typescript-browser:
    cwd: .
    runner: playwright with playwright-bdd
    single: null
    file: bunx playwright test {file} --project=acceptance-chromium --workers=1
    suite: null
    watch: null
    coverage: null
    mutation: null
    acceptance: bun run test:acceptance
    property: null
    approval: null
    contract: null
    test_glob: "{test/acceptance/**/*.spec.ts,test/bdd/features/**/*.feature,test/a\
      tdd/features/**/*.feature,test/compliance/**/*.spec.ts}"
    exemplar:
      acceptance: test/acceptance/login.spec.ts
      bdd-feature: test/bdd/features/login-smoke.feature
      bdd-steps: test/bdd/steps/login-smoke.steps.ts
      atdd-steps: test/atdd/steps/harness.steps.ts
    helpers:
      - test/bdd/support/fixtures.ts
      - test/bdd/support/auth-engine-rewrite.ts
      - test/atdd/support/auth-engine-rewrite.ts
      - test/support/mcp/browser-database.cjs
    verified:
      - file
      - acceptance
    suite_baseline: green
    suite_seconds: null
  typescript-runner:
    cwd: packages/runner
    runner: jest
    single: null
    file: bun run test --runTestsByPath {file} --coverage=false
    suite: bun run test --coverage
    watch: null
    coverage: bun run test --coverage
    mutation: null
    acceptance: null
    property: null
    approval: null
    contract: null
    test_glob: "{src/**/__tests__/**/*.test.ts,test/**/*.test.ts}"
    exemplar:
      unit: src/__tests__/engine.test.ts
      storage-boundary: test/storage.test.ts
      real-media: test/bdd/runner-free-pro.test.ts
    helpers:
      - test/support/prepare-media.mjs
      - test/support/native-media.mjs
      - test/support/drain-probe.mjs
    verified:
      - file
      - suite
      - coverage
    suite_baseline: green
    suite_seconds: 1.306
verified:
  - file
  - suite
  - coverage
  - property
  - acceptance
suite_baseline: green
suite_seconds: 1596
---

# TDD Stack Profile

## Current baseline after localhost setup

Local prerequisites were installed/configured on 2026-10-14 at the user's request:
PostgreSQL 18 in a disposable /tmp cluster bound to 127.0.0.1:54419, a uniquely
named browser fixture initialized using the existing schema helper, Chromium's
OS libraries, and separate native/browser environment files. Follow
[docs/local-testing.md](../../docs/local-testing.md) before executing these
commands in another workspace or shell. No production database or application
source/test changes were needed.

- Complete application Jest: 461 suites / 4844 tests passed; 0 failed.
  Existing skips: 2 suites / 11 tests
  in the auth creator-onboarding-trigger/provider-credential-switch suites.
  No test or skip condition was changed by this setup.
- Complete native workflow inventory integrated into the same coverage command:
  343 passed / 0 failed / 0 skipped.
- Complete `bun run test:coverage` command exited 0; final merged coverage report
  and the repository's existing thresholds passed. Observed duration approximately
  1596 seconds, measured from the parent process start through result collection.
- Previously unexplained database-budget/mixed-source checks: 2 suites / 3 tests
  passed unchanged after setting the CI fixture environment.
- Focused native Runner workflows: 73 passed / 0 failed / 0 skipped.
- Browser acceptance: 4 passed; isolated login file: 1 passed. Browser full
  BDD/ATDD/compliance release suites were not rerun by this setup task.
- Runner package: existing verified 5 suites / 20 passed / 1 TODO remains unchanged.

Native full-suite/coverage commands intentionally refer to the same complete app
coverage owner. Execute that shared command once at its applicable completion
gate, not once per evidence label or stack. Browser `suite` remains null because
only acceptance and its isolated file command were verified here. Its
`suite_baseline: green` denotes those verified browser checks, not a claim of
complete release validation. Jest name filters remain null because zero-match
runs can falsely succeed; use the verified whole-file commands.

Current temporary setup: source /tmp/clipify-local-test-env.sh for native/Jest
checks; source /tmp/clipify-local-browser-env.sh for browser checks in a separate
shell. Browser-only URL/settings must not leak into Jest tests. The first broad
retry inherited NEXT_PUBLIC_BASE_URL from browser setup and was stopped after
that override changed a request-origin fixture; the complete successful retry
used the native-only CI environment. No assertion was changed.

Read-only comparison confirmed yesterday's successful CI on the exact HEAD:
https://github.com/TheDanniCraft/clipify/actions/runs/38401644930. CI provides
PostgreSQL, template IDs and Chromium dependencies; those were absent from the
original local environment. Raw current results are /tmp/clipify-local-test-*,
plus coverage/coverage-final.json and coverage/workflow-results.json.

## Initial refresh before local prerequisites

This profile was re-detected and tested on 2026-10-14 at HEAD 2786b3f8. The
existing planning documents are uncommitted; the HEAD alone is not tested-source
or release-gate evidence. `verified` at the root is the union of the stack-local
lists, not a claim that every stack supports every capability. Null means not
successfully verified in this workspace; failed candidate commands appear below
for diagnosis, not as executable verified entries.

The initial application attempt below was failing and incomplete because its
local prerequisites/environment were missing. It is historical diagnostic evidence,
not the current baseline. The corrected current results appear above.

| Check                              | Observed result                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App whole file, consentOrigins     | 1 suite / 3 tests passed; 0.381s measured from Jest JSON timestamps                                                                                                                  |
| App known name                     | Exactly 1 passed / 2 skipped; 0.351s                                                                                                                                                 |
| App nonexistent name               | Exit 0 with 0 tests run / 3 skipped: unsafe; single remains null                                                                                                                     |
| App full coverage attempt          | 303 passed suites and 4 failed suites observed before stopping repeated unavailable-database failures; partial counts only, no complete test count/duration or final coverage report |
| Database-budget focused diagnostic | 1 suite / 2 tests failed without coverage; not explained solely by outer coverage instrumentation                                                                                    |
| Native Runner workflow feature     | 73 failed / 0 passed / 0 skipped examples in 154.088s; every failure includes ECONNREFUSED to disposable PostgreSQL                                                                  |
| Browser acceptance                 | 2 tests failed; Chromium headless-shell cannot load libnspr4.so. Test build compilation and type checking completed, with additional loopback database connection errors             |
| Runner full suite + coverage       | 5 suites / 20 tests passed / 1 existing TODO; 1.306s; coverage-final.json generated                                                                                                  |
| Runner engine whole file           | 1 suite / 4 tests passed; 0.513s                                                                                                                                                     |
| Runner known name                  | Exactly 1 passed / 1 skipped                                                                                                                                                         |
| Runner nonexistent name            | Exit 0 with 0 tests run / 2 skipped: unsafe; single remains null                                                                                                                     |

The application command attempted was `bun run test:coverage --maxWorkers=2
--json --outputFile=/tmp/clipify-tdd-refresh-app.json`. The command did not finish:
only its own process tree was stopped after database failures, so no full-suite
or full-coverage verification is credited. Failed suite names observed:

- `test/mcp/unit/test-runner-database-budget.test.ts`: nested Jest expected exit 0
  but returned 1; also fails its complete file without coverage. Root cause remains
  unresolved; do not automatically classify this mocked-Pool test as missing DB.
- `test/mcp/unit/coverage-mixed-source.test.ts`: nested run expected zero failures
  but reported three. Root cause remains unresolved pending a working fixture.
- `test/mcp/workflows/galleries.test.ts` and
  `test/mcp/workflows/clip-cache-tools.test.ts`: native probe output contains
  ECONNREFUSED 127.0.0.1:54419.

There is no PostgreSQL listener on fixture ports 54419 or 5432, no installed
PostgreSQL command-line server found, and no Docker daemon socket. Browser files
are installed, but the required operating-system Chromium library is missing.
No dependencies, OS packages, source, test files or configurations were changed
by this refresh. Installing prerequisites or fixing the existing failures is
separate work; no application/production database was used as a fixture.

## Current execution policy

The active constitution already mandates Test-First Delivery and deterministic,
traceable evidence. No constitution amendment is needed or made.

- During development, execute the changed behavior's whole-file tests without
  coverage. Name filtering is not a valid Jest Red proof because zero matches
  can exit successfully. Record the intended failing assertion, not setup errors.
- Complete each slice with affected suites and relevant owning browser/runtime
  scenarios and applicable coverage/static gates. Do not repeat unchanged
  successful checks without changed source, inputs or an unresolved concern.
- Full coverage, all owning scenarios, lint, formatting, types and build remain
  required before merge. Draft scoped CI feedback does not satisfy the full gate.
- Native MCP BDD/coverage evidence has one execution owner. Genuine browser
  journeys remain browser-owned; do not duplicate execution for BDD/ATDD labels.
- Tests use disposable loopback databases; every case owns its database and
  job-owned schema templates are cleaned up. Never use shared development or
  production data. Feature branches do not generate Drizzle migrations.

## Initial failed and remaining unverified command candidates

This table preserves the initial missing-prerequisite observations. Current
frontmatter and the current-baseline section supersede resolved entries; remaining
unexecuted browser release commands are still not credited as verified.

| Stack/capability                  | Existing candidate                                                                                                                                                     | Current obstacle                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App complete suite/coverage       | `bun run test:coverage`                                                                                                                                                | Missing PostgreSQL and unresolved pre-existing baseline failures                                         |
| Native workflow whole feature     | `bunx bddgen --config playwright.mcp.config.ts` then `bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runners --workers=1` | 73 fixture connection failures; generation itself succeeded                                              |
| Native workflow complete coverage | `node scripts/run-coverage-lane.mjs workflows`                                                                                                                         | Needs the same disposable PostgreSQL; not separately executed because the fixture prerequisite is absent |
| Browser complete acceptance       | `bun run test:acceptance`                                                                                                                                              | Attempted; missing libnspr4.so and loopback fixture                                                      |
| Browser BDD / ATDD                | `bun run test:bdd` / `bun run test:atdd`                                                                                                                               | Not separately executed; same browser/DB prerequisites unresolved                                        |
| Browser full suite                | `bun run test:e2e`                                                                                                                                                     | Not executed; same browser/DB prerequisites unresolved                                                   |
| Broader app feedback              | `bun run test:affected` with the verified comparison commit                                                                                                            | Available script, not verified by this refresh                                                           |

## Conventions and shared utilities

### TypeScript application

Jest 30 uses Next's Jest adapter, jsdom by default, and a custom MCP test runner.
Node tests declare `@jest-environment node`; embedded-database cases use
`test/helpers/pgliteEnvironment.cjs`. Jest expect/jest.fn/mock/spyOn are the native
assertion and double APIs. React components use Testing Library; `jest.setup.ts`
loads jest-dom and TextEncoder/TextDecoder. Reuse gallery buildGallery/buildClip
fixtures and the auth test database/FixtureBuilder helpers. The helper named
`pgliteEnvironment` only exposes the PGlite constructor; each test still creates
and closes its own instance.

Use consentOrigins as the pure unit exemplar, chatWidget for React component
behavior, memberNumbers for embedded PostgreSQL boundaries, and consentRegistry
for a genuine fast-check invariant rejecting unrelated storage keys. All four
files were opened; consentRegistry, chatWidget and memberNumbers passed during
the partial app run. The consentOrigins whole-file command was verified
separately. Property testing is now established rather than merely installed.

### Native MCP workflows

playwright-bdd under `playwright.mcp.config.ts` executes native HTTP/protocol
probes, often without launching a browser. Reuse mcp-support's mcpWorld and
`test/support/mcp/probe.ts`, which runs the real composed entry point. Runner
workflow scenarios live in runners.feature with bindings in
mcp-workflows.steps.ts. `createMcpPostgresFixture` creates a unique database per
case and rejects remote/persistent fixture URLs. Do not confuse these checks
with browser journeys or turn their failures into passing unit substitutes.

### Browser acceptance, BDD and ATDD

Direct acceptance specs exercise the running application. Gherkin features and
bindings are generated by bddgen before Playwright runs. Reuse existing BDD and
ATDD auth fixtures/controlled clocks; authenticated browser fixtures are gated
by test mode, loopback URLs and opaque test credentials. No production secrets.
Keep OAuth traces off where the established fixture requires it. The public
login spec/feature/steps are the browser entry-point exemplars; harness.steps.ts
shows ATDD binding conventions, not a replacement for user acceptance.

### Self-hosted Runner

Independent Jest 30 stack in packages/runner with SWC and Node environment.
Use engine.test.ts for Puppeteer/process/live-input boundaries and storage.test.ts
for keyring/filesystem boundaries; both files were opened. Existing tests mock
these boundaries with Jest. The package test script already supplies runInBand
and forceExit; the verified file command need not repeat them. The suite still
reports one existing TODO and a forced-exit warning. New tests must clean owned
timers/processes/sockets rather than rely on forced exit. It has no existing
coverage threshold: generated percentages do not establish a new accepted gate.

## CI ownership, safety and retained evidence

CI owns six complete coverage lanes: unit, database-1, database-2, database-3,
quiet and workflows. It merges reports with `scripts/merge-test-coverage.mjs`;
missing/foreign inventory fails. Keep existing Jest global B50/F65/L60/S60 and
stricter per-path/MCP thresholds. Coverage artifacts and browser results are
retained 30 days; the shared browser build is retained 2 days. The complete
Runner suite also gates its owning CI job. This refresh is local diagnostic
verification and does not substitute for current-source CI fingerprints.

Raw refresh logs/JSON are `/tmp/clipify-tdd-refresh-*`. Runner coverage was moved
to `/tmp/clipify-tdd-refresh-runner-coverage` after verification to keep generated
artifacts out of the tracked worktree. These temporary diagnostics do not imply
30-day CI retention. The exact old-to-new profile diff is available from git.

## Initial limitations and current remaining capabilities

- Mutation tooling is absent in manifests/locks and installed modules. No Stryker
  dependency was added. Use recorded deliberate-mutant checks on the highest-risk
  changed behaviors during TDD verification until a separately approved tool exists.
- Initial app coverage was interrupted. Current complete app/native coverage now
  passes; genuine browser coverage is not configured. Runner coverage remains
  successfully verified.
- Interactive watch/UI workflows were inspected in package scripts but not
  exercised; watch remains null. No approval/snapshot command was verified.
- No separate contract-test framework is configured. Use existing composed
  route/protocol tests, with one declared artifact owner.
- Complete app/native verification now passes after setup. Full browser
  BDD/ATDD/compliance validation remains a later release gate. Historical counts
  from other commits are not evidence for this checkout.

## Native media lifecycle checkpoint (2026-10-15)

The complete native no-coverage checkpoint A5-native-lifecycle-complete-checkpoint-restored.log passes39 tests with1 pre-existing TODO in46.574seconds. This is scoped native lifecycle evidence, not a final feature/application coverage gate. Native browser setup follows docs/local-testing.md and the capture dependency revision; the real media owner requires FFmpeg and Chrome libraries. Package patch validation verifies3 dependencies/4 files, including both CJS/ESM extension-install ordering fixes in the capture dependency's nested Puppeteer24. Exact-version resolution checks every matching installed copy beside a different direct version. No timeout, assertion or coverage threshold was relaxed.

### Runner presentation prerequisite — 2026-10-17

Native/Jest workflows now also use `JWT_SECRET=clipify-e2e-jwt-secret-not-for-production` from the isolated test profile. The real private Runner presentation endpoint signs a scoped cookie; missing signing configuration is setup failure, not product Red. The three disposable-database CI jobs and [local testing guide](../../docs/local-testing.md) supply this fixed non-production value. Keep browser-only exports separate. Verified by the complete five-scenario native multistream owner in `specs/004-runner-free-pro/tdd/evidence/E1-private-multistream-keyed-workflows.log`.
