# Cycle Log: Free Runner and Pro Broadcasting

Append only. The initial entry records the verified repository baseline. Implementation
checkpoints and behavior cycles append below; newest entries append last.

## Baseline

- commit: `2786b3f816e4e447b9fd219dceda9a3483d823f1`
- recorded: cycle 0, before any feature test/source change
- suite: `bun run test:coverage --maxWorkers=8 --json --outputFile=/tmp/clipify-local-test-full-clean.json` -> exit 0; 461 suites / 4,844 tests passed, 0 failed; 2 existing opt-in suites / 11 tests skipped because AUTH_TEST_DATABASE_URL is absent
- owning native workflow coverage: 343 passed, 0 failed, 0 skipped; combined final coverage thresholds passed
- browser acceptance: `bun run test:acceptance` -> 4 passed; isolated login whole file -> 1 passed
- Runner suite/coverage: `bun run test --coverage` from packages/runner -> 5 suites / 20 passed / 1 existing TODO
- full command duration: approximately 1,596 seconds
- raw evidence: `/tmp/clipify-local-test-full-clean.json`, `/tmp/clipify-local-test-full-clean.log`, `coverage/workflow-results.json`, `coverage/coverage-final.json`, `/tmp/clipify-local-test-browser.log`, `/tmp/clipify-tdd-refresh-runner.json`
- source/execution check: HEAD unchanged; git diff contains only setup documentation/profile changes; current execution-input fingerprints are recorded in test-list.md
- baseline reused from the preceding local setup verification under the same inputs; no unchanged suite repeated solely for planning
- initial missing PostgreSQL/Chromium/template environment was corrected before this successful run; those setup failures are not intended product Red
- temporary diagnostics are not committed CI retention artifacts; full release gates remain mandatory

## Implementation entry checkpoint

- Scope: full unattended implementation authorized; current Free/Pro names/prices, unlimited Free hours, local execution. No quota, generated migrations, live billing writes, production access or email delivery.
- Checklist: requirements.md, 17/17 checked; hooks before/after implementation disabled.
- T001–T004: source inventory, commands, baseline retention and report initialization verified.
- T005–T006: reuse FixtureBuilder; deterministic benefit/owner/operator fixtures, ephemeral Ed25519 keys and controlled clock/clip metadata added. Test infrastructure only; no feature Red claimed.
- Baseline retention: U225–U228 use the actual named passing tests recorded above and in test-list.md. New-feature artifacts remain Planned.

## Characterization U229 — missing bearer authentication

- Task: T762; source untouched before capture; test `test/app/api/runner/heartbeat.test.ts`.
- Command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Baseline: 1 test passed (`tdd/evidence/U229-baseline.log`).
- Sensitivity: temporarily changed unauthorized HTTP 401 to 400; assertion failed Expected 401 / Received 400 (`tdd/evidence/U229-mutant.log`), exit 1.
- Restored source exactly; same whole file 1 passed (`tdd/evidence/U229-restored.log`), exit 0.
- State: BASELINE; no intended new-feature Red claimed.

## Characterization U230

- Task: T763; exact command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Captured existing behavior before production changes; baseline and restored whole-file exit 0.
- Deliberate mutant: `if (!allowedSessionIds.has(sessionId)) return [];` -> `if (false && !allowedSessionIds.has(sessionId)) return [];`; exit 1, asserted failure `Expected number of calls: 1`. Source restored exactly in finally.
- Evidence: `tdd/evidence/U230-baseline.log`, `U230-mutant.log`, `U230-restored.log`.
- State: BASELINE; this is not new-feature Red.

## Characterization U231

- Task: T764; exact command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Captured existing behavior before production changes; baseline and restored whole-file exit 0.
- Deliberate mutant: `if (!(await hasActiveRunnerAccess(runner.ownerId))) {` -> `if (false && !(await hasActiveRunnerAccess(runner.ownerId))) {`; exit 1, asserted failure `Expected: 403`. Source restored exactly in finally.
- Evidence: `tdd/evidence/U231-baseline.log`, `U231-mutant.log`, `U231-restored.log`.
- State: BASELINE; this is not new-feature Red.

## Cycle 1 — Free device registration (A1 / U1)

- Acceptance: BDD-US1-FR001; real bearer-authorized MCP create_runner calls on a disposable loopback database. Command: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`. Initial run: Expected registered count 2 / Received 0 (`tdd/evidence/A1-red.log`), subsequently rejected as feature Red: the adapter omitted local OAuth lookup and returned a protocol error. This initial run is retained as diagnostic evidence only. Original registration gate restored before corrected acceptance Red.
- Internal: TDD-US1-FR001; command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`. Minimal capability declaration permits import; intended assertion Red: Expected true / Received false (`tdd/evidence/U1-red.log`). No import/setup failure.
- Registry state: Red before production change. Scope: basic unlimited device registration only; broadcasting remains protected by existing gates until its own admission/runtime cycles.

- Corrected acceptance Red: local auth.handler now owns token lookup; the adapter rejects protocol-level errors. With the original paid create_runner gate restored, the owning acceptance run again failed Expected 2 / Received 0 (`tdd/evidence/A1-red-corrected.log`). Only then was create_runner removed from the paid gate again.

- Green: corrected real MCP acceptance 1 passed (`tdd/evidence/A1-green-corrected.log`); internal file 1 passed (`tdd/evidence/U1-green.log`).
- Refactor checkpoint: no extra abstraction necessary. Complete affected fast files admission/heartbeat/existing native runner workflows: 3 suites / 19 tests passed (`tdd/evidence/cycle-1-refactor.log`). Command: `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts test/app/api/runner/heartbeat.test.ts test/mcp/workflows/runners.test.ts --coverage=false`.
- A1/U1 DONE; registry BDD-US1-FR001 and TDD-US1-FR001 Green. Shared delivery-slice tasks stay open for remaining entitlement options and access entry points.
- Foundation validation: official installed Gherkin parser checked all 179 specification scenarios with unique IDs, exact binding inventory assertion; deterministic clock/benefit fixtures/ephemeral keys verified. Actual short FFmpeg clip and loopback receiver created and processes/temp files cleaned.
- T011–T037 specification declarations verified against existing approved Gherkin/source maps. Future executable scenarios remain unmaterialized.

## Cycle 2 — Free capability snapshot (U41)

- Artifact: TDD-US1-OPT001; command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Intended Red: required Free capability fields absent; existing registration case remains Green (`tdd/evidence/U41-red.log`).

- Green/refactor: whole file 2 tests passed (`tdd/evidence/U41-green.log`). Pure derived policy needs no database persistence or quota tables. No extra refactor necessary. U41 DONE. Outer registration option remains to be materialized; shared delivery-slice tasks remain open.

## Existing behavior verification — A41 Free registration option

- BDD-US1-OPT001 already passes after Cycle 1; no fabricated feature Red or extra production change.
- Owning command: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`. Generation succeeded; execution 2 passed (`tdd/evidence/A41-existing-green.log`).
- Sensitivity: temporarily restore the removed paid create_runner gate; the new option fails Expected 2 / Received 0 (`tdd/evidence/A41-mutant.log`).
- Source restored exactly in finally; same owning feature 2 passed (`tdd/evidence/A41-restored.log`). A41 DONE; shared slice tasks remain open.

## Cycle 3 — Pro capability snapshot (U42)

- TDD-US1-OPT002; command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Red: Pro still resolves Free policy instead of unrestricted Runner capabilities (`tdd/evidence/U42-red.log`).

- Green/refactor: whole file 3 passed (`tdd/evidence/U42-green.log`); derived safe policy revision excludes evaluation time, so unchanged policy is stable. Pro capabilities remain derived, without a new quota or tier. U42 DONE.

## Cycle 4 — scoped legacy Runner benefits (U43)

- TDD-US1-OPT003; command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Red: legacy Runner-only grant still gets Free capability flags; its known expiry is omitted (`tdd/evidence/U43-red.log`).

- Green/refactor: whole file 4 passed (`tdd/evidence/U43-green.log`); legacy grant enables Runner benefits only and retains known expiry. Global Pro is unchanged. U43 DONE.

## Capability source cycle — U44

- Artifact TDD-US1-OPT004; command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Intended Red: benefit source is misclassified; evidence `tdd/evidence/U44-red.log`.

- Green/refactor: complete capability file passed (`tdd/evidence/U44-green.log`). Pure source classification needs no additional abstraction or persistence. U44 DONE.

## Capability source cycle — U45

- Artifact TDD-US1-OPT005; command `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Intended Red: benefit source is misclassified; evidence `tdd/evidence/U45-red.log`.

- Green/refactor: complete capability file passed (`tdd/evidence/U45-green.log`). Pure source classification needs no additional abstraction or persistence. U45 DONE.

## Existing registration option — A42 (pro)

- Artifact BDD-US1-OPT002; real MCP bearer entry with isolated owner benefit fixture. New example passes under the completed basic-registration policy; no artificial feature Red.
- Command: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`.
- Whole owning feature passes; deliberate mutant rejects authorized create_runner and kills this exact scenario; source restored exactly, full owning feature passes again.
- Evidence: `tdd/evidence/A42-existing-green.log`, `A42-mutant.log`, `A42-restored.log`. A42 DONE.

## Existing registration option — A43 (legacy)

- Artifact BDD-US1-OPT003; real MCP bearer entry with isolated owner benefit fixture. New example passes under the completed basic-registration policy; no artificial feature Red.
- Command: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`.
- Whole owning feature passes; deliberate mutant rejects authorized create_runner and kills this exact scenario; source restored exactly, full owning feature passes again.
- Evidence: `tdd/evidence/A43-existing-green.log`, `A43-mutant.log`, `A43-restored.log`. A43 DONE.

## Existing registration option — A44 (agency)

- Artifact BDD-US1-OPT004; real MCP bearer entry with isolated owner benefit fixture. New example passes under the completed basic-registration policy; no artificial feature Red.
- Command: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`.
- Whole owning feature passes; deliberate mutant rejects authorized create_runner and kills this exact scenario; source restored exactly, full owning feature passes again.
- Evidence: `tdd/evidence/A44-existing-green.log`, `A44-mutant.log`, `A44-restored.log`. A44 DONE.

## Existing registration option — A45 (trial)

- Artifact BDD-US1-OPT005; real MCP bearer entry with isolated owner benefit fixture. New example passes under the completed basic-registration policy; no artificial feature Red.
- Command: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`.
- Whole owning feature passes; deliberate mutant rejects authorized create_runner and kills this exact scenario; source restored exactly, full owning feature passes again.
- Evidence: `tdd/evidence/A45-existing-green.log`, `A45-mutant.log`, `A45-restored.log`. A45 DONE.

## Evidence table integrity checkpoint

- Execution updates are now explicitly restricted to Evidence Artifact Registry. Restored six registration Scenario Coverage Matrix input-class/interface cells after a broad row updater affected their matching IDs; no execution state belongs in immutable source/scenario mappings.
- Registry contains exactly 374 unique single-owner IDs. Current Green counts: 6 TDD and 6 BDD (shared acceptance roles counted once); all remaining artifacts retain their actual pending states.
- Dedicated updater checks one registry row per ID and keeps source/scenario sections unchanged. No product/test result changed by this reporting correction.

## Registration contract extension — capability advertisement

- Source FR-001, same basic registration policy; existing native capability regression updated to the approved new policy, preserving cleanup and not yet enabling broadcast outputs.
- Command: `bun run test --runInBand --runTestsByPath test/mcp/workflows/capabilities.test.ts --coverage=false`.
- Intended Red: setup/create remain advertised as paid-only (`tdd/evidence/registration-capabilities-red.log`).

- Green/refactor: whole owning capability file passes (`tdd/evidence/registration-capabilities-green.log`). Pure authorization still determines operation availability; Free basics no longer imply a purchase. Broadcast configuration/start gates remain until their admission/protocol cycles. This supplements FR-001 registration evidence, not a duplicate practice owner.

## Registration contract extension — dashboard action

- Source FR-001 / TDD-US1-FR001; U1 reopened while this required entry-point subcase is Red. Existing MCP acceptance remains Green.
- Command: `bun run test --runInBand --runTestsByPath test/app/actions/runner.test.ts --coverage=false`.
- Intended Red: authorized Free owner still receives paid add-on requirement (`tdd/evidence/dashboard-registration-red.log`). Existing action cases remain Green.

- Green/refactor: complete action file passes (`tdd/evidence/dashboard-registration-green.log`). Owner authorization and secure token generation/public-only return selection are unchanged. Only the registration purchase gate was removed; broadcasting still awaits its separate admission/protocol tests. U1 DONE again with the added entry-point evidence.

## Registration contract extension — enrollment approval

- FR-001 / TDD-US1-FR001; U1 reopened for the required enrollment entry-point subcase.
- Command: `bun run test --runInBand --runTestsByPath test/app/runner/enroll-actions.test.ts --coverage=false`.
- Intended Red: the owner is authorized but the action requires a separate Runner entitlement (`tdd/evidence/enrollment-access-red.log`).

- Green/refactor: complete enrollment file passes (`tdd/evidence/enrollment-access-green.log`). Approval still requires verified authentication, active enrollment code, owned Runner and runner:control permission. Removed only the obsolete purchase requirement. U1 DONE with this subcase included.

## Registration contract extension — pending enrollment listing

- FR-001 / TDD-US1-FR001; U1 reopened while the pending-device listing subcase is Red.
- Command: `bun run test --runInBand --runTestsByPath test/app/runner/enroll-actions.test.ts --coverage=false`.
- Intended Red: authorized Free owner's pending device is hidden by the old paid filter (`tdd/evidence/enrollment-list-red.log`).

- Green/refactor: complete enrollment file 2 tests pass (`tdd/evidence/enrollment-list-green.log`). Pending devices are still selected from server-authorized creator IDs and projected without bearer tokens. U1 DONE with both enrollment subcases included.

## Authorization regression — registration-foreign-owner

- FR-001 registration contract extension; unchanged required authorization already passes this new negative case. No artificial feature Red.
- Command: `bun run test --runInBand --runTestsByPath test/app/actions/runner.test.ts --coverage=false`.
- Deliberately bypassed the authorization guard, observed this exact denial/non-mutation case fail, restored source exactly and reran the entire owning file Green.
- Evidence: `tdd/evidence/registration-foreign-owner-baseline.log`, `registration-foreign-owner-mutant.log`, `registration-foreign-owner-restored.log`.

## Authorization regression — enrollment-permission-denial

- FR-001 registration contract extension; unchanged required authorization already passes this new negative case. No artificial feature Red.
- Command: `bun run test --runInBand --runTestsByPath test/app/runner/enroll-actions.test.ts --coverage=false`.
- Deliberately bypassed the authorization guard, observed this exact denial/non-mutation case fail, restored source exactly and reran the entire owning file Green.
- Evidence: `tdd/evidence/enrollment-permission-denial-baseline.log`, `enrollment-permission-denial-mutant.log`, `enrollment-permission-denial-restored.log`.

## Capability contract extension — earliest known expiry

- U42 / TDD-US1-OPT002; source FR-001 capability snapshot.
- Command: `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Red: multiple known paid deadlines are ignored and validUntil is null (`tdd/evidence/capability-expiry-red.log`).

- Green/refactor: whole capability file 7 tests pass (`tdd/evidence/capability-expiry-green.log`). Unknown/null deadlines do not invent expiry; all known deadlines are reduced to their earliest instant. Invalid Date cannot silently become an unlimited paid lifetime: ISO conversion fails. U42 DONE with this subcase included.

## Capability revision regression

- TDD-US1-OPT002 companion invariant: unchanged policy keeps the same cache revision across explicit/default evaluation times, while a paid-to-Free policy change invalidates it.
- Existing behavior passes the new case; no artificial feature Red. Command: `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Deliberately included evaluatedAt in the policy digest: this exact regression failed. Source restored exactly; owning file 8 tests passed.
- Evidence: `tdd/evidence/capability-revision-baseline.log`, `capability-revision-mutant.log`, `capability-revision-restored.log`.

## First-slice evidence reconciliation

- TDD-US1-FR001 owning path/command now includes capability, dashboard action and enrollment action whole files; shared Red/Green tasks use the same complete command. Companion cases retain the same single TDD owner.
- DONE/BASELINE references name actual materialized tests rather than planned paths.
- DEF-US1-002 verified: wrong test import was diagnosed and rejected before production change; intended policy Red and actual Green followed after correction. No open defect or exception.
- All remaining streaming/admission/lease, multi-target, scheduling, presentation and commercial feature evidence remains pending.

## Access-slice validation checkpoint (completion gate still running)

- Affected ordinary files: 6 suites / 27 tests passed (`tdd/evidence/A1-fast-complete.log`).
- Critical capability coverage: 3 suites / 17 tests passed; 100% statements, branches, functions and lines, above approved 95/90/95/95 (`tdd/evidence/A1-capability-coverage.log`, `.json`, `coverage/runner-feature/capabilities/coverage-final.json`).
- Types, lint, formatting and dependency audit exit 0. Lint retains five existing unrelated image warnings; audit keeps the repository's existing approved ignore unchanged (`A1-typecheck.log`, `A1-lint.log`, `A1-format.log`, `A1-security.log`).
- Isolated app build exit 0 (`A1-build.log`); exact non-production browser environment reused for acceptance without repeating the successful build. Browser acceptance 4 passed (`A1-browser-acceptance.log`). Baseline-identical server diagnostics have an explicit non-regression rationale in defect-log.md.
- Complete application/native coverage gate remains running; slice T661 and story completion stay unchecked until mandatory evidence is complete.

## DEF-US1-003 contract correction

- Completed application portion of the broad run: 463 suites / 4,859 tests passed; one obsolete Pro registration denial assertion failed; two existing opt-in suites / 11 tests skipped. Native workflow coverage continues separately under the same owner.
- Corrected only `test/mcp/workflows/plan-boundaries.test.ts`: Pro without a standalone Runner grant must create a safe offline device with enrollment required and one committed audit write. Free remote-control denial and gallery retry assertions remain intact.
- No production code, native workflow source, Gherkin input or runtime configuration changed while native coverage continues. The failed broad command remains failed evidence; it is not relabeled Green.

## Coverage inventory extension — Runner services

- A1 completion infrastructure: new critical capability coverage passed independently, but the existing canonical source inventory does not yet include src/server/runner. Add it before the clean complete rerun so new modules cannot disappear from the merged report.
- Command: `bun run test --runInBand --runTestsByPath test/mcp/unit/coverage-gate.test.ts --coverage=false`.
- Intended Red: the real source manifest omits capabilities.ts (`tdd/evidence/runner-coverage-inventory-red.log`).

- Green/refactor: entire existing coverage-gate test file passes, retaining all prior missing-source, malformed-counter, boundary and negative checks (`tdd/evidence/runner-coverage-inventory-green.log`). Default Jest coverage now collects src/server/runner; canonical manifest treats those services as critical. Existing thresholds are unchanged; stricter feature-specific 95/90/95/95 remains separately enforced.

## Clean access-slice gate rerun

- Historical plan-boundary whole file now 3 passed (`tdd/evidence/A1-plan-boundary-fix.log`); DEF-US1-003 Fixed, pending complete verification.
- First broad run retained as failed evidence: application 463 suites / 4,859 tests passed, one obsolete assertion failed; native workflow coverage all 349 passed with zero skipped; merged MCP coverage check returned ok true. No prior failed command was relabeled Green.
- Canonical coverage inventory now includes src/server/runner, so the clean rerun produces one merged source report including the new capability module. Existing thresholds remain unchanged; the higher feature-critical thresholds already passed independently at 100%.
- Clean command running: `bun run test:coverage --maxWorkers=8 --json --outputFile=/tmp/clipify-runner-A1-clean-complete.json`; template owner runner-a1-clean-completion; evidence `tdd/evidence/A1-clean-complete-coverage.log`.

## Delivery slice A1 complete — T661

- Clean complete command exit 0: `bun run test:coverage --maxWorkers=8 --json --outputFile=/tmp/clipify-runner-A1-clean-complete.json`, isolated template owner runner-a1-clean-completion.
- Application 464 suites / 4,861 tests passed; unchanged two opt-in suites / 11 tests skipped. Native owning workflow inventory all 349 passed, zero skipped. Merged coverage ok true with no errors, including src/server/runner/capabilities.ts. Evidence: `tdd/evidence/A1-clean-complete-coverage.log`, raw `/tmp/clipify-runner-A1-clean-complete.json`, `coverage/coverage-final.json`, `coverage/workflow-results.json`.
- New critical capability service independently 100% S/B/F/L against approved 95/90/95/95; relevant browser acceptance 4 passed. Types, lint (0 errors, 5 pre-existing warnings), formatting, dependency audit, isolated build, server-action manifest and migration-policy checks passed. Final static outputs A1-final-typecheck/lint/format.log; other A1-* logs retained.
- Existing Runner binary/package source was not changed; test-only shared adapters do not change its existing executable test inputs. Reuse the verified 5-suite/20-pass package baseline; no new native-runtime feature or smoke result is claimed.
- T050–T056 and T661 complete after all marked registration/capability behaviors finished. Legacy entitlement resolution retains its paid Runner-only meaning; basic registration/enrollment now relies on authorized ownership. No quota tables, schema migration, live billing operation or email was created.
- DEF-US1-001/002/003 Verified; open defects 0, approved exceptions 0. Subsequent slices and whole-feature acceptance remain open.

## Delivery A2 — invalid device authentication (U240)

- TDD-US1-CON004 companion case; existing correct behavior passes before any production change. No artificial feature Red.
- Command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Bypassing the invalid-device guard made the new 401/non-mutation assertion fail; exact source restored; complete heartbeat file 4 passed.
- Evidence: `tdd/evidence/U240-baseline.log`, `U240-mutant.log`, `U240-restored.log`.
- U240 DONE; owning umbrella artifact and shared tasks remain Planned/open for the remaining contracts.

## A2 operator control boundary — A25

- Exact approved scenario BDD-US1-EC003: a read-only approved OAuth operator attempts start, edit and stop against a running broadcast through the actual MCP boundary. Protected source/config/revision remains unchanged, no successful mutation audit, no credential exposure.
- Initial new test incorrectly expected tool-level errors and counted security-denial audits as writes. Retained A25-envelope-diagnostic.log; this was not feature Red. Real denial is transport code -32000 with the precise missing scope. Security-denial auditing remains enabled and permitted.
- Command: `bunx bddgen --config playwright.mcp.config.ts && bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro --workers=1`.
- Current implementation already denies correctly; no artificial feature Red. Deliberately weakened both relevant workflow permissions to runner:read: this new case failed. Restored source exactly; whole owning feature 7 passed.
- Evidence: A25-baseline.log, A25-mutant.log, A25-restored.log. A25 DONE; A2 completion gate remains open for its internal/protocol contracts.

## A2 internal authorization contract — U25

- TDD-US1-EC003 uses the real permission catalogue and pure authorization evaluator with a controlled read-only direct grant. Pro/Runner benefits never substitute for start/edit/stop permission.
- Existing behavior already passes; no artificial feature Red. Command: `bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false`.
- Deliberately bypassed direct-member permission checks; this new decision contract failed. Exact source restored; whole owning file 9 passed.
- Evidence: U25-baseline.log, U25-mutant.log, U25-restored.log. U25 DONE.

## A2 old-client protocol admission — U241

- TDD-US1-CON004 companion case; new-policy running assignment for a client without protocol v2 must return update_required before key decryption or reported running-state mutation.
- Command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Intended Red: old handler returns 200 and builds an assignment instead of 426 (`tdd/evidence/U241-red.log`).

- Green/refactor: complete heartbeat file 5 passed (`tdd/evidence/U241-green.log`). Unsupported output returns an explicit no-store 426 before decryption or actual-state updates. Idle legacy telemetry and the retained pre-policy characterizations remain valid; Free output still stays behind existing start gates until shared admission/leases are implemented. U241 DONE for this case; umbrella artifact stays Planned for remaining contracts.

## A2 protocol capability contract extension — U241

- Protocol v2 alone cannot bypass required admission, drain or generated-presentation enforcement. Each missing core capability must reject output before decryption.
- Command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Intended Red: v2 with missing required capabilities still receives 200 (`tdd/evidence/U241-capabilities-red.log`).

- Green/refactor: entire heartbeat file 6 passed (`tdd/evidence/U241-capabilities-green.log`). Every missing core capability is rejected; no output key is decrypted. Optional destination/scheduler capabilities remain separate from the core output safety contract. U241 DONE with these input classes included; umbrella artifact remains Planned for its remaining behaviors.

## A2 heartbeat rate boundary — U204

- TDD-US1-CON004 numeric companion; frozen clock and actual repository consumeAppRateLimit/RateLimiterMemory engine, not simulated counters. Current implementation already passes.
- Command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Deliberately changed endpoint points from 12 to 11: boundary assertion failed. Exact source restored; whole heartbeat file Green.
- Evidence: `tdd/evidence/U204-baseline.log`, `U204-mutant.log`, `U204-restored.log`. U204 DONE; no artificial feature Red.

## A2 heartbeat rate boundary — U205

- TDD-US1-CON004 numeric companion; frozen clock and actual repository consumeAppRateLimit/RateLimiterMemory engine, not simulated counters. Current implementation already passes.
- Command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Deliberately changed endpoint points from 12 to 13: boundary assertion failed. Exact source restored; whole heartbeat file Green.
- Evidence: `tdd/evidence/U205-baseline.log`, `U205-mutant.log`, `U205-restored.log`. U205 DONE; no artificial feature Red.

## A2 assigned-session state contract — U140

- TDD-US1-CON004: supported protocol-v2 running assignment cannot report actual-state changes for another session. This extends the retained pre-v2 idle characterization to the supported output path.
- Existing filtering already passes; no artificial feature Red. Command: `bun run test --runInBand --runTestsByPath test/app/api/runner/heartbeat.test.ts --coverage=false`.
- Bypassed the assigned-ID guard: this v2 case failed. Restored exact source; whole heartbeat file 9 passed.
- Evidence U140-baseline.log, U140-mutant.log, U140-restored.log. U140 DONE; remaining umbrella signature/response contracts pending.

### A2 / U243 — real database assignment isolation and protected response

Actual authenticated heartbeat against disposable PostgreSQL returns only the assigned device’s overlay/key/session; a foreign state report leaves its session stopped. Intended Red was missing `Cache-Control: no-store` (9 pass/1 fail), minimal header fix Green (10/10). Removing the assigned-device SQL predicate is killed by the same whole-file test, then restored Green. Evidence: `tdd/evidence/U243-{red,green,foreign-assignment-mutant,restored}.log`. Rate boundary tasks T775/T776 also checked using already recorded real-limiter evidence; no repeat of unchanged runs.

### A2 / U242 — signed resource/generation identity

Ephemeral Ed25519 keys and independently signed fixtures cover authentic control, forged payload, validly signed owner/device/session/generation/targets/config/source substitutions, exact expiry, future issue time, malformed claims/encoding and unknown keys. Initial policy seam defaulted closed (expected authentic claims, got null), not an import/setup exception. Minimal shared native-compatible codec added, then subsequent identity and validity cases each proved intended Red before their implementation. Signature/identity/exact-expiry mutants killed, exact source restored and whole file Green. Evidence `tdd/evidence/U242-{signature-red,signature-green,identity-red,identity-green,validity-red,validity-green,signature-mutant,identity-mutant,expiry-mutant,restored}.log`. Codec is not yet connected to output execution; A3+ admission/runtime gates remain mandatory before output is enabled.

### A2 protocol telemetry, bounded input and inventory refactor

U243 real DB extension proved missing negotiated protocol/capability/ack metadata (null fields) before additive schema source and heartbeat persistence. No generated migration. Input contract then proved null JSON returns 500, not required 400; bounded 64KiB streamed parsing plus typed telemetry validation now returns 400/413 before state mutation. All heartbeat replies now use no-store, including failures. Codec canonical inventory test proved new shared native codec missing from feature/critical manifest; added exact shared source and canonical Jest collection, with unchanged thresholds. Evidence A2-negotiation-{red,green}.log, A2-input-{red,green}.log, A2-coverage-inventory-{red,green}.log. DEF-US1-005 documents corrected signature test strength. Native output execution still not enabled before admission/lease/runtime implementation.

### A2 static failure / DEF-US1-006

`bun run app:typecheck` found five errors in heartbeat/route.ts: optional protocol/ack/capability values retained assumptions from the old untyped req.json body; observed state remained unknown. Expected static gate success, actual TS18048/TS2345/TS2322. Proposed/fixed: use already validated optional values directly, preserve capability guard narrowing, validate state with enum schema before update. No tests suppressed or threshold changed; type gate rerun and whole affected suites started. Implementation remains inside A2 until its gate passes.

### A2 refactor checkpoint, full gate running

All seven affected whole-file suites: 60 passed. Native package: 5 suites/20 passed, one pre-existing TODO. Native types, corrected app types, lint (0 errors, five existing warnings), formatting, audit and migration policy pass. Critical shared codec and capability service: EACH 100% S/B/F/L with explicit per-file 95/90/95/95 thresholds (initial aggregate-only check was not treated as per-file qualification). Additional malformed key/JSON/encoding and injected/default-clock cases cover fail-closed paths. `tdd/evidence/A2-critical-per-file-coverage.log`. T063/T064/T068/T822 complete with trusted-owner authorization retained inside existing locked workflow; actual admission limits remain A3 responsibility. Native output will not advertise v2 safety capabilities before their runtime implementation. Full application/owning-workflow coverage and isolated production build running; T662 remains unchecked and progression blocked until current-source evidence completes.

### A2 native environment failure / DEF-US1-007

`cd packages/runner && bun run patches:validate` expected patch validation success; actual guard correctly rejects @yao-pkg/pkg installed 6.21.0 against declared/locked 6.23.0. No package/patch changes by feature caused the mismatch; installed tree is stale. Native keyring binding loads successfully. Proposed fix: frozen-lockfile package dependency install, preserve lock/patch source, rerun validation/native types/tests. No threshold/guard bypass or production dependency mutation.

### A2 / DEF-US1-007 verified native environment repair

`cd packages/runner && bun install --frozen-lockfile` installed exact locked versions (116 packages), with no manifest/lockfile/patch source mutation. Both native patches/type-checked patch files now validate, native types pass, 5 suites/20 tests pass (one existing TODO), keyring binding loads. Evidence: A2-native-install.log, A2-native-{patches,typecheck,test,binding}-restored.log. Added separate native install/patch-check and FFmpeg prerequisites to local-testing docs so root-only installation is not mistaken for native readiness. Full application gate uses root dependency tree and remains in progress. No guard bypass.

### A2 native audit failure / DEF-US1-008

Native package audit (separate dependency tree from the already clean root audit) found 18 High advisories across eight transitive packages. These existing native lockfile entries were not covered by root-only audit. Exact command `cd packages/runner && bun audit --audit-level=high`; evidence A2-native-audit.log. No advisory suppressed; preview compatible safe-version updates before applying minimum native dependency fixes. Package patch target pins must remain unchanged. Required native verification will be repeated on changed dependencies; no Go or completed slice claim while High gate fails.

### A2 full application/workflow gate passed; final native qualification pending

`bun run test:coverage --maxWorkers=8 --json --outputFile=/tmp/clipify-runner-A2-complete.json` exit 0: 464 application suites / 4,873 tests passed; existing 2 opt-in suites/11 tests skipped unchanged; all 350 native workflow scenarios passed (5.5min), merged coverage ok=true/errors=[]. Canonical report includes capability service and shared native verifier. Evidence A2-complete-coverage.log and raw /tmp/clipify-runner-A2-complete.json. Root source/runtime unchanged during gate; native-only dependency changes separately require current native qualification. Updated native audit/version/capture evidence and CI audit steps as DEF-US1-008 remediation; record final native/static result before T662 closure. No partial-output experiment treated as successful.

### A2 native qualified closure and transport inventory correction

DEF-US1-008/009 Verified. Final dependency policy overrides ONLY @puppeteer/browsers, not Puppeteer core. Compatible transitive security updates retained; no audit ignore added. Clean native install followed by frozen-lock verification, two patch validations, native types, all 20 native tests, real WebM capture/cleanup and High audit pass. Explicit engine unit-test factory isolates its mocked capture dependency instead of Jest auto-loading Node ESM; real Node/browser integration proves production import/capture, not the mock. Evidence A2-native-qualified-{install,patches,typecheck,test-restored,capture,audit}.log. Capture metadata proves core24.43.1 capture API and core25.12.0 Runner types both resolve downloader3.2.3; process exit0 is required. Both CI workflows enforce native audit.

Review found heartbeat handler missing from canonical changed-critical coverage. Existing application tests and core/service coverage passed, but that omission is not accepted as transport qualification. Added inventory assertion (intended Red), then exact heartbeat source to Jest collection/critical manifest. DEF-US1-010 tracks per-file measurement/closure. Current-source complete coverage will use the existing independent owning lanes and required merger; no prior successful head/coverage substituted for changed collector inputs. T662 remains unchecked.

### A2 retained assigned-observation validation

Critical transport qualification exposed missing executable coverage of accepted assigned observations and invalid state filtering. Added positive assigned-running control plus invalid enum/foreign-session assertions; existing behavior Green, no artificial feature Red. Bypassing the enum validation is killed, source restored and whole heartbeat file 15 passed. Evidence A2-observation-{baseline,mutant,restored}.log. This is a companion contract case under TDD-US1-CON004, not another acceptance owner.

### A2 retained transport failure contract

Database failure companion case asserts generic no-store HTTP500, no mutation and expected diagnostic routing; any console mock is restored and its exact expected call asserted. Existing behavior baseline Green; returning success status for database failure is killed; restored whole file16 pass. A2-error-{baseline,mutant,restored}.log. No production change or artificial feature Red.

### A2 native build output / DEF-US1-011

Root lint after the real native build found 179 errors in generated packages/runner/build/runner.js. Expected source lint success, actual generated bundle was scanned because build/** covers only the root build directory. Added the exact generated native build directory to global ignores, preserving all source paths and lint/guard rules. No coverage/test input changed; coverage lane source manifest excludes lint config because those test lanes do not consume it. Fresh root lint required with the actual bundle still present. Native Linux build and executable smoke both passed; only local Linux qualified, not the cross-platform matrix.

### A2 lane failure / DEF-US1-012

Command `node scripts/run-coverage-lane.mjs database-1` during six concurrent local lanes. Failing suite test/mcp/contract/oauth.test.ts, TDD-US1-001 publishes consistent issuer/resource metadata (line6); actual execFileSync /usr/bin/node ETIMEDOUT at probe.ts:20 (provider probe 15s), not an assertion mismatch. Expected existing metadata response. Other lane tests continue and source inputs remain frozen. Proposed fix/investigation: inspect resource contention and rerun full failed owning lane after concurrent producers finish; do not increase timeout or suppress test. The same full application suite passed before collector expansion; that is supporting investigation evidence, not a replacement for required current-lane execution. T662 remains blocked until current-source full lane/merge passes.

### A2 generated-output tooling verified

DEF-US1-011 Verified: exact packages/runner/build/ output classification added to Git, Prettier and ESLint. Native source remains checked; generated bundle remains present. Source lint 0 errors / five inherited warnings, formatter passes A2-native-build-output-format-restored.log. No coverage test input changed. Snapshot verification hashes the original 1,400 input paths, retaining unchanged native generated artifacts originally captured before their ignore classification; it does not discard old inputs when ignore files change.

First parallel coverage attempts: unit308/3371 pass, database2 44/381 pass, database3 43/514 pass with baseline8skips, quiet26/193 pass, workflows350/350 pass. Database1 had one provider-process15s timeout, failed log retained. All producers finished before its complete isolated rerun; current-source merge waits for exit0.

### A2 completed — T662

All current source inputs unchanged (1,400 SHA256 entries; digest bd61aebbf0d05a0783580137fe91e3f8a070d47cf3b6e91ded731eff493cd64c). Complete six owning lanes merged with canonical scripts/merge-test-coverage.mjs exit0. Application464 suites/4,875passed; baseline2opt-in suites/11skips unchanged. Workflows350passed/0skips. Canonical coverage S86.88/B80.69/F85.74/L89.30; all unchanged global/per-path/critical policies enforced. Each changed critical path independently meets95S/90B/95F/95L (capabilities100all,codec100all,heartbeat98.96S96.55B100F100L).

App/native types, source lint0errors/5baseline warnings, changed-file formatting, audit(root/native), patched dependencies, migration guards, app build/action manifest91files and browseracceptance4 pass. Native5suites20passed1inheritedTODO; actual browsercapture/cleanup passes on retained core24 API/shared downloader3, Linuxbinarybuild/executable selftest pass. No cross-platform matrix claim. Defects12Verified/0open/0exceptions. Failed concurrent-local lane retained; successful complete isolated rerun with original timeout is the only database1 result merged. No duplicate native BDD/coverage execution owner introduced.

T662 complete. A3 tests/implementation may begin now. Global feature release remains No-Go until remaining tasks/behaviors/gates complete. Qualified logs/source snapshot remain historical evidence as later slices change sources.

### A3 initial race evidence

TDD-US1-CON001/U137 intended Red: two real PostgreSQL waits observed and no requests settled while owner row held; after release accepted0 vs required1 because current paid Runner policy still denies Free. No missing import/schema/setup failure. BDD-US1-EC001 initial run is REJECTED as feature Red: actual Next react-server createContext/navigation import error in new dashboard action probe,7existing scenarios pass. DEF-US1-013 tracks existing RSC-compatible native bundler setup; do not change production until corrected outer missing-behavior Red exists.

### A3 / first owner-wide admission race complete

OuterA23 and innerU137 use actual dashboard+MCP entrypoints and a separate PostgreSQL owner-lock barrier. Corrected executable Red preceded production; its registry transcription was completed when closing the cycle (the earlier RSC setup error is never counted as feature Red). Minimal schema source adds generation-bound nonterminal admissions with retained nullable resource references; no generated migration. Shared admission service holds owner lock and counts all nonterminal owner rows; both controls compose it inside the existing locked authorization transaction. Free control commercial restriction removed only for start/stop, not unrelated advanced features. Desired/actual remain distinct; no Free output/lease or native v2 execution claim yet.

Whole inner file10passes; focused nativeBDD feature8passes. Skipping the commercial concurrency predicate makes both whole-file/owning tests fail with two accepted starts; exact source restored and both pass. Evidence A3-owner-race-{inner,outer}-{limit-mutant,restored}.log. Fresh no-coverage native global setup uses the same compiler aliases as coverage, but preserves an explicitly supplied instrumented producer and owns/cleans only its own temporary directory. No full workflow coverage lane in the inner cycle. DEF-US1-013 Verified. Only A23/U137 completed; remaining A3 cases and its gate still pending.

### A3 shared service owner-mutex strength

Companion U137 case calls the shared admission service directly inside two real PostgreSQL transactions, without outer authorization locks. Both wait on an independently held owner row; after release one reservation commits, second receives owner-limit error, and the service itself leaves desired state unchanged (caller composes commands). BaselineGreen; removing the service owner lock lets both FK-waiting inserts commit after release and the whole-file assertion fails. Source restored, all11whole-file tests pass. Evidence A3-service-mutex-{baseline,mutant,restored}.log. This tests central atomicity rather than relying on the already locked resource caller.

### A3 / active clip blocks fallback on another device

A2/U2 added one atomic clip-to-fallback option under BDD/TDD-FR002. Actual authenticated MCP request against real disposable PostgreSQL denies the second device, explains owner limit, leaves holder generation/state/revision unchanged and preserves rejected session state/revision with no successful mutation audit. General service already passes; honest baselineGreen, no artificial featureRed or production change. Whole internal file12pass, native feature9pass. Evidence A3-active-clip-{inner,outer}.log. Both roles retain their distinct boundary/rollback focus.

### A3 / A46/U46 — Clip playback

One option added only after preceding option Green. Existing owner-limit implementation already passes, so honest baselineGreen with no artificial featureRed or production change. Actual authenticated native operation, real PostgreSQL occupied admission, unchanged holder/rejected revision/state and no successful mutation audit. Evidence A3-phase-006-{inner,outer}.log. The control plane intentionally represents forwarding, generated fallback and standby by the same nonterminal admission; actual media-phase behavior remains the separate planned native runtime owner, not fabricated by this control-plane test. Named cases are all executed without sampling.

### A3 / A47/U47 — Live fallback forwarding live input

One option added only after preceding option Green. Existing owner-limit implementation already passes, so honest baselineGreen with no artificial featureRed or production change. Actual authenticated native operation, real PostgreSQL occupied admission, unchanged holder/rejected revision/state and no successful mutation audit. Evidence A3-phase-007-{inner,outer}.log. The control plane intentionally represents forwarding, generated fallback and standby by the same nonterminal admission; actual media-phase behavior remains the separate planned native runtime owner, not fabricated by this control-plane test. Named cases are all executed without sampling.

### A3 / A48/U48 — Live fallback playing clips

One option added only after preceding option Green. Existing owner-limit implementation already passes, so honest baselineGreen with no artificial featureRed or production change. Actual authenticated native operation, real PostgreSQL occupied admission, unchanged holder/rejected revision/state and no successful mutation audit. Evidence A3-phase-008-{inner,outer}.log. The control plane intentionally represents forwarding, generated fallback and standby by the same nonterminal admission; actual media-phase behavior remains the separate planned native runtime owner, not fabricated by this control-plane test. Named cases are all executed without sampling.

### A3 / A49/U49 — Live fallback showing standby

One option added only after preceding option Green. Existing owner-limit implementation already passes, so honest baselineGreen with no artificial featureRed or production change. Actual authenticated native operation, real PostgreSQL occupied admission, unchanged holder/rejected revision/state and no successful mutation audit. Evidence A3-phase-009-{inner,outer}.log. The control plane intentionally represents forwarding, generated fallback and standby by the same nonterminal admission; actual media-phase behavior remains the separate planned native runtime owner, not fabricated by this control-plane test. Named cases are all executed without sampling.

### A3 / FR003 resource owner rather than Pro operator

Authorized agency membership and accepted link are established before OAuth consent, with creator-bound agency selection. Actor independently owns a Pro personal creator; target remains Free. Actual MCP control operation denies second broadcast with clear concurrency code, unchanged holder/rejected revision/state and zero successful write audit. Existing owner policy already passes: honest baselineGreen with no artificial Red or production change. Whole-file and native whole-feature logs: A3-owner-policy-{inner,outer}.log.

### A3 / EC001 losing transaction rollback

Distinct U23 checks unchanged losing session revision/state, exactly one successful audit and desired/actual separation under a real deterministic PostgreSQL owner-lock barrier. Existing product baselineGreen; initial unordered enum assertion DEF-US1-014 corrected and verified whole file18pass A3-race-rollback-restored.log. No product code change or artificial intended Red.

### A3 / OPT087 pre-output failure leaves the slot available

Actual MCP missing-key validation rejects before reservation and before command/revision/audit writes. Another configured device is accepted; only its undispatched reserved generation exists, actual remains stopped. Existing implementation baselineGreen, no artificial Red/production change. Whole-file and whole-feature A3-failed-start-{inner,outer}.log. This covers known failure before dispatch, not unsafe heartbeat-only recovery of dispatched executions.

### A3 / delivery prerequisite repair

Confirmed installed MCP catalogue exposes no schedule or standby edit entry. Move original A125/U125 and A126/U126 tasks and acceptance gates, unchanged IDs/criteria, to D1 and E4 respectively, before those edit interfaces are implemented. Registry internal owners now schedules.test.ts / branding.test.ts, actual authenticated native action boundary retained. 1018 unique task entries preserved exactly. No future missing-tool test or unrelated operation accepted as permission evidence; all remain mandatory for owning slice and final feature.

### A3 / OPT082 protected start

One option executed after preceding option Green. Existing OAuth scope gate correctly rejects actual protected operation; state/revisions unchanged and no successful mutation audit. Honest baselineGreen with no artificial Red or product change. Complete internal/native feature logs A3-permission-082-{inner,outer}.log.

### A3 / OPT083 protected stop

One option executed after preceding option Green. Existing OAuth scope gate correctly rejects actual protected operation; state/revisions unchanged and no successful mutation audit. Honest baselineGreen with no artificial Red or product change. Complete internal/native feature logs A3-permission-083-{inner,outer}.log.

### A3 / OPT084 protected destination

One option executed after preceding option Green. Existing OAuth scope gate correctly rejects actual protected operation; state/revisions unchanged and no successful mutation audit. Honest baselineGreen with no artificial Red or product change. Complete internal/native feature logs A3-permission-084-{inner,outer}.log.

### A3 / shared admission paid branch companion

Real owner-row barrier still serializes callers while resolved Pro benefit permits two independent reserved generations, no dispatch or desired-state write by reservation service. Existing service baselineGreen with no production modification. Whole-file A3-pro-service.log. Internal paid branch evidence does not claim US2 actual simultaneous media outputs or owner benefit resolver completion.

### A3 / reservation identity companion

Shared service same-session reservation lookup retains ID, generation, captured revision and undispatched state instead of consuming another slot. Real PostgreSQL transactions, no public idempotent replay claim: A4 U238 remains mandatory for actual control/dispatch. Existing implementation baselineGreen. Whole-file A3-service-reservation-identity.log.

### A3 / completed implementation and acceptance, final coverage gate pending

Current whole admission file24pass without coverage (A3-final-whole-file.log); native complete owner361pass (A3-complete-workflows-policy-restored.log), including all18Runnerfeaturecases. First concurrency behavior has intended preproduction Red and killed owner-limit/mutex mutants; subsequently already-working named options retain honest baselineGreen. All current A3 acceptance/inner rows are DONE; schedule/standby permission rows remain mandatory pending their actual interface owners. T096–T102 and11acceptance gates completed, but T663 remains unchecked until complete affected instrumented Jest and independent critical-path coverage pass. No A3 slice-complete or feature-Go claim is made.

### A3 / final completed-slice gate

## A3 completed delivery checkpoint — 2026-10-15 04:15 UTC

Atomic owner-wide reservation is shared by dashboard and MCP. Actual concurrent starts reserve one Free generation; the loser leaves its original revision/state and no success audit. Existing playback/fallback occupancy, personal-Pro operator versus Free owner, protected operations, pre-output validation rollback, paid reservations and internal reservation identity pass. This does not enable Free media output yet: signed renewable dispatch/terminal recovery and physical graceful drain remain mandatory upcoming work.

Current complete affected application suites:244passed/2514tests, no skips. Complete native owning lane:361passed/no skips, including18Runner feature cases. Final whole admission file24passed without coverage. All eight changed critical files independently meet S95/B90/F95/L95; admission, capabilities, error projection and shared signed codec are100%all metrics. Workflow module is S97.26/B90.36/F100/L100, so no reduced threshold or aggregate-only exception is used.

App production standalone build, action manifest92files, types, root lint0errors/5inherited warnings, additional builder/test lint and formatting73changedfiles pass. Native package qualification is reused only after exact current filesystem hashes match all30A2source/lock/build inputs and retained built artifacts. No protected generated migration changed. Root/native audits and native package tests/capture/Linux executable qualification retain their unchanged-input A2 scope; final full source/global coverage/platform matrix still remains mandatory.

Original unexpected failures and fixes are retained under DEF-US1-013–019. Complete current affected owner and native owner pass. All19recorded defects Verified, no open High/Critical or approved exception. Registry has20TDD and18BDD owners Green out of374primary artifacts; this checkpoint is not whole-feature Go.

Source identity: final native source manifest matches current files; parent Jest application/test/script/config/lock inputs are unchanged from its producer. The one intervening Gherkin change corrects the old paid manual-control expectation and is exclusively re-executed by the complete current native workflow owner. `tdd/evidence/A3-owner-source-verification.json` retains the explicit owner scopes; no identical-entire-tree claim is made.

Evidence: A3-affected-instrumented-coverage-restored.log, A3-complete-workflows-policy-restored.log, A3-final-whole-file.log, A3-critical-coverage.log/A3-critical-summary.json, A3-owner-source-verification.json, A3-build.log, A3-manifest.log, A3-final-typecheck.log, A3-final-lint.log, A3-builder-lint.log, A3-final-format-check.log. Scoped canonical aggregate includes cold unrelated paths and is not a full global gate. Full feature remains **No-Go** until all remaining slices/integrated gates complete.

T663checked only after all current scoped requirements passed. Task inventory1018IDs preserved;128taskscomplete. A125/U125 andA126/U126 remain pending their actual interface owners. No future executable behavior/production was added before this checkpoint.

### A4 / EC002 offline unconfirmed execution — intended Red

Actual disposable PostgreSQL holder is active/dispatched, device health offline with heartbeat two minutes old. Second online device request is rejected without freeing occupancy, but generic limit response omits actionable reconnect/recovery guidance. Whole inner file and whole owning native feature fail only the new expected error classification. No import/setup/fixture failure accepted. No production modification before these Red results. Evidence A4-offline-{inner,outer}-red.log.

### A4 / required untouched scheduler characterizations

U232 exact30s heartbeat remains online; U233 one millisecond older becomes offline. Each actual scheduler sweep executes against disposable PostgreSQL with fixed Date.now, intercepted timer registration and35s-old completion witness, no mock SQL behavior. First row added/run/mutant-killed/restored before second row added. Inclusive-cutoff mutant kills U232;31s-age mutant kills U233; exact original source bytes restored in finally, whole-file Green after each. Evidence A4-health-{cutoff,stale}-{baseline,mutant,restored}.log. Scheduler remains unmodified. These are prerequisite characterizations within the pending offline-recovery behavior; no additional missing product behavior batched and no production changes before its required baselines.

### A4 / EC002 offline recovery guidance — Green

Minimal owner-locked admission change inspects assigned device health only to classify safe recovery guidance; no health value releases occupancy. New public error contains no credentials and advises reconnection. Whole admission+untouched scheduler characterizations27pass, native owning feature19pass. Evidence A4-offline-{inner,outer}-green.log. No refactor needed at this atomic checkpoint; phase formatting and complete affected gates remain mandatory. Lease expiry/terminal reconciliation are still pending, not claimed by this guidance behavior.

### A4 / U138 never-dispatched cancellation — intended Red

Actual authenticated MCP Start reserves without dispatch, Stop changes desired intent but does not yet terminalize that reservation. AfterStop occupancy remains1 instead of0 and second device cannot start. Original admission/generation retained for intended terminal audit. Whole-file A4-cancel-reserved-red.log. No production change before this Red; dispatched claims, stale generations and public retry remain separate subsequent atomic behaviors.

### A4 / U138 cancellation Green

Owner-locked conditional update terminalizes only reserved rows whose dispatchedAt is still null, with explicit cancelled_before_dispatch reason and stoppedAt. Preserves original identity/generation and allows replacement reservation with a new generation. Actual public MCP Start/Stop/second-device Start, whole file26pass A4-cancel-reserved-green.log. Dispatched claims are not released by this helper; lost-ACK stop semantics are the next separate behavior. No refactor needed now; phase-level formatting/gates remain pending.

### A4 / U236 dispatched/lost-ACK stop — intended Red

Controlled dispatch dependency persists starting/dispatchedAt while actual remains stale stopped; actual authenticated MCP Stop must not claim applied or release. Current code reports applied=true and has no draining transition. Whole-file A4-dispatched-stop-red.log fails only new case, prior26Green. This internal contract does not substitute for later actual heartbeat signed-dispatch evidence.

### A4 / U236 dispatched stop Green

Never-dispatched conditional cancellation remains separate. Other nonterminal attempts receive a drain intent under the owner lock, retaining generation and occupancy without a terminal timestamp. Public Stop cannot report applied from stale actual=stopped while admission is pending. Second Free device remains blocked with recovery guidance. Whole admission file27pass A4-dispatched-stop-green.log. Actual signed heartbeat dispatch/terminal acknowledgment remain later owning behaviors, not inferred from this controlled-dispatch contract.

### A4 / U237 stale generation — intended Red

Controlled older attempt has terminal output state; public Start creates a newer attempt with a distinct generation. Stop supplied with old generation but current revision must fail atomically, then matching-generation Stop must work. Existing public schema lacks executionGeneration so request returns INVALID_INPUT. This is actual endpoint missing additive contract, not import/setup Red. Whole-file A4-stale-generation-red.log.

### A4 / U237 generation-bound control Green

Additive optional executionGeneration UUID is accepted by the existing control tool. Under the same owner lock, current nonterminal generation must match before revision/state mutation. Stale generation with fresh revision produces safe CONFLICT and leaves state/audit unchanged; matching-generation control works. Existing callers retain revision preconditions. Whole admission file28pass A4-stale-generation-green.log.

### A4 / U238 public Start retry — intended Red

Exact same authenticated Start input repeated before dispatch must return the original safe result, admission/generation and revision. Existing nextRevision rejects it as CONFLICT. A genuine intervening configuration revision must still conflict. Whole-file A4-public-retry-red.log, prior28casesGreen; no production change before Red.

### A4 / U238 public retry Green and CON002 atomic list complete

Only unchanged requested-running state, preceding request revision and matching captured admission revision in reserved/starting/active can return original safe result without another reservation or revision increment. Optional generation validation still runs first; a genuine config edit remains CONFLICT. Normal per-call success audit convention is retained, matching existing workflow retry behavior. Whole29pass A4-public-retry-green.log. CON002 four rowsDONE; full A4 gates and other contract owners pending.

### A4 / U139 unlink tombstone — intended Red

Actual authenticated unlink of an active/dispatched attempt rotates the bearer but currently loses its terminal reconciliation route. Test inspects existing admission JSON for planned hash/revokedAt without importing missing schema or manufacturing a table; expected terminal hash is absent. Requires retained identity, draining occupancy, no terminal time and no plaintext credential. Whole-file A4-unlink-tombstone-red.log. No production change before this Red.

### A4 / U139 unlink tombstone Green

Admission source schema adds only nullable revokedAt and terminalCredentialHash (no generated migration). Shared owner-locked revocation retains an active attempt as draining and captures SHA256former bearer for its exact admission/generation before rotating credential. Actual public unlink and safe DTO pass whole30tests A4-unlink-tombstone-green.log. Hash alone grants no existing endpoint access; terminal-only route is subsequent behavior. U139 remains incomplete until deletion companion is verified; no overall CON003/A4 completion claim.

### A4 / U139 deletion tombstone — intended Red

Actual public Delete removes device and correctly nulls its FK, while stable admission owner/session/generation remain. It does not yet capture former bearer hash or mark pending closure. Whole-file A4-delete-tombstone-red.log fails new expected tombstone assertion; prior30Green. No missing table/import failure accepted.

### A4 / U139 device deletion Green

Delete invokes shared owner-locked admission revocation before detaching sessions/removing device. Nullable FK clears without erasing stable owner/admission/session/generation or original terminal credential. Actual public deletion, no plaintext or stoppedAt, occupancy1. Whole31pass A4-delete-tombstone-green.log. Dashboard entry consistency and matching terminal ACK are not yet claimed.

### A4 / repeated revocation retains original credential — intended Red

Two actual authorized unlinks on consecutive device revisions must preserve each unresolved generation original bearer hash and revocation instant. Current shared helper overwrites them with an unusable rotated placeholder. Whole-file A4-revocation-repeat-red.log. No product change before Red; no new authority granted by preserving this terminal-only credential.

### A4 / repeated revocation Green

Shared revocation uses database coalesce to retain the first terminal hash and revocation instant for each unresolved generation. Repeated unlink cannot substitute a rotated placeholder or extend the revocation window. Whole admission file32pass A4-revocation-repeat-green.log. No new normal bearer privileges; matching terminal endpoint remains to implement.

### A4 / database-backed Runner test routing prerequisite

New real-PostgreSQL admission/health contracts initially fell into ordinary/unit phases, bypassing connection-aware worker budgeting and compiled RSC-compatible application probes. New partition contract and actual mocked-capacity Runner phase both fail intended new-path assertions (existing casesGreen). Minimal additions to scripts/test-execution.cjs and mcp-test-runner.cjs route test/server/runner and exact app/lib/runnerScheduler tests through database ownership. Whole node partition suite6pass and runtime budget suite3pass. Evidence A4-runner-routing-{partition,runtime}-{red,green}.log. Thresholds, databases-per-case and execution owners unchanged; same test files gain correct existing producer setup. This is test-first infrastructure support for the upcoming actual dashboard contract, not a product regression or skipped case.

### A4 / U139 actual dashboard unlink — intended Red

Existing native browser-action request/session adapter executes the real authenticated Server Action, with controlled active/dispatched admission. Current dashboard unlink bypasses shared owner transaction, so no terminal hash/revocation/draining record is retained. Correct existing database runner producer handles RSC imports; Red is the state assertion, not environment/module failure. Whole-file A4-dashboard-unlink-red.log.

### A4 / real dashboard unlink Green

Existing verified-session principal and current device revision feed the same shared unlink resource transaction as MCP; early permission check and old safe action result/revalidation retained. Actual RSC/session adapter proves terminal hash/draining generation and unchanged actual running state, plus all9existingbrowser revision tests. Combined42pass A4-dashboard-unlink-green.log.

### A4 / real dashboard deletion — intended Red

Authenticated browser action physically deletes the device, with nullable FK preserving admission, but bypasses revocation hash/draining intent and stopped-session revision. Existing adapter actually calls delete; failure is the retained admission contract, not missing dispatch/import/setup. Whole-file A4-dashboard-delete-red.log.

### A4 / real dashboard deletion Green

Dashboard verifies current session principal and owned device revision, then delegates to the same shared resource delete operation as MCP. An already absent owned device keeps prior idempotent safe-success behavior. Actual RSC/session path proves retained hash/generation/draining admission and stopped intent without invented actual closure. Complete admission/browser revisions/action files49pass A4-dashboard-delete-green.log.

### A4 / revoke before dispatch — intended Red

Actual Start reserves but no dispatch occurs; authorized unlink revokes all normal credentials, so no output could have started. This must terminalize failed_before_output with retained audit identity rather than await a receipt from a client never assigned the job. Existing generic revocation puts it in draining. Whole-file A4-undispatched-revocation-red.log.

### A4 / pre-dispatch revocation Green; U139 storage/entry matrix complete

Under owner lock, shared revocation locks each pending generation in stable order. Reserved+never-dispatched terminalizes with revoked_before_dispatch, stoppedAt and free occupancy; dispatched/uncertain remains draining. Original terminal hash/revocation time retained. Actual MCP/dashboard unlink+delete and repeat cases allGreen, whole35pass A4-undispatched-revocation-green.log. No normal credential grants restored; terminal API is next.

### A4 / U239 and DEC002 terminal-only acknowledgment — intended Red

Actual public deletion retains original hashed credential and generation; old-token real heartbeat with renewal input is rejected401. The intended terminal entry is not implemented, observed explicitly by filesystem availability before invoking its separate native route driver. Both outer and inner fail endpointAvailable=true, not import/build/setup errors; no fabricated404/handler response used. Once implemented, the driver will call actual Web Request/Response route against the same disposable DB. No production change before paired Red. Evidence A4-terminal-{inner,outer}-red.log.

### A4 / terminal receipt paired Green

Actual route validates bounded strict receipt, rate-limits hashed bearer, requires original retired hash+exact generation before and after owner lock, and marks only matching admission/actual session stopped. Replayed terminal state returns accepted without rewriting session. Response no-store and no config/jobs. Actual separate native route driver shares disposable DB; Node ESM built-ins preserve existing owner coverage environment. Inner36pass/outer20pass A4-terminal-{inner,outer}-restored.log; initial fixture failure DEF-US1-020 retained and verified. Signed leases and actual native output-closure generation remain separate upcoming proofs.

### A4 / U200 wrong-generation terminal receipt

Existing secure route already denies mismatched generation401/no-store without releasing occupancy, then accepts the same credential for its matching receipt. Added one paired case, honest baselineGreen with no artificial Red or production modification. Whole internal/native A4-terminal-generation-{inner,outer}.log. No sampling or duplicate execution owner.

### A4 / U201 retired authority stays terminal-only

Actual heartbeat with retired bearer and renewal input returns401/no-store, exposes no jobs and leaves admission JSON byte-equivalent. Same bearer still performs matching terminal receipt. Existing production already passes; honest baselineGreen, no manufactured Red or source change. Current whole internal/native A4-retired-scope-{inner,outer}.log.

### A4 / U184 terminal replay isolation

After legitimate closure, same session is reassigned and a newer generation started (active dependency acknowledged in fixture). Replaying original receipt must be idempotent200 without changing new admission, running actual/desired state or revision, occupancy1. Existing terminal-state early return already satisfies it. Honest baselineGreen, no artificial Red or production change; paired whole-file/native A4-terminal-replay-{inner,outer}.log. All DEC002 mappedinnerrows nowDONE.

### A4 / U203 unleased legacy claim does not time out

Protocol1/no capabilities, no issued lease, uncertain dispatched/started/heartbeat observations two hours old (well beyond300+305s) must remain occupied and block another start with guidance. Stored times age without rolling global OAuth clock. Existing policy baselineGreen; no artificial Red or production change. Whole admission file A4-legacy-no-expiry.log. This regression is in place before lease recovery implementation. CON003 mappedrows139/239/203DONE; actual leased Free deadline tests remain separately mandatory.

### A4 / terminal transport prerequisite complete

Inventory contract intendedRed: terminal route missing canonical collector/critical source manifest. Added exact route to both manifests; whole23testsGreen A4-terminal-inventory-green.log. Terminal transport supporting regression18tests baselineGreen, no inventedRed: auth/bounded body/strict closure schema/no-store/rate-limit/error-safety, A4-terminal-transport-baseline.log. Existing DEC002/CON003 primary ownership unchanged; no extra primary artifacts.

### A4 / U199 persisted recovery deadline intended Red

Actual public Start remains rejected at final supported Free issued expiry+305s. Fixture inspects optional new columns before seeding so absence is not an SQL/import/setup failure; current actual existing Start rejects. Final accepted=true assertion fails; all previous whole-file cases remainGreen. `A4-lease-recovery-red.log`. Scope is server recovery only; physical client bounded drain stays mandatory.

### A4 / DEF-US1-022 required outer ordering correction

The initial U199 code followed internal Red but preceded its required outer native workflow Red. Retain initial logs, reject that order as completed test-first evidence. Materialized same-behavior DEC001 server recovery scenario; restored immediately preceding occupancy policy for the actual owning whole feature; outer intended Red rejects accepted=true; reapplied byte-identical minimal recovery. No invented runtime closure, mocked API, skipped scenario or new primary owner. Final paired Green still required.

### A4 / U199 server recovery paired Green

Exact expiry+305s recovers only a persisted dispatched lease-enforcing capturedFree admission, marks terminal/stopped/recoveredAt, preserves identity and permits one replacement within owner lock. No heartbeat-age timeout. Only source schema fields added, no migrations. Corrected outer23/native and internal41 Green; type gate0. DEF21 enum mismatch and DEF22 ordering correction verified, historical failed/early logs retained. Physical native lease/drain and remaining DEC001 rows still pending.

### A4 / U198 exact early boundary and mutation sensitivity

Final issued expiry+305s minus1ms remains occupied/uncertain with no stopped/recoveredAt and recovery guidance. Existing production baselineGreen42internal/24native; no manufactured featureRed. Isolated +304999 margin mutant fails only U198 (41pass/1expectedfail), original source restored byte-exact against retained pre-mutation recovery file and SHA report; whole42pass restored. Native baseline source/fixture inputs unchanged by mutation. U198/U199 server rowsDONE, client/drain and renewal remaining.

### A4 / recovery eligibility supporting matrix

Additional internal DEC001 prerequisites already satisfied: unsupported protocol, missing leaseId, missing expiry, never dispatched, and capturedPaid snapshot each remain uncertain/occupied with no stopped/recoveredAt after a seeded old deadline. Honest baselineGreen47whole-file A4-lease-recovery-prerequisites.log, no production change or manufacturedRed. Native actual issuance/expiry/restart/drain still unbuilt.

### A4 / Free lease binding supporting codec intended Red

Existing shared verifier accepts a correctly signed free_lease policy with wrong admissionId despite matching owner/device/session/gen/revisions. Expectednull actualclaims object; 16oldcasesGreen, A4-free-codec-admission-red.log. This is the current internal codec precondition within existing CON004 owner, no new public runtime behavior or duplicated outer journey. Actual Free dispatch/runtime acceptance under DEC001/DEC003 remains separately mandatory before its wiring. Minimal binding fields are admissionId/leaseId/freshrequestId; no signed lease issuance/new output enabled.

### A4 / signed admission binding Green

Shared execution verifier now recognizes optional free_lease policy and requires UUID admissionId/leaseId/requestId matching the trusted expected identity. Generic existing execution permits retain prior behavior. Whole17pass A4-free-codec-admission-green.log; no new media execution/Free dispatch enabled.

### A4 / signed Free TTL cap intended Red

A valid bound signed free_lease allows300001ms; exact300000ms remainsvalid. Whole18:17previouspass/1expectedfailure A4-free-codec-duration-red.log. Scope is internal codec precondition, no public execution enabled. Generic paid execution permit lifetime remains unchanged.

### A4 / signed Free TTL cap Green

Minimal free_lease-only maximum300000ms within existing signature/identity/time verification. Exact300000accepts,300001rejects; generic paid permits unchanged. Whole18pass A4-free-codec-duration-green.log.

### A4 / Free caller policy intended Red

Caller supplies expected admission/lease/request binding but generic signed execution with no free_lease policy is accepted. Expectednull,18previouscasesGreen; A4-free-codec-policy-red.log. Minimal guard must require the Free policy whenever caller expects any Free-binding field.

### A4 / expected Free policy Green

Any expected admissionId/leaseId/requestId requires explicit signed free_lease policy; legacy generic execution only accepted for generic expected identity. Whole19pass A4-free-codec-policy-green.log.

### A4 / Free binding regression matrix baseline

Signed wrong/missing/malformed admissionId, leaseId and requestId reject; fully/partially unbound verifier caller rejects Free lease. Existing implementation baselineGreen23whole-file A4-free-codec-bindings-baseline.log; no manufacturedRed. Fresh nonce pending-request lifecycle still requires native guard, not claimed here.

### A4 / Free codec refactor checkpoint

Formatted shared protocol and existing heartbeat contracts; whole23Green, native/app TypeScript0. No public Free streaming path enabled. Next internal prerequisite is monotonic Free lease guard, with actual mapped DEC001/DEC003 integration still mandatory.

### A4 / monotonic lease prerequisite corrected intended Red

Explicit missing FreeExecutionLease API assertion (typeof undefined, expectedfunction), module imports correctly;23previouscasesGreen. A4-free-clock-before-corrected-red.log. Original import failure DEF23 is not featureRed. Internal guard prerequisite only; no mapped native output expiry/drain row completion claimed.

### A4 / monotonic lease primitive Green

Fresh signed response matches new random request nonce. Deadline anchors to request-send monotonic time, conservatively charging full response latency; verification uses signed issued time plus nonce rather than PC wall clock. Constructor has no accepted lease. Active remains at299999ms. Whole24pass A4-free-clock-before-green.log. Internal primitive only, no output-start/journal path wired or U196 markedDONE.

### A4 / monotonic exact expiry primitive baseline

Existing guard state transition drains exactly at300000ms, refuses renewal/newaccept and remainsdraining after clock rollback. Honest baselineGreen25whole-file A4-free-clock-expiry-baseline.log, no manufacturedRed. This supports future actualruntimeU197 but does not close its mapped entrypoint obligation.

### A4 / late initial response intended Red

Verified bound response arriving at conservative request-anchor deadline is rejected but phase remainsrenewal_required, allowingnewattemptsamegeneration. Mustirreversiblydrain. Whole26:25previousGreen/1expectedfailure A4-free-clock-late-red.log.

### A4 / late first response Green

After signed nonce/identity validation, arrival at or after conservative monotonic deadline setsdraining and rejects; no same-generation renewal. Whole26Green A4-free-clock-late-green.log.

### A4 / replay and fresh-process primitive baseline

Consumed valid signed responses cannot extend monotonic deadline, including during a newer pending request. New process beginsrenewal_required, cannot accept previousprocess signed response evenafterfreshnonce. Existing implementation baselineGreen28wholefile A4-free-clock-replay-restart-baseline.log; no manufacturedRed. Journal durability and actual runtime remainpending.

### A4 / legacy untracked rollout paired intended Red

Real existing session desired/actualRunning on offlineprotocol1device predates admission rows. Another Start succeeds incorrectly (no recovery code), rather than retaining one uncertain nonleased claim. Paired inner47oldGreen/1fail, outer24oldGreen/1fail A4-legacy-rollout-{inner,outer}-red.log. Recognition must persist even though rejected Start configuration/successaudit remainunchanged.

### A4 / legacy rollout recognition paired Green

Owner-locked snapshot recognizes old desiredRunning or nonStopped actual sessions lacking nonterminal admission as uncertain/nonleased; historic paid Runner output is captured aslegacy rather than retrospectivelyleased. A narrow typed legacy-reconciliation rejection commits only lifecycle bookkeeping and rechecks authority, then throws the normal safe recovery error outside the transaction; no requested config/newreservation/successaudit. Other errors retain rollback. Whole48internal/25native Green, app/native types0. Stop/unlink/delete bootstrap guards are next; no A4 completion.

### A4 / legacy Stop paired intended Red

Old desiredRunning/staleactualStopped with noadmission: realStop returnsappliedtrue, so pending unknownoutputcanvanishbeforeanotherStart. Expectedappliedfalseandnonleaseddrainingclaim. Whole49internal48previousGreen/1expectedfail, outer26with25previousGreen/1expectedfail A4-legacy-stop-{inner,outer}-red.log.

### A4 / legacy pending Stop paired Green

Before reserved-only cancellation, recognize owner legacy sessions under same lock. Unknown old pending attempts becomeuncertain then requestBroadcastDrain retainsnonleasedgeneration and Stopappliedfalse. Only authorizedStop succeeds/audits; replacementStartblockedwith unchangedrevision. Whole49internal/26native Green A4-legacy-stop-{inner,outer}-green.log.

### A4 / shared controller existing regression checkpoint

After legacy recognition/Stop, existing dashboard action, actualbrowserrevisionadapter and MCPcapability files18tests/3suites Green A4-legacy-shared-control-regression.log. No repeats of unchanged fullcoverage; A4completiongatespending.

### A4 / legacy unlink paired intended Red

Actual unlink succeeds/rotates credential but oldbroadcast lackedadmission, so terminalhashcannotmatchoriginal; lateStartrecognitionisnotadequate. Expectedformerhash/drainingunleasedtombstone, actualfalse. Whole50internal49previousGreen/1expectedfail, native27with26previousGreen/1expectedfail A4-legacy-unlink-{inner,outer}-red.log.

### A4 / legacy unlink paired Green

Shared revocation recognizes old owned output before credential rotation/session desiredStop update, then creates draining nonleased tombstone with original hash. Replacement Start remainsblocked, no successaudit/newcfg. Whole50internal/27native Green A4-legacy-unlink-{inner,outer}-green.log. Same shared entry should preserve physicaldeletion; verify as honest regression next.

### A4 / legacy delete baseline Green

Common revocation fix already captures pre-admission old output before physicaldevice removal. Honest baselineGreen51internal/28native, originalterminalhash retained anddeviceFKnull, no replacementStart/config/successaudit. A4-legacy-delete-{inner,outer}-baseline.log; no artificialRed/productchange. Normalized DEC002 existingGherkinFR-002 tags toregistry source, identicalscenarios preserved.

### A4 / same-session pending drain restart paired Red

RealStart->controlledcommitteddispatch->Stop->same-sessionStart currentlyrevivesdesiredRunning/incrementsrevisionwhilepriorgenerationdraining. ExpectedRecoveryandunchangedstoppedintent/admission/successaudit2. Whole52internal51previousGreen/1expectedfail, native29with28previousGreen/1expectedfail A4-restart-draining-{inner,outer}-red.log.

### A4 / no revival before closure paired Green

reserveexistingdraining/uncertainreturnsRecoveryinstead ofreusingitforStart; a newlyrecognizedlegacydenialretainsitsnarrowcommittedreconciliationpath. Otherreserved/starting/activeattemptsretainidentity. Whole52internal/29nativeGreen A4-restart-draining-{inner,outer}-green.log. No physicalnativeengineclaim.

### A4 / first signed Free dispatch paired intended Red

RealownerStartreservesFreeattempt, real supportedheartbeatprovidesfreshUUIDrequestnonce; actualoldpaidgate403vsrequired200. Paired53internal52priorGreen/1expectedfail, native30with29priorGreen/1expectedfail A4-lease-dispatch-{inner,outer}-red.log. FixtureephemeralEd25519keysunderapprovedRUNNER_EXECUTION_SIGNING_PRIVATE_KEY onlychildprocess, no deploymentsecrets.

### A4 / approved old Free policy characterization superseded

U231 oldpaid-only403 baseline intentionallyDROPPED: approvedFreebasic/unlimitedhours policy replacespurchase gate with supportedv2lease negotiation. Existing testcase nowexplicitreplacementassert426update_required/jobs[] foroldFreeclient; no protectedoutputsideeffect. Original A2 baselineevidence retained. CorrectlynegotiatedFreepublicdispatch is currentpairedRed/Greenbehavior. Officialnativecontroller/presentation and C2/C3 paidbenefit/capturedexecution transitions remain unbuilt and blockrelease.

### A4 / initial signed Free dispatch paired Green

Existing authenticated heartbeat accepts supportedFreev2+nonce; owner-locked service rechecks currentbearer, assignedownedrunningsession, capturedFreeadmission andownedactivesource; signsEd25519bound300spermit using approvedenvkey; persistedleaseId/deadline/protocolsupports/dispatched+startingcommit precedesresponse. Invalid/unadmittedFreeoutputgetsno protectedsource/key. SupersededU231403baselineDROPPEDwith426replacement; actualofficialnative/presentationC2/C3capturedpaidtransitionsstillunbuiltblockingrelease.81internal/30nativeGreen; appTypeScript0.

### A4 / authenticated lease renewal baseline Green

Existing issuer renews beforeexpiry underownerlock, keepingadmission/generation/leaseId/originaldispatch andpersisting later signeddeadline. Freshrequestnonce andexact100000msextensionverifiedagainstrealWebroute. HonestbaselineGreen54internal/31native A4-lease-renewal-{inner,outer}-baseline.log; no manufacturedRed/newproductionchange.

### A4 / matching active generation ACK paired intended Red

RealassignedFreeclient acknowledgesexactadmission/gen/lease/capturedrevision aftersignabledispatch; currentpayloadstripsnewexecutionsfieldsoadmissionremainsstartingandactualnotrunning. Expectedactive/appliedrunning withoriginaldispatch/gen. Whole55internal54previousGreen/1expectedfail, native32with31previousGreen/1expectedfail A4-active-ack-{inner,outer}-red.log.

### A4 / matching active ACK paired Green

Strictboundedexecutiontelemetry, ownertx/devicebearerrecheck/assignedsession/exactid-gen-lease-capturedrevision/dispatched/unexpiredFreechecks. Markactive/firststartedAt/lastObservedAt andactualRunning, no newgen/dispatch. FreeoldactualStatesignored.83internal/32nativeGreen A4-active-ack-{inner,outer}-green.log; appTypeScript0. Actualnativeoutputreporting/closurestillunbuilt.

### A4 / normal closed-output ACK paired intended Red

Exactadmission/gen/lease/capturedrevision withstopped/allOutputsClosedtruegets400(active-onlyschema), shouldterminalizewithoutcredentialsandreleaseoccupancy. Whole56internal55priorGreen/1expectedfail, native33with32priorGreen/1expectedfail A4-stop-ack-{inner,outer}-red.log.

### A4 / matching normal terminal ACK paired Green

StrictstoppedformrequiresallOutputsClosedtrue. Owner/device/session/gen/lease/capturedrevisionbound, originaldeadline/genretained, terminalreplayearlyignore. ActualStopped+desiredStoppedwithrevisionincrementonlyifintentchanged; noFreeoutputsecretsafterclosure.84internal/33nativeGreen A4-stop-ack-{inner,outer}-green.log, appTypeScript0. This iscontrolplanereconciliation; actualnativeall-outputclosurestillmustbebuilt/proven.

### A4 / invalid terminal authority matrix baseline Green

Existing guards reject wrongadmission/session/gen/lease/revision, falseclosure400, otherdevice anddifferentownerBearer. ActualFreelegacyactualStatescannotapplyunboundstoppedstate. Internalprecisesession/admissionstate/timestamp/revisioninvariants64Green; outerhighlevelvalidbroadcastslot/state41Green. A4-ack-rejection-{inner,outer}-baseline.log. ValidownheartbeatmayrenewownleasewhileignoringbadACK; snapshotpurposefullyexcludeslegitrenewaldeadline. No manufacturedRed/newproductionchange.

### A4 / exact renewal expiry boundaries baseline Green

Beforeexpiry-1ms realrenewalvalidextends299999ms. Atexpiry/+1ms noperpermit/nocredentials, originaldeadline/gen/idretained, irreversibleadmissiondrainingwithoutinventedclosureorfreedslot. Existingimplementationhonestbaseline67internal/44native A4-lease-expiry-{inner,outer}-baseline.log. No manufacturedRed/sourcechange; actualnativeboundedstopremainsrequired.

### A4/A5 shared native prerequisite ordering clarification

Sourceinspection engine.ts:600stop destroyscapture/killsffmpeg, overlayPlayer.ts existinghooks start/stopFallbackonly. A4 native leaseexpiry finish-current-clip needs A5 shareddrain. Clarified taskDAG: A4serverbehaviorGreen ->A5T113–T120RGR ->A4nativejournal/expiry ->bothblockingT664/T665combinedsourcegatesbeforeA6. All1018taskIDs/orderrecords and374primaryartifactIDs preserved, no gates/thresholds/scenariosskipped. This is an authorized dependency repair, not a completion or waiver.

### A4 / normal terminal replay isolation baseline Green

Realfirstlease->normalallClosedACK->newpublicStart->newdispatch->matchingactiveACK->oldnormalclosedACK. NewactualRunning/configrev4/activegen/starttime/occupiedslot andoldclosedrecordunchanged; validcurrentheartbeatmayrenewnewlease. Honestbaseline68internal/45native A4-normal-replay-{inner,outer}-baseline.log. No manufacturedRed/newproductionchange.

### A5 / shared native drain paired intended Red

OuterrealEngine/Chrome/customshippedextension/FFmpegFLV, ownloopbackvideo/eventsource, isolatedconfig/cachepaths. Waitactualencodedoutput, captureCURRENTclipIDandmidcliptime, assertcompletion/nosuccessor/finalencodedgreenframe/closedhandles. CurrentEngine.stopcutscurrentclip; A5-native-drain-outer-frame-red.log. InnercontrolledpagereportsclipongoingbutengineisRunningalreadyfalse; A5-native-drain-inner-corrected-red.log. DEF25path/26promisedWSScleanup/27wrongclipmeasurementlogsretainedandrejected; no raisedtimeouts or skippedproofs. No productiondrainbeforethesepairedassertionfailures.

### A5 / actual player drain interface intended Red

ActualOverlayPlayercomponent underRunnerexecutioncontext doesnotexposesharedbridge (undefinedexpecteddefined), while55existingcomponentcasesGreen. A5-player-drain-bridge-corrected-red.log. Supportingfrontendcontract is distinctfromnativecontrolledshutdownunitandphysicalcaptureouter. Preservecurrentvideopausecallcount, suppressnear-endcrossfade/nextadvancement andfinishonactiveended. NativeprimitivealreadyGreen; no frontendproductionbeforethisRed.

### A5 / native drain primitive and real player bridge Green

Nativeinnercontrolledlifecyclepasses, nativeouterrealclip/FFmpegfinaldecodedframe/nosuccessor/closedhandlespasses A5-native-drain-{inner-restored,outer-last-frame-restored}.log. ActualOverlayPlayerbridgecurrentvideonotpaused,nearendadvancementblocked,endeddrained with55ordinaryregressions passes56 A5-player-drain-bridge-green.log. Coreprimitivebindingstillneedsnativeexecutioncontext/normalCLIStop/journal/fullgates, noA5completion. ReadinstalledNextuse-clientguidebeforeclientcode; server/privatepropsnotmovedintobrowser.

A5 CLI Stop supporting cycle: whole-file controller test Red for the intended missing behavior: normal Stop invokes force stop instead of requestDrain. Evidence: tdd/evidence/A5-controller-drain-red.log. No unexpected defect.

A5 CLI Stop cycle Green: tdd/evidence/A5-controller-drain-green.log (1 whole-file case). Actual dispatcher requests graceful drain asynchronously, retains running state until closure, guards completion by engine identity. This does not complete A5 or its quality gate.

A5 overlapping cleanup supporting Red: A5-overlap-stop-red.log, prior clip-drain case passes; second concurrent Stop incorrectly resolves while browser.close remains pending. Intended missing lifecycle behavior, not unexpected regression.

A5 overlapping cleanup Green: A5-overlap-stop-green.log, 3 files/8 tests. Concurrent callers share the same cleanup promise and cannot report closure before the browser closes.

A5 encoder closure cycle: initial A5-signalled-encoder-red.log was baseline Green but insufficient: three microtasks did not flush the full cleanup chain. No production changed from that result. Strengthened to an event-loop barrier; A5-signalled-encoder-corrected-red.log proves intended missing behavior: already-signalled encoder falsely reports closure before close. Preserve both logs; only corrected result is Red evidence.

A5 encoder closure Green: A5-signalled-encoder-green.log. Previously signalled processes must still emit close; child.killed no longer stands in for process exit. Three affected files/nine tests pass.

A5 cleanup intersection Red: A5-drain-during-stop-red.log; graceful request during emergency stop incorrectly resolves before physical browser closure. Intended lifecycle evidence before change.

A5 cleanup intersection Green: A5-drain-during-stop-green.log, graceful request observes the existing emergency-cleanup promise. Ten affected tests pass. No story gate completed.

A5 watchdog characterization baseline Green: A5-drain-watchdogs-baseline.log, 8 whole-file tests. Exact 60s no-progress, mismatched-generation no-progress, 300s progressing clip ceiling, and stricter 12s absolute deadline pass unchanged. No invented Red or test-first claim for existing behavior.

A5 command race Red: A5-draining-restart-red.log. A changed-configuration Running heartbeat during pending Stop force-kills the draining engine. Expected guard against reopening/restarting before terminal closure; current output must finish its clip first.

A5 command race Green: A5-draining-restart-green.log (3 files/14 tests); live engine remains exclusively draining despite changed Running heartbeat. Native typecheck exit0: A5-native-lifecycle-typecheck.log. Real media owner rerun after cleanup changes passes: A5-native-lifecycle-real-media-green.log. Shared final full gates and complete T117 integration still pending.

A5 emergency cycle: actual CLI A5-explicit-emergency-red.log proves explicit immediate stop is ignored during graceful drain. Actual engine real-media emergency behavior is already baseline Green, A5-emergency-media-baseline.log (two native scenarios), no artificial Red for existing engine.stop. Only the command-dispatch gap requires production change.

A5 explicit emergency dispatcher Green: A5-explicit-emergency-green.log (3 files/14tests). stopMode=immediate may interrupt an already-draining engine; ordinary Running/config changes remain blocked until terminal. Real emergency engine output cleanup remains baseline Green from A5-emergency-media-baseline.log. Backend Stop now transport, durable receipt, and final gates remain pending.

A5 server Stop now transport Red before production: A5-emergency-control-inner-red.log (68 priorpass/1 intendedRed) and A5-emergency-control-outer-red.log (45 priorpass/1 intendedRed). Strict current schema rejects stopMode=immediate, so no accepted intent; command scenario uses actual MCP+disposable PostgreSQL. Physical native media owner remains independently Green. Add scoped stop mode to the admission and shared control input; do not treat intent as terminal evidence.

A5 DEF-US1-029: A5-emergency-control-typecheck.log confirms missing sql import. Pre-fix whole runs retained: A5-emergency-control-inner-green.log actually failed 4/69; A5-emergency-control-outer-green.log actually failed 3/46. Filenames indicate attempted phase, not result. Neither is Green evidence. Existing Drizzle sql import added; A5-emergency-control-{inner,outer,typecheck}-restored.log runs now pending. One read-only diagnostic tool request hit auto-review timeout; identical diagnostic retry succeeded, with no blocker or scope change.

A5 emergency server intent cycle restored Green: A5-emergency-control-inner-restored.log 69pass, A5-emergency-control-outer-restored.log 46pass, A5-emergency-control-typecheck-restored.log exit0. DEF-US1-029 verified. Admission stopMode is generation-bound through existing shared revision/identity checks; immediate intent cannot be downgraded by later graceful intent. Intent does not release occupancy. Native media remains the primary FR004 owner; workflow control is distinct supporting business-boundary evidence, not a duplicate physical journey or another primary artifact. Complete heartbeat delivery/dashboard action and durable terminal integration still pending, so T117/A5 gate remain incomplete.

A5 emergency delivery Red before code: A5-emergency-delivery-independent-inner-red.log (28priorpass/newmetadataRed, independent fixture reset); actual MCP/heartbeat/PostgreSQL A5-emergency-delivery-outer-red.log (45priorpass/newdeliveryRed). Both return200/no output secrets but lack exact admission/generation/commandId/stop_now/stopMode. Persist command ID on admission and project only the assigned stopped command after telemetry reconciliation.

A5 heartbeat emergency delivery Green: A5-emergency-delivery-inner-green.log29pass; admission-green.log69pass; outer-green.log46pass; typecheck.logexit0. Admission commandId UUID persists and rotates on legitimate stop requests. Heartbeat adds exact assigned owner/device/admission/generation/captured revision/commandId/stop_now/stopMode without output secrets. Complete slice/journal/native expiry/UI still pending. Next safety cycle addresses stale session snapshots seeing a replacement generation; do not treat current projection as complete until its race guard passes.

A5 scoped-execution ownership correction following the user reminder: extract the emergency MCP scenario from runner-free-pro.feature (46 scenarios) to runner-stop-control.feature (1 scenario), leaving45 unrelated registration/recovery scenarios in their existing file. Preserve exact BDD-US1-FR004 ID and all existing steps/assertions. Move the sole duplicate FR004 end-to-end admission.test.ts case's exact session state/revision assertion into that workflow owner; remove only that duplicated journey (69->68 internal cases). Its native drain.test.ts internal contract and heartbeat.test.ts controlled route projection remain distinct TDD owners. Existing historical evidence is retained, never rewritten. New command-file whole-scenario execution supplies the single business workflow owner and coverage; physical native media remains its distinct output boundary. One-time complete owning-file/inventory validation qualifies the extraction; subsequent command changes run only their affected whole files. Full suites/coverage remain completion gates, not per-edit checks. No skipped behavior, sampling, threshold or artifact/task ID change.

A5 scoped ownership refactor Green: A5-stop-owner-focused-green.log (entire new owning feature1pass,4.3s), A5-stop-owner-inventory.log (46scenarios in2files =45retained+1extracted), A5-stop-owner-assertion-parity.json verifies all9 former duplicated assertion expressions are present in the workflow owner, including exact state/revision and delivery bindings. Production source unchanged during extraction; remaining45 scenario text retained by surgical trailing split and their prior Green is retained, not rerun per small command change. The native internal drain and physical media boundaries remain distinct. Full combined-source milestone gates remain pending.

A5 stale snapshot cycle Red: A5-stop-snapshot-race-inner-red.log30cases/oneintendedRed and A5-stop-snapshot-race-outer-red.log2scenarios/oneintendedRed. Actual heartbeat sessions are captured stopped; controlled DB interleaving closes old admission and starts a new active generation before the real command lookup. Current response incorrectly binds the old stop snapshot to that replacement. The control probe wraps only the lookup boundary, performs actual SQL changes and executes the original query, not mocked command/results. Restrict stopped-command projection to an admission with actual draining intent.

A5 stale snapshot cycle Green: A5-stop-snapshot-race-inner-green.log30pass3.234s and A5-stop-snapshot-race-outer-green.log2pass8.2s. Stopped command lookup and final projection both require actual draining state; a newer active generation cannot inherit an old snapshot Stop. No repeated69-admission/45-unrelatedworkflow runs for this projection-only follow-up. Complete milestone gates remain mandatory.

A5 preparation cancellation internal cycle Red: A5-stop-during-prepare-independent-red.log6cases/oneintendedRed. New test moved under the existing explicit beforeEach fixture setup before production, retaining earlier output separately. Stop while dependency preparation is pending cannot permit a late browser/encoder launch. Applicable native physical Stop outer scenarios remain Green and are reused while unchanged; current internal lifecycle behavior is distinct from those media journeys. Real media whole owner will rerun at the native lifecycle checkpoint.

A5 preparation cancellation Green: A5-stop-during-prepare-green.log6pass. Recheck execution state immediately after dependency preparation before creating any browser/output resources.

A5 late browser lifecycle Red: A5-late-browser-corrected-red.log7cases/oneintendedcloseassertionRed. Initial new fixture page TypeError rejected and tracked DEF-US1-030; corrected page interface proves missing cancellation before any production change. Retain applicable current native media outer Green for the unchanged output contract; rerun physical owner at native lifecycle checkpoint.

A5 late-browser cancellation Green: A5-late-browser-green.log7pass. A launch completing after cancellation is closed before page or capture setup. DEF-US1-030 fixture correction verified by corrected intended Red then Green.

A5 terminal-generation internal Red: A5-terminal-engine-restart-red.log8cases/oneintendedRed. Calling start again on a closed Engine reopens resources while its stop promise is already terminal. Terminal instances must stay closed; new admitted generations use new Engine instances.

A5 terminal-generation Green: A5-terminal-engine-restart-green.log8pass. A terminal Engine instance cannot be reused; fresh admitted executions must construct a fresh instance. Native internal cycles run whole owning files without coverage; broad milestone checks remain pending.

A5 live forwarding cleanup Red: A5-live-output-close-order-red.log9cases/oneintendedRed. A stalled Chromium.close currently delays OBS-forwarder output closure. The live stop contract has no generated clip boundary; close all output encoders before waiting for presentation cleanup.

A5 live output cleanup Green: A5-live-output-close-order-green.log9pass. Both generated and live encoders close before presentation/browser shutdown can delay terminal cleanup. Native lifecycle component now reaches a checkpoint: run complete affected native package including its two real-media scenarios, plus native types/format. This is a meaningful subcomponent milestone, not a full application/coverage rerun per edit; A4/A5 final combined gates remain pending.

DEF-US1-031 causal reproduction before fix: A5-capture-install-order-red.log2cases show both installed CJS and ESM BrowserLauncher resolve before controlled extension installs finish. A5-capture-slow-install-runtime-red.log delays actual installExtension1500ms and deterministically reproduces the identical ERR_BLOCKED_BY_CLIENT in real Chromium. The diagnostic isolation Green is not accepted as repair; causal code bug is await Promise.all([enableExtensions.map(...)]) awaiting a nested array. Narrow patch will flatten the promise list, with no timeout increase or weakened media assertion.

A5 native lifecycle subcomponent checkpoint restored Green: A5-native-lifecycle-complete-checkpoint-restored.log9files39pass/1unchangedexistingtodo, including2realChromium+FFmpeg scenarios. Causal extension-order regression2pass and delayed actual installation media captureGreen in A5-capture-{install-order,slow-install-runtime}-green.log. Pinned capturecore24 remains API-compatible beside direct25; patch changes only Promise.all nesting in CJS/ESM. Native patch validation passes3dependencies/4files/4changed-line typechecks. Generic resolver regression3pass covers validnestedversion, rejectsmissingexactversion and rejects a missing patch target in another matching installed copy. Root patch-validator and final dependency input checks pending; no final A4/A5 gate claimed.

A5 terminal journal prerequisite Red: A5-terminal-journal-functional-red.log asserts actual recoverable receipt contract before implementation. Earlier file-existence-only A5-terminal-journal-red.log is retained but not used as behavior Red. This first unit exercises durable record availability, not physical media shutdown; physical Stop scenarios retain their applicable Green evidence until runtime journal integration is tested. Store only allowlisted execution identity/state fields, protected atomic write/rename, retain terminal receipt until explicit acknowledgment.

A5 terminal journal first Green: A5-terminal-journal-green.log1pass. Protected atomic record survives process reconstruction as a pending output-closed receipt. Unknown job secrets are excluded by explicit field projection. Runtime persistence-before-ACK wiring remains pending; no slice completion claimed.

A5 journal ACK cycle Red: A5-terminal-journal-ack-red.log2cases/oneintendedRed. Wrong-generation terminal confirmation must be rejected without removing pending durable receipt; only exact matching admission/generation confirmation retires it durably.

A5 journal ACK Green: A5-terminal-journal-ack-green.log2pass. Admission/generation mismatch keeps the durable terminal pending; exact matching acknowledgment persists retirement across restart. Runtime heartbeat response must explicitly confirm acceptance before calling this operation.

A5 journal atomic durability baseline Green3cases A5-terminal-journal-atomic-baseline.log, then same3Green after portable writable exclusive-fd fsync refactor A5-terminal-journal-atomic-refactor.log. Prior snapshot/temp cleanup/protected mode preserved on controlled rename failure. New corruption contract Red A5-terminal-journal-corruption-red.log4cases/oneintendedRed: parser echoes private snapshot contents into throwable diagnostic. Wrap load validation with a fixed safe error; never start from an empty fallback after corrupt state.

A5 journal corruption Green: A5-terminal-journal-corruption-green.log4pass. Corrupt/oversized/invalid snapshot cannot silently become an empty journal, and parser contents are not echoed into runtime diagnostics. Runtime must surface this initialization failure and block new output until reconciled.

A5 journal terminal-state Red: A5-journal-terminal-replay-red.log5cases/oneintendedRed. A replayed active record currently replaces a terminal output-closed receipt; prohibit terminal-to-nonterminal transition before any atomic write. Earlier four tests remain Green after fixture-only cleanup A5-terminal-journal-fixture-refactor.log.

A5 journal terminal-state Green: A5-journal-terminal-replay-green.log5pass. Replayed active state cannot erase persisted closed-output receipt. Next internal invariant freezes the identity fields belonging to that admission before native runtime uses stored records.

A5 journal immutable identity Red: A5-journal-identity-red.log11cases/sixintendedfailures, one parameterized invariant. Existing admission owner, device, session, generation, lease and captured configuration revision cannot be rebound by subsequent local state writes; fresh executions use fresh admission IDs.

A5 journal immutable identity Green: A5-journal-identity-green.log11pass. Every persisted identity component is fixed for the admission. This does not authorize offline starts; the upcoming runtime requires a fresh nonce-bound signed lease independently of stored state.

A5 journal drain irreversibility Red: A5-journal-drain-replay-red.log13cases/twoparameterizedfailures. Once draining begins, neither a replayed starting nor active record may reactivate it; only remaining draining or terminal closure is allowed.

A5 journal drain irreversibility Green: A5-journal-drain-replay-green.log13pass. Persisted draining cannot regress to starting/active; terminal completion remains allowed. Next A4 native request-context prerequisite is distinct from journal state: valid leases must adopt the original heartbeat send-time/nonce even when the assignment identity is learned only from the response.

A4 first request-context Red: A4-initial-request-context-owning-corrected-red.log1intendedRed. Single shared protocol-unit owner moved from temporary native file to test/app/lib/runnerExecutionLease.test.ts so its exact shared-source counters belong to the existing parent instrumentation stack; no duplicate retained. Initial move path failure tracked DEF-US1-033, rejected as Red. Original A4-initial-request-context-red.log proves same missing behavior in native harness before move. Adopt only valid original send-time/nonce context; never reset to response receive time. Runtime end-to-end expiry still pending.

A4 initial request-context Green: A4-initial-request-context-green.log1pass. The valid signed response can adopt the original nonce/send-time after its resource identity is learned, while deadline stays originalSend+TTL and roundtrip time is consumed. Native output integration is still pending; no end-to-end lease enforcement claim. DEF-US1-033 path fixture verified by corrected intended Red and Green.

A4 native signed execution start Red before production: A4-native-execution-start-red.log unit verifies journal starting exists before output factory/start and active only after start; A4-native-execution-start-outer-red.log real native owner reaches its intended runtimeAcceptedfalse assertion after actual Chromium/FFmpeg clip capture. Missing controller uses prior direct Engine path only to expose the missing signed-control behavior; no mock successful output/API response or setup error is used as Red. New unit `packages/runner/src/__tests__/execution-runtime.test.ts` and real native owner packages/runner/test/bdd/runner-free-leases.test.ts add distinct runtime boundaries to existing DEC001, retaining server recovery ownership/evidence without duplicate primary IDs.

A4 native signed start cycle Green: A4-native-execution-start-green.log1unit; A4-native-execution-start-outer-green.log1real-nativecase27.554s. Actual fresh Ed25519 assignment passes production FreeExecutionController -> protected journal -> real Engine -> Chromium/media/FFmpeg. Controller still requires independent expiry tick and command-loop integration; this evidence does not complete A4, U196 or DEC001 full acceptance. Supporting request context/identity validators remain parent instrumentation-owned, no duplicate shared-source coverage owner.

A4 automatic native expiry Red before production: A4-native-lease-expiry-red.log unit2cases/oneexpectedRed; A4-native-lease-expiry-outer-corrected-red.log real signed/captured clip reaches runtimeExpiredfalse expectedassertion with working expiry fixture. Earlier missing-hook run outer-red.log rejected DEF-US1-034. Tick must persist draining, close actual output by captured lease deadline+300s, and persist terminal proof before exposing receipt; duplicate ticks share one shutdown.

A4 native independent expiry cycle Green: A4-native-lease-expiry-green.log2unitpass, A4-native-lease-expiry-outer-green.log1realnativepass27.155s. Controller tick enters persisted draining at original monotonic deadline, passes deadline+300000 absolute bound to real Engine, waits all output cleanup, persists Stopped+allOutputsClosed, then exposes terminal receipt. Duplicate tick close promise is memoized. Main heartbeat-loop integration, storage failure safety, terminal replay guard and accepted-receipt protocol still pending; no A4/A5 completion claimed. DEF-US1-034 corrected fixture verified by semantic Red/Green; original missing-hook run retained/rejected.

A4 expiry storage-failure internal Red: A4-expiry-drain-write-failure-red.log3cases/oneintendedRed. A failed intermediate drain-intent write currently prevents even requesting output shutdown. Persist terminal proof separately after actual closure; bounded stop cannot depend on successfully writing its intermediate state. Applicable successful real-output expiry owner remains Green and will rerun at the native component checkpoint.

A4 expiry intermediate-write-failure Green: A4-expiry-drain-write-failure-green.log3pass. Shutdown proceeds despite failed draining write; only a separately persisted, actual output-closed terminal record becomes pending for ACK. Next unit checks durable-terminal retry without reopening output when the terminal write itself fails.

A4 terminal persistence retry Red: A4-terminal-write-retry-red.log4cases/oneexpectedRed. A completed physical drain with a failed terminal write must not expose a receipt, but must retry persistence after disk recovery without restarting or re-closing outputs. Current memoized rejected cleanup promise prevents recovery.

A4 terminal persistence retry Green: A4-terminal-write-retry-green.log4pass. Output closure is remembered independently of durable write success; failed terminal write exposes no receipt and resets only the retry promise. Later tick retries persistence without restarting or reclosing output. Final native controller checkpoint will rerun applicable physical owners; no broad application suite repeated per fault injection.

A4 restarted-controller journal reconciliation Red: A4-runtime-journal-replay-red.log7cases/3parameterizedfailures. Persisted draining/stopped generations (including already acknowledged terminals) must be rejected as a normal denied apply before attempting to overwrite state. Existing journal transition guard already blocks physical reopening; this cycle makes runtime recognition explicit rather than falsely claiming a previously possible output replay. A fresh nonce/signed response cannot reset a locally irreversible generation.

A4 restarted-controller reconciliation Green: A4-runtime-journal-replay-green.log7pass. A read-only cloned journal lookup recognizes persisted draining/terminal state (including acknowledged receipts) before attempting a new start. Journal already prevented physical state regression; runtime now returns explicit denied result rather than an invalid-write error.

A5 late capture internal Red: A5-late-capture-after-stop-red.log9cases/oneintendedRed. Engine.stop completes while getStream is pending, but the late stream then spawns FFmpeg despite terminal state. Recheck state and original page after capture resolves, destroy only that late stream, and never overwrite/open output for a stopped execution. Applicable real media Stop/expiry owners stay mapped and rerun at native lifecycle checkpoint.

A5 late capture after terminal Stop Green: A5-late-capture-after-stop-green.log9pass. The captured stream stays local until state/original-page revalidation, and is destroyed on cancellation without spawning or piping an encoder. Next internal unit covers cancellation during the later playback-start evaluate boundary.

A5 late playback activation Red: A5-late-activation-after-stop-red.log10cases/oneexpectedRed. Capture is obtained, then Stop closes it while browser playback evaluate is pending; resuming that await currently spawns a new encoder after terminal cleanup. Revalidate the execution/page immediately before spawning output, not only before the prior asynchronous capture call.

A5 late playback activation Green: A5-late-activation-after-stop-green.log10pass. Both asynchronous capture and playback-activation boundaries now recheck current execution/page before opening FFmpeg. Old successful callbacks cannot open output after Stop.

A4 late startup completion Red: A4-startup-after-expiry-red.log8cases/oneintendedRed. Independent expiry closes/persists the execution while start awaits; a late success must be a normal denied apply, never an Active record/ACK or invalid overwrite attempt. Existing journal guard already prevented terminal regression; runtime must explicitly recognize the completed/closing attempt.

A4 late startup completion Green: A4-startup-after-expiry-green.log8pass. A startup continuation checks its exact live map entry/phase and valid monotonic lease before persisting Active. Next invariant gates encoder creation directly on current lease permission, independent of tick scheduling latency.

A4 encoder-open permission Red before production: A4-output-open-permission-red.log2files20cases/2expectedfailures; actualnative A4-output-open-permission-outer-red.log1expectedfailure2.871s. Runtime clock expires as real capture resolves; actual child_process.spawn observation records an FFmpeg output attempt despite startup eventually returning denied. Add a live guard callback to factory/Engine and check it at encoder creation and asynchronous capture/activation boundaries, independent of timer scheduling. Fixture observes real spawn and lets real code execute; it does not replace successful media or responses.

A4 direct encoder-open permission Green: A4-output-open-permission-green.log20pass and A4-output-open-permission-outer-green.logrealcapturepass2.896s. Factory receives a live lease permission callback; Engine checks it after awaits and before generated/live encoder opens. Closure revokes the captured gate; expired permission prevents new output before timer scheduling. Actual child spawn observed without replacement; no FFmpeg output is opened when capture resolves after monotonic expiry. Production heartbeat-loop wiring still pending.

A4 failed-start cleanup Red: A4-failed-start-cleanup-red.log10cases/oneintendedRed. Startup rejection may leave partial resources; output closure must be awaited before terminal persistence, with normal denied apply after successful cleanup. Failure-to-close must still withhold terminal proof. Reuse the existing close/persist pipeline with immediate startup-error cleanup; future ticks retain that cleanup kind if persistence fails.

A4 actual configuration binding Red: native runtime13cases/3invalidconfigaccepted, parentcodec37cases/1sourcebindingRed, independent canonical target vector7cases/1missinghelperRed, actualMCPsigner1scenarioRed. New valid fixtures include sourceId before verifier change (old codec ignores extra field); no prior contract is weakened. Use actual URL and plain-key SHA256 digest in canonical target hash, bind actual overlayId as sourceId, and recompute at native admission rather than trusting parallel job metadata. Plain keys stay out of signed payload and journal.

A4 effective configuration binding Green: A4-actual-config-binding-inner-green.log13pass, A4-source-binding-codec-green.log38pass, A4-actual-config-binding-outer-green.log1scenario4.9s. Free signed claims require exact source UUID; native recomputes canonical actual URL/key digest target hash. Server decrypts privately for the same digest and excludes plain keys from signed claims. Generic paid/legacy codec compatibility retains optional source binding. Native encoder/lease component now reaches another checkpoint; run full affected native package and static types, with all original coverage/full app gates still pending for completed A4/A5.

A4 explicit terminal confirmation Red: A4-receipt-confirmation-outer-red.log fails on missing acceptedExecutions. Exact terminal retries must receive confirmation without replay mutation; a wrong generation receives an empty confirmation list. Native component checkpoint A4-native-controller-complete-checkpoint.log passes 14 suites / 71 cases with one pre-existing todo, including real capture/FFmpeg cases; full delivery gates remain pending.

A4 explicit terminal confirmation Green: focused owning workflow A4-receipt-confirmation-outer-green.log 1pass4.8s. Confirmations return only after the owner-locked transaction commits; exact stopped replay confirms without mutating sessions; wrong generation confirms nothing. No duplicate root journey added.

A4 durable local confirmation Red: A4-local-confirmation-red.log 13pass/1expectedfailure. Empty, wrong-generation and Active confirmations retain pending terminal receipt; exact Stopped confirmation must remove it durably. Server ownership workflow remains Green independently.

A4 durable local confirmation Green: A4-local-confirmation-green.log14pass. Only matching Stopped confirmations for this journal owner/device retire exact terminal receipts durably. Wrong generation/Active/empty responses retain retry queue. HTTP success alone is not proof of acceptance.

A5 native signed-controller Stop Red: A5-runtime-stop-command-red.log14pass/1expectedmissing-Stop failure. Commands must target exact owner/device/admission/generation/configuration, persist drain before closure, and permit explicit Stop now to interrupt pending graceful drain. Existing focused server Stop transport owner is Green.

A5 native signed-controller Stop Green: A5-runtime-stop-command-green.log15pass. Exact owner/device/admission/generation/configuration commands only; normal Stop persists draining and waits for closure, Stop now invokes immediate shared Engine cleanup even during pending drain. Local terminal confirmation remains in the same whole-file run.

A4 heartbeat report projection Red: A4-heartbeat-reports-red.log15pass/1expectedmissing-reports failure. Active reports bind exact signed identity; closed receipts survive controller restart until explicit confirmation. Parent heartbeat whole-file regression A4-receipt-heartbeat-regression.log31pass after server confirmation change.

A4 heartbeat report projection Green: A4-heartbeat-reports-green.log16pass. Exact active and closed reports exclude credentials/internal fields; restarted controller recovers pending closed receipts and explicit server confirmation retires them. Main CLI wiring remains incomplete.

A4 actual CLI protocol Red: A4-cli-protocol-red.log1expectedfailure, outgoing requests lack protocolVersion2. Exercise actual pollHeartbeat through its network boundary without interactive startup; fresh UUID nonce and declared lease/drain/presentation/admission capabilities are required. Main signed-dispatch wiring follows before slice completion.

A4 CLI signed-dispatch Red: A4-cli-signed-dispatch-red.log1pass/1intendedfailure: no lease controller is constructed for signed job. Initial new fixture omitted the legacy Engine interface; corrected that fixture before production, so semantic Red now proves missing dispatch rather than an import/setup exception. Expected media startup promise remains pending to require nonblocking heartbeat control.

A4 actual CLI signed-dispatch Green: A4-cli-signed-dispatch-green.log2pass, native integration typecheck exit0. Actual poll captures the nonce/send monotonic timestamp before fetch, submits signed jobs through FreeExecutionController asynchronously, includes controller receipts on subsequent requests and passes explicit confirmations back. Independent watchdog and startup receipt recovery are still pending before delivery gates.

A4 independent watchdog corrected Red: A4-cli-watchdog-corrected-red.log1pass/1expectedno-timer failure. First fixture exported an undeclared future symbol and is rejected as setup evidence (DEF-US1-035); conditional test exposure now proves missing timer scheduling before production. Watchdog must run on 250ms timer independently of heartbeat/network/media startup.

A4 CLI startup receipt recovery Red: A4-cli-receipt-recovery-red.log2pass/1expectedmissing-controller failure. Closed journal records must initialize the owning controller before the first request even with no returned jobs. Independent watchdog Green A4-cli-watchdog-green.log2pass; original fixture transform failure DEF-US1-035 is Verified by corrected semantic Red/Green.

A4 CLI startup receipt recovery Green: A4-cli-receipt-recovery-green.log3pass. One shared journal instance per device prevents stale concurrent per-owner snapshots; saved closed receipts restore owning controllers before first fetch, so no new job is needed to retry. Main policy integration, key packaging, retired credential delivery, Stop now UI and combined A4/A5 gates remain pending.

A5 disconnect shutdown corrected Red: A5-disconnect-shutdown-corrected-red.log18pass/2intendedfailures: controller stopAll absent and CLI fails to invoke controller shutdown. First extended CLI fixture lacked existing stopTCPProxy helper (DEF-US1-036), corrected without production changes; original retained A5-disconnect-shutdown-red.log is not CLI behavior Red. Disconnect must close/persist before local engine removal or re-enrollment.

A5 process shutdown bound Red: A5-process-drain-deadline-red.log3pass/1expecteddeadline failure. Existing 8000ms forced process exit can cut a permitted 300000ms graceful clip drain. Allow the captured 300s bound plus 5s terminal persistence margin; emergency stop remains an explicit independent command.

A5 disconnect/controller shutdown Green: A5-disconnect-shutdown-green.log20pass; A4-cli-shutdown-refactor.log22pass across runtime, actual CLI, and existing legacy CLI drain owner; A4-cli-recovery-types.log exit0. A5-process-drain-deadline-green.log4pass confirms 305s process emergency exit bound preserves the 300s drain contract. Re-enrollment waits for controller closure/journal persistence before clearing current credentials; retired-token terminal transport remains pending.

A5 dashboard action Stop now corrected Red: A5-dashboard-stop-action-corrected-red.log2pass/1intendedfailure, fourth stopMode argument currently drops to graceful. Actual authenticated Next action/owner-locked resource/PG admission exercised under existing compiled workflow owner; ordinary Stop and stale rejection baseline Green. New scenario initially mislocated outside owner (DEF-US1-037), no product change before corrected semantic Red.

A5 dashboard Stop controls Red: A5-dashboard-stop-controls-red.log two intended missing accessible-controls failures. Required interaction starts disabled while live/draining, normal Stop requests graceful, requested Stop with actual Running shows clip-finishing/live-stopping and explicit Stop now, actual closure removes finishing state. Dashboard action underlying owner already Green3cases A5-dashboard-stop-action-green.log.

A5 dashboard Stop controls Green: A5-dashboard-stop-controls-green.log2pass. Real component exposes explicit Stop now while closing, retains normal Stop graceful, blocks Start until actual closure, and differentiates generated-clip finish from live-forwarding shutdown. Page composes tested controls and forwards fourth stopMode argument; notifications now describe requested rather than applied state. Underlying actual authenticated action owner A5-dashboard-stop-action-green.log3pass.

A5 retired credential storage Red: A5-retired-credential-storage-red.log1expectedmissing-store failure. Preserve former bearer separately from current enrollment and the credential-free execution journal; primary OS keyring storage leaves no token in its metadata, supports restart and removes only after delivery. Dashboard/native typechecks A5-dashboard-stop-{parent,native}-types.log both exit0.

A5 retired storage primary Green A5-retired-credential-storage-green.log1pass. Protected fallback Red A5-retired-credential-fallback-red.log1pass/1expectedrejection: unavailable OS keyring currently loses persistence. Match existing credential-storage policy with owner-readable atomic fallback outside journal, retaining retry and cleanup under unavailable keyring.

A5 retired terminal delivery Red: A5-retired-terminal-delivery-red.log1expectedmissing-delivery failure. Native transport sends only exact admission/generation/allOutputsClosed to terminal-only endpoint with former bearer; HTTP200 without accepted:true retains journal/credentials, explicit acceptance retires both. Protected storage fallback/refactor checkpoint A5-retired-credential-platform-refactor.log passed both owning files.

A5 actual CLI retired delivery Red: A5-cli-retired-delivery-red.log4pass/1expectedmissing-save failure. Device401 must preserve former bearer before draining, deliver closed receipt, then clear active enrollment; narrow native transport A5-retired-terminal-delivery-green.log already Green. Shared protected-file/Windows ACL helper retains existing current credential behavior (A5-retired-credential-platform-refactor.log).

A5 environment-token revocation Red: A5-cli-env-token-revocation-red.log5pass/1expectedmissing-shutdown failure. Explicit CLIPIFY_TOKEN cannot bypass401 drain/terminal delivery; it only opts out of automatic enrollment/current credential deletion. Prior enrollment flow A5-cli-retired-delivery-green.log5pass.

A5 retired native integration Green: A5-cli-env-token-revocation-green.log6pass. Both environment and enrolled credentials drain/persist/deliver on401; only enrolled credentials clear/re-enroll. Delivery watchdog starts before interactive initialization and retries independently with10s spacing/dedup. Old bearer remains solely in OS keyring/protected credential store, never execution journal; explicit accepted:true required for retirement. Ready for affected native component checkpoint, not final feature gate.

A4 suspend-aware elapsed clock Red: A4-suspend-clock-red.log1expectedmissing-factory failure. Pure process performance time can pause in system suspend; add shared conservative elapsed clock using performance and OS uptime. Primary sources verified: libuv Linux uv_uptime reads /proc/uptime or CLOCK_BOOTTIME; Windows uses GetTickCount64; Darwin uses kern.boottime. URLs in research follow-up; no wall epoch is used as signed permit authority. Native transport checkpoint A4-A5-native-control-transport-checkpoint.log17suites84pass/1existingtodo103.853s; static native and app regression8cases both Green.

A4 suspend clock initial Green A4-suspend-clock-green.log1pass. Follow-up rollback Red A4-suspend-clock-rollback-red.log1pass/1expectedfailure: max of fixed baselines can freeze after uptime rollback. Rebase only a detected backward uptime transition to prior elapsed high-water plus current process delta; quantized forward uptime must not be accumulated twice.

A4 default shared clock integration Red: actual default lease remains Active after simulated suspend (A4-default-clock-lease-corrected-red.log), Engine default drain ignores shared elapsed deadline (A4-default-clock-engine-red.log), actual CLI timestamps with different clock (A4-default-clock-cli-red.log). Core rollback restored A4-suspend-clock-rollback-restored.log2pass; DEF-US1-038 original failed green-named log never qualifies. Existing deterministic fake-timer drain owner explicitly injects its fake clock without changing assertions, baseline A4-explicit-drain-clock-fixture-baseline.log Green. Wire the same shared default into all three consumers.

A4 default clock integration Green: A4-default-clock-parent-green.log10pass and A4-default-clock-native-restored.log16pass. Core-clock rollback origin validation DEF-US1-038 and omitted first formatted CLI fixture adapter DEF-US1-039 are verified; their original failed green-named outputs are rejected. One shared suspend-aware elapsed clock now governs nonce send time, default Free permit expiry, and Engine drain deadlines; deterministic timeout fixtures explicitly inject the same fake time as their media reports.

A4 trusted public key configuration Red: A4-trusted-key-config-red.log1expectedmissing-parser failure. Shared build/runtime parsing must retain public Ed25519 keys under exact server-derived SPKI SHA256 key IDs; no implicit trust in response-supplied keys and no private key distribution.

A4 public-key shape validation Red: A4-trusted-key-validation-red.log valid mapping/wrong-ID baseline cases pass; malformed JSON, arrays, null, private PEM, wrong algorithm, bad PEM, excessive bytes/key count currently violate generic bounded public-only configuration. Preserve exact fingerprint mapping and accept only Ed25519 PUBLIC KEY material; no configuration text in thrown errors.

A4 public-key consumers Red: A4-trusted-key-consumers-red.log5pass/2expectedfailures. Actual esbuild packaging has no public-key build define helper; CLI still bypasses shared parser. Public-only bounded parser owner A4-trusted-key-validation-green.log10pass. Wire same parser into build helper and source runtime; no private key is embedded.

A4 verification-key artifact identity Red: A4-key-fingerprint-red.log actual bundling case Green, changed trust keys currently produce identical native source/artifact fingerprint. Include canonical configured public-key mapping in artifact identity and propagate the same public build input to native preparation/build and release app Docker context. Reordering the same mapping must retain identity.

A4 public-key build identity Green: A4-key-fingerprint-green.log2pass actual esbuild bundling and actual native fingerprint rotation/order checks. Shared parser validates public Ed25519 keys/exact IDs and bounded generic-error input; source runtime and official build share it. Public GitHub variable propagates to native preparation/build and release Docker context; new docs/runner-signing.md explains server-only private key provisioning, matching public mapping, development, rotation and revoked terminal retry. No deployment key or production setting was provisioned.

A4 manual-token device binding Red: A4-manual-token-binding-red.log6pass/2expectedno-dispatch failures. A manually supplied token can have no saved runnerId. Assignment runnerId is only a candidate; learn/persist it only when matching owner/device/session/admission/generation/configuration exists in the lease-verified journal. Invalid assignments must neither rewrite enrollment nor create reports. Execution signature/source/target binding remains in the controller.

A4 manual token binding Green: A4-manual-token-binding-green.log8pass. Candidate device ID never rewrites credentials unless exact owner/device/session/admission/generation/configuration is present in the lease-verified journal; valid bindings persist and subsequent requests include exact reports. Invalid assignment produces no saved device or report. Heartbeat media startup remains asynchronous.

A4 Free live-fallback compatibility Red: A4-free-fallback-preflight-red.log8pass/1expectedno-probe failure. New Free Engine factory bypasses existing listener reachability preflight. Share existing legacy preflight unchanged; unavailable probe stays advisory and temporary listener cleanup precedes native output startup.

A4 replay outer characterization Green: A4-offline-replay-physical-characterization.log1pass27.479s. Driver first produces actual encoded output, persists active and terminal journal snapshots, then a separate Node process with rolled-back wall clock rejects offline replay, changed generation, and terminal replay. Actual Engine factory/spawn observation records zero new engines/encoders. This validates existing test-first nonce/journal implementation; no manufactured Red or new production behavior was introduced for this additional outer boundary. Shared-clock coverage inventory Red A4-clock-coverage-inventory-red.log proves canonical collection/critical enforcement currently omits the imported clock; add it to the same counter owner as protocol.

A4 shared-clock coverage ownership Green: A4-clock-coverage-inventory-green.log25pass across canonical collector/threshold and real Next-entry instrumentation owners. Clock shares protocol original-source counters via virtual CJS resolution; no threshold or scenario removed. Free connectivity guidance Red A4-free-connection-guidance-red.log2expectedmissing-copy failures in existing controls journeys, required by T109.

A4 native coverage characterization checkpoint: added no new production behavior. Existing lease/journal/key/credential/delivery implementations now have 63 passing tests and exact per-file critical coverage qualification (95% statements/functions/lines, 90% branches unchanged), `A4-native-critical-qualified.log`. Journal/key/delivery are 100% in all metrics; runtime97.84S/91.54B/100F/100L, storage100S/96.87B/100F/100L, retired-store100S/92B/100F/100L. Whole-file characterization includes corrupt journal metadata and snapshots, irreversible identity/terminal proof, idempotent credential save, separate OS keyring namespace, Windows ACL fallback, interrupted/cross-device receipt delivery, configuration/enrollment/CLI polling/re-authentication, native proxy nonce/retry behavior, actual Engine playback callback execution, health/preview failure, capture retry/timeout and physical close confirmation. No artificial Red is claimed for already implemented behavior. Shared critical50case qualification remains `A4-shared-critical-coverage-restored.log`. Lifecycle gate improving but last scoped gate still fails S89.51/B84.58 (57 tests pass) in `A4-lifecycle-coverage-progress-3.log`; do not call that Green. Full native/component milestone running after setup-failure cases. Fixture-only socket recursion fixed with Node-compatible idempotent destruction (DEF-US1-042); typed delivery fixture now supplies all ExecutionRecord fields, native type check restored in `A4-native-characterization-types-restored.log`. No coverage threshold, assertion or test owner removed.

A4/A5 final-capture regression Red (DEF-US1-043): actual encoded-final-frame failed in complete native checkpoint. Whole drain owner13cases has12Green/1intendedfailure A4-capture-final-chunk-red.log: graceful stop never calls recorder.stop before destroying its stream; final capture chunk is lost. Preserve original actual media final-frame assertion and fixed output-close budget; observe encoder close before capture EOF can finish its stdin. No source production fix before this Red.

A4 server end-of-slice behavior check Green: exact no-coverage root owner68pass in A4-final-admission-whole-file.log and complete Runner workflow ownership49pass in A4-final-workflow-scenarios.log, including separate stop/terminal/lease-binding source ownership. T110/T111 complete. Full owning workflow coverage now392scenarios pass in A4-final-workflow-coverage.log; producer exit/counter aggregation still to be confirmed. Native final-capture regression Green15whole-file cases and real-media1pass27.918s A4-capture-final-frame-physical-green.log. Combined full native checkpoint remains running before closing remaining A4/A5 gates.

Joint A4/A5 behavior/refactor checkpoint complete before final app gate: full native33 suites / 154 pass/1unchangedTODO with all explicit required coverage gates passes A4-native-final-capture-qualified.log; actual encoded final frames, expiry closure, separate-process replay all Green. Root server68contracts/49workflowexamples unchanged Green; complete canonical workflow392Green exit0. Native Linux build/self-test A4-native-final-capture-{build,self-test}.log passes after final source. T749 cycles retain original intended Red evidence; existing already-working expiry-minus1ms is honest baseline plus strengthened native controller characterization, not artificial Red. Correct T767/T768/T773 path ownership from server admission to existing shared protocol/native runtime owner: a server-only path cannot observe local output clock. Same IDs, acceptance criteria, counters and thresholds; no duplicate executable binding. A169 actual replay lives in its real separate-process media owner. T109/750/112 and shared A5 behavior/refactor tasks complete; T664/T665 stay unchecked until remaining affected app coverage and combined critical validation pass. Source identity permits reusing unchanged successful physical/runtime/static owners instead of repeating them for each additional test assertion.

A4/A5 final checkpoint Green:5,021 app assertions (474 suites passed,2unchanged opt-in suites/11cases skipped),392 canonical workflow scenarios,154 native cases/33suites/1existingTODO. Exact476file inventory union verified, no omissions or repeated unchanged successful owners. Source hashes/counter maps match before merge. A4-final-combined-qualified.log passes original global/per-path gates; A4-critical-per-file-qualified.json separately verifies each new critical95 S/F/L, 90 B. A4-native-marker-audio-qualified.log all native thresholds/media/replay pass, with four equivalent concurrent captures and real immediate-stop negative control. DEF041/043/044/045 Verified; rejected intermediate/aborted experiments never qualify. Current app/native builds,93file action manifest, packaged Linux self-test, types, zero-error lint, audit/patch validation and formatting retained. T664/T665 complete:5 of 23slices(~22%). Feature remains No-Go. A6 follows final documentation formatting.

A6 execution ownership refinement before materialization: keep TDD-US1-FR005/U5 in a dedicated whole-file test/server/runner/manual-configuration.test.ts instead of appending another unrelated behavior to the68case admission file. Existing admission cases remain unchanged in completed-slice affected gates. Browser Red/Green uses only its full actual browser feature through the production test build; no whole-browser-suite loop or test-name sampling. Registry/test-list/task commands updated, primary374 artifact IDs and1,018 task IDs unchanged. Assertion scope/criteria and all completion gates remain unchanged.

A6 current configuration policy matrix intended Red before production: actual browser A6-manual-fallback-browser-red.log reaches missing user-facing behavior label after successful authenticated setup. Scoped native whole-file A6-configuration-control-matrix-red.log4expected failures for Free manual availability, accurate capability advertisement, Free paid-scheduling denial, invalid Pro scheduled fallback, and Pro Scheduled clip configuration without output activation; cases validate owner/auth before feature assertions. Intermediate A6-manual-fallback-inner-red.log and A6-manual-control-validation-red.log retain the earlier smaller policy observations. No production file modified before these executable failures. Add only manual/scheduled persistence and the current label/access contract; leave destinations/branding/agenda/cache implementations in their owning slices.

A6 browser boundary Green: `A6-manual-fallback-browser-persistence.log`, one real authenticated browser journey passes (30.2s), actual selected values, protected-key saved state, Start availability and reload persistence checked. DEF046 corrections exercise installed HeroUI button roles and the real optional-consent choice. The transient toast is not a persistence contract; actual saved credential placeholder and reload replace that incidental signal. New user-directed expected-error remediation DEF047 remains open; no A6 completion claim yet. Sentry-specific Red `A6-business-errors-sentry-red.log` (6 expected denials reported, 2 real-error controls pass), Green `A6-business-errors-sentry-green.log` (8 pass). Initial direct-resource denial test omitted required retryKey, so its first Red is rejected as setup evidence; corrected exact-code Red is required before restoring the policy-result fix.

A6 current configuration/expected-denial cycle Green and formatted: `A6-business-results-refactor-green.log`, 4 whole-file owners /32 cases pass. Existing action owner also passed in the prior affected run; only its obsolete capabilities assertion failed and was corrected to the approved Free policy. Structured scheduling and remote-plan results preserve denied MCP activity/metrics; Sentry suppression is scoped to known Runner business outcomes and unrelated failures remain reportable. Browser boundary Green retained from identical UI source. T125 adds only owned controlMode persistence: destination normalization/branding/automation fields remain mandatory at B1/D/E, not introduced early. A6 still needs the independent-ingest constraint before T126/T129/T666 can complete.

A6 current-source browser refactor Green: `A6-browser-consent-reload-green.log` one genuine browser journey passes with normal clicks and save/reload persistence. DEF049 is a fixture race with the intentional async consent-save reload; wait for the actual load event before editing, without fixed sleep or timeout changes. Ingest behavioral Red is `A6-single-ingest-authenticated-red.log` (4 intended missing-policy failures, 6 passing controls, all authenticated). Minimal shared admission fix is Green in `A6-single-ingest-green.log` (10pass), including concurrent/edited/draining cases, and captures immutable ingest mode in existing JSON. A post-refactor after-clip positive control and complete affected owners now run without coverage; a separate current-source completion coverage producer and the native workflow lane run only at this slice checkpoint. These are producers, not release gate approval; full release remains No-Go. No previous-source report is substituted for newly changed sources.

A6 whole-file refactor completed: `A6-complete-affected-refactor.log` 12 suites /169 tests pass, no coverage/no omissions (541.825s). Current browser Green and static gates retained. A5/U5 DONE; T126/T129/T802 complete. T821 and T801 were stale unchecked prerequisite markers despite their A24/U24 and A4/U4 DONE rows and owning Green A4/A5 qualification; reconcile them to retained evidence rather than inventing duplicate tests. Current affected owners revalidate their server behavior; unchanged physical native sources keep their existing actual-media result. T666 remains pending the completion coverage check; no next-slice executable evidence yet.

A6 validation reopened for DEF051 before its completion gate: `A6-effective-control-mode-red.log` proves valid authorized existing Scheduled configuration is saved first, then omitted controlMode/fallback edits hit storage constraints through both authenticated entries (11 pass/1 intended failure). No failing evidence is treated as completed refactor. Add malformed-mode boundary case to the same current behavior owner before one minimal validation correction. T129/T802 reopened; T666 was never marked complete. Legacy BDD paid-only assertion is corrected without removing its ID/example; complete owning runners feature passes73 cases (`A6-native-config-policy-refactor.log`). Fresh full workflow qualification waits until the current validation fix is Green to avoid another premature completion run.

A6 final behavioral refactor Green: `A6-final-refactor-green.log`32 cases and current-source `A6-final-browser-green.log` one real journey. Existing-field mode validation handles omitted control with a captured revision/CAS, rejects forged modes, and returns INVALID_INPUT without hitting a database constraint. Three action characterizations cover older callers, racing revision and missing session. `A6-native-config-policy-refactor.log`73cases and fresh `A6-final-workflow-completion-coverage.log`392 native scenarios pass; no role-labelled duplicate execution. New BASELINE characterization `A6-commit-boundary-characterization.log`2cases proves actual transaction commit before deferred effects, and rollback suppresses effects/audit/retry; no production change or artificial Red. Existing whole-file retry/input/schema/unknown-tool owners add127 passing cases to the422 current affected/discovery owners. All raw reports remain producers until unchanged per-source gates pass. Shared workflow branch gate is currently89.13 against unchanged90; the existing import replay owner is being added, without rerunning the392 successful native scenarios. Normalize native **tests** path references as code spans so Markdown formatting cannot rewrite the actual filename into emphasis. T666 still pending scoped coverage/static completion.

A6 COMPLETION QUALIFIED / T666: 33 distinct affected whole-file owners,558 passing tests across current-source producer inventories (174 affected +248 policy/discovery +127 contract +2 commit/rollback +7 discovery/import replay), one actual current-source browser journey,392 complete native workflows. `A6-scoped-coverage-pass.json` ok:true/errors:[] verifies the declared changed canonical sources with unchanged original per-source thresholds; admission97.53 S/96.42 B/100 F/98.57 L, capabilities100, Sentry100. No mismatched source hashes or source counter maps are accepted. Existing native runtime sources/fixture inputs were not changed by A6; their physical-media A4 qualification is retained rather than rerun for another label. Current production and E2E builds,93-file action-manifest check, latest characterization type check, formatting and scoped lint pass (one pre-existing unused RunnerStatus warning). Final whole-feature/global coverage and remaining implementation are still No-Go; this is the planned source-scoped slice checkpoint, not a final release waiver. A1–A6 now complete; begin A7 only after this entry. Evidence: A6-final-affected-coverage-producer.log, A6-policy-owner-coverage-producer.log, A6-contract-owner-coverage-producer.log, A6-commit-owner-coverage-producer.log, A6-discovery-owner-coverage-producer.log, A6-final-workflow-completion-coverage.log, A6-final-browser-green.log, A6-final-production-build.log, A6-final-production-action-manifest.log, A6-characterization-types.log, A6-final-lint.log, A6-characterization-lint.log.

A6 test-strength checks: deliberate early deferred-effect execution causes both transaction tests to fail (`A6-commit-boundary-deliberate-mutant-red.log`, decisive diff `-     true,` / `+     false,`); exact restored owner2pass. Removing captured legacy CAS causes2fail/7pass (`A6-effective-mode-cas-deliberate-mutant-red.log`, decisive `Received string:    "(\"stream_sessions\".\"id\" = $1 and \"stream_sessions\".\"owner_id\" = $2)"`); restored owner9pass. `A6-characterization-mutant-check.json` records both mutants killed, original source SHA256/bytes restored and restored Green. These are strength checks of already-Green characterizations, not fabricated test-first evidence or retained production changes.

A7 U182 routing cycle opened after T666: baseline is the qualified A6 affected fast owners and complete native lane. New whole file command `bun run test --runInBand --runTestsByPath test/mcp/unit/runner-native-routing.test.ts --coverage=false` fails for the intended ownership contract in `A7-native-routing-complete-red.log`; decisive missing result `-     "ATDD-US1-SC001:atdd-chromium",` and `+   "duplicateRejected": false,`. Uses collection metadata at the external CLI boundary, not a fake passing acceptance journey. Actual selectBrowserFiles excludes both native BDD and ATDD paths already; retain that passing baseline rather than manufacture a regression. Missing, duplicate exact/cross-project and unidentified metadata must reject before a producer can qualify. T679/T680 complete; native ATDD behavior itself remains unimplemented until T130 onward.

A7 U182 Green/refactor complete: `A7-native-routing-green.log` then `A7-native-routing-refactor.log`, one whole-file ownership contract passes. Shared explicit native project arguments now select BDD and ATDD for both inventory and execution; scenario IDs must be present and unique even across projects. No extra browser process, second execution owner or altered coverage threshold. Actual discovery `A7-existing-native-inventory.json` retains all 392 existing BDD cases with unique IDs; ATDD is0 because its genuine A36 acceptance binding is deliberately still pending T130, not replaced by a no-op. Both named projects already exist in inherited playwright.mcp.config and ordinary browser shard selection already excludes /mcp-workflows/ for both directories, so those working config/helper paths require no speculative change. This completes the routing unit/bootstrap contract, not the acceptance behavior. Next materialize the real Free end-to-end acceptance and prove its result before any required product change. T681/T682 complete; no next behavior implementation yet.

A7 A36 baseline acceptance: actual public MCP registration/configuration, supported device advertisement, racing starts, native signed-lease verification, active acknowledgment, graceful stop delivery and exact output-closed acknowledgment pass through the real native ATDD owner (`A7-free-acceptance-shared-fixture-initial.log`,1pass/4.5s). A1–A6 already implement this behavior; no artificial missing-behavior Red or new product code. Deliberate Free limit1->2 mutation produces admitted2 and fails the acceptance (`A7-free-boundary-concurrency-mutant-red.log`); exact original capability bytes restored and actual acceptance Green in `A7-free-boundary-restored-green.log`, with hashes in `A7-free-boundary-mutant-check.json`. This observer validates the device protocol, not physical encoded frames (separate native runtime owner). T130/T136/T142 complete. DEF054 fixture registration is resolved by re-exporting the recorded MCP fixture inside ATDD support; generation failure is not behavioral evidence.

### A7 — extended-time observations and honest baseline qualification

Existing A1–A6 implementation already permits unlimited hours; no quota implementation was introduced. Current-source MCP ATDD: `A7-extended-concurrency-restored-green.log` (2 passing), direct admission: `A7-admission-inner-initial.log` (2 passing), native lifecycle plus real encoded playback: `A7-native-continuation-exact-restored-green.log` (26 passing). These are verified existing behavior, not fabricated test-first Reds. The native driver advances the injected connected execution clock by 24 hours with 360 fresh signed renewals across a UTC month boundary; real Chrome/FFmpeg output remains observed, but this does not claim 24 hours of wall-clock capture.

Strength: `A7-extended-concurrency-mutant-red.log` rejects an admission guard that ignores old active broadcasts; its exact restored source passes. `A7-native-continuation-budget-mutant-red.log` rejects truncating a valid five-minute lease to one minute in both the unit and physical playback observers. `A7-native-continuation-mutant-check.json` confirms both faults observed, exact original source restored and 26 passing afterward. No mutant remains in production source. Original direct concurrency assertions moved intact to admission-acceptance.test.ts with an additional SC001 trace; the 67 remaining admission cases remain mandatory at the story gate.

A136/U136 observe API admission, while A135/U135 retain native playback observation. This ownership correction preserves all published IDs and product outcomes. Root-relative editing and package-relative commands now use separate calls and explicit working directories; earlier missing-file/old-fixture logs are rejected as setup evidence. No production change was required for unlimited hours; completion gates remain pending.

### A7 — complete native runtime checkpoint

`A7-story-native-coverage.log`: 33 suites pass, 156 tests pass and one unchanged pre-existing TODO. The complete owner set executes once. `A7-native-policy-gate.json` evaluates that run's counters against the unchanged A4 nine-source inventory and six critical source thresholds; all pass (remaining global S92.07/B85.48/F93.15/L95.86). The broad default report also contains unrelated existing native files; its raw aggregate is not presented as the declared changed-source gate. No rerun, omitted test owner, assertion change or threshold reduction was used. `A7-story-types.log`, `A7-story-native-types.log`, `A7-story-format.log` pass; scoped lint has zero errors and the existing fixture dirname warning. The full app and 394-case workflow coverage owners remain running. Existing unchanged A6 browser/build and packaging/security evidence is retained only for its identical inputs, not claimed as new CI evidence.

### A7 — native workflow completion owner

`A7-story-workflow-coverage.log` passes all 394 scenarios (392 BDD and2 ATDD) in8.2minutes, with the exact unique inventory in `A7-current-native-inventory.json` and successful `coverage/workflows/lane.json`. Both practice labels use their declared native execution owner and are excluded from browser shards. No duplicate workflow run is needed for coverage. The app report is still running, so merged global/canonical coverage remains pending. `A7-retained-source-verification.json` verifies every archived A6 source digest remains identical before reusing unchanged browser/build/security evidence.

### A7 — qualified affected checkpoint; oversized run rejected

The all-app producer was broader than A7's required affected checkpoint and was intentionally interrupted, exit1. Do not call `A7-story-app-coverage.log` an overall pass or use its partial coverage. It did finish the complete routing, business-error, runner-action, admission and manual-configuration owners successfully; unchanged successful owners are not repeated. The moved direct admission acceptance owner separately passes2 tests in `A7-refactored-app-inner-green.log` after formatting. All118 retained application source hashes match A6. `A7-scoped-coverage-pass.json` combines exact unchanged application owners with the fresh394-scenario workflow owner, rejecting foreign source/counter maps, and passes every unchanged scoped threshold. Native33 suites/156 tests and critical/global native thresholds pass independently. A7 refactor checkpoint is Green; US1 integrated completion remains open for the explicitly cross-story schedule/standby permissions and final full gates. Proceed to B1 without falsely ticking final story/release tasks T148–T152. DEF057 records the execution-scope correction.

### B1 — named editor Red and declaration reconciliation

All US2 declaration IDs T153–T170 resolve in the approved specification and unique registry; their declarations are complete without claiming future executable evidence. T171 planning/source-role reconciliation retains all pending destination, fan-out and receiver behaviors. Initial `B1-named-editor-inner-red.log` fails exactly at available=true after the real authenticated credential-read precondition succeeds. `B1-named-editor-outer-red.log` has the same intended missing save/list action failure and45 existing Runner scenarios pass. The established action module loads successfully; no missing import, invalid fixture or SQL setup error is classified as behavioral Red. A9/U9/U141 are Red. Additional B1 validation/lifecycle tests are being materialized; their results and remaining atomic contracts are not yet claimed.

### B1 — complete slice Red before production

`B1-destinations-contracts-red.log`:14 expected failures at the absent named save/list action boundary, with real authenticated setup succeeding. The invalid-input, keep/replace/clear, explicit0/1/80/81 name bounds,20-seed foreign-owner property and real PostgreSQL transaction-fault assertions are materialized; their downstream assertions are not falsely claimed to have executed yet. `B1-destinations-workflow-red.log`:8 intended new boundary failures,45 existing scenarios pass. `B1-name-boundaries-browser-red.log`:all4 cases reach the existing authenticated Runner page and fail because Add destination is absent. An explicit visibility assertion was added before clicking to use the existing15-second assertion budget rather than wait for a60-second test timeout; the missing-control outcome is unchanged. Initial two cases use the old click assertion, later two the equivalent explicit visibility assertion. No production code had changed.

`B1-native-diagnostic-red.log`:the U247 native logger test fails because FFmpeg's credential-bearing URL reaches console.error;16 existing engine cases pass. Its observer is the real monitorFFmpeg callback with controlled process events, not a disconnected app-side string helper. TDD-US2-CON005 retains one execution per distinct atomic case across the app storage owner and existing native engine owner. Published IDs and requirements are unchanged. Begin the minimal B1 implementation; no future fan-out/schedule/presentation behaviors are added.

### B1 — initial storage and workflow Green; browser harness correction

`B1-destinations-contracts-first-green-attempt.log` passes14 real-action/storage tests. After formatting and input tightening, `B1-editor-focused-green.log` passes the complete destination and retained Runner action owners (23 tests). The foreign-owner property executes20 controlled UUID cases; the PostgreSQL trigger forces a real rolled-back update; clear blocks a Start despite a retained legacy credential. `B1-native-diagnostic-green.log` passes17 complete engine tests after stderr redaction and removal of credential-bearing destination/overlay URL logging. `B1-destinations-workflow-first-green-attempt.log` passes all53 owning scenarios, including45 retained US1 cases.

DEF058 fixes fixture literal types without loosening the action schema. DEF059 fixes the client/server type-import boundary by deriving the DTO from the safe action result; unchanged lint rules now pass. DEF060 is an ambiguous browser selector, not product Red: scope RTMP URL and form controls to the actual destination dialog, retaining all persistence assertions. Four browser cases are being rerun. Named destination create/list/update, encrypted keep/replace/clear and safe results exist; deletion/reference handling and legacy normalization still require their own failing executable evidence before implementation. T193/T194 and B1 completion gates remain open.

### B1 — initial editor/credential cycle complete

`B1-name-boundaries-browser-dialog-green.log` passes all4 real browser scenarios in55.8seconds. Empty and81-character names leave no saved destination;1- and80-character names persist and remain visible after reload. Dialog scoping resolves DEF060. Together with23 current app tests,17 native engine tests and53 workflow scenarios, the initial B1 create/list/update/credential behavior cycle is Green before the next missing deletion/legacy behavior is added. No B1 completion or story/release gate is claimed yet.

### B1 — whole-file extraction verified before deletion cycle

`B1-extracted-owner-baseline-green.log` passes all8 moved destination cases in25.5seconds. `B1-destination-owner-extraction.json` records intact tags and step-body digest; the45 Free Runner cases retain their existing owner. Commands and source mappings now target the whole destination feature during development; milestone coverage retains the full inventory. No assertion, public ID or execution role is dropped.

Deletion/reference and stale-revision cases are now materialized under the existing FR009/CON005 contracts, including a genuine browser cancel/confirm gesture under FR009 and expected RESOURCE_IN_USE classification in the existing Runner business-error owner. Initial overall Green tasks T195/T196 are reopened until these additional mandatory B1 cases pass; historical initial Green evidence remains intact. This is not a final slice-completion claim.

### B1 — deletion and expected-denial Red

`B1-delete-contracts-red.log`:3 new deletion cases fail at the missing delete action; RESOURCE_IN_USE fails the expected-denial Sentry test because the new code is not yet classified.24 prior tests pass. `B1-delete-workflow-red.log`:2 new deletion cases fail at the same missing boundary and all8 retained destination cases pass. No import/setup failure is counted. The browser confirmation case reaches a persisted saved destination and fails at missing Delete; the4 retained name cases are finishing. No deletion production code or new error-code classification has been introduced before these failures.

### B1 — additional native diagnostic boundary Red

`B1-native-startup-diagnostics-red.log` has2 intended failures and17 retained passes. The actual capture callback logs and propagates a credential-bearing process Error, and public startup propagates private overlay/Runner values in a navigation error. These are additional boundary observations under existing U247/TDD-US2-CON005, not a new artifact or practice-labelled duplicate. Browser consent verification remains independent: native-only error handling does not alter the application/browser bundle. Sanitize both the logger input and outward startup error while retaining useful failure text.

### B1 — deletion/refactor cycle Green

`B1-delete-contracts-green.log`:28 app tests pass, including actual reference preservation, stale revision rejection and expected RESOURCE_IN_USE exclusion from Sentry. `B1-delete-workflow-green.log`:10 scenarios pass. `B1-delete-browser-green.log`:5 real browser scenarios pass, including cancelling before confirming deletion and all4 unchanged name boundaries. `B1-native-startup-diagnostics-green.log`:19 engine tests pass, preserving failure text while removing private process/navigation values from logging and propagation. New deletion is owner-locked, revision-checked and rejected with safe reference details before mutation. No new migration is generated.

The initial attempted consent fix assumed every fresh context displays a banner; policy-dependent absence disproved that assumption. The verified setup uses the existing legal-page preferences button and real keyboard/dialog flow, independent of banner policy. DEF061 is Verified. All current B1 behaviors are Green before adding the remaining required legacy normalization cases. T193/T194 and the slice gate remain open until normalization and final affected coverage/static/runtime qualification are complete.

### B1 — repeated legacy conversion Red

`B1-legacy-repeat-red.log`: one intended failure and17 retained passes; two authenticated scalar saves succeed but create zero named destinations. `B1-legacy-repeat-workflow-red.log`: one intended public-list failure and10 retained passes. Conversion must preserve one encrypted credential and stable destination identity across repeated supported edits. No production conversion existed at either execution.

### B1 — repeated legacy conversion Green

`B1-legacy-repeat-green.log`:18 destination tests pass; `B1-legacy-repeat-workflow-green.log`:11 scenarios pass. Supported scalar saves now convert the owned target inside the same owner-locked transaction, preserve encrypted bytes, and reuse one destination identity across repeated saves. `B1-legacy-action-unit-green.log`:9 retained action tests pass with transaction/authority collaborators isolated; real disposable PostgreSQL tests own the integration behavior. No refactor needed in this cycle. Further key-change/shared-reference and rollback boundaries remain before the B1 gate. No completion claim or commit.

### B1 — converted legacy credential replacement Red

`B1-legacy-rekey-red.log`:one intended credential mismatch failure and18 retained passes. The second authenticated scalar save accepts a replacement key but the converted named record still has its old encrypted credential. Assertion line numbers reflect pre-format compiled test input; no product behavior was changed during this Red execution. Preserve stable destination identity while updating encrypted bytes and credential revision together.

### B1 — legacy credential replacement Green

`B1-legacy-rekey-green.log`:28 tests pass across the complete destinations and retained action files. A replacement updates the same encrypted destination and increments its credential revision; unchanged saves retain revision1. Static verification `B1-legacy-types-verified.log` exits0 after explicit nullable scope/key handling and a typed action mock callback. DEF062 is verified. No refactor needed before the remaining reference/rollback checks.

### B1 — shared legacy reference protection Red; rollback retained Green

`B1-legacy-shared-red.log`:one intended failure and20 passes. An authenticated legacy key replacement currently succeeds despite a second saved broadcast referencing the same destination. The real PostgreSQL AFTER INSERT failure already rolls back both scalar edit and conversion; retain that honest characterization Green rather than manufacturing a failure. Reject implicit shared-target replacement with a safe CONFLICT, rolling the scalar edit back too.

### B1 — shared legacy reference protection Green

`B1-legacy-shared-green.log`:21 tests pass. A shared-target legacy replacement returns a safe CONFLICT and rolls back both the scalar edit and target mutation; both references remain. The real conversion failure retains full rollback. `B1-legacy-shared-lint.log` exits0. The added real browser conversion scenario is supplemental regression evidence for the already test-first API conversion, not a claimed new browser Red. Advanced selection ambiguity still needs its own boundary before B1 closure.

### B1 — advanced selection preservation Red

`B1-legacy-multiple-red.log`:one intended failure and21 passes. An older scalar editor incorrectly accepts an edit of a two-target saved broadcast. Since it cannot express which target was intended, require a safe conflict and rollback, preserving both targets/references rather than manufacturing another target or overwriting implicit selection.

### B1 — advanced legacy selection preservation Green

`B1-legacy-multiple-green.log`:42 tests pass across destinations, retained action and expected business-error owners. An older scalar caller cannot alter a multiple-target selection: safe CONFLICT rolls back the scalar edit, retaining both records/references. All current legacy conversion inner cycles are Green. Begin the affected checkpoint; browser conversion is supplemental regression evidence. B1 remains open until coverage, browser/runtime and static qualification pass.

### B1 — account cascade defect reproduced before schema correction

`B1-owner-cascade-red.log`:one intended account-deletion failure and22 retained passes. Direct referenced-target deletion is correctly rejected, but complete owner deletion fails. Earlier real browser cleanup independently reproduces the same PostgreSQL RESTRICT failure in `B1-legacy-browser-cascade-defect.log`; UI/persistence assertions had passed. DEF063 is High/open until both direct database and browser cleanup verification pass. Replace the immediate RESTRICT FK with statement-end NO ACTION, retaining explicit service reference rejection and database direct-delete protection. No generated migration is created.

### B1 — account cascade correction retains actual application restriction

`B1-owner-cascade-action-red.log`:one intended owner-deletion failure and22 passes. The actual named delete action rejects the referenced target with RESOURCE_IN_USE; complete owner deletion still fails under NO ACTION. Correct the junction lifecycle FK to CASCADE, retaining the owner-locked application deletion restriction and existing reference-preservation workflow. The extra raw SQL rejection assumption is replaced with the required public action observer before this second Red run, with rationale recorded under DEF063. No custom/generated migration.

### B1 — account cascade defect Verified

`B1-owner-cascade-final-green.log`:23 tests pass. `B1-cascade-final-browser-green.log`:7 genuine journeys pass, including real account-cleanup assertions. Shared references remain protected by the owner-locked action and all junction rows disappear during whole-account deletion. DEF063 is Verified; no open High blocker. The browser reused unchanged UI/action runtime with fresh schema after the FK-only correction; final production build remains mandatory. Continue validation-branch coverage characterization within B1, not the next delivery slice.

### B1 — validation matrix exposes raw URL control-character gap

`B1-validation-matrix-red.log`:one intended validation/property failure and23 retained passes. A trailing literal newline is trimmed before the existing URL control-character rejection, incorrectly accepting an edit and incrementing its revision. Subsequent requests correctly conflict against that unintended revision; do not weaken those expected INVALID_INPUT assertions. Validate raw controls before trimming so invalid requests leave the original row authoritative. Remaining already-working matrix cases retain honest characterization, not manufactured Red.

### B1 — raw URL validation and request matrix Green

`B1-validation-matrix-green.log`:24 tests pass. Raw bounded URL controls are rejected before trim; all13 invalid matrix requests preserve the base row and credential. Missing/stale/foreign selectors, explicit key intent, safe errors and global target visibility now execute through real authenticated actions. No artificial Red is claimed for the already-working additional cases. DEF064 is Verified. No refactor needed before additional legacy reuse characterization and the final coverage checkpoint.

### B1 — legacy reuse/provider characterization Green

`B1-legacy-reuse-baseline.log`:28 tests pass. A matching global target is reused without metadata mutation; a colliding display name yields Twitch2 without changing the existing custom target; YouTube preserves its encrypted key; custom keyless conversion remains keyless and is admitted through the real action. These additional paths already work and are honestly recorded as Green characterization, without fabricated Red. All existing behavior IDs remain unchanged.

### B1 — cleared credential metadata edit Red

`B1-clear-metadata-red.log`:one intended failure and28 retained passes. Explicit clear preserves a record but a subsequent keep-key metadata rename is rejected, despite not attempting a Start. Permit keeping an already empty credential for the same provider on an existing record, while new provider configurations still require credentials and Start remains blocked. Preserve encrypted bytes/revisions and all existing rejection tests.

### B1 — cleared credential metadata edit Green

`B1-clear-metadata-green.log`:29 tests pass. Rename/keep on the same existing provider preserves its explicitly cleared key and credential revision, while actual Start still returns INVALID_INPUT. New provider configuration continues to require a key. No refactor needed. A final entry-point review found the remaining required first-edit normalization path: MCP configure must call the same transaction-owned converter; add its real API/rollback evidence before production changes.

### B1 — real MCP normalization and atomicity Red

`B1-MCP-normalization-inner-red.log`:2 intended failures and29 retained passes. Actual authenticated MCP configuration edits succeed but create zero targets, and a target-insert fault is never reached, allowing the preceding session mutation to commit. `B1-MCP-normalization-outer-red.log`:the same2 intended public-list/public-revision failures with11 retained scenario passes. No missing import/tool or fixture failure is counted. Connect the shared converter inside the existing owner-locked workflow transaction for both create and update. Static fixture correction is verified by `B1-MCP-normalization-types.log` exit0; DEF065 is Verified.

### B1 — MCP normalization and rollback Green

`B1-MCP-normalization-inner-green.log`:31 tests pass. `B1-MCP-normalization-outer-green.log`:13 scenarios pass. Both MCP update and creation normalize inside their existing owner-locked transaction, preserving the original encrypted key and stable target identity; a forced insert failure rolls back the preceding session edit and public revision. No refactor needed. Before coverage closure, verify the U244 authority boundary: a metadata edit through an older scalar caller must keep a newer named-editor target rather than overwrite it with the stale scalar shadow.

### B1 — named destination authority/keep contract Red

`B1-authority-inner-red.log`:2 intended failures and31 retained passes. Dashboard and actual MCP metadata edits overwrite a newer named-editor credential/endpoint from the stale scalar shadow. `B1-authority-outer-red.log`:2 matching public-projection failures and 13 retained passes. U244 requires keeping the authoritative credential; metadata is not an implicit replacement. Preserve explicit legacy replacement/clear/preset intent, synchronize only the compatibility shadow, and project MCP status from the normalized target.

### B1 — authoritative keep/compatibility shadow Green

`B1-authority-inner-green.log`:42 tests pass across the complete33-case destination owner and9 retained action cases. `B1-authority-outer-green.log`:15 scenarios pass. Both metadata entry points retain the newer named credential/endpoint/provider without advancing its revisions. Explicit legacy replace/clear and endpoint intent remain effective; the scalar compatibility shadow is synchronized transactionally. MCP status uses the normalized fields. Existing-session dashboard reads now capture ownership/revision before mutation; its isolated foreign-session fixture explicitly models absence. `B1-authority-types.log` and `B1-authority-lint.log` exit0. No further refactor needed before the source-frozen affected checkpoint.

### B1 — acceptance prerequisite corrected; endpoint sampling Green

`B1-ATDD-credentials-fixture-green.log`:2 complete acceptance scenarios pass unchanged assertions after seeding authoritative and compatibility credentials consistently. DEF066 is Verified; production guards were not relaxed. `B1-endpoint-sampling-baseline.log`:37 destination tests pass, including explicit dashboard endpoint keep/clear and MCP changed/unchanged preset semantics; no production change or artificial Red was needed for those characterization cases. The completed affected producer passes196 cases in13 owners; current source browser build/action manifest and7 browser journeys pass. Critical branch sampling still needs the fresh37-case report and a clean complete workflow producer; the failed407+2 workflow run is archived and not qualifying. Begin those final producers without repeating browser/native checks whose sources/inputs are unchanged.

### B1 — qualified complete affected checkpoint

`B1-final-workflow-coverage-qualified.log`:all409 native workflows pass (407 BDD,2 ATDD), one coverage execution owner per scenario. `B1-final-affected-app-coverage.log`:196 cases in13 affected owners; `B1-destination-final-coverage.log` replaces the earlier33-case destination owner with37 current cases, yielding200 distinct cases across those13 owners. `B1-final-browser-green.log`:all7 genuine journeys pass. The current browser production build,93-file action-manifest check, scoped lint/types/format and11 migration-policy tests pass. Native33-suite159-case coverage is retained only after all9 native source hashes are verified unchanged;1 pre-existing TODO remains. No generated migration/dependency change or audit waiver. Final whole-feature/merge gates remain mandatory.

`B1-final-scoped-gate.json` passes unchanged thresholds with matching source digests and counter maps: destination95.83S/91.9B/100F/100L; Runner resource98.2S/94.81B/100F/100L; errors100% throughout. Failed workflow counters are not merged. All66 recorded defects are Verified. T193/T194 implementation, B1 behavior gates, refactor checkpoint T197 and blocking checkpoint T667 are complete. Delivery slices A1–A7 and B1 are qualified (8/23), which is a slice count rather than an effort percentage. Continue B2; no story/release completion claim.

### B1 — byte-identical editor owner extracted before B2

`B1-editor-owner-extraction-green.log`:all37 moved editor cases pass. `B1-editor-owner-extraction.json` proves unchanged test bytes/assertions/IDs; only the whole-file route changes to `test/server/runner/destination-editor.test.ts`. Production sources and their qualified counters remain unchanged. B2 keeps the now-free original destinations test path for selection/admission tests. Final complete test discovery executes both owners once. No new behavior or fabricated Red.

### B2 — selected targets/admission first behavior Red

`B2-selected-targets-inner-red.log`:2 intended failures in7.5seconds. Authenticated Pro/Free setup and both protected named records succeed. The existing MCP configure tool rejects destinationIds as unsupported (INVALID_INPUT), so Pro cannot configure the required targets and Free has no specific target-limit policy. The tests already observe ordered owned selections, protected immutable admission capture, original private dispatch after a saved-record edit, signed target binding and safe public projections once this boundary exists. Snapshot inspection uses to_jsonb, so missing future fields are not SQL/setup failures. No B2 production changes yet; materialize its real media/authorization outer evidence before implementation.

### B2 / FR006 — outer Red and qualified real media observer

`B2-media-fixture-control.log` qualifies the unchanged single-target Free path: actual CLI helper bodies, one Chrome capture, one H.264 encoder, real loopback RTMP with AAC audio, final green marker and all processes closed after real Stop. The fixture only adapts interactive startup and installed dependencies. `B2-multistream-outer-red.log` now fails at configurationAccepted for two saved targets, matching `B2-selected-targets-inner-red.log`. No B2 production implementation existed at Red. The Pro request uses valid 30fps. Continue the nested implementation; no checkpoint is completion.

### B2 / FR006 — nested Green

The selection/snapshot owner passes both cases. Pro signed targets, tampered assignments, Free target count, delayed starts and Free guard isolation pass their native owner (5 cases), alongside the existing 23 runtime cases. Engine whole-file tests pass20 cases, including one capture/encoder feeding both copy outputs with identical encoded bytes and all target secrets redacted. The actual CLI outer journey passes both complete RTMP receivers with AAC, the final clip marker, one capture/encoder and closure (`B2-multistream-cleanup-green.log`). No B2 slice-completion gate claimed: independent devices/provider baselines, selector UI, regression coverage and static gates remain. Formatting completed; a fixture typing repair is pending verification. Continue the next behavior rather than stopping at this checkpoint.

### B2 — independent devices and provider baselines

`B2-provider-outer-baseline.log` passes all5 real CLI/media journeys, with simultaneous two-device playback, complete final frames/AAC and no surviving outputs. `B2-provider-inner-baseline.log` passes7 API cases. FR007/provider implementations already worked after FR006: record honest baselines, never manufacture Red. Dashboard selection subsequently proves its separate missing UI/read contracts: legacy action loses the selected set, and reads lack safe destination IDs. Required Red retained before those production edits. New safe projection replaces encrypted credentials/URLs in the Runner detail response; selector/editor wiring is now under scoped test. Full B2 completion remains pending regression/coverage/static/browser checkpoints.

### B2 — safe UI/public configuration and diagnostics Green; checkpoint in progress

Actual browser seven-case owner passes the selector-backed setup and legacy conversion. Public per-Runner and all-session reads remove scalar URLs/ciphertexts/raw diagnostics; MCP configuration reads expose ordered selected IDs. Selection/state owner18cases includes invalid/foreign/scoped/duplicate IDs, transaction rollback, stable captured keys, isolated devices, active assignment protection and allowed closed reassignment. Component owner3cases verifies Free/Pro selection, required keys, empty setup and keyless custom output. Action owner11cases verifies quiet normal denials and sanitized unknown reporting, after retained Red.

The first larger app producer passed421/422 cases; complete workflow producer passed410/414. Both failed because old fixtures used a literal ciphertext or scalar target hash, documented as DEF077/078. Corrected focused owners pass15app cases,73native Runner workflow scenarios and both Free ATDD journeys with unchanged assertions. Failed outputs are archived under coverage/runner-B2-affected-failed and coverage/runner-B2-workflows-failed and are excluded from qualification. Fresh completed-slice producers now run with the repository's bounded worker budget and distinct job-owned template IDs. No B2 completion or whole-feature Go is claimed yet.

Native whole package qualifies170cases/35suites plus1unchanged TODO, including the new output.ts inventory: general S92.67/B86.11/F93.93/L96.23; all6critical files retain their thresholds. Production standalone build and93action manifests pass; source digests are retained before the current repeated checkpoint. Continue directly after T668, not at a partial progress final answer.

### B2 — qualified completed-slice checkpoint

All5primary BDD and5TDD artifacts are Green. Current whole app producer passes424cases/25owners; refreshed lease18 and shared-schema31 owners add6and31 distinct cases respectively, yielding461 distinct cases over26owners with unchanged production input hashes. Their same-source counter maps merge with the complete414-scenario native workflow owner (412BDD+2ATDD, no skip/flaky) and pass all11 changed canonical-source gates. The three admission/credential services retain stricter S/F/L95,B90; new selector is100all metrics. Failed producers are archived and excluded.

Native package170pass/35suites +1unchanged TODO and all ten changed native source hashes/thresholds qualify. Current-source browser7pass, standalone/E2E builds,93action manifests, app/native types, scoped lint and11migration-policy cases pass. `B2-final-scoped-gate.json` records exact hashes/counter-map agreement. Gate review identified only missing shared-validator evidence, fixed by executing/expanding that owner without production changes.

No release/whole-feature Go is claimed. T668 is complete. Continue immediately into B3 independent output failure/status/recovery, keeping subsequent work scoped and test-first.

## B3 FR008 — independent output status, opening Red

Owning native whole files run before any B3 production change. `bun run test --runTestsByPath test/bdd/runner-free-pro.test.ts --coverage=false`: 1 failed/3 passed in64.351s; real loopback receiver media continues after its peer disconnects, but `Expected: "retrying"`, `Received: null` (B3-FR008-outer-red.log). `bun run test --runTestsByPath src/__tests__/output.test.ts --coverage=false`: 1 failed/5 passed; expected `[{"id":"one","state":"retrying"},{"id":"two","state":"streaming"}]`, received undefined (B3-FR008-inner-red.log). The fixture compiles actual output.ts using established esbuild infrastructure, encodes once with actual installed FFmpeg and uses two independent real RTMP receiver processes; only the media source is synthetic. No claim about authenticated dashboard telemetry yet. Implement state projection first; retry scheduling is the next nested behavior before the outer slice closes. No commits; implementation remains uncommitted as authorized.

### B3 FR008 — first inner Green

The whole output unit owner passes6/6 (`B3-FR008-inner-green.log`). Each output now retains its own safe ID/state projection; failure changes only that output to retrying. Existing independent FIFO, bounded memory, graceful flush and forced cleanup assertions remain Green. No refactor needed for this small projection. Retry execution and authenticated telemetry remain pending, so B3 and A8 are not qualified complete.

### B3 FR008 — outer Green, recovery loop next

Whole native BDD owner passes4/4 in63.86s (`B3-FR008-outer-green.log`); actual disconnected RTMP peer reports retrying and healthy receiver continues. No dashboard telemetry claim and no B3 completion gate yet. Next outer OPT092 exercises actual reconnect, with its own intended Red before implementing retries.

### B3 OPT092 — reconnect outer and inner Red

Whole BDD owner:1failed/4passed, `Expected: true`, `Received: false` for recovered in B3-recovery-outer-red.log after restoring the exact real receiver endpoint. Whole output unit owner:1failed/6passed; `Expected length: 3`, `Received length: 2` after1second in B3-recovery-inner-red.log. No retry process exists. Implement only per-target reconnect; retain existing successful and failed-state assertions.

### B3 OPT092 — inner Green

The output unit owner passes7/7 and complete affected output/engine/controller owners pass32/32. Reconnect replaces only the failed child after1second, preserving the healthy process and receiving fresh shared media. Shutdown cancels owned pending retry timers as required to preserve the existing cleanup contract. Outer real recovery qualification is running; no final slice gate claimed. No separate refactor needed yet.

### B3 recovery outer Green and stop-fence retained baseline

Whole native BDD owner passes5/5 in76.255s (B3-recovery-outer-green.log), including actual receiver reconnect with one healthy process start. U250 was already implemented by preserving cleanup while adding owned retry timers: whole unit owner8/8 (B3-stop-fence-baseline.log). Deliberately bypassing shutdown timer cancellation and the stopped fence gives `Expected length: 2`, `Received length: 4` in B3-stop-fence-mutant.log. Source restored exactly in finally; whole owner8/8 (B3-stop-fence-restored.log). No invented test-first Red for that retained cleanup baseline. TDD-US2-CON006 remains Planned until its remaining literal/FIFO/independence cases are executed.

### B3 structural test-owner split on Green

Move the unchanged three A4/A7 native drain/unlimited-hour cases into runner-drain-regression.test.ts. Their shared Gherkin stays in runner-free-pro.feature. Preserve every assertion and stable artifact ID; update only technical owning paths/commands. The B3 output-recovery owner remains runner-free-pro.test.ts. This prevents replaying unchanged12-second clips during each reconnect iteration; complete native milestones still execute both whole owners. Verify byte identity of the moved test body and run both whole files before the next behavior.

### B3 U251 — actual output observation Red

The existing U8 fixture now emits real FFmpeg progress protocol at its mocked process boundary before asserting streaming; accepting bytes into local stdin cannot prove a remote output is live. New U251 whole owner9cases fails only that stricter invariant: expected connecting, received streaming in B3-output-observation-red.log. Bind streaming to positive per-child muxer progress, retaining retry state independence. The actual receiver outer tests remain required and unchanged.

### B3 U251 — Green

The output/engine/controller whole owners pass34cases. Only positive FFmpeg out_time_us progress marks its own destination streaming; partial diagnostic lines have a128-character bounded remainder and stale/closed child progress is ignored. State remains credential-free. No refactor needed. Partial CON006 is not a completed slice gate: literal argv and FIFO overflow/recovery observations remain pending.

### B3 U249 — bounded FIFO recovery Red

Whole output owner:1failed/9passed (B3-fifo-recovery-red.log). Existing overflow closes its local output before the close event, so the retry callback is suppressed and its connecting state is stranded. Expect retrying plus independent fresh-media reconnection, with healthy writes preserved. Route overflow through the existing child-close failure transition instead of preemptively suppressing it. This is the intended unbuilt B3 recovery behavior, not a fixture failure. Structural owner split independently verified:2recoverycases pass18.506s and3unchanged drain cases pass58.037s; byte identity hash295d96dfefe3c2175fc5e7f59416af90b7ce6ccd54c06be54bce6cd5fbeb30a7.

### B3 U249 — Green

Complete affected output/engine/controller owners pass35cases (B3-fifo-recovery-green.log), including bounded-overflow retry into a fresh output while the healthy destination continues. The fix removes the premature closed flag that suppressed the existing failure transition. Literal argv/FIFO muxer configuration, all-failed exhaustion, real three-receiver decoding/cleanup and authenticated telemetry remain open. No extra behavior or threshold change.

### B3 EC005 — bounded-retry Red and separate observer defect

Whole output owner1failed/10passed in B3-exhaustion-inner-red.log: after five retries per destination, expected failed but received connecting. Whole real BDD owner B3-exhaustion-outer-red.log has the corresponding intended `exhausted: false` Red plus an unexpected FR008 progress-tick sampling failure. DEF-US2-082 records the latter; stop production work until the whole observer-owner rerun confirms the correction. Actual media and exact status assertions are retained; production still does not infer remote success from local pipe writes.

### B3 EC005 — qualified outer Red

B3-exhaustion-outer-qualified-red.log passes both retained scenarios and fails only unavailable-destination exhaustion (`Expected: true`, `Received: false`). DEF-US2-082 is Verified. Implement five independent one-second retries per failed output, reset only after real positive muxer progress; thereafter failed is explicit and no new process is opened. This bounds recovery without restarting healthy outputs or releasing broadcast occupancy.

### B3 EC005 — inner Green

Output/engine/controller whole owners pass36cases. Each failed destination receives at most five retries; only genuine positive muxer progress resets its count. After exhaustion it stays failed and starts no further child, while owner Stop remains available. Active broadcast occupancy is unchanged. Actual receiver exhaustion qualification is running. No refactor needed for the small counter transition.

### B3 EC005 — real recovery timing diagnosis

B3-exhaustion-observations.log retains the intended outer Red, with stronger safe observations: only9of12expected total output starts occur before the20-second recovery observation; states are connecting/retrying, not an unbounded counter reset. New copy processes spend the default FFmpeg analysis interval rediscovering our already-known MPEG-TS source. Specify that input format and bounded32KiB/one-second analysis rather than extending the assertion deadline. All2retained real receiver cases continue to pass. This is unfinished work within the open EC005 outer cycle, not a newly green acceptance claim.

### B3 EC005 — real outer Green; literal argv retained baseline

Whole native BDD owner passes3/3 in28.424s (B3-exhaustion-bounded-probe-runtime.log): both failed destinations exhaust exactly five retries (12totalinitial+retryprocesses), report failed, and no healthy-output restart occurs in the other scenarios. Bounded known-format input probing fixes latency without extending any assertion deadline. A27 remains Green until all B3 inner/telemetry gates complete.

U142 literal argv was already correctly implemented: whole unit owner12/12 in B3-literal-argv-baseline.log. Deliberately enabling shell invocation fails the exact spawn-options assertion in B3-literal-argv-mutant.log. Restored production byte-for-byte in finally;12/12 in B3-literal-argv-restored.log. Stream keys containing tee/shell metacharacters stay one literal argv value, and safe state snapshots contain no key. No fake test-first Red claimed for this B2 retained baseline. CON006 still needs explicit muxer keyframe/FIFO and drain-permission coverage before its final gate.

### B3 FR008 reconnect-state refinement Red

Whole output owner1failed/12passed in B3-retrying-state-red.log. Initial connection may say connecting, but a pending recovery attempt must stay retrying until that child provides positive muxer progress. Existing two-receiver outer FR008 missed the short connecting interval; the new deterministic process-clock case closes that gap without changing the criterion or adding an artifact ID.

### B3 FR008 reconnect-state refinement Green

Complete output/engine/controller owners pass38cases. Recovery attempts retain retrying until their own positive muxer progress. Initial connections still report connecting. No refactor needed; continue U250 permission fencing through graceful drain/expiry, distinct from already proven immediate-close timer cancellation.

### B3 U250 — graceful drain/expiry permission Red

Whole output owner1failed/13passed in B3-drain-permission-red.log: permission is revoked while a failed output waits to reconnect, but the pending timer opens a third child. Existing healthy output must keep receiving the finishing clip. Add a fresh permission check at the new-output boundary; immediate close cancellation alone cannot protect graceful drain or lease expiry.

### B3 U250 — output guard Green; engine integration Red

Whole output owner14/14 passes in B3-drain-permission-green.log: a denied new-output permission leaves healthy finishing media untouched and opens no retry child. Next actual Engine owner21cases fails only U250 integration (`Expected length: 1`, `Received length: 2`) in B3-engine-recovery-fence-red.log: Engine does not yet pass its captured execution permission/draining gate into RunnerOutputs. Connect that gate before another timer can open a destination. This is separate executable integration evidence before the engine production change.

### B3 U250 — engine integration Green

Complete output/engine/controller owners pass40cases (B3-engine-recovery-fence-green.log). Engine now passes its current running/draining/captured-permission gate to each new destination output. Pending retry cannot reopen after owner drain or lease expiry, while existing healthy outputs can finish the playing clip. All prior independent retry, immediate closure, bounded FIFO and captured policy assertions remain Green.

### B3 — three-receiver acceptance/native contract retained baseline and mutation proof

One shared beforeAll fixture run in test/output.integration.test.ts supplies ATDD-US2-SC002 and TDD-US2-CON007. Three independent loopback provider endpoints decode H264/AAC; common encoded-video packet hashes prove shared content, exactly one encoder is spawned, and both healthy outputs start once during peer loss/recovery. Graceful output closure leaves all owned processes terminated and all three listening sockets rebindable before emergency fixture cleanup. The whole owner passes2/2 in12.382s (B3-three-receiver-baseline.log).

These strengthened ATDD/internal observations were materialized after B3's unit/BDD-led retry implementation, so they are honestly retained functioning behavior, not a claimed initial test-first Red. Earlier BDD OPT092 and EC005 expected-failure logs are the outside-in proof before that production code. Disabling retry now fails both acceptance/internal observations in B3-three-receiver-mutant.log; source restored byte-for-byte in finally. The distinct U37 controlled three-output contract initially passes15/15 (B3-three-output-unit-baseline.log); dropping delivery to the third output fails B3-three-output-unit-mutant.log. After restoring each mutant, both owning files pass17/17 in10.64s (B3-three-receiver-restored.log). Do not count the shared physical media run twice or invent another test-first claim. Final B3 gates still require authenticated telemetry, UI, coverage/static and current completed-slice checks.

### B3 FR008 — authenticated telemetry outer/integration and inner Red

Whole real PostgreSQL/API owner output-status.test.ts fails only `telemetryAccepted` (Expected true, Received false) in B3-authenticated-output-status-red.log after genuine Pro configuration/admission/dispatch. Current strict heartbeat schema cannot accept output observations. Whole lease owner1failed/18passed in B3-output-persistence-inner-red.log: active identity is accepted but no outputStates persistence occurs. Add only safe captured-ID/state persistence and explicit dashboard/MCP projections, bound by existing owner/device/generation/lease checks. No raw diagnostics, immutable-benefit mutation or generated migration.

### B3 FR008 — server persistence/projection Green; native reporting Red

Authenticated real API owner passes1/1 in7.923s (B3-authenticated-output-status-green.log), proving safe output states reach both dashboard and MCP reads. Whole lease owner passes19/19 (B3-output-persistence-inner-green.log). Observations are stored on the captured admission, not immutable benefits, and cannot authorize/release execution. New native whole controller owner1failed/5passed in B3-native-output-reports-red.log: active receipts omit outputs. Expose Engine's safe snapshot and project only id/state into active receipts; existing terminal receipts remain unchanged.

### B3 FR008 — native reporting Green; encoder summary Red

Complete native output/engine/controller/execution-runtime owners pass65cases in B3-native-output-reports-green.log. Engine safe snapshots are projected to id/state only in active heartbeat receipts; arbitrary extra process fields are excluded. The existing native CLI already serializes those controller receipts. Complete affected server action/heartbeat/lease owners pass61cases in B3-server-output-affected.log.

A separate engine status contract fails1/22 in B3-encoder-summary-red.log: expected shared `Encoder healthy`, received `Stopped 🔴 (Code: 1)` after one target fails. Destination process monitors must not overwrite shared encoder status; keep independent destination snapshots and sanitized diagnostics. This is intended missing B3 status isolation, before its production change.

### B3 shared encoder status Green

All four affected native owners pass66cases (B3-encoder-summary-green.log). Destination monitors retain sanitized diagnostics without replacing the shared encoder summary; their own output snapshots continue to report retrying/failure. No capture/encoder restart is introduced. Next is the planned dashboard status surface, as a small accessible RunnerOutputStatus component rendered by the existing Runner detail page; its owning component tests join TDD-US2-FR008's existing native/server evidence.

### B3 FR008 — dashboard component Red

The new whole component owner fails1/1 with `Unable to find an accessible element with the role "list" and name "Destination status"` in B3-output-status-component-red.log. Build the small named per-destination status list and render it from the existing Runner detail page. Both native state contracts and actual API projections are already Green; this new case proves the user-facing surface before its implementation. Relevant installed Next16 use-client guidance reviewed.

### B3 dashboard status Green; exhausted-output guidance Red

The status/selection component whole owners pass4cases in B3-output-status-component-green.log. A separate EC005 component case then fails1/2 in B3-failed-output-component-red.log: failed status is visible, but recovery guidance is absent. Add the concise check-settings/stop-and-start guidance, keeping healthy-output wording absent when none is live. No retry promise after the bounded attempt count.

### B3 cleared-credential selection Red

Whole selection component owner1failed/3passed in B3-cleared-key-removal-red.log: a previously selected target whose required key was cleared becomes disabled, trapping it in selection. Keep an unconfigured unselected target disabled, but allow the selected target to be deselected. The server still validates all Start credentials and protected captures. This was the B2 observation explicitly assigned to B3, with its own intended Red before the one-condition change.

### B3 selection removal Green; Start readiness Red

Both whole UI owners pass6cases after the cleared-key removal fix (B3-cleared-key-removal-green.log). New Start-readiness case then fails1/5 in B3-start-readiness-red.log: expected false for a selected destination with a missing required key, received undefined (no readiness contract). Introduce the metadata-only predicate and use it for Start, keeping configuration save separate so a temporarily unconfigured destination can still be edited. Include absent/deleted and keyless-custom boundaries in the same predicate contract; server authorization/credential checks remain authoritative.

### B3 requested-control feedback — real browser Red

B3-browser-feedback-build.log succeeds; fresh current-schema disposable browser fixture is used at runtime. The genuine whole manual Runner browser owner passes its existing configuration journey and fails only the new denied-second-Start feedback assertion (B3-browser-denied-start-red.log): `Locator: getByText('Cannot start broadcast', { exact: true })`, `Expected: visible`, `Error: element(s) not found`. Failure screenshot retains Start available and Stop disabled, matching the denied backend state. Existing action/authorization tests prove the normal safe resource failure; this browser case closes the known parent feedback gap recorded for B3. Add the friendly failure notification using the already sanitized returned error, with no throw/Sentry report. Existing BDD-US1-FR002 native admission evidence remains Green; current added browser feedback is Red until rebuilt/rerun.

Invalid output observation retained baseline passes23whole lease cases. Bypassing that validation produces4expected failing negative cases (B3-invalid-output-observations-mutant.log); source restored exactly in finally and23cases pass (B3-invalid-output-observations-restored.log). No fabricated test-first claim for these additional defensive observations.

### B3 final behavior loops Green; completed-slice qualification starts

B3-start-readiness-green.log passes7whole UI cases. B3-browser-feedback-green.log passes all3genuine browser journeys in47.8s, including the originally failing denied-Start feedback and named independent destination status. No backend expected denial is thrown/reported; the parent displays its sanitized normal error. Full native package passes188tests/37owners plus1unchanged TODO in165.493s (B3-native-complete-coverage.log). Ten-source native policy gate passes with unchanged thresholds (B3-native-policy-gate.json); six critical modules retain95S/F/L and90B. Complete affected application/complete workflow/expanded browser/static/build qualification remains open; no B3 completion is claimed yet. Format before final producers so current source hashes/counter maps agree. Formatting source locations require refreshed native coverage rather than attaching stale counters.

### B3 — completed affected checkpoint, continue C1

Current combined gate B3-final-scoped-gate.json is ok:true with no errors: all12 canonical app/protocol/UI paths meet unchanged thresholds; strict admission/destination/lease services retain95S/F/L and90B. Coverage merges only current matching counter maps from471app cases/28owners,414complete single-owner native workflow scenarios, and the refreshed29-case lease/status owners (475distinct current cases; no double count). Added partial-state/offline/waiting observations are honest retained baselines, killed their respective state-loss/false-online mutants (B3-partial-state-mutant.log/B3-offline-status-mutant.log), restored exact source in finally and pass29/29 (B3-state-boundary-restored.log). Ten-source native gate passes188/37suites +1unchanged TODO (B3-native-qualified-coverage.log/B3-native-policy-gate.json); six critical native modules keep95S/F/L,90B. Removed an unused test import and excluded generated nested coverage from lint; the changed whole native BDD owner passes3/3 afterward, without another full package run.

All9browser journeys pass in B3-qualified-browser-isolated.log with original deadlines after the completed build, verifying DEF084. Current E2E/standalone builds,93action manifests, explicit app/native type checks, global lint(0errors/6retained baseline warnings), formatting, root/native High audits and11migration-policy tests pass. All19frozen production hashes and native hashes agree. No generated migration, live billing mutation, publishing, release/CI approval or packaged-current-source native matrix is claimed. T235 and integrated final/release gates remain open for the final official artifact/matrix validation; current affected B3 checkpoint is Green and permits C1. This is10/23qualified delivery slices, roughly45%of implementation effort; scheduling remains the largest remaining area. All84current defects are Verified and no exception is approved.

### C1 preflight — approved US5 declarations and role/source reconciliation

Reviewed the17existing approved US5 scenario declarations (T239–T255), preserving original IDs, source tags, examples and shared role rationale. Registry has374unique primary IDs; all38US5artifacts have role/file/command definitions, corresponding test-list behaviors and source-map relationships. BDD/ATDD definitions resolve directly to spec; technical/internal TDD IDs resolve through their source relationships and test-list contracts, not invented acceptance labels. T256 is reconciled; future bindings stay Planned, and no future executable tests were materialized. Defect/summary reports are initialized/current. Continue C1 with existing Free+Pro/current prices, normal returned purchase denials, preserved historical Runner decoding and no live commercial write/email.

### C1 — FR-020 purchase retirement: confirmed Red

Outer browser owner `runner-commercial.feature` fails because the optional paid Runner checkbox is still present (`evidence/C1-pro-setup-outer-red.log`). Inner real subscription-action owner fails because standalone Runner returns a mocked checkout URL instead of a normal included-plan result (`evidence/C1-runner-purchase-inner-red.log`); the existing Pro price/control case passes. Existing affected baseline: 32 passing cases in six whole owners (`evidence/C1-existing-affected-baseline.log`). No live Stripe writes. Implement the purchase restriction before Stripe reads/writes and remove the optional purchase control; keep historical catalog aliases and current Pro prices.

### C1 — FR-020 Green/refactor

Standalone Runner action returns a structured included-plan result before authorization/catalog/Stripe work; Pro checkout remains unchanged. Pro setup removes the separate Runner option/price and retains its Pro-only checkout URL. All three checkout consumers narrow the returned string/result explicitly. Whole action/commercial owners pass14/14 (`evidence/C1-purchase-action-green.log`); real browser owner passes1/1 (`evidence/C1-pro-setup-outer-green.log`); corrected build and scoped lint pass (`C1-pro-setup-build-qualified.log`, `C1-first-purchase-lint.log`). DEF-US5-085 is verified by the build. This closes only FR020 behavior, not C1 or its broader CON014 contract. Next atomic behavior: reject retired public Runner query links before committing an intent.

### C1 — OPT065 old query links Red

Whole commercial browser owner:1retained pass/1intended failure, old Runner link reaches login instead of included pricing (`evidence/C1-query-outer-red.log`). Whole internal owner:2retained pass/1intended failure, authenticated route redirects to checkout/continue (`evidence/C1-query-inner-red.log`). Reject any runner=true query before writing a checkout intent; do not silently buy Pro from a mixed retired link. Preserve normal Pro-only routes.

### C1 — OPT065 Green/refactor

Runner-only and mixed old query links redirect to /pricing?runner=included before writing any checkout cookie; mixed selections do not silently charge Pro. Whole commercial/intent owners pass11cases, including Pro-only signed selection and legacy intent decoding. Rebuilt actual browser owner passes2/2; scoped formatting/lint pass. No live billing request. Existing historical intent decode is retained; execution is separately guarded by generateCheckout. Next: included Runner limits and grouped benefits on public pricing.

### C1 — OPT064 public pricing Red

Whole browser owner passes2retained journeys and fails the new grouped Runner section assertion. Whole commercial owner passes6retained cases and fails missing Runner limit data. The existing pricing-page owner changes only its obsolete optional-add-on assertion to included access, failing1/3 before production. Logs: C1-pricing-outer-red, C1-pricing-inner-red, C1-pricing-faq-red. Implement the existing two-plan comparison group and consistent FAQ; keep current live Pro price resolution and other catalog features.

### C1 — OPT064 Green/refactor

The existing comparison now groups included Runner benefits, unlimited hours/devices, Free1broadcast/1destination, Pro scheduling/multiple destinations/custom standby/attribution removal. Existing Free/Pro names and live prices remain. FAQ removes paid Runner wording and states local execution. Four whole internal owners pass19cases, browser owner3/3, scoped lint and E2E build pass. Next atomic behavior: billing controls must not offer a new Runner purchase while retaining historical billing management.

### C1 — OPT066 billing controls Red

Corrected whole browser owner passes3retained journeys and reaches the real billing panel, where the Runner purchase checkbox is still present (Expected0/Received1). Whole commercial owner passes7retained cases and fails Runner selectable=true. DEF-US5-086 is verified as a fixture correction; the canceled original producer is not evidence. Remove new Runner selection, explain included access, retain owned historical Runner rows and cancellation management. No Stripe writes in browser or internal fixture.

### C1 — OPT066 Green/refactor

New Runner products are not selectable in billing options and are omitted from new-purchase controls. Included access is visible. Owned historical subscriptions still appear as owned and existing cancellation handling remains unchanged. Whole app/commercial owners21/21, rebuilt browser4/4, scoped lint pass. Next: actual Free Runner onboarding must stop offering the obsolete paid add-on and old Runner upgrade requests must select the existing Pro plan instead of a new Runner product.

### C1 — OPT067 onboarding Red

Whole real browser owner passes4retained cases and fails the missing included-access notice on the actual dashboard Runner tab. Source confirms the old paid banner and Add Runner handler still gate on legacy runnerAccess. Whole internal owner passes9retained cases and fails old Runner primary normalization. Remove obsolete paid frontend guards while leaving server ownership enforcement unchanged; normalize retired upgrade requests to the existing Pro product. Logs C1-onboarding-outer-red / C1-onboarding-inner-red.

### C1 — OPT067 Green/refactor

Actual Free dashboard Runner creation succeeds and reaches the disconnected-device setup with all three OS downloads, no checkout. Whole commercial browser owner5/5, commercial/action22/22, two complete dashboard component owners91/91; current E2E build and scoped lint pass. Three preexisting component expectations that required paid Runner access were updated to approved included access, retaining failure/rejection/no-implicit-creation checks. DEF-US5-087 fixes only an incorrect expectation of already-connected Stream Configuration; same build rerun passes. Next internal-only CON014 boundary: agency Runner-seat increases must return an included-plan restriction before writes while creator-seat changes remain intact.

### C1 — CON014 U273 agency increase Red

Whole commercial owner11retained passes/1intended failure: a Runner-seat increase returns kind=increase instead of a normal included-plan restriction; fixture uses mocked Stripe and database write boundaries. The creator-seat increase control passes through real agency billing orchestration, proving the fixture supports valid mutation. No browser scenario is declared for this internal-only agency write contract; existing C1 browser ownership remains five Green journeys. Reject Runner increases immediately after authorized billing-context lookup, before pending state or Stripe writes; keep existing creator changes and Runner decreases.

### C1 — CON014 U273 Green/refactor

Whole commercial and retained agency-policy owners pass29cases (`evidence/C1-agency-increase-inner-green.log`). Runner-seat increases return RUNNER_INCLUDED before database/Stripe mutations; creator-seat increases still use the existing prorated Stripe update. CON014 remains in progress for its other declared contracts. Next atomic boundary: initial agency checkout must not create a Runner line item.

### C1 — CON014 initial agency checkout Red

Whole commercial owner12retained passes/1intended failure (`evidence/C1-agency-initial-inner-red.log`): an initial agency configuration with Runner seats still creates a mocked checkout session. Reject the requested Runner line item before customer/session/subscription/database writes. Preserve historical existing-subscription management and creator-only checkout; no live commercial mutation.

### C1 — CON014 initial agency checkout Green/refactor

Whole commercial owner13/13 passes (`evidence/C1-agency-initial-inner-green.log`). Initial requested Runner seats return normal included access before Stripe/customer/database writes. Next adapter contract: a denied agency increase must show the included-plan result instead of reporting unchanged billing or catching framework redirects.

### C1 — CON014 agency feedback Red

Whole commercial owner13retained passes/1intended failure (`evidence/C1-agency-feedback-inner-red.log`): included access is misclassified as unchanged, then the adapter catches its own framework redirect and reports it as a billing error. Installed Next16 redirect documentation requires redirect outside try/catch. Move only the mutation into the guarded try, then route the normal restriction to its user-readable error without throwing a business exception. Keep creator/decrease success redirects outside catch as well.

### C1 — CON014 agency increase feedback Green/refactor

Whole commercial owner14/14 (`evidence/C1-agency-feedback-inner-green.log`). Restriction redirects once to the existing billingError surface with the safe human-readable included-plan message. It performs no mutation and does not catch framework redirects. Next: initial agency billing restriction must likewise not report invoice sent.

### C1 — CON014 initial agency form Red

Whole commercial owner14retained passes/1intended failure (`evidence/C1-agency-start-feedback-red.log`): a blocked initial Runner purchase is incorrectly reported as invoice-sent. Project kind=included to the existing safe human-readable feedback before any success redirect; no business exception.

### C1 — CON014 retained agency/history baselines

Whole commercial/catalog/agency owners42/42 (`evidence/C1-agency-history-restored.log`). Creator-only initial checkout and ordinary historical Runner unchanged/decrease behavior are retained baselines, not invented missing behavior. Four independently specified published dev/prod Runner price IDs remain decodable without Stripe catalog calls. A deliberate price-recognition-removal mutant fails exactly those4cases (18other commercial cases pass), then the historical catalog is restored byte-for-byte and all42cases pass (`evidence/C1-historical-price-mutant.log`). U274 is an honestly verified BASELINE; no historical identifier is removed. Next: strengthen the already implemented individual action/consumed-intent guard with direct mixed-selection and replay-safe cookie observations, using a deliberate guard-removal mutant rather than claiming a new initial Red.

### C1 — CON014 individual guard and consumed-intent baseline Green

Whole commercial/intent/catalog/agency owners50/50 (`evidence/C1-commercial-contracts-restored.log`). Mixed enum/per-cycle selections cannot charge Pro alongside retired Runner, and an old signed Runner intent is cleared then returns no selection on a second continuation. A deliberate purchase-guard removal fails exactly4commercial cases (21retained cases pass), including both mixed selections and old intent; exact source restoration returns Green (`evidence/C1-individual-guard-mutant.log`). U150 is a verified retained baseline built by FR020, not claimed new test-first implementation. All CON014 contracts now have real action/route/agency orchestration evidence, with mocked billing writes only. Next outer/inner Red: consistent home/features/setup/served LLM documentation and responsive grouped pricing (DEC013).

### C1 — DEC013 guidance and old-link Red

Commercial owner25retained passes/1intended missing-reference failure; support owners3intended copy/old-public-product failures with6retained passes. Whole browser owner first proves served llms.txt lacks included guidance (5pass/1fail); expanded old addon=settings URL check then proves a retired Runner purchase modal still appears (4pass/2intended fails). Logs C1-guidance-inner-red, C1-guidance-support-red, C1-guidance-outer-red, C1-guidance-legacy-link-red. Update home feature/FAQ, existing pricing cards and enrollment copy, remove old Runner upgrade entry behavior, and update both actual reference templates. Preserve live current Pro prices and two plans; no commercial email or live billing mutation. Responsive screenshots and actual served-route assertions are part of the same browser owner.

C1 aggregate-task ordering note: T270/T761 span several atomic commercial behaviors. The mandatory one-behavior Red–Green loop was followed for each corresponding production change; DEC013 outer/inner Reds were materialized before its guidance/setup changes, not batched at the beginning alongside every other missing behavior. All declared prerequisite Reds now exist and T268/T269/T759 can be checked. T270/T761 and qualification remain open until every current owning result and static/coverage checkpoint passes.

### C1 — DEC013 Green and responsive review

Whole commercial browser owner6/6 (`evidence/C1-mobile-fix-browser.log`) after current E2E build. It checks actual served llms.txt/llms-full.txt, the home feature/retired pricing card, normal legacy billing-query behavior, grouped desktop pricing and the 390px accordion with no document overflow. Desktop/mobile screenshots are retained as C1-pricing-desktop.png / C1-pricing-mobile.png and were visually inspected; both use the existing two-plan HeroUI layout, no new tier. The local catalog intentionally shows Unavailable without live Stripe credentials; exact preserved Pro prices are proved through the controlled checkout/catalog owners. All product copy and legacy enrollment recovery are consistent; old identifiers remain readable. DEF-US5-088 type-option correction passes build; DEF-US5-089 footer wrapper is bounded rather than hidden and the exact mobile assertion passes. App whole affected coverage/static/build qualification is now running; no C1 completion or release claim yet.

C1 affected checkpoint evidence:18whole owners/228cases pass with coverage; all four changed canonical UI/catalog sources meet unchanged S/F/L90,B85 (OverlayTable S95.85/F96.42/L98.13/B85.48; settings S91.95/F92.30/L94.55/B86.81; pricing page/catalog100%). Nine unchanged critical Runner sources reuse B3 qualification only after current byte hashes match; strict critical baselines remain. Six current browser journeys pass and were visually reviewed. Standalone and E2E builds pass; patched dependencies and93action manifests verified. Global lint0errors/6retained warnings, migration policy11passes, High audit passes. Current source frozen in C1-final-scoped-gate.json; explicit types/final format still pending. Historical coverage exclusions are unchanged, never reported as newly instrumented commercial coverage.

### C1 qualified — purchase retirement and included guidance

C1 is complete:18affected whole owners/228cases with applicable unchanged coverage thresholds (`evidence/C1-final-scoped-gate.json`),6actual browser journeys and reviewed desktop/mobile screenshots. E2E/standalone builds,93action manifests, explicit types, global lint(0errors/6baseline warnings),11migration checks, High audit and the full248-file changed-source formatting check pass. All21frozen production hashes match. Retained critical Runner and10native source hashes match their qualified B3 inputs; unchanged native/media/workflow checks are not needlessly repeated or counted as new executions. DEF-US5-085–091 are Verified; JSON formatting preserves all30parsed archival evidence objects and raw logs are untouched. No further code refactor is needed after the normal-result/consumer cleanup. C1 aggregate implementation/refactor/checkpoint tasks are checked; whole-story/feature/release gates remain open. Proceed directly to C2 scoped grant/benefit parity.

### C2 — FR021 lifetime grant retained baseline

Current production already preserves lifetime Runner grants: actual Scheduled-control configuration is saved through public MCP, while published pause_overlay is FEATURE_RESTRICTED and the creator stays Free. Inner actual-service entry separately proves individual/batch parity, no cross-owner grant leak and a null lifetime end/revocation. Whole commercial owner27/27 and native owner1/1 pass after exact restoration. A deliberate Runner-as-Pro grant lookup mutant produces effectivePlan=pro/proAccess=true in the inner test and allowed:true on pause_overlay in the outer test; both kill it. Evidence C2-lifetime-*-mutant/restored logs. No permanent production change or invented original Red. DEF-US5-092 was a test using internal control_overlay instead of published pause_overlay, verified corrected. Calendar window dispatch remains pending scheduling slices; this proves eligibility only. Next atomic baseline: bounded active legacy grant.

### C2 — OPT068 bounded active grant retained baseline

Whole commercial owner28/28 and native owner2/2 pass. A bounded active Runner partner grant enables Scheduled control and advanced Runner policy without unrelated Pro features; individual/batch results match and an ungranted owner remains Free. This is existing correct behavior, with no production change. Evidence C2-active-inner/outer-baseline.log. Next atomic case: expired Runner grants must receive no Pro-partnership grace and cannot save Scheduled control.

### C2 — OPT069 expired grant retained baseline and strength

Whole commercial owner29/29 and native owner3/3 pass. A Runner partner grant that ended one day ago has no seven-day Pro partnership grace: individual/batch retain Free basic Runner, advanced policy is false and the real Scheduled-control save is denied without a session row. Deliberately removing only the active-entitlement expiry predicate fails exactly that inner case and that outer journey; all retained others pass. Exact restoration returns29/29 and3/3 (`C2-expiry-*-mutant/restored.log`). No permanent source change. Next atomic case: a revoked but otherwise unexpired Runner grant.

### C2 — OPT070 revocation retained baseline and strength

Whole commercial owner30/30 and native owner4/4 pass after exact source restoration. The grant has a future end but a past revocation, so denying advanced Runner access proves revocation independently of expiry. Removing only the revokedAt predicate fails exactly that inner case and that native journey (29other inner/3other outer cases pass); restored source returns Green. Existing source already implements this rule. Next: active agency Runner allocation must remain Runner-only, including individual/batch parity and owner isolation.

### C2 — OPT071 active agency allocation retained baseline and strength

Whole commercial owner31/31 and native owner5/5 pass. A valid agency Runner allocation resolves Runner-only in both resolvers, gives no unrelated Pro, and does not depend on an individual Runner grant; its active finite lifetime is observed. A deliberate creator-Pro resolver product switch to runner fails exactly the new inner/outer cases (30/4retained cases pass), proving agency Runner allocation cannot silently become general Pro. Restored source is byte-identical. Next: passed agency allocation end must deny paid configuration while preserving baseline Runner.

### C2 — OPT072 agency lifetime retained baseline and strength

Corrected valid removal chronology passes32whole commercial cases and6native journeys. A passed agency Runner end denies advanced benefits even before status cleanup completes. Removing only the agency Runner end predicate fails exactly that inner/outer case, while31/5retained cases pass; byte-identical restoration returns32/32 and6/6. DEF-US5-093 is verified as fixture-only. All six declared C2 grant-state contracts now pass. Before qualification, strengthen the same matrix with independently ended status and effective Pro/trial/Pro-grant/creator-agency input parity required by T288; no new primary artifact IDs or pricing scope.

C2 qualification preparation: preserve the completed414-scenario B3 workflow producer at coverage/runner-B3-qualified-workflows before the new421-scenario inventory uses coverage/workflows. Existing B3 combined source counters and all raw evidence remain intact; no completed evidence is overwritten.

### C2 — supplementary input/status matrix and strength

The whole commercial owner passes37cases and the native commercial owner7examples (six primary IDs; OPT072 has independent passed-deadline and ended-status examples). New service examples prove billing Pro, reverse trials, Pro grants and creator Pro allocations inherit advanced Runner while raw Runner-only grant access remains false, preventing fabricated billing history. A status-predicate removal fails only ended-status inner/outer examples; an effective-Pro omission in deriveRunnerCapabilities fails all four Pro-source policy examples. Restored sources pass37/37 and7/7. No production change is necessary for these already-correct C2 eligibility rules. Evidence C2-agency-status-*-mutant/restored, C2-effective-pro-policy-mutant, C2-complete-inner-restored. C2 eligibility is ready for qualification; full affected app/native-workflow coverage and types/static evidence remain the checkpoint, not release approval.

### C2 qualified — scoped commercial eligibility

All six primary inner/outer IDs are Green retained BASELINE; no gratuitous production edit or fabricated initial Red. Seven native examples independently cover lifetime, bounded, expired, revoked, active agency, passed-end agency and ended-status agency access; four further actual-service Pro-source examples preserve raw Runner-only history. Each isolated predicate/scope mutation fails its intended assertions and byte-identical source restoration passes. See the preceding detailed cycle entries.

Complete native workflow/coverage owner:421/421 scenarios passed in9.1minutes, C2-complete-workflow-coverage.log. Current affected application evidence:438distinct tests in16whole-file owners across C2-affected-coverage.log(236), C2-support-coverage.log(133), C2-workflow-support-coverage.log(22), C2-final-support-coverage.log(53); six original guards overlap and are counted once. Extra cases verify current authorization/read, retry/commit and pagination boundaries after the first diagnostic exposed incomplete producer ownership. No threshold changed.

C2-final-scoped-gate.json passes all five critical source policies. Entitlements S99.01/F100/L100/B94.11; capabilities100all; workflow S97.67/F100/L98.59/B94.56; creators S98.21/F100/L100/B92.15; admission S96.59/F100/L98.68/B94.82. Retained admission counters require exact B3 source hash and counter-map identity; current app/native workflow counters are checked for identical maps before combining. All seven frozen production source hashes and C1's21runtime hashes match. Current explicit types, global lint0errors/6baseline warnings and formatting pass. Runtime/build/browser/security/migration results from C1/B3 remain applicable to unchanged production/native inputs; these are scoped checkpoint evidence, never a substitute for final full-feature gates.

DEF092–095 Verified;95total recorded defects Verified, no openHigh/Critical, no approved exception. C2 has no production change; expiry reconciliation/known-expiry snapshots/grandfathering are explicitly C3, scheduling later. T670 passes; C3 may begin. Delivery12/23qualified, roughly52% effort; release remains No-Go.

### C3 first atomic cycle — manual expiry grandfathering Red

Before production edits, the new complete commercial-transitions inner owner and native runner-commercial-transitions outer owner each fail once for the intended blanket-suspension behavior. Stronger fixture establishes two actual MCP Pro Starts, verifies signed pro_broadcast permits, then sends matching authenticated active-generation ACKs before removing Pro. The outer checks actual post-expiry heartbeat commands/signatures/original generations and real MCP denial of a third Start; the inner checks reconciliation counts, immutable stored sessions/admissions, saved settings and device availability. The first reservation-only fixtures also exposed suspension, but are superseded by this explicitly active-before-expiry setup; no such reservation is treated as already-running output.

Evidence C3-active-manual-expiry-inner-red.log: expected runners0/sessions0, actual runners3/sessions3; established2 assertion passes. C3-active-manual-expiry-outer-red.log: expected running/running, received stopped/stopped. Both primary registry entries now Red before production. CON015 signed validity/cache, scheduled-window expiry, other active-count boundaries and browserSC005 remain pending and are not claimed from this one manual cycle.

Minimal next production step: entitlement reconciliation must leave basic Runner availability and accepted generations untouched; future admissions already use current owner benefits and nonterminal occupancy. Admission close/drain and saved configuration retain their existing owners. This removes automatic suspension only, not explicit owner Stop or device credential revocation.

### C3 first atomic cycle — Green/refactor

The smallest production change removes blanket entitlement-driven Runner suspension from reconcileResolvedUserEntitlements. Basic availability is retained for all owners; existing accepted admissions remain unchanged, while new Starts use current benefits/occupancy. Explicit suspendRunnersForOwner stays available and its existing tests remain intact. No generated migration or billing change.

Observed Green: C3-active-manual-expiry-inner-green.log1pass, outer-green.log1pass; existing complete entitlement owner42pass in C3-reconciliation-regression.log. Refactor reuses one fixture heartbeat function, removes unused Start response collection and verifies returned signatures against DB-owned lease identity rather than reading an expected identity from the signed payload. Both complete owners remain1pass each in C3-active-manual-expiry-inner-refactor.log and outer-refactor.log. A35/U35DONE, EC013primaryentriesGreen. C3 as a delivery slice stays open; do not reuse C2 entitlement source hashes/coverage after this production edit. Next atomic contract: CON015/U276 known paid validity. Full signed device snapshot wiring, scheduled-window captures, remaining count/state/browser evidence and complete affected qualification remain pending.

### C3 CON015/U276 — known validity Red before production

Complete new capabilities.test.ts owner:2expected failures in C3-known-validity-inner-red.log. Both effectivePro and legacyRunner snapshots remain scheduling/customStandby/multi-target enabled exactly at validUntil, violating the stale-snapshot cutoff. The one-millisecond-before checks pass; at/after checks fail with runnerProtrue/sourcepro-or-legacy. Assert baseline one-target/one-broadcast/attribution policy at/after while retaining input immutability. PrimaryCON015Red and U276RED persist before code. This is the capability derivation foundation only; signed delivery/local runtime enforcement still requires subsequent boundary evidence and is not claimed complete.

### C3 CON015/U276 — policy foundation Green

Known-deadline capability derivation now returns baseline policy at/after validUntil, preserving paid policy one millisecond before. Source classification becomesFree with the expired policy. Both entitlement inputs remain unchanged. Complete capabilities/admission owners pass69tests(2new validity plus67admission regressions) in179.282seconds, C3-known-validity-inner-green.log. No further production refactor is needed for this small expression; do not repeat the unchanged long admission owner on every later test-only step. U276's inner policy case isDONE/T1017complete; CON015still has pending aliases, and actual signed snapshot/permit delivery plus official Runner start enforcement remain explicit C3 implementation work, not established by this policy unit case.

Scoped static check initially caught unused ignored projection bindings in the new fixture (DEF096). Underscore aliases preserve the exact stored-setting projection; C3-first-cycles-lint-restored.log passes with no lint errors/warnings. No product test was weakened. C2owned disposable templates were removed by explicit job IDs; currentC3 templates retained for ongoing work.

### C3 OPT073 zero-active expiry — Red before production

The completed previous cycle is Green before adding only this next inner/outer behavior. A Pro creator retains a stopped Scheduled-control configuration and separate Manual configurations, loses Pro with no active outputs, then attempts a Start against the saved paid configuration. Inner uses the actual shared service with controlled trusted-session principal/client and observes stored rows, admissions and success-audit rollback. Outer uses real authenticated MCP; both subsequently require one basic Manual admission still works. No calendar events/dispatcher are claimed from saved controlMode.

Whole owners C3-zero-expiry-inner-red.log and outer-red.log each have1expected failure and1retained pass. The expected normal FEATURE_RESTRICTED result is absent: stopped Scheduled control can currently Start onFree because only configure_stream_session checked paid control. Both primary entries and aliasesRed before production. Minimal correction belongs in shared controlStreamSession before a new stopped scheduled Start admission; retain Stop and accepted active/idempotent grandfather behavior, return normal resourceFailure rather than throw/Sentry.

### C3 OPT073 — zero-active expiry Green/refactor

Both whole owners now pass2/2 in C3-zero-expiry-inner-green.log and outer-green.log. The shared service returns normal FEATURE_RESTRICTED for a new stopped Scheduled Start after paid access ends, before admission/configuration/audit writes. Saved control settings remain; a distinct Manual session receives a Free admission. Existing accepted/manual expiry test staysGreen. The check intentionally follows existing active/idempotent handling and applies only to a new stopped Scheduled Start; explicit Stop remains available. No additional production refactor is necessary. A113/U113DONE; C3completion gates remain open. Next independent sample: one active grandfathered broadcast, Stop/closed-generation acknowledgment, then exactly one newFree admission.

### C3 OPT074 — one active transition retained baseline

Complete direct-service and native owners each pass3/3 in C3-single-expiry-inner-baseline.log and outer-baseline.log. One signed/ACKed Pro generation survives reconciliation, Stop returns accepted, a newFreeStart remainsRecoveryRequired while its outputs are unconfirmed, and the matching terminal-generation heartbeat releases it. Exactly one newFree admission is then accepted with runnerProfalse and saved settings retained. No production edit needed beyond preceding expiry cycles; retain honestBASELINE, not an invented Red. Next sample adds the second still-active grandfathered generation: acknowledging one must not free the owner until both close.

### C3 OPT075 — multiple active transition retained baseline

Both complete owners pass4/4 in C3-many-expiry-inner-baseline.log and outer-baseline.log. Two actual signed/ACKed paid generations survive expiry. Stop-before-closure retains both occupancies; the first matching terminal heartbeat reduces occupancy to1 but a newFreeStart is stillConcurrencyLimited. Only after the second generation closes is oneFree admission accepted. All settings retained, captured generations unchanged, safe public outputs. No new production change is needed; A115/U115honestBASELINE. Next atomic behavior is the captured scheduled end: active paid windows survive benefit expiry but must finish/drain at their captured end, including the official local signed permission deadline.

### C3 FR022/CON015-U277 — captured scheduled end Red before production

The previous multiple-active baseline completes before this one scheduled-window cycle. Given fixtures capture trusted occurrence/end only while a realMCP admission is reserved and undispatched, then verify signed Start/ACKactive before benefit expiry. This models an already active window; no calendar authoring/dispatch is claimed. Controlled Date.now samples just before/exactly at the immutable end without mutating active capture.

All required current boundaries fail for the intended missing behavior before production: C3-scheduled-expiry-inner-red.log1fail/4pass and outer-red.log1fail/4pass report expected capturedEndnumber, receivedundefined from signed permit. C3-captured-end-inner-red.log1fail/2pass reports expected draining, receivedactive at the paid guard's scheduled deadline. C3-captured-end-native-red.log1fail/23pass reports requestDrain expected deadline321000, calls0. Native test also asserts current-clip closure is awaited before journal/terminal receipt and immediateStop is never called. PrimaryFR022 andCON015entriesRed; A22/U22/U277RED before code.

Minimum implementation: sign/verify the captured end and pass it into official local permission; use monotonic anchoring to drain at that end while accepted manual paid permits remain unbounded. At the server's captured end persist graceful drain/desiredStop under existing owner lock; heartbeat must propagate a draining captured admission even if a stale session snapshot/legacy permission would otherwise sayrunning. Existing drain machinery handles clip finish and bounded no-progress/timeout; keep source/target/generation binding unchanged.

### C3 captured scheduled end — Green

All required current owners pass: app8tests/2whole files C3-scheduled-expiry-inner-green.log; native workflow5/5 C3-scheduled-expiry-outer-green.log; native runtime/protocol33/33 C3-captured-end-native-restored.log. Native-green.log is explicitly excluded because its extra protocol.test.ts path did not exist (DEF097); corrected existing heartbeat-protocol owner passes with all24runtime tests. No assertion or suite was skipped.

Server signs captured scheduledEnd in paid execution claims. Verification binds that end/resource/generation; official Pro permission anchors a local monotonic deadline while accepted manual permits keep no end. Runtime propagates the signed end and existing current-clip drain machinery waits for actual closure before terminal proof. Server end processing reuses owner-locked graceful drain; heartbeat prioritizes a draining admission over stale job desire/legacy access. Captured occurrence/end are never rewritten. New calendar dispatch remainsD1. A22/U22/U277DONE and T1018complete; C3overall still pending signed owner benefit metadata/source parity/browser/fullqualification. Next test-strength step checks a clock rollback during renewal cannot extend an already accepted scheduled deadline; fresh Start validity is separately bounded.

### C3 captured-end renewal — Red

A follow-up immutable-end sample uses a freshly signed nonce-bound renewal whose server issuedAt advanced10seconds while local monotonic time advanced60seconds. The absolute captured scheduledEnd is unchanged. At the originally accepted local deadline120000 the existing guard remainsactive, wrongly extending the scheduled window to170000. C3-end-renewal-inner-red.log1expected failure/3retained passes. This is a planned clock-boundary refinement, not an import/setup failure. Extracted signing fixture preserves prior cases, all passing. CON015registryRed and U277RED persist before correction. Required fix: retain the earliest accepted local scheduled deadline across renewals; Free renewal still follows persisted lease policy and manual paid execution stays unbounded.

### C3 captured-end renewal — Green/refactor

Official paid permission retains the earlier accepted monotonic scheduled deadline when a fresh signed renewal would move it later; Free lease renewal semantics remain unchanged, accepted manualPro staysunbounded. All4root policy/permission cases pass in C3-end-renewal-inner-green.log,33native runtime/protocol cases in native-green.log, and5native workflow scenarios in outer-green.log. Extracted signing fixture keeps prior assertions; no additional production refactor needed. Root/native type checks and scoped lint pass (C3-scheduled-end-types.log, native-types.log, lint.log). Snapshot validity/source resolution remains unbuilt and the next atomic contract is actual individual/bulk benefit metadata parity. No completedC3/fullfeature gate is claimed.

### C3 CON015/U151 — authoritative metadata parity Red

One individual/bulk parity behavior is sampled across the11already-defined Pro/trial/Runner-grant/agency source states, now checking source classification, exact known validity, stable capability revision, unrelated owner isolation and immutable raw entitlement history. The actual commercial probe imports the established capability module and reports an explicit unavailable boundary when the new metadata resolvers are missing. No import/setup/fixture failure qualifies. C3-benefit-metadata-inner-red.log has11expected missing-boundary failures and4retained policy/permission passes. CON015Red/U151RED persist before production.

Implementation ownership refinement: pure capabilities.ts exposes lazy async wrappers; new server-only runner/benefits.ts owns authorized-owner metadata reads and existing resolver reuse, avoiding DB initialization in pure policy/native callers. Individual reads honor the provided transaction. Bulk uses the existing bulk entitlement resolver unless a caller explicitly supplies its transaction. Keep Runner-only raw history untouched, include bounded grant/agency/known billing period deadlines, and preserve partner Pro grace without granting Runner-only grants Pro. No Stripe/network/billing writes.

### C3 CON015/U151 — source metadata parity Green

The complete capabilities owner passes15/15 in C3-benefit-metadata-inner-green.log. Eleven actual disposable-service source fixtures prove exact individual/bulk input and policy/revision equality, expected grant/agency/trial deadlines, correct source flags, unrelated-owner isolation and unchanged raw entitlement history. Earliest bounded active sources request future refresh; lifetime access remainsunbounded. Dedicated server-only benefits.ts reuses existing raw individual/bulk entitlement resolution, reads only the selected owners/global grants, honors explicit transaction clients, and returns new Runner benefit inputs without fabricating subscription or grant history. Capability module lazy wrappers keep DB loading out of pure/native policy imports.

U151DONE/CON015current executable ownerGreen. Additional billing-period/overlap and U275scope strength, signed owner snapshot/public delivery and fresh-start/local known-expiry enforcement remain required C3 work. No browser/currentfullcoverage/native-global/feature completion claim. New benefits.ts is critical and its whole-source policy gate remainsmandatory at C3qualification.

### C3 CON015/U275 — scoped metadata baseline

The complete capability owner passes18cases in C3-runner-only-metadata-baseline.log. Three additional source samples assert lifetime/bounded/agency Runner metadata has proAccessfalse and runnerAccesstrue while advancedRunner istrue, raw effectivePlan remainsFree/isBillingProfalse, unrelated owner staysbasic, and raw history is untouched. No production change was needed for these scope invariants after U151; honestBASELINE. All fourCON015inner aliases now have executed current contracts, with signed public metadata/start admission wiring still explicit T309work and no C3gatecomplete claim. Next boundary: known grant expiry must cap a fresh paid permit's acceptance window, while an already accepted manual generation survives expiry and a delayed activeACK.

### C3 known-expiry admission/permit boundary — Red before production

Real bounded Runner grant with no unrelatedPro enables a manualStart. The shared-service inner and actualMCP outer observe the captured admission, real signed permit, delayed response acceptance in officialProExecutionPermit, pending heartbeat at exact knownexpiry, attempted second admission, and delayed matching activeACK for output accepted beforeexpiry. Current source capturesvalidUntilnull instead of the exact stored deadline; new tests fail for that intended integration gap. C3-known-start-inner-red.log1fail/18pass; outer-red.log1fail/5pass. CON015/FR022Red and aliasesU276/U277/A22RED persist before code.

Minimum integration: resolve fresh Runner inputs inside the existing authorized owner transaction; use them for paid control/target limits and immutable admission capture. Cap a not-yet-acknowledged paid Start's short signed acceptance window at known validity. After that deadline never issue another fresh pending paid permit; preserve owner/generation-bound pending identity so officialv2cannot fall back to unsigned legacyexecution. Do not force-close possibly already accepted manual output merely because its activeACK was delayed: occupancy remains, and a matching dispatched paid activeACK may reconcile it after the acceptance window. Already active captured manual continuation remains authorized until normalStop; new admissions use currentFreepolicy. No externalbilling/email or hidden quota. Signedowner snapshot delivery remains subsequentwork.

### C3 known-expiry Start boundary — Green/refactor

Actual admissions now capture authoritative Runner policy/deadline inside the authorized owner transaction; Scheduled/new multi-target gates use it. Fresh pending paid permits expire no later than that known deadline. After expiry a pending device gets generation-bound identity with no fresh permit, preventing officialv2unsigned fallback while retaining occupancy and possibly already accepted manual execution. Matching dispatched paid activeACK may arrive after its short acceptance window; accepted manual continuation still gets its captured permit, while new admissions use currentFree limits. Scheduled captured ends retain their separate drain boundary.

Observed Green: C3-known-start-inner-green.log19pass and outer-green.log6pass. After sequential transaction-read refactor, inner-refactor19pass and outer-refactor6pass with no Pgdeprecation (DEF098Verified). Explicit fixture narrowing preserves signature/target/hash assertions and bulk owner-result checks; C3-known-start-narrowing-green.log44pass(19capability/25lease), C3-known-start-types-restored.log explicit TypeScript exit0 (DEF099Verified). Previous failed type evidence is retained and excluded. Current source static lint passes in C3-known-start-lint.log. No further production refactor required before next behavior.

A22/U276/U277DONE, current primary ownersGreen. Full signed owner-policy snapshot/public delivery/local cache, billing-overlap source strength, pure downgrade model, SC005browser and C3completecoverage/build/native/global gates remain open. Current qualified delivery stays12/23; effort estimate55%. No production billing/message/migration action.

### C3 signed owner policy — Red before production

Current executable evidence now separates mutable owner presentation/new-feature policy from immutable accepted execution. Root signature contract observes established protocol module but missing verifyRunnerBenefitSnapshot (explicit expected function assertion); its positive, scope, tamper and exact-validity assertions are materialized. The real heartbeat owner scenario requests signed paid policy before knownexpiry and signedFree attribution/baseline-standby policy at expiry while the accepted manual generation and lateACK continue. C3-owner-snapshot-inner-red.log1expected failure/19pass; outer-red.log1expected failure/6pass. RegistryCON015/FR022Red and A22RED persist before code.

Minimal implementation reuses the existing strict serialized-byte signature reader/keyring, signs fresh authorized-owner/device/request/revision policy under owner lock, clips snapshot horizon to seven days/known paid end, and exposes it to supportedv2heartbeats. A missing deployment signer may leave idle heartbeat health available with a null policy (no paid authorization); configured signers must verify. Private key provisioning is a later deployment action; local evidence uses ephemeral keys. Actual local monotonic policy caching/consumption is a subsequent atomic step, not claimed by server delivery alone.

### C3 signed owner delivery — Green/refactor

Shared strict exact-byte signature parsing now supports distinct benefits/execution kinds. Benefits verification binds owner/device/request/configuration revision, canonical required policy flags, source/revision/evaluation time, seven-day horizon and known paid end. Owner-locked signer rechecks current device credential and owner, resolves fresh metadata and returns only safe policy. Supported signed-negotiated heartbeat receives the snapshot; missing deployment signer yields null authorization for idle health, never a paid permit. Local tests use ephemeral keys only. Owner policy becomesFree at knownexpiry while accepted manualexecution continues.

Green:20root capability cases,33native runtime/protocol cases,7real workflows; after preserving full capability negotiation (DEF100), all31heartbeat regressions pass in C3-owner-snapshot-heartbeat-restored.log and7workflows in C3-owner-snapshot-negotiation-green.log. Do not use the failed heartbeat-regression log. Numericv2alone is not signed negotiation; legacy authorized assignment scope stays intact and current signed clients cannot fall back. Success metrics now record only after policy signing completes. Root/native explicit types pass. Local cache/clock consumption and subsequent source-strength/browser/fullgates remainpending; no C3checkpoint claim.

Follow-through before C3completion: add the admission-to-dispatch revocation race. A captured paid reservation must not receive a new fresh permit after authoritative revocation merely because its old validUntil was null; recheck current benefits before an unaccepted paid dispatch, preserve dispatched uncertainty/lateACK and accepted manual grandfathering, safely release only never-dispatched output. This is distinct from the completed known-deadline case and remainsunbuilt.

### C3 local owner cache — Red before production

Signed server delivery is Green before the next local-consumption behavior. Root guard contract explicitly fails because RunnerBenefitSnapshotGuard is missing from the established protocol module. It requires no paid authorization before validation, a request-send elapsed deadline, paid access just before/exactly at knownexpiry despite Date.now rollback, and rejection of a delayed response/new guard after that deadline. The actual snapshot workflow consumes its real server-produced profile through the same guard and observes cached paidBeforetrue/paidAfterfalse before receiving baseline policy. C3-owner-cache-inner-red.log1expected fail/20pass; outer-red.log1expected fail/6pass. Registry/aliasesRed before code.

Minimal next step is a pure local policy guard using existing signature validation and executionNow, without changing captured manual execution. Officialpoll integration and persistent cached scheduling/boot-safe restart handling remain explicit follow-through (D1owns persisted occurrence/cache behavior); no disk/restart guarantee is inferred from an in-memory guard.

### C3 local owner guard — Green

Whole capabilities owner21pass, native workflow7pass, native runtime/protocol33pass in C3-owner-cache-*-green.log. Local guard reuses strict signed snapshot verification, binds owner/device/request, anchors horizon to elapsed request-send time and returns no paid capability at exactexpiry despite PC Date.nowrollback. Delayed responses cannot reset that deadline. Invalid documents clear authorization; baseline/raw execution guards remain separate. No persisted restart guarantee is claimed; D1owns disk/cache occurrence lifecycle.

Before the next pure clock/security cycle, split the already-Green pure policy statements from the database-backed capability metadata owner. Preserve every original statement/test ID and run both whole owners once to prove the split. This is a structural test-ownership refinement, not a name filter or weakened gate. Both app owners plus native runtime remain oneCON015primary artifact; completedC3still requires all affected suites/coverage/browser/build/native gates. Officialpoll consumption, renewal rollback/revision edges, admission-to-dispatch revocation, billing-overlap samples and SC005remainunbuilt.

### C3 Green test-owner split verified

C3-policy-owner-split-green.log passes21tests in2complete owners, matching15actualmetadata/admission cases plus6pure policy/signature/clock cases. Every non-import TypeScript statement body was printer-canonicalized and multiset/hash-checked unchanged before splitting (C3-policy-owner-split.json); no assertion/criterion/ID removed, skipped or filtered. CON015registry and aggregate commands retain both app files plus the native runtime owner. Development pure loops now use the entire capability-policy.test.ts file without replaying the unchanged DBmatrix. Next atomic sample: a fresh signed policy refresh with a backward server clock cannot extend an already accepted known-end elapsed deadline.

### C3 same-end owner refresh — Red

With the Green split complete, the entire pure owner runs7cases in1.742seconds (no DBmatrix replay). A fresh signed owner profile retains the same known end but server issuedAt advances10seconds while client elapsed time advances30seconds. It is validly scoped/nonce-bound and accepted, yet the old cache remainspaid at its original60second deadline. C3-cache-refresh-inner-red.log1expected failure/6pass. CON015/U276Red before code. Preserve the earliest accepted elapsed anchor for the same known paid end; a new authoritative later validity may still renew access. No clock/input/assertion tolerance is widened.

### C3 same-end owner refresh — Green/refactor

Pure owner7/7 passes in1.018seconds; actual workflow7/7 remainsGreen in C3-cache-refresh-outer-green.log. Cache retains the earlier elapsed anchor for an unchanged known paid end, including across a refresh; new authoritative validity can still renew. No additional production refactor needed. Database-backed source/Start cases are unchanged and remain mandatory at C3milestone, not repeated for this pure guard leaf. Next security sample: after a fresh baseline policy, an older signed owner revision or issuance must not restore paid authorization.

### C3 policy ordering — Red

After a fresh signed baseline policy, a validly signed oldPaid policy must not restore authorization. Three samples cover a lower configuration revision, earlier issuance and equal timestamp/revision with a conflicting capability revision (cannot safely order it; failclosed until a fresh response). C3-cache-order-expanded-red.log has3intended failures/7retained passes; earlier2sample log retained. No import/setup failure and no production correction before this record. Preserve the latest accepted issuance/configuration/capability revision across invalid cache updates; ambiguous/stale responses grant no paid features and do not touch accepted manual execution.

### C3 policy ordering — Green/refactor

Pure owner10/10 and real expiry workflow7/7 pass. The local cache retains latest accepted issuance/configuration/capability revision independently of its current authorization object. Older or ambiguously same-time conflicting profiles returnfalse and cannot restore paid rights after baseline. Valid fresh newer profiles still work; known-end refresh remains bounded. No captured execution is stopped by cache rejection. No further production refactor needed. Next step integrates verified scope bootstrap/cache with official polling; credential/device identity must only be learned after a trusted nonce-bound snapshot, never unverified payload hints.

### C3 officialpoll scope/cache integration — Red before production

All required current entry points fail before implementation: pure scope-cache contract1fail/10pass; actualsource-preserving CLIpoll helper1fail/9pass because verified profile never triggers saveCredentials; actual cloud producer/native workflow1fail/6pass. Evidence C3-poll-cache-inner-red.log, native-red.log, outer-red.log. No unsupported export/import failure qualifies. Existing CLIadapter preserves/instruments the full original production source prefix; only interactive startup is adapted out, so this does not claim officialbinary startup.

Scope bootstrap must require a trusted owner/device/request signature, preserve existing credential/device pins, reject signed foreign-device rebinding, and clear new paid authorization on invalid/missing policy without affecting accepted execution. Officialpoll stores the cache per existing credential hash, learns device identity only after successful verification, and clears authorization on401. Both native CON015owners (runtime+heartbeat-protocol) remain required. Persistent restart caching/occurrence execution staysD1; no such guarantee is inferred from in-memory polling state.

### C3 official polling integration — Green

C3-poll-cache-inner-green.log passes11 pure policy cases; native-green passes34 runtime/real polling cases; outer-green passes7 actual workflow scenarios. Verified owner policy bootstraps credential-scoped device identity, invalid signatures cannot save it, signed foreign scope cannot rebind it, and missing policy clears paid authorization. Existing accepted execution remains separate. No extra refactor needed. The official packaged binary gate and persisted scheduling cache remain open. Next cycle addresses revocation between reservation and fresh permit issuance.

### C3 revocation before dispatch — intended Red

After test-fixture repair, C3-revocation-inner-restored-red.log has1 intended failure/15passes; outer-restored-red.log1 intended failure/7passes. A real lifetime Runner grant is revoked after actual Start reservation but before first heartbeat. Both observe a fresh paid permit (expectedfalse). Captured paid history remains true; no product source was changed before these Reds. DEF101 fixture scope is restored; static narrowing verification remains pending. Next minimal change: recheck authoritative current policy under the existing owner lock before unaccepted paid dispatch; release only a never-dispatched reservation, preserve dispatched uncertainty and accepted manual generations.

### C3 revocation before dispatch — Green

C3-revocation-inner-green.log passes41cases across actual metadata/admission and lease owners; outer-green passes8actual workflow scenarios. Under the existing owner lock, unaccepted paid dispatch resolves authoritative current benefits. A revoked never-dispatched reservation becomes failed_before_output and its session stops; another Free admission succeeds. A dispatched identity remains pending without a fresh permit, while accepted manual execution retains captured permissions. The isolated lease signing owner mocks its external entitlement resolver as paid; real source/revocation coverage remains in the actual database workflow. Formatting applied to three changed files; no semantic refactor yet. DEF101 runtime fixture correction verified; root static verification pending. Next sample must explicitly prove dispatched-uncertain revocation and late ACK remain intact.

### C3 dispatched revocation — baseline before mutant

Additional source/outer samples pass17inner/9workflow without another production change in C3-revocation-uncertain-*-baseline.log. They prove a grant revoked after dispatch yields pending bound identity/no fresh permit, retains occupancy, rejects a second Free admission, and accepts the original dispatched activeACK with captured manual continuation. A deliberate local mutant will bypass the fresh policy check only for already dispatched attempts, proving this new sample detects that unsafe reauthorization; restore source byte-for-byte afterward.

### C3 dispatched revocation — mutant killed and restored Green

C3-revocation-uncertain-mutant.log1expected failure/16passes: bypassing the fresh access check only for dispatched attempts incorrectly returns a paid permit. Source restored byte-for-byte from its pre-mutant copy (cmp exit0); complete owner17passes in C3-revocation-uncertain-restored-green.log. Actual outer owner9passes in uncertain-outer-baseline.log. No additional production change needed. Explicit root typecheck is Green and DEF101/102verified. Next cycle updates the retained pure downgrade contract to match approved Free basic Runner access; historic expectations of disabling/pause are superseded by this feature, while resource retention/read-only overlay restrictions remain asserted.

### C3 basic downgrade contract — Red

C3-basic-downgrade-inner-red.log6intended failures/9passes across the complete commercial-transition and original downgrade owners. New SC005 contract expects retained settings, basic Runner control and zero blanket runtime pause; previous raw runnerAccess=false expectations were deliberately updated to the approved Free-included requirement before production. Existing overlay read-only/resource retention/reordered-source assertions remain. Actual expiry workflow already proves no forced runtime suspension at its owning outer boundary. Minimal change removes blanket Runner disable/pause from the pure downgrade model; admission/execution guards remain the enforcement owners.

### C3 basic downgrade model — Green

Both complete owners pass15tests in C3-basic-downgrade-inner-green.log. Pure downgrade effects now retain basic Runner control and do not blanket-pause runtime; read-only paid overlay restrictions, all inventory retention, no deletion, idempotent reconciliation and source-order invariants remain asserted. No runtime migration or billing change. No further production refactor required. U40DONE; genuine SC005browser acceptance is next and remainsopen, so aggregate C3/story tasks are not complete.

### C3 diagnostic coverage / browser owner materialization

Five complete current owners pass68tests in C3-policy-coverage.log. This diagnostic producer is not a qualification: new benefits.ts is100%lines but91.93%statements/87.5%functions/84.12%branches, below its unchanged critical policy. Persisted billing-period/default resolver/explicit batch contracts remain to add; no threshold is reduced. Shared protocol80.8S/84.79B is also incomplete in this partial producer (complete native/other owning evidence still required). Lease91.03S/89.82B likewise awaits complete affected sources. Browser production build exits0 in C3-browser-build.log. New SC005browser owner is materialized at its original planned paths; initial basename selection also collected two existing native ATDD examples. Those incidental executions supply no new native qualification. Future slice command uses the full generated browser path to select exactly this whole browser owner; final routed browser gate already excludes /mcp-workflows/ through selectBrowserFiles.

### C3 SC005 real browser — retained baseline Green

C3-commercial-browser-save-restored.log passes exactly1genuine browser scenario in29.2seconds after the current production build. Actual authenticated customer starts with paid Runner-only grant and saved Scheduled session/destination; after persisted expiry, UI retains destination/history, disables Scheduled, explicitly saves Manual, enables Start, and billing offers included Runner without standalone purchase. Direct disposable storage assertions preserve original session/destination/grant identities. No production change was necessary for this already-correct browser boundary; honestBASELINE, not a setup failure relabeled as Red. Distinct inner pure downgrade requirement had valid Red/Green already. DEF103 hydration/consent sequencing and DEF104 action-completion wait are verified; earlier failed browser evidence excluded. Root types and scoped lint exit0 (C3-current-types.log/lint.log). Native full checkpoint coverage remainsrunning; metadata/security coverage gaps remainmandatory before C3qualification.

### C3 persisted billing metadata — baseline Green

Complete actual capability owner23passes in C3-billing-period-baseline.log. Six new source vectors cover active/trialing/past_due/canceled/expired/unbounded persisted Pro billing, including cancel-at-period-end without early loss. Individual/default/implicit-batch/explicit-transaction batch policies agree; empty batch is empty, unrelated creator remainsFree and raw billing/grant history is unchanged. Existing implementation already satisfies these contracts. A deliberate status-predicate mutant will prove the newly covered canceled subscription cannot authorize paid Runner; restore exact source before further work. Native checkpoint now passes190tests/37owners with1unchanged TODO; complete critical shared coverage is still not qualified.

### C3 billing metadata — mutant killed, exact restoration Green

Removing the persisted subscription status predicate produces1intended failure/22passes in C3-billing-period-status-mutant.log: canceled billing would authorize RunnerPro. Original benefits.ts restored byte-for-byte (cmp exit0), then complete actual owner23passes in C3-billing-period-restored-green.log. No billing/provider writes or production change needed for these retained source contracts. C3-native-policy-gate.json also passes ten current native sources, six strict critical services, unchanged thresholds, with190tests/37suites plus1retained TODO. Root shared protocol remains a separate policy owner and its diagnostic coverage gaps still need verification; no C3overall qualification claim.

### C3 signed policy negative documents — baseline

Twenty complementary signed-document boundary samples are materialized in the complete fast pure owner: foreign issuer/purpose, malformed scope/revision/time/horizon, inconsistent capability limits/source/evaluation/validity. Each starts with a valid trusted positive control and then signs the invalid document with the same ephemeral trusted key, so rejection cannot be explained by signature failure alone. No production edit precedes this run. These complement real producer/polling integration, not duplicate browser evidence.

### C3 signed policy purpose mutant — killed/restored

All31pure policy cases pass in C3-owner-document-negative-baseline.log. Removing only the benefits document-kind check makes the new cross-purpose case fail (1fail/30pass; C3-owner-document-purpose-mutant.log). Original protocol.ts restored byte-for-byte (cmp exit0); complete31case ownerGreen in C3-owner-document-restored-green.log. No production change required. The focused policy loop takes under1second test time; known source/default billing cases remain a separate23case actual DB owner. Proceed with current-source complete affected app and single-owner workflow coverage, while inspecting shared signed-codec coverage gaps from complementary owning producers. These checkpoints do not mark the feature complete.

### C3 coverage producer isolation

Current production checkpoint records13source SHA256 digests in /tmp/clipify-C3-source-digests.json; exact restoration of deliberate mutants is verified. An attempted diagnostic comparison of native-package protocol coverage and root protocol coverage found different statement/function/branch maps; no reports were merged. This is the expected stale/foreign counter-map guard doing its job, not passing gate evidence. Root owns the shared protocol policy and its current complete affected app/workflow producers must qualify it using matching maps. Native package's ten-source gate remains independently qualified; no protocol coverage is silently borrowed from its incompatible counter map. Workflow producer has430scenarios after nine C3 examples, with C2producer retained at coverage/runner-C2-qualified-workflows.

### D1 follow-through retained during C3 source freeze

Schedule dashboard controls currently derive paid availability from raw validateAuth entitlements. D1/D2 must consume authoritative current Runner policy/deadline for editor/target availability, including a persisted billing period ending before its webhook arrives; raw general Pro history must remain unchanged. C3 backend already enforces fresh policy for configuration/Start and signed native owner profile. Add the corresponding browser/API boundary before wiring the Agenda, alongside the already-recorded immutable source-revision/persisted cache follow-through. This is not a claim that future calendar UI or custom standby/attribution consumption exists yet. No source edit is made while current complete producers run.

### C3 final boundary to exercise before qualification

All430workflow scenarios pass in the current-source producer. Before C3completion, explicitly test a bounded paid reservation whose grant expires before its ACK and is then renewed: the still-commanded intent should obtain fresh authority for the same admission/generation using the renewed current deadline, without mutating captured history or creating another output. Current issuer rechecks fresh entitlement but also retains its captured known-end ceiling; this deserves a Red/Green check rather than assuming renewal works. The just-completed broad producer remains evidence for its exact frozen source; any resulting issuer change needs fresh owning workflow/current lease coverage before qualification. No renewed-generation behavior is marked implemented yet.

### C3 local clock/key safety — baseline and mutant strength

Complete fast policy owner33passes in C3-policy-clock-key-expanded-baseline.log. New contracts clear authorization when elapsed clock is invalid/unavailable, keep it cleared after clock recovery until verified refresh, reject invalid request timing, and learn no device identity with malformed trusted keys. Removing only cached-state clearing on clock exception makes the new recovery assertion fail (C3-policy-clock-state-mutant.log1fail/32pass). Source restored byte-for-byte and complete33owner passes in C3-policy-clock-state-restored-green.log. No production change required. Pure downgrade model coverage was outside the MCP manifest, so its original complete9case owner explicitly collects that source: C3-downgrade-model-coverage.log100%all metrics. No source/exclusion threshold changed. Current initial broad app668/31and430workflow producers have finished Green; source metadata benefits.ts reaches100%all metrics, while lease statements94.48%still below its unchanged95%critical minimum and renewal boundary still must be exercised.

### C3 renewed pending Start — intended Red

After DEF105fixture clock-shadow correction, inner-restored-red.log has1intended failure/23passes and outer-restored-red.log1intended failure/9passes: renewed access still produces no valid fresh permit. The actual source grant is renewed after its known deadline; the existing pending generation, captured history and repeated Start intent are inspected, with officialProExecutionPermit consuming returned authority. Initial setup failures are excluded. No issuer edit precedes these Reds. RegistryCON015/FR022Red. Minimal correction must cap fresh acceptance with authoritative current validity, preserve captured historical benefits, and reuse the existing admission/generation. Initial frozen diagnostic gate has only lease statements94.48%below95%; all other11source policies pass, with100%metadata/model. Do not label it qualified.

### C3 renewed pending Start — Green

Current24actual capability/source cases plus25lease cases pass49tests in C3-renewed-pending-inner-green.log; complete expiry workflow10passes in C3-renewed-pending-outer-green.log. Fresh pending permission now uses authoritative current paid validity rather than an expired historical ceiling. Captured benefits stay byte-equivalent; same admission/generation/lease binding is reused, officialProExecutionPermit accepts renewed authority, a repeated Start remains idempotent and only1admission exists. Accepted paid manual output retains its existing continuation; revoked/expired current access still cannot get a fresh permit. Removed the obsolete historical pending-expiry branch now superseded by current policy. No additional semantic refactor needed. DEF105fixture scope correction verified. Format/test-only refinements before final current lease/source coverage and owning workflows; no C3qualification yet.

### C3 unexpected media failure — DEF106 under repair

Fresh workflow run430passes/1failure (431total), excluded from qualification. Exact safe receiver/playback observations retained in C3-independent-media-failure-observations.json: one independent output closed with blue/no clip-ended, other completed green; both terminal receipts observed. Fixture playing previously meant receiver bytes only. Added real presentation snapshot started/non-ended readiness before its playing signal, keeping green/audio/ended/no-next/closed assertions unchanged and existing timeouts. Current complete multistream owner is running in C3-media-readiness-owner.log; BDD-US2-FR007Blocked until verified. Product source freeze remainsunchanged.

Mandatory next contract before C3qualification: distinguish refresh horizon from known paid validity in RunnerBenefitSnapshotGuard. For known paid end longer than a snapshot horizon (server max7days), healthy same-end refresh must extend only snapshot TTL while retaining its independent original known-end elapsed anchor. Current guard appears to store the shorter cached deadline as knownEnd.deadline, potentially pinning long-lived Pro access to first7days. Verify pure and actual monthly-source snapshot refresh before any implementation; same-end rollback protection and exact known-end expiry must remain. This contract remainsunbuilt and must not be lost.

### DEF106 media readiness — whole owner restored

C3-media-readiness-owner.log passes all5real media scenarios with original final-green/audio/clip-ended/no-next/closed assertions unchanged. CLI fixture now requires a real active presentation clip plus receiver transport before announcing playing, preserving the intended mid-clip Given despite asynchronous CLI apply/start. No product code changed, no timeout increased. DEF106scoped verification is Green; complete native workflow checkpoint still requires a fresh successful single-owner run, and the430/431failed producer remainsexcluded. Proceed to the previously recorded long known-validity versus snapshot-horizon contract before finalizing that run.

### C3 snapshot horizon versus known paid end — Red before production

Pure owner34cases has1expected failure/33passes in C3-policy-horizon-inner-red.log: a healthy same-end refresh is accepted but paid authorization dies at the original short snapshot horizon. Actual monthly-grant cloud producer/native cache workflow has1expected failure/10passes in outer-red.log: real signed seven-day refresh is accepted yet paidAfterFirstHorizonfalse. No setup/import failure and no policy edit precedes these Reds. Known validity may be longer than snapshot TTL; store its independent request-send elapsed deadline, preserve the earliest such anchor for the same known end, and bound each renewed snapshot by that anchor. Retain the existing same-end clock rollback and exact-end expiry tests. No user-facing quota is added; this is authorization freshness only.

### C3 independent freshness/paid-end anchors — Green

C3-policy-horizon-inner-green.log34passes, native-green.log34passes across both full native integration owners, and actual expiry workflow outer-green11passes. Guard stores the paid end's own request-send elapsed anchor, separately caps each snapshot's renewable freshness TTL, and retains the earliest same-end paid anchor across refresh. A real30day Runner grant stayspaid beyond its first7day snapshot after healthy refresh and expires exactly at knownend; existing clock-rollback/revision/request-scope/deadline checks remainGreen. No quota or output cut is introduced. No further semantic refactor needed. Formatting before new counters; source change affects shared protocol and requires fresh shared/native coverage plus the repaired complete workflow owner. Earlier430/431failed producer staysexcluded.

### C3 browser fixture review

The shared auth fixture defaults its user plan toPro for unrelated auth journeys. C1's two Free browser setup steps now explicitly set and assert that their own disposable creator startsFree before opening billing/onboarding, rather than relying on subsequent auth synchronization. No product source changes. Current qualified browser owner validates these stronger preconditions along with the existing legacy-expiry journey. The new ATDD owner now reuses the existing Runner browser expect budget (15seconds for ten-second dependencies), matching the shared Runner support; values/roles/persistence assertions remain unchanged. Earlier reload-loading failure is DEF107, not intended product Red.

### C3 current coverage/runtime/browser checkpoint Green, build closure pending

C3-final-scoped-gate.json passes all11root source policies with exact source/counter-map checks and stale/incompatible counters excluded. Current combined leaseS95.17/F100/L100/B94.47; shared protocolS98.99/F100/L100/B96.99; benefits/model100%allmetrics. Initial complete affected app668/31owners plus current owner replacements give672distinct current cases (pure31→34, actual source23→24; overlapping producers counted once). Current single-owner workflow432/432passes; native190/37plus1retained TODO and unchanged ten-source native gate pass. Fresh7commercial browser journeys pass, including explicitly Free billing/onboarding fixtures and legacy-expiry Manual recovery. Root/native types, global lint0errors/6existingwarnings, Highaudits and11migration checks pass. DEF107verified;107total defectsVerified (High3,Medium35,Low69), noneopen. Current production standalone build/action manifest and final formatting/evidence closure remain before C3qualification; full feature and official packaged platform gates stayopen.

### C3 qualified checkpoint

All C3affected gates pass. C3-final-scoped-gate.json validates11root sources with unchanged critical thresholds, exact source SHA256 and counter-map identity; new shared protocol and lease counters replace incompatible earlier versions. Combined current app evidence672distinct cases/31owners,432single-owner native workflows,190native cases/37owners plus1retained TODO, and7genuine commercial browser journeys. Source metadata/model100%all metrics; leaseS95.17/F100/L100/B94.47; shared protocolS98.99/F100/L100/B96.99. Ten native source gate C3-native-qualified-gate.json passes. Current E2E/standalone builds, both93-file action manifests, root/native explicit types, global lint0errors/6retainedwarnings,273changed-file formatting, High audits and11migration-policy checks pass. Evidence JSON formatting preserves parsed values for10reports; raw counter reports/logs remainuntouched. Known22job IDs processed,17existing disposable templates removed,0remaining for those IDs; foreign templates untouched (C3-template-cleanup.log).

All107recorded unexpected failures areVerified (High3,Medium35,Low69); no exception or deferred High/Critical. Failed/interim producers are excluded and retained, including the430/431media run. C1runtime21source digests remainunchanged; current browser fixtures explicitly establishFree. Official packaged/native platform/fingerprint gate T235 and integrated release gate T316 remainopen for the feature-final owner; helper/media evidence is not substituted for them. Global QG01–17remainPlanned/No-Go until all feature work completes.

Qualified delivery is now13/23slices (A1–A7,B1–B3,C1–C3), engineering effort approximately58%. Continue directly into D1schedule persistence/time/recurrence, then Agenda UI/local cached scheduling and generated-source watermark/custom standby. Retain authoritative dashboard paid-policy, persisted boot-safe cache, and immutable source-revision follow-through already recorded. No production migration, billing action, email, commit or deployment performed.

### D1 U125 authorization — Red

Command: `source /tmp/clipify-local-test-env.sh; MCP_TEST_TEMPLATE_ID=local-clipify-D1-permission bun run test --runInBand --runTestsByPath test/server/runner/schedules.test.ts --coverage=false`.

`D1-permission-service-red.log` records the authenticated actual-service failure: expected `code: ACCESS_DENIED`, received `code: RESOURCE_UNAVAILABLE`. The minimal service declaration contains no schedule identity, date or schema behavior. Initial unresolved-module setup failure is excluded from intended Red; the first action-availability observation is retained separately in `D1-permission-red.log`. Actual Better Auth session and persisted read-only organization role use the existing action harness. A125 outer action behavior is running in the complete owning workflow feature before the corresponding implementation. No schedule persistence or date changes precede T745/T751.

### D1 declaration/source reconciliation

`D1-artifact-reconciliation.json` records 130 unique US3 registry artifacts, all linked to the behavior list and all still Planned, with 63 BDD/ATDD role assignments and 67 inner owners. Compared every planned outer ID in the registry against the approved spec declarations in both directions: exact set agreement. T320–T368 approved declarations are present (including distinct ATDD T332); finalized without creating future unbound scenarios. Verified explicit multi-day, stable identity, title/duration and DST examples remain in approved source mappings. T369 closes declaration reconciliation only; no executable US3 evidence, persistence, date or schema task is complete. Existing defect/summary initialized; no open defects carried from C3.

A125 outer Red: complete owning workflow feature, `bunx playwright test --config playwright.mcp.config.ts --project=bdd-chromium mcp-workflows/runner-free-pro.feature --workers=1`, 45 passed / one intended missing action failure at `expect(result.available).toBe(true)`, received false. Authenticated session assertion passed. Evidence: `D1-permission-bdd-red.log`. Both required role failures precede minimal authorization implementation.

### D1 A125/U125 authorization — Green/refactor checkpoint

Whole owning service file passes (`D1-permission-service-green.log`); complete owning native workflow feature passes46/46 (`D1-permission-bdd-green.log`). Root types exit0 (`D1-permission-types.log`). Actual Server Action derives Better Auth principal, shared service uses existing creator/member/entitlement transaction locks and runner:update authority; expected denial returns a value with no successful mutation audit or Runner change. No independent authentication stack, permission bypass, calendar date logic or schema introduced. Refactor inspection retains the existing action error boundary and shared locked authorization. T079/T093/T922 complete for this permission behavior only; D1 overall remains unqualified.

### D1 technical test ownership refinement

Retain every planned actual-service case in `test/server/runner/schedules.test.ts`. Add the fast pure owner `test/server/runner/schedule-time.test.ts` for U234 arbitrary-revision identity and subsequent date-adapter leaf contracts, alongside the actual service and browser observers. It uses the existing Jest/fast-check stack. This avoids a PostgreSQL/Better Auth boot for each generated identity/date input; required service, browser, native and complete-slice gates are retained. BND/DEC browser bindings are in shared `runner-schedule-contracts.steps.ts` (existing boundary/manual steps remain untouched); the same registered BDD test fixture owns each scenario exactly once. No runtime feature, required ID, acceptance example or threshold removed. Only declaration stubs may precede the mandatory identity/date Red checkpoint.

### D1 required boundary/identity contract Red checkpoint — inner evidence

Whole `test/server/runner/schedules.test.ts`: 12 intended missing-persistence failures and one retained permission pass (`D1-boundary-identity-service-red.log`). Real authenticated session/source/session/target fixtures initialize successfully; each missing contract observes `saved: false`, not an import or database setup exception. Includes seven exact title/duration vectors and DEC004/005/006 with both Berlin dates. Pure U234 fast-check owner fails at `expect(first.length).toBeGreaterThan(0)`, expected >0, received0 (`D1-occurrence-key-red.log`), before identity implementation. This owner remains additional to the persisted move/recurrence-anchor/suppression-lookup observer. Outer browser bindings are running against the successfully built baseline; no calendar identity/date/schema implementation has begun. Do not mark T745 or T751 complete until all required outer evidence has completed and been inspected.

### D1 native calendar Red

`(cwd packages/runner) bun run test --runTestsByPath src/__tests__/schedule.test.ts test/bdd/runner-free-pro.test.ts --coverage=false`: four intended missing-planner failures / three existing real-output passes (`D1-native-calendar-red.log`). Existing forceExit runner policy retained. Both native owners use the production planner declaration; the outer Node/tsx process observes serialized skipped explanation/unique first instant, while inner controlled tests assert exact UTC end bounds, preserved inputs and later weekly local time. This D1 calendar boundary does not claim offline cache, scheduler admission, media Start or official packaged runtime evidence; those remain D3/SC003 and T235. Declare the installed date dependency directly before implementation; no library added for testing.

### D1 mandatory T745/T751 Red prerequisites satisfied

`D1-contract-browser-build.log` succeeds; whole owning browser feature files run20examples, nine retained passes and11 intended missing `Broadcast schedule` heading failures (`D1-contract-browser-red.log`). Inspected all11 error blocks: each fixture authenticated and reached current Stream Configuration before the missing product assertion. No import, service or Chromium failure counted as Red. Combined with all seven boundary/service vectors, exact DEC004/005/006 inner cases and U234 property Red, this satisfies required T745/T751 before any identity/date/schema implementation. Additional D1 persistence/validation browser contracts are running in their complete changed owner before schema/services; D1 overall remains Red/unqualified.

### D1 immutable key and native calendar planner — Green/refactor

U234 passes100 arbitrary identity/revision examples (`D1-occurrence-key-shared-green.log`): identity uses eventId plus immutable anchor, never revision, and event/anchor changes remain distinct. Shared native/root function prevents divergent identity rules. Persisted edit observer remains Red until storage exists.

Native EC007/EC008 complete owners pass7/7, including three existing real output cases (`D1-native-calendar-qualified-green.log`). After removing an unnecessary root tsx loader and using existing Node22/24 type stripping, the same whole owners pass7/7 (`D1-native-calendar-refactor-green.log`); native typecheck exits0. Installed @internationalized/date3.12.4 declared directly in both product manifests; both frozen offline lock-only checks pass. Existing native lock entries, before the added date/helper closure, hash exactly to C3's qualified native lock; root lock retains C3 entries plus one direct declaration. No unrelated version updates retained. Calendar planner skips nonexistent boundary times with an explanation, picks the earliest repeated instant, preserves later local weekly time and deduplicates identities. Scheduler/cache/output integration remains future work; these results qualify the calendar planner boundary only.

An initial Green-named command used an incorrect working-directory path and overlapped source preparation; that output is excluded. Fresh qualified/refactor results above are the retained evidence. No missing-path command counts as a product Red.

### D1 complete persistence Red matrix before schema

`D1-persistence-browser-red.log`: complete17-example browser owner, three existing manual/status passes and14 expected missing Broadcast schedule heading failures; inspected all14 locator failures. Includes FR011, EC006/011, once/weekly, all invalid options, midnight, timezone edits and DEC004/005/006. Earlier complete boundary owner independently covers all seven title/duration examples. `D1-persistence-matrix-red.log`: complete service/pure owners,30 missing-persistence failures and two retained permission/key passes. Actual fixture establishes owned source/session/target and verified principal before observing persistence unavailable. Internal matrix includes real rollback trigger, stale revision, concurrent overlap, weekly offsets and trusted-clock expansion; clock injection is a separate internal service argument, never public action input. Combined with native planner Red/Green, T399–T402 and T745/T751 prerequisites have run before new schedule tables or persistence code. D1 remains incomplete until exact same owners turn Green and pass required affected gates.

### D1 authoritative dashboard policy — intended Red

`D1-known-expiry-browser-red.log`: complete two-example ATDD owner, existing legacy-expiry pass/new known billing expiry failure: expected Scheduled disabled, received enabled while persisted users.plan remains Pro. `D1-policy-read-service-red.log`: whole current service/pure owners,32passes/one expected failure because list response lacks authoritative policy. Both Reds precede list policy metadata and dashboard wiring. Reuse existing resolved owner benefits, never reinterpret an operator's plan or fabricate unrelated Pro access. DEF110 records this previously planned C3→D1 follow-through.

### D1 legacy configuration policy follow-through — Red

`D1-legacy-policy-red.log`: complete current service/pure owners33passes/one intended failure. A real authenticated scalar configuration action accepts a new Scheduled configuration after the known billing end while raw users.plan remains Pro (`success:true`, expected `success:false,code:FEATURE_RESTRICTED`). This is the same paid capability policy at the legacy configuration boundary, not a missing tool or unrelated request. Reuse authoritative Runner benefits under its existing owner transaction; retain basic Manual capability and existing saved metadata.

### D1 malformed local values — intended Red

`D1-malformed-date-red.log`: complete actual service/pure owners,3expected failures/35retained passes. Invalid February30, malformed end date and25:00 throw from the once-window cross-field comparison after field refinements already reject them; direct observer reports UNEXPECTED_EXCEPTION instead of INVALID_INPUT, authenticated action reports SERVICE_UNAVAILABLE. Missing date is already a correct retained baseline, not an invented Red. Compare valid date/time fields only, preserving all field issues and business-result handling. No threshold, assertion or case removed.

### D1 signed schedule snapshot — Red

`D1-signed-cache-red.log`: complete actual service/pure owners38passes/one expected failure at `signedObserved.present`, received false. The additional contract cryptographically checks a versioned seven-day owner/device-bound snapshot with immutable source revision and selected targets; missing signer must yield no bundle, unknown device must not receive a signature, and expired benefits keep saved events but sign no future Starts. Test uses job-owned ephemeral Ed25519 keys and verifies exact returned bytes, not a mock signer. No signing implementation precedes this Red.

### D1 signed cache and shared signer — Green/refactor

D1-signed-cache-restored-green.log119passes in all five actual owning files, including39schedule/identity,25lease,31heartbeat and24owner-source tests. Exact returned signature verifies with the fixture public key; missing signer yields null bundle, unowned/nonexistent device cannot receive a signed cache, expired policy signs no future occurrences while retaining configuration. Existing lease/profile issuer shares the extracted server-only signing-key helper; unchanged output claims pass their whole owners. DEF113 command correction verified. D1-editor-current-browser-build.log succeeds; previous failed-path producer remains excluded.

### D1 legacy adapter error-code compatibility — test correction before implementation

The initial new known-expiry assertion unnecessarily assumed FEATURE_RESTRICTED at the legacy scalar action boundary. Existing TDD-US1-FR005 deliberately retains ENTITLEMENT_REQUIRED there while MCP returns FEATURE_RESTRICTED; both are normal returned policy denials. Preserve that existing API contract. Correct only the newer assertion to ENTITLEMENT_REQUIRED before restoring the implementation's public code, and run both complete owners to show the regression. Retain the authoritative benefit source and the required success:false denial; no original test, role or validation is weakened.

D1-legacy-code-compat-red.log: two expected code compatibility failures/50passes in all three whole owners; the original Free legacy case and the new expired-billing case both observe FEATURE_RESTRICTED instead of the established ENTITLEMENT_REQUIRED. Restore only the legacy adapter's normal return code; retain current owner benefit resolution and all MCP/new-resource error codes.

### D1 weekly occurrence membership identity — Red

`D1-weekly-identity-native-red.log`: one intended identity failure/two retained DST passes; removing Monday changes Wednesday suffix from :0:1 to :0:0. `D1-weekly-identity-service-red.log`: one corresponding persisted membership failure/39retained passes. Both tests also require advancing first enabled date to preserve the original recurrence epoch. Preserve an immutable calendar anchor and server-owned weekday slot identities, independent of list position and mutable first enabled date. Persist only the required weekday-anchor mapping alongside approved event fields; clients cannot supply/replace these identities. This implements DEC004's existing stable weekly-anchor requirement, adds no feature or acceptance ID and precedes the schema amendment.

### D1 weekly identity — Green

D1-weekly-identity-service-green.log40/40 and D1-weekly-identity-native-green.log8/8 whole owners. Persist server-owned weekday slot anchors; retain matching slots and the original calendar epoch as first enabled date changes. Native fallback uses weekday identity rather than list index. Actual saved member removal and date advancement retain Wednesday's key; existing once move/suppression, arbitrary revision property, DST and output-recovery contracts remain Green. Snapshot revision includes stored anchors. No generated migration created; refresh disposable browser schema before current browser verification.

F1 integration follow-through discovered during source review: comprehensive account data export currently enumerates only legacy Runner/session content. Include the new owned destinations, schedule/join/admission data and eventual branding/assets in its existing private export at the final integration slice, with owning isolation/redaction/credential tests first. Keep whole-feature No-Go until this and the previously recorded immutable admitted source-revision follow-through are resolved. This note does not claim export coverage or alter existing role mappings.

### D1 schedule-only destination reference — Red

D1-schedule-reference-red.log: one intended failure/40retained passes. Actual authenticated deletion returns success for a destination selected only by a schedule, and the join cascades away. This extends existing CON005 reference preservation to the newly introduced schedule join; public error already instructs removing schedule references. Query both kinds under the same existing owner lock and return normal RESOURCE_IN_USE plus safe referenced IDs. No original destination behavior is weakened.

### D1 coverage-driven retained boundary characterization

D1-initial-affected-coverage.log171/171 in seven whole owners; initial new calendar coverage has eight passes but only75.67% branches, so it does not satisfy the unchanged critical gate. Add required once/all-day/half-open/invalid-window/horizon and optional-anchor examples to the existing native owner. D1-calendar-boundary-baselines.log19/19 proves these are honest retained Green cases, without invented Reds or production edits. An initial command selected the app runner for a native path; D1-calendar-boundary-wrong-runner-excluded.log is excluded setup evidence, and the correct package owner is the retained result.

D1-security-boundary-baselines.log56/56 actual service/property cases characterizes invalid/foreign inputs, unknown resource references, default internal clock versus forbidden public clock injection, an empty owned calendar, disabled overlapping drafts, a paid-end-clipped signature and normal rejection of expired calendar edits. State comparisons include direct event rows, target joins and success audits. These are retained working branches; no production change or artificial Red. New pure calendar/file coverage is collected separately from application probe counters. Current sources frozen in D1-initial-source-sha256.json. Browser ownership proves persistence/validation here; real local scheduled output/cache/restart/continuity remains unbuilt D3–D5 and full-story SC003 stays Planned.

### D1 current browser and persistence checkpoint — Green, wider slice gate pending

D1-editor-final-browser-build.log succeeds from the weekday-anchor schema, current signer/legacy policy and reference guard; a fresh guarded browser database was initialized from source (no migration/push). D1-final-browser-green.log32/32 in the complete three relevant browser owners: all seven explicit title/duration bounds, real form saves/reloads, source/target choice, once/weekly dates, multi-week/DST, identity edits, rollback and both expiry paths. Keyboard Space replaces only the hidden-input fixture click. All113 defects Verified. T752 and D1 implementation/binding tasks can close; T409/T671 remain open until complete affected/coverage/static gates qualify current source.

Calendar editor form/list foundation lives in runnerSchedule.tsx because D1's browser persistence boundary requires it. The actual HeroUI Pro Agenda grid, viewport segmentation, gestures, mobile day view and richer controller remain D2, not claimed here. Supported MCP controlMode/schema bindings already use the shared owner Runner policy from C3; this slice adds no new MCP tool/privilege or duplicate billing logic. Full scheduled execution/offline restart/drain/continuity remains D3–D5 and SC003 remains Planned.

D1 boundary coverage checkpoint: D1-boundary-coverage.log56/56, schedules.ts99.45%statements/100%functions/100%lines/98.5%branches; shared signer retains100%all metrics in the preceding171-case producer and is merged only with identical maps. D1-calendar-boundary-coverage.log19/19, schedule-calendar.ts and schedule.ts100%all metrics. No thresholds lowered. D1-old-owned-template-cleanup.json records10exact prior-schema D1 templates removed; current/foreign templates retained. Current browser32/32; complete affected/native/workflow and static qualification still pending.

### D1 loader lifecycle — deliberate Red before request fencing

As part of the asynchronous subscription refactor, remove the new initial-load generation guard before adding its separate behavior test. D1-loader-lifecycle-red.log observes one intended failure: after unmount the pending old-owner response calls onPolicyChange once, expected zero. It proves the observable parent-policy effect, not React's ignored unmounted local state. Reapply the minimal captured-generation guard; use the captured generation in cleanup to avoid the new ref warning, with no lint suppression. This is additional FR011 controller evidence, not duplicated browser geometry or an invented import Red.

### D1 current-source qualification in progress

D1-loader-dto-restored-green.log57/57 restores service/property/controller owners after the static refactor. D1-global-lint-qualified.log has zero errors and the six inherited warnings. D1-qualified-source-format.log passes all selected production/test/manifests. D1-qualified-native-coverage.log211pass/38owners plus one unchanged TODO; D1-native-qualified-gate.json passes all twelve current native module thresholds, including100% calendar/schedule coverage. Native types, root types, root High audit and11migration-policy cases pass. Native package has no audit:high script: D1-qualified-native-audit.log is excluded command evidence; the explicit identical audit invocation succeeds in D1-qualified-native-audit-restored.log. No product failure or intended Red claimed for a missing script. Current app coverage,433 workflow scenarios and32 browser scenarios are still executing. T409/T671 remain open.

### D1 qualified — calendar persistence and signed metadata

T409/T671 complete after D1-final-scoped-gate-restored.log/json returns ok:true. Current affected app729/34 plus one additional retained terminal-closure case =730distinct app tests. The lease26-case and downgrade9-case reruns replace their same owners, not additional counted suites. Workflow433/433, native211/38plus1unchangedTODO and browser32/32 pass. Native critical/calendar coverage and root current-source counter maps meet unchanged thresholds. Root/native types,global lint0errors/6inheritedwarnings,source formatting,High audits,11migration-policy cases,current E2E and standalone builds and both93-file action manifests qualify. DEF114/115 Verified; all115defects closed. Earlier failed coverage gate and missing native audit script excluded; final current producers qualify.

D1 remains metadata/calendar persistence, not local schedule execution. D2 Agenda gestures/accessibility and locks/resume follow next; D3–D5 runtime/cache/continuity and E1–E4 presentation remain unbuilt. No feature release/SC003 claim. Qualified14/23slices;554/1018task markers, approximate effort65%.

### D2 begins — mobile viewport identity first

D2-viewport-projection-red.log proves one intended missing-behavior failure: a cross-week event produces zero segments instead of seven. The seam is importable and typed; failure is not a missing module. This inner criterion belongs to the pure Agenda viewport adapter owner (runnerSchedulePlanner.test.ts), rather than a server-only service test: true bounds and segment identity are client projection contracts. Registry/test list updated without changing the criterion. Outer DEC009 real browser example is materialized; baseline E2E build is running before the production projection/UI change. No future slice tests added.


D2-mobile-calendar-red.log: one intended outer Red after authenticated persisted vacation event succeeds, missing Broadcast calendar region at360px. Pure projection now1/1Green (D2-viewport-projection-green.log); first installed Agenda component/typecheck succeeds. Full outer Green pending current build. No movement/resizing/output/runtime completion claimed.

D2 DEC009 current Red–Green checkpoint: D2-mobile-calendar-green.log1/1 from current build; D2-component-harness-restored.log2/2; scoped Agenda lint and types pass. Seven daily visual segments share true bounds/identity;360px mobile day navigation and explicit form dates pass without page overflow. Installed Agenda only measures wall-clock hour/minute within each day, so display-only midnight segments end at the final local millisecond; exact exclusive UTC end is retained separately and never saved from clipped geometry. No output end/cached permission is shortened. DEF116Verified. D2 slice remains open; next behavior is pointer creation.


D2 desktop viewport Red: D2-week-locale-red.log authenticated event persists and all seven installed day columns exist, but Sunday segment is missing because adapter assumes Monday while Agenda uses locale. Replace hardcoded locale with the identical installed useLocale context; no vendor patch. Capture desktop/mobile screenshots during restored owning browser cases for visual review. This is an intended test-first extension of DEC009; original mobile proof is retained.

D2 DEC009 desktop/mobile viewport cycle restored: D2-locale-calendar-green.log2/2, current build and scoped lint pass. Both retained PNG screenshots visually inspected: installed day/week grids are present, labels/navigation usable; event labels truncate within narrow week columns while full event details remain available. Next cycle is actual pointer creation, with explicit form alternative retained.

D2 pointer-create intended Reds: pure draft seam returns null instead of18:00–20:00 explicit fields; validated real pointer endpoints hit2027-01-04 but no editor opens. D2-pointer-create-validated-red.log is owning outer Red; initial unvalidated output excluded under DEF117. Wire actual useAgenda onEventCreate to the existing form, preserving source/target defaults and authoritative service saves. Inner owner moved to pure client adapter because the tested contract translates Agenda CalendarDateTime values, not server authorization.

D2 pointer-create cycle Green: D2-pointer-create-inner-green.log3/3; D2-pointer-create-browser-green.log3/3 including both viewport regressions; current build/typecheck and scoped lint pass. Selected18:00–20:00 range opens the existing explicit-date form, preserves owned source/targets, commits through the same service and appears in saved schedules. DEF117Verified; all117recorded defects closed. TDD-US3-OPT020/keyboard/move/resize/delete/active/resume and fullD2qualification remain open; primary FR010 completion is not fullslice completion.

D2 active-edit intended Reds: D2-active-edit-inner-red.log55baselinepasses/one newfailure, actual shared service and verified action accept current-window move/resize/config changes. D2-active-edit-browser-red.log real current-window row has enabled Edit. Add server owner-lock guard and explicit normal ACTIVE_OCCURRENCE_LOCKED result; include informational lockedUntil in safe DTO, disable per-event form/Agenda edits. This first cycle covers the original active time window; captured drain/suppression/delete/resume extensions remain pending and no fullDEC007completion claimed.

D2 current-window lock Green: D2-active-edit-inner-green.log60/60 acrossfourwholeowners, resource-errors16/16, D2-active-edit-browser-green.log4/4,currentbuild/lint pass. DEC007 remains incomplete until drain/suppression/delete boundaries qualify. Next intended Reds: D2-drain-lock-inner-red.log56baselinepasses/one newfailure and D2-drain-lock-browser-red.log one expected enabled-Edit failure after the nominal window ended but captured state is draining. Extend owner-scoped admission-backed locks through terminal closure; no heartbeat/deadline auto-release. Retained server tests already prove terminal closure permits editing after the original end.

D2 captured-drain cycle Green: D2-drain-lock-inner-green.log61/61, D2-drain-lock-browser-green.log5/5 including viewport/create/current-window regressions,currentbuild/lint pass. Current original window is locked; persisted captured generations remain locked through output drain after nominal end, terminal closure permits editing. DEC007 remains incomplete for deletion/suppression/resume. Continue into explicit schedule deletion with tests first.

D2 deletion intended Reds: D2-delete-inner-red.log3newfailures/57baselines for future deletion/stale action revision/active deletion; D2-delete-browser-red.log2missing-Delete-control failures after both real editor open routes. Add an explicit visibility assertion before interacting with the missing button to avoid waiting a full action timeout in future Reds (same required control, no weaker assertion). Implement owner-authorized Pro calendar deletion under revision/active/captured locks, FK cascade plus one atomic deletion audit; reuse the existing ConfirmModal for pointer/keyboard confirmation. No source or destination deletion.

D2 deletion Green checkpoint: D2-delete-inner-green.log64/64, D2-delete-browser-green.log7/7,currentbuild and scopedlint pass. One owner-authorized transactional deletion removes only event/joins and records one audit. Pointer and keyboard confirm using existing ConfirmModal; stale/active deletions do not write. No new source/target deletion. Next cycle is logical interval movement; fullD2slice gates remain open.

D2 movement Reds/baselines: D2-move-inner-red-baselines.log2 intended pure adapter failures/63retainedpasses, including positive keyboard action. D2-move-browser-red-baseline.log pointer Red with verified drag hit geometry and keyboard Green with no product change. Move actual interval by calendar day/minute delta in the same display/source timezone; use full original UTC bounds converted to local, never clipped segment duration. Weekly/cross-zone gestures open explicit editor without guessing a series change. Stable logical id and owner/CAS service remain authoritative. U63/A63 honest BASELINE; no fabricated retrospective Red.

DEF118 unexpected movement integration failure: D2-move-browser-green.log8/9, old12:00 replaces expected13:00 after validated drag. Stop adding next behavior tests; route selection through installed Agenda onEventSelect/drag suppression rather than independent child click. Keep accessible native button and controlled-null selection to allow repeated activation. Existing pure/server67Green proof is unchanged; restored current browser/build/lint pending.

D2 movement cycle restored: D2-move-click-restored-browser.log9/9,currentbuild/lint plus unchanged67focusedcases qualify current behavior. DEF118Verified. All118defects closed; D2slice stillopen. Begin resize test-first, retaining existing keyboard form resize as a baseline if already correct.

D2 resize intended Reds: D2-resize-inner-red-baselines.log2purefailures/67baselines; pointer browser missing real handle while keyboard passes in D2-resize-browser-red-baseline.log. Continuation/date-editor baseline passes before production (D2-continuation-keyboard-baseline.log1/1): no clipped end exposed, full cross-week date edit preserves identity/start. Implement actual installed resize callback using true start and real proposed end; hide only continuation handles via scoped CSS module. Installed Next CSS Modules guide read. Preserve keyboard path as honest BASELINE; no invented initial Red. Explicit fallback guidance for weekly/cross-zone gestures remains to verify before finalD2qualification.

D2 resize cycle Green: D2-resize-inner-green.log71/71, D2-resize-browser-green.log12/12,currentbuild and scopedlint pass. Actual installed resize handle changes real end only; local CSS module hides clipped continuation handles while move remains available. Original cross-week dates can be extended by keyboard without shortening other bounds or replacing id. Keyboard resize remains honest BASELINE. RemainingD2authoring baseline aliases and explicit ambiguous-gesture guidance precede original-window Stop/Resume boundary integration. No fullD2qualification or actual offline scheduled execution claimed.

D2 retained authoring baseline checkpoint: D2-authoring-inner-baselines.log75/75; keyboard creation and pointer/keyboard metadata browser cases pass in D2-authoring-browser-baselines-guidance-red.log before product edits. No invented initial Red. Separate guidance case for another timezone fails for missing notice as intended; weekly fixture times out at a guessed exact Recurrence name, corrected to the already verified accessible-name suffix under DEF119. Do not count setup timeout as product Red; re-run weekly before guidance implementation.

D2 explicit-editor guidance intended Reds: D2-ambiguous-gesture-validated-red.log2/2 fail only at missing plain-language notice, after corrected real weekly/cross-zone gestures open full original fields. Add contextual non-error status in the existing dialog, reset it on every new edit, and pass it only when an unambiguous translated interval is unavailable. No save/resize/series guess or business-error throw; current authoring baseline75cases alreadyGreen. DEF119setup correction reaches intended product boundary; final current17browser scenarios pending.

D2 authoring/guidance Green checkpoint: D2-guidance-inner-green.log75/75,D2-guidance-browser-green.log17/17,currentbuild/lint pass. All eleven primary authoring roles have owning Green/retained BASELINE; T432/T433complete. DEF119Verified;119defects allclosed. DEC008and exact activation examples stillpending; no D2slicequalification. For existing activation-minus1ms/exact boundary characterizations, introduce a trusted internal clock dependency as a refactor while existing tests are Green; do not fabricate a product Red for already-correct half-open comparisons. Default clock must be sampled after owner lock, never frozen at action entry.

D2-activation-boundary-baselines.log78/78: before-start minus1ms edit succeeds, exact-start save/delete deny with no event/join/success-audit changes. Existing half-open rule is honest BASELINE; trusted clock injection is a testability refactor, sampled after owner/event lock. No public clock field/argument forwarded. U214drain-after-end remains DONE from genuine D2-drain-lock Red/Green through terminal closure. Proceed to the missing explicit Resume boundary; no fabricated activation Red.

D2 explicit Resume intended Reds: D2-resume-inner-observed-red.log69baselines/3failures for missing original-end/occurrence binding, accepted exact-end reopen, and legacy thrown recovery denial. Observer catches only the exact known legacy denial to assert normal-result behavior; interrupted producer excluded under DEF120. Outer missing Resume control proven in D2-resume-browser-red.log. Extend existing shared control with optional occurrence scope; default clock sampled after owner/session lock. Add explicit UI through authenticated action and shared authority. Metadata guards are not full scheduled runtime: per-event private target payload and immutable-source lease consumption remain D3 integration work before SC003 can qualify. Stop/suppression/cache markers remain next DEC008 cycle.

### D2 Resume implementation — inner Green; outer verification in flight

D2-resume-inner-green.log: all four whole-file owners pass81/81. D2-resume-build.log completes the actual E2E build. D2-resume-lint.log has no diagnostics. D2-resume-business-errors-green.log12/12 and D2-resume-resource-errors-green.log16/16 pass. The Scheduled Running path now resolves its original half-open occurrence under owner/session locks, rejects exact-end starts normally, rejects a pending prior drain normally, and atomically binds the new admission to the occurrence/end. Resume UI sends the explicit occurrence and CAS revision and does not claim live output. Per-event private targets and captured source lease consumption remain a D3 prerequisite; this checkpoint does not qualify runtime scheduling. D2-resume-browser-green.log is running18 current Agenda scenarios; do not treat it as passed until completion.

### D2 explicit Resume — Green/refactor checkpoint

D2-resume-settled-browser-green.log1/1 proves the actual authenticated action after waiting for semantic success feedback. Together with the retained17 current-source Agenda cases in D2-resume-browser-green.log, all18 current scenarios have passed. DEF120 and DEF121 Verified. Inner81/81, build, scoped lint and business/public-error owners are Green. U210/U211 DONE; A174/U190 and their aggregate artifacts remain in progress until durable manual Stop suppression is proven. No redundant full-suite run or product change for fixture synchronization.

### D2 DEC008 Stop suppression — validated Red

D2-stop-suppression-inner-validated-red.log:72 existing cases pass,2 active/reserved Stop cases fail only because benefits_at_start lacks scheduleSuppressed. D2-stop-suppression-browser-validated-red.log:2 actual browser Stop examples reach the same missing marker after semantic Stop requested feedback. Both retain Scheduled, original occurrence/end and expected drain/cancel states. DEF122 setup batch excluded; corrected explicit enum casts verified to reach intended assertions. Add only the durable captured-occurrence marker in the same owner-locked Stop transaction; local journal/cache enforcement remains subsequent work.

### D2 Stop marker — inner Green, browser build in flight

D2-stop-suppression-inner-green.log83/83 passes all four whole-file owners after the minimal transaction change. Owner Stop now sets scheduleSuppressed on a captured nonterminal occurrence before drain/cancel. This safe nonsecret marker persists independently of terminalReason, which terminal acknowledgments may replace; explicit Resume creates a separate higher-revision admission. No new schema/migration or parallel scheduler store. Current E2E build is running; do not qualify the outer behavior until real browser examples pass. Native suppression/cache consumers remain mandatory subsequent work.

### D2 Stop marker — Green/refactor checkpoint

D2-stop-suppression-browser-green.log3/3 proves actual authenticated Stop for dispatched and reserved captures, and retains the prior explicit Resume journey. Inner83/83, build and scoped lint are Green. D2 safe Stop intent is durable across the original occurrence and does not claim output closure. Next cycle binds that intent into signed schedule metadata and proves newer explicit Resume supersedes only its own occurrence; actual offline journal/scheduler execution remains D3/D4.

### D2 signed suppression handoff — Red

D2-suppression-cache-inner-red.log74 existing cases pass, one missing-metadata Red: verified Ed25519 schedule claims lack executionRevision and suppressed. The same real service observer reads signed metadata after actual explicit Resume and both Stop states. Add only nonsecret latest-per-occurrence execution intent, ordered by monotonic admission configuration revision, not random IDs. This is signed configuration intent, not execution permission or a substitute for the D3 local journal.

### D2 signed suppression handoff — Green/refactor checkpoint

D2-suppression-cache-inner-green.log84/84 across all four whole-file owners. Actual signed metadata now derives latest execution intent from owner/device-scoped captured occurrences ordered by configuration revision. Explicit Resume11 supersedes stopped9 only for that immutable occurrence; active/reserved Stop yields signed suppressed:true without changing the end. Snapshot revision includes this safe intent; no credentials enter claims. Native offline validation/journal/runtime remain D3–D5. Proceed to completed-D2 affected qualification; retain global No-Go until whole feature gates complete.

### D2 adapter coverage gap resolved without product changes

The full planner owner now12/12 with100%S/B/F/L (D2-qualified-planner-restored-coverage.log). DEF123 Verified. This replaces the same owner's earlier7case execution, adding only5distinct current cases. D2-qualified-remediation-input-sha256.json records its updated test hash; every other frozen D2 qualification input remains unchanged. No source mutation during running app/workflow/browser producers. The failed bun run lint invocation is excluded tool-command evidence because this repository names the script app:lint; actual D2-qualified-app-lint.log finishes with0errors/6inheritedwarnings. Audit and11migration-policy cases pass; current E2E action manifest93files and app types pass.

### D2 transition fixture repair before qualification restart

D2-transition-fixture-restored.log6/6 verifies DEF124 fix. Actual Start now captures the real event bounds; its canonical target identity remains byte-equivalent to the old expected hash. No production code changes. Interrupt earlier app/workflow producers and retain their logs as D2-initial-affected-coverage-interrupted.log and D2-initial-workflows-interrupted.log; these never qualify the gate. New workflow raw directory is fresh. Update supplemental fixture fingerprint. Restart complete current owning coverage at four workers per producer under fresh job IDs. The52-case browser producer continues against identical product sources/bindings.

### D2 responsive controls — deterministic Red before polling fix

D2-polling-overlap-red.log renders actual RunnerPage with settled initial data, holds one telemetry getRunner promise, advances8s and observes5calls rather than2. Existing50/52browser result separately records pending move/resize saves under load; no expected policy denial is thrown. DEF125 opens after comparison with isolated CI browser job and installed Next sequential-dispatch guide. Bound one telemetry batch in flight; do not alter save semantics/timeouts or restart unaffected server coverage producers for a client-only source change. Their covered sources/owning fixtures remain unchanged; supplement the client page with its own tests and rebuilt complete browser owner.

### D2 polling fix — inner Green, current browser rebuild next

D2-polling-overlap-green.log1/1 proves the actual page no longer queues telemetry and resumes refresh after completion, with unmount cleanup retained. Existing page poll now has one in-flight guard and finally release; no new helper or production test seam. DEF125 Fixed pending outer. Server app/workflow probes do not import RunnerPage and all their covered production modules/fixtures remain unchanged. Supplement current client-page/test hashes and its additional owner rather than restarting unrelated server producers. Retain first browser50/52 as failed pre-fix evidence; require rebuilt current-source browser evidence before T672.

### D2 coverage/mutation checkpoint before final browser qualification

All16 current server modules pass D2-scoped-coverage-qualified.json after fresh9case explicit wrapper collection; the attempted old wrapper retention is not used because old configuration hashes were absent. Planner100% and native77input+3baseline-config identity checks pass. Three deliberate faults(end guard removed, Stop marker false, older admission revision selected) are killed by their whole75case owner; all sources restore exactly and D2-mutation-restored-green.log90/90 passes. Current browser rebuild is complete,93-file manifest and types pass; full52current-source browser journeys are executing. T672 and all global feature gates remain open.

### D1 task-marker reconciliation; no new implementation percentage claimed

Read-only alias audit finds33unchecked markers for already-qualified D1 work:24BDDalias verification tasks,8atomic internal cases and the7boundary rerun checkpoint T746. Every corresponding artifact isGreen and behaviorDONE/honestBASELINE. Retained D1 qualification plus current804affected cases and90restored scoped cases confirm these contracts; current rebuilt browser boundary cases have also passed. Complete those33markers without inventing scenarios or rerunning successful owners. This corrects tracking only, not another slice or new effort completion. Detailed task/criterion audit is D2-D1-alias-reconciliation-audit.json.

D2 qualified checkpoint: T754/T435/T436 and all15 acceptance gates pass with current-source D2-final-scoped-gate.json. Current owning results:805distinct affected app tests/40owners,433workflow examples,52real browser journeys,211unchanged native cases/38owners +1existing TODO. Three deliberate mutants killed and sources restored;90/90restoration checks. Explicit current production/E2E builds,93-file manifests, app types, lint/format/security/migration gates pass. Refactor checkpoint retains these same successful inputs; no speculative refactor. T672 complete;15/23slices qualified. Offline execution remains D3–D5 and feature/global gates remain open. DEF125 verified by all52unchanged browser journeys; no timeout/retry/assertion weakening.

D3 first inner prerequisite: existing journal atomic-write/terminal behavior passes15cases in D3-journal-existing-baseline.log; no artificial Red. Added a scheduled-capture persistence contract through existing save/get APIs. D3-journal-occurrence-red.log fails only because the journal drops immutable occurrence bounds after restart, before production edits. No import/setup failure. U256 cleanup and full CON008 remain open until their own execution.

D3 CON008 inner cycles: active scheduled occurrence capture Red (bounds dropped), Green16/16; retention U256 Red (old acknowledged terminal not removed), Green17/17; suppression U257 Red (marker dropped), Green18/18. Evidence D3-journal-{occurrence,retention,suppression}-{red,green}.log. Journal atomically retains immutable occurrence start/end and Stop marker, never ages active or unacknowledged output, and protects acknowledged suppression through original window plus seven-day retention. Explicit Resume requires a new admission, so the old stopped capture cannot be rewritten. No secrets enter the journal. Full cache/signature and outer runtime cases remain pending; CON008 is still Red/in progress, not artifact Green. Existing atomic replacement case remains honest baseline, not a fabricated failure.

D3 Stop transition inner prerequisite: D3-journal-stop-red.log rejects legitimate active -> suppressed/draining write; smallest monotonic-marker fix yields D3-journal-stop-green.log19/19. Occurrence ID/start/end remain immutable; suppression may become true but cannot revert. Native typecheck passes in D3-journal-native-types.log. New nested metadata uses defensive deep copies. Formatting changed no semantics. Runtime wiring, signed cache checks and outer acceptance remain open.

D3 per-event target prerequisite Red: D3-event-target-capture-red.log75existing cases pass and one new canonical Start capture case fails with default target ID instead of event-selected ID. Real authenticated service, isolated loopback PG and persisted admission observer; no import/setup failure. Fix must preserve manual defaults and validate event-owned target credentials without fallback.

D3 source permit prerequisite: D3-event-source-permit-red.log76existing tests pass and one new service assertion fails: scheduled permit uses manual source/revision instead of captured event source. Minimal lease lookup/binding fix yields D3-event-source-permit-green.log77/77. Event-selected source and its accepted revision now bind signed claims and response metadata. Actual authenticated heartbeat source/secret delivery has its separate executable boundary next; this is not offline scheduler acceptance.

D3 scheduled heartbeat prerequisite: D3-event-source-heartbeat-red.log77existing tests pass, actual authenticated POST delivers manual overlay/secret despite the event-bound permit; minimal owner-scoped captured-source lookup yields D3-event-source-heartbeat-green.log109/109 across schedules and heartbeat whole owners. D3 manual renewal prerequisite (pulled forward from final integration): D3-manual-source-renewal-red.log78existing pass, styling revision unexpectedly changes the same execution binding; capturing source identity/revision on every canonical new reservation yields D3-manual-source-renewal-green.log110/110. Historical admissions preserve compatibility fallback; no schema or migration generated. Current D3 cache/runtime acceptance is not yet Green.

D3 bounded cache authorization prerequisite: D3-cache-authorization-red.log fails because the existing verifier rejects a distinct scheduled_execution purpose. Minimal opt-in contract adds occurrence/start/end and private executionPayloadHash binding with a seven-day maximum; ordinary execution permits still require their original kind and five-minute maximum. D3-cache-authorization-green.log54/54 and D3-cache-validation-baseline.log70/70 pass;16negative purpose/scope/hash/signature/expiry cases are honest retained defensive baselines, not fabricated Reds. This is validation support, not issuance or offline dispatch. DEF126 was only a nonexistent secondary owner path; real three-owner rerun verifies it.

D3 cached start boundary prerequisite: D3-cache-window-permission-red.log allows a verified future cached permit too early; expected false, observed true. Minimal monotonic original-window gate blocks pre-start and end-or-later acceptance while preserving original end/drain. D3-cache-window-permission-green.log reruns complete schedule/runtime/polling owners. Durable cache anchors, private payload storage, owner-locked issuance and actual local offline output remain unbuilt; no D3 qualification claimed.

D3 cached output consumption prerequisite: D3-cache-output-consumption-red.log24existing runtime tests pass and an in-window cached start remains rejected; smallest explicit cache binding plus private payload digest gives D3-cache-output-consumption-green.log91/91 across four real native owners. Before-start rejection, one engine start, persisted original occurrence bounds, exact-end graceful drain and terminal receipt are observed through the actual controller. D3-cache-output-stop-red.log then observes missing suppression before drain; smallest explicit Stop marker persistence yields D3-cache-output-stop-green.log92/92. stopAll/process shutdown remains distinct from explicit occurrence Stop. Five private source/capture/mode tamper vectors are retained security baselines in D3-cache-payload-baselines.log, not claimed new Reds. There is still no server future-permit issuance, cache store or official polling/tick dispatch; A12/U12 and full CON008 remain incomplete.

D3 device issuance prerequisite: D3-device-cache-issuance-red.log79existing tests pass; real capable-device heartbeat has no scheduleCache. D3-device-cache-issuance-green.log80/80 passes after owner/device/token-locked issuance, fresh paid policy, owned source/target capture, explicit schedule_cache negotiation, purpose-separated signed authorization and signed enclosing manifest. Calendar metadata construction is shared without fabricating a creator principal. Added authorized admission state and excluded it only from the one-physical-execution partial unique index; all pending authority remains conservatively occupied. No desired/actual session Start is fabricated and no generated migration is created. Follow-on query/closure/reconciliation cases are mandatory before D3 qualification.

D3 future edit boundary: D3-future-authorization-edit-red.log80existing cases pass and future authorization prematurely locks its event; minimal started-window filter yields D3-future-authorization-edit-green.log81/81. Activated potential authority remains conservatively locked until explicit closure/bounded recovery. Future-cache/source/target edits and authorized-vs-current session reservations require their own remaining cases; no full checkpoint yet.

D3 future/current reservation distinction: D3-future-authorization-reservation-red.log81existing pass; Manual Start incorrectly returns a future authorized row and fails to create physical reservation. Minimal exclusion in existing-admission reuse yields D3-future-authorization-reservation-green.log82/82. Future authorizations remain occupied for owner quota and intact alongside a separate reserved manual generation. Current-window unknown authority, Stop isolation and reconnect proofs remain required before qualification.

D3 unused-authority reconciliation: D3-authorized-terminal-reconciliation-red.log87existing pass; matching terminal proof for authorized is ignored. Minimal state recognition and separate-physical-output check yields D3-authorized-terminal-reconciliation-green.log119/119 across schedules+heartbeat. A future authority ACK cannot change desired/actual/revision of a newer manual execution. These are fresh assigned-device receipts, not revoked-token capabilities; revoked routing still requires separate reconciliation work.

D3 local journal/cache prerequisites: D3-pending-occurrence-journal-red.log rejects pending occurrence identity; Green introduces pending state without claiming active output or closure. D3-occurrence-suppression-floor-red.log fails to mark all already-known generations; Green atomically scopes suppression by owner/device/logical occurrence. D3-suppressed-pending-output-red.log shows the existing deep journal invariant blocks a suppressed pending start by throwing; minimal controller guard returns normal false before any journal/output mutation, with Green whole owners. D3-output-stop-suppression-floor-red.log leaves a newer already-cached pending generation unsuppressed; wiring the atomic occurrence operation gives D3-output-stop-suppression-floor-green.log. Private cache storage/freshness, restart and official polling remain open; no full D3 artifact completion claimed.


D3 revoked local cache — Red/Green: D3-revoked-schedule-cache-red.log has13 passing cases and one failed official-CLI boundary: the watchdog starts cached output after401. Delete the context before awaiting shutdown, invalidate memory and remove the signed snapshot, without allowing filesystem errors to skip output shutdown. D3-revoked-schedule-cache-green.log passes116 cases across all four current native owners. This is scoped development evidence; D3 remains unqualified.

D3 server future-authority revocation — Red: D3-future-authorization-revoke-red.log has90 existing passing cases and one failed transaction observer. Promoting every cached future authorization to draining violates the physical-session uniqueness constraint. The observer catches only that exact PostgreSQL constraint, rolls back, and does not mask other errors. Keep future authority authorized with revocation and terminal-credential tombstones; only physical output becomes draining. Green validation is in progress.


D3 server revocation — scoped Green: D3-future-authorization-revoke-green.log122/122 across schedules and heartbeat confirms revoked future authorities remain authorized tombstones while exactly one physical execution drains. D3-revoked-future-terminal-red.log then has9 existing passing cases and one failing session-mutation check; the matching terminal handler now checks other physical output under the owner lock. D3-revoked-future-terminal-green.log10/10. No revoked credentials gain Start/read/renewal authority.

D3 bounded cached recovery — Red: D3-cached-authority-recovery-red.log91 existing cases pass and expired authorized authority remains occupied indefinitely. The implementation uses the later of persisted authority expiry and original scheduled end plus305seconds, never heartbeat age. Separate physical session output must survive future-authority cleanup. Broader schedules/admission/terminal whole-file validation is in progress.

D3 Stop storage failure — Red/Green: D3-stop-suppression-storage-red.log32 existing cases pass but a suppression write failure prevents physical drain. Catch only at the shutdown boundary and retain in-memory suppression so physical output closes before storage retry; D3-stop-suppression-storage-green.log65/65. A stronger recovery check then exposes another known pending generation lacking suppression in D3-stop-suppression-retry-red.log. Retry the occurrence-wide atomic write after output closure and before claiming terminal persistence; keep the closed execution pending for retry if this fails. Green owner validation in progress. No IO failure fabricates closure or drops terminal evidence.


D3 bounded recovery — scoped Green: D3-cached-authority-recovery-green.log169/169 across complete schedules, admission and terminal owners. Existing nonleased legacy and indefinite paid Manual recovery denials remain Green. Source formatting afterwards is semantic-only; final D3 qualification must use final source fingerprints.

D3 Stop isolation — Red/Green: D3-scheduled-stop-future-isolation-red.log92 existing cases pass and explicit Scheduled Stop suppresses unrelated future authorized occurrences. Scope the suppression to physical captures and the currently open original window, including any known authorized generation for that same occurrence. D3-scheduled-stop-future-isolation-green.log124/124 across schedules and heartbeat. Future authority remains occupied and revocable, without pretending it is current output.

D3 shutdown storage retry — Green: D3-stop-suppression-retry-green.log65/65 verifies drain precedes storage retry and all known pending generations receive the same occurrence Stop. D3-cached-online-restart-red.log33 existing pass and a fresh normal online permit drops immutable occurrence journal metadata, triggering the deep identity guard. Preserve the persisted occurrence only when its original end matches the verified job, leaving signature and nonce checks unchanged. D3-cached-online-restart-green.log118/118 across all four current native owners. D3-scheduler-current-app-types.log and D3-scheduler-current-native-types.log finish without diagnostics.

D3 real-media acceptance materialization: extend the existing single-owner drain fixture with purpose-separated protected cache storage and restore, before-start rejection, verified original-window start, and cached end expiry. It retains the real production Engine, Chromium display capture, FFmpeg encoding and production presentation drain bridge. No extra BDD evidence is assigned to an existing workflow scenario. The new native owner is test/bdd/runner-cached-schedule.test.ts; first execution is an honest existing-code acceptance baseline, not a manufactured product Red. Official packaged startup remains a separate outstanding gate.

D3 real-media scoped acceptance baseline passes: D3-cached-schedule-real-media-baseline.log1/1 proves signed protected cache restore with control unavailable, pre-start rejection, real local Chromium/FFmpeg media, original-end graceful drain, final green encoded frame, no next clip and closed outputs. A12 BASELINE is honest because the inner Red/Green implementation existed before this owner materialized; U12 DONE derives from the earlier cache/CLI/controller Red/Green evidence. U144/U254/U255 retain honest BASELINE from D3-journal-existing-baseline.log, D3-cache-atomic-replacement-baseline.log and D3-cache-invalid-restore-baselines.log (whole-file logs retained). Source paths now name executable owners. Only test-materialization/run and atomic prerequisite task markers are completed; T444/T445/T449/T809/T673 and full registry artifacts remain open for final lifecycle and qualification.

D3 current-window uncertainty — Red/Green: D3-unknown-cached-output-contract-red.log93 existing cases pass and competing Manual Start is incorrectly reserved while a preauthorized occurrence could already be broadcasting offline. The initial D3-unknown-cached-output-red.log used the human service envelope on a direct internal result; correct the assertion to the internal typed error before the production change. Inject the existing trusted command clock through admission, recover only eligible bounded authority, and return normal RUNNER_RECOVERY_REQUIRED for an occupied in-window cached attempt. D3-unknown-cached-output-green.log125/125 passes schedules+heartbeat. Native negotiation Red D3-cache-capability-negotiation-red.log then proves missing advertised support; advertise schedule_cache only with the implemented consumer and bounded closure handling. D3-cache-capability-negotiation-green.log123/123 passes all four owners.

D3 unused cached authority — Red/Green: D3-unused-authority-closure-red.log14 existing CLI cases pass and a never-opened ended occurrence fails to queue closure. Reconcile only pending entries with trusted signed server time or durable suppression, preserve every starting/active/draining identity, register terminal delivery and prune only acknowledged records. D3-unused-authority-closure-green.log119/119 and D3-unused-authority-closure-boundaries.log36/36 pass. The four additional state/owner/time boundaries are honest baselines.

D3 candidate native milestone: D3-native-candidate-inputs.json freezes all native source/test/config inputs before one complete package coverage run, D3-native-candidate-coverage.log. No current-source claim is made until it completes and explicit changed-path thresholds pass. App/server candidate fingerprints and a prepared affected-owner command are separate; no prior D2 server counters qualify modified D3 code.

D3 complete native candidate: D3-native-candidate-coverage.log39whole-file owners/267passed/1unchangedTODO finishes in186.566seconds. D3-native-candidate-inputs.json81inputs still match exactly. The initial diagnostic gate correctly remains false: native protocol counters cannot independently satisfy its root-owned critical gate, and the new cache module lacks validation coverage. Shared protocol ownership remains the root instrumented application report, exactly as D2; do not merge incompatible native/root protocol maps or weaken its95/90 critical gate. Add33 distinct malformed-cache/private-fallback/boot-failure baselines in one new validation owner; no product code changes and no fabricated Reds. D3-cache-storage-recovery-baselines.log33/33 and D3-cache-remediation-coverage.log69/69 complete the two whole-file remediation owners. Native counter maps match exactly before merge. D3-native-merged-gate.json passes the unchanged native critical thresholds, including private schedule-cache98.51%S/94.38%B/100%F/L; shared protocol's root gate remains pending. This adds33distinct cases to the267 rather than counting the repeated36journal cases twice. Supplemental source/test/config hashes are D3-native-remediation-inputs.json. Full D3 gate remains open for app/workflows/browser/static/build/mutation evidence.

D3 static correction: the first explicit app types command was still in flight when its log was initially inspected. It eventually reports the two new observer enum assignments (DEF128); preserve that failure. Add type-only StreamState assertions, changing no production/generated JavaScript behavior. D3-candidate-app-types-restored.log exits0; D3-candidate-native-types-restored.log exits0 includes the new validation owner. D3-fixture-enum-owner-restored.log94/94 supplies fresh whole-owner evidence. D3-candidate-browser-build.log exits0 with its own passed TypeScript phase; D3-candidate-action-manifest.log93files passes. No app build remains running before browser execution.

D3 browser owner selection: the initial filename-only filter selected100cases by also matching nested native workflow aliases. Interrupt that producer (D3-initial-browser-selection-interrupted.log,2passed/1interrupted/97notrun) and exclude all its counts. DEF129 tracks this command defect. Restrict to direct generated bdd/atdd runner-free-pro and runner-boundaries files; D3-corrected-browser-inventory.log proves52tests in3files before the corrected D3-candidate-browser.log execution. The native workflow lane retains sole ownership of its433scenarios.

D3 qualification remediation: the initial full browser run passes51/52; persistence assertions for1440minutes succeed before the reload times out at Loading schedule. DEF132 retains the raw failure and observed UI context. CI browser-tests is a separate matrix job with its own PostgreSQL/server; the local failed run overlapped heavy app and workflow producers. The isolated exact case passes in D3-browser-reload-isolated-diagnostic.log1/1 without changing timeouts or product code. Require a complete isolated rebuilt browser owner before final qualification. The initial binary attachments were cleaned by the next Playwright invocation before copying; do not claim they remain available.

D3 coverage fixtures: initial supplemental denial data used an impossible Scheduled/fallback combination(DEF133), then an unsupported source enum(DEF135). Both were stopped and retained as fixture/setup failures, never product Reds. The valid source enum is Paused; keep the DB clip-only constraint. D3-cache-input-denials-valid-baselines.log99/99 passes; malformed public Delete/Resume service inputs are also normal typed failure baselines. D3-critical-final-boundaries-coverage.log103schedule/38lease cases passes. The new lease empty-observation test initially omitted its client argument(DEF136); corrected whole owner38/38 passes without production changes.

D3 root compilation coverage: a supplemental direct Jest43case command fails unrelated inherited full-root inventory(DEF134). The correct partial-lane command passes43/43 and its fresh map is merged only with identical counter maps. New cached-purpose and monotonic binding cases complement the native consumer under the root application's compilation. D3-current-root-coverage-gate.log passes all current required paths at unchanged95/90critical thresholds; old pre-format schedules/lease maps are explicitly excluded, not rebased. The complete fresh admission/transition owner73/73 supplies current lease evidence. No successful unrelated app/workflow owner is repeated.

D3 mutation strength: D3-mutation-results.json records three killed correctness faults: remove manifest-to-authorization digest binding, remove the cached original-start guard, and stop deleting revoked signed snapshots. Each whole owner fails on the intended assertion, every source restores exactly, and D3-mutations-restored-green.log157/157 passes all five current native owners. The new manifest-binding case signs both documents validly with a mismatched digest, avoiding a confounded invalid-signature test. No mutant survives or remains in the workspace.

D3 completed qualification: D3-qualified-browser.log52/52 passes isolated after the full833case/40owner application producer and433workflow lane complete. Final current-source supplementation gives897distinct app cases/41owners and301distinct native cases/40owners plus one unchanged TODO. D3-final-scoped-gate.json verifies all coverage/source/input identity, current types/lint/format/build/93-file manifest, three killed/restored mutants, and real cached-media acceptance. All136defectsVerified. Complete only T444/T445/T809/T449/T673; D3 is16/23qualified slices. Continue directly into D4 after this Green/refactor checkpoint. No final feature/release completion claimed.

### D4 — U206/U207 first boundary
Whole owner `bun run --cwd packages/runner test --runTestsByPath src/__tests__/drain.test.ts --coverage=false`: 15 pass, 1 intended Red. At 59,999 ms playback remains alive; at 60,000 ms physical browser closes, but playback-timeout outcome is undefined. Evidence: `evidence/D4-no-progress-red.log`. Add a typed engine outcome before connecting it to terminal reporting; this partial cycle does not qualify D4.

### D4 — bounded drain and durable timeout result
`D4-no-progress-green.log`: 16/16 owner cases pass after engine records typed drain outcome. `D4-overrun-baseline.log`: 17/17 pass; U208/U209 retain honest existing 299,999/300,000 ms behavior, with new timeout outcome assertion. `D4-timeout-receipt-red.log`: 34 pass, one intended missing-behavior Red: controller terminal receipt drops the timeout result. Next change preserves the finite outcome through the journal and restart. D4 remains unqualified.

### D4 — timeout result and stalled RPC cycles Green
`D4-timeout-receipt-green.log` passes88cases across drain/runtime/journal after preserving the finite playback outcome durably. `D4-server-outcome-green.log` passes71root cases, accepting only known outcomes and persisting matching timeout as terminalReason. DEF137 tracks the corrected unrelated fixture failure. `D4-hung-presentation-red.log` reproduces the real hanging-RPC watchdog bypass; `D4-hung-presentation-green.log` passes89cases after browser calls share the existing watchdog deadline and clear their timers. Outer runtime/UI evidence and the full D4 gate remain pending; no slice completion claimed.

### D4 — durable unlinked delivery and dashboard message
`D4-retired-outcome-red.log` proves retired-device delivery drops timeout, followed by its minimal finite-outcome addition. `D4-retired-server-red.log` proves the matching revoked terminal service loses reason, followed by minimal terminalReason preservation. `D4-terminal-schema-red.log` proves both finite outcomes fail strict endpoint parsing; the endpoint now accepts only the two optional known values. `D4-visible-timeout-red.log` proves no safe session error is retained, and `D4-visible-timeout-green.log` passes103cases across four root owners after session errors are persisted only when no competing physical admission exists. `D4-timeout-ui-red.log` proves absent alert; `D4-timeout-ui-green.log` passes15cases across controls/actions/polling after adding safe finite timeout presentation. Native types pass in `D4-development-native-types.log` before subsequent delivery/UI changes; rerun required. No D4 checkpoint claimed.

### D4 — atomic progress, not a completed slice
`D4-crossfade-baseline.log` passes57whole-overlay cases: U261 cancellation is honestly retained BASELINE. U206/U208 existing just-before-deadline safety is BASELINE; U207/U209 new typed timeout completion is DONE with initial Red and whole native owner Green. `D4-native-development-green.log`:98cases/5owners pass, including live OBS closure retaining null generated-playback outcome (`D4-live-stop-outcome-red.log` then minimal correction). `D4-development-native-types-v2.log` passes. Current media timeout fixture is still under DEF138; do not qualify A31 or mark the shared CON010 artifact Green while its other atomic behaviors remain pending.

### D4 — retained clip/generation boundaries and corrected outer timeout
`D4-stale-completion-baseline.log` passes20drain cases: retired bridge completion does not stop the replacement Engine; U262 retained BASELINE. `D4-clip-boundary-baseline.log` passes21drain cases: progressing current clip survives the illustrative final minute and closes only on its completion; U13 retained BASELINE. `D4-timeout-runtime-green.log` passes6complete real-media/calendar owner cases; DEF138 now Verified. `D4-development-app-types.log` and native v2 types both pass. New awake cached-start acceptance is being materialized through the actual250ms CLI watchdog plus real Engine/Chromium/FFmpeg, replacing only interactive startup with exports; no official packaged startup claim is made.

### D4 — awake-start acceptance and inner window baseline
`D4-watchdog-atdd-baseline.log`:1/1 actual-watchdog media acceptance passes, including startDelay<=30000ms, no early start, final encoded clip frame, no next clip and all resources closed. `D4-start-window-unit-baseline.log`:39/39schedule cases preserve original end across start-window polling and prohibit renewal after the boundary. A38/U38 retained honest BASELINE. Ownership executes unchanged CLI helper bodies through exports and protected verified cache; aliases isolate only local dependencies/home/keyring/logger/trusted clock, not scheduler/controller/media behavior. This is acceptance integration, not official packaged startup proof. Final-source whole-owner/milestone refresh remains required after fixture changes.

### D4 — in-window advancement and exact-end race
`D4-before-end-runtime-baseline.log`:8/8whole native BDD owner cases pass including advancing to a second clip while the signed scheduled window is open, then draining at its original end. `D4-before-end-unit-baseline.log`:22/22drain cases preserve pre-end advancement; U78 retained BASELINE. `D4-maximum-runtime-baseline.log`:7/7previous owning runtime cases pass, including continuously progressing long media with a100x injected trusted monotonic clock hitting the300-second limit. No product timeout is shortened. Next atomic exact-end behavior has intended unit Red in `D4-exact-end-unit-red.log` (canAdvance wrongly true atdeadline), `D4-player-clock-red.log` (no renderer deadline translation), and `D4-signed-player-deadline-red.log` (verified controller omits playerdeadline). Outer exact-end fixture currently requires DEF140 repair before its valid intended Red; production remains unchanged for this behavior.

### D4 — valid exact-end Red retained before implementation
`D4-exact-end-valid-runtime-red.log`:8pass,1intendedRed; current clip finishes and its final frame is encoded, but nextClipStarted is true at the exact end. `D4-exact-end-armed-probe.log` independently shows the next index starts before native drain. DEF140 setup repair is now verified; initial setup failures remain excluded. Complementary bridge, signed runtime policy, native-to-browser clock mapping and actual React integration Red artifacts are retained before changing production. The smallest fix adds a scheduled deadline to the existing bridge and carries only verified Pro scheduled authority into it.

### D4 — exact-end cycle Green and next no-progress precision Red
`D4-exact-end-runtime-green.log`:11/11real-media cases across3wholeowners pass, including OPT039, cached scheduling and actual-watchdog acceptance. Native101/101, overlay58/58and app/native types pass. Exact-end original Red is resolved without shortening the broadcast window. Next same-slice internal watchdog precision case `D4-delayed-snapshot-red.log`: first snapshot resolves at59,999ms, but unchanged playback is still not closed at60,000ms because its baseline resets the progress timer and the poll sleep overshoots. Expected closure assertion fails before the smallest correction; no new outer acceptance owner is required for this internal latency detail.

### D4 — tracking refresh before remaining feedback/gate work
Completed materialization tasks and source mappings now reflect the verified exact boundaries, shared after-end acceptance and watchdog outcomes. Shared acceptance labels use the single ATDD real-media owner as documented in plan.md. `D4-delayed-snapshot-green.log` passes87cases after the first sample no longer resets the no-progress budget and polling sleeps respect remaining deadline. U31/U79/U116/U117 are DONE; retained baseline contracts remain explicitly BASELINE. Registry Green records owning behavior results, not slice qualification: finishing feedback, standby owner and all current-source D4 gates remain open. No D5 progression authorized until T674 passes.

### D4 — standby baseline and explicit Stop outcome
`D4-standby-baseline.log` passes35whole native unit/runtime cases including real signed scheduled standby closure with no next clip, no playback timeout and all capture/encoder/browser resources closed; A81/U81 are retained BASELINE. Next `D4-emergency-outcome-red.log` proves an explicit Stop-now interrupt incorrectly inherits playback_timeout from the unfinished drain loop. The minimal correction retains a timeout only when generated playback is still running at its watchdog/completion decision; caller-requested physical shutdown preserves no timeout. Same whole drain owner rerun follows.

### D4 — finishing feedback, protected reconciliation and recovery alert cycles
`D4-emergency-outcome-green.log`:66cases/3owners pass; explicit Stop-now closes once without timeout. `D4-finishing-report-red.log` then `D4-finishing-report-green.log`: controller emits nonterminal draining while physical closure is pending, never allOutputsClosed. `D4-finishing-service-red.log` then service Green: matching admission remains draining/occupied and desired stopped/actual running exposes existing finishing UI. `D4-finishing-schema-red.log` then `D4-finishing-schema-green.log`:77cases/3owners pass with finite draining schema. `D4-cached-finishing-red.log` then Green handles the first reconnect report after original end; `D4-finishing-guards-baseline.log`53cases rejects12invalid/future/suppressed/late/conflicting cases without mutation. `D4-clear-timeout-red.log` then Green55/55 clears only a known prior timeout after verified healthy active output. `D4-persisted-finishing-baseline.log`104/104 actual PostgreSQL owner cases verify pending occupied state, repeated-report idempotence and terminal-only physical closure under rollback isolation. No generated schema/migration artifact was added. Full current-source milestone gates remain pending; the reported effort estimate is now82%,16/23qualified slices.

### D4 milestone fixture remediation — current producer identities

The first complete native candidate produced 325 passing tests, one unexpected watchdog-fixture failure and one inherited TODO. DEF142 diagnosis proved premature result publication, rather than a product shutdown failure: the fixture invoked a single tick against a submillisecond restored-clock boundary. The fixed fixture awaits the real 250ms watchdog and matching durable physical-closure receipt before publishing. Its complete ATDD owner passes (22.103s). DEF141 removes four unused observer parameters without removing argument assertions. No production source changed. The ten complete affected owners are executing with coverage; unchanged candidate owners and source hashes are retained explicitly, and the failed candidate is not qualification evidence. Root app/workflow producers use unchanged inputs and continue. The native candidate coverage evaluator meets unchanged thresholds, but this alone cannot qualify a failed test run.

### D4 completed behavior and refactor checkpoint (milestone browser still running)

All D4 intended Red and subsequent whole-owner Green runs are retained above. Current complete execution: app1008cases/46owners, native326pass+1inheritedTODO/41owners (ten affected owners replaced after DEF141/142), workflow433. Explicit direct downgrade collection15cases restores missing source coverage without adding distinct cases; DEF143Verified. Coverage gates pass at unchanged thresholds. Three correctness faults are killed for the expected assertion/watchdog behavior and restored exactly, followed by whole-file Green26native/55root. Current build/types/format/lint/93-file action manifest pass. No further structural refactor is warranted; no production change follows these successful gates. Complete behavior/refactor/acceptance-source tasks; T674 remains open pending isolated52-case browser qualification. No D5 executable behavior is added before that gate.


### D4 qualification complete — continue into D5

`D4-qualified-browser.log` passes52/52 isolated real browser journeys (10.8m). `D4-final-scoped-gate.json` verifies exact current source/input hashes,1008distinct app cases/46owners,326native cases/41owners plus1inheritedTODO,433workflow scenarios, unchanged coverage thresholds, three killed/restored mutants, current types/lint/format/build/93-file action manifest and eight retained dependency/policy inputs. All143canonical defects are Verified. T674 is now Green; D4 is17/23qualified delivery slices. Overall estimated implementation effort is approximately83%. Continue into D5 immediately; no release or whole-feature completion claimed.


### D5 first outer handoff behavior — test Given under validation

Added one FR014 real-CLI watchdog case only, using two adjacent separately signed cached authorizations and distinct actual output paths. The first whole-file execution `D5-handoff-outer-red.log` passes11/11, which is not counted as intended Red. Diagnostic `D5-handoff-diagnostic.log` proves readiness was reached at11.534s/12s and next Chromium startup could hide early dispatch. DEF144 records the weak Given. Revised fixture retains the actual final marker for seven seconds after end and observes both next execution activation and its encoder opening; it awaits next startup before clearing the real watchdog, avoiding a fixture-owned missed tick after first closure. `D5-handoff-valid-outer-red.log` is executing against unchanged production source. No production behavior is changed until valid Red exists.

### D5 FR014 — physical handoff barrier Red to implementation

Valid outer Red: `D5-handoff-valid-outer-red.log`,10pass/1failure, next execution and encoder open before first current clip completion. Controlled inner Red: `D5-handoff-inner-red.log`,39pass/1failure, apply returns true while prior scheduled physical closure is unresolved and not journaled. DEF144 is Verified from the corrected outer Given. Add the smallest controller barrier only after both Reds: new verified cached scheduled admissions wait while any previous scheduled execution remains physically owned by this Runner's controller; normal existing renewal and independent manual Pro broadcasts retain their paths. The actual watchdog retries after durable closure and existing signed-window verification rejects expired successors. No extension of signed deadlines or false terminal proof is introduced. Complementary expiry/concurrency/continuity cases remain subsequent cycles; D5 is not qualified yet.


D5 FR014 inner Green: `D5-handoff-inner-green.log` passes79cases across complete execution-runtime and calendar owners. Native types pass in `D5-handoff-native-types.log`. The distinct internal test verifies no following engine creation or journal mutation before first closure, durable stopped proof before subsequent admission, and exactly one later start. Test ownership aliases updated from the calendar re-export facade to the actual controller owner under the recorded D5 plan amendment. No further structural refactor is warranted for this single barrier; outer actual-media Green is still executing and must finish before the next behavior cycle.


D5 FR014 outer Green: `D5-handoff-outer-green.log` passes11/11 complete real-media cases (176.473s). Actual watchdog dispatch now waits for first event's current-clip final frame and durable physical closure before activating/opening the successor output. Inner79case Green and native types already pass. No further refactor is necessary for the barrier; close this single Red-Green cycle before materializing the next D5 behavior. Current D5 behavior is partial, T675 remains open.


### D5 OPT049 — existing expired-successor behavior under mutation verification

Added only the OPT049 outer and complementary inner behavior after the FR014 cycle closes Green. `D5-expired-outer-baseline.log` passes12/12 complete real-media cases (206.731s): first clip's actual final frame remains preserved, successor window expires during its marker hold, no successor execution/output activates, and the unused occurrence receives closure proof. `D5-expired-inner-baseline.log` passes41/41 complete runtime cases: first physical closure persists, then an otherwise correctly signed successor past its end creates no engine and no active journal record. This is existing behavior, not invented Red and not a new production change. Running `D5-expired-mutation-results.json` campaign checks missing physical admission barrier at the actual watchdog boundary and removed signed-end acceptance at the controlled runtime owner; it restores each exact source in finally. No new behavior or production edit may start until both faults are killed and the restored owners pass.

### D5 OPT049 baseline and shared FR014/OPT048 cycle closed

Both deliberate faults are killed/restored with expected named failures in `D5-expired-mutation-results.json`: missing scheduled physical barrier fails the actual expired-successor activation observation, and relaxed signed-end acceptance fails the controlled no-engine-start assertion. Restored complete owners pass12/12 real-media cases (`D5-expired-outer-restored-green.log`,209.023s) and95/95 native cases (`D5-expired-inner-restored-green.log`). OPT049 is honestly mutation-verified BASELINE; no missing-behavior Red or production change is invented. FR014 and OPT048 share one identical different-destination handoff behavior and original Red, with complementary durable-closure unit assertions; retain both stable IDs without duplicate media executions. The controlled fixture now uses distinct RTMP endpoints as well as distinct target IDs. No further refactor is needed. Next cycle is identical-input continuity, including DEC010 boundary evidence before any corresponding continuity production change. Aggregated T493/T755/T756 and whole D5 gate remain open; no claim that their remaining continuity/source/overlap behaviors are complete.


### D5 matching continuity — valid outer and inner Red

`D5-continuity-outer-red.log` has12pass/1intended failure: the original engine/encoder closes and original playback fails to advance at the Sunday-midnight week boundary. One shared real journey covers OPT046 and DEC010. `D5-continuity-inner-red.log` has41pass/1intended failure: the first original deadline invokes requestDrain despite a separately signed matching adjacent authorization. The inner case also requires original occurrence ends retained, one engine creation, both member identities reported, and physical terminal proof for both only after the final group end. T755's boundary evidence now exists before any continuity production change. Each original signature/end remains immutable; sharing may cover a contiguous union of individually verified matching windows, with pending future membership distinct from active physical state. Do not fake closure, stretch an original permit, or accept an unrelated/different-input future job as continuity authority.


### D5 OPT046/DEC010 continuity Green and test-owner refactor

`D5-continuity-outer-green.log` passes13/13 real-media cases (227.805s), including exact original encoder PID, one output start, original playback advancing, first occurrence retained open, and the Sunday00:00 week boundary. Controlled96case Green verifies separately signed original ends and terminal proof for both memberships only after shared physical closure. DEF146 type narrowing is Verified; native types pass. Complete the current continuity cycle. Refactor on Green: move the three D5 adjacency media cases unchanged from the mixed10-case legacy file into focused `runner-schedule-transitions.test.ts`, retaining all names, tags, assertions and one execution per semantic scenario. Run both complete files once to prove identical13-case inventory. This reduces later developer-loop work without filtering, skipping or weakening existing cases; full affected/native coverage inventories remain mandatory at T675 and feature completion.


D5 owner refactor Green: `D5-owner-refactor-green.log` passes both complete files,13/13 unchanged media cases (225.536s). Executable ownership/commands and test-list aliases now point to the focused three-case transition owner; ten independent legacy cases remain in their original file. No production source or assertion changed in the move. Proceed with the next complementary internal continuity durability behavior; no repeated coverage or unchanged legacy media run is needed during that scoped developer loop.


### D5 shared-terminal recovery cycle Green

`D5-receipt-retry-red.log` proves the lost acknowledged=true flag (42pass/1failure). Preserve durable stopped records on retry and skip writing new drain intent after known physical closure; persist only missing terminals. `D5-receipt-retry-inner-green.log` passes97native cases; native types pass; focused complete transition media owner passes3/3 in83.589s. DEF147Verified. No further refactor is warranted. Proceed to the internal incompatible/untrusted continuation boundary examples before D5 qualification; these must not widen the current captured window.


### D5 continuation authority boundaries verified

`D5-authority-boundaries-baseline.log` passes all69 runtime cases, including26 incompatible or untrusted continuation vectors. A deliberately bypassed scheduled signature verifier is killed by five intended assertions (invalid signature, unknown key, wrong request, signed-end mismatch and expiry-at-start); `D5-authority-mutation-result.json` confirms exact source restoration. `D5-authority-restored-green.log` restores69/69 Green and native types pass. Existing behavior is characterized honestly; no production change or invented Red. No refactor needed. Continue with stale command identity at a shared physical execution boundary; D5 qualification remains open.

### D5 stale shared-member Stop characterized and fault-verified

`D5-stale-stop-corrected-baseline.log` passes70/70 complete runtime cases. The old logical member cannot close the current shared physical execution; current-member Stop closes once and suppresses only the requested current occurrence. Removing the latest-member guard is killed by the new observable return/closure assertion; `D5-stale-stop-mutation-result.json` confirms exact restoration. `D5-stale-stop-restored-green.log` passes70/70. DEF148 fixture assertion corrected and Verified; no production change or invented product Red, and no refactor needed.

### D5 different-source handoff characterized

`D5-source-handoff-baseline.log` passes4/4 complete transition media cases (113.384s), including a separately signed different overlay that is actually loaded after prior final-frame encoding and physical closure. This outer journey changes source and destination; complementary `TDD-US3-OPT047` isolates source-only change with exactly the same canonical target hash. `D5-source-only-inner-baseline.log` passes71/71. Replacing complete payload equality with target-only equality is killed by the source-only assertion (and incompatible-payload vectors); `D5-source-only-mutation-result.json` confirms exact restoration and `D5-source-only-restored-green.log` passes71/71. Existing physical barrier's actual-media fault proof is retained from the preceding cycle on identical production source; no artificial Red or production change. No refactor needed. Actual runtime unit ownership is execution-runtime.test.ts and media ownership is the focused transition file, matching the prior D5 owner amendment. Proceed to overlap rejection at its actual server/browser owner rather than adding a native save API that does not exist.

### D5 overlap save behavior characterized at its real owners

`D5-overlap-browser-baseline.log` passes38/38 whole-file genuine browser cases, including visible overlap explanation and identical original persisted event after reload. Complementary existing prior-day crossing transaction case retains U260 and now aliases TDD-US3-OPT037 with an explicit safe explanation assertion. `D5-overlap-inner-baseline.log` passes105/105. Removing the server overlap rejection is killed by the named OPT037 assertion and existing concurrency checks; `D5-overlap-inner-mutation-result.json` records exact restoration. `D5-overlap-inner-restored-green.log` passes105/105. Existing behavior is honestly characterized, with no new production change or invented Red. No refactor needed. Native type check also passes in D5-current-native-types.log. Browser and service ownership amendment is recorded in plan.md; no nonexistent native save API or duplicate media case is introduced. Whole D5 qualification remains open while complementary continuity durability checks finish.

### D5 unstarted membership survives an earlier Stop

`D5-future-stop-baseline.log` passes72/72. Before the second member begins, current Stop suppresses/closes only the current occurrence, emits no active identity for the future event, leaves its journal pending and unsuppressed, and allows that separately signed future event to start at its original start. Including pending members in shared terminal closure is killed by this test; D5-future-stop-mutation-result.json confirms exact restoration and D5-future-stop-restored-green.log passes72/72. Existing behavior characterized; no production change, no invented Red and no refactor needed. Continue to continuation activation persistence failure before D5 coverage qualification.

### D5 continuation activation storage failure verified

`D5-activation-storage-baseline.log` passes73/73. If persisting the next member as active fails, output permission is fenced, physical drain starts, the next identity is never reported active, and only actually started membership receives terminal proof. The still-pending separate occurrence can start after closure and storage recovery. Removing the storage-failure fence is killed; D5-activation-storage-mutation-result.json confirms exact restoration, and D5-activation-storage-restored-green.log passes73/73. Existing behavior characterized, no production change or invented Red, and no refactor needed. Complete the related initial active-journal save failure review before coverage, because a shared group's first physical start must obey the same durability boundary.

### D5 initial shared activation durability — intended Red

`D5-initial-storage-red.log` has73pass/1intended failure: apply rejects a controlled initial active-journal save error after engine.start, without fencing/closing the output before returning. Required behavior is unsuccessful Start only after physical closure, durable first-member terminal proof and untouched pending future membership. Existing ordinary startup has the same save boundary. Add the smallest catch around that active save and close the captured execution immediately before returning false; do not hide physical close or terminal persistence failures. DEF149 records this product durability defect. No unrelated source change is authorized by this cycle.

### D5 initial activation durability controlled Green; package gate executing

The smallest fix catches only the initial active-state journal save failure, invokes the existing immediate physical-close/terminal persistence path, and returns false only after closure completes. Genuine close or terminal persistence errors still propagate. `D5-initial-storage-inner-green.log` passes125/125 across complete runtime/journal/heartbeat owners; D5-initial-storage-types.log exits0 and D5-format-check.log passes all changed code/test owners. DEF149 is Fixed pending actual-media/full-package proof. No structural refactor is warranted. Run the complete affected Runner package with coverage once at this now-completed behavior boundary, reusing that run both for current-fix actual-media Green and the D5 package milestone. Native87 source/test/config/lock input hashes are captured in D5-native-candidate-inputs.json; production hashes refreshed after this actual fix. No later behavior/source/test edit may occur during the producer.

### D5 package candidate Green; static-only native remediation

D5-candidate-native-coverage.log passes365cases/42owners plus one inherited TODO,508.818s. D5-native-candidate-gate.json passes unchanged ordinary and critical coverage thresholds. DEF149Verified by current-fix real media and full package; no intended behavior Red remains. DEF150 remains a static failure. The owning native producer is now finished. Independent application/workflow producers import native protocol.ts but not native execution-runtime.ts/index.ts (verified repository reference search); they may continue while this native-only refactor is qualified. Preserve the original candidate1511 hashes and87native hashes; record the exact sole native production delta separately and replace current runtime coverage/affected native owner results after rerun. Do not claim historical runtime counters cover modified source. All independent root/protocol inputs must still match their captured hashes.

### D5 constant capture refactor Green

D5-native-refactor-coverage.log passes129/129 across complete runtime/journal/heartbeat/transition-media owners,136.647s. The initialized constant holder preserves permission access during factory construction and the exact captured physical execution thereafter. Native types pass and D5-remediation-lint.log restores zero errors/six unchanged warnings. DEF150 is Fixed pending remaining transitive runtime media consumers and merged current coverage. Run the eight other complete real-media consumer owners plus direct multistream and mocked CLI factory owners once on the refactored source; do not rerun the unchanged entire42owner package. Only execution-runtime.ts changed after the already successful candidate, so discard its historical counter map and replace it with fresh current-source counters; other source maps may merge only if identical. Retain the distinct complete42owner inventory with replaced affected owners. No source/test edit during these native producers.

### D5 current-source native/app/workflow qualification Green; final browser subset executing

The current native inventory is42owners/365pass/1inheritedTODO, with14affected owners replaced after the sole runtime constant capture refactor; D5-native-current-inventory.json checks input identity and D5-native-merged-gate.json passes unchanged thresholds. Historical runtime counters are discarded, then fresh current maps substituted. Current runtime coverage is100%lines/functions,98.35%statements,95.47%branches. All1008distinct app cases/46owners pass via45owners plus separately qualified overlap owner; D5-app-current-inventory.json verifies exact original inventory and1510unchanged independent inputs. All433workflows pass in15.9m. Root merged coverage passes with fresh app, workflow, overlap and explicit direct-downgrade counters. Build,93-file action manifest, app/native types, lint0errors/6inheritedwarnings and complete changed-file formatting pass. DEF150/151Verified.

Final current-source eight-fault runtime campaign kills and exactly restores authority, physical handoff, source equality, stale-member Stop, pending-member terminaling, activation fence, first active save and acknowledgement retention faults; D5-qualified-mutation-results.json retains each input hash. Complete restored native owners pass131/131. The remaining15genuine browser boundary/ATDD cases now run isolated, complementing the already passing38-case main browser owner on identical app/server source. D5's T675 remains open until that subset and final artifact checks pass. No release readiness or completion is claimed.

D5 aggregate behavior/refactor tasks and acceptance-specific gates are now checked: each original missing behavior has valid retained Red then Green, while OPT037/OPT047/OPT049 retain honest fault-verified existing-behavior characterization. No native calendar-save API was invented, and no duplicate alias media execution was added. Current native package/consumer inventory, root inventory, both coverage gates and eight-fault restored131case proof qualify these individual tasks. The final delivery prerequisite T675 remains explicitly open until the isolated15-case browser subset and final evidence audit pass; D6 has not started.

### D5 qualified; proceed to D6

D5-final-scoped-gate.json passes all current-source qualification checks:1008distinct app cases/46owners,365distinct native cases/42owners plus one inheritedTODO,433workflow scenarios,53isolated browser cases,unchanged root/native coverage thresholds,app/native types,zero-error/six-inherited-warning lint,complete changed-file formatting,production build and93-file action manifest. Eight current-source native faults plus the server overlap fault are killed/restored; restored whole native owners pass131/131. Source36hashes,1510independent inputs,87native current inputs and eight unchanged dependency/policy inputs are verified. D5 T675 is Green and all151canonical defects Verified. First-active storage failure, pre-refactor runtime counters and initial static failures are retained but excluded from final qualification. No quotas, new pricing tier, generated migration, live billing action or release claim is introduced. Qualified18/23slices;728/1018tasks; estimated overall effort86%. Begin D6 one behavior at a time, with current physical ownership/journal/cache entry points rather than the calendar-only facade.

### D6 EC010 manual-Stop constituent characterized

D6-manual-stop-outer-baseline.log passes the first real-media case in21.597s. The actual signed-cache CLI watchdog opens real Chromium/FFmpeg, manual Stop completes the current clip and persists suppression/closure, then at least three observed real cache restores occur inside the original window without another output start. On Green, select the final structured fixture JSON even when teardown prints subsequent native diagnostics; this preserves pre-cleanup failure observations rather than turning a genuine fault into a JSON parse error. D6-manual-stop-observer-baseline.log passes1/1 and the existing complementary CON008 test now retains its stable name plus EC010 alias, with74/74 inner cases passing.

The deliberate dropped-Stop dispatch fault fails both named outer and inner assertions; the outer failure includes manualStopAccepted=false, manualClosed=false and allOutputsClosed=false, not setup/import failure. D6-manual-stop-mutation-result.json proves exact source restoration. D6-manual-stop-restored-green.log passes75/75 across both complete owners(25.123s). Existing behavior is honestly characterized, not invented Red; no production edit or further refactor is needed. A32/U32 remain PENDING and EC010's registry remains Planned because their separate Pause-automation constituent is not implemented/verified yet. Do not tick the whole parent task or claim Pause/restart/high-water behavior from this Stop result. Proceed with the distinct Pause control behavior next; share OPT088's UI expectation only where it is the same actual journey. Finished D5 job-owned PG templates have been removed through the documented cleanup script; browser fixture database retained.

### D6 OPT088 Pause control — valid outer Red

D6-pause-outer-red.log fails only the missing Pause automation button after authenticated ownership, persisted active-window schedule, active captured admission and enabled Stop are verified. No new schema field is queried before this intended missing-control assertion. Build/schema/Chromium prerequisites are valid. Materialize one complementary transactional authority test next; a minimal declaration returning an expected business failure may make its symbol resolvable, but no Pause implementation/schema/UI is written before the internal assertion Red. Separate EC010 native-cache invalidation/restart authority remains pending.

### D6 Pause authority — intended internal Red before implementation

D6-pause-valid-inner-red.log fails the intended success=true assertion after authenticated ownership, successful saved event and executable future occurrence metadata are established. DEF152 fixture signature corrected; original TypeError is excluded. Before implementation refine Pause to retain session media configuration revision, increment its dedicated automation revision and atomically increment Runner authority revision; require both current revisions for compare-and-set. This preserves active generation identity/immediate Stop while fencing delayed pre-Pause cache authority even at equal timestamps. D6-pause-revision-inner-red.log confirms the unchanged intended false-success failure with these explicit additional authority assertions. Implement only this control/persistence/UI behavior; native future membership reconciliation and other D6 behaviors still require their own evidence.

D6 Pause controlled Green: D6-pause-inner-green.log passes1/1; complete affected service/schedule/component/action owners pass118/118 in D6-pause-affected-green.log, without coverage. Pause atomically persists its timestamp and dedicated revision, keeps media config/mode/output intent intact, advances Runner cache authority revision and removes future executable metadata while retaining saved events. UI uses the existing authenticated action wrapper and React transition; expected denials remain return values. Native cached continuity reconciliation is still unbuilt and not claimed. A new uniquely named disposable browser DB is initialized from the current schema via the documented helper; no generated migration or shared DB push. App types are running before the rebuilt genuine browser outer Green.

### D6 OPT088 Pause UI/persistence cycle Green

D6-pause-outer-green.log passes the complete focused genuine browser owner1/1(35.5s), including persisted paused timestamp/revision, retained Scheduled mode and media configuration, unchanged active capture/end, available Stop and Resume automation, and reload. Controlled persistence/authority test and complete affected owners pass118/118; component fixture projection is corrected, app types/scoped lint/build pass, DEF153Verified. No additional structural refactor is needed: the small projection helper is shared by safe read and mutation results, and the React transition uses the existing action wrapper. A128/U128 and their materialization tasks are DONE. The overall D6 gate and EC010 parent remain open: actual native cached future membership must still reconcile a fresh signed empty Pause snapshot, and restart/Resume/high-water/bounded-cache behaviors are not claimed complete. Proceed with that distinct real watchdog boundary before implementing its runtime change.

### D6 EC010 fresh Pause authority — valid native outer Red

D6-pause-cache-outer-red.log has1pass/1intended failure(43.236s). The existing manual Stop case remains Green. The new journey uses a real newer-revision, fresh-nonce signed empty manifest accepted/persisted by RunnerScheduleCache and observed through at least three actual CLI watchdog restores. Current playback correctly stays live before its original end. At that boundary, the stale prepared group wrongly activates the removed future member, queues another clip and never emits first-member terminal closure. Signature/cache/setup/final-frame preconditions all pass, so this is intended missing reconciliation behavior rather than fixture Red. Add one complementary controlled membership/output-gate test before runtime/index changes. No new generated migration or external change is involved.

D6 Pause native internal Red: D6-pause-cache-inner-red.log has74pass/1intended failure, mayOpenOutput remains true after the original current end despite preparing an empty replacement. It also requires live current capture before end, no early drain, original end retained, only started membership terminaled and future member still pending. Implement the minimum: reconcile existing unstarted contiguous membership against the verified replacement and use the manifest owner to prepare even an empty cache. Do not claim browser exact-boundary update, added future rights, restart or high-water recovery from this change; those remain separate subsequent evidence.

### D6 fresh Pause authority cycle Green

D6-pause-cache-inner-green.log passes126 cases across the complete runtime, journal and heartbeat owners. D6-pause-cache-outer-green.log passes both genuine media recovery cases in43.861s: accepted newer signed empty authority removes unstarted continuity membership, preserves current playback before its original end, and closes only started membership afterward. Native types and scoped lint pass. The watchdog now reconciles empty manifests through their authenticated owner; the runtime trims unstarted rights only after complete replacement verification. Exact browser deadline propagation, additional future rights, restart/high-water and final D6 qualification remain pending; EC010 parent tasks remain open. Review same-session logical membership against the existing physical-admission constraint before the next behavior cycle.

### D6 Pause/Resume revision and idempotence characterization

D6-pause-controls-baseline.log passes3/3 complete-owner cases. Stale automation revisions and unavailable sessions return expected business failures without changing persisted authority. Repeating Pause preserves both session and Runner revisions; Resume clears Pause, increments only automation/cache authority revisions, restores the saved future occurrence and preserves media intent. D6-pause-controls-mutation-result.json kills the deliberately removed revision guard and proves exact restoration; D6-pause-controls-restored-green.log passes3/3. Existing behavior is honestly characterized, with no extra production change. Overall D6 remains pending. Next distinct behavior is renderer enforcement of the trimmed original end while the native timer is held; executable outer proof runs before any deadline propagation implementation.

### D6 renderer original-boundary deadline — intended outer/inner Red

D6-pause-exact-outer-red.log passes2 recovery cases and fails only the new renderer boundary assertion: nextClipStarted=true after a newer signed empty Pause manifest and three genuine watchdog restores. The native timer is then held so it cannot mask stale renderer authority. Current playback, signature/cache acceptance, final encoded frame and physical closure pass. D6-pause-exact-inner-red.log passes76 cases and fails the two complementary missing deadline-propagation assertions (no engine update and no generation-bound presentation update). Implement the bounded deadline update without changing original captured occurrence ends or allowing drained playback to revive.

D6 exact-boundary implementation first passes101 controlled cases, but D6-pause-exact-outer-green.log still fails the unchanged no-successor assertion. D6-pause-exact-deadline-diagnostic.log records original renderer end53635.22998046875 and updated end53635.509033203125: independently resampling browser/native clocks shifts the immutable boundary by0.279ms. This is not fixture/setup Red and the media assertion is not relaxed. Engine now retains its initial browser/native clock mapping for subsequent verified deadline changes. D6-pause-exact-anchored-inner-green.log again passes101/101; refreshed genuine media/static checks run before Green or parent completion is claimed. Deadline stalled-RPC/reload follow-ups remain pending review candidates.

### D6 original renderer deadline cycle Green

D6-pause-exact-anchored-outer-green.log passes all3 complete real-media recovery cases in65.81s, including original-boundary enforcement while the native timer is held. Current playback/final encoded marker/physical output closure and no successor are retained without tolerance changes. D6-pause-exact-anchored-inner-green.log passes101 cases across complete runtime, presentation and Engine owners. Anchored native types and scoped lint exit0. Engine reuses the original browser/native clock mapping; deadline replacement is generation-bound and cannot revive draining playback. The runtime awaits only actual pending updates, preserving immediate safety fencing. No further structural refactor is needed for this cycle. DEF154Verified; its initial failed run remains excluded. EC010 parent remains PENDING until restart/high-water and other required constituents are qualified; proceed to stalled deadline propagation safety next.

### D6 stalled deadline RPC — controlled Red

D6-pause-stalled-deadline-inner-red.log passes75 cases and fails only missing original-end drain dispatch when a renderer deadline update remains unresolved. Original source/capture authority is valid and the deferred control Promise is released in finally, so no fixture timeout supplies the failure. Add a distinct genuine media journey holding only the update control RPC while real renderer, capture and drain RPCs remain live. Run the complete recovery owner before production change; the already qualified3journeys must remain Green. The proposed minimal change is to evaluate original expiry and dispatch closure before awaiting any pending deadline control update.

D6-pause-stalled-deadline-outer-red.log passes3 genuine recovery cases and fails the intended stalled-control journey: the update RPC is held, original playback/final encoded marker remain valid, but runtimeExpired=false, nextClipStarted=true and allOutputsClosed=false before emergency cleanup. This is missing native fencing, not setup/import/cleanup failure. Both valid outer and controlled Reds now precede the change. Remove control-RPC waiting from the independent native watchdog entirely; awaiting any active execution's control Promise can also block another execution in the same controller. Keep generation-bound serialized updates and their failure fence, with native expiry always evaluated independently.

### D6 stalled control cycle Green

D6-pause-stalled-deadline-outer-green.log passes all4 genuine media recovery cases in90.546s. The held deadline-update RPC no longer blocks original-end native drain: current clip/final encoded frame complete, successor does not start, and all physical outputs close before emergency cleanup. D6-pause-stalled-deadline-inner-green.log passes102 complete affected runtime/presentation/Engine cases; refreshed native types and scoped lint exit0. Browser updates remain serialized and generation-bound; native watchdog intentionally never awaits their delivery. This small removal needs no additional structural refactor. Preserve valid outer/inner Reds and original failed attempts. Overall EC010/D6 remains pending until logical occurrence suppression, restart and final gates qualify. Proceed with suppression across previously unseen admissions of the same occurrence; no new pricing or migration work is introduced.

### D6 durable logical Stop — controlled Red

D6-logical-stop-inner-red.log passes76 existing runtime cases and fails both new unseen-admission replay assertions (same configuration revision2 and higher revision3): a freshly reconstructed journal/controller accepts another admission/generation for the manually stopped logical occurrence. Authenticated signed bounds and identity are valid. The current journal only marks already-known IDs. Genuine newer signed-cache replay journey now runs before production changes; no arbitrary configuration increase will be treated as explicit Resume intent. Explicit trusted Resume reconciliation remains a separate required behavior.

D6-logical-stop-valid-outer-red.log passes4 established cases and fails only the intended replay assertions: aliasCacheAccepted=true and original Stop/suppression/closure/current clip/final frame all pass, but outputStarts=2 and restartedAfterStop=true. Both same/higher-revision controlled Reds and this genuine cache/CLI Red precede production changes. DEF155Verified: the observer now waits for any wrongly admitted capture startup before teardown and keeps its disposable output separate, eliminating the initial extension cleanup failure without weakening no-restart assertions. Implement logical journal suppression lookup and propagate it into prepared members as well as direct apply; explicit Resume remains pending.

### D6 durable logical Stop cycle Green

D6-logical-stop-inner-green.log passes140 cases across complete runtime/journal/presentation/Engine owners. D6-logical-stop-outer-green.log passes all5 genuine media recovery cases in109.129s: a newer signed cache, unseen admission/generation and higher configuration revision cannot restart the manually stopped occurrence; original clip/final encoded marker/closed outputs remain verified. Native types and scoped lint pass. The journal now exposes a read-only owner/Runner/occurrence suppression lookup, reused by direct cached apply and prepared continuity membership; no schema/version change or extra persistent secret is introduced. Existing journal retention and Stop persistence are preserved. No further refactor is needed for this small shared lookup. Explicit signed Resume, rollback/restart and same-session reconciliation remain pending, so A32/U32 and D6 parent gates stay open. Current estimated effort88%,18/23qualified slices,730/1018tasks; these counts are not release readiness.

### D6 FR015/OPT045 cold restart characterization qualified

Initial complete outer baseline passes6/6 in130.564s; controlled baseline passes79/79. D6-cold-restart-mutation-result.json kills the deliberate rejection of restored active identity at the named controlled assertion and proves exact source restoration. D6-cold-restart-restored-green.log passes85/85 across both complete owners in150.581s, with a stronger genuine cold-process proof: the first output file is removed after simulated process loss, and the new Node process must restore the signed cache/journal, start real Chromium/FFmpeg, write fresh encoded bytes, retain the exact generation and original end, and survive at least3watchdog reconciliations with one pipeline. Emergency process teardown occurs only after the captured observation and does not record owner Stop intent. No production fix was needed; A15/U15 and A85/U85 are honest retained BASELINE, not invented Red. No further refactor is needed; shared cold-process fixture is reused. Materialization tasks T498/T502/T507/T511 complete; overall D6 gate remains open.734/1018tasks;18/23qualified slices;effort88%.

### D6 offline weekly return characterization qualified

D6-weekly-return-outer-baseline.log passes the distinct real-media owner1/1(39.368s), while the controlled runtime owner passes80/80. The prior occurrence is manually stopped/suppressed, the future cache refreshed before offline, and a genuinely cold process returns inside the next weekly window with no pre-existing admission for that occurrence. It produces fresh encoded bytes once under the new identity/original end while retaining the old Stop record. D6-weekly-return-mutation-result.json kills overly broad suppression that ignores occurrence identity and proves exact journal-source restoration. D6-weekly-return-restored-green.log passes87/87 across all3complete affected runtime/recovery/recurrence owners(189.037s), qualifying the small shared cold-child observer extraction and all earlier media cases. No production fix is needed. A82/U82,A129/U129,U265 are honest BASELINE. TDD-US3-CON011 remains Planned until its other clock/ACK/horizon constituents qualify. Complete only T499/T504/T508/T513/T1006;739/1018tasks,18/23qualified slices,effort88%. Next behavior is a cold return at an ended window, under the original half-open bound.

### D6 ended-window characterization qualified

D6-ended-window-baseline.log passes4/4 across genuine cold-return and complementary native admission owners(44.634s). Both exact-end and after-end returns restore a valid unexpired signed cache, retain the original end, close unused pending authority, and start zero physical output. Controlled native cases jump forward to each boundary and reject before creating any Engine or starting journal record. The fallback Engine fixture is valid even if mistakenly invoked, so removing the native cached upper bound fails a meaningful no-construction assertion rather than TypeError; D6-ended-window-mutation-result.json proves killed/restored. D6-ended-window-restored-green.log passes4/4 in42.168s. Existing behavior is honestly retained BASELINE for A83/U83/U263, with no production implementation or additional refactor. T500/T509/T1004 complete;742/1018tasks. CON011 remains Planned for its remaining rollback/ACK/horizon constituents. Proceed to signed cache horizon bounds next.

### D6 signed cache horizon characterization qualified

D6-cache-horizon-baseline.log and D6-cache-horizon-restored-green.log pass all4 cases in the complete schedule owner. A genuinely signed/private-payload-bound long event is accepted into RunnerScheduleCache with zero request-time uncertainty. At horizon-minus1ms it restores and starts once; reaching cache expiry afterward does not truncate that already accepted original14-day window. At the exact horizon restore returns null/sync_required, preparation/direct dispatch reject, and no Engine or journal admission is created. D6-cache-horizon-mutation-result.json kills the >= to > horizon fault and proves exact source restoration. Existing behavior is honest BASELINE for U215/U216, no production change/refactor needed. T786/T787 complete;744/1018tasks. CON011 remains Planned until rollback and idempotent lost-ACK recovery are qualified. No stream-hours quota or new business limit is introduced.

### D6 completed-window clock rollback characterization qualified

D6-clock-rollback-baseline.log and D6-clock-rollback-restored-green.log pass all5 complete schedule-owner cases. The scheduled window first starts and reaches its original end with durable physical closure. A newly reconstructed journal/controller then sees both a wall-clock rollback to0 and monotonic time back inside the original window; valid signed cache preparation succeeds, but the completed identity cannot be readmitted, no Engine is created and the original terminal/end remain unchanged. D6-clock-rollback-mutation-result.json kills the terminal-guard boolean-return fault and proves exact source restoration. U147 is honest BASELINE; no production change/refactor needed. CON011 remains Planned only for its final lost-ACK/idempotence constituent. Task count744/1018unchanged.

### D6 lost-ACK characterization and CON011 internal checkpoint Green

D6-terminal-ack-baseline.log and D6-terminal-ack-restored-green.log pass all6 schedule-owner cases. A real persisted terminal record survives reload; a wrong generation cannot retire it; replaying the matching acknowledgement twice removes only that pending receipt, preserves another generation, and never recreates output. D6-terminal-ack-mutation-result.json kills the dropped generation check and proves exact journal source restoration. D6-internal-recovery-qualified.log passes86 current cases across complete schedule/runtime owners, jointly qualifying all CON011 constituents: rollback, forward/end skip, lost ACK, next weekly occurrence and before/at cache horizon. All are honest retained characterization, with no production change or further refactor. U264 BASELINE, CON011 Green; T505/T1005 complete.746/1018tasks;18/23qualified slices. Overall D6 still needs active-control disconnect proof, explicit Resume/high-water and same-session physical/logical reconciliation, plus its complete scoped gates. Begin control connection failure while accepted playback is already active next.

### D6 active control-disconnect characterization qualified

D6-active-disconnect-baseline.log and D6-active-disconnect-restored-green.log pass17/17 across complete heartbeat and genuine media connection owners(21.26s/21.153s). The actual CLI heartbeat receives HTTP503 only after signed cached Chromium/FFmpeg playback is active; it returns retry, preserves current pipeline/cache, and the independent local watchdog finishes the current clip at its original end with final encoded frame/no successor/all outputs closed. The complementary controlled case starts accepted output before the 503 and distinguishes soft failure from revoked authority while retaining all4older FR012 scenarios under their original names. D6-active-disconnect-mutation-result.json kills treating503asStop and proves exact CLI-source restoration. A84/U84 are honest BASELINE, no production change needed; the shared controlled scenario helper preserves existing cases and is Green. T501/T510 complete;748/1018tasks,18/23qualified slices. D6 still awaits explicit Resume/high-water, same-session physical/logical reconciliation, negative Pause controls and complete scoped qualification; no whole-slice completion is claimed.

### D6 explicit owner Resume — intended native and server Reds

D6-owner-resume-inner-red.log passes80 existing native cases and fails only missing durable occurrence/explicit-Resume control metadata after a fresh signed ordinary owner Resume successfully starts. D6-owner-resume-contract-red.log passes105 existing server cases and fails only missing occurrenceId/scheduledStart in the verified ordinary execution delivery after actual authenticated Resume. Existing end/configurationRevision and signature preconditions pass. Materialize the distinct genuine Stop -> owner Resume -> cold cached restart journey before production change. Ordinary signed execution purpose already distinguishes explicit owner Start/Resume from automatic scheduled cache authority; bind its occurrence bounds and persist its accepted control revision, rather than trusting arbitrary higher cached media revisions to clear Stop. The original captured end remains immutable.

### D6 explicit Resume outer Red qualified

D6-owner-resume-valid-control-red.log reaches intended missing occurrence/control marker and cold restart assertions after actual signed owner Stop/Resume, fresh encoded resumed media, valid replacement cache and fresh child PID. Prior media-precondition failures are excluded; DEF156 Verified records FFmpeg file buffering and direct-stop-versus-drain evidence repairs. Native D6-owner-resume-inner-red.log and server D6-owner-resume-contract-red.log remain valid intended Reds. Implement signed ordinary occurrence metadata, strict binding, and durable control revision ordering without extending original bounds.

### D6 explicit owner Resume implementation and ordering checkpoint Green

D6-owner-resume-contract-green.log passes106 actual authenticated server cases; ordinary signed execution now includes immutable occurrence ID/start/end. D6-owner-resume-inner-green.log passes120 native cases and D6-owner-resume-outer-green.log passes the genuine owner Stop/Resume/new-process Chrome+FFmpeg journey (57.109s), retaining the original end, durable control marker, same identity and one new pipeline. D6-owner-resume-binding-red.log had81passing/3intended failures (Resume metadata and two unsigned fields; signed-end tampering already rejected), followed by strict ordinary occurrence binding. D6-owner-resume-ordering-baseline.log adds two honest current behavior characterizations: older unknown cached alias after Resume and higher cached revision after another Stop both reject across journal reconstruction. The revision-guard fault is killed/restored exactly in D6-owner-resume-mutation-result.json. D6-owner-resume-restored-green.log passes128 current cases across runtime/journal/schedule owners. Native/app type checks pass; scoped lint0errors/1inherited unused dirname warning. No original occurrence bounds, paid tiers, quotas, generated migrations or user-facing hard-cut controls changed. Parent EC010 outer remains pending its aggregate current-source media checkpoint at D6 gate; T497/T506 materialization complete.750/1018tasks,18/23fullyqualified slices; approximately89%effort. Next characterize same-session cache refresh and logical receipts before production changes.

### D6 same-session continuity evidence and initial implementation

D6-same-session-contract-red.log and D6-same-session-root-contract-red.log both reach2intended missing contracts: refreshing active first membership loses the signed adjacent future authority; second active receipt is denied by one-physical-session fencing. D6-same-session-media-restored-baseline.log passes the genuine same-session/two-logical-member/one-encoder boundary; DEF157 Verified records its repaired observation scope. Persist later members' continuityRootAdmissionId with owner-scoped FK, no self root and existing physical uniqueness applied to roots; keep both active until actual closure. Cache refresh now captures only the matching active occurrence, retains future authorization and records signed media fingerprint for verified adjacent joins. First2server contracts then pass. DEF158 transparently records an omitted returned observation and premature automatic-purpose guard: guard removed, observation repaired, D6-same-session-valid-purpose-red.log then proves ordinaryLeaseIssued true / permissionPending false with2continuity cases passing. Restore the minimal cached-active purpose guard only after that valid Red. No generated migrations. Full qualification and negative group/closure checks remain pending.

### D6 same-session continuity checkpoint qualified

D6-current-capture-restored-green.log restores109 current schedules/continuity cases after the3real retained-resource regressions (DEF159 Verified); no original assertion was weakened. D6-same-session-negative-restored-baseline.log passes13 expanded complete-owner cases: signed-media/source-revision mismatch,1ms gap, uncertain/revoked/draining roots cannot join; rollback preserves authority; composite owner FK rejects foreign roots(23503), self-root check rejects cycles(23514), physical-root uniqueness remains enforced(23505); draining and sequential logical closure preserve occupancy and immutable ends. DEF160 Verified records explicit foreign domain fixture seeding, not product Red. Fingerprint guard fault killed/restored in D6-same-session-mutation-result.json. D6-same-session-restored-green.log passes119 current cases across complete schedules/continuity owners, with current app type checks and scoped lint clean. The4other complete owners passed in the earlier178pass/3regression checkpoint; changed schedules owner was rerun after the fix, without repeating unchanged successful owners. Genuine same-session media already passes one unchanged encoder/capture with2logical receipts. All160 canonical defects Verified. D6 still needs dynamic future-cache/owner Resume continuity, remaining scoped negative controls and complete gates; no full story/slice completion claimed.750tasks/18qualified slices; approximately90%estimated effort.

### D6 dynamically synchronized continuity intended Red

D6-late-continuity-inner-red.log passes86 existing cases and fails2 intended new cases: a fresh adjacent signed window is not persisted/joined after either cached or ordinary owner playback already started. D6-late-continuity-outer-red.log reaches only expected continuity assertions after initial one-window signed cache, real playback, valid expanded cache and3actual watchdog reconciliations: original pipeline closes/no successor clip/zero active logical members instead of uninterrupted one-capture continuation. No fixture/import/environment failure. Add verified capture identity anchoring and pending-member persistence before output authority extension; require successful current-generation renderer deadline delivery before lengthening native authority. Shortened authority remains immediately enforced, stalled or late acknowledgement cannot revive an expired capture.

### D6 dynamically synchronized continuity checkpoint Green

D6-late-continuity-inner-green.log passes88 runtime cases; D6-late-continuity-outer-green.log passes the real one-window start followed by signed future-cache refresh and3watchdog reconciliations: original media advances across its boundary with one encoder and2logical receipts. Active capture identity anchors either cached or ordinary owner Start to verified matching future windows. New pending identities persist before longer authority; renderer acknowledgement must precede extension and cannot revive an expired capture; shorter boundaries fence immediately. D6-late-continuity-mutation-result.json kills disabling active-capture join and proves exact restoration. D6-late-continuity-restored-green.log passes130 current runtime/journal/schedule cases; native type checks and scoped lint pass. Parent D6 completion remains pending startup/reload boundary checks and all affected gates.

### D6 startup Pause and replacement bootstrap qualified

D6-starting-pause-red.log proves a starting-state trimming regression (89pass/1missing21000delivery), restored to90Green in D6-starting-pause-green.log (DEF161 Verified). Its additional honest stalled-extension characterization proves independent original-end closure, no premature future activation, no late revival and permitted separate future admission after closure. D6-replaced-bootstrap-red.log passes23Engine cases/fails2expected shorter/longer new-document boundaries; install the verified replacement before removing its predecessor, reuse initial clock mapping and retain one generation plus one boundary script. DEF162/163 Verified retain initial test typing/lint gate failures and corrected narrowing/unknown callback arguments. D6-replaced-bootstrap-restored-green.log157cases, restored native types/scoped lint and D6-replaced-bootstrap-media-green.log real media allGreen. Full D6 gates remain pending; next finish Pause authorization/Free safety controls and journal write-boundary proof.

### D6 Pause safety/authorization characterization qualified

D6-pause-safety-restored-baseline.log and D6-pause-free-safety-restored-green.log pass10complete automation-owner cases. Actual authenticated read-only, Manual/fallback, foreign Runner, stale media revision and caller-injected fields return expected public failures with unchanged session/device/audit state after transaction rollback. Free owner Pause succeeds without changing Scheduled/media intent, and immediate Free Resume returns FEATURE_RESTRICTED. D6-pause-free-safety-mutation-result.json kills wrongly charging Pro for safe Pause and proves exact source restoration. Existing production behavior is honest BASELINE, no new feature code. DEF164 Verified records the corrected database-valid fallback fixture. All164canonical defects Verified;750tasks,18qualified slices,approximately90%effort. Complete journal write-boundary proof next, then D6 current affected gates.

### D6 journal write-boundary intended Red

D6-journal-write-boundary-red.log passes36 existing journal cases/fails1intended UTF-8 write-boundary assertion: load rejects snapshots over the existing2MiB storage bound, but save can replace a valid restartable snapshot with an unreadable oversized one. Enforce the same byte bound before opening a temporary file, preserving disk contents and in-memory receipts on failure. The independent new test seeds a genuine valid near-boundary UTF-8 journal, requires atomic rejection, reopens its prior receipts, verifies no temporary files and permits a later same-size valid update. This is a storage invariant, not a new stream/device/hour quota.

### D6 journal atomic write boundary qualified

D6-journal-write-boundary-green.log passes158current journal/runtime/Engine/schedule cases. D6-journal-write-boundary-mutation-result.json kills character-count substitution for UTF-8 byte measurement and proves exact restoration. D6-journal-write-boundary-restored-green.log37cases plus current native types and scoped lint pass. Oversized writes preserve prior disk and in-memory receipts, remain reopenable with no temporary files, and permit a subsequent valid same-size update. The pre-existing2MiB storage bound is unchanged and no business quota is added.

### D6 current-window Pause boundary intended Red

D6-current-window-boundary-red.log passes90existing runtime cases and reaches3intended edge failures. Pause metadata received exactly at/1ms after the adjacent start, before the next watchdog tick, must retain that already begun current window rather than truncate it to the first end. A nonfinite clock must fence existing capture without marking an unstarted future window completed. Refresh accepted continuity membership before trimming fresh authority, using only finite clock values; preserve the independent native expiry/drain path and all original occurrence ends.

### D6 final current-window boundary checkpoint Green

D6-current-window-boundary-green.log passes161cases across complete runtime/journal/Engine/schedule owners. Pause at the exact adjacent start and+1ms preserves the already begun current window without an update/early drain; finite-clock membership is refreshed before trimming. Invalid clock fences existing capture while the unstarted next permission remains pending. Earlier intended Red90pass/3fail retained. Native full-package affected coverage is the next completed-slice milestone; source/test edits are frozen while its producer runs. No coverage threshold is lowered.

D6 implementation tasks T514/T515/T516 complete: all planned intended Reds or honest baseline characterizations are retained, and current scoped implementation checks pass. U32 DONE/TDD-US3-EC010 Green; A32/BDD parent stays pending its running current-source full native-media gate.753/1018tasks,18/23qualified slices,approximately90%effort. Canonical defect audit reconciles164unique IDs, allVerified (3High/49Medium/112Low); corrected stale summary tallies without changing defect status or waiving feature gates.

### D6 native candidate tests Green, calendar coverage gate blocked

D6-candidate-native-results.json49suites/369passed/1unchanged TODO,796.4s; all99frozen native input hashes match. Candidate coverage evaluation fails missing schedule.ts. DEF165 identifies39lost D5 calendar cases overwritten during earlier D6 recovery materialization. Exact prior source recovered from Jest map by independent D5 checksum; calendar owner restored,6recovery cases moved intact into schedule-recovery.test.ts. D6-calendar-owner-restoration.json records proof. Run both complete owners with coverage; verify every D5 assertion retained and counter-map identity before merging current-source maps. This gate failure blocks D6 completion; no history/threshold or assertion is waived.

### D6 native milestone qualified; application candidate next

D6-native-current-inventory.json reconciles50current owners/413pass/1unchanged TODO, with every prior D5 case retained (one documented shared CON008/EC010 label alias). All100native input hashes/36production hashes checked; only three test-only replacements plus new recovery owner changed after the candidate. Counter maps match exactly across candidate/restored calendar/strength reports. D6-native-merged-gate.json meets all original critical95/90 and ordinary90/85 thresholds; ordinary92.02S/85.29B/92.55F/96.03L. D6-current-fault-results.json12current faults killed/restored at expected assertions and exact source hashes; post-restoration221cases Green. Current native type/lint checks pass. DEF165/166 Verified; all166canonical defects Verified. A32 DONE/BDD-US3-EC010 Green; T517/T518 complete.755tasks,18fullyqualified slices; D6 app/workflow/browser/static gates remain pending. No full feature completion claimed.

### D6 application checkpoint continuation — 2026-10-17

D6-candidate-affected-coverage.log completes48 owners/1032cases with1011pass/21fail. DEF167 accounts for20 stale mock-builder orderBy failures; DEF168 accounts for one observer missing the newly signed occurrence identity. Preserve every existing assertion. The two complete repaired owners pass61/61 without coverage in D6-app-repair-green.log; no production change. D6-current-workflows.log is the current433-scenario milestone owner. D6-current-browser-build.log uses a fresh disposable schema recorded in D6-final-browser-environment.json. Source/tests remain frozen during these producers.

The concurrent two-owner coverage retry encounters the unchanged30-second child timeout and Jest circular-error serialization; DEF169 records that failed execution, which cannot supply JSON/coverage qualification. After active producers finish, rerun these complete owners in isolation without increasing limits. The commercial observer also requires normal Prettier formatting before final current-source qualification; do not format active producer inputs. D6-app-current-inventory.mjs is prepared to check all prior1008app cases and permit only the two reviewed test-input changes. D6 remains unqualified; no next-slice implementation has started.

D6 continuation checkpoint: D6-app-repair-final-coverage.log190cases and D6-automation-fixture-coverage.log10current automation cases pass with original limits. D6-app-current-inventory.json qualifies48owners/1032distinct pass and all1008previous cases; seven runtime UUID labels are normalized with multiplicity, no assertion removed. D6-final-app-types.log exits0; global lint has0errors/6inheritedwarnings. DEF167–171 all Verified. D6-automation-type-only-proof.json records byte-identical executable schedule source after the erased client-type fix. All native production hashes remain unchanged, so retain the qualified413pass/1TODO inventory, original39calendar cases, twelve killed/restored faults and realmedia owners. No further functional refactor is needed. Complete T829/T926/T519 against this current native evidence; T925 awaits the fresh real-browser milestone and the whole D6 gate remains open. No next-slice tests are introduced before that gate.

D6 native constituent gates T812/T879/T880/T881/T882 are now checked against D6-native-current-inventory.json50owners/413pass/1inheritedTODO, D6-native-merged-gate.json and the unchanged current-source real-media owners. These cover cold remaining-window restore, later weekly occurrence, ended-window skip, control503 continuity and cold restart. No new execution duplicates unchanged successful media. Whole D6 remains open for its54-case browser milestone, standalone build and complete fresh workflow coverage.

D6-final-browser.log passes54/54 genuine isolated browser scenarios in11.7minutes, including explicit Pause/current end, Stop/Resume, mobile/desktop cross-week editor/gesture semantics and boundary/rollback coverage. Fresh E2E build and93-file action manifest pass. T925 Green. Start final standalone build before the complete fresh workflow producer; do not overlap heavy builds with probe coverage. D6 remains open until those final gates and combined critical coverage qualify.

D6 final workflow scenarios pass433/433 in10.6minutes, but the final collector is rejected: strict source-map comparison finds old type positions from the interrupted producer retained in the shared raw directory. D6-workflows-mixed-counters.log and D6-workflow-mixed-map-diagnostic.json retain the diagnostic. DEF173 records the isolation defect. D6-workflow-reset-red.log proves the missing reset behavior; D6-workflow-reset-green.log passes1whole-file regression case, including stale counter/result/probe removal, idempotence and preservation of another lane. Minimal new workflow-coverage-state.mjs resets only owned artifacts, called before building workflow probes. Existing application/native/presentation production source is unchanged. D6-qualified-execution-inputs.json captures the new producer/test inputs; no old snapshot is rewritten. A fresh full workflow run is mandatory before accepting coverage. Existing application feature count stays1032; this single infrastructure regression is reported separately, not added twice.

### D6 qualification and US4 specification checkpoint — 2026-10-17

D6-final-scoped-gate.json returns ok:true: 1,032 distinct application tests across48owners (all1,008prior cases retained),413native tests across50owners plus1inherited TODO,433clean workflow scenarios,54isolated genuine browser scenarios and12current native fault checks. The current source/counter maps meet every unchanged threshold. Both builds and93-file action manifests, types, global lint(0errors/6inheritedwarnings), formatting and migration policy pass. DEF173 is Verified; all173canonical defects are Verified. The interrupted and mixed-counter runs remain rejected diagnostics. Current input manifests retain1530independent inputs and100native inputs.

T520/T522/T523/T524 are complete. T521 and official packaged/native/global release gates remain required at final integration; no release approval is claimed. D6 is19/23qualified delivery slices. US3 registry execution fields point to the current qualified checkpoint without duplicating mutable results in relationship tables. The existing26approved US4 scenario declarations and their planned registry/source mappings were verified, preserving tags and outer/inner roles; T525–T551 are complete. No future executable binding was added during validation. Continue into E1 one behavior at a time. Overall task count is795/1018; estimated effort approximately91%.

E1 starts with A96/U96, as documented in the ownership amendment. E1-standby-clean-red.log proves real endpoint absence at the Then assertion (expected200/actual404) after valid persisted active-session setup; cleanup succeeds. DEF174 corrects the test-only expected DELETE204status, and its initial dual-failure run is rejected. E1-standby-policy-red.log imports a type-only contract scaffold successfully and fails the named required-function assertion, not module loading. No production behavior existed before these Reds. T555/T562 are materialized; their batched Red/Green gates remain constituent-incomplete. Implement only the current generated-standby policy first, then its authenticated delivery prerequisites, keeping the broader browser acceptance loop open.

E1 U96 inner Green: E1-standby-policy-green.log passes the complete current branding owner. The minimal policy classifies Clipify-generated surfaces against the admitted owner's Runner Pro flag and does not mutate authority. No refactor is needed at this size. A96 stays Red until its authenticated presentation and frontend prerequisites are implemented; proceed to the existing U148 bootstrap ownership contract within the same outer loop, one constituent at a time.

E1 U148 bootstrap ownership Red is recorded in E1-bootstrap-owner-red.log before handler behavior: its type-only route contract loads but POST is absent. The case includes both authorized scoped bootstrap and foreign-owner denial, preventing an always-deny handler from passing. Implement that binding now; remaining CON012 expiry/session/query/ordinary-rendering constituents remain pending.

E1 U148 ownership contract Green: E1-bootstrap-owner-green.log passes the complete current API owner. Bootstrap resolves the bearer-authenticated Runner, assigned owner/session and admitted generation, issues only a scoped HTTP-only credential, and rejects the foreign-owner row without a cookie. Parent CON012 stays incomplete for its remaining constituent contracts. The browser outer loop remains open. Continue with U266 signed-cookie session binding before implementing its verifier.

E1 U266 Red: E1-bootstrap-session-red.log has1pass/1intendedfail. Existing owner authorization remains Green; the new signed-cookie session verifier is absent at its named assertion. The test mints a real signed bootstrap first, requires acceptance for its original session, then denial for another session. Implement that verifier without weakening signature/issuer/audience/time validation.

E1 U266 Green: E1-bootstrap-session-green.log passes2/2current API cases. Real signed context is accepted only for its bound session; another session returns null. Signature, purpose, issuer/audience, bounded lifetime and server clock are checked. Parent CON012 remains incomplete. Next characterize the explicit expiration boundary (U267) against that already-required JWT validation; do not disable a correct library guard to invent Red.

E1 U267 is an honest retained baseline: E1-bootstrap-expiry-baseline.log passes3/3current API cases, accepts the signed credential one millisecond before expiry and rejects it exactly at/after expiry. The already-required JWT verifier is correct; no artificial Red or production change is introduced. Add a fresh-revocation guard case next under the existing bootstrap contract before frontend delivery.

E1 revoked-generation guard Red: E1-bootstrap-revoked-red.log has3pass/1intendedfail; an active row with revokedAt still receives200 rather than403. This is the current bootstrap behavior gap exposed before its fix, not a prior completed-slice regression. Add the missing revocation fence, then rerun the same whole owner.

E1 embedded route Red: E1-embedded-route-red.log retains16existing passes and fails only the private generated-presentation path. Enrollment and similarly named ordinary pages remain explicitly ordinary. Register the narrowly scoped private media prefix so consent/support widgets are not captured; rerun the whole owner.

E1 revocation Green/refactor: E1-bootstrap-revoked-green.log and E1-bootstrap-owner-refactored-green.log pass4/4current API cases. Shared live assignment resolution now protects both issuance and renderer reads, including credential rotation binding, assigned owner/session/generation, optional exact admission identity and revoked/terminal rejection. E1-embedded-route-green.log passes17/17, preserving ordinary enrollment and similarly named routes. Implement the already-Red A96 authenticated frontend using that resolver, existing safe public-runtime access decisions and the existing logo; ordinary overlays remain unchanged. Initial default-corner attribution follows the approved fixed scaled dimensions/opacity. E2 collision selection and additional E1 source behaviors remain pending.

E1 A96 outer Green: E1-standby-browser-green.log passes1/1genuine browser case in12.9seconds after the current successful build and type check. Real disposable owner/device/session/generation/admission resolves through the API, browser cookies and server-rendered private page; both attribution lines are visible. E1-standby-scoped-lint.log has no findings. Its server lazy-module invariant and fake provider invalid-client/no-token diagnostics exactly match the already documented pre-feature successful /tmp/clipify-local-test-browser.log195–199 and A1/A2 acceptance logs. This is inherited baseline evidence under the existing non-regression rationale, not a newly waived failure or intended Red. No additional defect or retry is required for those known diagnostics. Native CLI routing, remaining E1 surfaces/security constituents, E2 placement and all later gates remain pending.

### E1 U268 — existing forged-flag policy characterized
Whole API owner: `E1-forged-policy-baseline.log` (5 passed). Real generated-source browser: `E1-forged-flags-browser-baseline.log` (1 passed), including reload with watermark=false, runnerPro=true and attributionRequired=false. Server-owned admission policy and safe relative URL remain authoritative. No production change or artificial Red. `E1-free-standby.png` visually reviewed: both attribution lines and existing Clipify logo are readable; final collision placement remains E2. Scoped E1 lint log is empty/successful.

### E1 native authenticated transport and non-throwing startup refusal

Transport owner `packages/runner/src/__tests__/presentation-bootstrap.test.ts` complements CON012, without duplicating the browser acceptance. `E1-native-bootstrap-red.log` proves the missing callable (module itself loads); `E1-native-bootstrap-green.log` passes after scoped cookie transport. `E1-native-bootstrap-identifiers-red.log` proves a malformed assignment still sent a credential-bearing request, then `E1-native-bootstrap-identifiers-green.log` passes both cases after rejecting malformed IDs before transport. Cookie remains browser-session scoped, avoiding dependence on the gaming PC wall clock; redirects are rejected and navigation is fixed to the assigned private route.

`E1-native-engine-route-red.log` has 28 existing tests Green plus intended missing bootstrap invocation; `E1-native-engine-route-green.log` passes29. `E1-native-runtime-refusal-red.log` has95 existing tests Green plus refusal incorrectly claimed active; `E1-native-runtime-refusal-green.log` passes96 after handling returned false and persisting the normal stopped receipt only after output closure. `E1-native-engine-refusal-red.log` has29 Green plus expected false/actualundefined; `E1-native-engine-refusal-green.log` passes30 after returning refusal through Engine.start. No expected presentation denial is thrown or sent to Sentry. Native CLI adapter, readiness, refresh and cache integration remain pending; no E1 milestone qualification claimed.


### E1 ordinary overlay, generation fence and real CLI adapter

U269 is an honest existing-behavior characterization: `E1-ordinary-overlay-baseline.log` passes all6 API-owner cases, including invocation of the actual ordinary page with forged Runner flags, original secret lookup/touch, exactly its original player, and no generated wrapper. No ordinary-page production change.

`E1-generation-renderer-red.log` fails only on the missing generation attribute after authenticated navigation; `E1-generation-renderer-build.log` and `E1-generation-renderer-green.log` pass with the server-verified generation attached to the private wrapper. `E1-native-readiness-red.log` (29 pass/1 intendedfail) and Green (30pass) require matching DOM generation and existing playback bridge before capture. `E1-native-cli-route-red.log` proves the actual compiled production CLI factory omitted presentationSessionId; Green retains its old-generation cleanup assertions. `E1-native-cli-refusal-red.log` proves the adapter converted a normal Engine refusal into a running state; Green verifies returnedfalse, stopped state and cleanup. Readiness-denial handling, refresh, cached starts and full native-media qualification remain pending.


### E1 bounded cached access, expiry precision and native refresh

`E1-cached-presentation-red.log` proves already-issued current scheduled authorization was refused403 (6 existing cases pass); Green passes7 after permitting only issued Pro cache authorizations inside the captured half-open window with live lease/protocol/dispatch evidence. Actual issuer state is `authorized` (not reserved); no admission mutation or occupancy release occurs during presentation preparation. `E1-cached-window-baseline.log` characterizes start-1/start/end-1/end and passes11. Pending/revoked/expired authority remains denied.

U267 precision extension: `E1-expiry-subsecond-red.log` (11pass/1 intendedfail) reveals nominal expiresAt was later than JWT's second-precision expiration for issuance1000123. `E1-expiry-subsecond-green.log` passes12 after deriving the response timestamp from the same floored signed time. Original baseline evidence remains genuine; only the new subsecond variant required a change.

`E1-native-readiness-refusal-red.log` (30pass/1 intendedfail) and Green31 require a missing/mismatched rendered generation to return ordinary refusal before any capture, without forwarding private browser diagnostics. `E1-native-cookie-refresh-red.log` (31pass/1 intendedfail) and Green32 prove renewal at300seconds, no navigation, stopped timer after closure. `E1-native-refresh-cancel-red.log` (32pass/1 intendedfail) and Green33 prove shutdown aborts an in-flight credential request and does not install into a closed browser. Fetch retains the10second bound and refresh does not interrupt an admitted current clip on transient failure.

`E1-private-deployment-red.log` (15pass/1 intendedfail), Green16 extend the existing long-lived deployment recovery classifier to the exact private source route. No regular enrollment/dashboard path becomes long-lived. DEF175 is Verified with current native types and the complete transport owner.


### E1 ordinary output and private renderer characterization

A98/U98 are BASELINE, with no artificial missing-behavior Red. `E1-ordinary-policy-baseline.log` passes2 policy cases. Current `E1-ordinary-browser-build.log` succeeds; `E1-ordinary-browser-corrected-baseline.log` passes2 real browser cases (A96 and A98) after correcting only the invalid idle-video readiness assertion under Verified DEF177. Registry and scenario owner updated without changing FR-016, behavior text, role mappings or stable IDs. `E1-renderer-authority-baseline.log` passes15 internal cases, including real private Page composition, captured source/Free policy, foreign-source denial before access, and capability denial without private details.

`E1-private-cli-media-green.log` passes all4 existing real Chromium/FFmpeg schedule transition cases (114.9s). The loopback media fixture now issues a private cookie only for registered signed fixture assignment IDs/generations; native navigates with that cookie and renderer bridge/generation. Handoff source verification now reads the fixture's server-owned source marker from the authenticated presentation rather than a public secret-bearing URL, preserving the original actual-source assertion. Existing final-frame/closure/handoff/continuity assertions remain. This is actual native/media compatibility evidence, not a substitute for the real web auth/source tests or the official packaged startup gate.


### E1 bootstrap input bounds and complete authorization owner

`E1-bootstrap-body-bound-red.log` passes15 existing cases and intentionally fails oversized valid JSON (expected413/actual200); Green passes16 after a4KiB streamed request limit rejects before DB access and releases/cancels its reader. `E1-bootstrap-authority-negatives-baseline.log` passes the complete27-case API/renderer owner, including wrong token/device/owner/session/generation, terminal/revoked admission, rotation after issuance, missing/tampered cookie, scoped response, expiry and ordinary overlay. Existing guards receive honest baseline evidence. All U148/U266–U269 constituents now have executable evidence; CON012 and its whole-file Red/Green tasks are Green. This does not qualify E1 or its still-unbuilt playback/live-fallback acceptance behaviors.


### E1 A94/U94 — actual generated playback baseline

`E1-media-fixture-environment-red.log` proves the controlled browser environment omitted the media preload (15 existing cases pass); Green16 follows explicit disposable-provider-only registration. The media transport reuses the repository's loopback HTTP/HTTPS provider interception pattern and validates a seeded playlist clip/owner in the disposable DB. It serves the checked-in14,098-byte generated30second H264 fixture, including Range requests; browser CI needs no new FFmpeg dependency. Authentication, bootstrap, source lookup/authorization, playlist/cache selection, real MP4 decoding and OverlayPlayer rendering remain actual application paths.

`E1-playback-internal-baseline.log` passes46 focused cases. `E1-playback-fixture-types.log` and `E1-playback-browser-typed-build.log` succeed after Verified DEF178/179 test setup corrections. `E1-playback-browser-typed-baseline.log` passes3 actual browser cases: standby+forged flags/generation, ordinary output without branding and generated playback with currentTime>0.2 and visible two-line attribution. `E1-free-playback.png` visually reviewed at1920x1080; fixed dimensions/translucency match the contract. A94/U94 are honest BASELINE, because the existing generated wrapper already handles playback. No artificial feature Red or E1 milestone qualification claimed. The observed invalid fixture Twitch-token/avatar diagnostics remain the previously documented pre-feature baseline; playable transport itself is controlled and passes.


### E1 live/generated/returned-live boundary — existing behavior characterized

`E1-fallback-policy-baseline.log` passes4 pure-owner cases. FR016/OPT055/OPT057 share one policy-transition case and one genuine boundary journey, preserving stable IDs/roles while counting each physical execution once. The native probe compiles the actual Engine with only installed dependency paths/home isolated, sends credentials over stdin (not argv), bootstraps the real authenticated private Page, and publishes actual red video/audio through the Runner's OBS RTMP input. Real loopback receiver files are decoded to RGB samples: live/returned need>50,000 red and<5 white pixels; actual playing generated fallback needs>30,000 blue and>40 white attribution pixels. Source playlist/cache/media decoding and server ownership remain real; only third-party media transport is controlled.

`E1-fallback-browser-baseline.log` is rejected due Verified DEF180 cleanup, not feature Red. `E1-fallback-cleanup-baseline.log` passes all4 focused browser/native journeys in37.8s; native boundary21s. A16/A95/A97 and U16/U95/U97 are BASELINE because frontend capture and incoming copy forwarding already compose correctly. No production change or artificial Red. E1 implementation/refactor tasks are complete; T676 full affected coverage/integration qualification remains open, including the root MCP native HTTP fixture's new private-presentation integration. No E1 milestone or feature completion claimed.


### E1 qualification continuation — mandatory downgrade coverage ownership

The default source/collector inventory omitted `src/server/entitlements.ts` despite its retained downgrade tests. Added one whole-owner inventory regression: `E1-downgrade-collector-red.log` records24 passed/1 intended failure on the missing manifest entry. Added the flat module to the canonical coverage manifest and Jest collector; `E1-downgrade-collector-green.log` records25 passed. No thresholds or existing cases changed. `E1-downgrade-coverage.log` and `E1-downgrade-coverage-results.json` retain34 passing cases across both complete owners with current coverage. This is coverage-tooling remediation, not a new primary acceptance artifact or a qualified E1 gate. Full native milestone run is now active; workflow/browser/static/build qualification remains open.

### E1 complete native milestone candidate and static checks

`E1-native-candidate-coverage.log` / `E1-native-candidate-results.json`: all51 owners pass438 cases with one unchanged inherited TODO. `E1-native-current-inventory.json` proves all413 D6 cases and the TODO retained with103 unchanged source/execution inputs. `E1-native-candidate-gate.json` passes unchanged critical95/90 and ordinary90/85 thresholds, including the new critical native presentation bootstrap; ordinary aggregate S92.20/B85.44/F92.67/L96.15. This is an affected native checkpoint, not whole-feature qualification.

Current E1 app/native TypeScript commands exit0. `E1-final-app-lint.log` retains0 errors and6 inherited warnings. `E1-final-migration-policy.log` passes11 checks. After normalizing the three changed planning documents, `E1-final-format.log` passes all changed supported files. Complete current workflow coverage is now running under its sole owner with a fresh job namespace; E1 T676 remains open until workflow/browser/build/fault evidence is complete.

### E1 complete current workflow and merged application coverage checkpoint

`E1-final-workflows.log` passes all433 scenarios in9.3minutes. The workflow owner completed `coverage/workflows/lane.json`, retained the complete scenario inventory, and removed its raw/probe producer artifacts after remapping. `E1-workflow-execution-inputs.json` verifies all1,553 source/execution inputs remained unchanged through the run.

`E1-scoped-coverage-candidate.json` passes every affected critical/ordinary source threshold using current whole-owner app/repair/downgrade and current complete workflow counters. Counter maps must match exactly; old changed-route/embedded counters are excluded. The previously incomplete runners/workflow branch evidence is supplied by its real workflow owner, not synthetic duplicate tests or relaxed thresholds. E1 T676 stays open pending current builds, affected browser suite and fault checks.

### E1 current fault strength and restored Green

`E1-current-fault-results.json` kills/restores all12 lifecycle faults against current source, retaining exact whole-owner assertion evidence in `E1-current-mutant-*.log`. `E1-presentation-fault-results.json` kills/restores four new faults: missing required Free attribution, missing admission-owner binding, insecure HTTPS presentation cookie accepted, and stale document generation accepted despite a valid bridge. Each uses the whole owning test file without coverage and fails its intended assertion, not syntax/setup.

After exact source restoration, `E1-native-faults-restored-green.log` passes170 cases across5 complete native owners; `E1-app-faults-restored-green.log` passes43 across2 complete app owners. These are repeated strength checks of existing cases, not additional distinct acceptance executions or a second coverage owner. Current standalone build is running; browser build/58 owning journeys remain before T676.

### E1 completed affected-slice checkpoint — T676

`E1-final-scoped-gate.json` passes all current-source conditions. Application:1,161 cases/58 complete owners, retaining all1,032 D6 and all1,143 original E1 candidate cases. Native:438/51 plus one inherited TODO, retaining all413 D6 cases. Complete workflows433; browser58/58, retaining all54 prior cases and four genuine presentation/media cases. Six acceptance artifact labels map to these four physical presentation journeys; the shared live/fallback/return journey is counted once.

Actual encoded output has0 white pixels for incoming/returned live video and69 attribution pixels inside the measured badge rectangle during actual generated clip playback. The JSON observation is retained. Both current app builds and95-file action manifests pass; local Linux packaging/self-test passes. Types, lint0errors/6inherited warnings, format and11migration checks pass;16 deliberate faults killed/restored. Exact source/execution inputs are unchanged. Full native platform matrix and integrated feature gates remain pending, never inherited or claimed here.

A16/A94–A98 remain DONE or honest BASELINE with all associated inner behaviors DONE/BASELINE. T813/T891–T895 and T676 are now checked.20/23 slices qualified; E2–E4/F1 mandatory; overall feature remains No-Go. Begin only E2's next atomic test-first behavior after this checkpoint.

### E2 green structural prerequisite before A17

Reuse the existing real presentation fixture instead of constructing another setup. E2-fixture-seam-extraction.json proves the function body byte-identical; the helper exposes only the already-returned owner-cookie type in addition to its existing state. `E2-fixture-seam-green.log` passes all4 existing presentation/media journeys in37.1seconds against the unchanged successful E1 browser build. No assertion or product behavior changes. The focused E2 browser owner is reconciled in plan/tasks/registry; all prior browser owners remain in the slice completion gate. A17 is now the sole new executable appearance case, before any E2 production change.

### A17 outer Red — preferred top-left placement

Command: `bunx bddgen --config playwright.config.ts` then `bunx playwright test --config playwright.config.ts --project=bdd-chromium '/\.features-gen/bdd/runner-branding\.feature\.spec\.js$' --workers=1` against the unchanged successful E1 build. E2-top-left-outer-red.log fails the sole A17 case in Then at `The owner must have an attribution corner selector`, with `Error: element(s) not found`. No E2 product code exists yet. A17/BDD-US4-FR017 is RED; T573 materialization is complete.

Rejected initial attempt: E2-top-left-outer-fixture-failure.log failed at the connected-only Stream Configuration setup heading. DEF-US4-183 records the exact DOM and correction to the existing always-available Destinations heading; the subsequent intended Red verifies the fixture fix. No placement assertion was weakened. Next is U17's internal preferred-position rule, one test first.

### U17 inner Red — reference top-left placement

Command: `bun run test --runInBand --runTestsByPath test/server/runner/branding.test.ts --coverage=false` (profile has no single-test command). E2-top-left-position-red.log retains all4 E1 policy cases passing and the sole new TDD-US4-FR017 case failing: `Expected: Any<Function>` / `Received: undefined`. U17 is RED before adding the missing placement function. The first example specifies a24px reference edge margin without mutating input geometry; the outer A17 remains RED until persistence/preview wiring exists.

### U17 first-example Green — minimal reference placement

E2-top-left-position-green.log passes all5 current whole-owner cases after adding only the reference top-left placement result. This is the playbook's minimal first example, not a claim that all corners, scaling or persistence are implemented. No structural cleanup is warranted for this three-line function yet. Next triangulation uses the actual720p output edge margin before client extraction/wiring; A17 stays RED.

### U17 triangulation Red — actual720p output

E2-top-left-scale-red.log uses the same whole-file no-coverage command and retains5 passing cases. The new720p example fails exactly `- "left":16 / + "left":24` and `- "top":16 / + "top":24`. This forces proportional reference margins; no preview/appearance production is wired yet. The first1080p example remains unchanged.

### U17 proportional placement Green and pure-client seam refactor

E2-top-left-scale-green.log passes all6 whole-owner cases after deriving the24px reference edge margin from output height. No other corners, collision or paid appearance behavior was added. Extract the identical pure placement function to src/app/lib/runnerBrandingLayout.ts, retaining its server re-export and existing tests; E2-position-extraction.json records byte identity. Re-run the whole6-case owner before beginning persistence work. U17 remains GREEN while its state/validation wiring is unfinished; A17 remains RED.

### U17 pure placement checkpoint and discovered persistence examples

E2-position-refactor-green.log passes all6 current owner cases after the byte-identical pure-client extraction; U17 geometry is DONE. A17 stays RED. The already-approved branding profile design exposes distinct persistence/authority examples not separately listed by the original broad U17 row; append U278–U284 and atomic tasks T1019–T1026 under the existing TDD-US4-FR017 artifact. They preserve owner/revision, no partial writes and default behavior already required by plan/data-model; no new feature or execution owner is introduced. Materialize only U278 first through the existing loopback probe infrastructure.

### U278 intended Red and rejected interrupted patch

`bun run test --runInBand --runTestsByPath test/server/runner/branding-profile.test.ts --coverage=false` in E2-profile-first-controlled-red.log fails at `expect(result.available).toBe(true)`: `Expected:true / Received:false`. The existing loopback auth/database fixture reaches the absent persistence boundary before implementation. The new schema/save implementation is authorized only by this retained Red.

DEF-US4-184 records an orchestration mistake after that Red: malformed new test-list rows prevented the state update; the shell continued into an unreferenced draft and a still-Red seven-case run. E2-profile-first-blocked-patch.log is not Green evidence. Seven rows are corrected to the established six-column table and U278=RED is verified. Further mutation batches are fail-fast. No acceptance assertion or test threshold changed.

### U278 first-save Green; successful edit constituent listed next

E2-profile-first-green.log passes both complete current owners,7/7. The new preference is persisted and read back from real disposable PostgreSQL with one owner-bound profile and revision1; the six earlier geometry/policy cases are retained. Only the profile/position schema and first insert are implemented, with no public action/UI exposure. U278/T1019 is complete. Additional owner/revision/validation/rollback constituents remain pending.

Separate successful edit from refusal/rollback: append U285/T1027 before U279. A valid second save must keep profile identity and advance revision once; a stale refusal must preserve state. This clarifies the existing approved revision/persistence requirement, not a new feature. The primary artifact now owns both complete pure/profile files, with explicit task bindings for all discovered technical units.

### U285 Red — valid edit preserves profile identity

E2-profile-update-red.log runs both complete current owners without coverage:7pass/1 intended failure. The existing insert-only boundary throws on a valid second save, observed as `Expected:false / Received:true` for updateThrew. The probe catches only to report the actual outcome; the test requires no throw, success, unchanged profile ID, revision2 and persisted bottom-right state. First-save and all pure placement cases remain unchanged. Add only the valid update path before stale/authority cases.

### U285 valid-edit Green

E2-profile-update-green.log passes8/8 across both current owners after adding only the existing-profile update path. Profile ID remains unchanged and persisted revision advances exactly1→2; the first-save and six pure cases remain Green. No cleanup beyond the shared return view is needed at this small step. Next is U279's stale-revision refusal, before public appearance wiring.

### A17 discovered saved-read constituent

Append U286/T1028 before read implementation: saved reads must return persisted owner-scoped corner/revision and exclude private Runner credentials. U284 separately specifies the no-row default with no insert. Both are already implied by the approved persistence/preview and safe-response design. Keep one existing TDD-US4-FR017 artifact and its whole profile owner; no extra acceptance journey or product feature.

### U279 sequential stale-edit Red

E2-profile-stale-red.log runs both complete current owners without coverage:8pass/1 intended failure at `expect(result.result).toMatchObject({ success:false, code:"CONFLICT" })`. The insert/update implementation currently accepts the stale request and changes persisted state. The test also requires no throw and unchanged original corner/revision. Add only normal stale-revision refusal; concurrent delivery will be checked separately before closing this invariant.

### U279 sequential refusal Green; concurrent triangulation next

E2-profile-stale-green.log passes9/9 complete current owner cases. Stale requests return a normal CONFLICT object without changing the saved corner/revision or throwing. Before closing U279, add one real simultaneous-edit example under the same optimistic-revision invariant. Reuse the existing PostgreSQL blocker/pg_stat_activity pattern from runner-free-pro-probe.ts; no mocked concurrency or test-name filtering.

### U279 concurrent-edit Red — genuine lost update

E2-profile-race-red.log passes9 cases and fails the new simultaneous-edit example: `Expected length:1 / Received length:2` accepted saves. Both requests are observed waiting on real PostgreSQL locks before release, and neither settled early. Both then claim revision2 with different corners, demonstrating a lost update. Use compare-and-update on the expected revision and return a normal CONFLICT when the write loses; no time tolerance or assertion changes.

### Distinct absent-profile concurrency example listed

Append U287/T1029 for simultaneous first saves at revision0, distinct from U279's existing-row stale compare-and-update. It depends on the owner-authority transaction seam U280, which is already required before public wiring. If that established owner serialization already satisfies U287, record a genuine baseline with a deliberate mutant rather than introducing duplicate conflict machinery or a false initial Red. No new product feature or primary artifact.

### U279 concurrent revision Green

E2-profile-race-green.log passes10/10 current cases. The expected revision is part of the SQL update predicate; an empty returning result produces a normal CONFLICT. The real lock-barrier example now observes exactly one successful update, one conflict, a single profile and revision2. No retries, sleeps or assertions were loosened. U279/T1020 is complete. Next U280 tests current owner authority before public action/UI wiring.

### U280 owner-authority Red

E2-profile-authority-red.log runs both whole owners without coverage:10pass/1 intended failure. After the real actor's creator membership is removed, the current persistence seam still returns `success:true` instead of `{ code:"ACCESS_DENIED", success:false }`. The profile changes when it must remain at its original corner/revision. Add the existing owner-locked authorization boundary and normal denial mapping before any public appearance action exists. Retain the real concurrency barrier unchanged to verify serialization still meets the revision contract.

### U280 role-denial Green; Runner identity binding next

E2-profile-authority-green.log passes11/11 current whole-owner cases. The shared owner-locked authorization transaction checks current creator membership, and known authorization denials return normal ACCESS_DENIED values. Existing first/valid/stale/concurrent writes remain Green under this serialization. Next triangulation is an authorized creator naming another owner's Runner ID; a database FK rejection alone is not an acceptable user-error response.

### U280 foreign Runner binding Red

E2-profile-foreign-runner-red.log retains11 passing cases and one intended failure at `expect(result.updateThrew).toBe(false)`. An actor authorized for the requested creator names another owner's Runner. The composite FK correctly prevents insertion, but the service throws a system error instead of a normal RESOURCE_UNAVAILABLE result. Add the owner-scoped Runner lookup inside the authorized transaction before the profile read/write; preserve both owners' data.

### U280 owner/Runner binding Green

E2-profile-foreign-runner-green.log passes12/12 current cases. The authorized transaction now verifies the Runner belongs to the requested owner before profile access, returning RESOURCE_UNAVAILABLE instead of provoking a foreign-key exception. Revoked membership remains a normal ACCESS_DENIED; both profiles stay unchanged. U280/T1021 is complete. Next U287 checks the distinct simultaneous-first-save invariant through the established owner-serialized transaction, with honest baseline handling if it already passes.

### U287 honest existing baseline, detected mutant and restored Green

E2-profile-create-race-baseline.log passes13/13 without a production change: the already-established owner-locked transaction serializes revision0 creation. Do not invent an initial Red. E2-profile-create-race-mutant.log bypasses only that authorization/serialization guard and specifically fails U287's no-throw concurrent-creation assertion. E2-profile-create-race-mutation-result.json verifies status1, detected U287 failure and exact source restoration. E2-profile-create-race-restored-green.log then passes all13 current owner cases. U287 is BASELINE and T1029 complete. Next U281 validates unknown corner input as a normal business response.

### U281 invalid corner Red

E2-profile-invalid-red.log passes13 cases and fails the new malformed-corner example: `Expected:false / Received:true` for updateThrew. Persistence remains unchanged because the database rejects the enum, but user input must be validated and returned normally before reaching storage. Add strict request validation using the schema's four corner values; retain owner/revision checks and every prior test.

### U281 strict input validation Green

E2-profile-invalid-green.log passes14/14 current cases after strict request parsing against the schema's corner enum, bounded owner/Runner identity and expected revision. Invalid user data returns INVALID_INPUT without a database exception or partial write. All ownership, valid/stale saves and both race examples remain Green. U281/T1022 complete. Next U282 uses the existing real transaction-port failure approach to observe a completed write inside the transaction and retained old state after forced rollback.

### U282 honest rollback baseline and escaped-write mutant

E2-profile-rollback-baseline.log passes15/15 without a production change. The injected real transaction port observes bottom-right/revision2 inside the transaction, then fails before commit; an independent read retains top-left/revision1. The test accepts an unexpected storage exception or a normal SERVICE_UNAVAILABLE outcome, never false success.

E2-profile-rollback-mutant.log deliberately moves only UPDATE from tx to the supplied outer client. U282 fails on actual persisted bottom-right/revision2 instead of the required original state. E2-profile-rollback-mutation-result.json verifies this specific wrong-state detection and exact source restoration. A10second per-statement bound applies to both the fault run and the restored run; no timeout assertion is relaxed. E2-profile-rollback-restored-green.log passes15/15. U282 is BASELINE and T1023 complete; no fabricated initial Red or extra production write is introduced.

### U284 default-read Red

E2-profile-default-read-red.log passes15 cases and fails the sole new default-read example at available: `Expected:true / Received:false`. A new owned Runner has no profile row; reading must return bottom-right/revision0 without creating one or leaking its token. Add only the authorized no-row read boundary, then test persisted reads separately before UI wiring.

### U284 default-read Green

E2-profile-default-read-green.log passes16/16 current cases. The new authorized read boundary returns virtual bottom-right/revision0 without inserting any row; the actual Runner token is absent from the response. This first example covers no saved profile. U284/T1025 complete; U286 now forces persisted preference retrieval before UI wiring.

### U286 saved-read Red

E2-profile-saved-read-red.log passes16 current cases and fails the persisted-read example: returned `{ id:null, revision:0, watermarkCorner:"bottom_right" }` instead of the owned saved top-left/revision1 identity. The actual database row remains intact and the token must stay excluded. Add the owner/Runner-scoped profile lookup and safe view, retaining the separate no-row default and its no-insert assertion.

### U286 persisted-read Green and shared authorization refactor

E2-profile-saved-read-green.log passes17/17 current cases after querying only the requested owner/Runner profile and returning its safe id/corner/revision view. The no-row default still inserts nothing, and neither response leaks the actual Runner token. U286/T1028 complete.

While both owners are Green, extract the identical read/write authorization transaction shell to one private withOwnedRunner helper. Preserve permission literals, Runner owner binding, known-error mapping, and each caller's authority-current assertion position; only remove duplicated code. Re-run all17 current cases before the next boundary example.

### E2 U283 — saved read authorization baseline and deliberate fault
The complete branding owners passed 18 tests in `E2-profile-foreign-read-baseline.log`. The real disposable database fixture saves legitimately, revokes creator membership, then reads: normal ACCESS_DENIED, no profile or credential, persisted row unchanged. A deliberate bypass of the shared authority guard caused this exact test to fail; `E2-profile-foreign-read-mutation-result.json` records killed=true and exact restoration. Both whole owners then pass 18 tests (`E2-profile-foreign-read-restored-green.log`). This is an honest existing-behavior BASELINE, not an invented missing-feature Red. No further refactor needed in this cycle. No commit; authorized dirty implementation continues. A17 remains Red pending actual UI/preview integration.

### E2 A17 — green extraction and actual route wiring in progress
After the completed U283 cycle, extracted the existing owner/Runner-scoped read/view into `readRunnerBrandingProfileInternal`; both complete branding owners remain 18/18 Green (`E2-profile-read-extraction-green.log`). Added a faithful no-profile database fixture seam before introducing the private-page read; all 39 existing private presentation tests remain Green (`E2-private-read-fixture-baseline.log`). The existing A17 missing-selector outer Red now drives owner actions, the two currently proven corner options, session-authorized preview and the native generated page using the same wrapper and persisted preference. Complete focused root owners pass 57 tests (`E2-A17-wiring-focused.log`). A fresh owned loopback browser database uses the current schema initializer (`E2-browser-database.json`), with no migration generation/schema-push. Rebuilding current source before browser verification. No A17/T1026/E2 completion claim until the actual browser journey passes; all four-corner/collision/contrast gates remain open.

### E2 A17 — actual top-left journey Green
`E2-top-left-browser-header-restored.log` passes the complete focused browser owner in31.3s after the current-source build `E2-A17-preview-header-build.log`. Owner save/status/reload, actual session-authenticated iframe and native-bootstrap private page all assert the saved top-left corner, both attribution lines, scaled edge margin and56px reference font. The initial frame denial is retained under DEF186. The logged Next lazy-module invariant and fake-provider avatar errors match the explicitly documented Existing baseline diagnostics rationale and retained E1-final-browser.log; no new diagnostic, suppression or test waiver is introduced. T1026 remains pending until the prior whole presentation browser owner and affected wrapper/route owners pass. E2 remains incomplete.

### E2 A17 — retained entry points verified
`E2-wrapper-routes-regression.log` passes19 tests across both complete wrapper/embedded-route owners. `E2-retained-presentation-browser.log` passes all4 prior whole generated-presentation journeys in38.6s, including real encoded live/fallback/return isolation. Together with the current-source top-left browser Green and57 focused runtime cases, this completes T1026 and the A17-only gate T814. E2 itself is still open: other corners/readability/collision plus T677 remain mandatory. No full-feature/release qualification claimed.

### E2 OPT050 — redundant outer identity shares one journey; actual renderer baseline verified
A90 states the same readable top-left preview/generated output criterion already asserted by A17. Attach OPT050 to that existing physical scenario instead of duplicating a browser execution; `E2-top-left-shared-browser.log` passes the current tagged owner1case/33.7s. The original A17 missing-selector Red precedes the implementation and covers that identical acceptance boundary. U90 is a distinct actual-wrapper contract for reference font/logo sizes, both foreground opacities, two text lines, content retention and top-left styles. It passes honestly on arrival (`E2-top-left-surface-baseline.log`), specifically fails when the wrapper ignores top-left (`E2-top-left-surface-mutant.log`), and returns9/9 Green after exact restoration (`E2-top-left-surface-restored.log`; hash/killed/restored JSON). No fabricated initial Red; U90 is BASELINE. T574/T579 complete, all broader multi-corner gates remain open. No commit.

### E2 OPT051 — top-right outer Red
The generalized corner assertion seam retained1/1 top-left Green (`E2-corner-step-refactor-green.log`) before adding the next case. `E2-top-right-outer-red.log` runs the complete two-case focused owner: top-left passes; top-right fails specifically at `The owner must be able to choose Top right` because the option is absent. No fixture/import failure or product change precedes this Red. The original persistence/output assertions remain unchanged.

### E2 U91 — top-right geometry Green; browser verification running
`E2-top-right-inner-red.log` reports9pass/1expected assertion failure: old TL left24/positiontop_left versus requested TR left1216/positiontop_right with a680px badge. Add only TR geometry; wrapper consumes that same resolver for top edge/right margin, and the owner selector gains the already-red TR option. `E2-top-right-inner-green.log` passes both complete owners10cases. No additional refactor is needed at this small branch; the remaining BL/BR behaviors will triangulate common axes. Current-source build and whole two-case browser owner are running; A91 remains Red until actual output passes. No commit.

### E2 OPT051 — whole two-corner browser owner Green
Current build/types/dependency checks pass `E2-top-right-browser-build.log`; the complete focused browser owner passes2cases/45.8s in `E2-top-right-browser-green.log`. Both left and right top edges are measured in the real preview and authenticated generated page after save/reload. This closes A91; broader E2 gate remains open. Next is the single missing bottom-left behavior, not a batch of future Reds.

### E2 OPT052 — bottom-left intended outer and inner Reds
`E2-bottom-left-outer-red.log` passes both prior corners and fails only at the missing Bottom left option. `E2-bottom-left-inner-red.log` passes10 prior cases and fails the actual-height BL geometry assertion (expectedtop916 instead of old24). Add only BL resolver/renderer/selector support. Whole root owners and rebuilt complete three-case browser owner now run; no Green/completion claim yet.

### E2 U92 — bottom-left geometry Green
The two complete affected owners pass11 tests in `E2-bottom-left-inner-green.log`. The actual140px badge anchors at top916,24px from the bottom, without mutating input. The wrapper consumes the same bottom-edge result; the owner option exists. No additional refactor until the remaining BR triangulation is complete; no outer or E2 qualification is claimed while the rebuilt browser gate runs.

### E2 OPT052 — whole three-corner browser owner Green
`E2-bottom-left-browser-build.log` passes current-source build/types and dependency checks. `E2-bottom-left-browser-green.log` passes all3 focused browser journeys54.8s, preserving top-left/top-right and measuring saved bottom-left in both actual surfaces. A92/U92 complete. The now-observable duplicated corner branches will be refactored only after the BR contract is triangulated; all E2 readability/collision/full gates remain open.

### E2 OPT053 — honest outer baseline; inner resolver contract next
`E2-bottom-right-outer-baseline.log` passes all4 actual browser journeys before any BR implementation change. The wrapper's original default already supports saved BR; no missing-feature outer Red is fabricated. U93 now triangulates the separate pure resolver, which does not yet support BR. After its intended Red/Green, consolidate the wrapper and verify the existing outer case with a deliberate fault plus exact restoration before completing its baseline.

### E2 OPT053 — BR shared resolver, per-move green refactor and actual browser fault proof
`E2-bottom-right-inner-red.log` passes11 prior tests and fails BR geometry1216/916 versus old24/24. Minimal BR branch yields12 Green (`E2-bottom-right-inner-green.log`). Consolidate resolver axes, rerun12 Green (`E2-layout-axis-refactor-green.log`), then route every wrapper corner through that resolver and rerun12 Green (`E2-renderer-axis-refactor-green.log`). The prior outer case was already working and is recorded as honest BASELINE, not missing feature Red. A deliberate BR->TL geometry fault then kills U93 (11pass/1expectedfailure) and only BR in the real browser owner (3pass/1expected geometry failure); fault build itself succeeds. `E2-bottom-right-fault-result.json` records current source hash and killed/restored=true. Exact restoration returns12/12 root Green, complete build/types Green and4/4 actual browser Green (`E2-bottom-right-restored-{unit,build,browser}.log`). Thus A93 BASELINE and U93 DONE; four corner-only outer gates now pass. All collision/readability/whole-slice gates remain open; no E2 or release completion claim. No commit.

### E2 mandatory source ownership — intended guard Red/Green
`E2-appearance-source-ownership-red.log` retains25 prior passing policy cases and fails only the new missing placement source inventory assertion. Add the pure resolver, actual owner preview and appearance controls to the canonical feature inventory; resolver and authenticated preview are critical. Add the preview default collector; server profile helpers are already recursively critical. `E2-appearance-source-ownership-green.log` passes the entire26case owner with all existing thresholds unchanged. This is only the mandatory inventory guard under T677, not a coverage qualification; full E2 gate remains open.

### E2 A177 light1080 — intended actual-frame readability Red
The controlled media seam first preserves all8 existing browser/native journeys (`E2-readability-media-seam-restored-green.log`). The initial canvas approach is excluded under DEF189. The corrected real-browser measurement reads actual renderer CSS/geometry and the actual owned media URL/dimensions, independently decodes that static source response with FFmpeg and samples the text's source-frame region. It never changes the player DOM/styles/origin protections. `E2-readability-light-outer-red.log` passes4 prior corner journeys and fails only the new first light1920 example: expected>=4.5, received1.6886777734688359. The preceding actual light-pixel, real playback, size, opacity and unclipped assertions all pass. This valid outer Red precedes every readability production change. Materialize only the first U221 lower-bound example next; dark/busy/mobile examples remain unmaterialized until their own cycle.

### E2 U221 — strict lower-bound contrast example
`E2-contrast-low-bound-red.log` preserves12 prior cases and fails on the absent readability gate. Export the minimum predicate returningfalse for this first example; `E2-contrast-low-bound-green.log` passes all13 cases in the two complete owners. The concrete value4.5-4*Number.EPSILON is representably below4.5. No refactor yet; the exact-boundary example must triangulate the predicate before use in actual rendering. A177 remains Red; no early visual completion claim.

### E2 U222 — exact4.5 contrast threshold Green
`E2-contrast-exact-bound-red.log` retains13 prior passes and fails expectedtrue/receivedfalse at exactly4.5. Replace the first-example predicate with a finite numeric >=4.5 check; both complete owners pass14 tests (`E2-contrast-exact-bound-green.log`), including the representably lower boundary. No extra refactor needed. The actual light-frame outer remains Red; next U193 drives the shared fixed style rather than reducing the threshold.

### E2 U193 / first A177 example — fixed styling Green; scoped test-owner extraction
U193's absent shared-style factory Red precedes implementation (`E2-fixed-style-inner-red.log`,14pass/1expectedfailure). The shared factory preserves56/112 reference dimensions and.85 foreground, uses a still-translucent.65 compact backing, and independently verifies its worst-white contrast above4.5. Actual wrapper/placement consume it; both complete inner owners pass15 (`E2-fixed-style-inner-green.log`). Shared presentation contract is reconciled to.65 with the actual1.69 old-frame evidence; threshold and sizes are unchanged. Current build/types pass `E2-readability-light-build.log`; all5 browser cases pass in `E2-readability-light-browser-green.log`, including both actual surfaces and standby/playback/fallback controls. U193 DONE; A177 only GREEN/in progress, since five remaining background/size examples are pending in E2-readability-example-progress.json. Move the exact Green DEC011 feature/step blocks into their own scoped owner; byte identity and unchanged5case cardinality are retained in E2-readability-owner-extraction.json. T757's broad gate includes both focused owners; no new primary ID or duplicated journey. Run both current whole owners before adding the next example.

### E2 readability owner refactor — all5 existing cases retained Green
`E2-readability-owner-refactor-green.log` passes both complete current feature owners5cases/1.5minutes after the exact block move. No product or assertion change; the dedicated readability owner now contains only its first light1920 example. Add only the next dark1920 example; keep all actual-frame, size/opacity, standby/playback/fallback and private-output checks. Success screenshots are collected within the same journeys for visual review, not a second execution.

### E2 A177 dark1920 — existing behavior baseline, whole scoped owner Green
`E2-readability-dark-baseline.log` passes both current readability examples2cases/36.4s. The new dark fixture is verified from actual decoded source pixels and real playback clocks, not a blank/mock player. All existing dimensions/.85 opacity/min4.5 contrast/clip checks remain. Screenshots are generated within the same preview/output journeys. Visually reviewed `E2-readable-light-1920-output.png`: existing logo and both text lines are clear, inset and unclipped with the stronger compact backing. This is implementer review, not user approval; mobile and collision review remain pending. The dark example is an honest existing baseline; shared matrix fault check remains mandatory. Add only the busy1920 example next.

### E2 A177 busy1920 — all reference backgrounds Green
`E2-readability-busy-baseline.log` passes all3 current scoped examples51.6s. The new actual black/white grid is decoded and sampled from the playing source, confirming both dark and light pixels before contrast assertions. No renderer/product change follows this characterization. First mobile light360 example next; assert the host frame is actually viewport-wide/unclipped and the text retains10.5px minimum. Browser viewport integers may round a half-CSS-pixel iframe, so use measured surface height for the contract's uniform-height scale while independently requiring surface and viewport to agree within half a pixel. No threshold or reference dimension is reduced.

### E2 A177 light360 — intended mobile host Red before CSS
The rejected probe run is closed under DEF191, not counted as feature Red. `E2-readability-mobile-outer-red.log` passes all3 reference-background cases and fails only expected360/actual264 mobile iframe width. Give the appearance Card the existing settings max-width and full available width; on small screens let its16:9 preview extend symmetrically to the physical viewport with no inset border, retaining desktop contained styling. No font-size/opacity/policy change, no new mirrored CSS unit test. Run current inner regressions and rebuilt whole4case browser owner; full visibility/no horizontal overflow and10.5px minimum remain strict.

### E2 A177 mobile matrix — six actual examples Green
`E2-mobile-preview-inner-regression.log` passes all15 scoped inner cases; rebuilt `E2-mobile-preview-browser-green.log` passes four examples after the intended width Red. Dark360 and busy360 were then added separately after each prior Green: `E2-readability-mobile-dark-baseline.log` five pass, `E2-readability-mobile-busy-baseline.log` six pass. Each example measures actual preview and private generated playback/fallback/standby, real decoded background, full-size translucent text/logo and contrast. Retained dark360 preview screenshot inspected. New dark/busy characterizations require completed-matrix deliberate opacity fault sensitivity next; no fabricated initial Red and no acceptance completion yet.

### E2 A177 readability complete — full matrix and deliberate fault verified
`E2-readability-fault-result.json` records the fixed foreground opacity .85 -> .84 fault: owning inner oracle fails, fault build succeeds, all six actual browser cases fail specifically on Received .84. Source restored byte-for-byte (SHA256 recorded). Restored15 inner tests, current build/types and all6 real browser journeys pass (`E2-readability-restored-{unit,build,browser}.log`). All background/size examples are now Green with fault sensitivity, not fabricated initial Reds for preexisting dark/busy behavior. A177 DONE; T974 acceptance gate complete. Full E2 remains open for A178 collision and completed-slice coverage gates.

### E2 A178 visible title collision — intended outer Red
`E2-collision-title-outer-red.log` observes the actual playing clip title panel and positive panel/badge dimensions in the owner preview, then fails specifically on the unchanged12-reference-pixel clearance rule. No mocked rendering or DOM placement. First executable example is bottom-right; all four corners/dynamic visibility/fully blocked cases remain required. Inner U223 is next.

### E2 U223 clearance geometry — Red to Green
Whole-file16-case inner run first rejects current top-left geometry at11px actual separation (`E2-collision-clearance-inner-red.log`,15 retained passes). Pure placement now searches preferred and deterministic alternative corners with12 scaled reference-pixel clearance. All16 owning tests pass (`E2-collision-clearance-inner-green.log`), preserving input geometry. Fully blocked/free-edge handling and exact12 boundary remain pending; no completed collision claim. Wire actual occupied layout measurement to close the existing visible-title outer Red next.

### E2 A178 first actual title avoidance Green
`E2-collision-title-inner-regression.log` passes16 inner cases; `E2-collision-title-build.log` compiles/types current source, and `E2-collision-title-browser-green.log` passes the actual owner preview and authenticated native-page title clearance checks13.8s. Shared renderer now measures visible actual marked title/timer/progress rectangles, responds to DOM/size changes and applies deterministic corner geometry with fixed branding dimensions. No reserved band, shrink/hide, or fake overlay. A178 GREEN in progress only; exact boundary, other preferences, dynamic disappearance/free edges/fully blocked configuration refusal and readiness gates remain pending.

### E2 U224 exact-clearance characterization verified
Exactly12 reference pixels is already valid under U223 implementation. `E2-collision-exact-boundary-baseline.log`17pass. Deliberately changing clearance12 ->12.01 kills only U224 (16 retained passes); exact source restored and17pass (`E2-collision-exact-boundary-{fault.json,fault.log,restored.log}`). Honest retained BASELINE, no manufactured feature Red or production change. Expand actual title collision preferences next.

### E2 A178 four preferences and dynamic visibility characterized
`E2-collision-all-corners-baseline.log` passes4 actual preference cases59.1s with both visible Free title/channel panels. `E2-collision-dynamic-baseline.log` passes all5 cases, adding real fade-out/removal and return to preferred top-left in both owner preview and authenticated generated output. Source unchanged since first actual title fix; these are honest working characterizations, not initial feature Reds. DEF192 verifies corrected Free fixture scope. Edge-position and blocked handling remain open; deliberate whole collision fault sensitivity will follow completed matrix.

### E2 U194 left edge Green, right edge intended Red
Left-edge free-position case fails against corner-only placement (`E2-collision-edge-inner-red.log`,17 retained passes), then passes with viewport-bounded12px-clear free-edge candidates (`E2-collision-edge-inner-green.log`,18pass). The next independently added right-edge example now fails against left-only search (`E2-collision-right-edge-inner-red.log`,18retainedpasses). Keep fixed badge/input dimensions and reject offscreen candidate geometry. Add right-edge search next; full U194 remains RED/in progress.

### E2 U194 edge search Red-Green cycles
Right edge:19-case intended Red then Green; top edge:20-case intended Red then Green; bottom edge:21-case intended Red then Green. Evidence `E2-collision-{right,top,bottom}-edge-inner-{red,green}.log`. Each new geometry example was added only after the preceding whole-file Green, preserves fixed badge dimensions and viewport bounds, then receives the smallest additional edge search. U194 stays in progress until explicit blocked-layout behavior and actual browser regression gates pass. Current source requires rebuild before browser execution; do not reuse prior build after these helper changes.

### E2 A178 fully occupied actual mobile layout — intended outer Red
`E2-collision-edges-build.log` builds/types current four-edge helper. `E2-collision-blocked-outer-red.log` retains5 actual corner/dynamic passes. New fixture retains an admitted Free branding snapshot after owner upgrade and applies allowed Pro scale250/border32; actual panel bounds prove it covers the entire mobile frame. Only the missing Adjust your overlay layout alert fails. No DOM/style manipulation, impossible paid values, or Free runtime-policy bypass. Add explicit blocked geometry before UI handling; save/native readiness refusal remain subsequent required behaviors.

### E2 explicit blocked geometry and preview Green
Valid full-frame outer Red preceded fully occupied geometry inner Red(21retainedpass). Pure resolver now returns explicit blocked instead of any overlapping/smaller/hidden placement. Corrected general readiness marker retains clean-output contract(DEF193);22 complete root cases pass. Current build/types and6 actual browser cases allGreen (`E2-collision-blocked-{inner-restored,build,browser-green}.log`). Invalid preview displays a configuration error screen while retaining measurable underlying layout; root publishes pending/placed/blocked/clean states. U194 DONE for geometry. A178 stillGREEN/in progress: save/native readiness refusal and theme decorations/observer safety, deliberate collision fault and completed slice gate remain required.

### E2 native measured-layout readiness — intended Red
Extend the existing private-cookie/generation native contract owner with collision-readiness assertions, preserving cookie ordering and foreign-generation checks. Whole33-case engine owner retains32passes and fails specifically because pending layout currently returns true (`E2-native-layout-readiness-red.log`). Require explicitly published placed/clean layout in addition to the authenticated generation and bridge; blocked/missing/pending remain unusable. Same TDD-US4-DEC012 artifact now records distinct pure geometry and native enforcement owners, not duplicate browser evidence.

### E2 native measured layout gate Green
Small predicate now requires same assigned rendered generation, actual placed/clean layout status and same-generation player bridge. Whole33 engine cases pass (`E2-native-layout-readiness-green.log`). Pending/blocked/missing statuses are false; original cookie-before-navigation, foreign/missing generation and bridge cases remain green. No exception/business-error policy change. Actual runtime/package completion gates still pending; this unit check is not claimed as encoded native end-to-end coverage.

### E2 owner Save collision refusal — intended outer Red
`E2-collision-save-refusal-outer-red.log` retains5 passes and confirms the blocked preview, then Save fails the missing owner-pane validation message. The new step records the actual owned profile rows before/after and requires no saved status or mutation on rejection. New component availability unit boundary next, before production: an unfinished preview may not trigger a save. No exception/Sentry or backend authority changes.

### E2 unfinished preview persistence — intended inner Red
`E2-preview-loading-inner-red.log` mounts the actual owner card (real HeroUI) with only the external action boundary mocked and an unfinished iframe document. It fails specifically because persistence is already called, before the expected normal retry message. The failed assertion ends before the async action state flush, explaining React act warnings in this intentionally failing run. No mocking of renderer/application policy or reused browser acceptance label. Add bounded current-document/generation/layout validation before the action call; retain actual PG unchanged check in outer owner.

### E2 owner preview availability guard Green
`E2-preview-loading-inner-green.log` passes all23 scoped root cases. Save waits boundedly for its current iframe document URL, expected preview-runner generation and measured placed/clean state; blocked returns a normal adjustment message without calling the action, unfinished/unavailable returns a normal retry after5s. Actual PG unchanged rejection and four retained corner-save journeys require the active rebuilt10-case browser owner before outer Green. No throw/Sentry or privilege/API weakening.

### E2 save preflight actual browser Green
`E2-save-preflight-browser-green.log` passes all10 actual corner-save and collision journeys. Blocked preview Save returns a normal owner message, no saved status and unchanged real PG profile; all4 valid preferences still persist and match actual private presentation. Current source build/typechecks pass (`E2-save-preflight-restored-build.log`), DEF194 Verified. A178 remains in progress for sticky known-conflict handling, occupied-element size/theme bounds and completed fault/coverage/runtime gates. E3 must preserve the blocked Pro-layout fixture through explicit Pro branding opt-in when that setting exists; never remove its conflict assertions just because paid defaults become clean.

### E2 known conflict survives standby — intended outer Red
`E2-collision-standby-conflict-outer-red.log` passes5 retained cases and the first blocked-preview/save assertions, then fails specifically because stopping playback removes panels and incorrectly clears the known layout error. Standby is not an overlay layout adjustment. Keep valid fade-return behavior unchanged while retaining a known conflict until the layout can be positively revalidated. Add a distinct state-lifecycle unit before code.

### E2 sticky conflict inner intended Red
DEF195 fixture correction restores the initial blocked condition without changing product code. Corrected lifecycle unit then fails only after actual React removal/MutationObserver standby transition (`E2-collision-standby-conflict-inner-corrected-red.log`). It mocks only browser layout/resize boundaries; the physical browser owner independently proves the actual frame case. Retain known invalidity when no visible rectangles can positively revalidate layout; unchanged valid fade remains allowed.

### E2 sticky known-conflict inner Green
`E2-collision-standby-conflict-inner-green.log` passes24 root cases. A known conflict stays blocked when all visible panels disappear for standby; a positive actual occupied-layout revalidation may clear it. Valid layouts retain normal fade-return behavior. Before closing the open physical outer loop, verify generation reuse cannot publish stale measured readiness under a new execution generation; this is a distinct inner state invariant under the same collision acceptance criterion.

### E2 measured readiness generation binding — intended inner Red
`E2-layout-generation-inner-red.log` retains sticky conflict behavior and fails specifically because React renders generation second with the first generation’s placed state before remeasurement. The layout boundary changes to an actually conflicting panel without a DOM style mutation, so a fresh same-generation measurement must choose top-right. Bind geometry/status atomically to generation and corner and restart the measurement effect for a new generation; never publish prior layout as new readiness.

### E2 measured layout generation binding Green
`E2-layout-generation-inner-green.log` passes25 root cases. Layout status and coordinates are now one generation/corner-bound result; new generation publishes pending immediately and must measure its own actual panel geometry before placed. Measurement effect restarts per generation; retained same-generation sticky error remains invalid during standby. No old geometry/state is accepted under a new execution identity. Next verify actual occupied-panel ResizeObserver delivery, required for dynamic theme/text geometry.

### E2 occupied-panel size change — intended inner Red
`E2-panel-resize-inner-red.log` retains2 lifecycle cases, then fails because a genuine ResizeObserver delivery for an enlarged visible player panel has no observer subscriber; badge stays left24 instead of safe1216. No style/class/child mutation is supplied, distinguishing font/content sizing from MutationObserver paths. Observe actual marked panels and unobserve removed panels to handle resize without keeping detached clip DOM alive.

### E2 actual occupied-panel resize Green
`E2-panel-resize-inner-green.log` passes26 root cases. Renderer observes actual panel size changes even without a class/style mutation; removed clip panels are unobserved, avoiding detached-node retention. Sticky conflict and generation binding remain Green. Apply formatting-only cleanup, then rerun current source/root/native contracts and rebuild the physical collision owner to close the open standby-conflict outer loop.

### E2 physical standby-conflict loop closed Green
Formatting/refactor retains26 root +33 engine passes; current build/types and6 actual collision journeys pass (`E2-collision-standby-conflict-{build,browser-green}.log`). Both blocked saves leave PG profile unchanged, including after panels disappear for standby; valid fade still returns preferred corner. Next verify preview geometry uses the configured broadcast canvas rather than treating a small dashboard iframe as the broadcast resolution. The visible preview may scale, but collision validation must match the Runner target; otherwise mobile can falsely reject a layout valid at720/1080p.

### E2 configured preview canvas — intended outer Red
`E2-preview-canvas-720-outer-red.log` retains6 passes and fails expected internal1280 versus360 on a physically360px-wide mobile preview for an actual owned720p session. A preview must scale the configured broadcast canvas, not validate a different small broadcast. Before product changes, strengthen the blocked fixture to a valid paid layout with no free region at the actual720p target (not only oversized in a mobile iframe), using real allowed scale/border/position values and a valid wide clip title. Independent all-boundary region search will prove occupancy from actual DOM bounds; retain all blocked-save/standby assertions.

### E2 blocked fixture qualifies before target-canvas product change
`E2-preview-canvas-fixture-qualified-red.log` passes all6 retained collision cases after switching to a valid wide clip title and allowed paid scale250/border32/positions. Independent Cartesian boundary search over actual DOM rectangles proves no free badge region, retaining unchanged profile and sticky-standby assertions. Only the existing expected1280/actual360 target-canvas assertion fails. Product code is still unchanged. Strengthen mobile readability to measure physical transformed font size before introducing a scaled preview canvas; it must retain10.5px, not merely an unscaled internal font.

### E2 physical measurement seam qualified before preview scaling
`E2-preview-physical-measurement-qualified-red.log` passes12 retained collision/readability cases; only expected720p internal1280 versus360 remains Red. All6 readability cases now independently check physical mobile font size including actual embedding transform, retaining10.49 minimum and10.5 reference. Changed owner-card ResizeObserver boundary fixture also passes its whole-file unit (`E2-preview-resize-boundary-unit.log`). Implement a physically bounded scaled720p preview next;1080p will be independently added after Green.

### E2 target720p preview and physical readability Green
`E2-preview-canvas-720-inner.log`26 root passes, current build/types pass, and `E2-preview-canvas-720-browser-green.log` passes all13 collision/readability cases. Real720p canvas remains1280x720 and is scaled into the full-width mobile view; independent physical font metrics retain10.5px. Allowed paid fixture now genuinely leaves no clear region at720p, not only in a mobile-sized broadcast; blocked saves and standby persistence still pass. Add1080p separately next, then wire the saved session resolution into the same preview component. No commercial/tier/quota changes.

### E2 configured1080p canvas — intended outer Red
`E2-preview-canvas-1080-outer-red.log` retains7 collision cases and fails expected1920 versus1280 for an actual owned1080p session. Wire the persisted primary session resolution into preview dimensions and remount the iframe when it changes; retain physical mobile sizing. Use an outside ring instead of an inset border on the16:9 viewport so decoration does not crop a fraction of the canvas. No source/entitlement/price changes.

### E2 configured720p/1080p preview Green
`E2-preview-canvas-1080-inner.log`26passes, scoped lint clean, build/types Green, and `E2-preview-canvas-1080-browser-green.log`14actual browser cases pass. Preview is bound to the saved primary session resolution, renders1280x720 or1920x1080 and scales the full canvas to mobile without overflow or changing physical10.5px attribution. Target changes remount the owned iframe; an outside ring keeps16:9 contents uncropped. Add explicit actual theme-shadow/progress sampling in a separate focused browser owner under the same DEC012 artifact, not duplicate acceptance journeys.

### E2 actual themed shadow — intended outer Red
Focused `E2-theme-shadow-outer-red.log` reaches actual playing Pro title panel in the correctly scaled720p preview, confirms positive dimensions and a real computed outset shadow, then fails its independent shadow-clearance assertion. The current raw border-box placement misses the decoration. Add shared conservative outset-shadow geometry (inset shadows do not expand occupancy), retaining fixed badge dimensions and12px clearance. Separate decoration owner keeps development whole-file scoped without repeating all8 collision cases for every geometry cycle.

### E2 outset-shadow bounds — intended inner Red
`E2-theme-shadow-inner-red.log` retains22 pure/SSR cases and fails only the missing shared shadow-geometry contract. The new invariant includes two scaled outset shadows, excludes inset decoration, preserves the original rectangle and treats no-shadow identity normally. Conservative occupancy uses1.5 times blur radius plus spread/offset at the element’s actual uniform scale; this changes occupied decoration bounds, never attribution size/opacity.

### E2 outset-shadow geometry Green
`E2-theme-shadow-inner-green.log` passes27 whole-file root cases; `E2-theme-shadow-build.log` passes build/types; `E2-theme-shadow-browser-green.log` passes the actual preview/private generated-page decoration scenario. The same renderer now includes conservative scaled outset-shadow bounds, excluding inset shadows, without reducing badge size or clearance. No further refactor needed for this cycle. DEC012 remains in progress pending actual progress/timer sampling and the completed-slice gate. Changes remain uncommitted; no retrospective Red commits are claimed.

### E2 actual progress/timer sampling — honest retained baseline and detected fault
`E2-progress-outer-baseline.log` passes both decoration cases at actual owner preview and authenticated generated playback boundaries. The progress case additionally observes all4 real marked regions. Deliberately ignoring only progress regions preserves the shadow case and fails the progress clearance check: `clear:true` expected / `clear:false` received while `panels:4, progress:true`. Retained `E2-progress-fault-browser.log` has1pass/1expectedfailure. Source exact-restored and hash recorded in `E2-progress-fault-result.json`; restored build/browser qualification is pending. No artificial initial Red is claimed for existing progress placement.

### E2 progress fault exact-restored Green
`E2-progress-restored-build.log` passes current build/types and `E2-progress-restored-browser.log` passes both complete decoration scenarios. The deliberate fault was killed and source restored exactly. Next verify draft corner selection in the real owner preview before persistence; the prior four-corner owner only asserted after Save/reload, so it does not yet establish that editing feedback.

### E2 draft corner preview — intended outer Red
`E2-draft-corner-outer-red.log` retains bottom-right Green and fails only the3 changed-corner previews before Save. Decisive top-left horizontal assertion: `Expected:24 / Received:1218.453125`. The owner selector changes while the iframe still renders the persisted corner. Add an owner-authorized enum-only draft preview parameter; private generated output continues using persisted configuration. Preview readiness must bind the current iframe URL, already enforced by the save preflight.

### E2 draft corner preview Green
`E2-draft-corner-inner-green.log` passes39 whole-file cases including12 real database persistence/authorization cases; `E2-draft-corner-build.log` passes build/types; `E2-draft-corner-browser-green.log` passes all4 corner journeys with the added before-Save assertion, retained Save/reload and private generated-page assertions. The owner-authorized preview accepts only a valid draft corner enum and keys the iframe by the selection; native presentation stays persisted-only. No refactor needed for this behavior; broader E2 scenario gate follows.

### E2 complete watermark scenario checkpoint Green
`E2-watermark-scenarios-green.log` passes all20 scenarios (4corner,8collision/canvas,2decoration,6readability) on the current source/build with no skips. Together with39 current fast owner cases and33 retained native readiness cases, this closes A178's executable collision examples; the complete affected suites/coverage/static/native T677 gate remains pending. Before that gate, add a distinct owner preview authorization-boundary characterization (real persistence has its own existing integration owner). No source refactor or next-slice production begins before this checkpoint.

### E2 preview authorization characterization qualified
New `test/app/runner/appearance-preview.test.tsx` exercises one fail-closed authorization contract over8 request/resource states. Baseline8Green; removing only signed-out principal protection causes exactly1failure/7retainedpasses (`E2-preview-authority-fault.log`), then exact restoration returns8Green (`E2-preview-authority-restored.log`). No initial missing-feature Red or new production is claimed. This route owner checks rendering/secrets under controlled service dependencies; existing real database profile tests retain persistence/revision/authorization ownership.

### E2 authorized draft normalization characterization qualified
The same preview owner now covers invalid/absent draft fallback plus all4 valid enum values, trusted principal/resource binding and actual SSR attribution. Baseline14Green; ignoring only the draft corner kills exactly3 changed-corner cases while11 remainGreen (`E2-preview-draft-contract-fault.log`); exact restoration returns14Green (`E2-preview-draft-contract-restored.log`). These supplement the existing actual browser pre-Save Red/Green, not a second acceptance execution. Start T589 Green refactor: remove an unreachable low-channel branch from the private fixed-color contrast calculation; both known channels are above the sRGB breakpoint. Keep U193's independent piecewise oracle and all public predicate boundaries unchanged.

### E2 T589 refactor qualified
Fixed-color private contrast simplification and touched-file formatting preserve53 complete focused tests (`E2-refactor-inner-green.log`), current build/types (`E2-refactor-build.log`) and all20 browser scenarios (`E2-refactor-browser-green.log`, no skips). Independent U193 piecewise contrast oracle remains unchanged. T589 is complete; T677 remains open. Run a scoped coverage diagnostic over the new/changed owners before the expensive final affected-suite producers; it is not a full coverage qualification and retains the unchanged gate thresholds.

### E2 settings blocked-save characterization qualified
`E2-card-blocked-baseline.log` passes2 complete Card cases and explicitly proves the controlled iframe document URL matches its current source. A real measured blocked state returns the actionable configuration error and never invokes persistence. Substituting a misleading loading message kills only the new assertion (`E2-card-blocked-fault.log`:1fail/1pass); exact restoration returns2Green (`E2-card-blocked-restored.log`). No new production behavior or artificial Red is claimed.

### E2 successful save revision characterization qualified
Ready `placed` and `clean` layouts persist exactly once with displayed expectedRevision0 and show success. `E2-card-save-baseline.log`4Green; incrementing the outbound revision kills exactly2 save cases while2 refusal cases remainGreen (`E2-card-save-fault.log`). Exact source restoration returns4Green (`E2-card-save-restored.log`). This tests the UI revision envelope, distinct from database CAS/rollback and browser persistence journeys.

### E2 failed-save retry characterization qualified
`E2-card-failure-baseline.log` passes6 Card cases. Conflict responses and transport rejection show normal errors, no false success, and retry with unchanged expectedRevision0. Injecting false success into the conflict branch kills only that new case (`E2-card-failure-fault.log`:1fail/5pass), exact-restored6Green in `E2-card-failure-restored.log`. Actual selector interaction remains owned by the4 real browser journeys; do not build a second fake widget merely to reproduce them.

### E2 load-error characterization qualified
`E2-card-load-baseline.log`8Green; denied/failed loads render normal error text with Save disabled and no iframe/persistence. A false-success load message kills only the transport-error assertion (`E2-card-load-fault.log`:1fail/7pass); exact source restored and8Green in `E2-card-load-restored.log`. Add a controlled ResizeObserver size boundary to the existing recorded DOM double and verify both supported broadcast canvases remain physically360px wide, leaving actual browser resizing ownership unchanged.

### E2 resize boundary characterization qualified / DEF196 closed
Initial assertion timing/CSS-key failure is excluded as intended Red and retained under DEF196. Corrected whole Card owner10Green; actual scale(1) fault kills2 resize examples with8retainedpasses; exact-restored10Green. No product changes. Existing actual browser resolution cases retain physical rendering ownership; this internal boundary verifies the ResizeObserver subscription produces the right canvas transform. All196 defects are now Verified; no open/deferred exceptions.

### E2 default service client fixture refactor Green
`E2-profile-default-client-green.log` retains all12 real disposable-PostgreSQL profile cases after invoking public first-save and read services through their default app client. The probe sets DATABASE_URL to its own disposable fixture before app imports; explicit transaction/proxy clients remain for controlled race/storage-failure cases. This qualifies the production-facing default-client path rather than adding a mock-only coverage shortcut; no product behavior changed.

### E2 malformed read characterization qualified
`E2-profile-invalid-read-baseline.log`13Green through owned disposable PostgreSQL. The new malformed request returns normal INVALID_INPUT and preserves the existing profile. Reclassifying only that getter failure as ACCESS_DENIED kills exactly1 new case while12 prior cases pass (`E2-profile-invalid-read-fault.log`); exact source restoration returns13Green (`E2-profile-invalid-read-restored.log`). Public default save/read clients remain qualified against the same disposable fixture. No production change and no initial missing-feature Red claimed.

### E2 six-source coverage qualification Green
`E2-appearance-scoped-coverage.log` passes63 cases/6 complete owning files. `E2-appearance-scoped-coverage.json` evaluates all6 appearance source files with their actual central critical/ordinary classification and unchanged thresholds; ok:true/errors:[] (no exclusions or percentage overrides). This is a scoped coverage checkpoint, not full T677 qualification. The53-case pre-addition source checkpoint remains historical; latest current owner inventory is63. Proceed with static checks then the complete affected62-owner application producer and native/runtime gate.

### E2 complete affected application inventory Green / DEF197 closed
Candidate61 owners pass1214 cases. Omitted whole server-deployment owner passes5 cases under the same source/tooling inputs. `E2-app-current-inventory.json` verifies all62 owners/1219 cases, retained1161 prior E1 cases,1574 unchanged execution inputs and7 previously qualified UUID label normalizations. `E2-app-coverage-merge.json` verifies compatible current maps across29 affected sources. Source was frozen throughout; no missing case or threshold waiver. App template cleanup exits0. Full native candidate begins next; T677 remains open until every required scope passes.

### E2 native fixture contract repaired / complete gate restarted
The first full native attempt is rejected, not feature Red: the external media page omitted the newly required layout marker and was correctly refused. Initial failures are retained under DEF198 and `E2-native-fixture-missing-marker-rejected.log` (stopped exit130 with child cleanup). Only fixture body now declares clean layout; engine guard, generation/auth,30s SLO and all drain/encoded-frame assertions are unchanged. Whole cached-schedule owner passes actual media in20.459s. Native full gate restarts with freshly captured103-input identity; original app1574 manifest remains immutable and its sole native-only fixture delta is explicitly recorded. No complete current native qualification claimed yet.

### E2 complete native inventory and coverage Green / DEF198 closed
Fresh whole package run passes51 owners/438 cases plus1 unchanged inherited TODO in803.012s. All438 prior native cases and103 current execution inputs are verified; only the documented cookie-test title extension is normalized, with its old assertions retained. Unchanged critical95/90 and ordinary90/85 gates pass (ordinary S92.21/B85.36/F92.67/L96.16). Native fixture cleanup exits0. The original rejected log/input manifest remain immutable; complete current native evidence qualifies the explicit external-test-fixture delta without rebasing the application manifest. All198 canonical defects Verified. Fresh433-workflow producer begins next; T677 remains open.

### E2 workflow fixture contract mismatch retained / DEF198 reopened
First complete fresh workflow attempt has428passes/5failures, exclusively the actual multistream media owner. Its external synthetic private page is the second template missing the new clean-layout declaration; dispatch/auth/admission succeed and strict capture is refused. Initial log/input manifest are preserved as E2-workflows-fixture-missing-marker-rejected.log and E2-workflows-rejected-fixture-inputs.json; this run never qualifies coverage. Full search identifies2 synthetic templates, both now updated; production renderer remains measured. Only workflow fixture HTML changed. Native103-input scope does not contain this helper, so native51/438 qualification is unchanged. Whole5-scenario no-coverage owner precedes the fresh433 producer.

### E2 multistream fixture Green; encoded-evidence sink Green refactor pending owner
The complete5-case native multistream workflow owner passes in1.9m after adding only the truthful clean declaration to its unbranded Pro fixture. DEF198 is Fixed pending fresh complete433 workflow coverage; native51/438 qualification remains current. Before the runtime browser milestone, replace its hard-coded E1 observation writer with test.info().outputPath, preserving the same JSON/body attachment/assertions. This low-impact test-orchestration refactor prevents future runs overwriting the immutable earlier checkpoint; E1 bytes are fingerprinted for comparison. Current4-case presentation owner will qualify it; no artificial Red or production behavior change is claimed.

### E2 actual encoded presentation Green / DEF199 verified
All4 current browser presentation cases pass37.3s; current native fallback contains63 attribution pixels at its measured top-right position, live and returned live each contain0 white pixels. Encoded blue phase is established before measuring adaptive placement, retaining original>40 and<5 assertions; no product code or attribution-gated wait changed. Current JSON/3decoded PNGs and qualification are retained at E2 paths, E1 observation hash verified untouched. Diagnostic attachment occurs before assertions for future failures. Formatting changes no helper bytes. Native runtime product source unchanged; browser-owned helper change is qualified by its real4-case owner. Full433 workflow restoration starts next.

### E2 fresh complete workflow and29-source coverage Green / DEF198 and DEF200 verified
All433 native workflow scenarios pass9.8m on current fixture/source inputs, no reduced samples/skips. Strict29-source combined application/workflow coverage passes unchanged thresholds and critical function95 floor. Initial adapter class-instance failure is retained under DEF200; serializing only its in-memory input to plain maps makes validation pass, with raw report SHA byte-identical. All200 canonical defects Verified; all owned workflow templates cleaned. Current presentation4/native51/app62 evidence retained under distinct owners. Remaining E2 work is related browser regression and final static/build checks; T677 is still open.

### E2 browser regression discovery reconciled before execution
Initial discovery query selected only bdd-chromium and listed72; the expected2 ATDD cases belong to atdd-chromium. Add that project before execution; the complete remaining owner list is now74 cases, plus the already-qualified4 presentation cases gives78. This is a successful fail-closed discovery preflight, not a product/test failure or skipped-case waiver; initial bdd-only listing is retained. All58 prior E1 cases will be reconciled by ID/project in the final inventory. No scenario/assertion is changed.

E2 completed-slice qualification: T677 passes. Immutable `tdd/evidence/E2-final-scoped-gate.json` links62 app owners/1219 passes,51 native owners/438 passes plus inherited TODO,433 workflow cases,78 browser cases retaining all58 prior cases, unchanged affected coverage thresholds, full static/build/security/migration checks and local Linux smoke. Reviewed test-only deltas retain original manifests and complete replacement owning evidence; runtime source unchanged. DEF201 whole owner actually has21 tests (earlier prose22 corrected), all assertions retained. E3/E4/F1 remain mandatory; release No-Go.

E3 A18 outer Red: new Pro fixture uses the existing disposable browser fixture and captured Runner Pro admission. `bunx playwright test --config playwright.config.ts --project=bdd-chromium /bdd/runner-free-pro.feature.spec.js$ --workers=1 --grep "A Pro owner chooses a clean generated presentation"` discovers1case and fails at `Pro owners need an explicit saved attribution choice` (switch absent). No runtime changes. DEF202 relative-path discovery was corrected before execution; not product Red. Full owning-file regression remains required at the slice checkpoint.

E3 U18 intended inner Red: entire branding.test.ts runs22 cases,21 retained Green and new Pro saved-choice case Red (`success:false` versus expected true). Existing strict input contract rejects proShowAttribution. Actual PostgreSQL fixture reads missing field safely with to_jsonb; no setup/schema failure. Outer A18 remains Red. Implement the smallest persistence change next; opt-in U133 is not yet materialized.

E3 U18 Green:22/22 whole-file cases pass with the new pro_show_attribution boolean profile field and effective owner Runner Pro validation. Existing caller omission preserves prior preference; first profile defaults false. No generated migration. Refactor review keeps small transaction implementation unchanged. Outer A18 stays Red until authorized preview/UI is connected; next atomic constituent tests preview policy before that code.

E3 U18 preview constituent Red: complete15-case preview owner has14 retained passes and1 intended failure: attributionRequired expected false, received true for an authorized Pro profile. Runtime/UI not changed before this observation.

E3 U18 preview constituent Green: `E3-U18-preview-green.log` passes3 whole files/47 cases without coverage. Authorized Pro preview is clean, saved corner retained; all14 former preview boundaries and all existing preview Save/loading/conflict/resize checks remain. Pro-only switch saves the explicit boolean; Free callers omit the optional paid field. Authority clock assertion remains last after async capability resolution. Fresh disposable E3 browser database initialized from the current schema helper; no generated migration or db:push. Browser build/outer verification pending.

E3 A18 outer Green:1/1 real browser journey passes26.6s after a successful current-schema browser build. Explicit Pro switch saves false, reload retains it, authorized preview and actual selected-clip playback are clean. Existing Next lazy-module log is retained (also present in E2-browser-regression-green.log), not reclassified as a product-test failure. Before finishing A18, strengthen positive playback proof inside the preview and share the test helper for the upcoming opt-in case; no runtime change.

E3 A18 refactor Green:1/1 strengthened real browser journey passes. Both iframe preview and private generated presentation positively advance actual video beyond0.2s before clean/no-badge assertions. Shared test helper prepared for opt-in without changing runtime or dropping checks. A18/U18 DONE; T815 passes its focused acceptance gate, full E3 milestone remains open.

E3 A133 intended outer Red:2-case run retains A18 Green and opt-in reaches actual playing preview. Saved checked=true survives reload, but data-runner-layout-status remains clean instead of placed. `E3-A133-outer-red.log` retains exact failure. DEF203 accessible-keyboard interaction succeeds; original pointer rejection excluded. No renderer production changes before Red.

E3 U133 inner Red: entire23-case branding owner has22 retained passes and1 intended policy failure; optional Runner-only Pro branding returns false for3 generated surfaces. Live/ordinary exclusions and input immutability remain asserted. Apply the minimal optional preference policy, preserving existing default-clean Pro behavior.

E3 U133 policy Green:23/23 complete branding owner passes. Optional appearance flag affects only generated surfaces; default-clean and Free policies retain their prior checks. Small optional parameter is sufficient; no extra abstraction at refactor. Outer opt-in remains Red pending actual private/preview page wiring. Next constituent verifies an unsaved opt-in updates the preview before Save so preflight uses the real draft.

E3 U133 draft constituent intended Red: complete11-case component owner has10 retained passes, and real state changes true but iframe proShowAttribution query is null instead of true. DEF204 shared-double semantics repaired before recording product Red; no runtime changed. Add draft identity/query to client preview next.

E3 U133 draft client Green:11/11 complete component owner passes. Unsaved Pro switch updates iframe generation/key and proShowAttribution query before any save; Free URLs and persistence callers remain unchanged. Next constituent verifies the owner-authorized preview consumes the saved opt-in.

E3 U133 saved-preview Red:16-case whole owner retains15 passes; authorized Pro saved true expects attributionRequired true but receives false. Wire the existing shared policy and owned saved profile next.

E3 U133 saved-preview Green:16/16 whole-file cases pass with shared policy consuming only the authorized saved profile. Next constituent checks validated draft choice and mandatory Free override before Save.

E3 U133 draft-policy Red: complete20-case preview owner has18 passes and2 expected failures because valid true/false draft choices are ignored. Invalid draft and mandatory Free override retain honest Green. Apply validated draft choice only after owner authorization; never trust query flags for authority.

E3 U133 draft-policy Green:20/20 whole preview owner passes. Valid Pro draft booleans override saved preference; malformed value falls back; Free false flag cannot remove required attribution. Next private-renderer constituent proves opt-in propagates to authenticated generated output.

E3 U133 private renderer Red: whole40-case API/private-page owner has39 retained passes and1 intended opt-in failure: admitted Pro with owned saved true still receives attributionRequired false. Apply the shared existing preference policy at that authorized boundary only.

E3 U133 private/combined Green:4 whole application owners/94 cases pass without coverage, retaining all prior cases. Authenticated generated output now consumes its owned saved opt-in; draft validation, Free override, off choice and source/privacy boundaries pass. Before final outer run, strengthen shared browser check to prove playing draft and layout status before Save as well as after reload. No runtime source changes in that test-only refactor.

E3 expiry planning adds2 primary artifacts (374 ->376), preserving all original rows. Temporary summary helper initially updated only its total-count guard; its unchanged uniqueness-count guard correctly rejected refresh before any summary write. Updated both guards to376 and revalidated unique primary IDs. No product/test/gate output changed; no execution evidence claimed for planned expiry work.

E3 A133 Green/refactor checkpoint:2/2 real Pro preference journeys pass43.2s against the current successful browser build. Both choices positively play the draft before Save, survive reload and play through the authenticated generated presentation.4 current app owners/94 cases remain Green;2 test-only literal/Testing Library corrections retain34-case replacement and full TypeScript Green. Shared policy/helper refactor retains all behavior. A18/U18/A133/U133 DONE; T596/T678 remain open for explicit known-expiry renderer work and milestone qualification. No later-slice tests materialized.

E3 A180 outer intended Red: real generated video advances and is clean before its admitted20s paid deadline. After that known end, the badge never appears (`E3-A180-outer-red.log`, failure at required branding toBeVisible). The fixture uses a real finite Pro grant and captured validity; no synthetic browser clock or product-only test API. Deadline wait is derived from the newly defined fixture interval, not a weakened existing timeout. Native commercial workflow is not rerun/duplicated for this renderer observation.

E3 U288 intended policy Red:30-case whole owner has26 passes and4 failures for exact/after deadline and malformed string/non-string known end. One millisecond before and unknown/absent legacy deadline retain honest Green; live/ordinary exclusions and input immutability asserted throughout. Add only captured deadline evaluation now; mounted transition remains pending.

E3 U288 policy Green:30/30 entire branding owner passes with half-open known validity, malformed-value fail-closed behavior and retained unknown legacy expiry. Refactor review keeps the small predicate; no additional abstraction. Outer A180 remains Red. Materialize the mounted timer/identity constituent next, before its production change.

E3 U289 intended Red: full4-case client owner retains3 collision/readiness cases Green; at exact known deadline the mounted clean surface never creates required badge. Add only the deadline transition, retaining child/generation and clearing timer on validity replacement/unmount.

E3 U289 Green: both complete renderer owners pass6 cases. At exact deadline branding appears, same video DOM child/generation remain, renewed future validity clears expired state, and unmount removes the pending timer. All former collision/readiness cases remain. Small effect refactor review keeps one bounded timer; next private-page constituent proves signed captured deadline reaches policy and mounted renderer.

E3 U288 private propagation Red:43-case whole API/private owner retains40 passes;3 new before/at/after captured-deadline cases fail because validity is omitted from policy/client props. Add the verified captured value only; retain admitted generation, private source authorization and player child.

E3 private expiry/core Green:3 complete application owners pass77 cases. Captured before/at/after deadline is propagated to both initial policy and mounted wrapper; player child/source and generation retain their identity. Next existing owner-read boundary must carry its resolved finite validity into the owner preview rather than leaving that already-open preview indefinitely clean.

E3 U288 owner-validity Red:31-case whole branding owner has30 passes and1 intended finite paid-read metadata failure. Real finite grant resolves Runner Pro, but authorized profile response omits validUntil. Saved revision/corner/choice and token privacy assertions remain. Expose only the existing resolved finite validity as optional response metadata; no extra persistence or permission input.

DEF206 corrected evidence: trial-grant31-case app owner passes (`E3-U288-owner-validity-green.log`). Corrected actual browser repeats missing badge after the real paid end against the preserved pre-expiry A133 build, whose BUILD_ID hash is retained. This rerun occurs after expiry source edits but before their first browser build; it is not presented as a newly executed pre-source Red. The independent U288 policy and U289 mounted-clock intended Reds genuinely preceded their production changes. Initial partner-grace outer log stays excluded as full expiry proof. No grace rule changed.

E3 U288 owner-preview propagation Red:21-case whole preview owner retains20 passes; finite authorized validity is not forwarded to the mounted renderer. The real31-case owner-read trial fixture now returns exact optional validity. Add that trusted response field to initial policy and mounted preview props next.

E3 expiry core Green/refactor: all6 current app owners/112 cases and3 actual browser journeys pass;1575 source/test/tooling/environment inputs byte-identical at completion (`E3-core-checkpoint.json`). Actual expiry restores visible branding while the exact video node advances, generation/admission stay active and saved fields remain. Current browser build/type verification passes. Refactor review keeps small shared policy and single bounded timer, with no runtime edit/replay needed. U288/U289/A180 DONE. T678 remains open: complete affected inventories/coverage/static/native gates and startup/renewal edge audits still required. No release/full-slice qualification claimed.

E3 startup audit seam refactor Green: entire4-case generated-presentation browser owner passes36.3s, including actual live/fallback/return encoded pixels. Existing bounded stdin probe transport is shared through runNativePresentationProbe; no runtime/threshold/assertion changes. Next materialize the previously unproven playing-layout startup guard at the real Engine boundary under A178/DEC012 before its fix.

E3 startup audit confirms a product blocker: actual Engine accepts the configured playing layout and opens FFmpeg before the renderer reports blocked (2 real panels, matching generation). Retained JSON: E3-startup-audit-observations.json. Receiver bytes were0 at observation; no claim of received bad video is made. This is a startup-order defect, not a fixture Red or a reason to weaken assertions. DEF207 blocks T678. Preserve capture-before-playback for source prefix, add a fresh measured-content phase before any encoder opens, and return a normal configuration refusal.

DEF208 fixture verification: corrected59-case whole player owner retains58 former cases Green and1 intended missing metadata failure. The deferred one-shot response is now arranged after its initial assertion. U291 metadata is opt-in for the Runner wrapper; ordinary overlay output keeps its existing attributes/behavior.

U291 first minimal Green attempt retains58 passes but remains Red at missing initial metadata: OverlayPlayer intentionally returns null until its first clip exists. Preserve E3-U291-partial-return-rejected.log. Ordinary null behavior must stay intact; only the opted-in Runner path needs an inert phase marker. Before that production step, correct the new test to query the current phase marker at each boundary: marker-node identity across initial null/viewport rendering is not a requirement. All exact phase/epoch/clip assertions stay unchanged; no video identity assertion is altered.

U291 current-marker test correction retains exact1 intended metadata failure and58 former passes (`E3-U291-current-content-red.log`) before the next production edit. Add an inert Runner-only marker to the no-clip return; ordinary overlays keep returning null.

U291 loading/playable metadata Green: complete59-case player owner passes. Opted-in Runner gets an inert initial marker and fresh start epoch; resolved clip exposes playback phase/id. Existing ordinary behaviors remain58/58 Green. Next atomic constituent verifies that a truly settled empty source becomes ready standby rather than remaining loading forever.

U291 empty-source Red: whole60-case player owner retains59 passes; settled source remains loading instead of empty. Add completion metadata around the existing initial selection attempt without changing ordinary player output or clip selection.

U291 empty-source Green: complete60-case player owner passes; a settled empty source emits ready-empty phase without media playback. Before production caller wiring, strengthen the existing authenticated private and owner-preview unit boundaries to require the explicit Runner metadata opt-in. Ordinary entry points are untouched.

U291 entry wiring Red: complete2-file/64-case boundary run has7 expected missing opt-in failures (6 authorized corner examples plus private renderer) and57 retained passes. Wire metadata only at the two authorized Runner entries; normal overlay entries remain unchanged. Refactor the already-green player metadata calculation to one typed packet while verifying all three owners.

U291 producer/refactor Green:3 complete app owners/124 cases pass. Both authorized Runner entries opt into metadata; ordinary entry points are unchanged. Shared typed phase packet removes duplicated calculation. Loading, playable and settled-empty phases and a fresh start epoch are verified. DEF207 remains open until measured-content binding and native consumer guard are Green.

U292 intended Red: entire5-case generated client owner retains4 former passes and fails because no measured content key is published. The same test changes only metadata attributes (not geometry/style), then requires blocked classification for initially transparent panels in a fresh playing epoch. Implement phase-bound measurement before the native consumer changes.

U292 measured binding Green: both whole generated renderer owners pass7 cases. Exact epoch/phase/clip key is measured and published; metadata-only changes trigger measurement, and first-playing panels reserve their full bounds before fade-in. Existing sticky conflict, generation, resize and expiry/timer cases remain Green. Producer side is ready; add the native consumer guard unit before changing Engine.

U290 native intended Red: entire34-case Engine owner retains33 prior passes; real blocked-after-playback input resolves undefined rather than the required normal false refusal. Capture precedes playback in the fixture. Before implementation, expand the same protocol test with stale epoch/generation/content-key and empty/clean boundary assertions, and include the standard handle disposal method. No assertion is relaxed or source changed.

U290 strengthened native Red retains33 prior cases Green and1 expected false-refusal failure (`E3-U290-boundaries-red.log`). Its fixture includes standard JSHandle disposal and explicit stale epoch, loading/standby phase, foreign render/bridge generation, mismatched measurement, clean and empty cases before the native guard implementation. Preserve all tests while adding the guard; no user configuration error should be thrown.

U290 native consumer Green: entire34-case Engine owner passes, including all33 retained cases. Guard waits for a fresh epoch and matching measured playback/empty phase, preserves capture-before-playback order, refuses blocked layouts without throwing, destroys capture and propagates false through retry/start wrappers. Stale generation/key/epoch and clean/empty branches pass. Before full media gates, update the two explicitly unbranded synthetic private-page fixtures to publish the same truthful start/standby phase; no production guard waiver or failure-driven full producer replay.

DEF207 actual first fix remains Red: complete13-case collision/presentation run retains12 passes including real encoded fallback/return; blocked startup still opens encoder. PlayerOverlay mounts panels only after its1s fade timer, so measuring opacity0 elements cannot reserve absent DOM. Add Runner-only pending geometry matching final scale/theme/position before visibility. Rejected logs and exact current observations retained. Auto-review rejected an overwrite-shaped shell write for the planned new unit file; read-only inspection proved the path absent and exclusive open(x) created it without replacement. No existing tests were removed.

U293 intended Red: whole2-case PlayerOverlay owner has1 missing pending-geometry failure and1 honest retained ordinary-delay baseline pass. The test preserves exact final position, scale, border/theme classes, initial invisibility, replacement at first fade-in and no reservation after fade-out. Add an explicit Runner-only reservation with shared final styles; native/user refusal and all existing assertions stay unchanged.

U293 first Green:3 whole component owners pass67 cases. Runner pending geometry shares the exact visible panel classes/styles and stays inert; default ordinary delay remains intact. Before physical verification, check the supported short positive fade duration boundary so an early fade-out timer cannot remove bounds before the existing delayed fade-in.

U293 short-fade boundary intended Red: complete3-case panel owner has2 passes; an early fade-out timer removes pending geometry before the existing delayed first entry. Preserve all timing/assertions and keep the pending phase until that first entry; ordinary visible behavior remains unchanged.

U293 short-boundary and affected app Green:8 complete app owners/176 cases pass (`E3-reserved-layout-app-green.log`). Runner-only pending geometry shares final styles, remains until first entry even for an early fade timer, and disappears after visibility/fade-out. Ordinary timing remains baseline Green. Current browser build/type checks pass; actual13-case verification is in progress. Auto-review file-write concern was resolved by verified absence plus exclusive creation, without replacing any existing test.

### E3 startup and physical decoration checkpoint

DEF207 and DEF209 verified. Actual Engine refuses blocked playing layout before encoder opens (zero received bytes); all13 collision/presentation and both decoration cases pass. Complete8 app owners176 and native Engine34 pass. U290–U293 DONE, T1036 complete. E3 full T678 and release remain open; no historical E2 gate is rebased onto changed runtime.

E3 renewal audit preparation during native gate: inspection of the native execution manifest proves all103 inputs are packages/runner files plus root package.json/bun.lock. Only the independent root browser feature/bindings are edited while that producer runs; none of its executed source/test/lock inputs change. No second heavy producer runs concurrently, and no appearance production change precedes the renewal Red. The previous broad source-freeze shorthand is refined to the actual owning execution inputs.

### E3 complete native current-source owner gate

`E3-native-complete-results.json` and `E3-native-current-inventory.json` qualify all51 complete native owners:439 passes, all438 prior E2 assertions retained, one inherited TODO unchanged, zero failures/pending cases. All103 native execution inputs match. Browser expiry/renewal audit begins only after that producer exits successfully. Full E3 coverage/static/application/browser qualification T678 remains open.

### E3 renewal outer Red

Current retained runtime: real expiry passes; actual authoritative paid extension before its former end fails clean presentation after that end. E3-renewal-browser-audit-results.json has1 pass/1 intended failure, zero skips/flakes. DEF210 recorded before any renewal production change. T1040 complete; U294 inner cycle follows.

### E3 U294 client and authenticated policy constituents

Client whole owner first Red:5 retained passes/1 missing fetch failure (E3-U294-client-red.log), followed by6 Green. Endpoint whole owner first Red:6 cases fail because the intended new route module is absent (E3-U294-policy-red.log); do not claim deeper authorization assertions were reached in that Red. Minimal route then passes6 auth/current-owner/expired-policy cases. Four whole owners pass88 including both Free hidden-choice normal-refusal baseline cases;2 whole policy/client owners then pass18 with six additional malformed/foreign/denied/network/abort baseline checks. Shared generation and child identity retained. No Runner native inputs changed. Browser rebuild is in progress; DEF210 remains open until the real renewal boundary passes.

### E3 renewal outer Green/refactor checkpoint

Both actual current-build expiry and renewal scenarios pass, zero retries/skips (E3-renewal-browser-green-results.json); DEF210 verified, U294 DONE, T1042/T596 complete. Native complete51-owner/439-pass inventory remains unchanged at103 inputs. Next checkpoint T678 requires complete affected app/browser/workflow/coverage/static/build/package evidence, so E3 is not yet fully qualified.

E3 evidence retention: existing readability bindings reuse E2-readable screenshot paths. Before the complete E3 run reached that feature,12 prior images were copied with timestamps and hashes into E2-readable-preserved-before-E3; E2-readable-preservation.json records this preservation-time claim. Original paths may contain the subsequent current E3 screenshots; no false original immutable-hash claim is made.

DEF211 tooling setup verification: the read-only server action manifest process initially could not start because its requested temporary cwd did not exist. It was created from the existing repository cwd; the unchanged manifest command then passed. Rejected startup is setup-only evidence, not a product Red or check result. No runtime input changed.

### E3 lint refactor Green

All83 pre-refactor browser cases passed and all78 E2 cases were retained; E3-browser-before-lint-* files preserve that historical gate and its1578 inputs. Current component refactor retains75 whole-owner passes and full lint0 errors/6 unchanged warnings. A dedicated React state epoch advances on Runner Start/Stop; selection/recovery cancellation refs remain internal and clip id also identifies new measured content. The paid clock now uses useSyncExternalStore with bounded timers and an SSR snapshot. Native unknown[] annotations erase to byte-identical configured Jest output; the original103-input manifest is retained with explicit typing review, not silently rebased. DEF212 is Fixed pending current-source broader verification.

E3 app-strength checkpoint: the complete64-owner1263-case run retains every1219 E2 case. Current four-owner remediation passes97 cases, retaining all93 prior cases and adding4 baselines; distinct complete-owner inventory is now1267. E3-app-reviewed-strength-deltas.json proves only5 test/fixture inputs changed, prior assertions/fixture text are preserved, and all32 production source hashes are identical. Compatible app counters merge without source-map changes. New Runner counters in legacy core are100% across S/F/L/B, preserving every measured whole-core E2 floor; the new panel and generated-surface floors pass. Explicit critical S95 passes for destinations after the persisted-data baseline. Only workflow-owned runners/workflow diagnostics remain; the full current433-case workflow owner runs next. DEF215 and DEF217 verified; DEF216 remains pending the required workflow merge.

### E3 complete app/workflow coverage Green

Current full433-case workflow owner passes once with its coverage lane and unchanged source inputs. E3-app-workflow-coverage-gate.json passes all32 collected sources, explicit critical S/F/L95/B90, ordinary90/85 and retained legacy-core floors/new Runner100% counters. Distinct current app inventory64/1267 and native51/447 retain every prior case. DEF216 Verified, T1045 complete. Full617-file formatting check passes. DEF212/current-source physical browser/build/package qualification remains open; no release Go.

F1 integration follow-through recorded in existing T643–T645: scoped E3 collection explicitly includes PlayerOverlay and passes its full component floor. Its pre-existing global exclusion in jest.config.cjs must be removed before final owning-lane/merged coverage, so final CI cannot omit the changed reservation source. This is collection strengthening, not a threshold exception; source/config changes wait until the proper implementation checkpoint. The planned critical S95 floor also needs the existing blocking feature audit integration, rather than relying on the shared helper's S90 default.

### E3 current physical browser qualification Green

E3-final-browser-current-inventory.json passes all83 cases/9 complete owners, retains all78 E2 cases and has zero retries/skips. All1578 final runtime/test input hashes match. Real expiry/renewal preserves the original video/generation; invalid playing layout refuses before encoder startup, and real encoded live/fallback/return plus desktop/mobile readability pass. DEF212 Verified and T1043 complete. Current standalone/action-manifest/Linux packaging/metadata checks still precede T678 completion; no release Go.

### E3 final build/package/static qualification

Current standalone and browser builds pass TypeScript/patched-dependency validation. Their action manifests pass97 and407 discovered files respectively. Local node24-linux-x64 package rebuild and executable self-test pass; its148173279-byte binary SHA is retained in E3-linux-package-result.json. This is local Linux evidence only, not the final platform matrix. Current root lint0 errors/6 retained warnings, native types,11 migration-policy checks and High audit pass with the same documented ignore. All1578 final execution inputs match after packaging. Metadata formatting closes the remaining E3 checkpoint step; F1 integrated release gates remain mandatory.

### E3 affected checkpoint complete

E3-final-scoped-gate.json qualifies current64 app owners/1267 cases,51 native owners/447 distinct passes plus one inherited TODO,433 owning workflow scenarios and83 current browser cases/9 owners with zero retries/skips. Current32-source app/workflow and 13-source native coverage pass without reduced floors; all1578 final execution input hashes match. Both builds/action manifests, types, lint0 errors/6 retained warnings,625-file formatting,11 migration-policy checks, High audit and local Linux package/self-test pass. All217 canonical defects Verified. T678 complete:22/23 delivery slices have affected checkpoints. E4 custom standby begins next; full F1/global/native-platform release validation remains mandatory and release remains No-Go.

### E4 first behavior — A126/U126 retained permission baseline

The shared appearance save entry already exists from E2/E3. Before any E4 production change, the authenticated outer workflow passes its positive control, revokes organization membership, confirms the session remains authenticated, and receives normal ACCESS_DENIED without a database change. Whole native feature: 47/47 (`evidence/E4-permission-baseline.log`). Distinct inner owned-resource service denial retains original corner, row identity and revision without throwing: whole file 34/34 (`evidence/E4-inner-permission-baseline.log`). These are honest retained BASELINEs, not manufactured product Reds. BDD and ATDD share the single physical authenticated action execution. No production change or refactor was needed; both remain required at the E4 final gate.

### E4 A99/U99 — background-color inner Red

Before production changes, whole internal branding owner has 34 retained passes and one expected failure (`evidence/E4-color-inner-red.log`): a valid Pro color save returns failure rather than persisted #16324f/revision 2. The outer browser scenario is running against the unchanged E3 production build; no product edits until its whole owning result is retained.

Supplementary U99 renderer Red: whole `runnerGeneratedPresentation.client.test.tsx` has 13 retained passes and one expected missing-standby-node failure (`evidence/E4-color-client-red.log`). The test also requires a playback phase transition to remove standby without replacing the player node. No E4 production code exists at this point.

A99 outer Red confirmed before production: complete browser owner 42 retained passes and one intended missing-color-control failure, 8.9m (`evidence/E4-color-browser-red.log`). Original failed screenshot/video retained in test-results/browser. U99 persistence and renderer Reds are already recorded. Implement only color-related schema, save/read, preview and generated standby rendering now; other E4 fields remain absent.

E4 color inner Green: four complete owners 57/57 (`evidence/E4-color-inner-green.log`), including persistence, standby/playback node identity, current paid appearance policy and retained watermark cases. The policy response now explicitly identifies current Runner Pro, independently from voluntary attribution; its prior exact-response cases were extended before production and yielded three intended missing-field Reds (`evidence/E4-color-policy-red.log`). No source changes after this Green yet; outer browser Green remains pending.

Color owning route compatibility also passes46/46 (`evidence/E4-color-routes-green.log`). Editor fixture-only type repair passes11/11 and full rebuilt browser compilation/TypeScript; DEF218 Verified. Three supplementary retained color checks now exercise Free hidden-field refusal, invalid CSS refusal and omitted-field preservation using the same inner service owner. These strengthen current color evidence without any production change; the browser run executes the already-built unchanged product and unchanged browser tests.

Supplementary color baselines Green: complete branding owner38/38 (`evidence/E4-color-boundary-green.log`), preserving all35 prior cases plus Free hidden-color refusal, invalid CSS refusal and omission-preserves-color. No production changes were needed for these baselines. Distinct current internal inventory117 cases across7 owners (38+14+2+6+11+46), not a sum of repeated executions. U99 DONE; A99 browser Green still pending.

### E4 A99/U99 color cycle complete

Whole browser owner43/43 Green in8.5m (`evidence/E4-color-browser-green.log`), retaining all42 prior configuration/calendar/appearance journeys. Draft preview, persisted reload and authorized generated standby use the same color. Internal current117 cases across7 owners, scoped lint and browser build/type gate are Green. Initial service/render/policy/UI Reds remain retained. No unrelated product changes or threshold reductions. Shared E4 schema/editor/render tasks remain open for their other mapped behaviors.

E4 standby owner extraction baseline passes1/1 in23.5s (`evidence/E4-standby-owner-baseline.log`). Old42-case feature matches E3-final-execution-inputs.json SHA byte-for-byte; the moved scenario and binding are unchanged. Runtime logs exposed DEF219, also present in the preceding43-case Green: installed next-ws accesses Next lazy userland before ensureUserland. Reproduction: E4-nextws-red.log (2 intended deferred/failure Reds,1 synchronous baseline Green). Minimal adapter import-boundary await is now committed as a Bun dependency patch, not a git commit: patches/next-ws@2.2.16.patch, package.json and bun.lock. Six complete adapter/resolver cases pass and patched-dependency validation passes2 dependencies/files. Actual browser/runtime verification pending; no error suppression or qualifying the runtime warning as harmless.

DEF219 verified: six adapter/resolver cases,21 existing WebSocket runtime cases, current browser build/types/2-patch validation and the complete actual standby owner1/1 pass. E4-nextws-browser-green.log is additionally checked for absence of unhandled rejection/lazy-module invariant. No error suppression. Proceed to A100/U100 background-image valid upload/preview/save/output behavior using the extracted whole standby feature owner.

### E4 A100/U100 background image Red

Before image production changes, whole standby browser owner has1 retained color pass and1 expected missing-background-upload-control failure (`evidence/E4-image-browser-red.log`,1.5m); preparation of the real16x16 PNG succeeds. Whole inner branding owner has38 retained passes and1 expected absent asset-operation failure (`evidence/E4-image-inner-red.log`,35.4s), not an import/setup error. Implement only this valid background-image journey and its necessary bounded authenticated raster storage/serving. Later logo/message/time and boundary behaviors remain separate cycles.

E4 image inner implementation: first seven-owner run117 pass/1 renderer ReferenceError (DEF220), not a qualifying Green or intended Red. Missing destructured URL prop corrected; both complete renderer owners16/16 pass, preserving all assertions. Remaining owner passes from E4-image-inner-green.log are unchanged by this one component declaration correction, yielding118 distinct current internal cases across7 owners. New image storage/profile linking case passes. Scoped lint has0 findings. Current fresh-schema browser build and outer image journey remain pending; do not mark A100 or E4 done.

### E4 A100/U100 background-image cycle complete

Current browser build passes compilation/TypeScript and both dependency-patch gates (`evidence/E4-image-browser-build-retry.log`). Complete standby browser owner2/2 passes39.0s (`evidence/E4-image-browser-green.log`), with no unhandled rejection/lazy-module invariant. Real PNG upload, draft preview, persisted reload and authenticated generated asset all report16x16 decoded image. Current internal composite118 distinct cases across7 owners; renderer correction16/16 and type-only executable identity proof are retained. No full E4/final release qualification claimed; remaining logo/message/time, rejection/boundary/asset-transaction behaviors and integrated gates remain mandatory.

E4 CON013/U149 atomic SVG magic Red: complete new API owner1 intended failure (`evidence/E4-asset-magic-red.log`). The actual POST and real asset service return normal400, but invoke the controlled raster decoder on SVG bytes despite a forged PNG MIME. Required magic-before-decoder guard is missing. Add only that guard, keep real decoding/size/dimension verification afterward, and rerun the complete API owner plus retained valid-image inner owner. U149's broader auth/rollback/cleanup criteria remain open.

CON013 SVG magic Green: complete API owner1/1 plus unchanged complete branding owner39/39,40 total (`evidence/E4-asset-magic-green.log`). Unsupported SVG never invokes Sharp or writes an asset; valid owned PNG upload/persistence still works. Signature bytes now select PNG/JPEG/WebP before decoding and decoded format must match. Continue separate contract atoms; broader U149 and transaction/cleanup/source-boundary work remains open.

CON013 U270 honest retained baseline: after the SVG signature guard, HTML disguised as PNG already receives normal400 before decoder/storage/authority commit. Complete API owner2/2 (`evidence/E4-asset-html-baseline.log`). No product change or manufactured Red; U270 BASELINE and T1011 complete. Proceed to the actual decoded-format/decode-failure and authentication contract controls.

CON013 U149 complete format/decode contract: whole API owner5/5 (`evidence/E4-asset-decode-baseline.log`), retaining SVG/HTML magic guards and adding distinct recognized-PNG but mismatched decoded format, failed decoding, and unauthenticated-before-body-read baselines. All return structured errors without storage or authority commit; valid real PNG remains covered by39-case inner owner. These added controls already work after the format guard and are honest retained baselines. U271/U272 rollback/cleanup remain open; shared T613 is not yet complete.

CON013 U271 retained rollback baseline: complete API owner6/6 (`evidence/E4-asset-rollback-baseline.log`). Actual disposable PostgreSQL shows2 assets inside the intentionally failed transaction, then1 original asset afterward; old profile JSON, revision2 and background reference are byte-equivalent. No production changes required. This is inner rollback evidence under controlled commit failure, distinct from outer visible upload-rejection journeys. Next U272 tests actual detached cleanup ordering after profile commit.

CON013 U272 cleanup ordering baseline passes whole API owner7/7 (`evidence/E4-asset-cleanup-baseline.log`). Real PostgreSQL shows the replacement reference staged inside the profile transaction while a separate connection still sees the old reference, and the old asset remains present until commit. Actual delete is observed only after transaction resolution; afterward only the new referenced asset remains. Add the distinct post-commit cleanup-failure case before any recovery change.

CON013/U272 post-commit cleanup error Red confirmed: corrected fixture actually injects the delete exception after the profile transaction commits. Whole owner7/8; new test fails exactly because cleanupThrew is true (`evidence/E4-asset-cleanup-failure-product-red.log`). Previous failed attempt omitted the fault and is excluded from product Red (DEF222). Preserve committed profile success, retain old unreferenced bytes safely on cleanup failure and report only a sanitized unexpected maintenance exception.

CON013/U272 post-commit failure Green: complete API owner8/8 plus real branding owner39/39 (`evidence/E4-asset-cleanup-failure-green.log`,47 total). Cleanup occurs after commit; a failing delete now leaves the committed replacement successful and old unreferenced bytes intact, recording only a fixed sanitized unexpected maintenance exception. Expected policy/feature refusals remain returned values. U149/U270/U271/U272 are complete/retained baselines, T613/T630/T1011–1013 complete. No E4 completion claim: required asset boundaries, visible rejection journeys and remaining standby fields still pending.

E4 A101/U101 custom-logo intended Reds before production: whole standby owner2 pass/1 missing-logo-control failure; whole internal owner39 pass/1 new-logo-reference save refusal. Underlying upload normalizer already supports logo-kind raster assets; implement only profile reference, owner/kind authorization, preview/edit controls and paid generated-standby logo rendering. Source ownership/roles unchanged. Full browser baseline used the last image build with identical UI; intervening backend guard/cleanup changes are qualified by their dedicated current inner owners and will be rebuilt together with logo.

E4 logo inner Green: eight complete owners127/127 (`evidence/E4-logo-inner-green.log`,70.3s), scoped lint0 findings. Includes current signature-before-parser and cleanup-recovery production, owned kind-specific logo reference, preserved background and all prior renderer/editor/route cases. Browser build still running; A101/E4 completion remains pending.

Outstanding runtime check before E4 qualification: verify continuous24/7 policy refresh keeps the existing600-second presentation cookie alive. Source inspection shows finite signed-cookie lifetime and JSON-only policy replies, so a focused real-clock/signature test must establish whether ongoing private assets/policy lose authorization after the original lifetime. If reproduced, renew only the same valid active-execution cookie on authorized policy refresh; never extend its individual lifetime, admission, output rights or paid deadline. Verify revoked/expired identities cannot renew. This is not yet executable failure evidence and no runtime fix is claimed.

### E4 A101/U101 custom-logo cycle complete

Current browser owner3/3 passes52.5s (`evidence/E4-logo-browser-green.log`); current build/types and2 dependency-patch gates pass, scoped lint0. Eight internal owners127/127. Kind-specific owned logo reference is separate from the background; both preview and assigned generated image decode correctly. Later message/time and asset boundary/rejection scenarios remain pending. Investigate the previously recorded600-second presentation-cookie continuity followup next, before further features; no authorization-lifetime fix claimed yet.

E4 long-lived presentation continuity Red: actual signer/verifier with controlled Date/Date.now clock reaches an authorized refresh9minutes after issuance but receives no replacement cookie. Whole policy owner6/7 (`evidence/E4-cookie-renewal-clock-red.log`); first equivalent missing-cookie attempt is E4-cookie-renewal-red.log. Corrected clock setup also advances new Date(), so later paid-expiry assertions test the actual capability clock. Add required remediation T1046 under existing U294/EXP001, without a new public behavior/artifact. Renew only a still-authorized active identity; retain individual600-second TTL, exact scoped path and unchanged paid/streaming authority. Expired/revoked entries must never renew.

DEF223 inner repair Green: three complete owners64/64, then current policy owner9/9 including missing signer→503/no-cookie and HTTPS→Secure scoped-cookie baselines (`evidence/E4-cookie-renewal-green.log`, `E4-cookie-boundary-green.log`). The real signer test verifies a refresh at9minutes survives original10-minute expiry, newly issued cookie still expires exactly600seconds later, an already-expired original cookie is refused, and the original paid end restores Free policy while the renewed identity remains valid. No admission/captured output rights change. Supplemental actual-browser header assertions extend the already-green logo journey honestly after the primary Red/Green; they are not fabricated outer Red. Browser build/run pending; T1046 waits for required E4 gate.

DEF223 actual browser verification complete: E4-cookie-browser-green.log3/3 in45.9s, including actual policy200/private-no-store and renewed exact-path HttpOnly/SameSite/Max-Age600 assertions. Current build/types/2-patch gates pass; whole server log has no unhandled/lazy-module invariant. Defect Verified; T1046 remains open until the complete E4 gate. Start A102/U102 custom plain-text message with draft preview, saved output and same-execution policy freshness.

E4 A102/U102 message Red before production: internal owner40/41; whole browser owner3/4. Supplementary policy/client owners20/25: three existing exact-response assertions were expanded before production for the required additive standby payload; the new policy saved-message case and actual mounted-client message refresh also fail for absent behavior. No old policy/expiry assertion is removed. Outer journey opens output before changing settings, uses the specified30-second refresh under a controlled browser clock, and requires the original player marker/generation to survive. Use shared appearance refresh for color/image/logo/message, avoiding a reload or replacement of generated content. Plain text remains React-escaped, with maximum160 characters and existing Free/owner restrictions. Remaining next-time and boundary examples remain pending.

### E4 A102/U102 plain-text message cycle complete

Current browser build/types/2-patch gates pass; complete standby owner4/4 in1.1m (`evidence/E4-message-browser-green.log`), including an output page opened before the edit, draft preview, saved reload,30-second controlled policy freshness and the identical original player marker/generation. Eight whole internal owners133/133 and scoped lint0. Shared bounded appearance payload now refreshes saved standby color/background/logo/message without reloading content; old or malformed payloads retain the last valid appearance. Dedicated StandbyEditor reuses existing HeroUI controls/labels. Required next-time, explicit boundaries, visible rejection examples and final E4/F1 gates remain open.

E4 A103/U103 next-time Red before production: whole internal owner41/42; whole browser owner4/5, with the expected missing toggle after valid scheduled fixture setup. Policy/client owners26/28 expose missing derived schedule DTO and saved-timezone rendering; the Free retained-choice refusal remains Green. The positive case intentionally uses a next-year January Berlin event beyond the seven-day cache and expects14:00 local/13:00UTC. Add only optional saved flag, scoped enabled/unpaused schedule derivation and preview/current-policy rendering; never start output from this read-only widget. Reuse existing shared calendar/DST semantics.

### E4 A103/U103 next-time cycle complete

Current complete standby browser owner5/5 passes1.2m (`evidence/E4-next-time-browser-green.log`), current build/types/2-patch gates and scoped lint pass; eight whole internal owners137/137. Future once-events are derived beyond the seven-day cache; enabled/unpaused Scheduled programs reuse the existing calendar/DST resolver, with saved timezone and no output/admission mutation. Free/known paid expiry hides the retained option; original player survives expiry. All five customization options now work, but E4 remains unqualified until preview controls, explicit boundary/rejection/story examples, source coverage and full affected checkpoints pass. F1 remains mandatory.

E4 SC004 preview/review contracts Red before production: real ATDD owner fails on the absent Preview standby button; new UI owners retain27 cases and fail3 intended control/clear/custom-text-measurement cases. The typed repeat removes only an unsupported Testing Library exact option; literal accessible names remain exact by that API, assertions unchanged. Canonical compound profile/source-isolation model owner43/43 passes as an honest baseline. Implement owner-only preview mode, explicit optional-image clearing and custom foreground occlusion registration; do not change actual output control or duplicate existing ordinary/live isolation executions.

### E4 SC004 preview/control cycle Green

Current combined browser owner6/6 in1.5m (`evidence/E4-preview-browser-green.log`): existing five customization journeys plus the new Pro story acceptance case exercises all four actual attribution corners, genuine owner clip/standby buttons, optional image removal before Apply and matching assigned output. Current build/types/2-patch gates and scoped lint pass. Inner UI/preview owners33/33 plus unchanged canonical profile owner43/43; new custom foreground participates in existing fixed-size collision placement. SC004 final story rollup/source-isolation and E4 coverage remain mandatory before A39/gate completion. No identical live/ordinary replay is created solely for the acceptance label.

E4 BND012 retained baseline Green: whole branding44/44 and new complete text browser owner1/1 (21.4s) accept exactly159 ASCII characters, preserve other saved settings/assets and survive reload. Validation was already introduced with the qualified message field; no production change or invented Red. Continue BND013, then014 only after each complete owning result is Green.

E4 BND013 retained boundary baseline: exact160 ASCII characters accepted. Complete current branding and text browser owners pass; evidence E4-BND013-inner-baseline.log / E4-BND013-browser-baseline.log. All other profile fields/assets remain valid and unchanged on rejection. No production edits, skipped cases, sampling or invented Red.

E4 BND014 retained boundary baseline: exact161 ASCII characters rejected. Complete current branding and text browser owners pass; evidence E4-BND014-inner-baseline.log / E4-BND014-browser-baseline.log. All other profile fields/assets remain valid and unchanged on rejection. No production edits, skipped cases, sampling or invented Red.

E4 BND015 retained byte boundary baseline: exact2097151 file bytes accepted; complete owning API and browser files pass. Accepted upload stages owned bytes without changing profile until Save, then atomically replaces the reference and removes detached bytes. Refusal retains saved appearance and old asset. Evidence E4-BND015-inner-baseline.log / E4-BND015-browser-baseline.log; no invented Red, sampling or skipped cases.

E4 BND016 retained byte boundary baseline: exact2097152 file bytes accepted; complete owning API and browser files pass. Accepted upload stages owned bytes without changing profile until Save, then atomically replaces the reference and removes detached bytes. Refusal retains saved appearance and old asset. Evidence E4-BND016-inner-baseline.log / E4-BND016-browser-baseline.log; no invented Red, sampling or skipped cases.

E4 BND017 retained baseline verified: whole API11/11 and byte browser3/3; oversized file refused before decode/store, visible size error, exact previous profile/assets and reloaded standby retained. Original browser-baseline failure is fixture-only strict locator ambiguity DEF224, not product Red. Correction targets actual validation text; no assertion removal or production change. Evidence E4-BND017-inner-baseline.log / E4-BND017-browser-green.log.

E4 BND018 retained raster boundary baseline: exact4096x1 (4096 pixels) accepted; complete owning API and browser files pass. Actual raster decode and client controls exercised; accepted upload stages without changing saved profile, Save replaces reference and cleans detached bytes; refusal leaves old profile/assets and reloaded image/message intact. Evidence E4-BND018-inner-baseline.log / E4-BND018-browser-baseline.log. No production edit, sampling, skipped test or fabricated Red.

E4 BND019 retained raster boundary baseline: exact4097x1 (4097 pixels) rejected; complete owning API and browser files pass. Actual raster decode and client controls exercised; accepted upload stages without changing saved profile, Save replaces reference and cleans detached bytes; refusal leaves old profile/assets and reloaded image/message intact. Evidence E4-BND019-inner-baseline.log / E4-BND019-browser-baseline.log. No production edit, sampling, skipped test or fabricated Red.

E4 BND020 retained raster boundary baseline: exact1x4096 (4096 pixels) accepted; complete owning API and browser files pass. Actual raster decode and client controls exercised; accepted upload stages without changing saved profile, Save replaces reference and cleans detached bytes; refusal leaves old profile/assets and reloaded image/message intact. Evidence E4-BND020-inner-baseline.log / E4-BND020-browser-baseline.log. No production edit, sampling, skipped test or fabricated Red.

E4 BND021 retained raster boundary baseline: exact1x4097 (4097 pixels) rejected; complete owning API and browser files pass. Actual raster decode and client controls exercised; accepted upload stages without changing saved profile, Save replaces reference and cleans detached bytes; refusal leaves old profile/assets and reloaded image/message intact. Evidence E4-BND021-inner-baseline.log / E4-BND021-browser-baseline.log. No production edit, sampling, skipped test or fabricated Red.

E4 BND022 retained raster boundary baseline: exact3999x4000 (15996000 pixels) accepted; complete owning API and browser files pass. Actual raster decode and client controls exercised; accepted upload stages without changing saved profile, Save replaces reference and cleans detached bytes; refusal leaves old profile/assets and reloaded image/message intact. Evidence E4-BND022-inner-baseline.log / E4-BND022-browser-baseline.log. No production edit, sampling, skipped test or fabricated Red.

E4 BND023 retained raster boundary baseline: exact4000x4000 (16000000 pixels) accepted; complete owning API and browser files pass. Actual raster decode and client controls exercised; accepted upload stages without changing saved profile, Save replaces reference and cleans detached bytes; refusal leaves old profile/assets and reloaded image/message intact. Evidence E4-BND023-inner-baseline.log / E4-BND023-browser-baseline.log. No production edit, sampling, skipped test or fabricated Red.

E4 BND024 retained raster boundary baseline: exact4001x4000 (16004000 pixels) rejected; complete owning API and browser files pass. Actual raster decode and client controls exercised; accepted upload stages without changing saved profile, Save replaces reference and cleans detached bytes; refusal leaves old profile/assets and reloaded image/message intact. Evidence E4-BND024-inner-baseline.log / E4-BND024-browser-baseline.log. No production edit, sampling, skipped test or fabricated Red.

E4 BND025 retained format boundary baseline: png file accepted; complete API/browser owning files pass. Actual file upload, decoding, normalized metadata and persisted profile verified; rejected files leave saved fields/assets and reloaded image/message intact with a visible error. Evidence E4-BND025-inner-baseline.log / E4-BND025-browser-baseline.log. No production edit, invented Red, sampling or skipped case.

E4 BND026 retained format boundary baseline: jpeg file accepted; complete API/browser owning files pass. Actual file upload, decoding, normalized metadata and persisted profile verified; rejected files leave saved fields/assets and reloaded image/message intact with a visible error. Evidence E4-BND026-inner-baseline.log / E4-BND026-browser-baseline.log. No production edit, invented Red, sampling or skipped case.

E4 BND027 retained format boundary baseline: webp file accepted; complete API/browser owning files pass. Actual file upload, decoding, normalized metadata and persisted profile verified; rejected files leave saved fields/assets and reloaded image/message intact with a visible error. Evidence E4-BND027-inner-baseline.log / E4-BND027-browser-baseline.log. No production edit, invented Red, sampling or skipped case.

E4 BND028 retained format boundary baseline: svg file rejected; complete API/browser owning files pass. Actual file upload, decoding, normalized metadata and persisted profile verified; rejected files leave saved fields/assets and reloaded image/message intact with a visible error. Evidence E4-BND028-inner-baseline.log / E4-BND028-browser-baseline.log. No production edit, invented Red, sampling or skipped case.

E4 BND029 retained format boundary baseline: html file rejected; complete API/browser owning files pass. Actual file upload, decoding, normalized metadata and persisted profile verified; rejected files leave saved fields/assets and reloaded image/message intact with a visible error. Evidence E4-BND029-inner-baseline.log / E4-BND029-browser-baseline.log. No production edit, invented Red, sampling or skipped case.

E4 BND030 retained format boundary baseline: unreadable file rejected; complete API/browser owning files pass. Actual file upload, decoding, normalized metadata and persisted profile verified; rejected files leave saved fields/assets and reloaded image/message intact with a visible error. Evidence E4-BND030-inner-baseline.log / E4-BND030-browser-baseline.log. No production edit, invented Red, sampling or skipped case.

E4 FR019 owning-boundary refinement: U19 uses the complete runnerGeneratedPresentation.client.test.tsx owner to assert the actual empty-content phase, configured background/message/image and stable content-node identity. BDD remains the real runner-standby.feature owner, with a fixture that deletes all playlist clip rows before requesting the active assigned presentation. This replaces the planned generic branding-service test location; criterion and assertions remain unchanged, no duplicate acceptance owner. Executable evidence is pending.

E4 FR019 / A19 U19 completed: whole component18/18 and actual standby browser6/6. Deliberate removal of empty-phase handling fails only the new expected standby assertion,17 other cases retained; original source restored exactly and whole owner Green. Real browser deletes all owned playlist clip rows before requesting current assigned presentation, verifies saved color/image/message and nonplaying standby phase. E4-empty-playlist-browser-green.log / inner-types-green.log / mutant.log; full types pass E4-boundary-typecheck-green.log. DEF225 internal-phase test assumption and DEF226 foreign query-option typing mistake are fixture failures, not product Red; both corrected without weakening requirement or production changes.

E4 EC012 / OPT078–080 equivalence refinement: reuse actual BND017/028/030 browser and API cases, now explicitly carrying both IDs. Existing assertions cover exact refusal, visible error, no new asset, unchanged full profile/old asset and saved image/message after reload. The three EC012 examples retain unsupported/oversized/unreadable variants without duplicated physical execution. Registry, tasks, test list and plan own these exact byte/format files and API tests. Current labeled whole-owner executions pending; no production edit or missing-behavior Red is claimed.

E4 EC012 / OPT078 / OPT079 / OPT080 complete through exact equivalent existing BND017/028/030 cases. All24 API and9 browser physical cases pass with both labels visible. Invalid content/size cannot invoke storage; real browser error, full stored profile/asset equivalence and reloaded image/message prove retention. EC012 rolls up unsupported/oversized/unreadable variants. Evidence E4-upload-rejection-inner-green.log / browser-green.log. These are reused tested behaviors, not new product Red or extra tests; no production edit, sampling or duplicate journey. Registry command uses two positional file filters rather than the equivalent alternation used in the actual run, keeping its Markdown table structurally valid. The temporary malformed command cell caused helper assertion hits=0; fixed before artifact result updates, all376 canonical primary IDs retained.

E4 OPT081 boundary refinement before evidence: inner owner is the actual upload POST plus real storage service under controlled raster/transaction dependencies. An insert failure must produce normal503/private-no-store with unchanged-screen wording and a sanitized unexpected-maintenance report, never the private cause. Outer browser injects the matching503 at the network boundary, verifies exactly one attempted upload and visible refusal, then reads the real full profile/assets and reloads the saved image/message. Existing real-DB rollback/commit-order cases provide transaction evidence. This preserves the distinct internal/outer contracts without inducing shared database failure or adding another owner.

E4 OPT081 A121/U121 complete: whole API25/25 and standby browser7/7. Expected503 is normal/retryable/private, Sentry receives a fresh sanitized unexpected-storage error without private cause. Browser injects exactly one matching503, verifies the old preview before reload, full unchanged profile/assets and old image/message after reload. Existing real-DB rollback/cleanup cases retained. Deliberate success-status mutant fails only the new503 assertion with24 other API cases passing; restore original source exactly and whole owner25/25. Evidence E4-storage-failure-inner-restored.log / browser-green.log / mutant.log. No invented product Red or customer-error throw.

E4 OPT094 native ownership refinement: actual Pro schedule guard precedes any content/provider/capture path. New outer owner stores a real signed cache, cold-process restores it under the same machine boot, and checks before/after signed windows with an empty content provider: no engine constructed, no provider read, no output started, no journal record. This is native cache/execution integration, not a claim of encoded media. Inner recovery owner tests the valid future window directly; existing ended-window recovery cases remain. First whole owners9/9 pass in E4-outside-standby-baseline.log. Materialized Gherkin and native binding keep both boundary examples explicit. Deliberate guard-removal strength check pending.

E4 OPT094 A134/U134 complete: full native recovery plus outside-standby BDD owners9/9. Valid signed schedule cache persists and is restored in a different process; before/after windows both prepare valid authority but apply=false, no engine construction, content read, output start or journal mutation. Configured empty provider lies behind the forbidden engine seam. Deliberate removal of the actual protocol not-before guard fails both the new inner and cold-process outer case,7 other cases retained; exact source restored and9/9 Green. E4-outside-standby-green.log / mutant.log. No product change or pretend encoded-media evidence. All376 canonical primary artifact IDs now Green; this is behavior execution coverage, not E4 qualification or feature/release Go. Broad owning coverage/strength/static/native/browser gates and F1 docs/export/full gates remain required.

E4 qualification progress, 2026-10-18: browser inventory verifies110/110 across16 whole owners, retaining all83 E3 cases without retries/skips. The broad browser/workflow manifests contain one reviewed non-execution input delta: DEF229 child unit fixture import cleanup, sole consumer next-ws-lazy-route.test.ts, independently3/3 Green and full lint0 errors/6 retained warnings. Original manifests preserved; E4-retained-execution-input-review.json checks every captured hash. SC004 A39 now DONE; aggregate slice/coverage tasks remain pending the final72-owner run and all 39-source gate. No threshold/requirement waived.

E4 aggregate behavior checkpoint: complete primary registry is376/376 Green;19 explicit BND012–030 outer/inner examples are verified honest retained baselines with no invented product Red. Existing per-behavior initial Red or retained-BASELINE logs, subsequent whole-owner Green, empty-phase/storage/start-boundary/owner/execution mutants and restored owners support T627/T628/T747. Full110 browser inventory and434 single-owning workflows, instrumented412 native cases plus2 fresh-process outside-window cases, and focused225+5 application strength cases support implemented T631/T632 and aggregate Green/refactor tasks T633–T637/T748. A39/SC004 actual ATDD owner is present in110-browser result with its earlier-corner/live/ordinary references retained, so T836 is complete. Full slice gates T638–T642 and T1046 stay unchecked until current complete qualification succeeds.

E4 final complete app collection:1393/1393 across72 whole owners,0 failures/skips/TODOs,610 seconds. E4-final-app-workflow-coverage-gate.json passes all 39 declared sources at unchanged critical95/90, ordinary90/85 and measured legacy floors, using the successful current report plus the single owning workflow report. E4-final-app-current-inventory.json retains all1267 E3 cases. The first local inventory helper lacked inherited UUID-normalization metadata in the E3 wrapper; retained its diagnostic and explicitly sourced the existing E2 reviewed owner list, then verified all current hashes and7 runtime UUID labels. No product/test/assertion change. DEF228 is Verified; builds/native/final integrated gates remain open.

F1 T656 prepared: commercial-access.md now gives a concrete read-only release preflight for preserved individual/agency recurring identifiers and scoped grants, reconciliation/counts, privacy-safe reporting and unexpected-paid-history escalation. No live account was queried, no billing mutation or email authorized/executed, and the instructions explicitly distinguish preparation from actual release preflight execution.

F1 packaging TDD checkpoint, DEF230: actual temporary Git repositories prove modified/additional/deleted native source wrongly retains HEAD identity (3 intended failures;1 generated/unrelated control Green). After minimal tracked+nonignored untracked enumeration and current-byte hashing, all4 whole-owner cases pass. Keep commit provenance/public-key inputs and ignored build outputs. No native media source/fixture changed; in-flight E4 physical owners use their captured unchanged inputs. Fingerprint tests are gate evidence, not additional primary artifact IDs. Native CI will force consistent LF checkout before shared cross-platform fingerprint comparison; full platform execution still pending.

F1 coverage execution identity TDD: F1-coverage-source-identity-red.log proves the real merger accepts foreign/missing worktree fingerprints at the same tree;2 retained checks pass. F1-coverage-producer-source-red.log exercises the real owning lane producer with only its execution child replaced by a result fixture and proves no identity change is recorded after input edits. Production now captures tracked plus nonignored untracked input bytes and Node/platform/architecture, checks them again after execution and requires the current fingerprint for every complete lane at merge. F1-coverage-source-identity-strength-green.log passes all4 script owners/cases, including unchanged runs, newly added source, deletion recovery and source mutation during execution leaving no passing lane artifact. No product coverage is claimed from the producer fixture; final six complete lanes must regenerate current evidence. Coverage merge job must use the same pinned Node version as producers.

E4-final-scoped-gate.json qualifies the final affected delivery slice:23/23, app1393/72, native450/52+1 inherited TODO, workflows434/21, browser110/16; all earlier E3 cases retained.39 app/workflow and 13 native sources pass unchanged floors, both100-file action checks/current static and local Linux self-test pass. T638/T640/T641/T642/T1046 complete; integrated story/CI gate T639 and F1 remain pending. E4-to-F1-gate-input-review.json preserves immutable candidate inputs and explicitly limits subsequent source drift to gate implementation; all 39 runtime and native media/fixture sources unchanged. Overall No-Go; no full platform/CI/release claim.

F1 blocking coverage/CI policy implementation: default manifest now includes all Runner sources and explicit strict S/F/L95 B90; actual default collection includes upload POST and player decoration source. Retained player measured floors and Runner-only counters are independently enforced at merged/default gates, with6 counter-gate cases (5 intended failures before implementation) and10 combined coverage policy cases Green. Native coverage now runs full inventory with critical95/90, ordinary90/85, exact13 source/owner validation, unchanged-in-run source fingerprint and one named inherited TODO. Actual YAML guard tests prove required native failure/cancellation/skip blocks Test, unchanged Runner skip remains allowed, merge Node matches producers and official native checkouts use LF before fingerprints. DEF231/232 caught and verified before full execution. All68 script checks and34 current Jest gate checks pass. T643 wiring/policy work is complete; final full lanes/native coverage/platform/runtime/build gates remain pending.

F1 browser ownership correction, DEF233/234: actual-config inner Red exposes normal BDD/ATDD accepting native workflow paths. Both browser projects now exclude only native mcp-workflows; native config explicitly retains them. The initial fixture restoration missed dot-directory matching; corrected fixture semantics without changing expectations, then2/2 whole-owner Green. Actual Playwright metadata independently confirms907 genuine browser BDD/ATDD cases and all434 native cases, with0 native/browser overlap. Root BDD generation and generated-scenario audit pass and still retain all434 native metadata cases. No product execution is claimed by enumeration. Full browser execution and single owning workflow coverage remain mandatory.

F1 integrated execution update: unit lane completes3806/3806 across338 files,0 failure/skip. Concurrent full attempts expose DEF235 OAuth discovery subprocess timeout and DEF236 native cold-restart missing encoded-media observation. Both are unexpected, not intended Red; failed reports cannot qualify. Source remains frozen, other complete owners continue to reveal remaining failures, and isolated whole-owner/complete-lane reproduction will follow before any code or fixture change. Current hypothesis is shared host/service load or bounded observation timing; exact cause is not established. No test/timeout/floor weakening.

F1 candidate v1 superseded after real DEF237: isolated original cleanup owner reproduces2 production-secret import failures without coverage, under the same intentionally secret-free owning CI setup. Preserve the unchanged encryption module guard. A class-only dependency split exposes additional direct schedule/destination/lease imports; complete fix defers crypto until credential operations and keeps the public admission error export. Existing5 complete scoped cleanup/destination/admission/transaction owners are running before refreeze. F1-v1-superseded-source-snapshot.json verifies6 original source modules byte-for-byte against the initial SHA256 manifest, and F1-v1-superseded-execution.json archives7 report directories. Old candidate unit3806 and database-3 cases629 pass, database-2 has475 pass/2 cleanup failures, native448 pass/2 cold-process failures/1 inherited TODO; database-1/workflows interrupted before completion. None of these qualify the changed final candidate. No assertion/timeout/source-floor weakening.

DEF237 scoped Green:92/92 whole-file cases across cleanup-disabled, destinations, admission, admission acceptance and workflow commit boundaries. Both production-mode ready/legacy privacy cases work with ENCRYPTION_SECRET intentionally unset. Encryption module bytes exactly match the original candidate; credential operations retain its production check. No assertion/timeout modified. First class-only attempt remains rejected; final change removes eager crypto initialization from destination/schedule/lease module imports and keeps error identity compatible. New complete candidate must rerun all coverage owners because production inputs changed. Local executions will follow owning CI isolation, especially native media/quiet timing, without mixing failed/superseded reports.

F1 mapping review: all47 core source IDs map to all376 primary artifacts with no orphan or unknown references; all474 behavior definitions are DONE334/retained BASELINE139/explicitly superseded DROPPED1. Physical path audit catches2 unquoted native registry cells rewritten by Markdown emphasis. Restore literal __tests__ paths under inline code for both owners and commands (DEF238); executable source and actual previous native runs are unchanged. Native final isolated run continues with no reported failures so far; no production input edits.

F1 v2 static gate checkpoint: T648 app types pass in F1-v2-app-types.log; native F1-preflight-native-types.log retained only after all native TS/config/dependency hashes compare identical (F1-v2-native-type-input-retention.json). T650 standalone/browser builds and both100-file action manifests pass in the four F1-v2 build/actions logs. Complete runtime/browser/coverage and official platform gates remain pending; No-Go retained.

F1 v2 complete coverage qualification: all six app lanes pass and F1-v2-merged-coverage.log passes exact current-source/inventory identity plus unchanged global/per-path/MCP/player thresholds. coverage/runner-feature/gate.json qualifies all 39 declared sources; complete native coverage qualifies all13 declared sources in packages/runner/coverage/runner-feature/. Current sourceFingerprint5bcb13275c521475a2f04a15832de856fb2f0440575ff02f1f3d96a20cc3dd78. T644/T645 complete. Browser/platform/final review gates remain open, No-Go retained.

F1 T654 complete: current69/69 script gates include migration-policy/disposable-E2E schema guards. F1-v2-migration-ownership-check.json independently confirms no generated drizzle files, no protected guard/hook changes and source-only schema diff; no override was used.

F1 T657 mapping review complete: F1-v2-final-mapping-audit.json validates376 unique primary artifacts,1046 unique tasks and no dangling task references across registry/behavior mappings; all47 core source IDs map to376 artifacts,683 physical owner references exist. Generated scenario audit has0 errors. Only canonical registry/gates hold execution results. Pending browser/platform qualification is explicitly separate and is not claimed by relationship integrity.

F1 T653 strength review complete: F1-v2-strength-retention-review.json links actual owner-limit/mutex/signature/identity/expiry fault logs with restored whole-owner Greens and structured Free/drain/cache mutation restoration records. All7 risk-bearing native/capability modules are byte-identical to the E4 checkpoint and all6 admission function bodies are byte-identical; F1 complete app/native/workflow owners re-executed Green. Subsequent DEF237 edits only relocate recovery signal/import credential crypto lazily and have92 scoped plus full regression evidence. No changed invariant or unreviewed surviving mutant; do not repeat unchanged fault runs during frozen browser validation.

F1 local completion: complete current-source inventory passes7574 physical cases (5777 root including exactly11 resolved conditional auth cases,450 native,434 workflows,913 browser-project cases); one inherited native updater TODO remains explicit and is not a pass. All39 app/workflow and 13 native source coverage policies pass unchanged. Fresh Linux x64 artifact/self-test, full builds/action manifests, types, lint, security/migration/strength/mapping checks pass. Desktop/mobile pricing visually reviewed using retained local price fixtures; no overflow. All242 canonical defects Verified, no unaccepted exception. All job-owned fixtures cleaned. T148/T150/T151/T152/T646/T649/T652/T655/T658/T659/T660 complete; final formatting remains to execute. Official full CI/five-platform native evidence remains required, so T149/T235/T316/T521/T639/T651 remain open and release recommendation is No-Go. No PR, push, merge, deployment or email has occurred; T660 retains its conditional later-request PR scope.

F1 T647 complete: final app:prettier:check passes all810 changed files in F1-v2-final-format.log; source lint remains0errors/6retainedwarnings on byte-identical production/test inputs. Final local checkpoint is1040/1046 tasks. Only T149/T235/T316/T521/T639/T651 remain open for required full CI and the official five-platform native workflow. Local candidate is reviewable; release stays No-Go. T660 publication scope remains conditional on a later PR request.

F1 static-review refactor qualification: the frozen 1660-input execution fingerprint be699c61e99437437c1721d70ffde7e259442f68eebece586bc421012d2be43d qualifies312 server cases across ten whole files,450 native cases across52 suites with all unchanged coverage floors, real multistream5/5 and exact Free acceptance2/2 with retries0. Refreshed T653 invariant faults are all caught: signature2 failed assertions, exact expiry1, identity1, capture fence4, clip flush3, owner-wide admission limit2. Every restored complete owner passes and every source/input hash is restored exactly. The incomplete initial signature cohort remains retained as unfavorable evidence under DEF255; it is not a kill. Current reports are F1-review-strength-results.json, F1-review-owner-strength-results.json and F1-review-final-native-coverage.json, with raw attempts/drivers in review-evidence.tar.gz. These behavior-preserving refactors do not create new feature Red or replace original intended Red history. Fresh full application/browser CI, native platform matrix and static scanner results remain required.

F1 final published refactor verification: complete runtime CI 39122026804 and official five-platform native workflow 39122022382 pass on `4be68ca3`. Application and native artifact source fingerprints both equal be699c61e99437437c1721d70ffde7e259442f68eebece586bc421012d2be43d. The published native packaging fingerprint is 54ff2834fbd8a9b6def81fe791c3ff6ee28e3118445410423683dee190c8daba. CodeFactor reports zero issues. Original intended Red and honest unexpected-failure evidence are preserved. QG-11 and the five story/full-validation closure tasks remain blocked only on explicit authorization for three exact GitHub false-positive dispositions after automatic approval rejection; no code, threshold, rule or alert-state workaround was applied.

Final security approval: user explicitly authorizes the three false-positive dispositions. GitHub confirms24,26,27 dismissed with individual reasons, zero open PR alerts, CodeQL and CodeFactor success, and complete runtime CI39123709920 success on04402364. All1660 qualified execution inputs match. QG-11 and T149/T235/T316/T521/T639 close with this evidence; all1046 tasks are complete. No new intended behavior Red is claimed, and no scanner rule or cryptographic validation changes.

### UX-C1 — Retired Runner access (2026-10-18)

- Red: `bun run test --runInBand --coverage=false --runTestsByPath test/server/runner/retired-access.test.ts`; `UX-C1` failed: expected `runnerPro: false`, received `runnerPro: true` (also scheduling/customStandby/attribution/concurrency mismatches).
- Green: same whole-file command passed after advanced capabilities were restricted to effective Pro. Old Runner input no longer unlocks advanced features. Further billing/schema retirement is UX-C2.

### UX-C2 — Retired catalog contract (2026-10-18)

- Red: whole-file `test/server/runner/retired-access.test.ts`; `UX-C2` expected `["pro_access"]` and received the additional `runner_access` enum member.
- Green: same whole-file command passed after retiring the entitlement/product enum members and capability sources. Follow-through removes billing/agency/notification paths, updates superseded legacy-positive fixtures and verifies current Pro behavior; user explicitly authorized this breaking hard cut.

### UX-C3 — Inline setup prerequisites

- Red: whole-file `test/app/components/runnerDestinationSelection.test.tsx`; UX-C3 failed to find the `Add destination` button beside the empty selector.
- Green: same whole-file command passed (6 tests) after inline creation/management was added. Refactor uses a HeroUI Select/multiselect; the whole-file owner remains green. Real-component acceptance owns actual popover interaction.

### UX-C4 — Stable appearance preview

- Red: whole-file `test/app/components/runnerBrandingPreview.test.tsx`; UX-C4 failed `expect(...).toBe(frame)` because typing replaced the iframe.
- Green: the whole-file owner passed 21 tests after switching to a stable document with validated same-origin draft messages. Earlier URL-query assertions were deliberately updated to observe the draft transport, preserving their upload/save/preview intent under the user's requested architecture correction. Preview save checks now require acknowledgment of the current draft revision as well as safe layout.

### UX-C5 — Calendar timezone and installed controls

- Initial test setup could not resolve the import-only Pro package and lacked matchMedia; corrected the unit test's explicit Pro double/browser setup. These were setup failures, not behavioral Red.
- Behavioral Red: `test/app/components/runnerScheduleAgenda.test.tsx` expected `Europe/Berlin`, received `UTC`.
- Green: the widget owner run passed 35 tests across Agenda timezone, schedule load cancellation, multi-day planner and appearance after sharing timezone and using the installed compound controls. Browser acceptance, including actual widgets and layout, remains required.

### UX corrective regression checkpoint (2026-10-18)

The follow-up transport, initial-load retry and message-origin/Free-branding checks are regression checks added after the corrective implementation; they are not claimed as historical ATDD/TDD Reds. The original targeted Reds above and the real pre-correction browser audit remain the test-first evidence actually observed. The new browser owner uses installed HeroUI, an isolated production build, disposable PostgreSQL and local assets. Free setup passed through inline creation, rejected-save retry, Start readiness, Scheduled upgrade lock and the appearance editor. Pro reached cross-day schedule persistence and live preview typing. Remaining upload/color/mobile checks and complete frozen-source gates must pass before closure.

Commercial retirement/entitlements/catalog owners passed81 cases; current heartbeat, Pro-source metadata, agency provisioning and notification owners passed120 cases. The appearance route/message owners passed; an obsolete shared heartbeat fixture required correction. Earlier complete gates remain historical and do not qualify this worktree.

### UX-C7 — Uncommitted timezone search must not save as the previous selection

Red: the complete Runner browser owner (`playwright test --project=bdd-chromium runner-free-pro.feature --workers=1 --max-failures=3`) failed BDD-US3-OPT036/EC006: after entering Invalid/Nowhere, Save closed the event editor without an error instead of retaining the saved event unchanged. Existing ComboBox selection remained UTC while the visible input showed the uncommitted search. Add field validation, retain search text for correction, and prevent Schedule save until a list selection is committed. Green must include the unchanged-storage assertion; no substituted timezone or silent reset is acceptable.

### UX-C8 — Accessible Agenda event activation

The same complete browser owner exposed two additional Reds (mobile and desktop week continuation): events rendered visually, but no named event button existed. Installed Agenda.Event is a motion div with pointer selection and no keyboard/role props. Its supported children now include a HeroUI Button/Agenda.EventTitle action, with keyboard activation and press propagation for the parent drag interaction. Keep actual drag, resize, mobile and keyboard owners as required checks; do not replace this with a hand-styled native button or silently drop accessible-role assertions.

### UX-C9 — Retained multi-destination settings after downgrade

Red: complete `test/app/components/runnerDestinationSelection.test.tsx` owner,1 failed/6 passed. A Free view with two retained destinations rendered the second as unselected (expected aria-pressed true; received false), masking paid configuration. Preserve the full selection for removal, prevent adding while over the Free allowance, provide the one-destination action, and require a valid count before Save/Start. Green must prove reducing to one without deleting either named destination. Extend both real expiry acceptance examples with a saved second destination and explicit reduction before Manual save.

UX-C7/C8 observed Green checkpoint: the complete browser rerun passes invalid-timezone storage preservation (BDD-US3-OPT036), mobile multi-week navigation and editable true dates, and desktop first-week continuation (DEC009). The run then exposed pointer setup still scrolling the removed wrapper. Update that observation to scroll Agenda.TimeGrid itself while keeping elementFromPoint, selected date/time, pointer and storage assertions unchanged; full owner remains pending.

UX-C9 inner Green: all7 destination-selection cases pass after exposing retained selections for removal. Real expired-Pro two-target acceptance remains required.

### UX correction integration checkpoint (2026-10-18)

- Current source commits: `6f87bd3b`, `9433536e`, `ec95eae8`; all are pushed. Standalone Runner commercial paths are retired; only effective Pro enables advanced Runner. No production data or generated migrations changed.
- Green: complete Runner schedule browser owner 42/42, including actual pointer create/move/resize, keyboard actions, invalid timezone rejection, multi-day/week IDs, Stop suppression/Resume, expiry/renewal. This completes the browser follow-through for UX-C7/C8; tests retain the original stored values and output assertions.
- Green: complete acceptance owner 22/22 after deterministic real consent preparation; expired grant and billing-deadline cases retain two destinations, require explicit reduction to one, and verify a valid Manual save/basic Start. This is UX-C9's complete downgrade follow-through.
- Green: main push hook 201 suites/3,043 cases; one inherited conditional suite/three cases skipped. Enrollment follow-up owner 2/2; complete application/native types, lint (five unrelated inherited warnings), production build and patched dependency verification pass. Push feedback is not full coverage.
- Test-first accounting: original UX-C1..5 and follow-up UX-C7/C8/C9 Reds are recorded separately above. Broad real-browser UX journeys were added after initial correction code and are regression/acceptance evidence, not invented test-first history. Enrollment token/Button consistency is a reversible styling follow-through with the existing whole-file owner.
- Current input fingerprint: `f6552f4deb6c2c89c6a44dc58e550f68964d331aae6ee838599f36ac5e539890`. Final real UX captures, complete affected browser inventory and coverage remain open. Evidence: `tdd/evidence/ux-correction/`.

- Final real-component editor acceptance: 3/3 passes on the final production build. After the nested destination editor closes, explicitly await focus restoration to its Add destination trigger before Escape; the original immediate Escape raced the library focus transition. This adds a keyboard assertion rather than forcing dismissal. Inspected final Free dark attribution, Pro dark appearance, light desktop setup, light mobile setup and mobile day calendar. Evidence images and `real-editor-acceptance-3.log` are retained under `evidence/ux-correction/`.

### UX-C10 — Preserve mobile preview readability (2026-10-18)

- Red from complete affected browser inventory: `runner-collision` mobile 720p/1080p and `runner-readability` light/dark/busy 360px cases fail their existing full-width assertion. Received 280px (one entering-animation measurement 281.1px), expected 360px. Desktop readability passes. This is a product regression from modal padding, not a reason to lower physical text readability or weaken edge/canvas checks.
- Production correction: Appearance modal removes horizontal outer/dialog padding on narrow screens, preserving normal control gutters and desktop styling. Preview alone uses the full mobile width. Measurement awaits the same expected final width after the library transition/ResizeObserver rather than sampling during animation. Green pending rebuild/whole-owner execution.
- Related observation corrections: file-boundary fixtures now target Pro DropZone's internal file input explicitly (real chooser UX remains independently covered); pause setup waits for actual modal dismissal before reopening. No backend/storage or media assertions changed.

- UX-C10 Green: all 35 complete collision/readability/upload-boundary/pause browser cases pass on the rebuilt correction. Full 360px preview, unchanged 720p/1080p internal canvas, minimum physical text size, both exposed edges, no overflow and all light/dark/busy playback/standby surfaces pass. Inspected busy-frame mobile preview; preserve final 360px preview/output images under `evidence/ux-correction/`. Twenty-three complete component cases pass; rebuilt production types/dependency checks and affected lint pass. Remaining complete browser/coverage gates remain open.

- Final mobile follow-through: correction pushed as `22d77279`; required related-suite hook passes. Current frozen input fingerprint is `237181f39198bdae1ca9a7df2c7905e59163162cbb392ce6965bb3cdf0159d71`. The complete editor acceptance passes 3/3 again after the mobile correction. A separate disposable-fixture visual observation inspected the full mobile Appearance controls and preview: viewport/document/preview all390px, preview x0. Retained `pro-appearance-mobile-controls.png`, `pro-appearance-mobile-preview.png` and `mobile-appearance-observations.json`. This observation is visual evidence, not an extra test count.

- Completion reset: remove the last redundant destinations heading/paragraph. Stop the unfinished local coverage and browser owners because execution inputs change; neither is a complete passing gate. The local coverage ordinary phase passed341 owners but the database/workflow/threshold gate was unfinished. Browser execution reached68 passes before interruption;44 cases were unrun. Final completion belongs to fresh full CI on the final fingerprint, not these partial totals. A brief overlapping build attempt was stopped; the clean rebuild starts only after the browser server shuts down (UX-TEST-11/12).

- Final source checkpoint: fresh production build passes; whole destination-boundary/custom-standby browser owners pass20/20, including actual chooser uploads of background/logo, reload persistence, storage-failure preservation and saved-timezone next-broadcast display. Real editor acceptance passes3/3 again. Current fingerprint: `a97b20fa9b7ba1dc8322ecfcc0b57f255fc27be83fca77f8f1727b4bb1bb7b2e`. Complete CI remains required; no completion result is inferred from the earlier interrupted owners.
