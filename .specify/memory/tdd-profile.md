---
detected_at: 218692f6
ecosystems: [typescript-app, typescript-browser, typescript-runner]
default: typescript-app
stacks:
  typescript-app:
    cwd: .
    runner: jest
    single: null
    file: "bunx jest {file} --runInBand"
    suite: "bun run test:coverage"
    watch: null
    coverage: "bun run test:coverage"
    mutation: null
    acceptance: null
    property: "fast-check with @fast-check/jest"
    approval: null
    contract: null
    test_glob: "test/**/*.test.{ts,tsx}"
    exemplar:
      unit: test/app/lib/consentOrigins.test.ts
      component: test/app/components/chatWidget.test.tsx
      database-integration: test/server/memberNumbers.test.ts
    helpers:
      - jest.setup.ts
      - test/helpers/pgliteEnvironment.cjs
      - test/app/gallery/fixtures.ts
  typescript-browser:
    cwd: .
    runner: "playwright with playwright-bdd"
    single: 'bunx playwright test {file} --project=acceptance-chromium -g "{name}"'
    file: "bunx playwright test {file} --project=acceptance-chromium"
    suite: "bun run test:e2e"
    watch: null
    coverage: null
    mutation: null
    acceptance: "bun run test:acceptance"
    property: null
    approval: null
    contract: null
    test_glob: "{test/acceptance/**/*.spec.ts,test/bdd/features/**/*.feature}"
    exemplar:
      acceptance: test/acceptance/login.spec.ts
      bdd-feature: test/bdd/features/login-smoke.feature
      bdd-steps: test/bdd/steps/login-smoke.steps.ts
    helpers: []
  typescript-runner:
    cwd: packages/runner
    runner: jest
    single: null
    file: "bunx jest {file} --runInBand --forceExit"
    suite: "bun run test"
    watch: null
    coverage: "bunx jest --coverage --runInBand --forceExit"
    mutation: null
    acceptance: null
    property: null
    approval: null
    contract: null
    test_glob: "{src/**/__tests__/**/*.test.ts,test/**/*.test.ts}"
    exemplar:
      unit: src/__tests__/engine.test.ts
      storage-boundary: test/storage.test.ts
    helpers: []
verified: [single, file, suite, coverage, acceptance]
suite_baseline: green
suite_seconds: 153.489
---

# TDD Stack Profile

## Conventions to match

### TypeScript application

- The application uses Jest 30 through Next.js' Jest adapter. Tests live under `test/` as `*.test.ts` or `*.test.tsx`; Jest also permits `src/**/__tests__/**/*.test.ts(x)`.
- The default environment is `jsdom`. Node-focused tests declare `/** @jest-environment node */`; embedded PostgreSQL tests declare `/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */`.
- Assertions use Jest's global `expect`. Doubles use `jest.fn()`, `jest.mock()`, and `jest.spyOn()`; there is no separate mocking library.
- React component tests use Testing Library (`render`, `screen`, `fireEvent`, `userEvent`, and `waitFor`) and the matchers installed by `jest.setup.ts`.
- `jest.setup.ts` installs `@testing-library/jest-dom` and supplies `TextEncoder`/`TextDecoder` where needed.
- `test/helpers/pgliteEnvironment.cjs` provides an isolated in-memory PostgreSQL-compatible environment. Use it instead of a shared or production database when PostgreSQL semantics are required.
- `test/app/gallery/fixtures.ts` contains the existing gallery and clip builders. Reuse them for gallery tests rather than duplicating fixtures.
- `fast-check` and `@fast-check/jest` are installed for invariants and generated-input tests. No property-test exemplar exists yet, so the first real property test must establish the project pattern without adding a demonstration-only property.
- Exemplars to imitate: `test/app/lib/consentOrigins.test.ts` for a pure Node unit test, `test/app/components/chatWidget.test.tsx` for a consent-aware React component test, and `test/server/memberNumbers.test.ts` for an embedded-database integration test.

### TypeScript browser acceptance and BDD

- Browser acceptance tests use Playwright with Chromium only and live under `test/acceptance/` as `*.spec.ts`. They exercise the actual Next.js application through its public browser entry points.
- BDD features live under `test/bdd/features/`; their executable `playwright-bdd` bindings live under `test/bdd/steps/`. Run `bun run test:bdd` so `bddgen` regenerates the executable tests before Playwright starts.
- Follow the installed `test-first-governance` convention: use one owning-suite tag, put a stable scenario ID immediately above one `Scenario` or `Scenario Outline`, reuse real US/FR/SC/EC identifiers when a feature specification supplies them, and do not invent traceability identifiers merely for tooling smoke coverage.
- `playwright.config.ts` starts an isolated application at `http://127.0.0.1:3107`, uses `.next-playwright`, disables schedulers and external analytics, and supplies fixed non-production configuration. Browser tests must not require Infisical, developer credentials, a shared database, or production state.
- Assertions use Playwright's `expect`; browser locators should prefer roles and accessible names. The BDD layer uses `createBdd()` and the same Playwright fixtures and assertions.
- Exemplars to imitate: `test/acceptance/login.spec.ts` for direct acceptance tests, `test/bdd/features/login-smoke.feature` for Gherkin, and `test/bdd/steps/login-smoke.steps.ts` for bindings.

### TypeScript runner

- The Runner is a separate Jest 30 stack rooted at `packages/runner`, using `@swc/jest`, a Node environment, and tests under `src/**/__tests__/` or `test/`.
- Assertions and doubles use Jest globals. Native, filesystem, process, Puppeteer, and network boundaries are mocked explicitly.
- Exemplars to imitate: `src/__tests__/engine.test.ts` for process and browser orchestration and `test/storage.test.ts` for native keyring and filesystem boundaries.
- The Runner currently needs `--forceExit`; Jest reports remaining asynchronous handles after the suite. New tests must still clean up timers, processes, sockets, and browser doubles instead of relying on forced termination.

## Verified baseline

- Application suite and coverage: `bun run test:coverage` completed with 140/140 suites and 1,148/1,148 tests passing, zero snapshots, and a Jest-reported runtime of 153.489 seconds. The configured coverage thresholds remained green.
- Application file command: `bunx jest test/app/lib/consentOrigins.test.ts --runInBand` completed with 1/1 suite and 3/3 tests passing.
- Application Jest name filtering is unsafe for Red-phase isolation: a real `-t` match ran exactly one test, but a nonexistent name skipped the file and still exited 0. Therefore `single` remains `null` and the loop must use the verified whole-file command.
- Browser acceptance: `bun run test:acceptance` completed with 1/1 Chromium test passing against the real application.
- Browser BDD: `bun run test:bdd` regenerated its bindings and completed with 1/1 Chromium scenario passing.
- Combined browser suite: `bun run test:e2e` completed with both the direct acceptance test and generated BDD scenario passing, 2/2 total.
- Browser single-test command: the known login test passed; the same command with a nonexistent name exited 1 with `No tests found`, so it is safe for isolated outer-loop Red/Green cycles. The exact whole-file command also passed 1/1 test in 63.026 seconds.
- Runner file command: `bunx jest src/__tests__/engine.test.ts --runInBand --forceExit` completed with 1/1 suite and 4/4 tests passing in 1.798 seconds.
- Runner suite: `bun run test` completed with 5/5 suites, 20 passing tests, and 1 todo in 2.220 seconds.
- Runner coverage: `bunx jest --coverage --runInBand --forceExit` completed with 5/5 suites, 20 passing tests, and 1 todo in 2.224 seconds.
- Runner Jest name filtering has the same false-green behavior as the application stack, so its `single` command also remains `null` and the loop must run the whole file.

## Missing or deliberately unverified capabilities

- **Mutation testing is absent.** StrykerJS is intentionally not installed yet. Verification must use recorded deliberate-mutant spot checks for the highest-risk changed behaviors until the separate mutation bootstrap is complete.
- **Property-based testing is available but has no repository exemplar.** `fast-check` and `@fast-check/jest` are present in the manifest and lockfile, but no artificial property test was created merely to verify the dependency. The first requirement with a genuine invariant should add the first exemplar through the normal Red-Green-Refactor loop.
- **Watch and Playwright UI modes were not verified.** `bun run test:watch` and `bun run test:e2e:ui` are interactive human workflows and were not recorded as non-interactive profile commands.
- **Approval and assertion-snapshot testing are not established.** Jest supports snapshots and Playwright can support visual snapshots, but the verified suites contain no snapshot exemplar. Failure screenshots and traces are diagnostic artifacts, not approval tests.
- **No dedicated contract-test tool is configured.** HTTP route and module contracts continue to use Jest, while browser contracts use Playwright.
- **Browser coverage instrumentation is not configured.** Jest coverage remains the code-coverage gate; Playwright supplies entry-point acceptance evidence rather than a second coverage percentage.

## Notes and constraints

- The default application coverage suite takes about 153 seconds, so it is too slow for every inner-loop iteration. Use the verified whole-file Jest command for Red/Green cycles, then run `bun run test:coverage` before completing each slice or commit.
- Browser cold starts take about one minute. Use the safe Playwright name or file command while developing one acceptance behavior, `bun run test:bdd` for Gherkin changes, and `bun run test:e2e` at the completed-slice and CI gates.
- The authoritative CI gates are Jest coverage, the complete Playwright/BDD browser suite, lint, typecheck, incremental Prettier checking, build verification, and the conditional Runner suite.
- Neither the application Jest suite nor Playwright requires credentials or a shared database. Tests use mocks, local PGlite, and the isolated Playwright environment; never inject production secrets into test commands or this profile.
- In this managed Windows workspace, Playwright and Runner Jest verification had to run outside the filesystem sandbox because sandboxed reads of installed modules returned `EPERM`. The same commands completed successfully outside the sandbox; this is an execution-environment restriction, not a repository test failure.
- The Playwright-managed Next.js process intentionally uses Node internally because the application's native Sentry dependencies do not support Bun reliably. Bun remains the package manager and command runner for the test workflows.

## Proposed constitution principle (not yet applied)

The repository constitution remains an unfilled template and has no active testing principle. Applying a principle requires explicit approval through the constitution-management flow. Proposed text:

### Test-Driven Development (NON-NEGOTIABLE)

Every behavior change is driven by a test that failed first.

- A test exists and has been observed failing for the right reason before the code that makes it pass. The failure output is recorded in `specs/<feature>/tdd/cycle-log.md`.
- Test tasks are mandatory. `tasks.md` places each behavior's test task before its implementation task, and implementation does not start until that test is Red.
- Tests are never weakened, skipped, deleted, or filtered out merely to reach Green. When a test and the implementation disagree, `spec.md` determines which must change.
- Every acceptance criterion in `spec.md` has an acceptance test against the highest verified real entry point.
- Refactoring occurs only while the relevant suite is Green and does not silently change expected behavior.
- Test strength is verified through changed-file mutation testing where available, or recorded deliberate-mutant spot checks where it is not.
