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

US1 remote -> US2 discovery/import -> US3 galleries/embed -> US4 Creator Pages -> US5 runners. Each operation’s evidence precedes its production adapter. Foundation catalogue validation is its own slice. Final compatibility/quality/report phase. External-only installation/actual public-host checks are recorded as scoped blockers, not reasons to stop local work.
