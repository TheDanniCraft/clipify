# Implementation Plan: Free Runner and Pro Broadcasting

**Branch**: `plan/free-runner-branding` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: `specs/004-runner-free-pro/spec.md`. Scope is confirmed for planning. Product tests and implementation are not run by this command.

## Summary

Make basic self-hosted Runner access free with unlimited hours, manual control, one active owner-wide broadcast and one destination. Pro adds multiple concurrent broadcasts across devices, simultaneous outputs from one capture, local scheduling through installed HeroUI Pro Agenda, optional attribution and custom standby. Keep Clip playback / Live fallback independent of Manual / Scheduled controls. Watermark only the frontend content Clipify generates, never ordinary overlays or incoming live input.

Extend current heartbeat polling, introduce shared transactional admission and derived Runner capabilities, persist named destinations/schedules/branding, and add local signed schedule cache/journal plus graceful playback drain. Retire the standalone Runner entitlement/product and agency Runner seats. Effective Pro alone unlocks advanced Runner features; preserve valid Pro grant/trial/creator-seat lifetimes. No monthly quota, fallback multiplier, new hosting service, analytics project or unrelated feature is added.

## Technical Context

**Language/Version**: TypeScript6.0.3, React19.3.0, Next16.3.8; Bun package manager, Node app/runtime where required by existing native dependencies.

**Primary Dependencies**: `@heroui-pro/react`^1.0.0-beta.10 Agenda; `@heroui/react`^3.2.6; Drizzle/PostgreSQL; existing auth/principal services; Puppeteer25.12/puppeteer-stream3.0.23; shipped FFmpeg; OS keyring. Use the installed calendar/date library as a declared direct dependency where new production imports require it. No new calendar vendor or external infrastructure. Installed sharp0.35.5 may be declared directly for server raster normalization; validate its native build footprint.

**Storage**: PostgreSQL schema sources, encrypted server credentials, normalized owner-scoped small raster bytea assets, local protected atomic config/schedule journal and OS keyring fallback. No quota accounting storage.

**Testing**: Jest30/Testing Library app; separate Runner Jest/SWC package; Playwright/playwright-bdd Chromium; native MCP workflow owner; isolated loopback PostgreSQL and generated media/RTMP receivers.

**Target Platform**: Current web app plus existing native Runner platform matrix, preserving build-config/manifest validation. No Windows/Linux/macOS support promise beyond current native matrix.

**Project Type**: Existing monorepo web application and self-hosted native streaming worker.

**Performance Goals**: On awake PCs, cached eligible schedules evaluated every<=5s and start observed within30s in fixtures. One capture/encode for compatible Pro target sets; bounded output queues. Scheduled end never queues another clip;60s no-progress /300s maximum drain watchdog. No hardware capacity or adoption-growth guarantee.

**Constraints**: Authentication/owner/team authorization remains unchanged; owner-wide Free admission serialized; device offline does not free occupancy. Retired Runner-only grants confer no Runner capability. No generated migrations on this branch. Preserve current coverage gates and execution ownership. No new streaming-time quota.

**Scale/Scope**: Five stories,23 functional requirements,13 edges and6 success outcomes; multiple devices, one Free active broadcast, multiple Pro destinations and local one-time/weekly events. No commercial Pro count cap; resource/validation safeguards are not plan tiers. One live-fallback input per installation initially due fixed ingest ports.

## Constitution Check

_GATE: evaluated before research and after design._

| Principle                      | Before research  | After design     | Evidence / condition                                                                                           |
| ------------------------------ | ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Test-first delivery            | Design compliant | Design compliant | Mandatory test tasks before each behavior; record Red/Green/refactor in tdd/cycle-log.md; no invented results. |
| Executable behavior/acceptance | Design compliant | Design compliant | All stories BDD/ATDD Required; scenario-to-binding-to-command registry materialized.                           |
| Determinism/isolation          | Design compliant | Design compliant | Fake clock/process boundaries; isolated loopback DB and receivers; clean all owned processes/assets/templates. |
| Traceability                   | Design compliant | Design compliant | Complete source/scenario registry, defect log and non-final summary.                                           |
| Small reviewable changes       | Design compliant | Design compliant | Five bounded implementation slices; retain compatible paths and avoid migration/API rewrites.                  |
| Quality gates                  | Design compliant | Design compliant | All tests/coverage/browser/lint/types/build/security/native gates blocking. No exceptions.                     |

No constitution violations require exemption. Design compliance is not product gate execution success. Installed Next guides for Server Actions and Route Handlers were read: authenticate each entry, await dynamic params, use Web Request/Response, do not rely on client-side action concurrency. Spec Kit setup returns directory basename as BRANCH by default; actual git branch above stays unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/004-runner-free-pro/
  spec.md, review.md, plan.md, research.md, data-model.md, quickstart.md
  contracts/runner-control.md
  contracts/schedules-and-presentation.md
  contracts/commercial-access.md
  test-traceability.md, defect-log.md, test-summary.md
  checklists/requirements.md
  tdd/test-list.md, tdd/cycle-log.md       # later TDD planning/execution
  tasks.md                               # later speckit-tasks, not generated here
```

### Source Code (repository root)

```text
src/db/schema.ts                         # additive source schema only
src/server/runner/{capabilities,admission,destinations,schedules,branding}.ts  # planned shared services
src/server/resources/{runners,workflow}.ts
src/server/mcp/workflows/{schemas,catalogue}.ts
src/app/actions/{runner,subscription}.ts
src/app/lib/{entitlements,billingCatalog,runnerScheduler,encryption}.ts
src/app/api/runner/{heartbeat,presentation,branding-assets}/
src/app/runner/presentation/[sessionId]/   # scoped generated presentation
src/app/dashboard/runners/[id]/           # Agenda/settings/status UI
src/app/components/overlayPlayer.tsx       # existing player and its helper modules
src/server/{billing,agencies}/             # history compatibility, new-purchase restriction
packages/runner/src/{index,engine,storage}.ts
packages/runner/src/{schedule,output,presentation,execution-journal}.ts      # planned runtime modules
```

**Structure Decision**: Extend existing monorepo, route control/resources through shared services, and keep authoritative state separate from UI. Planned module names are organizational decisions, not claims that files already exist. Use actual OverlayPlayer module directory during implementation.

## Complexity Tracking

No constitution exceptions. Admission/journal/version negotiation are necessary for concurrency, offline execution and recovery. A small runtime scenario binding adapter and loopback fixture are justified because browser-only tests cannot prove native encoding/retry/drain behavior.

## Phase 0: Research decisions

See [research.md](research.md). Local source and installed types resolve transport, Agenda capabilities, schema/billing history, asset storage, graceful-stop integration, FFmpeg recovery, old-client negotiation and current CI. All technical unknowns have explicit decisions. No production credential/database access occurred; the user authorized a hard cut of unreleased Runner-only commercial configuration.

## Phase 1: Design and interfaces

See [data-model.md](data-model.md) and [contracts](contracts/runner-control.md). Source schema introduces destinations/joins, schedule events/targets, branding/assets and admission state. Existing scalar targets normalize lazily on authorized edits; old identifiers remain interpretable. Shared owner lock serializes Free start/retry/stop through dashboard, MCP and authenticated Runner requests.

A signed local Pro cache carries a seven-day occurrence horizon, explicit timezone instants, revision and known expiry; local journal prevents replay. New starts after known expiry are blocked, active output completes its agreed transition. Free uses renewable signed execution leases: absence of heartbeat is uncertainty; recovery occurs only after terminal ACK or final lease expiry plus bounded output drain. Unlink/delete retains terminal-only acknowledgment authentication and never renews a revoked lease. Pro cached schedules retain the offline behavior described in the contract.

Frontend generated playback gets authenticated Runner-only branding and a drain protocol. Target fan-out shares encoding and isolates reconnection; telemetry reports target health. Existing incoming live stream-copy path stays unwatermarked. Rename visible modes without changing storage enums. Standby uploads use bounded normalized owner-scoped raster assets; no service provisioning.

## Delivery sequence and review boundaries

1. **US1 / US5 access foundation**: capability resolver, Free owner admission, UI/API/MCP/enrollment consistency, purchase retirement and scoped grant continuity. Preserve current Pro checkout/history. Test cross-entry-point races before enabling Free starts.
2. **US4 presentation**: authenticated Runner wrapper, four-corner attribution, preview and custom standby with asset validation. Add protocol negotiation so old clients cannot silently ignore policy.
3. **US2 outputs**: named destinations and shared encode/fan-out, protected keys, target status/retry and actual loopback receiver tests. Existing sessions normalize to one target.
4. **US3 automation**: Agenda/date adapter, schedule save/overlap validation, signed cache/journal, local restart behavior, drain command and adjacency/DST/manual override handling.
5. **Integrated release boundary**: expiry/grants/device deletion, protocol/native matrix, complete browser and workflow evidence, coverage/static/security/build gates. Enable compatible new-policy clients only after schema/app/native artifacts are available.

Each slice uses a draft PR by default if PR creation is later requested. Mark ready only at final review to trigger the full required Test gate. No PR, commit, deployment, production migration or billing mutation is performed by planning.

## Test-First Architecture & Quality Plan _(mandatory)_

### Test Suite Directory Structure

Keep established paths and explicit registry ownership, rather than moving current tests into a new tree:

```text
test/app/actions/runner.test.ts                       # TDD app entry contracts
test/app/lib/entitlements.test.ts                     # TDD effective benefits
test/server/runner/*.test.ts                          # TDD planned pure/DB services
test/app/api/runner/*.test.ts                         # TDD heartbeat/presentation/assets
test/app/components/runner/*.test.tsx                 # TDD Agenda/forms/branding
test/support/runner/                                 # shared deterministic data/receivers/clock
 test/bdd/features/mcp-workflows/runner-free-pro.feature   # BDD native workflow-owned
 test/bdd/steps/runner-free-pro-workflows.steps.ts          # native Playwright-step owner, no browser fixture
 test/support/mcp/runner-free-pro-probe.ts                 # established native execution adapter
 test/bdd/features/runner-free-pro.feature                 # BDD genuine browser-owned
 test/bdd/steps/runner-free-pro.steps.ts                    # browser binding
 test/atdd/features/runner-free-pro.feature                # ATDD distinct stakeholder journeys
 test/atdd/steps/runner-free-pro.steps.ts                   # browser binding
packages/runner/src/__tests__/*.test.ts                # TDD runtime modules/contracts
packages/runner/test/bdd/runner-free-pro.feature       # BDD/ATDD native runtime evidence
packages/runner/test/bdd/runner-free-pro.test.ts       # BDD runtime owning adapter
packages/runner/test/atdd/runner-free-pro.feature      # distinct runtime acceptance
packages/runner/test/atdd/runner-free-pro.test.ts       # ATDD runtime owning adapter
packages/runner/test/support/                         # package-specific receiver/clock adapter
```

Register native workflow scenarios in the existing workflow inventory so Playwright does not execute them too. Native MCP execution uses existing playwright.mcp.config.ts and step/probe fixtures under the workflows lane, not an extra browser run. Runtime binding consumes stable Gherkin IDs and validates every declared scenario executes exactly once; use the existing native Playwright step/probe owner without introducing a separate Cucumber stack; Jest owns distinct internal tests. True browser tasks (Agenda gestures, keyboard, preview, sales UI) remain browser-owned. Every scenario is assigned a concrete planned path, binding and owning command in traceability. TDD artifacts exercise internal contracts, validation and races; outer scenarios exercise real user/MCP/runtime boundaries. Do not copy identical assertions merely to create multiple practice labels. Preserve existing successful evidence when paths/refactoring change.

### Minimum Professional Test Reports

| Report                 | Artifact             | Status at planning                                               |
| ---------------------- | -------------------- | ---------------------------------------------------------------- |
| Test Plan              | plan.md              | Design populated                                                 |
| Inventory/traceability | test-traceability.md | Sources, owning paths/bindings and planned gates populated       |
| Defects                | defect-log.md        | Zero known product defects; explicit design limitations retained |
| Test Summary           | test-summary.md      | Not Run; No-Go until required execution evidence                 |

| Setting              | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Overall summary mode | rolling                                                                          |
| Release ID           | N/A                                                                              |
| Output path          | reports/test-summary.md                                                          |
| Rationale            | No release ID supplied; convergence later maintains one latest aggregate report. |

### BDD and ATDD Applicability

US1–US5: BDD Required, ATDD Required, TDD Required. No N/A practice decisions. Exact scenario/source rows are materialized in [test-traceability.md](test-traceability.md). A shared artifact carries both BDD and ATDD when the same observed outcome establishes the behavior and stakeholder boundary; it still has one owner and one execution command. SC acceptance journeys use existing ATDD ownership where distinct. No scenario sampling: all required declared option rows execute.

### Scenario Coverage Matrix and Traceability Materialization

The registry carries every stable specification scenario and TDD inventory ID, all US/FR/SC/EC source relationships, planned paths/bindings, command and status. Only the registry holds artifact execution state; only Quality Gate Results holds gate state. Source and scenario maps do not duplicate mutable execution fields. Implementation must populate executable bindings before corresponding code; a planned binding is not already implemented/passing. Contract-specific negative tests are appended before implementing newly discovered production behavior.

### Test Tooling and Gate Decisions

Inner loop app: `bun run test --runInBand --runTestsByPath <whole-file> --coverage=false`. Runner: from `packages/runner`, `bun run test --runTestsByPath <whole-file> --coverage=false`. Whole-file execution avoids false-green name filters. Completed slice: complete affected suites and owned browser/runtime scenarios. Do not repeat unchanged successful checks without new code or concern.

| Gate                           | Tool / required command                                                                                        | Threshold and blocking rule                                                                                                                | Evidence                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| TDD app                        | bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false (planned file) | Whole-file Red for intended reason, then all tests Green; log cycle                                                                        | tdd/cycle-log.md and CI output              |
| TDD/runtime                    | cd packages/runner; bun run test                                                                               | All package tests pass and clean owned handles                                                                                             | Runner job output                           |
| BDD native workflows           | node scripts/run-coverage-lane.mjs workflows                                                                   | Complete native scenario inventory, one owner for BDD/coverage; no skipped/foreign evidence                                                | test-results/mcp/, workflow lane coverage   |
| BDD browser                    | bun run test:bdd                                                                                               | Every browser-owned feature/binding passes; no MCP duplicates                                                                              | playwright-report/, test-results/browser/   |
| ATDD                           | bun run test:atdd plus shared runtime/workflow owner commands from registry                                    | Complete distinct/shared acceptance, zero missing scenario IDs                                                                             | browser/native artifacts                    |
| Full application coverage      | bun run test:coverage (local); CI six lanes then node scripts/merge-test-coverage.mjs                          | Existing global B50/F65/L60/S60 and existing per-path/MCP rules; missing/stale inventory fails                                             | coverage/coverage-final.json, lcov.info     |
| Changed critical code coverage | targeted app/package Jest explicit collectCoverageFrom and coverageThreshold                                   | New changed Runner modules L/S90,B85,F90; admission/benefit/credential critical services L/S/F95,B90; existing stricter baselines retained | coverage/runner-feature/, package coverage/ |
| Lint                           | bun run app:lint                                                                                               | Zero blocking errors                                                                                                                       | CI lint output                              |
| Formatting                     | bun run app:prettier:check                                                                                     | Zero changed-file format failures                                                                                                          | CI format output                            |
| Types                          | bun run app:typecheck; package bun run typecheck                                                               | Zero type errors                                                                                                                           | app/package CI output                       |
| Security                       | bun run audit:high; permission/credential/input-negative whole-file suites                                     | No new unaccepted High/Critical issue; retain existing documented audit ignore only                                                        | audit and relevant tests output             |
| Build                          | bun run app:build; bun run app:check-action-manifest                                                           | Both pass on intended environment; no action leak                                                                                          | build CI output                             |
| Runtime smoke/native           | bun run runner:build; node scripts/run-runner-self-test.mjs <built-binary>                                     | Official supported platform matrix and self-test pass; native build not replaced by mocked tests                                           | runner-native artifact logs/manifests       |
| Multi-output smoke             | package bun run test --runTestsByPath test/output.integration.test.ts                                          | Three loopback targets receive media, one failed receiver recovers without stopping others, no child/socket leaks                          | package test/receiver logs                  |
| Browser/regression             | bun run test:e2e                                                                                               | Acceptance/ATDD/BDD/compliance plus owning app journeys all pass                                                                           | Playwright HTML/JUnit/traces                |
| Migration policy               | bun run test:migration-policy                                                                                  | No protected generated migration mutation or override                                                                                      | guard tests/diff                            |
| Test strength                  | deliberate mutants in critical admission/expiry/drain paths, each via its whole-file command, then revert      | Tests kill each recorded mutant; no unrecorded surviving correctness defect                                                                | tdd/cycle-log.md, traceability notes        |

`audit:high` exists but is not a current CI job; implementation must wire its blocking execution/report into feature release validation or retain exact reviewed manual evidence. No new dependency-audit exception. True clock/timezone/permission/concurrency invariants may use installed fast-check, without demonstration properties.

### Coverage commands and policy

App targeted coverage example (native-probe wrapper required): `node scripts/run-mcp-coverage.mjs --runInBand --runTestsByPath test/server/runner/admission.test.ts test/app/lib/entitlements.test.ts --coverage --collectCoverageFrom=src/server/runner/admission.ts --collectCoverageFrom=src/server/runner/capabilities.ts --coverageDirectory=coverage/runner-feature --coverageThreshold='{"global":{"branches":90,"functions":95,"lines":95,"statements":95}}'`. Add every changed critical path to collected sources; do not allow untouched uncovered modules to be silently excluded.

Final Runner qualification from `packages/runner`: `bun run test:coverage`. This complete-inventory command collects all13 declared sources, enforces the critical95/90 per-file floors and unchanged ordinary90/85 aggregate baseline, validates raw counters and actual-source fingerprints, and rejects scoped arguments, missing sources, foreign owners or new skips. The sole inherited updater TODO remains explicit; it is not counted as a passed behavior. This supersedes the initial three-source example. Evidence is retained under `packages/runner/coverage/runner-feature/`; F1 results are recorded in the quality gate registry.

Six CI owning lanes: `unit,database-1,database-2,database-3,quiet,workflows`, each via `node scripts/run-coverage-lane.mjs <lane>`, then `node scripts/merge-test-coverage.mjs`. Keep one native workflow source/execution fingerprint. MCP thresholds remain scripts/check-mcp-coverage.mjs (S/F90; critical L95/B90, others L90/B85). No lower threshold exception is approved; any later exception needs scope, approver, compensating evidence and expiry.

### Environments and evidence retention

Tests use disposable loopback PostgreSQL databases, per-case isolation and job-owned schema-template cleanup. PGlite is permitted for isolated compatible pure/service tests; owner-lock/race evidence uses real PostgreSQL fixtures. Real media tests use generated clips and local receivers, never live Twitch/YouTube credentials. Fake timers/clock drive recurrence/drain/restart logic; browser end-to-end proves actual presentation and interactions. Keyring/native/process boundaries use deterministic adapters, with native smoke proving binaries.

CI stores coverage lanes/merged coverage/test-results/mcp and browser HTML/JUnit/traces for30days; native artifacts/manifests for7days; shared browser build for2days, matching current workflows. Retain versioned plan/traceability/defect/summary and TDD cycle evidence, link raw CI output rather than committing massive coverage/media logs. No audit/legal requirement needs extra reports. Draft checks do not satisfy ready/full Test gate; full master validation is retained unless identical source and execution inputs are proven.

### Red-Green-Refactor Execution Model

For each US1–US5: materialize the mapped outer Gherkin/binding and the first smallest internal whole-file test; observe the intended failure, record command/failure and source ID, implement minimally, rerun whole file, then refactor while green. Add one behavior at a time, including each invalid input/race/recovery class. Native workflow evidence can carry both BDD/ATDD and coverage under one owner; browser gestures remain distinct. Never weaken assertions, filter nonexistent tests or tick implementation tasks based on planned evidence.

### Entry, Exit and Release Policy

Entry to tasks: design/contracts and traceability exist, all source references resolve, spec agrees with unlimited hours. Entry to implementation: test-first tasks, executable bindings and complete TDD test-list materialized. Exit: every source has current Green evidence, complete owning suites/coverage/browser/native/static/build/security pass, no unaccepted High/Critical defects, saved grant/downgrade/old-client behavior verified. Missing/foreign evidence or failed mandatory gates blocks completion. No-Go during planning is intentional because production work/tests are unexecuted.

## Approved C1–C3 Execution Amendment

Every nonfinal behavior slice has a blocking complete-affected-suite, relevant browser/runtime and applicable coverage/static checkpoint before the next slice; final slices reuse story-completion gates. Avoid repeating identical unchanged evidence. Preserve published IDs and follow explicit dependencies rather than task-number order. Boundary cases are individually enumerated in spec/registry/tasks. ATDD-US1-SC001 uses test/atdd/features/mcp-workflows/runner-free-pro.feature and test/atdd/steps/runner-free-pro-workflows.steps.ts; the single native workflow lane must include its ATDD project exactly once and exclude it from browser shards. Planned routing tests precede configuration implementation. No runtime tests or production changes occurred during remediation.

## Confirmed launch decisions after pricing discussion

Ship Free + Pro at current names and current prices. No Plus/Lite tier, price increase, annual-only product, subscriber price-transition policy or release email is part of this feature. Pro includes all existing paid benefits and the planned advanced Runner benefits. Free hours remain unlimited, with one active broadcast and one destination across multiple registered devices. Local execution still runs on the user's PC.

Update src/app/components/Pricing/pricing-catalog.ts, comparison.tsx and existing pricing cards/setup copy; group Runner and broadcasting alongside existing feature categories rather than adding a tier or an oversized undifferentiated list. Produce a reviewable responsive UI using existing HeroUI styling; a gated HeroUI v2 example is design inspiration, not unavailable source assumed installed. Add feature copy and onboarding/billing consistency, remove standalone Runner offers and records; preserve unrelated Pro grants and saved broadcast configuration. Update src/app/llms.txt/llms.txt and src/app/llms-full.txt/llms-full.txt, verifying served routes/src/app/lib/llmsContent.ts reflect the same plan limits, unlimited hours, local scheduling/connectivity and effective-Pro-only advanced access. No email is sent by these tasks.

I1: stable identity, captured active occurrence and server-enforced edit/delete locks; User Stop switches to Manual; explicitly re-enabling Scheduled control catches up to an ongoing window and retains its original end. U1: renewable Free lease with bounded local drain and terminal-only tombstone ACK. I2: focused native workflow Red/Green without coverage; full workflows coverage only at completion gates under the same owner. A1: measurable fixed translucent watermark and overlay collision handling. A2: multi-day/week schedules, DST-local boundaries and mobile day/editor support. These are planning resolutions; all product evidence remains Planned/Not Run.

### Native development command amendment (I2)

Native BDD Red/Green: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`. Native ATDD Red/Green: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=atdd-chromium mcp-workflows/runner-free-pro --workers=1` (existing ATDD project routed to native config by planned C3 work). Both execute the whole owning Runner feature, never test-name fragments, using the same step/probe and disposable fixtures with NODE_V8_COVERAGE unset and no instrumented server. Fixtures must permit uninstrumented development; coverage environment retains existing hooks. The completion gate remains `node scripts/run-coverage-lane.mjs workflows`, executing complete current inventory and coverage under that same owner. Jest internal tests use their whole-file --coverage=false commands. These command routes are planned; do not claim they pass before bindings/config exist.

## Historical execution amendments

The execution notes below record the original implementation sequence. Any references to retaining historical Runner entitlement/grant fields are superseded by the user's 2026-10-18 hard cut, the Summary/Constraints above and the current UX correction tasks. They do not authorize restoring retired product, entitlement or agency-seat paths.

## Implementation ordering clarification — 2026-10-15

A125/U125 (schedule edit permission) is owned by D1, and A126/U126 (standby edit permission) by E4. A3 has no real schedule/standby edit entry yet. Their original task and evidence IDs remain mandatory, now physically located before the owning slice implementation, retaining native authenticated boundary evidence and internal rollback contracts. No missing-tool response or unrelated configuration edit substitutes for either check. This removes a circular delivery prerequisite without dropping requirements or changing product scope. D1/E4 cannot complete until these artifacts are Green; feature and US1 final acceptance remain No-Go while they are pending.

A3 owns atomic reservation and shared dashboard/MCP policy while retaining the existing single scalar destination. A4 owns public idempotent control replay (U238/T104), signed renewable dispatch and terminal recovery; B1 owns normalized multiple destination configuration and its Free cap. T099 is scoped accordingly rather than requiring future interfaces to close A3. Free output remains gated until official v2 lease enforcement is integrated. All original public retry, permit-binding and target-limit requirements remain mandatory at their owning slices and final release.

### Native lease/drain dependency clarification (2026-10-15)

A4's server lease/control behaviors run first. A5 T113–T120 then provide the shared, test-first graceful drain primitive needed by A4 native expiry/journal wiring: the inspected Engine.stop() currently destroys capture/kills output immediately, and the player has no drain hook. Resume A4 native integration after that primitive's behavior Green/refactor checkpoint. Complete both T664 and T665 against the final combined source before A6; reuse one qualifying full-gate execution only under unchanged source/input and existing execution-owner rules. This resolves implementation order, does not reduce behavior/coverage/gates, and preserves all task/artifact/acceptance IDs.

A6 implementation detail: the owner-serialized admission reservation also enforces one independent live fallback ingest per installation, including reserved/draining/uncertain generations. Capture ingestModeAtStart in the existing safe immutable benefitsAtStart JSON; later session mode edits cannot release an existing ingest. Missing captured mode is conservatively occupied for fallback; acknowledged terminal closure or existing bounded Free lease recovery releases it. Pro clip broadcasts and separate devices remain available. Expected scheduling/ingest/retained-source denials return branded safe business results before requested mutation and success audit; MCP preserves denied activity and its isError envelope. Runner action reporting excludes known business denials while retaining unexpected failures. No extra generated migration or new persistence column is required for this metadata.

A7 evidence ownership correction (DEF055): A136/ATDD-US1-SC006 observes an API admission denial, so its genuine native MCP scenario is owned by test/atdd/features/mcp-workflows/runner-free-pro.feature and the shared ATDD binding. U136/TDD-US1-SC006 is owned by the direct admission service tests. The client polls permitted jobs and cannot observe a rejected Start request. Real encoded continuous-playback/month-boundary proof remains A135/BDD-US1-FR023 in the native runner package, with U135 exercising the real local lease controller. All artifact/task IDs and product criteria are retained; no mock denial, duplicate role execution or quota is introduced.

A7 U135 uses the existing packages/runner/src/**tests**/execution-runtime.test.ts fixture and FreeExecutionController, rather than inventing a schedule module for a no-quota lifecycle rule. Future scheduling remains in D; the artifact ID and actual native media observer are unchanged.

A7 app inner admission ownership uses test/server/runner/admission-acceptance.test.ts: the existing direct owner-lock case is moved intact (retaining TDD-US1-CON001 and adding its SC001 trace), and the distinct long-history denial case is added there. Remaining admission regression assertions stay in their original whole-file owner for the story gate. This keeps development whole-file checks scoped without duplicating an execution or hiding existing regressions.

## Expected Runner error handling

Expected user decisions (plan restrictions, invalid input, concurrency/recovery limits and configuration conflicts) return a structured safe failure to dashboard/MCP callers. New Runner features must not introduce an uncaught `throw new Error("FEATURE_RESTRICTED")` or report expected denials as Sentry incidents. If an existing transaction needs an internal exception to roll back, catch and translate it at the shared boundary; retain monitoring for unexpected infrastructure and programming failures. Current enforcement is covered by `test/app/lib/runnerBusinessErrors.test.ts` and the returned-versus-thrown assertions in `test/server/runner/manual-configuration.test.ts`. Apply the same contract to the remaining destinations, scheduling and presentation work.

B1 U247 diagnostic ownership: the FFmpeg stderr/log contract runs in the existing native `packages/runner/src/__tests__/engine.test.ts` owner under TDD-US2-CON005. Other distinct destination storage/validation atoms remain in the app destinations owner. An app-side string helper cannot prove the actual native logger is safe. This corrects the technical observer while preserving the artifact, task and source IDs and one execution per atomic case.

B1 workflow-owner extraction: move the eight named-destination cases and their bindings intact into `test/bdd/features/mcp-workflows/runner-destinations.feature` and `test/bdd/steps/runner-destinations-workflows.steps.ts`. The whole-file development command uses `mcp-workflows/runner-destinations`; the unchanged milestone workflow lane still executes the complete inventory once. This preserves every published scenario/artifact ID and assertion while keeping development cycles scoped to the changed behavior. The45 US1 cases remain in their existing whole-file owner. Extraction evidence is `tdd/evidence/B1-destination-owner-extraction.json`.

B1/B2 unit-owner extraction after the qualified B1 checkpoint: move the complete37-case destination CRUD/credential/legacy editor owner unchanged from `test/server/runner/destinations.test.ts` to `test/server/runner/destination-editor.test.ts`. B1 registry/test-list/task routes follow the new whole-file owner. B2 retains the original planned destinations test path for selection/admission behaviors, so its development cycles do not replay37 unchanged editor cases. No public behavior/artifact IDs or assertions change; final complete suites discover both once. Byte-identical source proof is `tdd/evidence/B1-editor-owner-extraction.json`; baseline the moved whole file before materializing B2.

B2 workflow technical ownership: materialize its five existing FR006/FR007/OPT010–012 artifacts in the dedicated `runner-multistream.feature` and `runner-multistream-workflows.steps.ts` whole-file route. The45 retained Free cases stay in their existing file; full milestone workflow discovery still executes the complete inventory once. Public IDs/criteria/roles remain unchanged. This prevents every B2 development cycle replaying unrelated Free scenarios.

B2 output ownership: the shared encode's independent bounded copy queues live in `packages/runner/src/output.ts`, as planned. Include this new source in the native changed-source coverage inventory (general L/S90,B85,F90 thresholds), alongside existing index/engine/presentation and six critical execution/credential modules. Root owns protocol/clock coverage. Do not retain the B1 nine-file native report as current-source B2 qualification.

B2 fan-out detail: one capture/H.264-AAC encode writes MPEG-TS to a shared pipe. Independent stream-copy FFmpeg sinks receive that stream through bounded per-target FIFO queues. This implements the planned logical tee without serializing credential-bearing URLs into FFmpeg's nested tee option grammar; every target stays a literal argv value and one blocked sink cannot stall the shared encoder. B3 adds retry/status and proves literal-argument safety, recovery and stop fencing. This technical choice does not change any artifact ID or product criterion.

B3 UI failure follow-through (within existing T228): report normal Start/Stop failures visibly; ensure a previously selected destination with a cleared required key can be removed from selection; distinguish configuration-save validity from Start readiness. Add the relevant component/action observations under the existing FR008/EC005 artifacts before their production changes. Current B2 runtime credential validation remains authoritative.

D1/F1 active source follow-through: freeze the source revision used for active admission signatures when implementing captured occurrence/presentation configuration. A later overlay configuration revision must not silently change an active Free lease's binding. Keep inactive/new starts on the current revision. Test the active-edit and renewal boundary under the existing captured-configuration/signature contracts before implementation.

B3 real-media ownership refinement: `packages/runner/test/output.integration.test.ts` owns the single three-receiver execution for ATDD-US2-SC002 and TDD-US2-CON007. One beforeAll fixture run supplies distinct content/continuity acceptance assertions and internal decoded-packet/process/socket-cleanup assertions. The ATDD Gherkin remains `test/atdd/runner-free-pro.feature`; avoid a second full media invocation just to attach the acceptance label. Update planned technical paths/commands before materialization, preserving stable IDs and all three providers/receiver recovery/cleanup requirements.

B3 telemetry detail: persist only safe target-ID/state observations on the admission, bound to its owner/device/session/generation/current permit and captured target IDs. Extend existing active execution acknowledgments and explicit public dashboard/MCP session projections; do not store credentials/raw FFmpeg diagnostics or mutate immutable benefits snapshots. Add the shared lease/projection/schema source paths as necessary for that same planned heartbeat/dashboard behavior. `test/server/runner/output-status.test.ts` owns the real authenticated persistence/projection contract alongside native unit evidence under existing TDD-US2-FR008. No new artifact IDs, generated migration or commercial limit is introduced.

C1 technical browser ownership: materialize commercial/pricing/checkout scenarios in runner-commercial.feature and runner-commercial.steps.ts under the existing browser project, rather than replaying native/manual device scenarios in every pricing loop. Preserve all six primary C1 BDD IDs and source examples. Whole-file development command selects /bdd/runner-commercial.feature.spec.js$; milestone/final discovery still includes that owner exactly once. Billing writes remain mocked in controlled internal tests; browser retirement journeys do not submit payment or invoke live billing services.

C1 checkout consumer compatibility: generateCheckout now returns a normal included-plan restriction alongside its existing URL result. Its existing callers in upgradeModal.tsx, settings/billing-panel.tsx and checkout/continue/route.ts must narrow that result before navigation; expected restrictions display a toast or pricing redirect. ProSetupModal.tsx owns removal of the optional paid Runner checkbox. These are necessary supporting paths for T270/T761, with actual action/browser evidence retained; no new product or checkout charge is introduced.

C1 onboarding retirement also updates OverlayTable/index.tsx, the Runner enrollment copy, and obsolete settings addon-query handling: these retained frontend guards still use legacy runnerAccess even though A1 already permits authenticated basic Runner creation. Remove paid gating at these entry points and retain server authorization. The commercial browser owner must create a Free Runner through the dashboard, not merely visit a seeded detail URL.

C1 agency result adapters: actions/agency.ts must project the returned included-plan restriction before navigation. Use the existing billingError feedback surface with the safe user-readable result message. Framework redirects belong outside mutation try/catch under the installed Next16 contract; they must not be captured as billing failures.

C1 responsive supporting repair: the new exact 390px pricing check exposes a 395px auto-sized flex child in the shared footer. Add explicit full-width/min-width bounds to that existing wrapper; keep all content and the no-horizontal-overflow assertion. This one CSS sizing change is part of the required desktop/mobile pricing review, with defect/evidence DEF-US5-089.

C2 technical ownership refinement: scoped legacy/agency Runner benefit eligibility belongs to a dedicated native workflow owner, runner-commercial-access.feature / runner-commercial-access.steps.ts, rather than replaying completed manual/admission/media scenarios on each grant-state cycle. Preserve all six published C2 BDD IDs and source examples; the new owner still participates once in the native workflow/coverage inventory. Whole-file focus is mcp-workflows/runner-commercial-access with the existing native configuration. Controlled inner commercial tests enter actual entitlement services separately from the public MCP mutation boundary. C2 proves eligibility to save Scheduled control and unrelated-Pro isolation; actual calendar occurrence dispatch remains explicitly unbuilt until the scheduling slices and must retain this same scoped eligibility. Do not claim a live scheduled window from an eligibility check. Already-correct grant behavior is recorded as a retained baseline with meaningful mutants, not an invented initial Red or gratuitous production change.

C2 policy correction: advanced Runner access derives exclusively from effective Pro. Retire Runner-only grant/allocation resolution and unsigned legacy heartbeat authorization. Native commercial examples exercise current Pro grants and creator seats, expiry/revocation and denial of retired benefit metadata. Historical cycle evidence describes the earlier policy and does not qualify this correction.

C3 technical ownership refinement before executable materialization: expiry-transition native scenarios use runner-commercial-transitions.feature / runner-commercial-transitions.steps.ts and complementary direct-service invariants use commercial-transitions.test.ts. Preserve all published IDs/source behaviors; the entire owner runs without coverage in each inner cycle, with complete affected previous commercial/admission owners at the milestone. This prevents replaying C1 checkout and C2 grant fixtures for every expiry change. CON015 retains capabilities.test.ts; genuine SC005 browser acceptance retains its browser owner. Materialize one atomic expiry behavior at a time, not all future C3 failures before the first production change.

C3 CON015/U277 technical ownership: retain the app capabilities owner for signed permission deadlines and add the existing complete native execution-runtime.test.ts owner for the distinct runtime contract: scheduled deadline requests bounded graceful drain, waits for current clip closure, then journals terminal output proof. One primaryCON015 artifact owns both complementary files; no duplicate acceptance label/execution. Default existing fixtures stay byte-equivalent in behavior. Native whole-file runs without coverage during this atomic cycle, all native/critical coverage at C3 milestone. Scheduled-window Given fixtures set trusted captured occurrence/end only before dispatch; calendar authoring/cache dispatch remainD1 and are not claimed by C3 expiry fixtures.

C3 metadata implementation ownership: add src/server/runner/benefits.ts for read-only owner-bound validity evidence, with lazy async exports through capabilities.ts so pure policy imports do not initialize a DB. Reuse existing effective entitlement resolvers; preserve caller transactions and historical raw Runner flags. Earliest known active paid deadline requests refresh; fresh authoritative resolution can retain another valid source. Billing current period is a known offline boundary, even for auto-renewal; no Stripe API calls or billing writes. New module remains critical95%S/F/L,90%B in its completed-slice gate.

C3 Green test-owner split: capabilities.test.ts retains15actual database/authorization/metadata cases; capability-policy.test.ts owns6pure policy/signature/clock cases. Original non-import TypeScript statement bodies are AST-canonicalized and hash-verified unchanged in C3-policy-owner-split.json. Development runs the current behavior's entire corresponding file without coverage; CON015/C3milestone runs both whole app files and the existing native runtime owner. No case/criterion/primaryartifact is removed or filtered; this prevents40second DB replay on each pure security boundary cycle.

C3 officialpoll integration uses the existing source-preserving compileRunnerCli adapter and whole heartbeat-protocol.test.ts owner, extending CON015's native ownership alongside execution-runtime.test.ts. New CLI evidence observes actual pollHeartbeat saving device identity only after signed snapshot verification and withholding cache rights after invalid/mismatched updates; adapted source preserves the complete production prefix. It remains helper integration evidence, not the official packaged/native startup gate.

C3 SC005 materializes its existing planned genuine browser owner at test/atdd/features/runner-free-pro.feature with test/atdd/steps/runner-free-pro.steps.ts. Development runs that complete feature on atdd-chromium after the current production E2E build; final ATDD/feature gates remain complete. Fixture setup/expiry and storage assertions use the existing guarded browserDatabaseUrl disposable loopback helper; user actions and rendered availability execute through real browser/server actions. No test-only product API or live billing/provider call is added. Existing legacy grant history and saved destination survive expiry, Scheduled becomes unavailable and the customer can explicitly select basic Manual. Primary ID/roles/source remain unchanged.

D3 native implementation ownership: packages/runner/src/schedule-cache.ts owns signed manifest/private payload validation, atomic protected snapshot/key references and OS boot/uptime anchors; execution-journal.ts owns nonsecret pending/active/draining/terminal identities and occurrence suppression. protocol.ts remains the shared purpose/signature/claim boundary. index.ts owns official polling/capability negotiation and the250ms local watchdog; it never starts hosted output. schedule.ts retains pure calendar expansion. The real-media A12 owner is packages/runner/test/bdd/runner-cached-schedule.test.ts bound to the single @BDD-US3-FR012 scenario in runner-free-pro.feature. Its shared drain-probe.mjs fixture runs actual production Engine, Chromium, FFmpeg and the presentation drain bridge. This replaces the planned runner-free-pro.test.ts alias for this artifact only; no extra scenario or acceptance execution is created. Both packages/runner/src/schedule-cache.ts and every changed shared protocol/runtime/journal/CLI path require explicit final-source coverage; current-source native evidence cannot be inherited from D2.

D4 implementation ownership refinement: the existing Engine.requestDrain in packages/runner/src/engine.ts and shared presentation.ts own drain behavior; no unused drain.ts module is introduced. CON010 retains drain.test.ts as its native boundary owner and uses the existing whole overlayPlayer.test.tsx owner for the distinct actual React prefetch/crossfade cancellation invariant. EC009 adds complementary execution-runtime/journal, terminal-delivery, heartbeat/terminal route and service owners because the playback-timeout outcome must survive physical closure, restart and unlink, then appear as a finite safe dashboard message. Shared PLAYBACK_TIMEOUT_MESSAGE resides in the browser-safe presentation.ts module; arbitrary native errors/credentials remain excluded. Existing whole owners run without coverage during development; no duplicate BDD/ATDD role execution is created. D4's full current-source gate remains mandatory.

D4 semantic evidence equivalence: EC009's no-progress example and OPT076 specify the same60-second stalled-playback outcome. They share one native real-media owning test tagged with both BDD-US3-EC009 and BDD-US3-OPT076; no second identical media replay is added merely for the label. OPT077 has its separate progressing-long-clip300-second case in that same owner. Inner CON010 exact no-progress/maximum-overrun boundary tests also carry the narrower TDD-US3-OPT076/U116 and OPT077/U117 identifiers; registry artifacts remain distinct source mappings, while physical execution is single-owner and counted once. This preserves every specified assertion and avoids inflating tests through identical label-only copies. The scoped whole-file runner still executes each owning case before qualification.

D4 shared outer FR013/SC003 ownership: the actual-watchdog real-media journey in test/atdd/runner-free-pro.test.ts owns both ATDD-US3-SC003 and BDD-US3-FR013. It includes the distinct start SLO and all FR013 media-end assertions (finish current clip, encode its last frame, start no next clip, close every resource); U13 separately retains the exact illustrative22:00/22:01 timing under controlled native dependencies. The single tagged scenario fulfills both mapped BDD/ATDD roles with equivalent setup/teardown and is counted once. It replaces only the planned FR013 runner-free-pro.test.ts BDD alias; other BDD boundaries retain their own runtime cases.

D4 exact-end refinement: native watchdog cadence alone leaves up to250ms in which an ended callback can advance. A verified scheduled Pro end must also reach the generated player as a monotonic deadline; advancement and snapshots enter drain at that boundary before queuing another clip. Manual Pro and renewable Free sessions receive no fixed schedule deadline. Translate the trusted native remaining interval into the browser performance clock conservatively (subtract browser-RPC elapsed time) before navigation; carry browser epoch-relative performance time across navigation and expose only its local deadline/generation. Native authority remains the source of output shutdown and the300-second hard upper bound. Unit/component and real-media exact-end Red evidence are required before this change.

D4 after-end equivalence: OPT040 is the same already-covered after-end media-boundary outcome as FR013. The shared actual-watchdog FR013/SC003 journey also carries BDD-US3-OPT040; its matching native progressing final-minute case carries TDD-US3-OPT040/U80. Both verify current clip continues after the original end and no following clip starts. One physical owning execution provides these equivalent acceptance labels; no repeated identical replay is added.

### D5 existing execution ownership

D5 follows the actual native entry points established by D3/D4. `schedule.ts` currently re-exports calendar conversion; admission, physical-engine ownership and terminal receipts live in `execution-runtime.ts`, with real cached dispatch in `index.ts`. Handoff must therefore be verified and implemented at those owners rather than introducing a disconnected calendar-only transition helper. The outer FR014 case uses the same signed-cache/actual-CLI-watchdog/real-media fixture as D4, with two adjacent independently signed events and distinct destinations. Its observation is whether the second actual encoder opens before the first clip's ended event; final-frame and first-event physical closure assertions remain. Inner controlled pending-closure/receipt assertions belong in `execution-runtime.test.ts`; update source and traceability aliases as each behavior is materialized. Overlap validation remains server-owned and must preserve the prior persisted schedule. Preserve original occurrence identities, half-open windows, every existing signed authorization check and the distinction between a saved future authorization and physically running outputs. Full slice qualification remains T675.

D5 semantic equivalence: FR014 and OPT048 both describe adjacent events with different destinations waiting for the earlier current clip. They share the one actual-watchdog handoff case and its complementary physical-closure controller case. Preserve both IDs as aliases and retain their original Red; do not add another media execution solely for the second label. The controlled fixture uses distinct actual RTMP endpoints as well as distinct target identities. OPT049 remains a separate expired-successor case.

D5 on-Green media owner refactor: `runner-schedule-transitions.test.ts` owns the three adjacency/handoff cases (FR014/OPT048, OPT049, OPT046/DEC010), while the original `runner-free-pro.test.ts` retains all ten independent output/calendar/drain cases. Run the focused complete transition file during subsequent D5 development and both complete files plus every shared-probe consumer at the completed-slice gate. The feature declarations remain in runner-free-pro.feature; only executable ownership changes. This replaces the original mixed-file command for D5-specific artifacts and preserves the complete scenario inventory and coverage thresholds.

D5 overlap ownership correction: OPT037 is a calendar save behavior, executed through the existing authenticated browser schedule editor (`test/bdd/features/runner-free-pro.feature`, `runner-schedule-contracts.steps.ts`) and the actual server transaction owner (`test/server/runner/schedules.test.ts`). A native Runner has no calendar-save service; do not invent one or create an unbound native feature declaration. Retain stable IDs and map complementary existing prior-day overlap/rollback proof to the internal behavior after current-source fault verification.

D6 executable ownership follows D5's established real controller/CLI entry points. Use focused `packages/runner/test/bdd/runner-schedule-recovery.test.ts` for recovery/control media cases and the existing `drain-probe.mjs` real signed-cache/CLI-watchdog/Chromium/FFmpeg fixture. Keep declarations in the native feature. Reuse the existing CON008 controlled suppression-before-drain/fresh-controller replay test as complementary EC010 evidence rather than duplicate assertions; retain both stable IDs once current-source characterization is verified. Calendar-only schedule.ts remains conversion ownership, not an invented lifecycle facade. Stop and Pause remain separate constituent behaviors; no pending pause, restart, newer-cache reconciliation or high-water suppression behavior is implied complete by the first Stop case.

D6 OPT088's genuine UI boundary belongs to focused `test/bdd/features/runner-schedule-control.feature` with existing authenticated schedule step helpers, not a native-only stand-in. Run that complete feature during its developer loop; run all affected browser features at the D6 milestone. Complementary persistence/authority tests belong to the existing shared server schedule service probe/owner. EC010's Pause/native-cache constituent remains separately mandatory before its parent can complete.

D6 lifecycle ownership correction: the six recovery/clock/cache-horizon/terminal-ACK cases live in `packages/runner/src/__tests__/schedule-recovery.test.ts`. The original `schedule.test.ts` retains all39 D5 calendar conversion cases byte-for-byte. Runtime recovery and durable suppression remain owned by execution-runtime/journal tests; lifecycle registry paths must not overwrite calendar ownership.

### E1 generated-presentation execution ownership

Use focused `test/bdd/features/runner-presentation.feature` and `test/bdd/steps/runner-presentation.steps.ts` for genuine presentation journeys, preserving the existing artifact IDs and role mappings. Begin with A96/U96 (Free generated standby), the smallest generated surface, before extending the same E1 implementation to playback and live fallback. Active-session fixtures use a real owner, assigned device, generation and accepted admission; the browser requests the real authenticated presentation endpoint and renders the returned page. Keep API status observations in When and assertions in Then so a missing product endpoint is an intended assertion failure rather than a Given/setup failure. Development runs the complete focused feature without coverage; the E1 milestone retains all affected browser/native owners. No future scenario is materialized ahead of its constituent cycle.

E1 live/generated boundary ownership: FR016, OPT055 and OPT057 share the focused real-OBS-input -> generated-fallback -> returned-live encoded-output journey in runner-presentation.feature. The single native probe uses the actual Engine and authenticated Next Page, a seeded controlled media provider and actual loopback RTMP receivers. Assert real clip progression, generated blue frames with visible attribution pixels, and plain red incoming/returned frames without those pixels. Keep all three stable IDs/roles and their individual boundary assertions, but count one physical journey. Complementary internal policy transitions share one pure case; do not run duplicate media merely to attach another ID. Ordinary output and generated standby/playback remain independent browser cases. Reuse the repository's explicit capture WebSocket cleanup pattern. All owning workflows/native/browser and coverage remain required at E1 qualification.

### E2 focused browser owner and existing fixture seam

Use `test/bdd/features/runner-branding.feature` with `test/bdd/steps/runner-branding.steps.ts` for genuine E2 appearance journeys, preserving every existing artifact ID, example and BDD/ATDD role. This replaces the planned catch-all runner-free-pro browser paths for E2 only; the complete existing browser inventory remains required at the slice gate. Development executes the entire currently materialized focused feature without coverage through the existing Playwright browser profile, not native MCP workflows or test-name filters. Materialize one behavior at a time.

Before A17, expose the existing real presentation fixture in `test/bdd/support/runner-presentation.ts`. The fixture function body is byte-identical, with only the already-returned owner-cookie type exposed for dashboard authentication. E2-fixture-seam-extraction.json records the identity proof; E2-fixture-seam-green.log retains all four genuine presentation/media journeys. No product behavior or assertion changes in this structural step.

E2 atomic persistence refinement: the approved owner/revision profile design needs distinct inner examples for first save, stale revision, unauthorized save/read, invalid corner, failed transaction and no-row default. Append U278–U284 under the existing TDD-US4-FR017 primary artifact, with T1019–T1026; no new product requirement or primary artifact. Existing broad T586/T757/T758 remain full-E2 integration gates, while each constituent implements only after its own applicable outer/inner Red. Never batch future missing cases just to unlock a broad production task.

E3 known-expiry evidence refinement: T596 already requires baseline branding/standby without stopping active output. A180/U288/U289 explicitly qualify the loaded renderer: half-open captured paid deadline, local mounted transition, stable video child/generation, retained admission/settings and timer cleanup. BDD-US4-EXP001 is genuinely browser-owned; TDD-US4-EXP001 uses the existing app Jest owners. C3 commercial workflows retain their execution owner and are not duplicated to attach another label. T1030–T1033 provide test-first order; no product/pricing scope is added.

E3 effective-renewal refinement (DEF210, T1040–T1042): the captured deadline remains the offline fallback, not an immutable appearance entitlement. Add a private no-store GET at `/runner/presentation/[sessionId]/policy`, authenticated by the existing scoped HTTP-only presentation cookie and current matching active execution. Resolve current owner benefits and owned saved choice without changing captured admission/source/targets. Mounted output refreshes at most30seconds apart and before a known deadline; invalid/failed refresh retains the last finite deadline. Authoritative extension updates only appearance state, never the playing child or execution generation. U294 remains within A180/EXP001, with no duplicated commercial workflow owner.

E3 native coverage execution refinement: the complete current51-owner native gate has439 passes plus the unchanged inherited TODO. Its15 BDD and1 ATDD owners spawn independent Node media probes and import only Node built-ins; Jest does not instrument those child processes and they contribute no Runner counters. Preserve their actual current-source execution once, checking all103 native execution inputs remain identical. For additional source coverage, execute all35 in-process unit/integration owners in E3-native-instrumented-owners.json with explicit unchanged13-source collection and existing thresholds. This adds coverage instrumentation without repeating the16 already-qualified physical media owners. No test configuration, test assertion, source map, threshold or native scenario inventory is changed or omitted from qualification. Final owning CI lanes remain unchanged.

E3 existing-core coverage ownership clarification: collect the complete legacy OverlayPlayer.tsx alongside every changed Runner module. Its retained E2 whole-owner baseline is S89.02/F88.2/L93.93/B77.55, above the existing repository global floors; preserve each measured per-path floor. Separately require ordinary Runner90/85/90/90 coverage for the newly affected Runner presentation/content/selection/reservation counters, retaining the explicit selected source lines and counters. This applies the existing-module baseline rule without imposing the new-module floor on unrelated legacy clip-player behavior. All new/changed Runner modules and critical admission/benefit/credential paths keep their existing90/85 or95/90 floors. PlayerOverlay's new reservation component is collected explicitly despite its pre-existing global exclusion. No repository coverage configuration or threshold is lowered, and no changed source is silently omitted. E3-legacy-player-coverage-baseline.json retains the pre-run source/report identity and exact old metrics.

E3 critical statement-floor verification: the mandatory table's critical S/F/L95 and B90 floors are enforced explicitly by the current feature gate. The shared MCP helper defaults statements/functions to90; the prior E2 feature wrapper added critical functions95 but did not add statements95. E3 checks both explicitly. Prior file-level evidence is retained honestly (destination service statements94.63 in E2); it must not be described as having passed a95 statement check. Current qualification must remedy any remaining statement gap without lowering the planned floor.

E4 first permission constituent ownership: the authenticated saveRunnerBrandingProfile Server Action was introduced in E2 and is the shared generated-standby appearance write entry, reused for E4 custom fields. A126 exercises its existing valid Pro attribution/corner payload after revoking the operator's membership, with a successful positive control before revocation and a still-valid authenticated session afterward. This is actual standby appearance editing, not an unrelated MCP tool or missing entry. Record an honest retained baseline if already Green, then add the distinct internal U126 boundary before subsequent custom-standby behavior. E4 custom fields will keep this central write authority and its owning regression.

E4 browser owner extraction after the A99/U99 qualified color cycle: move only the complete BDD-US4-OPT059 scenario unchanged into `test/bdd/features/runner-standby.feature`; its shared binding remains unchanged. Subsequent E4 custom standby scenarios use this complete owning feature, while the42 original configuration/calendar/paid-attribution scenarios remain byte-identical in runner-free-pro.feature. All existing roles, tags, assertions and artifact IDs are retained. Development executes the entire standby owner without coverage and without test-name filters. E4 completion still executes every affected browser owner and full integrated gates remain mandatory. Exact extraction proof: `tdd/evidence/E4-standby-owner-extraction.json`. Baseline the moved owner before adding the next behavior.

E4 asset transport refinement: owner-authenticated POST /api/runner/branding-assets accepts bounded raw file bytes with owner/Runner/kind metadata in query parameters; the2MiB limit counts actual file bytes, with no Server Action body expansion. Upload normalizes and stages an owner-scoped opaque asset; Save appearance atomically references it, preserving the old saved reference on invalid/failed uploads. Preview image responses use /runner/preview/[runnerId]/assets/[assetId] with verified owner permissions. Generated image responses use /runner/presentation/[sessionId]/assets/[assetId] under the existing session-cookie path, active execution and exact saved reference checks. Do not broaden the presentation cookie to unrelated routes or fetch arbitrary external URLs. Detached-reference cleanup occurs only after a successful profile commit.

E4 SC004 ownership refinement before materialization: dedicated `test/atdd/features/runner-standby.feature` / `test/atdd/steps/runner-standby.steps.ts` owns the new Pro custom-standby/corner/real preview-control journey, avoiding replays of unrelated commercial acceptance during each development cycle. Existing E1 ordinary-overlay/live-forwarding source-isolation cases already carry both required roles and remain a mandatory shared current-source part of the SC004 rollup at the full E4 gate; do not create a second identical real-media execution just to add the story label. Inner SC004 retains branding.test.ts for the canonical profile contract and adds the existing complete preview-editor/client-renderer owners for distinct mode/clear/collision contracts. Preserve all source IDs and final gates. Clear controls must preview removal before Save, and only committed saves detach asset references. Preview controls affect only the owner iframe, never the assigned playing output.

E4 boundary technical ownership before materialization: unchanged exact BND012–030 examples use dedicated complete browser owners `runner-standby-text-boundaries`, `runner-standby-bytes-boundaries`, `runner-standby-dimensions-boundaries`, `runner-standby-pixels-boundaries`, and `runner-standby-formats-boundaries`, with shared `runner-standby-boundaries.steps.ts`. Existing destination/calendar boundaries stay unchanged in their original owner. Each atom is materialized and both complete current inner/browser owners executed before the next atom; no sampling, unbound future cases or test-name filtering. The fields/parser safety constraints already introduced by prior qualified behavior cycles are characterized as honest retained BASELINEs when they work, never manufactured Reds. The final E4 gate executes all owners. Inner message cases retain branding.test.ts; raw upload byte/decoder/transaction cases retain branding-assets.test.ts. Genuine browser uploads exercise real Sharp and persistence; controlled inner decoders isolate reader/bounds/staging contracts.

E4 rejection evidence refinement: EC012 and OPT078/079/080 reuse the exact unsupported-SVG, 2097153-byte oversized-file and unreadable-raster examples BND028/017/030. Each browser example already checks visible validation, byte-equivalent saved profile/assets and the old image/message after reload. The corresponding API examples refuse before storage; actual decoder and normalized storage are covered by the neighboring accepted cases. Attach both primary artifact labels to each existing physical case and rerun its complete owner once. EC012 rolls up all three examples across the byte and format owners. No criterion, example, sample or required execution is removed; counts remain physical cases, not artifact aliases.

E4 OPT094 ownership refinement: outside-window standby prevention belongs to the native schedule execution guard, before content selection/capture. Its outer native BDD/ATDD owner persists a real signed schedule cache, restores credentials/authority in a genuinely fresh process, prepares the valid job, and verifies zero engine construction, content reads/output starts and journal mutation both before and after the window. An empty content provider is configured behind the guarded engine seam; no encoded-media claim is made for this negative invariant. The inner native recovery owner checks signed future authority without the cache/process layer and retains existing ended-window cases. Replace the originally planned browser/settings and generic branding-service locations with these exact owners. No duplicate native workflow or browser policy simulation is added; all genuine visual standby journeys remain browser-owned.

## Runner review refinements (2026-10-19)

Restore icon-only Unlink with the existing Unlink icon and accessible tooltip; place Appearance as a full-width secondary action at the bottom of configuration. Use the shared Pro crown for locked scheduling. Center the content-sized Appearance modal with internal scrolling. Replace preview action buttons with installed HeroUI Tabs, retaining the stable iframe across keyboard selection. Replace the attribution dropdown with four visual HeroUI Radio choices. The user explicitly selected four visual corner positions over free dragging. Existing corner persistence, collision/readability protections and Pro standby color picker remain authoritative; this refinement requires no schema/protocol change.

Verify the real installed widgets, keyboard/focus, preview navigation count, centered geometry and mobile width; inspect both themes and desktop/mobile captures. Refresh full CI for the final execution-input fingerprint before release.

### Schedule history follow-up (2026-10-19)

Use excludedDates and repeatUntilDate on persisted schedule rows and the shared timezone resolver. Perform exception/replacement and series split operations under existing owner mutation authority in one transaction; validate before writes. Scoped edits/deletes retain the historical series and protect past/current starts. The browser supplies the original resolved occurrence start, never a trusted clock. Metadata-only rename uses its own strict server action with original title and execution-revision concurrency checks; it changes only title/updatedAt. The installed Agenda remains read-only for drag/resize on started entries while selection opens details. Ordinary migration generation remains workflow-owned after merge.

### Preserve master Runner setup and diagnostics

Restore first-heartbeat gating around the existing shared editor; poll into configuration automatically after the Runner connects. Share the installed HeroUI advanced token section before/after connection, with password type owned by TextField. Reuse artifact manifests with architecture-aware comparison and downloads; preserve all OS instructions. Keep safe session error signals and quality telemetry. Dashboard live-preview reads use an authorized server action with typed failures; token-authenticated Runner uploads remain API-owned. Place Schedule beside Appearance in a responsive action row. The parity audit records retained, restored and explicitly approved removals.

### Account-wide saved destination correction

Remove runner_id from runner_destinations and index by owner/creation time; ordinary migration generation remains workflow-owned. List, deduplicate, normalize legacy destinations, select session targets and capture scheduled/manual admissions by creator ownership. Optional Runner IDs on editor actions validate only the caller’s current Runner context and never constrain visibility or persist ownership. Preserve encrypted credential revisions, typed failures, immutable admission snapshots and existing owner-wide deletion/reference protections.
