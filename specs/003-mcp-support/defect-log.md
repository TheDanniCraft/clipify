# Defect Log: MCP Support

> Consolidated MCP server scope: 66 tools on `feature/mcp-support`. The original foundation, workflow expansion, feedback and focused editing tools belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

**Feature**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)  
**Traceability**: [test-traceability.md](test-traceability.md)  
**Test Summary**: [test-summary.md](test-summary.md)  
**Created**: 2026-10-04  
**Last Updated**: 2026-10-04

## Purpose and Scope

Track defects, unexpected test failures, escaped issues, accepted risks, and verification evidence for this feature. Record only product, test, environment, or governance issues that affect feature readiness; routine implementation tasks belong in `tasks.md`.

## Status Vocabulary

- `Open`: confirmed issue without an implemented fix.
- `In Progress`: fix or investigation is underway.
- `Blocked`: progress needs an external decision, dependency, access, or environment change.
- `Fixed`: fix is implemented and awaiting verification.
- `Verified`: fix is confirmed by linked evidence.
- `Deferred`: accepted for later work with approval and compensating evidence.
- `Rejected`: triaged as not a defect, duplicate, or out of scope with rationale.

## Severity and Priority Policy

| Level    | Severity Meaning                                                                                                           | Priority Meaning                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Critical | Data loss, security exposure, unavailable core workflow, legal/compliance risk, or release-blocking safety issue           | Must be resolved before release unless explicitly accepted by the accountable approver |
| High     | Major user-visible failure, broken acceptance criterion, severe performance/accessibility failure, or high-risk regression | Resolve before release unless a documented exception exists                            |
| Medium   | Partial workflow failure, workaround exists, non-critical quality gate failure, or localized regression                    | Resolve in the current release when practical or track as follow-up                    |
| Low      | Cosmetic, documentation, low-risk maintainability, or minor non-blocking issue                                             | Resolve opportunistically                                                              |

## Defect Summary

| Defect ID | Title                               | Severity | Priority | Status   | Evidence                                                                                           |
| --------- | ----------------------------------- | -------- | -------- | -------- | -------------------------------------------------------------------------------------------------- |
| C1        | Tests/implementation ordering       | Critical | Critical | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| C2        | Unbound future feature generation   | Critical | Critical | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| C3        | Wrong revision test reference       | Critical | Critical | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| C4        | Malformed concurrency gate table    | Critical | Critical | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| C5        | Collapsed error/resource examples   | Critical | Critical | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| C6        | Ambiguous Gherkin owning-suite tags | Critical | Critical | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| H1        | Early creator-read dependency       | High     | High     | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| H2        | Missing provider schema source task | High     | High     | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |
| M1        | Revision artifact file mismatch     | Medium   | Medium   | Verified | Corrected spec/plan/tasks/traceability; repeated document checks and semantic analysis, 2026-10-04 |

## Defect Details

All nine entries are planning/governance defects discovered during read-only analysis. Reproduction: follow the referenced task sequence or compare the original cited reference/table/example with its source. Expected: executable test-first dependencies, one owning suite, complete explicit cases, normalized gates and consistent references. Actual before remediation: those conditions failed. Resolution: corrections documented in tasks.md Remediation Closure and plan.md Corrected Incremental Execution Boundaries. Verification: repeated cross-artifact checks confirm preserved IDs, prerequisite order, scenario/example coverage and table cardinality. No production code was changed and no product test is claimed Green. No risk acceptance or threshold exception was needed.

## Open Defect Review

No open planning defects remain from the nine reported findings. Required unexecuted product tests and real-host prerequisites still prevent release; these are recorded in test-summary.md and are not exceptions.

## Verification and Regression Closure

All nine document findings are Verified by repeated semantic analysis and structural checks on the current artifacts. Evidence: tasks.md Remediation Closure; spec.md explicit scenario examples; test-traceability.md registry/source/matrix/task mappings. Production regression verification remains Planned and is not inferred from documentation checks.

## Defect Metrics

| Metric                                   | Value | Notes                              |
| ---------------------------------------- | ----- | ---------------------------------- |
| Total planning/governance defects        | 9     | Six Critical, two High, one Medium |
| Verified planning defects                | 9     | Document analysis only             |
| Open Critical / High                     | 0     | Product execution remains pending  |
| Confirmed production defects             | 0     | No production tests run            |
| Deferred / accepted / reopened / escaped | 0     | No approved exceptions             |

## Required Checks

- [ ] Every unexpected failing test or gate has a defect entry or documented non-defect rationale.
- [ ] Every Critical or High defect is `Verified`, `Rejected`, or explicitly accepted with approver, rationale, compensating evidence, and follow-up.
- [ ] Every deferred defect has scope, owner, target follow-up, and risk acceptance.
- [ ] Every fixed defect links to verification evidence in `test-traceability.md` or CI artifacts.
- [ ] Defect counts and release-impact decisions match `test-summary.md`.

## Planning Analysis Remediation

Nine document-analysis findings (C1–C6, H1–H2, M1) were corrected in the design artifacts. These are governance/document defects, not production test failures. Verification is the repeated read-only cross-artifact analysis and identifier/example/table/order checks; production evidence remains Planned. Record any remaining issue as open rather than inferring product readiness from this closure.

### ENV-001 — schema fixture boot (Verified)

Generator using an unprepared Drizzle fixture failed because provider init seeds oauthResource before that model exists. Command: bunx auth@1.7.6 generate --config test/support/mcp/provider-config.ts --output /tmp/mcp-auth-schema.ts --yes. Expected generation; actual missing-model adapter error. Fix: supported --adapter drizzle --dialect postgresql generation with an in-memory fixture, avoiding a database entirely. No migration generation.

### ENV-002 — generated schema merge import (Verified)

TDD command `bunx jest test/mcp/contract/provider-schema.test.ts --runInBand` failed loading merged schema: jsonb undefined rather than expected assertion success. Added the generator's required jsonb import. All 13 tests now pass; see test-results/mcp/provider-schema-green.txt.

### ENV-003 — evidence output collision (Verified)

Playwright cleared the test-results root, deleting earlier local raw logs. Use isolated output test-results/mcp-bdd and capture run logs first under /tmp/clipify-mcp-evidence, then copy to test-results/mcp. Red evidence rerun before implementation. Baseline rerun required for retained raw output (same pre-resource code).

### ENV-004 — registration fixture (Verified)

TDD-US1-002 expected valid native loopback callback registration, got invalid_redirect_uri: fixture omitted application_type and defaulted to web. Explicit native type follows provider callback policy. Removed duplicate JWT plugin in fixture. Green: 7 Jest tests and all 4 BDD cases. No provider security check relaxed.

### ENV-005 — shared-principal fixture role assumptions (Verified)

`bunx jest test/mcp/integration/creator-read-pilot.test.ts --runInBand`: expected allowed creator-read for viewer/content-manager, actual current role denial. Existing standard roles contain no viewer, and content-manager grants playlist/gallery operations only. Tests now use owner, operations and explicit custom-reader permissions; no production role expansion. Creator DTO fixture now uses usersTable.username, caught by TypeScript. Eight pilot cases pass.

### ENV-006 — disposable PostgreSQL bootstrap (Verified)

Docker socket absent. Downloaded PostgreSQL 16.14 binaries into /tmp; hydrated shipped symlinks and supplied their library path. Created loopback-only temporary cluster on port 54419 as current user. Isolated fixture database creation uses pg client (binary distribution omits createdb/psql). Fixture DDL reflects schema sources, handling JSON/array defaults and adding indexes/FKs. No drizzle generation or push. Per-test databases are dropped on close.

### ENV-007 — standalone server import boundary (Verified)

Consent TDD expected bound tokens; standalone Bun imports failed because server-only was not installed and entitlement resolution eagerly imported community/Twitch UI dependencies under React server conditions. Added the marker dependency; community invalidation loads lazily when its existing mutation runs. Scoped provider factories no longer leak ESM auth dependencies into pure scope selection. Controlled real-provider flow and consent tests pass.

### ENV-008 — exact UI/scope fixture assertions (Verified)

Consent UI expected bare client text while actual heading is Connect + client. BDD both-delete expected a duplicate playlist scope. Assertions now use the exact accessible heading and unique scope set; neither production scope restrictions nor expected deletions were loosened. Three component tests and all 13 consent BDD cases pass.

### ENV-009 — transport fixture protocol and JWT claims (Verified)

First transport Green run had wrong-issuer/audience negatives accidentally signing the original claims, a legacy SSE response parsed as JSON, and a hand-built modern discovery request missing the SDK v2 method/envelope/header and metadata result shape. Corrected fixtures using installed package contracts, preserving 401 assertions and requiring exact Clipify server identity/version/capability. Eight Jest and five BDD examples pass.

### MCP-010 — empty-scope denial (Verified)

Deselecting every permission then denying returned invalid_scope. Denials now omit scope entirely and delegate signed callback validation to the provider. Both ordinary and empty-selection denial cases pass; no grant is created.

### ENV-011 — connected-apps UI test setup and discipline exception (Verified setup; evidence exception open)

Initial UI run failed with zero tests because a virtual alias mock did not resolve; UI/action source was mistakenly authored before recognizing the setup failure. Corrected the mock, temporarily withheld the new panel, observed two intended missing-panel failures, then restored and obtained Green. This later Red does not establish original test-first chronology. Added action safe-failure assertion exposed a real uncaught error, corrected after Red. HeroUI Pro import-only exports use an explicit virtual test mock; real component/browser verification is still pending. No test expectations weakened and no full-story claim made.

### ENV-012 — creator discovery fixture prepared statements (Verified)

First creator fixture run attempted two parameterized SQL statements in one pg query; PostgreSQL rejects this setup before behavior checks. Split membership/link inserts into separate prepared statements. Retained intended Red in creator-capabilities-red-verified.txt; 35 Jest cases and two BDD cases pass.

### ENV-013 — server consent page importing client-only Pro package (Verified focused; full rerun pending)

MCP progress run passed 137 tests but failed three consent-page unit tests because the page fixture imported the client form through an import-only HeroUI Pro entry point. Isolated the client form in the server page unit suite; signed-state/auth/selection assertions remain unchanged. Three component suites/eight cases then pass in consent-page-heroui-green.txt. This fixture fix does not establish visual correctness.

### ENV-014 — existing overlay fixture missing required revision (Verified)

Typecheck correctly found that the existing Free overlay runtime-policy fixture omitted the new nonnullable configurationRevision field. Added the schema default of one to that fixture; production type requirements remain strict. Typecheck passes and the runtime-policy/revision/risk suites pass all 30 tests in primitives-refactor-green.txt.

### ENV-015 — browser runtime dependencies (Verified)

Visual fixture bundles actual HeroUI/Pro and Clipify CSS successfully, but Chromium was absent and then failed to load libnspr4.so. Installed Playwright Chromium and downloading/extracting required shared libraries into /tmp without modifying project dependencies or production code. Also supplied fonts through temporary fontconfig. Actual HeroUI/Pro consent and connections render on desktop/mobile; preset selection, explicit delete default, creator selection, approval, revoke confirmation and no overflow are verified. Click visible control labels rather than concealed native inputs, following actual React Aria interaction. This visual fixture uses stubbed actions; full authenticated browser journey remains Planned.

### ENV-016 — mutation fixture module scope (Verified)

Removing an unused type import left a require-only unit test in global script scope; typecheck detected collisions with other tests and an overly narrow nullable grant fixture. Added an explicit module marker and widened only the test row input to permit negative revoked/expired variants. Production types remain unchanged. Typecheck passes after also renaming the Bun-only temporary visual build script to .mjs; no application tsconfig exclusion or test type weakening.

### ENV-017 — Node provider probe module format (Verified)

Direct Node/tsx execution of the fixture rejected top-level await because this repository uses CommonJS package metadata. Wrapped the fixture entry in an async main without changing provider/resource behavior; verify both Node and Bun before using Node V8 coverage or runtime evidence. The initial failure is a fixture setup failure, not product Red. Node provider/PG/MCP overlay read succeeds; broader Node run exposed separate cleanup race ENV-018.

### ENV-018 — PostgreSQL forced-drop cleanup race under Node (Verified affected suites)

MCP_PROBE_RUNTIME=node bunx jest test/mcp --runInBand passed 231 tests but four flows failed at cleanup: pg Pool.end removed ending clients before their TCP shutdown was visible to PostgreSQL, and DROP DATABASE WITH FORCE sent FATAL 57P01 to an idle pool with no error handler. This is fixture teardown, not business behavior. Wait up to five seconds for that unique fixture database’s connections to drain, then use ordinary DROP; never swallow pool errors or force termination as passing evidence. All 23 affected Node transport/retry/quota cases pass in node-cleanup-reverified.txt. Full Node rerun remains pending.

### ENV-019 — browser action extraction fixtures (Verified)

After the intentional delegation Red/Green, three existing database-action suites still asserted the removed inline creation implementation or invoked a real session lookup outside a Next request. Adapted action-boundary fixtures to stub the verified browser adapter and assert preserved results/target forwarding; quota/identity/current-permission behavior remains covered by the adapter unit suite and real shared-service PostgreSQL tests, including membership removal and partner entitlement. One scripted test edit initially left a duplicate closing brace; fixed before verification. Four affected suites/171 tests pass in browser-action-refactor-reverified.txt. No product plan/permission rule loosened.

### ENV-020 — SDK registry callback inference

Adding the fourth strictly typed tool made TypeScript lose contextual inference for the union of SDK registration overloads (`TS7006`). Explicitly typed the callback boundary as `unknown`; each operation still validates its own strict schema. Verified: get-overlay 55 affected cases, typecheck-reverified and scoped lint pass.

### MCP-021 — Paid overlay settings missing from first edit slice

Initial shared edit slice enforced current membership and retained-resource access but did not yet enforce the existing advanced_filters restriction. Genuine Red shows Free volume, filter and styling changes committed through MCP. Feature remains disabled. Fix: restrict all patch fields beyond existing basic name/status/type/playlistId to effective Pro inside the mutation transaction; tests require preservation on rejection. Verified initial slice: eight affected Jest cases and four BDD examples pass; full feature gates remain pending.

### ENV-022 — BDD world input narrowing

Typecheck caught the paid-settings step passing an optional unknown fixture input directly to a string argument. Added an explicit string check and fixture-specific failure before invoking the probe. Browser scenarios had passed at runtime. Typecheck and affected BDD reverification pending.

### ENV-023 — Playlist creation fixture requested only read scopes

Public fixture added approved playlist write scopes but its authorization request still used read-only scopes; provider correctly rejected consent with invalid_scope. Initial public Red was invalid evidence, superseded. Initial Green caught this before completion. Retry-helper seven-case Red was valid and those cases pass. Corrected requested scopes and asserted protocol entry status. First withholding script assumed multiline formatting and stopped at its assertion; subsequent tests passed with registration present and are not Red. Withholding the actual single-line registration now establishes corrected missing-tool Red. Original registration was authored before qualifying public Red; chronology exception remains disclosed. Verification pending.

### MCP-024 — Consent page rejects legitimate repeated provider state

Actual Next.js browser flow reaches an invalid-request alert because Better Auth 1.7.6 emits repeated signed ba_param values. Unit/handler fixtures did not exercise the real signed query rendering. Defect confirmed in real-consent-review-reverified.txt; page-level and real-browser BDD regressions being executed before production fix. Permit repeatable ba_param only and preserve all values/order; continue rejecting duplicate critical OAuth fields. No user/external blocker.

### ENV-025 — Mobile visual fixture did not dismiss global privacy prompt

Actual mobile Next.js review could not click consent approval because the existing global privacy-choice banner covered the footer. Explicitly reject optional services before interaction/screenshots in this controlled browser fixture. No production privacy or consent bypass; real desktop BDD already passed. Mobile review reverification pending.

### ENV-026 — Live dev-server verification raced compilation/hydration

Mobile visual rerun encountered a Next dev-route JSON manifest parse failure while source formatting was triggering recompilation; provider returned 500 before its handler. Earlier actual-browser BDD passed. Screenshot before client interaction also raced React hydration with Playwright caret hiding. Repeat against stable sources; take screenshots after checked/approval-enabled interactions establish hydration. No production code workaround. Verification pending stable rerun and final build.

### ENV-027 — Incorrect generated BDD selection path (Verified)

Initial removal slice command used .features-gen/test/bdd/features instead of actual .features-gen/bdd/mcp-support; selected zero tests. Corrected path executed one failing scenario before production and is the qualifying Red evidence. No product defect or coverage claimed from empty selection. Evidence: test-results/mcp/remove-playlist-items-bdd-red-corrected.txt.

### ENV-028 — Clip validation test variable conflicts with CommonJS (Fixed)

Command bunx jest test/mcp/unit/clip-validation.test.ts --runInBand failed before executing any test: local module variable redeclared the CommonJS module binding. Expected missing resolveValidatedPlaylistClips behavior could not yet be tested. Rename fixture variable to clipValidation and rerun; initial compile failure is excluded from qualifying Red evidence. No production changes preceded this correction.

ENV-028 verification: corrected clip-validation tests execute eight qualifying missing-module failures, then eight Green and eight formatting-refactor Green tests. Evidence test-results/mcp/clip-validation-red-corrected.txt and clip-validation-refactor-green.txt. Status: Verified.

### ENV-029 — Public append fixture omitted parent seeding (Fixed)

Jest add_playlist_items through and canonical add BDD failed during setup with PostgreSQL playlist_clips foreign-key violation, before MCP dispatch. A formatter expanded the resource seeding predicate and the fixture replacement did not add playlist-add to that predicate. Add the missing mode explicitly; rerun the exact nonempty selections. Initial failure is excluded from Red evidence; no public add production change has been made.

ENV-029 verification: corrected fixture reaches actual OAuth/MCP dispatch; twelve missing-public-tool failures plus scope control precede implementation. Thirteen Green public cases and one BDD subsequently pass. No live Twitch host is claimed; isolated encrypted credentials and controlled external response verify the provider boundary. Status: Verified. Evidence test-results/mcp/add-playlist-items-red-corrected.txt and add-playlist-items-green.txt.

### ENV-030 — Evidence updater also overwrote scenario classifications (Verified)

The temporary updater matched repeated BDD IDs in both the registry and scenario matrix, replacing positive/negative class and interface with status/evidence. Restrict updater to Evidence Artifact Registry before Source Coverage Map. Restore 33 affected scenario rows to semantic input classes/interfaces; no execution status is inferred from matrix columns. Registry evidence remains the single execution authority and full dashboard requirements remain pending. Structural verification ensures no status tokens remain in scenario classification fields.

### MCP-025 — Item operations implicitly require playlist read (Open)

Custom consent may approve playlist-items:manage without playlist:read. Add/remove/reorder currently roll back when their safe response delegates to the public read service. Three real OAuth/MCP cases and three BDD examples reproduce the unexpected extra scope. Extract a private safe snapshot projector used after authorized locked mutation; keep public get_playlist read authorization. Evidence test-results/mcp/item-manage-scope-red.txt and item-manage-scope-bdd-red.txt.

MCP-025 verification: private snapshot extraction preserves public read permission while all three item verbs succeed under their declared item-management scope. Three real OAuth/MCP cases, three BDD examples, twenty affected refactor checks and typecheck are Green. Status: Verified. Evidence test-results/mcp/item-manage-scope-refactor-green.txt and item-manage-scope-bdd-green.txt.

### ENV-031 — Standalone consent target probe omitted application pool drain (Fixed)

Both new test cases failed during cleanup with an undrained database connection. The standalone probe closed its fixture pool but omitted dbPool.end used by the existing flow probe. Drain the application pool before fixture.close and rerun. Cleanup failure is excluded from qualifying Red; production remains frozen during independent full regressions. Any orphaned disposable probe databases will be identified by isolated test client/actor metadata before cleanup.

### MCP-026 — Offline-only scope skips selected creator authority (Open)

One genuine real-provider consent test issues a code and active grant for an existing foreign creator because the permission loop filters offline_access and performs zero checks. Owned-creator control passes with exactly offline_access. Add an authority-only fallback check when no operational scopes exist; keep granted scopes unchanged. Production is unchanged while full regressions finish. Evidence test-results/mcp/offline-consent-target-red-corrected.txt.

MCP-026 verification: foreign offline-only target now denies without code/grant; owned control remains narrowly offline_access. Two provider cases, two BDD examples and combined refactor/typecheck pass. Status: Verified. Evidence test-results/mcp/offline-consent-target-bdd-green.txt and coverage-consent-refactor-green.txt. ENV-031 pool shutdown correction is verified by these cleanly completed probes.

### ENV-032 — Coverage validator rejects legitimate compiler synthetic branches (Open)

Existing real Istanbul coverage has no-else locations with empty start/end mappings. The new checker wrongly rejects this standard form. One regression test fails while eighteen controls pass. Permit strictly empty synthetic locations only when the branch host has a valid source location; continue rejecting malformed counters, invalid nonempty locations and mapping mismatches. Evidence test-results/mcp/coverage-compiler-mapping-red.txt.

ENV-032 verification: nineteen checker tests pass after standard synthetic mapping support; malformed mappings remain rejected. Status: Verified. Evidence test-results/mcp/coverage-compiler-refactor-green.txt.

### ENV-033 — Direct TSX CommonJS coverage includes generated export-analysis annotation (Verified calibration)

Real Node/V8 data included a cold generated 0&&module.exports annotation remapped to the type-only end of permissions.ts, giving 94.73% despite its sole runtime assignment executing. Native ESM compilation with existing esbuild removes that CommonJS analysis artifact; the same real encrypted-credential append succeeds and standard c8 maps permissions.ts to 100%, without modifying product source or coverage thresholds. Monocart experiment did not correct the compiler artifact and was removed. These are collector calibration experiments, not release coverage evidence.

### ENV034 — Coverage collector harness quoting (fixed)

The initial collector test's nested JavaScript string emitted a literal newline inside a quoted split delimiter and failed before execution. Corrected escaping; rerun `coverage-collector-red-corrected.txt` now has three intended missing-collector assertions. The setup failure is excluded from Red evidence.

### ENV035 — Multi-source V8 remap exclusion (verified)

The initial native ESM collector surfaced source files but assigned no function/branch ranges: Node cached multi-source map paths are file URLs and c8's post-remap glob matcher excluded those ranges. Calibration's unexecuted delete assertion correctly failed. Select the actual generated ESM probe before remapping, then filter the resulting filesystem source map to the unchanged required manifest. No execution counters or thresholds are modified. Three calibration checks now pass, including an unexecuted real delete counter of zero; affected checker/consent suite passes 24 tests. Evidence: test-results/mcp/coverage-collector-refactor.txt. Full source coverage remains pending.

### ENV036 — Rejected scope response assumption

Exploratory scope-challenge assertions assumed an OAuth string `error` in the response body. Actual pinned Better Auth MCP correctly returns JSON-RPC error -32000 with a 403 RFC 6750 insufficient_scope header naming the missing permission. Inspection of the pinned implementation confirms this intentional MCP response format. No product defect; no production change or qualifying Red is claimed. Removed unsupported exploratory assertions/scenarios; original permission-challenge regressions remain. An outer fallback body consistency check is a separate unit boundary, not evidence of a broken real MCP scope challenge.

### ENV037 — Native ESM provider probe dynamic alias import (fix in progress)

Full source-coverage snapshot fails provider-probe imports with ERR_MODULE_NOT_FOUND for the TypeScript @/server alias. The probe constructed a runtime file URL, preventing esbuild from bundling the actual provider-options module. Use a statically resolvable actual-module import; this changes no production behavior and does not substitute mocks. The initial full run is failed evidence, not Green. Other real PostgreSQL suites continue; affected provider checks and the corrected full measurement must be rerun.

### ENV038 — Rate-limit probe local-name collision (fixed)

The new tool retry status local collided with the existing authorization-code replay status. Renamed the tool-specific local/output to toolReplayStatus, preserving existing code-replay evidence. Initial registration assertions failed for missing throttling, but the initial tool/BDD tool setup failure is excluded from qualifying Red; both suites are rerun before HTTP production wiring.

### ENV039 — Parent and child coverage mapping provenance (verified)

First full source-coverage run completed its tests but the native Jest reporter aborted with a negative-column mapping exception before emitting current coverage JSON. The bridge merged Jest Babel transformed-code locations with already-remapped c8 TypeScript locations, then Jest attempted to map the mixed file again. Resolve parent source maps before merging child counters; preserve execution counts and native thresholds. Delete only stale generated coverage-final.json before measurement so a report failure cannot be mistaken for current measurement. That run also includes ENV037 provider import failures and ENV038 transient probe collision while a collector calibration rebuilt; it is failed diagnostic evidence, not final regression or coverage. Future full measurement freezes all source/probe edits until completion.

### ENV040 — Migration policy CLI mode (fixed)

The read-only guard was invoked without its required staged/generate mode, yielding usage error; no migration command ran. Corrected staged guard passes and a direct read-only working-tree check uses the exported migrationPolicyViolations function on changed/untracked drizzle paths. No generated migration changes or guard changes exist. The eleven migration-policy/CI schema-push target tests pass. No override was set.

### ENV041 — Browser regression cold compilation and privacy banner (verified)

The first rerun after starting the fresh isolated Next server approved consent and exchanged the token, then exhausted the 60-second scenario budget on the first MCP request. Anonymous MCP warm-up now returns 401 with discovery challenge. The second attempt reached consent but the global privacy banner intercepted the approval button (same underlying fixture omission as ENV025). Add an explicit normal-user Reject optional interaction to the BDD journey, as already used by the successful real desktop/mobile review. Neither timeout counts as passing regression or qualifying product Red. Repeat the original journey with its unchanged timeout; if MCP still stalls when warm, investigate as a separate product defect rather than assuming compilation is the only cause.

ENV041 verification: Reject optional triggers an actual window.location.reload. The fixture now waits for its load event before selecting the creator and approving consent. Original 60-second scenario passes in 6.2 seconds, including PKCE exchange and authenticated MCP call; no production UI changes or timeout increase. Evidence: test-results/mcp/rate-real-browser-reload-regression.txt.

### ENV042 — Native discovery fixture creates duplicate resource instances (verified)

Bun alias cases passed, but native Node loaded both an unused fixture Better Auth instance and the actual application instance against the same isolated database. Concurrent provider initialization attempted duplicate oauth_resource identifiers. Move fixture-only auth initialization after alias early return so aliases instantiate only the actual application auth. This is fixture setup failure, not qualifying product Red. Re-run native alias and registration boundaries.

ENV042 verified: all eleven native Node registration-root and discovery-alias tests pass with one provider initialization per fixture. Evidence: test-results/mcp/registration-shapes-node-corrected.txt.

### ENV043 — Evidence helper namespace collision (fixed)

A report-update script reused the helper global p for a test file before calling cycle(), causing NotADirectoryError. Earlier registry/task edits completed, but that cycle append did not. Load helper functions in a separate dictionary namespace and rerun the missing append once. No production or test result changed.

### ENV044 — Missing scheduler virtual mock path (fixed)

The startup test tried a virtual mock of an alias-mapped scheduler file before the file existed; Jest alias mapping rejected it before collecting those startup cases. Replace the absent-module mock with the existing cleanup database boundary and verify actual register() dispatch under fake timers. That setup failure is excluded from qualifying Red; rerun before scheduler/startup production changes.

### ENV045 — Direct native Node probe top-level await (verified)

The six-suite cleanup/rate regression used the direct Node --import=tsx path. Two older probes contained top-level await and were compiled as CJS because the repository is not an ESM package; ten tests failed before any fixture or production call. Prior native ESM bundled coverage evidence remains valid. Wrap those two probe entry points in async main with the existing finally cleanup and explicit fatal-error reporting, matching the other native-compatible probes, then repeat the original six-suite command. No limiter implementation change or qualifying product Red.

ENV045 verification: corrected native Node six-suite regression passes all 45 tests (test-results/mcp/cleanup-rate-corrected-regression.txt). ENV039 verification: frozen full coverage run passed 2150 tests and produced valid source-remapped counters for all required files, preserving native global/gallery gates; remaining 59 feature threshold gaps are actual unexecuted branches rather than mapping/collection errors. Evidence: test-results/mcp/source-coverage-rate-snapshot.txt and coverage-full-rate-snapshot.json.

### ENV046 — Playlist race interleave not reached (verified)

The proposed snapshot tests failed because snapshotInterleaved=false rather than exposing a mixed version. No production snapshot change has been made. Diagnose which real query/builder boundary the fixture reaches, correct the interleave, and repeat both unit/integration and BDD Red before implementation. Initial failures are fixture setup, not qualifying product Red.

ENV046 root cause: SDK response stream returns before tool execution necessarily finishes. The fixture restored interception before consuming the stream. Keep the real application-pool interception active until response.text() finishes, restore in finally, remove diagnostic SQL output. Corrected Red exposes mixed parent/item versions; production repeatable-read snapshot makes four focused backend cases and two BDD examples pass. Native refactor checks pending.

### ENV047 — Scenario matrix editor matched short task-map rows (fixed)

A script searched beyond the scenario matrix and matched a short BDD-US2-009 task-map row, causing IndexError before any file was written. Require the full scenario-table column count before editing. Repeated the edit successfully; task-map rows remain intact.

ENV046 native verification: all 38 selected Node read/item-mutation/schema cases pass after stream-aware fixture refactor. Evidence: test-results/mcp/playlist-snapshot-node-refactor.txt.

### ENV048 — Browser revision fixture clicked the hidden Pro radio input (fixed, verification pending)

The first actual-browser revision journey timed out trying to click the visually hidden React Aria radio input beneath its visible HeroUI Pro label. Use the normal visible Read & edit label click and assert the accessible radio is checked, as in the prior real design review. No force click, production UI change or timeout increase. This fixture failure is excluded from qualifying Red; repeat the original journey before revision production work.

### ENV049 — Configured Host versus framework-internal URL (verified)

Actual browser playlist setup reaches MCP with a valid token but receives 403 before its read. The new transport guard rejects when either request.url.host or the actual Host differs from configured host; Next can normalize the internal URL to localhost even when Host=127.0.0.1:3107. Anonymous real server GET and discovery metadata diagnostics isolate this guard. Add a real-route controlled case for differing internal URL with valid actual Host, rerun original browser consent as prerequisite Red, then use Host as authoritative and URL only as fallback when Host is absent. Preserve foreign Host rejection. This is a regression caused by transport change, not qualifying browser-writer Red.

ENV049 verification: the actual Host is authoritative, with request URL fallback only when absent. Eight request-boundary tests pass, including foreign Host rejection and internal URL mismatch; the original actual consent browser journey passes unchanged. Evidence: /tmp/clipify-mcp-evidence/framework-host-green.txt and framework-host-browser-green.txt. Eight native Node boundary cases also pass; retained evidence in test-results/mcp/framework-host-*.txt.

### ENV050 — Browser revision privacy banner hydration race (verified)

An immediate isVisible check missed the asynchronously rendered privacy banner, which later intercepted approval. Require the visible normal Reject optional choice, then await its reload and consent heading. No timeout increase or production UI change; this fixture failure is excluded from product Red.

ENV050 follow-up: provider may recover a prior anonymous privacy decision from the real server, so a fresh browser alone does not guarantee a banner. Use the existing Enable support chat control to explicitly open privacy preferences, then Reject optional and await its reload. This uses normal application UI and avoids guessing hydration timing. First Green attempt excluded due fixture expectation; 182 action/adapter tests pass.

### ENV051 — Next development indicator intercepts privacy launcher (verified)

The Next dev indicator overlaps the bottom-left support privacy launcher. Activate the same real application button through normal focus and Enter keyboard interaction, and target Reject optional within its dialog. No force click, overlay removal or production configuration change. Previous pointer failure excluded from product Green.

ENV050/051 verification: real browser rename/conflict journey passes in 37.8 seconds under unchanged 60-second budget. Source typecheck, lint, 182 action/adapter cases and four native Node update cases pass. Evidence: test-results/mcp/browser-playlist-revision-*.txt.

### ENV052 — Reverse browser conflict setup exceeds scenario budget (verified)

The first reverse-conflict journey exhausted the unchanged60-second budget before a successful MCP setup rename. No feedback production change made. Add safe error-code assertion to distinguish service outcome, repeat warm journey; this setup timeout is excluded from qualifying feedback Red. Component case independently fails for existing generic toast.

ENV052 verification: warm unchanged-timeout run reached expected missing-feedback Red; production guidance makes both browser conflict directions pass (39.9s/14.7s). Eighteen component/adapter checks, lint and tsc pass. Evidence: test-results/mcp/browser-playlist-stale-*.txt.

### ENV053 — Activity visibility fixture violates existing redaction check (verified)

The proposed legacy private metadata used secret/token keys that the actual database correctly rejects via audit_events_metadata_secret_redacted before service invocation. Use permitted privatePayload/rawInput note fields to prove allowlisted output exclusion without disabling any constraint. Initial ten TDD/six BDD setup failures are excluded from qualifying Red. Repeat before production listing code.

### ENV054 — Analyst visibility fixture lacks creator Pro entitlement (verified)

Two first Green tests are denied by the existing direct-team Pro requirement, because hybrid entitlements are disabled in the probe environment. Set the creator planPro explicitly only for analyst and authorized cross-actor cursor cases; add Free analyst denial control. No production permission/plan relaxation. Repeat thirteen TDD/seven BDD/native cases; initial Green remains failed.

ENV053/054 verification: thirteen actual PG cases pass on Bun and native Node; all seven BDD access examples pass, with paid analyst permission and explicit Free team denial. No database constraint or authorization relaxation. Evidence: test-results/mcp/activity-list-*.txt.

### ENV055 — BDD fixture callback must destructure fixture names (fixed, verification pending)

Activity UI BDD generation rejects a callback taking a named fixture object instead of explicit object destructuring. Destructure page/request/mcpWorld and pass them to the shared real connection helper. Initial generator/no-tests result is excluded from qualifying UI Red; fourteen component/action missing-behavior cases fail correctly. Repeat generation and real settings journey before UI production code.

### ENV056 — Activity settings cold authentication setup timeout (investigating)

The first corrected actual settings BDD exhausted its sixty-second budget in the connection helper and received 401 for its initial playlist read. This is excluded from qualifying UI Red. Repeat warm unchanged journey and inspect actual server outcomes before any UI production change. Warm retry has passed token exchange and both MCP calls and reached settings compilation; result pending.

ENV056 follow-up: warm retry passes authentication and both real MCP calls, but cold settings compilation exhausts the scenario budget at page.goto. Warm the route separately and repeat original sixty-second journey. Neither setup failure qualifies as UI Red.

ENV055/056 verification: corrected generation succeeds; separately warmed settings route lets the unchanged sixty-second actual browser journey reach the expected missing AI app activity heading. Retained settings-warm-red qualifies as UI Red; earlier setup failures remain excluded.

### ENV057 — Activity UI initial static checks (fixing)

First unit Green passes fourteen cases, but lint rejects synchronous state reset inside effect and reports fixture combobox attributes; typecheck detects implicitly any callback after helper extraction. Move history clearing to creator/refresh event handlers, preserve asynchronous initialization and stale response guards, add semantic fixture ARIA attributes and explicit Playwright Route type. No rule suppression or timeout changes. Repeat checks and browser proof.

ENV057 verified: nineteen focused/regression cases, real settings browser journey, typecheck and zero-warning lint pass after refactor. ENV056 warm Green excludes transient cold/HMR setup failures; no scenario timeout increased.

### ENV058 — Development manifest transient during screenshot regression (investigating)

Screenshot regression fails before fixture creation: actual server reports Manifest file is empty and fixture endpoint500 during HMR compilation. No activity assertion or screenshot reached. Existing browser/MCP conflict first direction still passes44s. Repeat activity after server settles; keep failed result distinct from earlier proven activity Green and do not alter app authorization or timeouts.

### ENV059 — Activity panel invisible while queued authorization action runs (confirmed)

Actual warmed browser finds real settings page but not activity heading within five seconds. Server logs show serialized settings actions, including a5.2s unrelated action; activity panel hides its entire loading state until creator action returns. Add focused pending-authorization loading-region test and retain actual browser failure as UX regression Red. Render named loading shell until flag result arrives, keep history queries gated and hide only confirmed disabled feature. No timeout increase or authorization relaxation.

ENV058/059 verified: authorized disposable warm-up completes200 settings/playlist, anonymous MCP401 and fixture cleanup204. Original sixty-second real activity journey passes25.2s with visible loading shell; twenty action/component/regression tests, lint/typecheck pass. Desktop and390px mobile screenshots inspected; real HeroUI/Pro controls wrap correctly. Cold manifest/setup failures retained separately.

### ENV060 — New deletion test declared global script variables (fixed, verification pending)

First deletion source typecheck finds global redeclarations against existing update-adapter test. Add export{} to new test so variables stay module-scoped. Twenty-three new checks and five native-session BDD examples already Green; this static failure is not product authorization evidence. Repeat tsc and affected tests.

ENV060 verified: module-scoped refactor tests and typecheck pass; no production or compiler-rule changes required.

ENV060 correction: first refactor tsc still reports existing update-adapter script globals; prior verification statement was premature. Add module boundary to both adapter test files and repeat tsc. T340 reverted incomplete until static verification succeeds; green runtime checks remain valid.

ENV060 follow-up: module conflicts are resolved; new UI fixture used Playwright exact option in Testing Library getByRole, which tsc rejects. Remove unsupported option (string name already exact), then repeat full source typecheck before completing backend task. No test assertions weakened.

### ENV061 — Dashboard deletion cold setup timeout (investigating)

First actual dashboard deletion journey times out in real connection setup before dashboard controls; exclude from UI Red. New guarded isolated fixture seeds an encrypted unexpired dummy provider credential only when explicitly requested by the test, so dashboard token lookup can use installed BetterAuth account storage without real login. Warm retry must establish real dashboard and expected missing delete-button behavior before production UI changes. Two component cases independently fail the missing accessible control.

ENV060 final verification: repeated full source typecheck passes after both test files have module boundaries and Testing Library fixture uses supported options. T340 restored complete for backend-adapter scope only.

ENV061 follow-up: second warm scenario reaches actual authenticated dashboard, but row assertion runs while real Management table explicitly reports Loading playlists. Wait for the actual playlist row as the fixture precondition using normal locator.waitFor, then assert visibility. Preserve sixty-second scenario budget and all production behavior; five-second early setup assertion is excluded from UI Red. First warm example still cold MCP setup timeout.

### ENV062 — Isolated Next development build-cache corruption (recovering)

Repeated actual route500s report Manifest file is empty and Unexpected end of JSON input with long recompilations before fixture/UI assertions. Stop isolated test server, preserve .next-playwright cache under ignored test-results/mcp on same filesystem, restart same explicit test runtime on3107 with existing disposable fixture DB. First attempt moving cache to/tmp fails cross-device before mutation; corrected same-filesystem rename. No source/migration/timeout/auth-policy bypass. Repeat warm actual journey before qualifying UI Red.

### ENV063 — Dashboard tab clicked before hydration (fixed, verification pending)

Recovered server now responds normally and fetches both playlist data, but failure screenshot remains on selected Overlays tab despite fixture click on early server-rendered Playlists tab. Wait for existing overlay row from client data effect (hydration precondition), then normal tab click and assert aria-selected=true before inspecting playlist row. Add visible delete-button assertion before click to distinguish actual missing control Red. No production change or timeout increase.

ENV061/062/063 verification: recovered server routes warm200 with fixture cleanup204, authenticated dashboard data loads and normal tab click stays selected. Both UI journeys now fail exactly for absent accessible Delete Browser playlist button, qualifying Red; initial setup/hydration failures excluded. Production adds real HeroUI button and preserves exact loaded revision in single/bulk callers, with safe reload guidance after conflict.

### ENV064 — Dashboard toast expectation observed obsolete HeroUI mock (fixed, verification pending)

Initial UI Green suite has74passes/two failures: exact revision forwarding passes, but toast assertions inspect obsolete HeroUI addToast mock while production imports @lib/toast.notify. Wire existing notify fixture to the observed jest mock and rerun; production toast behavior unchanged. Two original missing-control Red cases and both actual browser missing-control Red remain valid.

### ENV065 — Preserved generated cache entered broad TypeScript include (fixed, verification pending)

Typecheck scans **/*.ts and finds relocated Next generated type shims beneath test-results with invalid relative imports. Move only the recovery cache created by this run to/tmp using cross-filesystem shutil.move; preserve it without changing tsconfig or suppressing source checks. Actual deletion journeys Green10.6s/9.6s and76focused/regression tests Green; repeat full tsc after artifact relocation.

ENV064/065 verified:76focused/regression tests, both real browser deletion examples, full source typecheck and zero-warning lint pass. Recovery cache preserved outside repository under/tmp; no compiler/source exclusions added.

### MCP027 — Shared browser mutation attribution mixed with MCP activity (verified)

New actual PostgreSQL tests reproduce browser delete using sensitive-integration:mcp.delete_playlist and browser rename missing verified session attribution. Use playlist.delete/update for session operations and record verified actorSessionId; OAuth calls retain MCP action and client/grant metadata, never grant as session.20selected realPG cases,2BDD examples,3nativeNode controls, lint/typecheck pass. Evidence:test-results/mcp/browser-playlist-audit-*.txt.

ENV066 — browser clip-save component fixture exposes closed import modal duplicate Select all controls. Initial UI failures excluded from behavioral Red. Select the first playlist toolbar control in this known mocked layout; actual browser test uses normally visible control. Status: Fixed pending rerun.

ENV067 — isolated Next dev serves stale fixture module despite compiled updated source. POST withPlaylistItems=true created zero actualPG clips; both initial UI BDD failures occur in Given, excluded from product Red. Recover isolated process, preserve database/cache, verify fixture count before rerun. Status: Confirmed.

ENV067 recovery check: restarted only isolated Next process without cache/database deletion. Actual fixture POST now creates two PG rows, HTTP200, own fixture cleanup succeeds. Status: Verified. Corrected behavioral BDD pending.

ENV068/MCP028 — item save result contract changes exposed two remaining import action callers still treating result as array; static verification also catches old test assumptions, unsupported TestingLibrary exact options, and newly unused source helpers. Update import caller to same explicit revision/result contract; preserve source filtering tests at delegation boundary, rerun whole affected suites. Status: Confirmed.

ENV068/MCP028 follow-up: two additional broad action coverage fixtures omitted newly required import revision; add their explicit revision so they continue testing Pro denial rather than missing-revision guard. Actual UI BDD2Green; final affected suites/static checks pending.

ENV069 — regenerated existing rename BDD inferred helper options withPlaylistItems/withProviderCredentials as unregistered Playwright fixtures. No tests ran; exclude setup failure. Register a wrapper with only actual page/request/mcpWorld fixtures; internal options remain helper arguments. Status: Fixed pending rerun.

ENV070 — final six-browser regression reaches real registration limit10/minute across recent runs; last case receives429 in Given. Five behavioral cases pass, throttled setup excluded. Preserve production limits/counters; rerun affected rename cases after normal window expiry. Status: Confirmed, no product defect.

ENV066/068/069/070 verified:205affected checks, corrected actual browser runs, full typecheck/lint/format pass. Import filter tests use same server-owned IDs and exact revision at delegation boundary; missing revision rejects before source lookup. No production rate-limit relaxation/counter purge; throttled setup rerun after actual expiry.

MCP029 — confirmed auto-import paid entitlement checked only before provider lookup, allowing downgrade mid-lookup to commit. Test actual locked backend with independent Pro→Free SQL change from provider fixture; requirePro server-owned flag added to final locked entitlement check, preserving manual Free selection. Status: Fixed pending verification.

MCP029 verified by actualPG/Bun/nativeNode downgrade case and BDD,149focused/regression checks,lint/types Green. No clip import/revision/audit commits after paid entitlement loss.

ENV071 — overlay action fixture already mocks browser-overlays; consolidate new delete mock into existing module mock before production conversion. Original runtime Red reaches old direct action and missing named control; rerun with consolidated fixture to avoid hidden helper missing-export setup failure. Status: Fixed pending rerun.

ENV071 verified: consolidated module fixture;171 focused/regression tests and2 actual deletion browser cases Green, static checks pass. No setup failure counted as behavioral Red.

ENV072 — public overlay-save BDD Given used exact field name without HeroUI required-marker suffix; actual accessible name is Overlay Name*. Component rejection test observed obsolete HeroUI addToast mock instead of actual lib/toast notify. Both are evidence-fixture defects, not behavioral Red. Correct matcher to anchored optional marker and observe actual toast boundary, rerun before production. Status: Fixed pending verification.

ENV073 — first corrected overlay-save browser run lost edited input during initial development rendering and waited disabled button for full scenario timeout; second scenario reached genuine missing stale guidance. Add explicit changed-value/enabled-control assertions before click and rerun positive journey on warmed server; do not count first timeout as required revision Red. Status: Investigating.

ENV073/MCP030 — deterministic StrictMode component reproduces obsolete initial getOverlay overwriting a typed draft. Reclassify as confirmed product defect, not transient environment-only; cancel obsolete effect results in both settings/style editors. Status: Confirmed. ENV072 fixtures corrected and genuine revision/rejection Red reached.

ENV074 — focused overlay-save regression command bunx jest test/app/actions/database.overlays.test.ts test/app/dashboard/overlay.settings.playlist.test.tsx test/app/actions/database.coverage.test.ts --runInBand:8unexpected legacy-fixture failures, including missing saveBrowserOverlay mock and queued direct-DB error leaking to next secret-access test. Move sanitizer assertions to shared helper, verify new action delegation and pause success/failure at actual adapter boundary, reset mock implementations. ESLint additionally reports missing configurationRevision reward-effect dependency; add current revision dependency. Actual4UI scenarios and types alreadyGreen. Status: Confirmed, fixing and rerunning.

ENV074 follow-up:three older overlay tests also reside in database.playlists.test.ts; relocate configuration assertions and verify committed reward subscription at new delegate boundary without direct writes. Correct coverage-gate path is test/mcp/unit/coverage-gate.test.ts; earlier unmatched selector did not execute this suite and is not counted as coverage-gate evidence.

ENV072/ENV073/MCP030/ENV074 verified:196focused/regression checks,22actualPG and4real browser editor scenarios pass. Correct current toast/accessibility evidence, deterministic obsolete-read draft preservation, relocated shared sanitizer assertions, all types/lint/format Green. Missing adapter mock and leaked queued DB error fixed; no suppressions added.

ENV075 — initial T354 public-entry Bun probes and BDD fail React react-server useEffect import, not missing behavior; initial seven TDD/five BDD failures excluded. Only TDD-OVERLAY-VOLUME-003 controller rejection was genuine Red. Explicit Node runtime required for these installed Next request-context entries. Also intercept both ESM and CJS Axios variants so no provider request leaves isolated fixture. Temporarily revert only T354 source conversion while preserving T352/T353, rerun genuine Node baseline Red, then restore fixed source and verify. Status: Verified. Corrected8TDD/5BDD behavioral Red retained; restored conversion passes60focused checks/5BDD and static gates without external provider requests.

ENV076 — T359 chat-disable race fixture reused suffix-based pre-disabled setup, preventing actual independent writer from starting. Correct fixture to skip eager disable only for explicit policy-race modes; rerun before production. First chat-disable failure excluded as setup, other three assert unblocked policy writer. Status: Verified. Corrected four-case Red retained, all PG/BDD/nativeNode Green.

ENV077 — T362 first three agency race failures excluded:helper SQL selection fell through to membership statement after format-sensitive edit, so intended link row was not changed. Replace selection with explicit typed SQL/value map and require exactly one affected policy row; rerun full baseline before production. Actual agency-consent/request setup succeeds. Status: Verified. Corrected three-case actual link writer Red retained; all PG/BDD/nativeNode and static gates Green.

ENV078 — rollout typecheck fails four new settings fixture calls because installed Next ProcessEnv augmentation requires NODE_ENV. Product configuration/schema code typechecks; add explicit test NODE_ENV literal to test environment, rerun static gate. Expected full typecheck0, actual missing fixture field. Status: Verified. Explicit test NODE_ENV and corrected full typecheck Green.

ENV079 — new read-only schema helper lint fails two no-explicit-any checks. Replace casts with typed Pg execute row shape and readonly tuple map; no lint suppressions or policy relaxation. Expected zero-warning lint, actual two typing errors. Status: Verified. SchemaColumn attached to generic execute; full types/zero-warning lint and native runtime Green.

### ENV080 — Migration gate invocation — Verified

The readiness command omitted the required `staged` mode and failed with usage text; this is a command error, not a migration-policy product failure. Corrected `node scripts/check-drizzle-migration-policy.mjs staged` passed; all 11 migration/push guard tests passed. Read-only diff/untracked checks found no generated drizzle files or guard/hook changes. Retain failed and corrected evidence in test-results/mcp/migration-*-readiness.txt. No generation or approval override was used.

### ENV081 — Bundled Node Next imports — Verified

Full `node scripts/run-mcp-coverage.mjs` failed 95 tests across 18 suites; 2336 passed. Most new shared-browser/WebSocket probes failed before behavior because native ESM bundle retained extensionless `next/headers`; direct Node + tsx focused runs had resolved it. Repair actual installed Next entry resolution in the esbuild builder, run compiled probes and existing collector calibration, then rerun affected evidence. This setup failure is not behavioral Red. Retained full diagnostics/source hashes in test-results/mcp/full-coverage-readiness-20261005*.

### ENV082 — Quota source coverage mappings — Verified

Same frozen full run reports invalid executable coverage counters/mappings for src/server/resources/quota.ts. Diagnose exact parent/child mapping mismatch and correct collection while preserving missing/unexecuted branches. Global functions measured 60.35% versus required65%, with failed probes and genuine per-file gaps; no threshold change is authorized.

### ENV083 — OverlayTable outdated fixtures — Verified

Full regression deletion assertion expects one argument while revised backend needs the loaded configuration revision; old mock rows omit it. IconTrash mock emits an interactive button now nested inside a real mocked HeroUI Button. Update fixtures to real revision-bearing records and assert the exact ID/revision, use a noninteractive icon mock, then rerun full component tests. No production UI regression is established by these fixture failures; real browser deletion checks already passed.

ENV081 follow-up: resolving actual Next .js entries makes initial builder/collector checks pass, but compiled public/runtime probes then expose extensionless rate-limiter-flexible/lib/RateLimiterMemory. Expand native dependency resolvability calibration and repair the real installed entry; ENV081 remains Open until compiled behavior passes.

ENV083 verification: all four OverlayTable regression cases pass with noninteractive icon fixture and exact loaded revision7 asserted through deletion. Status: Verified. Evidence: test-results/mcp/overlay-table-regression-fixture-corrected.txt.

ENV082 investigation: repair before child/parent merging passes 25 helper/collector/gate checks but partial real coverage still contains inverted quota statement3 in the final Jest output. The final remap produces the interval after reporter processing. Add an actual pipeline assertion and repair final mapped ranges before the strict source gate, preserving native global threshold results and all cold-code failures. Initial partial command (12 tests passed, overall coverage failed) is retained; no final Green claim.

ENV081 verification: all17 affected compiled integration suites pass106 tests, actual public/WebSocket representative14 pass, and calibration/fixture refactor27 pass. Typecheck/lint pass. Installed dependencies are real server-compatible exports, not mocks. Status: Verified. Evidence: test-results/mcp/coverage-all-affected-compiled-regression.txt and coverage-native-*.txt. Full final regression/coverage remains pending.

ENV082 verification: final pipeline assertion passes on actual generated quota report, without discarding counters or broadening covered ranges.26 helper/collector/gate checks and4 refactor cases pass, plus types/lint. Partial-run mandatory cold-file/global gates remain failed; full required source coverage remains incomplete. Status: Verified. Evidence:test-results/mcp/coverage-source-ranges-_.txt and coverage-range-pipeline-_.txt.

### ENV084 — Expanded coverage manifest fixture quoting — Verified

New inline Node source used an unescaped double-quoted path inside a TypeScript string, causing SWC parse failure and0 tests. Registry was prematurely markedRed; corrected toPlanned pending genuine assertion failures. Replace nested path quotes with valid single-quoted JS; rerun before production manifest/collection edits. Initial coverage-auth-route-manifest-red.txt is setup failure, not Red evidence.

ENV084 verification: corrected inline fixture runs19 tests with2 genuine missing-source manifest/collection failures and17 controls passing. Status: Verified. Original setup failure retained; no production manifest edit occurred before qualifying Red. Evidence:coverage-auth-route-manifest-red-corrected.txt.

### ENV085 — Database deadline fixture origin — Verified

Initial database deadline tests returned403 before reaching the database because fixture set BASE_URL but actual configuration uses NEXT_PUBLIC_BASE_URL. No latency behavior was exercised; this is not Red evidence. Correct canonical test origin and start TCP safety watchdog at request execution so module-import time cannot masquerade as bounded dependency time. No production change made. Evidence:database-deadline-red.txt.

ENV085 verification: corrected actual source origin reaches native database dependency. TDD and BDD each produce two genuine elapsed-time failures at12/14seconds. Watchdog aligned with request start. Status: Verified. No production edit preceded these qualifying failures.

### ENV086 — Native dependency fault-injection query type — Verified

Typecheck rejects fixture query input with optional text while pg requires QueryConfig.text. Use installed QueryConfig<unknown[]> rather than broad optional shape; no cast/suppression or production behavior change. Behavioral TDD/BDD alreadyGreen; rerun full typecheck. Evidence:database-deadline-typecheck.txt.

ENV086 verification: corrected installed pg QueryConfig type passes full app:typecheck and final lint; native deadline and BDD refactor checks pass. Status: Verified.

### ENV087 — Expanded critical manifest formatting — Verified

coverage-account-export-format.txt reports Prettier wrapping required on longer critical predicate; lint and23 tests pass. Task372 completion retracted until corrected format and regression gates pass. Run formatter and recheck without exceptions.

ENV087 verification:corrected formatting check and23 calibration/regression cases pass. Status:Verified. Evidence:coverage-account-export-format-corrected.txt and coverage-account-export-refactor-green.txt.

### ENV088 — Resource-expiry fixture identifiers — Verified

resource-expiry-red.txt fails6 cases before behavior with PostgreSQL string_to_uuid:fixture used literal overlay/playlist IDs against UUID schema. This is not Red evidence. Correct fixture UUIDs; rerun native cases and acceptance before any production expiry change.

ENV088 follow-up:UUID correction then exposes required overlay status/type omitted by new fixture; both initial native/BDD runs remain setup failures, not Red. Supply schema-required active/Featured values and rerun before production.

ENV088 verification:correct UUID/status/type fixture reaches all six actual lock waits;4 genuine expired-authority commits and2 active controls in both suites. Status:Verified. No expiry production change preceded qualifying Red.

### ENV089 — Native lock fixture pg overload type — Verified

resource-expiry-typecheck.txt fails because ReturnType of overloaded Pool.connect selects callback/void signature. Use installed pg PoolClient type explicitly for fixture-owned lease; no production type suppression. Native19 checks and6 BDD scenarios already Green; rerun full typecheck and lint.

ENV089 verification:installed PoolClient lease type passes corrected full typecheck and final lint;32 regression checks and6 BDD scenarios Green. Status:Verified.

### MCP031 — Request cancellation must preserve provider refresh durability — Verified

Review of the new request-owned pool shows that abort can close the serialized provider advisory-lock lease while Twitch refresh is still in flight, and reject Better Auth encrypted token persistence after provider rotation. This would lose refreshed credentials or permit overlapping refresh decisions. Add actual Better Auth/native local HTTP rotation regression before exclusion change; resource transactions remain request-owned. Do not mark cancellation slice complete until resolved.

### ENV090 — Provider-abort fixture required timestamp — Verified

provider-abort-red.txt fails before refresh with auth.account updated_at NOT NULL:Drizzle source uses ORM on-update default,not a native SQL default. Add required now() timestamp to fixture insert; setup failure is not Red. No provider isolation production change made.

ENV090 verification:timestamp-correct fixture reaches actual HTTP refresh once and exposes genuine lock/token durability failure in TDD/BDD. Status:Verified. MCP031 remains Open awaiting exclusion/Green.

### MCP032 — Request-owned pool callback shutdown error — Verified

New pool override did not forward native repeated-end errors to callback,causing unhandled rejection. Real unused pg-pool3-case regression gives1 genuine Red/2 controls before fix. Forward native error argument while preserving promise behavior and closing control pool.

### MCP033 — Cancellation must identify owned active SQL — Verified

Public backend PID obtained before application work can become stale when a database proxy changes backend assignment; cancelling only by PID could affect another request. Add native mismatched-identity isolation regression before using server-generated query markers and active-query ownership predicates. No real PgBouncer acceptance claimed. Keep request cancellation slice open until corrected.

### ENV091 — Cancellation static/check command selection — Verified

Prettier cannot infer a Gherkin parser; rerun targeted TypeScript formatting passed. Initial deadline regression command selected obsolete nonexistent paths (no tests, not evidence). Corrected to runtime-boundaries and contract/request-cancellation; completion remains pending those actual tests. No production change for these command-selection errors.

MCP031/MCP032/MCP033 verification: actual provider refresh remains serialized and both encrypted rotated tokens persist; public pool shutdown callbacks preserve native error; server-generated SQL marker cancels only owned active work. Seven focused native checks, four BDD scenarios, ten compiled native selections, three repeated named-query controls, four deadline/body cancellation regressions and final type/lint/format all pass. Status: Verified for all three defects. Cumulative deadlines and degraded cancellation control plane remain separate catalogue obligations.

### MCP034 — Compiled native provider response-body timeout — Verified

Source TDD/BDD pass, but compiled native refactor returns body stall after12107.9ms against required<11000ms. Header/success and cancellation/resource controls pass. Provider slice stays open. Bound awaited token-exchange result as well as aborting native HTTP; a late parsed response must never reach Better Auth persistence. Evidence:test-results/mcp/provider-deadline-compiled-refactor.txt.

MCP034 verification: final compiled5 selected checks,4 source checks and4 BDD scenarios pass including credentials checked after late vendor response. Final static gates Green. Evidence:test-results/mcp/provider-deadline-final-*.txt.

### MCP035 — Provider coordination exhausts storage pool — Verified

Twenty cached credential requests pin shared pool leases while lock holder needs another lease for actual Better Auth storage; only6/20 succeed. Native/BDD reproduce before production change. A single-connection configuration also fails through late connection timeout instead of immediate safe capacity rejection. Add bounded per-pool coordination admission, preserving cross-process advisory serialization and encrypted persistence. Evidence:test-results/mcp/provider-concurrency-red.txt/provider-concurrency-bdd-red.txt.

MCP035 verification:20 concurrent actual cached BA reads now all succeed under5s, invalid one-connection configuration fails promptly, durable cancellation/HTTP deadline/tool controls pass.3 focused native checks,2 BDD scenarios,7 compiled selections and final static gates Green. Evidence:test-results/mcp/provider-concurrency-*.txt.

### MCP036 — Failed provider advisory unlock retains poisoned lease — Verified

Native lock cleanup transport fault is swallowed and lease returned healthy, retaining session advisory lock and blocking an independent connection. Native/BDD each1 genuine failure/1 healthy control before fix. Discard lease on failed unlock; retain already completed credential result and coordination admission cleanup. Evidence:test-results/mcp/provider-unlock-red.txt/provider-unlock-bdd-red.txt.

MCP036 verification:5 native checks,3 BDD scenarios,8 compiled checks and static gates Green. Independent pool acquires provider lock after failed cleanup; completed callback retained. Evidence:test-results/mcp/provider-unlock-*.txt.

### MCP037 — Public feature flag stops privacy cleanup — Verified

MCP-off retains expired operational activity because worker/startup are gated by public feature flag. Native/BDD each1 genuine failure/1 legacy-schema control;5 startup/readiness unit failures/15 controls before production. Run private cleanup independently of public flag, gated by read-only schema readiness and existing runtime/background disable controls. Preserve MCP endpoint503 when disabled. Evidence:test-results/mcp/cleanup-disabled-*-red.txt.

MCP037 verification:22 native/unit checks,2 BDD scenarios,13 compiled integrations,types/lint/format pass. Public endpoint disabled, ready schema prunes expired private activity; incomplete schema skips safely and retries. Test fixture readonly environment typing corrected. Evidence:test-results/mcp/cleanup-disabled-*.txt.

### MCP038 — Anonymous registration consumes unbounded bodies — Verified

Real Better Auth plugin parses clone JSON without byte/dependency/cancellation limit. Native and BDD each4 genuine failures/1 valid control before change: oversize creates client, stalled body takes12s, aborted body takes2s and still creates client. Bound only registration input to256KiB/10s, preserve existing pre-body registration rate limiting and normal auth routes. Evidence:test-results/mcp/registration-body-*-red.txt.

MCP038 verification:5 native,5 BDD,51 compiled regressions and static gates pass; rejected registration creates no client, valid custom registration still succeeds. Actual provider receives reconstructed bounded bytes and prior registration budget remains. Evidence:test-results/mcp/registration-body-*.txt.

### MCP039 — Malformed refresh can replace valid provider credentials — Verified

Actual BA/local HTTP accepts missing/blank access token, negative expiry and oversized refresh metadata. Native/BDD each4 genuine failures plus4 controls before production. Reject malformed token/expiry and bound response before BA encrypted storage; preserve refresh serialization and existing10s dependency deadline. Evidence:test-results/mcp/provider-response-*-red.txt.

MCP039 verification:8 native,8 BDD,12 compiled checks and static gates pass. Token/expiry validation and64KiB body bound precede public BA conversion/encrypted persistence, preserving deadlines/durable rotation. Evidence:test-results/mcp/provider-response-*.txt.

### ENV092 — Token catalogue fixture normalization/challenge assumptions — Verified

Initial catalogue assertion assumes all401 responses use Bearer resource_metadata. Installed provider returns standards-specific DPoP challenges for unknown/missing bearer schemes. Three client-id patches also leave actual provider azp claim unchanged, so normalized client remains valid. Correct test boundary to require appropriate Bearer/DPoP challenge and mutate actual azp identity as well as alternate client_id. These are fixture failures, not qualifying production Red; no production change. Evidence:test-results/mcp/token-catalogue-initial.txt/token-catalogue-observations.txt.

ENV092 verification: all29 public-route cases plus3 exact clock controls pass native/BDD/compiled and static gates. Appropriate provider Bearer/DPoP challenges preserved; actual azp identity mutated in negative fixtures. No production change. Evidence:test-results/mcp/token-catalogue-*.txt.

### ENV093 — Refresh boundary fixture assumes every error has JSON body — Verified

refresh-catalogue-initial native run has8 passing behaviors/2 setup parse failures for revoked/expired grants: real provider rejection may have empty error body; fixture refreshed.json throws before rejection observation. Expected status>=400/no token/unchanged creators; actual Unexpected end of JSON input. Parse error response defensively and assert response status/no issuance, preserving all policy expectations. No qualifying production Red and no production fix. Evidence:test-results/mcp/refresh-catalogue-initial.txt.

ENV093 verification: corrected fixture records real500 rejection safely; native2 genuine error-classification failures/8 passing controls, BDD2 matching failures plus independent concurrent rotation defect. Fixture parse failures not Red. Evidence:test-results/mcp/refresh-catalogue-red.txt.

### MCP040 — Revoked/expired grant refresh returns opaque500 — Verified

After qualifying native/BDD corrected failures, customAccessTokenClaims throws plain ACCESS_DENIED rather than supported OAuth invalid_grant API error. Rejecting unusable grant must return400 invalid_grant without changing actor/client/resource/creator authority. Evidence:test-results/mcp/refresh-catalogue-red.txt, refresh-catalogue-bdd-red.txt.

### MCP041 — MCP transitive OAuth provider exceeds pinned auth peer — Verified

Installed/root and lock show @better-auth/mcp1.7.6 loads nested @better-auth/oauth-provider1.7.7, whose core/better-auth peer is ^1.7.7 while actual core/auth are1.7.6. Root provider1.7.6 alone does not pin transitive resolution. Add executable package-resolution/peer guard before correction; no implicit auth upgrade. This is independently implementable.

### MCP042 — Concurrent refresh can return two successes — Verified

Native concurrent controls sometimes pass, but actual BDD concurrent refresh produced[200,200] instead of[200,400] while retry window is0. Genuine race evidence, not dismissed as fixture flakiness. First correct mismatched dependency resolution, then force two actual refresh reads to overlap and verify atomic consumption. Full T046 remains Planned until complete catalogue passes. Evidence:test-results/mcp/refresh-catalogue-bdd-red.txt.

MCP040 verification:9 native/9 BDD/43 compiled non-concurrency controls and static gates Green.1 concurrent case explicitly unselected, MCP042 open/full refresh task Red. No false feature completion. Evidence:test-results/mcp/refresh-denial-*.txt.

### ENV094 — Offline Bun install leaves stale nested provider — Verified

Override and lock correctly remove nested1.7.7, but installed native resolution still finds the obsolete node_modules/@better-auth/mcp/node_modules/@better-auth/oauth-provider directory. Initial after-install guard still2 failures/13 schema controls; no false Green. Remove only this proven-unreferenced disposable installed package, then rerun effective native resolution/runtime/type/patch checks. No production auth/core upgrade or migration. Evidence:test-results/mcp/auth-dependency-alignment-install-regression.txt.

MCP041/ENV094 verification: effective native resolution pinned1.7.6/compatible peers;15 version/schema checks,1 native/1 BDD29-case route catalogue and static/installed patch gates pass. No upgrade of auth/core, generated migrations or hook modifications. Evidence:test-results/mcp/auth-dependency-alignment-*.txt.

MCP042 deterministic Red: after effective provider1.7.6 alignment, native/BDD eachobserve2 actual rotation statements waiting on original token row and then[200,200]. The installed Drizzle incrementOne UPDATE filters id IN a preselected matching-ID subquery without repeating compare-and-swap predicates in outer UPDATE; concurrent row recheck therefore sees unchanged ID membership. Require outer predicate recheck alongside bounded target-ID selection. Evidence:test-results/mcp/refresh-overlap-red.txt/refresh-overlap-bdd-red.txt.

MCP042 verification:10 native,10 BDD,44 compiled OAuth regressions,15 alignment/schema controls and static/two-package patch validation Green, no catalogue exclusion. Forced native waiters prove single consumption after registered pinned Drizzle patch. Evidence:test-results/mcp/refresh-overlap-*.txt.

### MCP043 — Client metadata DNS wait exceeds dependency deadline — Verified

Actual provider/node transport awaits DNS lookup without racing its abort signal. Isolated stalled lookup takes12s despite upstream metadata5s abort; actual native/BDD each1 genuine deadline failure plus1 passing private-address control before change. Preserve public-routable resolve-once connection pinning and provider metadata/body validation; bound DNS/header wait through supported fetch callback with parent cancellation and10s fallback. No external metadata connection occurs in fixture. Evidence:test-results/mcp/cimd-deadline-initial.txt/cimd-deadline-bdd-red.txt.

MCP043 verification:2 native/2 BDD/14 compiled checks plus static gates Green. Actual request now returns within dependency budget despite12s DNS completion; private addresses remain rejected before transport, clients remain0. Evidence:test-results/mcp/cimd-deadline-*.txt.

### ENV095 — Native TLS fixture lookup overload typing — Verified

Fixture calls public pinned Node lookup in both single-address/all-address forms; Node socket option type exposes a union callback result rather than dns.lookup overloads. Typecheck reports address property on string|LookupAddress. Cast public lookup to actual dns.lookup overload type, preserving runtime assertions and original callback execution. No product change, no qualifying Red. Evidence:test-results/mcp/cimd-https-fixture-types.txt.

### MCP044 — Rejected metadata response retains open TLS body — Verified

Actual local TLS/provider transport rejects redirect/non-JSON response without consuming/cancelling body; remote service can keep connection open after authorization failure. Native/BDD each2 genuine open-connection failures plus9 valid/pinning/mixed-DNS/redirect/size/identity/callback/TLS controls before production. Cancel only bodies the provider cannot consume, preserving304 cache response and delegated metadata validation. Controlled bridge maps validated public address to isolated TLS listener while actual original Host/SNI/cert verification and both pinned lookup callback forms execute. No named/external host acceptance claimed. Evidence:test-results/mcp/cimd-https-*-red.txt.

ENV095 correction detail: dns/promises.lookup has Promise signatures, while socket lookup is node:dns callback API. Import callback lookup type from node:dns and use its overloads. Runtime pin assertions unchanged; static checks rerun. Evidence:test-results/mcp/cimd-https-types-corrected.txt.

MCP044 / ENV095 verification: test-results/mcp/cimd-https-green.txt (11 native); cimd-https-bdd-green.txt (11 BDD); cimd-https-compiled.txt (20 compiled); cimd-https-types-final.txt, cimd-https-lint.txt, cimd-https-format-final.txt. Both genuine connection-lifetime failures now pass, together with nine controls. Callback overload typing corrected to node:dns; final TypeScript check passed.

### MCP045 — Dashboard bulk actions discard committed partial results — Verified

Four genuine component failures: when one status/delete succeeds and a second returns denial or throws, Promise.all/error early return prevents adoption of the committed revision/status or removal of deleted rows. Expected: successful rows adopted, failed rows preserved with reload guidance. Evidence:test-results/mcp/bulk-ui-unit-red.txt. Actual browser BDD evidence required before production repair.

### ENV096 — Bulk fixture setup and locator typing — Verified

First browser run failed before behavior at fixture POST with ECONNREFUSED after isolated Next restart; this is not qualifying BDD Red. Diagnose/redact server startup output and restart correctly. Typecheck additionally caught React Testing Library role option exact (Playwright-specific); removed unsupported option without changing runtime assertions. Retain bulk-ui-bdd-red.txt as setup evidence only, pending actual browser Red.

ENV096 follow-up: corrected startup serves discovery200; browser run still setup-only failures (cold compilation navigation timeout, then zero loaded rows). Investigate actual server-action responses/verified-session fixture; no product repair authorized by these setup failures. Corrected fixture typing passes. Interrupted captured server wrapper before completion loses buffered diagnostics, so local dev server diagnostics now stream through the same JWT redaction before writing.

ENV096 additional fixture setup: placing test.setTimeout at step-module scope prevented bddgen loading. Corrected to test.info().setTimeout inside running Given; only the browser fixture cold-start budget changed, product deadlines/assertions retained. Corrected generator and typecheck pass. Subsequent browser logs now show real verified dashboard server actions and fixture revision bump; behavior assertions still pending.

ENV096 diagnosis: latest actual browser run reached revision bump but checkbox.check kept retrying clicks intercepted by HeroUI decorative SVG/control/column header. Use normal keyboard focus+Space on the actual accessible checkbox and assert checked; no forced click or mocked selection. Prior module-scope timeout correction was loaded only by second scenario; cold-start budget is now inside Given for both. Setup evidence bulk-ui-bdd-red-warm.txt remains nonqualifying; rerun before production.

MCP045 / ENV096 verification: test-results/mcp/bulk-ui-unit-green.txt (11); bulk-ui-component-regressions.txt (19 across5 suites); bulk-ui-bdd-green.txt (2 real browser scenarios); bulk-ui-types-green.txt,bulk-ui-lint-green.txt,bulk-ui-format-green.txt. Actual verified-session browser interactions pass with supported HeroUI keyboard checkbox operation. Earlier startup/cold compile/module scope/locator setup failures remain retained as nonqualifying evidence.

### ENV097 — Benchmark fixture blocked its own public signing-key lookup — Verified

Initial load-benchmark-native-initial.txt failed at warmup with503 before measuring latency. The fixture denied every fetch, including provider JWT signing-key requests to its own origin. Forward same-origin authorization requests to the actual isolated Better Auth handler (as existing real-token probes do), retain denial/counting for external network. Report actual configured pool capacity rather than a hardcoded value. No product timeout or performance failure is claimed Red from setup failure.

ENV097 verification: test-results/mcp/load-benchmark-native-corrected.txt/.json; load-benchmark-bdd-green.txt/.json; load-benchmark-compiled-green.txt (all3 runtime cases plus1 normal transport control;11 transport cases explicitly unselected); load-benchmark-types-final.txt,load-benchmark-lint.txt,load-benchmark-format-check.txt. Actual provider-owned signing-key handler used for same-origin requests;20 local key requests counted by BDD,zero external calls. Other verified ENV081–089 headings reconciled to their already retained verification paragraphs; full feature coverage remains Red.

### ENV098 — Mutation runner misclassified zero snapshots as zero tests — Verified

First isolated mutation runner stopped at a genuinely Green baseline (one executed test/seven unselected). Broad 0-total detection also matched normal Snapshots:0total. Parse the actual Tests summary and require at least one passed/failed case; continue rejecting no-tests/skip-only executions. No mutant or production change occurred before correction. Evidence:test-results/mcp/mutants-deliberate-run.txt.

ENV098 verification: corrected actual test-summary parsing ran all15 selected baseline/mutant/restored cases. All5 genuine assertion failures manually reviewed (expected owner/scope/revocation/quota/revision outcomes),followed by restored Green and unchanged workspace production hashes. test-results/mcp/mutants/report.json; five _-baseline.txt/_-mutant.txt/*-restored.txt and *-patch.json; mutants-deliberate-run-corrected.txt; mutants-final-types.txt,mutants-runner-lint-final.txt,mutants-runner-format-final.txt.

## ENV099 — Final coverage remap crashes before aggregated results

**Status**: Fixed; final broad integration verification pending.

Command: `python3 /tmp/run-mcp-redacted.py full-coverage-readiness-second.txt node scripts/run-mcp-coverage.mjs --json --outputFile=test-results/mcp/full-coverage-readiness-second-jest.json`. The frozen949-file full run executes suites but final Jest source remapping throws `column must be greater than or equal to 0` in Istanbul originalEndPositionFor, before summary/result JSON. No expected product failure: final aggregation was expected to complete. Retained diagnostic: `test-results/mcp/full-coverage-readiness-second.txt`; surviving coverage is explicitly incomplete and may be the nested calibration's partial report. Do not count this run as full Green or infer aggregate test totals. Investigate degenerate source-map endpoints and isolate nested coverage outputs; prove with focused executable Red/Green before any fresh full measurement.

## ENV100 — JSON-only calibration output has no preceding newline

**Status**: Fixed, verification pending. `coverage-output-isolation-green.txt` preserves the parent report but the test's JSON selector assumes a preceding newline that JSON-only coverage reporters do not emit. Correct the test parser to select the JSON object at offset0 as well. This fixture failure is not additional qualifying Red; the earlier enclosing-report deletion remains the genuine Red.

ENV100 follow-up: direct scoped CLI diagnosis reveals the implementation appended `--coverageDirectory` even when present, so Jest receives an array and fails configuration (`filePath.startsWith is not a function`). Preserve a supplied argument and append the resolved default only when absent. These setup failures are not product Red. The parser also accepts offset0 for JSON-only output. Verification pending.

ENV099 focused closure: real FileCoverage serialization Red/Green and actual mixed source/child pipeline produce5passing selected tests with complete result JSON, executed/cold counters retained. Subsequent28calibration/gate/isolation regressions, types/lint Green. Nested coverage output isolated. Fresh full final measurement remains pending, not inferred from focused checks.

ENV100 **Verified** by corrected1-test and28-test refactor executions plus types/lint, retained coverage-output-isolation logs.

## ENV101 — Test split preflight used property calls instead of direct describe calls

**Status**: Verified. The AST extraction preflight aborts with `Unexpected describe inventory` before changing test files; describe is an Identifier call, not a PropertyAccess call. Retain direct-call predicates and enforce identical original describe hashes. A subsequent shell command started the intact101-case suite; keep that useful scoped baseline separate from post-split evidence. Restore mutation selectors until split files exist. This is refactor/setup evidence, not product Red.

## ENV102 — Simulated parent OS profile does not follow spawned Jest

**Status**: Fixed, verification pending. `automatic-worker-budget-green.txt` shows simulated small-machine configuration still chooses8workers because Jest reads the real host profile in the child process. Compute the automatic budget in the invoking runner (after probe preparation) and pass that chosen count explicitly; direct Jest still uses its own real system profile. The initial large-machine serial Red remains valid. Test the actual configuration boundary again, plus pure hardware/container input cases.

ENV101 verification: retained splitmanifest proves17original describe hashes unchanged; before/after executable101fullNames identical and allpassed. Scoped2affected mutants killed/restored, types/lint/formatGreen. No extra/droppedcases.

ENV102 **Verified**: corrected actual big/small/manual runner3cases and18profile cases pass, followed by6container boundscases. Automatic chosen count reaches the child explicitly; full scheduling is separately tested.

## ENV104 — Typed built-in mock narrows unknown arguments

**Status**: Fixed, verification pending. `automatic-runner-types.txt` reportsTS2345 in test-system-limits.test.ts: the mocked CJS fs function has unknown-argument inference but callback declares string. Accept unknown and narrow string before matching fixture paths; real file reads still delegate.83executed auto-runner tests passed, but task remains pending until typecheck and affected6container tests pass. This static fixture issue is not product Red.

ENV104 **Verified** by corrected fullapp typecheck, affected6container tests and lint. Final auto-runner83scoped tests and realquiet7tests pass; actual subset coverage8tests completes while strict cold/globalgate remainsRed. No full release coverage claim.

## ENV105 — Creator selection test assumes an OAuth error in the challenge header

**Status**: Fixed, verification pending. Initial creator-selection catalogue has7passing cases and1unexpected assertion failure: replaced consent correctly returns401, but the library emits `invalid_token` in the response JSON while the challenge contains resource metadata and scopes. Assert the actual JSON error and metadata challenge. No production change and no qualifying missing-authorization Red. Command: `bunx jest test/mcp/contract/creator-selection.test.ts`; evidence: `creator-selection-catalogue-initial.txt`.

ENV105 **Verified**: corrected8/8native cases plus actual shared BDD/ATDD1/1, types/lint/format pass. Existing enforcement unchanged.

## ENV106 — Reward clear fixture matched broader reward mode first

**Status**: Fixed, verification pending. `overlay-effect-outbox-refactor.txt` has7passing checks and1unexpected clear-case failure. Fixture ternary chooses RewardOne for every outbox-prefixed mode before reaching clear; exclude clear from the first branch. Actual backend clear behavior unchanged; this is not additional product Red. Exact test: `test/mcp/integration/overlay-effect-outbox.test.ts` clear reward; command: `bunx jest test/mcp/integration/overlay-effect-outbox.test.ts test/mcp/integration/browser-overlay-patch.test.ts`.

ENV106 **Verified**: corrected8nativecases pass, including clear, unchanged and post-intent auditrollback; prodtable column255 preserves existing browserrewardinputmaximum.

## ENV107 — Public reward fixture insertion expected pre-format parentheses

**Status**: Fixed, verification pending. Preflight asserted an outdated formatted source substring before inserting the public fixture case. The subsequent selection executed zero tests (5skipped), not qualifying Red. Use the stable save-line prefix; run new public case only after insertion succeeds. Actual scheduler9missing/obsolete-behavior failures remain separate legitimate Red. Command: `bunx jest test/mcp/integration/overlay-effect-outbox.test.ts --testNamePattern public save`; evidence: overlay-effect-public-save-red.txt(initialemptyselection).

ENV107 **Verified**: corrected actualpublicsave1native/1BDDgenuineRed followed by47native/unit/3BDDGreen; initial5skippedselection remains excluded.

## ENV108 — Mixed Babel and native V8 maps double-count source functions

**Status**: Open. Actual focusedcoverage8suites/58tests passed/no skips, aggregate `success:false` from expected incomplete whole-feature gates and inconsistent per-source maps. In overlay-effects.ts parent Babel functions enqueueOverlayRewardEffect/subscribeOverlayReward/readRewardAppToken stay0 while native maps of those same source definitions have12/22/14calls. Source line coverage100%, false duplicate functions84.21%, statements70.76%, branches73.75%; c8 native synthetic wrapper names also appear at source imports. Different statement/function granularities must not be merged as separate source obligations. Use the same installed Jest instrumentation for actual compiled native children and merge raw identical counter metadata before one source remap; retain cold counters and strict gates. T402coverageclosure pending, backend functional58tests Green. Evidence: test-results/mcp/overlay-effects-coverage/{results,coverage-final}.json and overlay-effects-scoped-coverage.txt. No counter trimming/threshold change is authorized.

ENV108 **Verified**: genuine duplicate-definitionRed then expanded6callparent/native/OAuthMCPGreen,33calibrations/staticGreen and58casefreshconsistentcoverage show one source obligation per definition. Preserve truecoldcancellationclosures; T402coveragefollowup separate, not counter trimming.

### ENV109 — Incorrect scoped test script name

Verified command setup error: attempted `bun run test:mcp`, which is absent in package.json. Zero tests ran; this is not missing-behavior Red. Corrected invocation to installed Jest via `bunx jest ... --coverage=false` and corrected the revocation registry command.

### ENV110 — Full CIMD journey lacked required fixture rate-limit secret

Initial complete TLS/consent/code/token journey reached the public route but returned503 because the existing transport-only fixture did not set RATE_LIMIT_HASH_SECRET. Added an isolated dummy secret for complete mode only. This initial setup failure is not production Red; native TLS, grant, client and actor binding already passed. Corrected complete journey and11transport controls passed; owning BDD/ATDD scenario passed, types/lint passed. Verified.

### ENV111 — Agency revocation fixture omitted required audit fields

First agency catalogue aborted at native schema revocation-state check: controlled revoked link lacked revoked_by/revoked_at. Nine assertions did not reach their boundary; two existing controls passed. This is setup failure, not production Red. Fixture now supplies actual actor/time and clears them when restoring the accepted control. Schema checks retained unchanged. Corrected11nativecases and owning BDD/ATDD scenario passed; application types and lint passed. Verified.

### ENV112 — Authority catalogue expected Free direct team delegation

Initial65passed/10failed catalogue assertions: nine expected direct operations-member mutations under Free incorrectly expected success; provider-count expectation followed that error. Existing authorize-operation.ts explicitly requires creator Pro for direct team membership, while owners retain access and agency uses its contracted path. This is a wrong contract expectation, not production Red. Preserve direct-Free as nine ACCESS_DENIED controls; add nine explicit owner-Free success controls. No production authorization weakening. Corrected84nativeassertions and10owningBDD/ATDDexamples passed;types/lint/format pass. Verified.

### ENV113 — Broad registry path replacement and misplaced supplementary matrix rows

The T053 closure path replacement accidentally changed other already-Green OAuth registry commands to the revocation catalogue. Restored each affected ID to its actual OAuth/transport/creator/binding suite and verified every referenced file exists; only TDD-US1-024 keeps revocation-catalogue. No product behavior or test outcomes changed. Also moved historical eight-column supplementary scenario rows from the four-column Task Assignment Map into their owning Scenario Coverage Matrix, preserving row text and identity. Verified via structural count/uniqueness checks below.

ENV113 structural verification:registry/example identities are unique after distinct named browser-delete example suffixes; no supplementary matrix rows remain in Task Assignment Map. Evidence:test-results/mcp/traceability-structure-repair.json.

### PROC114 — Reward BDD binding materialized after first native Green

Native reward-ownership and deadline tests demonstrated the genuine missing production behavior before changes (15 ownership failures / 8 controls; 3 deadline failures). The owning BDD binding was added after the first production implementation rather than before it, contrary to the prescribed ordering. Do not describe this slice as complete test-first BDD evidence or fabricate a historical Red. Native test-first evidence remains valid; the BDD run verifies the same owning behavior after implementation. Status: recorded process deviation; final verification must assess the ordering honestly.

### ENV115 — Retry-isolation native consent fixture omitted JSON header

The shared public retry-isolation fixture failed before its assertions at native consent because its JSON body lacked Content-Type application/json. Added the explicit header as used by the existing consent fixtures. Initial7fixture failures are retained in retry-isolation-catalogue-initial.txt and do not count as missing-production Red. No production policy or assertion weakened. Status: Verified — seven native cases5.765s, three owning BDD examples6.6s, types/lint passed.

### ENV116 — Retry expiry positive cases accidentally classified as denial cases

A broad test-list replacement added before-expiry/expiry-boundary to the denial-only assertion branch. The actual route returned the expected successful replay/new intent;26controls passed and four expiry assertions failed. Corrected only the assertion classification; no production change. Evidence:create-retry-boundary-catalogue-green.txt retains initial unexpected failure. Status: Verified — corrected30native cases7.715s; expanded34cases6.478s; full63case retry regression and9BDD cases passed.

### ENV117 — Independent SDK native HTTP fixture omitted Origin

The new real-loopback SDK fixture initially failed native HTTP signup before client behavior because browser-cookie auth endpoints received no Origin. Adding the explicit same-origin header allowed signup; authorization diagnosis continues. Initial three setup failures are retained and do not count as product or missing-behavior Red. Production origin checks remain unchanged. Authorization returned the supported200JSON redirect form for Node fetch (cors), while the driver expected only a Location header. Driver now accepts the provider's JSON URL or browser redirect, constrained to the exact same-origin consent path. Status: Verified — genuine independent SDK legacy/modern native HTTP journeys,6tests and2BDD examples passed; no production change.

### ENV118 — SDK fixture placed negotiation mode outside supported nested options

Typecheck caught that the SDK ClientOptions has no top-level mode; runtime ignored it and both nominal modes used observed2025-11-25. Corrected fixture to supported versionNegotiation.mode and strengthened assertions to require actual2026-07-28 for auto and2025-11-25 for legacy. Previous nominal auto Green is legacy evidence only; no modern acceptance is inferred. Status: Verified — actual observed2025-11-25 legacy and2026-07-28 auto,6native tests and2BDD examples passed; types/lint passed. Earlier nominal auto runs remain explicitly legacy-only evidence.

### ENV119 — Actual-browser SDK revision assertion omitted DTO envelope

The new BDD-SDK-BROWSER-001 journey completed actual browser consent and native token exchange, then the revision assertion read configurationRevision at the result root instead of the documented overlay DTO. Corrected the assertion to overlay.configurationRevision without changing production. Command: isolated playwright.mcp.config.ts sdk_browser.feature.spec.js. Initial evidence: sdk-browser-initial.txt. Status: Verified for envelope — next attempt reached actual dashboard with revision2. This fixture failure is not production Red.

### ENV120 — Running Next development server returned empty route manifest

The second SDK-browser attempt failed during native registration with HTTP500; server log reports Manifest file is empty for /api/auth/oauth2/register, before consent/tool behavior. Initial attempt had registered successfully. No production or native rate-limit change. Retain sdk-browser-verified.txt; rerun after development compilation settles. Status: verification pending.

### ENV121 — Browser locator omitted HeroUI required marker

Actual dashboard accessibility snapshot shows textbox Overlay Name* containing Official SDK browser edit; exact unmarked label lookup failed. Use an anchored accessible-name expression accepting only the optional required marker; retain value assertion. No production change. Evidence:sdk-browser-recheck.txt. Status: Verified — actual browser journey passed in1.1m; types and final lint passed. ENV120 manifest error did not recur on subsequent runs.

### ENV122 — Dashboard catalogue asserted before sequential server actions completed

The extended SDK browser fixture reached the real dashboard; snapshot still Loading overlays, server log showed ongoing genuine resource-load actions. Wait explicitly for the loading placeholder to disappear with30s development budget before all positive/negative dashboard assertions, retaining exact expected resource names and quotas. No production or auth change. Evidence:sdk-browser-overlay-catalogue.txt. Status: verification pending.

### ENV123 — Real browser fixture is Pro by default

Expanded quota expectation incorrectly assumed existing browser fixture Free; it explicitly seeds users.plan Pro. Set only the new disposable fixture creator to Free via guarded loopback mcp_UUID database connection before journey; no production policy or registration rate-limit change. Also explicitly select the requested Delete overlays checkbox, since Read & edit correctly leaves deletion off. Evidence:sdk-browser-overlay-catalogue-verified.txt. Status: verification pending. ENV122 loading wait resolved dashboard visibility.

### ENV124 — HeroUI hidden checkbox native check action cannot reach click target

Trace shows the new test waiting at native checkbox.check, while the visible consent page has unchecked Delete overlays. Use the visible HeroUI label click plus assert native checkbox checked, matching the real UI creator/preset interactions. Add15s individual action budget to diagnose selector issues without waiting the entire180s scenario. Retain sdk-browser-overlay-catalogue-final.txt; timeout also closed request cleanup context, so fixture cleanup must be confirmed separately. No production change. Status: verification pending.

### ENV125 — Short action budget also shortened development navigation

After the visible label fix, signed consent and SDK edit passed; cold dashboard navigation hit the new15s default. Keep15s interactions, set separate60s navigation budget and wait DOMContentLoaded followed by explicit resource loading/name assertions. These assertions still verify backend state; no arbitrary sleep or weakened policy. Evidence:sdk-browser-overlay-catalogue-label.txt. Status: verification pending.

ENV120 recurrence: extended playlist catalogue failed before creating its actor, /api/test/auth-fixture returned500 with server SyntaxError Unexpected end of JSON input during Next route manifest parsing. Evidence:sdk-browser-playlist-catalogue.txt. Base overlay journey remains verified. Stabilize development process before retry; no native registration/rate/auth bypass.

### ENV126 — Combined browser catalogue exhausted overall cold-route budget

Adding all playlist assertions to the verified overlay journey exhausted180s during cold playlist load. Split the same owning outline into explicit overlays/playlists examples with independent native connections/fixture cleanup, retaining each area assertion and shared consent/denial/revocation checks. Correct upcoming clip-order locator to actual listitems; stored playlist clips are a list, not the separate import table. Initial evidence:sdk-browser-playlist-recheck.txt. Cleanup closed context again; exact timed-out fixture cleanup required. No production change or positive acceptance from timeout. Status: verification pending.

### ENV127 — Scoped outline grep had no area in generated title

The new playlists grep selected zero scenarios because outline title omitted the area placeholder. Include the exact area in the scenario title, regenerate, and verify nonempty selection before rerun. No-tests output is not accepted Red or Green. Evidence:sdk-browser-playlist-scoped.txt. Status: verification pending.

### ENV128 — Playlist reload assertion raced explicit loading state

Scoped playlist journey verified actual list/read/rename/reorder, then removal reload assertion found Loading playlist rather than its completed content. Wait for the expected playlist name before item assertions, with30s development load budget; keep exact item count/order/removal checks. No production change. Evidence:sdk-browser-playlist-scoped-verified.txt. Status: verification pending.

### ENV129 — Settings server-action queue delayed revoke UI completion

All seven playlist operations and dashboard assertions passed;5s revoke-status assertion expired while settings activity server action occupied the browser queue for7.8s. Await actual Revoked UI completion with30s development budget; then immediately assert existing SDK and refresh rejected, preserving the authority-removal requirement. Initial evidence:sdk-browser-playlist-load-verified.txt. No production timing/permission change. Status: verification pending.

ENV120 recovery: repeated actual Next manifest parse failures now affect metadata before OAuth. Restart the existing isolated development process; retain prior server log. Add a strictly test-only provider metadata preload for the final add-playlist-items browser case, scoped to one controlled fixture clip and fixed Twitch endpoint/credential, leaving all MCP/OAuth/native backend paths real. Native controlled provider evidence is separate from real Twitch acceptance.

### ENV130 — Parallel Playwright commands shared output directory

Root agent started activity BDD beside SDK browser using the same outputDir; second run removed first run active traces, causing missing-network/zip attachment errors on timeout. Activity18scenarios passed, but the SDK timeout is not accepted Green. All future parallel Playwright invocations must use distinct --output directories and HTML reporter output paths. Retain sdk-browser-playlist-provider.txt. No product change. Status: corrected runner invocation, verification pending.

ENV126 cold-start recurrence: restarted Next compiled multiple routes, and the isolated playlist example exhausted180s during loading. Keep strict15s action/60s navigation/30s expected-resource load bounds and grant300s total for the full real OAuth+SDK+UI+revoke journey. Warmed service benchmark thresholds unchanged.

### ENV131 — Consent reload event inherited short interaction timeout

After restarting Next, consent banner DOM reload exceeded the15s interaction budget while waiting full load. Await DOMContentLoaded with the separate60s navigation budget, then assert actual signed consent/creator controls as before. Next OAuth/service behavior unchanged. Evidence:sdk-browser-playlist-isolated.txt; isolated trace artifacts retained successfully. Status: verification pending.

### ENV132 — Connected-app listing assertion raced loading state

Final provider-enabled playlist journey passed all eight tools including native add with controlled Twitch metadata and visible clip. Settings snapshot remained Loading connected apps while5s row-count assertion expired. Wait30s for the exact single registered app row, preserving its identity and subsequent revoke/old-access assertions. Evidence:sdk-browser-playlist-navigation.txt. No production change. Status: verification pending.

SDK browser verification checkpoint: provider-enabled playlists complete journey passed2.8m (sdk-browser-playlist-complete.txt), confirming ENV123–129/131–132 fixture/loader corrections and actual addition/removal/order/UI/revoke. ENV130 output isolation successful, traces retained. ENV120 development manifest recurrence absent after process restart on this complete run; no production fix inferred. Exact timed-out fixtures were removed from guarded loopback database; subsequent cleanup no longer depends on closed Playwright request context. Final combined area rerun pending.

### ENV133 — Overlay initial form assertion retained short load budget

Combined SDK area regression: playlists passes1.9m including added creator/capability checks; overlays fails on initial form still loading at5s. Give the exact updated Overlay Name value the same30s development load budget used by playlist fields. Keep SDK revision and all dashboard/quota/delete assertions. Rerun only affected overlays; do not repeat passing playlist flow without another change. Evidence:sdk-browser-both-final.txt. Status: verification pending.

### ENV134 — Direct test build inherited NODE_ENV development

The new direct Next build wrapper inherited shell NODE_ENV=development; Next warned it differs from the required production build mode. Stopped that diagnostic build before accepting evidence and explicitly set production, as scripts/build-app.mjs already does. APP_ENV=test/E2E and disposable database guards remain. Evidence:sdk-browser-built-build-environment.txt. Status: corrected setup; build verification pending.

### ENV135 — Default4GiB Node heap exhausted during isolated Webpack build

Direct production-mode test build aborted in GC near4GiB while host memory remains available. Give only this controlled build an8GiB Node heap; existing test worker/database limits remain unchanged. Retain sdk-browser-built-build-heap-diagnostic.txt. No feature or coverage threshold weakened. Status: rebuild pending.

### ENV136 — Pricing HeroUI server/client build boundary

The production-mode isolated Next build failed because pricing/page.tsx imports the client-only HeroUI compound Accordion from a Server Component. Focused boundary regression reproduces the same invalid import (pricing-boundary-red.txt). Fix: retain server metadata/billing lookup and extract the existing Accordion into a client component. Verification pending. This is a product compile failure, not an OAuth failure.

### ENV137 — Member-card HeroUI server/client boundary

After pricing extraction, the real build failed on member-card/page.tsx direct HeroUI import. Regression reproduced before code changes. Fix uses existing heroui-client named component exports, preserving server authentication/profile read and existing rendered UI. Verification pending.

ENV136/ENV137 focused verification: pricing/member-card boundary plus catalog 9 checks passed; scoped ESLint passed. Full Next build verification remains pending. Build stderr identified each direct client-only import at the corresponding page before changes; later build uses same rolling /tmp build log, while retained regression Red logs provide reproducible persistent evidence.

### ENV138 — Isolated Next build killed by operating system

After both framework fixes, Next build exits 247 (nested process return -9), with no additional compiler diagnostic. Cgroup memory.events reports oom_kill=1; available host memory after termination does not establish effective peak pressure. Retrying only isolated test build with installed Next documented webpackBuildWorker and webpackMemoryOptimizations, applied by temporary test-only configuration loader and 6GiB heap; no source map/type/quality gate disabled and production configuration untouched. Final production gate remains required.

ENV138 diagnostic-harness correction: the temporary config loader initially lost the non-enumerable __esModule marker, so CLI interop treated default as an object. Restored the marker before retry; this pre-build harness error is not application Red.

### ENV139 — Conservative database sizing fallback during build pressure

The new five-suite native activity catalogue selected one DB worker despite MCP_TEST_WORKERS=3. Subsequent readonly sizing diagnostic reports 100 max, 3 reserved, 8 active connections and 4-worker capacity. The initial selection may reflect the automatic CPU/memory budget at process launch or the bounded capacity fallback under concurrent build pressure; the exact initial cause was not captured. No claim of sustained connection exhaustion. Current run is not restarted merely to increase workers.

ENV138 retry outcome: isolated documented Webpack worker/memory optimization build also ended with worker SIGKILL. Retained test-results/mcp/sdk-browser-built-worker-killed.txt. No full build pass claimed; build gate remains open. Continuing independent actual browser acceptance on clean isolated dev runtime; no thresholds disabled or environmental issue treated as global stop.

ENV138 lower-heap experiment: 4GiB with documented memory optimization/worker still reaches V8 heap OOM in server compile (SIGABRT), retained sdk-browser-built-small-heap-oom.txt. This distinguishes insufficient JS heap from later OS-killed6/8GiB builds. Next controlled attempt bounds native compiler parallelism while restoring6GiB heap; no application checks/source maps disabled.

ENV136/ENV137 verified in complete isolated production-mode Next build: compile, TypeScript,61static pages and dependency patch validation passed; existing HeroUI layout retained. ENV138 bounded native compiler attempt (RAYON_NUM_THREADS=1, SWC_THREADS=1,6GiB JS heap, documented Webpack worker/memory options) completed full build; no source maps/type gate disabled. Build uses E2Etrue fixture routes and .next-playwright artifact, so normal E2Efalse release build remains separate. Evidence:test-results/mcp/sdk-browser-built-{build,patches,legal}.txt.

### ENV140 — Read-authority test imports server auth through metadata

New native read-authority suite imports tool/phase constants from the fixture helper, which imports MCP auth options and ESM-only Better Auth into Jest CommonJS before tests execute. Existing mutation authority84cases passed. This is a test setup failure, not policy Red. Fix: keep expected catalogue metadata local and independent in the Jest test; real auth remains inside compiled native probes. BDD bindings already materialized before any possible production fix. Verification pending.

### ENV141 — Inactive agency fixture uses invalid enum value

Read-authority fixture attempted status=rejected, but source enum supports proposed/accepted/revoked. Catalogue failed at setup; existing84mutation checks passed. Corrected to actual revoked lifecycle. Not policy Red. Verification pending.

### ENV142 — Built standalone SDK dashboard lists remain loading

Actual owner/foreign activity browser scenarios passed6.4s/3.6s on built standalone. Both SDK area cases then timed out awaiting dashboard Loading overlays to disappear, after native consent/token/read/edit and resource-page value already succeeded. Server also reports missing ENCRYPTION_SECRET for production consent snapshots; investigate runtime configuration and browser network/WS traces before treating as application regression. No increase to acceptance waits. Evidence:standalone-sdk-browser.txt and isolated failure traces.

ENV141 additional fixture constraint: revoked agency links also require revoked_at and revoked_by. Fixture now sets both with status, clears them for accepted transition; source guard unchanged. Failed setup still not counted as policy Red. ENV142: built dashboard action errors share a digest while c15t logs missing production encryption secret; production encryption module explicitly throws without ENCRYPTION_SECRET, unlike dev fallback. Adding isolated dummy secret only to runtime, preserving application guard.

ENV141 SQL parameter context correction: explicit text→enum status cast and text comparisons remove ambiguous enum/text inference for the reused CASE parameter. Fixture-only change; no guard/schema changes. ENV142 verified: adding isolated ENCRYPTION_SECRET to built runtime resolves dashboard module load/consent snapshot failures. Complete official SDK overlay13.2s and playlist9.0s cases pass23.5s; source unchanged and no assertion timeout extended. Server-action manifest of actual .next-playwright build passed1file. Evidence:standalone-sdk-runtime-fixed.txt and built-action-manifest.txt.

ENV140/ENV141 verified: pure independent Jest case metadata, correct revoked lifecycle fields and explicit parameter casts allow all111read/ceiling native checks to pass9.124s. Previous setup failures retained individually and not accepted as policy Red. Agency ceiling now additionally denies all9write verbs before provider I/O;110actual outcomes plus complete-size assertion. Source application unchanged. BDD110examples pending.

### ENV143 — Mutation-authority BDD expected shape lagged strengthened privacy fixture

The combined authorization BDD run passed 163 cases and failed ten mutation-authority examples because their exact expected objects omitted the newly added `leakedData: false` field. Native authority checks passed 195 cases; no product failure was observed. Update the existing BDD assertions to explicitly require no private data leakage. Verified: scoped mutation-authority rerun passed all ten cases14.7s; latest typecheck and scoped ESLint passed. Evidence: `/tmp/clipify-mcp-evidence/canonical-authorization-bdd.txt`.

### ENV144 — Required dependency audit reports two high advisories

Normal release gate `bun run audit:high` failed: nested prosemirror-view1.42.2 is affected by GHSA-c8x8-7fp4-3x9w (patched1.42.3), source-map-js1.2.1 by GHSA-68fv-2mgg-jv7q (patched1.2.2). Existing audit exemption unchanged. Fixed: targeted compatible patch overrides installed; audit now exits0 with no high/critical advisories. Framework/manifest/auth alignment34tests and type/lint pass. Final build must use revised lock. Do not mutate installed dependencies during the current frozen full coverage/build runs; finish those first. Evidence:test-results/mcp/release-audit-high.txt. Official advisories:https://github.com/advisories/GHSA-c8x8-7fp4-3x9w and https://github.com/advisories/GHSA-68fv-2mgg-jv7q.

### ENV145 — Full lint misidentifies Playwright fixture callback as React use hook

Full app lint failed only on test/bdd/support/mcp-support.ts callback named use. Rename it provideWorld without changing fixture semantics or weakening rules. Five unrelated existing warnings retained. Verified: full app lint rerun exits0 with zero errors and the same five unrelated existing warnings.

### ENV146 — Auth alignment regression retained pre-upgrade expected versions

Frozen full coverage ordinary lane failed two auth-dependency-alignment assertions expecting1.7.6 after authorized1.7.7 upgrade. Update installed-version and peer expectations to1.7.7, keeping effective/root/core equality and peer checks strict. No production dependency change in this correction. Verified: scoped two-case installed-version/provider/core/peer alignment passes on1.7.7. The full run remains historical failed evidence, not Green.

### ENV147 — Full changed-file formatting gate finds five files

Required changed-file check inspected399files and reported graphify-out/GRAPH_REPORT.md, quickstart.md, spec.md, test-traceability.md and src/db/schema.ts. Format documentary files now; defer schema whitespace-only formatting until frozen source coverage completes so source hashes/counter remaps remain reproducible. Final full changed-file gate rerun remains required. Evidence:test-results/mcp/release-format-check.txt.

### ENV148 — Normal standalone smoke initially sent alternate untrusted Host

The actual normal standalone runs on alternate loopback port3111 while its build canonical origin remains3107. Initial unauthenticated MCP assertion expected401 but correctly received403 because Host3111 violates the configured Host guard. Verified runtime with explicit canonical Host3107 gets401 OAuth challenge; independent Host3111 case asserts403. Both discovery endpoints200, production fixture404 even with its fixture bearer, public pricing200. No production change/preloader/timeouts widened. Evidence:test-results/mcp/release-normal-runtime-smoke.json.

### ENV149 — Feature coverage manifest omits changed pricing/framework sources

Required changed-feature thresholds cover MCP pricing and the two repaired framework boundaries. Source review found pricing/page.tsx, Pricing/pricing-faq.tsx, Pricing/pricing-catalog.ts and dashboard/member-card/page.tsx absent from the explicit feature manifest. Add a failing manifest completeness check before correcting the gate; do not lower thresholds or claim browser smoke supplies source coverage. Gate mutation deferred until current frozen run completes. Verified intended Red: one manifest completeness assertion fails and19existing cases pass in feature-manifest-pricing-red.txt; gate correction still pending frozen run completion.

### ENV150 — Frozen full coverage remains below required global and feature thresholds

Full release measurement completed1752.545s:356passing suites,1failing suite,2pre-existing skipped suites;3196passing tests,2stale auth-version assertion failures (ENV146 scoped correction verified),11pre-existing skipped tests. Global functions63.17% below65%; feature manifest gate90individual threshold errors. No threshold/ignore weakening. All quiet deadline/race suites passed. Retain exact measurement/source hashes and target genuine uncovered branches/modules through scoped diagnoses; final integrated gates still required. Evidence:test-results/mcp/full-coverage-release-20261006.txt and full-coverage-release-20261006-gate.json. The four missing manifest sources are separately tracked ENV149 and added only after this measurement finished.

### ENV151 — Inherited owner-entitlement file ignore defeats required source coverage

The final measured JSON has no src/app/lib/entitlements.ts although the required feature manifest includes it. Source begins with an inherited blanket istanbul ignore file directive. Preserve required thresholds and remove this exclusion after a focused regression Red; no authorization/business-policy change. Original full missing-source evidence retained under ENV150. The corrected instrumentation must capture real covered and cold owner-entitlement functions rather than waive the source.

### ENV152 — New pricing browser smoke waits on global network idle

Actual normal pricing HTTP200 passed earlier, but new interactive browser probe times out30s at page.goto waiting for networkidle before any FAQ assertion. No product failure identified yet. Use documented DOM readiness plus actual visible/control assertions, retain unfinished request origin/path census and client page errors; do not increase timeout or suppress application failures. Verified: actual normal built pricing FAQ opens by mouse, collapses by keyboard Enter with aria-expanded updates and opens in mobile viewport, with no client page errors. Pending requests belong to external status/Cloudflare resources; no global network-idle claim. Evidence:test-results/mcp/pricing-built-browser-dom.txt and pricing-built-browser.json; first failure retained in pricing-built-browser.txt.

### ENV153 — Consent server-unit environment annotation displaced

New server-action cases expected approval/denial feedback but8failed in beforeEach with Response undefined;10existing cases passed. Command:bunx jest --runTestsByPath test/mcp/component/consent-page.test.tsx --coverage=false --maxWorkers=1. Existing @jest-environment node annotation was below executable mocks and ignored. Move annotation to the first docblock; no product behavior change. Evidence:test-results/mcp/consent-server-action-environment-failure.txt. Status:Verified; all18cases pass0.437s after correct first-docblock Node environment. Evidence:test-results/mcp/consent-server-action-corrected.txt. This setup failure is not behavioral Red.

### ENV154 — Settings parent unit fixture lacks HeroUI Link.Icon

Settings parent composition expected section content, but2tests failed on undefined React element while5passed. Existing global HeroUI Link mock exported only a plain forwarded link; settings creator tab uses real Link.Icon compound. Add semantic Icon slot to Link fixture, preserving root link behavior. No product change; no behavioral Red claim. Command:bunx jest --runTestsByPath test/app/dashboard/settings.page.test.tsx --coverage=false --maxWorkers=1. Evidence:test-results/mcp/settings-page-fixture-failure.txt. Status:Verified;7composition checks pass1.11s with Link.Icon fixture. Evidence:test-results/mcp/settings-page-composition-corrected.txt.

### ENV155 — Settings-specific semantic HeroUI fixture recursively resolves mapped module

Expanded semantic preferences tests discover0cases because factory requires the globally mapped HeroUI file and Jest resolves the same mock again (stack overflow). This is setup failure, not product regression/Red. Use jest.requireActual for the local CJS fixture, retaining semantic input behavior and unrelated slots. Evidence:test-results/mcp/settings-parent-preferences-fixture-failure.txt. Command:bunx jest --runTestsByPath test/app/dashboard/settings.page.test.tsx --coverage=false --maxWorkers=1. Status:Verified;28cases pass2.476s after requireActual correction and stable test overlay callbacks, without act warnings. Evidence:test-results/mcp/settings-parent-stable-overlay-fixture.txt.

### ENV156 — Isolated standalone started before static asset copy

Updated-lock pricing smoke times out waiting for FAQ body. Diagnostic shows39localJS404s, no React event binding, no pageerror; server started successfully, but Next indexed assets before helper copied new .next/static files. This is isolated launch ordering, not product regression/behavioral Red. Move public/static copy into startup helper before Popen and restart own isolated server. Keep original failure/diagnostic, rerun actual UI proof. Evidence:test-results/mcp/pricing-updated-lock-assets-failure.txt and pricing-updated-lock-assets-diagnostic.txt. Status:Verified; actual updated-lock normal standalone pricing HTTP200, HeroUI FAQ mouse/keyboard aria-state and mobile opening pass with no page errors. Evidence:test-results/mcp/pricing-updated-lock-browser-corrected.txt and pricing-updated-lock-browser.json.

### ENV157 — Settings semantic field fixture needs React display name

Scoped eslint identifies one react/display-name error on anonymous fixture.TextField; production TypeScript passes. Name test fixture SettingsTextField; no lint rule suppression/product change. Command:bunx eslint test/app/dashboard/settings.page.test.tsx test/app/actions/controller.test.ts test/**mocks**/heroui-react.cjs. Status:Verified; scoped ESLint passes after naming SettingsTextField.

### ENV158 — Fetch smoke helper does not preserve overridden canonical Host

One of6read-only smoke cases expected canonical-host401 but fetch helper got403. Direct curl and Node native http.request with the same explicit Host both return401; use native HTTP for intentional Host-boundary probe. Other5statuses already expected. Preserve initial JSON; no application change or authentication relaxation. Evidence:test-results/mcp/release-updated-lock-runtime-fetch-host-failure.json. Status:Verified; final6nativeHTTPstatuses match expectations in release-updated-lock-runtime-smoke.json.

ENV157 verification: scoped ESLint passes after naming SettingsTextField; no rules suppressed.

### ENV159 — Commercial owner fixture combines parameterized SQL statements

Four new creator effective-plan cases expect native MCP creation but fail fixture setup with PostgreSQL42601:cannot insert multiple commands into a prepared statement. Shared pg driver correctly rejects bundled parameterized INSERTs. Split actor membership and identity link writes into separate calls; application unchanged. Command:MCP_PROBE_RUNTIME=node bunx jest --runTestsByPath test/mcp/integration/authorization-entitlements.test.ts --coverage=false --maxWorkers=1. Evidence:test-results/mcp/creator-effective-plan-fixture-failure.txt. Status:Verified; all8nativecases pass41.031s after split inserts. Evidence:test-results/mcp/creator-effective-plan-corrected.txt. No behavioral Red claim.

### ENV160 — Empty Jest table row interpreted as done callback

Auth configuration callback suite19passes/1fails:emptyarray test.each row supplies no parameter, so Jest interprets async callback parameter as done and times out5s. Wrap rows in explicit objects to preserve empty-row argument, keep unchanged timeout. Native application behavior not reached for this failed setup case; not behavioral Red. Evidence:test-results/mcp/auth-config-callback-table-failure.txt. Command:bunx jest --runTestsByPath test/mcp/unit/auth-config-callbacks.test.ts --coverage=false --maxWorkers=1. Status:Verified;20cases pass0.4s after object-row correction, unchanged timeout. Evidence:test-results/mcp/auth-config-callback-corrected.txt.

### ENV161 — Scheduled allocation fixture lacks required removal timestamp

Expanded commercial source suite16passed/1setupfailure: PostgreSQL23514 agency_license_allocations_grace_state requires non-null removal_requested_at alongside future ends_at for removal_scheduled. Native application rejection was not reached. Add the actual removal-request timestamp to the isolated fixture; no schema/constraint/application weakening. Failed command:MCP_PROBE_RUNTIME=node bunx jest --runTestsByPath test/mcp/integration/authorization-entitlements.test.ts --coverage=false --maxWorkers=1; evidence:test-results/mcp/creator-entitlement-expiry-boundaries.txt. Status:Verified; corrected scheduled-removal control and retained-read/update3nativecases pass17.528s in test-results/mcp/creator-entitlement-retained-corrected.txt. Complete expanded commercial regression follows. Not behavioralRed.

### ENV162 — Theme editor fixture lacks browser media-query API

Initial theme-page component suite6setupfailures: JSDOM window.matchMedia is absent; real browser API is required by existing editor drag-support effect. Supply complete MediaQueryList fixture and explicit viewport, retain production behavior and timeouts. Command:bunx jest --runTestsByPath test/app/dashboard/overlay.theme.page.test.tsx --coverage=false --maxWorkers=1. Evidence:test-results/mcp/overlay-theme-page-initial.txt. Status:Verified; media-query exception cleared; corrected attempt2auth/lifecyclecases pass and4rendercases expose independent Slider.Fill fixture omission ENV163. No behavioralRed claimed.

### ENV163 — Theme slider fixture omits the HeroUI Fill slot

After media-query correction,4rendercases fail with undefined element while2auth/lifecyclecases pass. The local Slider override omitted Fill used by the existing page; native HeroUI API has that slot. Add Fill to the fixture; application unchanged. Command:bunx jest --runTestsByPath test/app/dashboard/overlay.theme.page.test.tsx --coverage=false --maxWorkers=1; evidence:test-results/mcp/overlay-theme-page-corrected.txt. Status:Verified; all6themecomponentcases pass1.13s after Fill fixture correction in test-results/mcp/overlay-theme-page-render-corrected.txt. No behavioralRed.

### UI164 — Theme color normalization loses selected RGB channels

Themecontrol suite23pass/1genuinebehaviorfailure: selecting#ABCDEF then remembering palette yields rgba(169,204,239,1) instead of rgba(171,205,239,1). Existing hslaToCss rounds hue/saturation/lightness to integers before RGB conversion, introducing visible drift. Installed HeroUI ColorPicker wraps DialogTrigger; ReactAria Popover chooses contextstate so the child onOpenChange callback does not observe actual trigger-state commits. Actual built browser BDD Red reproduces missing palette commit (expected chosen rgba, received undefined)3.6s; component26cases3fail/23controls reproduce missingcommit, RGBdrift and alpha drift. Keep floating-point HSL until final RGB byte conversion; use supported commit callbacks for recent-color persistence. Command:bunx jest --runTestsByPath test/app/dashboard/overlay.theme.page.test.tsx --coverage=false --maxWorkers=1. Evidence:test-results/mcp/overlay-theme-control-boundaries.txt, overlay-theme-color-commit-red.txt, overlay-theme-color-native-bdd-red.txt. Status:Fixed; all26componentcases and TypeScript pass after float-preserving conversion and native field/area/slider/swatch commitcallbacks. Status:Verified; fresh production E2Ebuild compiles2.3min, TypeScript38.4s,61pages2.8s, patcheddependency/actionmanifest checks pass. All3actualHeroUI/nativeOAuth/MCPstyle-browser scenarios pass13.8s, including exactRGBpalette commit and shared/stale revisions (overlay-theme-color-native-bdd-green.txt).

### ENV165 — Theme test adapter calls an unsupported Color channel setter

Status: Verified — all 53 scoped component cases pass in 6.385s after correcting the native API; evidence: `test-results/mcp/overlay-theme-palette-font-corrected.txt`.

The scoped component command in `test-results/mcp/overlay-theme-palette-font-boundaries.txt` passed 52 cases and failed the opacity callback case because the semantic adapter called `setChannelValue`. The installed native Color object exposes `withChannelValue`. This is a fixture failure, not production behavior Red. Correct both channel adapters to use the actual immutable API and rerun the scoped suite.

### ENV166 — Color boundary assertion uses unsupported DOM matcher input

Status: Verified — 66 component cases pass in 6.965s; TypeScript and scoped ESLint pass. Evidence: `test-results/mcp/overlay-theme-color-font-viewport-corrected.txt`.

`test-results/mcp/overlay-theme-color-font-viewport.txt` had 58 passing cases and eight fixture assertion failures: `toHaveValue` compares values directly and did not accept the asymmetric string matcher. Assert the actual input string with `toMatch` instead. The rendered RGB values were correct; no production change or behavioral Red is claimed.

### ENV167 — Native ESM cannot discover Sentry's forwarded CommonJS exports

Status: Verified — the native SDK bridge allows the public browser action to run; owner baseline passes and two intended current-authority failures are now observable in `test-results/mcp/browser-overlay-list-authority-corrected-red.txt`.

Three new public browser-list probes failed before the behavior assertion with `Sentry.setUser is not a function` (`test-results/mcp/browser-overlay-list-authority-red.txt`). Native Node ESM exposes no named `setUser`/`captureException`, while the installed CommonJS server SDK exposes both. Add an explicit native ESM bridge to the installed server SDK in the test probe compiler, matching webpack interop. No mock, SDK patch, or product behavior change. This setup failure is not qualifying behavior Red.

### UI168 — Browser overlay list bypasses current membership and read permission

Status: Verified — shared authorized read service fixes both genuine failures; 134 affected checks, seven inner read checks, and three owning BDD examples pass. Evidence: `test-results/mcp/browser-overlay-list-shared-green.txt`, `browser-overlay-list-authority-bdd-green.txt`, `overlay-shared-read-inner.txt`.

The real native Better Auth session/public browser action exposes the saved owner record after membership removal or replacement with a role lacking overlay read. Two intended failures and one owner preservation control are retained in `test-results/mcp/browser-overlay-list-authority-corrected-red.txt`. Browser `getAllOverlays` checks cached creator identity but does not recheck the current backend permission. Extract the authorized read service shared with MCP listing; deny the browser result safely while preserving allowed owner records and MCP credential-free projection. Run owning BDD Red before the production fix and retain subsequent regression proof.

### UI169 — Browser overlay list needs secret-read permission for full owner records

Status: Verified — delegated editor full-record listing now uses the shared authorized service and secret-read permission. All184affected checks pass70.204s and16browser/MCP BDD examples pass46.6s (`browser-editor-list-authority-green.txt`, `overlay-read-service-browser-mcp-bdd-complete.txt`). Owner list verified — explicit secret-read permission fixes the owner failure;181affected checks and13browser/MCP BDD examples pass. Delegated native supplement proves the same read-only secret exposure with one genuine failure and two passing allowed/removed controls (`test-results/mcp/browser-editor-list-authority-red.txt`). Evidence: `test-results/mcp/browser-overlay-secret-read-green.txt`, `overlay-read-service-native-bdd-final.txt`.

A custom role with `overlay:read` but no `overlay-secret:read` receives the full browser list, including the owner secret; individual browser lookup correctly denies it. One genuine list failure and one lookup control are retained in `test-results/mcp/browser-overlay-secret-read-red.txt`. The browser list preserves full records and therefore needs its existing secret-read boundary; MCP remains authorized by overlay read and projects credentials away. Add the explicit browser permission to the shared reader after owning BDD Red.

### ENV170 — Legacy playlist action fixture lacks Drizzle ascending order

Status: Verified —187affected cases/7suites pass43.263s after fixture correction (`test-results/mcp/playlist-shared-read-corrected-regression.txt`);16innerchecks pass0.499s with100%allfoursourcecoverage metrics.

Shared-read regression has169passing checks and2legacy fixture failures (`test-results/mcp/playlist-shared-read-refactor-regression.txt`): its mocked `drizzle-orm` omits `asc`, now used by the shared item reader. Actual PostgreSQL/browser/MCP reads, including concurrent snapshot, pass. Add the missing fixture export; retain the production deterministic ordering and native evidence. This is not product behavior Red.

### ENV171 — stalled provider body fixture did not satisfy native Response type

Status: Verified — corrected fixture TypeScript passes and both native timeout cases plus owning BDD pass (`canonical-provider-timeout-corrected-baseline.txt`, `canonical-resource-errors-shared-bdd-green.txt`). TypeScript flagged TS2352 in test/support/mcp/flow-probe.ts after adding timeout coverage. Expected a well-typed controlled provider response; actual partial object omitted native Response fields. Use a real Response and replace only its body reader with the signal-bound stall. Production behavior unchanged. Command: bunx tsc --noEmit; canonical provider-timeout native/BDD and type rerun will verify.

### ENV172 — mocked stalled network omitted a live Node event-loop handle

Status: Verified — both native timeout cases pass24.088s and all13safe error BDD examples pass~1.3m (`canonical-provider-timeout-corrected-baseline.txt`, `canonical-resource-errors-shared-bdd-green.txt`). Expected TDD-US3-042 public handler timeout error; actual native child exited with empty stdout, producing JSON parse failure for both header/body cases. AbortSignal.timeout uses an unreferenced timer and the mock had no live socket or referenced handle. Added bounded12-second fixture watchdog to keep the process alive until the real5-second provider abort, clearing it on abort. No production timeout change. Failing evidence:`canonical-provider-timeout-baseline.txt`; rerun native/BDD to verify.

### ENV173 — quota race fixture did not request create scope

Status: Verified — all3native15.489s and3owningBDD17.9s pass after consent fixture correction (`canonical-quota-interface-races-corrected-green.txt`, `canonical-quota-interface-races-bdd-green.txt`). All-browser race passes; all-MCP and mixed scenarios fail because new catalogue mode omitted full consent scopes. Safe diagnostic shows20MCP403denials, correctly enforcing missing create scope before writes. Add catalogue mode to existing full-scope fixture request and rerun; do not weaken production scope checks. Failing evidence:`canonical-quota-interface-races-baseline.txt`, diagnostic:`canonical-quota-interface-race-diagnostic.txt`.

### ENV174 — browser commercial fixture used raw strings for typed enums

Status: Verified — typecheck/scopedlint pass;13nativecases60.686s and43combinedbrowser/MCPBDDexamples~2.0mGreen (`canonical-browser-commercial-baseline.txt`, `canonical-browser-mcp-commercial-bdd-green.txt`). TypeScript reportsTS2322 on active status/Playlist type in new publicbrowseraction calls. Use repository StatusOptions.Active and OverlayType.Playlist enum values; production behavior unchanged. Current native browsercommercial baseline and type/BDD reruns will verify.

### UI175 — Theme editor evaluates actor Pro instead of overlay creator entitlement

Status: Verified. Theme gating now uses the effective target creator plan returned by the backend. Genuine component and built HeroUI/native session Red precede production; fresh rebuilt browser scenario passes in 3s and three existing color/revision scenarios pass in 11.6s. Full component suite: 90 passed in 10.524s, source 98.9% lines and 85% branches. Evidence: test-results/mcp/theme-owner-plan-unit-red.txt; theme-owner-plan-bdd-red.txt; theme-owner-plan-bdd-green.txt; theme-owner-plan-built-color-regression.txt; theme-owner-plan-complete-green.txt. Shared backend enforcement remains authoritative.

### ENV176 — Google font fallback test did not select Google typography

Status: Verified by the complete 90-test suite (theme-owner-plan-complete-green.txt). New fallback case expected Google Font Family while fixture starts with system Inter and correctly renders the system font selector.86tests pass and1fails at missing textbox (`theme-owner-plan-source-coverage-final.txt`). Select the Google tab before clearing its family, matching the actual UI flow. No production change or behavior Red claimed.

### ENV177 — Invalid empty-family assertion for a nonempty font stack

Status: Resolved. Exploratory quoted-family test incorrectly expected all stylesheet links absent immediately after changing the font input. The UI stores a complete font stack and retains the existing stylesheet until its replacement loads. This assertion does not express the supported contract; removed the invalid exploratory case without production changes. The two zero-size preview boundary cases pass. Evidence: test-results/mcp/theme-owner-plan-boundary-coverage.txt.

ENV177 follow-up: The corrected observable oracle asserts that the saved font stack has no remote URL when its quoted primary family is empty. Initial exploratory expected URL was disproved by the actual saved argument; corrected to the safe local stack. No production change. Evidence: theme-font-stack-observation.txt and subsequent full theme suite.

### ENV178 — Configuration tests accessed fields of a union return without narrowing

Status: Verified. Corrected four suites pass48 tests1.107s and TypeScript exits0 (mcp-new-boundaries-corrected-types.txt). Latest original TypeScript check reports TS2339 for direct theme/playback property access on the Free-or-Pro payload return union in overlay-configuration-boundaries.test.ts. Runtime tests pass; corrected assertions use observable object matching without weakening product types or casting the production return. No production change. Evidence: test-results/mcp/mcp-boundaries-current-typecheck.txt; corrected scoped tests/typecheck follows.

### UI179 — Owned overlay creation leaves rejected server action unhandled

Status: Verified. Minimal safe catch is confirmed by40 component tests/2suites4.834s, native HeroUI/browser1scenario11.9s, types and lint. Final stable production build is still required. Original dashboard regression:27tests pass,1fails because rejected createOverlayWithFeedback escapes the owned creation try/finally without a catch; no actionable toast is displayed. Genuine before-production unit evidence: test-results/mcp/overlay-table-creation-boundaries-red.txt. Real built HeroUI/native session BDD is being executed before production. Resolve owned handler with safe retry feedback while preserving backend enforcement and existing rows.

### ENV180 — Dashboard Dropdown mock rejected supported Set items

Status: Verified by40 dashboard tests and corrected types. New delegated creator cases expose items.map is not a function in the test HeroUI Menu mock; production correctly passes a Set, supported by HeroUI iterable item API. Update mock to Array.from(items) and type Iterable. No production change. Evidence: test-results/mcp/overlay-table-delegated-fixture-failure.txt.

### ENV181 — Cold development compilation exhausted browser fixture setup

Status: Verified by the warmed native browser scenario (1pass11.9s). UI179 Green attempt reaches fresh Next dev runtime but times out60s during first dashboard compilation before the tested action. Genuine built browser Red remains intact; this is not behavior regression. Match proven dashboard setup's120s fixture timeout and domcontentloaded navigation, then rerun against warmed live source server. No application deadline or acceptance threshold changed. Evidence: test-results/mcp/overlay-create-failure-bdd-cold-setup.txt.

### ENV182 — Delegated button selector used unsupported exact option and ignored avatar text

Status: Verified by40 dashboard tests and TypeScript exit0. Corrected iterable mock renders delegated actions, but fixture button accessible name includes Avatar fallback prefix; exact literal role name misses it. Testing Library ByRole also rejects Playwright's exact option (TS2769). Use an anchored name regex matching the action suffix. No production change. Evidence: overlay-table-delegated-corrected-green.txt (8fixturefailures) and overlay-create-failure-current-types.txt.

ENV181 follow-up: warm dashboard navigation succeeds, but its first client auth compilation exceeds default5s row visibility expectation. Use the existing dashboard fixture's30s row-ready wait; native interrupted-action behavior remains unchanged. Cleanup reset retained in failed output, fixture cleanup will be reconciled after server is warm.

### UI183 — Select-all bulk action can affect filtered-out overlays

Status: Verified.48 dashboard tests5.872s, types/lint and2native HeroUI/browser examples41sGreen after resolving all selection to explicit filtered IDs. Original status-filter/select-all/search/delete regression observes two delete calls when only paused overlay is visible and selected;47other tests pass. Current filterSelectedKeys returns literal all unchanged, and bulk handlers use unfiltered owner arrays for that state. Genuine unit before-production Red: test-results/mcp/overlay-filtered-selection-unit-red.txt. Actual native HeroUI/browser delete/status cases are being checked before any production change.

### ENV184 — Playwright pointer check targeted HeroUI visually hidden radio input

Status: Verified by both qualifying Red and2native Green examples. First native filtered-bulk example times out in Given because HeroUI radio__control intercepts pointer events on its underlying input; product action never executes, so this is not qualifying Red. Next server remains alive and handles requests normally. Stop the second identical fixture attempt, use supported focus/Space keyboard interaction and checked-state assertion, and rerun both actual action examples before production. Evidence: test-results/mcp/overlay-filtered-bulk-pointer-setup-failure.txt and generated error-context.

### ENV185 — Cancelled and corrected browser attempts reused one output path

Status: Verified. Unique qualified Red and warm Green artifacts retained. Corrected keyboard run returned two genuine product failures (unfiltered active row deleted; status changed and revision2), but cancelled pointer attempt appended its summary to the reused streaming output filename. Preserve both attempts and rerun corrected examples to unique log/results paths before production, so retained Red is unambiguous. No product change or acceptance claim from the mixed artifact.

### ENV186 — Next development memory protection restarted the UI verification server

Status: Verified. Adaptive12GiB server stays alive without restart;2warm native examples41sGreen. UI183 unit48tests5.872s and types/lint pass, but native Green attempts fail in initial dashboard Loading state. Server log explicitly says Server is approaching the used memory threshold, restarting; Next dev child PID changes while parent remains alive. The local launcher fixed heap6GiB despite roughly70GiB available. This establishes a protective memory restart, not a measured GC crash or test-worker overload. Derive isolated compiler heap from existing CPU/RAM/cgroup detector, bounded35% available RAM and12GiB ceiling (1.5GiB floor), restart owned server and rerun actual behavior. Ordinary test sizing remains separate. Evidence: test-results/mcp/overlay-filtered-bulk-dev-restart-setup.txt and next-ui-scoped-server-redacted.txt.

ENV186 follow-up: adaptive12GiB server stays on the same PID with roughly7.3GiB RSS, no protective restart. Authenticated cold dashboard and client auth recompilation still exceed first30s row-ready assertion; second native status example passes13.5s with unchanged hidden row/revision. Anonymous dashboard warmup was redirected by the proxy and did not compile authenticated UI. Retain this setup result and rerun both examples on the now-warm server without altering application deadlines or accepting setup failure as behavior evidence.

### ENV187 — Strict schema checkpoint command named a nonexistent unit file

Status: Verified by67 tests/4 exact owning suites1.751s. Current provider/retry/risk scope36tests/3suites passes, but schemas.test.ts does not exist, producing explicit ENOENT and overall failure. Actual owning inner schema cases are integration/resource-operations.test.ts. Correct exact filename and rerun all four files; no passing command or production change claimed from failed invocation. Evidence:test-results/mcp/schema-retry-risk-wrong-path.txt.

### ENV188 — bulk dashboard test selector type mismatch — Verified

The new six bulk-resource tests passed at runtime, but `bun run app:typecheck` rejected two `getByRole` options with TS2769: `exact` is not a valid ByRoleOptions field. Expected typecheck Green; actual test-only selector error in `test/app/components/OverlayTable/index.test.tsx` lines 609/631. Replaced both options with anchored `/^Delete$/` names. No production behavior changed. Failed evidence: `test-results/mcp/overlay-bulk-resource-boundaries-types.txt`; Corrected typecheck passes (`test-results/mcp/overlay-bulk-resource-corrected-types.txt`); 54 affected tests in two suites pass in 5.074 seconds (`test-results/mcp/overlay-bulk-resource-corrected-green.txt`).

### ENV189 — scoped Jest option typo — Verified

The cancel/sort/delegated component check rejected `--coveragefalse` before discovery; no tests executed. This is a command error, not behavior Red or a passing test run. Correct invocation uses `--coverage=false`; 76 affected tests in two suites pass in 7.014 seconds (`test-results/mcp/overlay-cancel-sort-delegated-corrected-green.txt`). Evidence: `test-results/mcp/overlay-cancel-sort-delegated-existing-green.txt`.

### ENV190 — release fixture smoke used the wrong HTTP method — Verified

Fresh built runtime returned405 for GET `/api/test/auth-fixture`, while the smoke expected the POST handler's gated404. Five other runtime checks passed. Source exposes POST only and rejects E2Efalse before reading any body or touching data. Correct smoke must send POST for fixture-off and independently retain GET405 as the unsupported-method control. No production change. Original evidence:`test-results/mcp/release-current-dashboard-runtime-smoke.json`; Corrected seven-case native HTTP smoke passes: protected MCP401/challenge, foreign Host403, resource/provider discovery200, E2Efalse POSTfixture404, unsupported GETfixture405 and pricing200. Evidence:`test-results/mcp/release-current-dashboard-runtime-smoke-corrected.json`.

### ENV191 — instrumented pagination test leaves avatar updates outside act — Verified

The 84-dashboard/28-error scoped source check passed112 tests but logged AvatarCell state-update warnings at line1497 under instrumentation. Page navigation inserts asynchronously loaded avatars. Wrap pagination interactions in awaited React `act` so pending user-visible updates settle, without suppressing console output or changing production. Source checkpoint at this stage is84.83percentbranches, below85; final full gate correctly fails on missing unrelated sources. Evidence:`test-results/mcp/dashboard-common-errors-strict-source.txt`; Diagnostic retaining original console output locates warnings in two search-clear cases, which remount avatars. Await those real search interactions in async act; remove temporary console observer. Final116 tests in four suites pass8.891s without console warnings (`test-results/mcp/dashboard-common-errors-verified-source.txt`); source thresholds pass for all three selected files (`test-results/mcp/dashboard-common-errors-verified-source-gate.json`). No output suppression or production change.

### ENV192 — reload test observed request start before committed UI revision — Verified

Settled-render source run passed113 cases but the existing reload revision test deleted with4 instead of expected9. Test waited only for getAllOverlays call count2, then captured deletion before the remaining reload promises committed React state. Expected latest loaded revision; actual test synchronization race. Await the real reload interaction in async `act`; production untouched. Original evidence:`test-results/mcp/dashboard-common-errors-source-settled.txt`. Corrected combined116-test run passes (`test-results/mcp/dashboard-common-errors-verified-source.txt`), latest revision9 is forwarded after awaited reload. ENV191 warning diagnosis continues: awaited initial rendering and pagination/tab interactions did not remove every avatar warning; temporary console observer retains original output and attaches the active test name, without suppressing warnings.

### ENV193 — Focused MCP adapter test tried to require Better Auth ESM

- Status: Verified; original failure/provenance evidence retained.
- Command: scoped Jest server-boundaries.test.ts coverage.
- Actual: suite failed before executing tests because better-auth/api is ESM and this installed Jest CommonJS route cannot load it.
- Expected: adapter boundary assertions, with external OAuth/SDK explicitly isolated and actual vendor behavior verified in owning native contracts.
- Fix: mock the two vendor error constructors at this unit boundary, without changing production imports or Jest package configuration. Retain failed output as mcp-server-adapter-boundaries.txt; rerun focused tests and native owning contracts. This setup failure is not a qualifying behavior Red.

### ENV194 — Adapter header examples inferred optional undefined properties

- Status: Verified; original failure/provenance evidence retained.
- Command: bun run app:typecheck, mcp-server-complete-adapter-types.txt.
- Actual: TS2345 inferred the heterogeneous Origin/Host examples with optional undefined members, which do not satisfy HeadersInit.
- Expected: valid typed request-header examples.
- Fix: construct actual Headers for both examples; no type assertion, production change or relaxed compiler check. Rerun typecheck and focused adapter tests.

ENV194 follow-up: the first typed Headers correction exposed the fixture helper spreading Headers as an object, dropping both injected controls; mcp-server-final-tests.txt retains2failures/18passed. Corrected helper merges actual Headers via forEach/set; rerun mcp-server-final-headers-tests.txt. These are fixture failures, not production authorization failures or qualifying Red.

ENV193/194 verification closure: Verified. Native owning32checks pass107.424s; final adapter20tests pass0.755s with100percentstatements/functions/lines,98.57branches after corrected typed Headers merge. Latest resource-server-final-types.txt and resource-server-final-lint.txt pass. Original failed ESM/type/header logs retained. No production error-constructor/header change, suppression, or altered compiler/coverage gate.

### ENV195 — Playlist editor assertion used toast forwarding function as Jest mock

- Status: Verified; original failure/provenance evidence retained.
- Command: playlist-editor-interactive-fixture.txt, owning playlist page component suite.
- Actual:1failed/3passed; old assertion inspected require(...).notify after fixture refactor now forwards to a named Jest mock.
- Expected: unchanged stale-browser safe toast.
- Fix: assert the named notify mock directly. Production behavior unchanged; this fixture failure is not qualifying Red.

### UI196 — Playlist drag preview is reversed again on drop

- Status: Verified; original failure/provenance evidence retained.
- Command: playlist-drag-order-unit-red.txt; test/app/dashboard/playlist.page.test.tsx drag-save case.
- Expected: first clip dragged below second stays there and enables Save Playlist.
- Actual: dragover moves the clip; drop runs the same move against the changed order, restoring the original order and disabling Save. Exact failing enabled assertion, not setup failure.
- Plan: real Next/HeroUI browser BDD Red before production correction; avoid repeating a move already previewed for the same target, preserve revision-aware save. Retain separate fixture ambiguity below.

### ENV197 — Cached selection assertion matched both playlist and picker checkboxes

- Status: Verified; original failure/provenance evidence retained.
- Actual: playlist-editor-interaction-source.txt has one genuine drag bug failure and one duplicate checkbox query failure (26passed). Existing playlist and cached picker both contain Clip0.
- Fix: scope cached selection assertion to the real dialog; no production or ownership changes.

### ENV198 — New browser cleanup hook lacked an owning scenario tag

- Status: Verified; original failure/provenance evidence retained.
- Actual: bddgen rejected conflicting unrelated auth feature test instances; downstream browser command found zero generated tests. No browser assertion ran; playlist-drag-order-browser-red.txt is setup failure, not qualifying BDD Red.
- Fix: tag new feature @playlist-drag-ui and scope AfterScenario to that tag, matching existing browser fixture ownership. Regenerate with fail-on-gen preserved and rerun actual browser scenario before production edits.

ENV198 follow-up: generation passes after tagged hook. First browser filter used the wrong generated directory and discovered zero tests; actual path is .features-gen/bdd/mcp-support/browser_playlist_drag_ui.feature.spec.js. Corrected discovery runs exactly one scenario; no zero-test run accepted as behavior evidence.

### ENV199 — Drag browser setup timed out while playlist actions compiled; cleanup used wrong fixture fields

- Status: Verified; original failure/provenance evidence retained.
- Actual: first materialized browser attempt reached loading state but did not resolve playlist within default5seconds; failed in Given, not at drag assertion. Cleanup passed nonexistent organizationId and returned500 (fixture endpoint calls startsWith on undefined).
- Fix: existing native-browser startup allowance30seconds, actual creatorOrganizationId/agencyOrganizationId fields and explicit204 cleanup assertion. No production edits or qualifying BDD Red yet. Retain playlist-drag-order-browser-red-generated.txt; rerun warmed scenario.

### ENV200 — Additional hover oracle initially inserted before dragstart

- Status: Verified; original failure/provenance evidence retained.
- Actual: playlist-drag-hover-unit-red.txt fails before a drag begins due an incorrectly placed new preview assertion. It is not qualifying Red; original disabled-Save unit and native browser Red remain genuine.
- Fix: apply repeated hover events and preview assertion after dragstart. Retain corrected pre-production run separately as playlist-drag-hover-unit-actual-red.txt.

UI196 Verified: genuine unit and native BDD Red retained before handler correction;29componenttests Green3.475s and native saved-order/reload Green50.5s with204 cleanup. Types/lint pass, source formatting passes. ENV195 toast forwarding assertion and ENV197 dialog-scoped selection now pass in owning29tests. ENV198 generation/hook scope and ENV199 startup/fixture cleanup corrected and verified by actual browser; ENV200 corrected hover placement has genuine expected Red then Green. Prettier does not support Gherkin in this repository; failed attempted feature-file check retained, TS/TSX formatting and actual bddgen syntax validation pass. No production edits for these setup issues.

### ENV201 — Category button accessible name included its image alt

- Status: Verified; original failure/provenance evidence retained.
- Actual: playlist-editor-category-preview-source.txt1failed/35passed; mock ListBox button includes both Game image alt and Game visible text, so exact Game query missed it after successful debounced provider search.
- Fix: anchored name accepts the visible label with its optional repeated image alt; preserves actual search/selection assertions. No production, provider or timing bypass.

### ENV202 — Manage journey assumed fixture playlist was already linked to overlay

- Status: Verified; original failure/provenance evidence retained.
- Actual: overlay-manage-before-refactor-browser.txt fails waiting for Manage because fixture creates a playlist but its overlay remains All Clips, as confirmed in native accessibility snapshot and fixture source. Production Manage only applies to Playlist type.
- Fix: actual HeroUI Overlay Type selection chooses Playlist and saves the binding before following Manage; no raw storage shortcut or mock. This setup failure is not a behavior Red or justification to alter production routing.

### ENV203 — Manage journey omitted selecting the saved playlist after choosing its source type

- Status: Verified; original failure/provenance evidence retained.
- Actual: overlay-manage-bound-before-refactor-browser.txt completed actual type save but waited on disabled Manage until120second scenario timeout. Native snapshot shows Playlist selection still empty; source-type fallback can be empty while owner playlist lookup resolves.
- Fix: use the real Playlist selector to explicitly choose Browser playlist and assert Manage enabled before saving. Keep normal five-second semantic assertion; no extended timeout or production routing change. Retain failed artifact separately.

ENV203 follow-up: selected-playlist retry used exact option name Browser playlist, but actual saved row label includes its clip count: Browser playlist (2). Inspection of real ListBox source identified the mismatch; interrupted only the owning Playwright process gracefully rather than waiting on a known wrong locator. Corrected exact actual label plus five-second visibility assertion before click. No production action or qualifying Red; no timeout increase.

### UI204 — Inline playlist controls lacked any reachable opening action

- Status: Verified; original failure/provenance evidence retained.
- Actual: isPlaylistOpen initializes false and no opening action exists; legacy mock Backdrop always displayed every modal. Genuine corrected unit fixture gates isOpen and fails for missing Quick edit playlist after loaded actual page.
- Authorized scope: expose the already implemented revision-aware inline playlist controls through a small explicit Quick edit action; keep Manage's verified dedicated-editor route. This realizes existing browser item-save coverage rather than generating fake modal visibility.
- Evidence: overlay-quick-edit-unit-red.txt. Actual browser Red is being materialized before production addition.

Auto-review rejected overwriting the overlay page with the724-line automatically cut legacy-dialog preview, citing large impact and insufficiently specific authorization for that replacement. No production overwrite or workaround executed. A small reachable quick-edit control is the safer alternative; broad deletion is not required for the feature and is not retried. Read-only preview retained in /tmp, outside repository artifacts.

UI204 Verified: six actual-isOpen-gated component tests pass1.865s, native inline owner dialog opens21.1s after genuine unit/browser missing-action Red; types/lint pass. Existing inline save no longer relies on rendering closed modals. Dedicated Manage routing remains present.

### UI205 — Inline playlist drag repeats the already previewed move

- Status: Verified; original failure/provenance evidence retained.
- Expected: previewed order survives one or repeated hover events and drop, and saves at the read parent revision.
- Actual: inline duplicate of the old drag handler reverses order on drop; repeated hover also reverses preview. Two exact component failures before production correction, overlay-inline-drag-unit-red.txt.
- Plan: real native inline-save/full-editor BDD Red, then the same narrow already-previewed-target correction as independently verified UI196. No broad deletion/overwrite.

UI205 Verified: original2unit/native Red before correction retained;52componenttests Green7.097s, native actual inline save/full-editor read Green27.8s,types/lint pass. Same small guard correction; generated feature syntax and204cleanup verified.

### ENV206 — Overlay control fixture defaulted buttons to HTML submit and used the importer label

- Status: Verified; original failure/provenance evidence retained.
- Actual: overlay-editor-core-control-source.txt3failed/24passed. Preview button inside Form implicitly submitted in the mock, unlike native HeroUI button type=button, restoring default playback and breaking Top/SmartShuffle assertions. Advanced view filter queried Minimum Views (importer label) rather than actual Minimum Clip Views.
- Fix: mock default button type=button with explicit submit preserved, actual field label and individually awaited asynchronous preview-triggering changes/status interaction. No production behavior change or qualifying Red. Original console act warnings preserved; no suppression.

ENV206 Verified: corrected27controls pass5.071s after actual default button semantics/label and awaited preview effects; no act-warning suppression.

### ENV207 — InputGroup fixture omitted the React Aria TextField value context

- Status: Verified; original failure/provenance evidence retained.
- Actual:52filter/reward controls pass7.244s but reward title resolving from undefined logs uncontrolled-to-controlled warnings in the raw DOM mock. Installed HeroUI Input/InputGroup.Input delegate to React Aria Input with TextField context; mock had no such context.
- Fix: initialize the controlled InputGroup input's value to empty string when absent, retaining real onChange and actual subsequent value. No console suppression, production field or provider change. Source thresholds remain open.

ENV207 Verified: overlay-table-fixture-verification.txt passes all52tests6.588s without the previous uncontrolled-input warning; expanded cached-draft verification passes53tests6.281s.

### ENV209 — Category fixture closed its own popup before selecting

- Status: Verified.
- Actual: overlay-import-category-create-source.txt failed2category assertions and one router assertion;64cases passed. Typing already opens the fixture's ComboBox popup; pressing its trigger immediately closed it. The create-success assertion referred to a nonexistent mockRouterPush.
- Fix: retain the popup opened by actual input changes, use the existing stable router, and return the submitted overlay data in the save fixture so category removal tests use committed state. No production change or qualifying Red. Corrected67cases pass13.506s; source lines86.87%, strict gate remains open.

### ENV210 — BDD generation rejects top-level test.use in a fixture module

- Status: Verified.
- Actual: bunx bddgen failed before scenario discovery because the imported MCP fixture called base.use outside a test suite.
- Fix: override the inherited trace option through base.extend instead. This keeps OAuth traces off without a global configuration mutation. Corrected bunx bddgen exits0; no production change or qualifying Red.

ENV210 Follow-up: TypeScript identifies trace as a worker fixture; corrected the override to direct trace:"off", retained the validated database URL for cleanup, and removed four Testing Library exact options (Playwright-only syntax). Subsequent scoped lint passes; fresh types proof running.

### ENV211 — Expanded overlay fixtures used ambiguous or mismatched accessible names

- Status: Verified.
- Actual: cache-filter4cases queried both parent Clear and picker Clear; cached preselection queried both parent/picker clip checkboxes; importer queried All Categories rather than rendered All categories; SmartShuffle queried Preview rather than the actual count button.
- Fix: scope picker actions/checkboxes to its actual open dialog and use exact rendered labels/count. No production change or qualifying Red. Corrected96componentcases pass29.191s; actual-counter source diagnostic passes all UI thresholds. Original failed and corrected logs retained under test-results/mcp/overlay-*source.txt and *corrected.txt.

### ENV212 — Portable SDK browser journey readiness and later loading failures

- Status: Investigating.
- Actual: initial portable-sdk-browser.txt2cases stalled at disabled approval after the c15t reload. Native check attempts encountered HeroUI's visual controls intercepting input pointer clicks. Keyboard actions plus waiting for the reload load event passed consent and reached actual MCP mutations, but later dashboard/settings loading assertions failed in portable-sdk-browser-loaded-keyboard.txt.
- Action: use supported focus/Space interaction and explicit application readiness assertions; restart isolated test server through actual repository Playwright environment rather than the older custom launcher, then rerun the2owning scenarios. No production change, forced interaction, timeout blanket increase, fake Red, or unsupported GC-crash claim. Release gate remains open.

### ENV213 — Reused disposable browser JWKS require the original fixture secret

- Status: Verified; original failure/provenance evidence retained.
- Actual: portable-sdk-managed-server.txt2scenarios failed at consent; the server reports Better Auth could not decrypt its existing JWKS private key. Managed defaults differed from the older launcher's secret used when this disposable database was created.
- Fix: preserve the original isolated Better Auth secret in the local managed launcher when reusing that database. Fresh CI databases use the managed default. No production secret change, JWKS deletion, crypto weakening or qualifying Red. portable-sdk-managed-compatible-key.txt running.

### DEP214 — Current audit reports the sharp librsvg advisory

- Status: Verified.
- Actual: final-dependency-audit.txt fails the Required audit:high gate for transitive Next sharp0.35.4, GHSA-wq5f-xc86-pv6w; official advisory reports the patch in0.35.5. No advisory ignore added.
- Resolution plan: complete the frozen source/dependency integrated run, then apply the surgical transitive patch update. sharp-update-preview.txt confirms bun update sharp --dry-run --ignore-scripts updates exactly one package0.35.4→0.35.5 within Next's ^0.35.4 range. Recheck lockfile, audit, image compatibility and final normal production build before release.

### ENV208 — Cached-picker assertion assumed a native heading in the component fixture

- Status: Verified.
- Actual: overlay-cached-draft-verification.txt failed one newly added case while52existing cases passed. The fixture renders Modal.Heading as a div, and clip titles include the Clip prefix.
- Fix: assert the rendered modal title and actual accessible checkbox name. No production change or qualifying Red. Corrected53cases pass6.281s in overlay-cached-draft-corrected.txt; selected cached clips remain a draft before persistence.

ENV212 Verified: portable-sdk-managed-compatible-key.txt completes both native browser/official SDK journeys; overlays4.5m with cold page compilation and playlists2.1m, total6.5m. Actual consent, read/write visibility, authoritative Free caps, denial, immediate revoke and refresh rejection pass. No timeout blanket increase or forced control click. Existing high-memory long-running launcher was replaced by the repository-managed server; GC causation is not claimed.

ENV213 Verified: same2journeys pass with the existing disposable JWKS secret retained. Default fresh-CI environment has no old encrypted keys. No production key deletion or auth crypto change.

### ENV215 — Browser journey fixtures raced loading and ignored vendor registration throttling

- Status: Verified; original failure/provenance evidence retained.
- Actual: final-bdd-browser.txt activity hit the60second whole-journey limit; playlist setup and overlay save asserted within5seconds despite real pages and the ten-second dependency budget. Later registration fixtures returned429 from Better Auth's own5/minute registration limit, below Clipify's10/minute ceiling. The browser lane was gracefully interrupted after8completed cases rather than treating setup failures as Red or consuming the remaining scenarios with known invalid setup.
- Fix: bound actual multi-page connection journeys at180seconds, use30seconds for their startup input and15seconds for MCP browser assertions; native deadline/benchmark measurements remain unchanged. Browser registration honors valid Retry-After with at most2retries and refuses missing/excessive budgets.7retry tests pass0.336s. No limiter reset, production threshold change, forced click or waived backend deadline. Corrected activity/bulk/conflict/save/theme cases pass; completed unaffected cases reused by explicit title selection. Remaining BDD paused at the full run's exclusive timing phase.

### ENV216 — Instrumented discovery child exceeded its setup process deadline under competing runs

- Status: Investigating.
- Actual: final-integrated-coverage.txt metadata-aliases.test.ts disabled-root example reports execFileSync Node ETIMEDOUT at its15second fixture process cap while additional BDD workers and browser compilation were active. Other discovery/provider/schema cases pass; no public metadata assertion failed.
- Action: stop competing BDD dispatchers at the required quiet timing/race phase, retain their completed-case selections, then rerun only metadata-aliases with the same instrumented pipeline after the quiet phase. No15second fixture limit or actual backend deadline increase; final integrated gate stays open until verified.

ENV216 expanded diagnosis: pagination-catalogue.test.ts's shared beforeAll child also hit its30second process cap under competing runs; its43case assertions were not reached. Browser-provider-preload.test.ts's four negatives rejected correctly but asserted the old preload message after the new shared validator changed diagnostic wording. Its assertion now requires exit1 and the actual guard's rejection prefix, preserving protection against timeout/import failures. browser-provider-isolation-shared-guard-green.txt:4suites31cases pass2.787s, including all4native preload negatives. Metadata/pagination reruns remain pending after the quiet phase.

ENV216 Verified: final-contention-scoped-coverage.txt reruns only metadata-aliases and pagination catalogue with identical production source and process caps, serially without competing BDD. Both suites pass (24.492s/9.187s for the files; each child remains within its original cap). Full77source/configuration hashes unchanged. Full run plus these actual scoped counters passes every per-source threshold in final-integrated-repaired-source-gate.json; original full3suite/48test failures remain retained. Four preload diagnostic assertions separately verified in31fixture checks. No new full4k rerun, silent deadline increase, fabricated historical counts or statement exclusions.

DEP214 Fixed: sharp-security-patch-update.txt records the targeted transitive0.35.5 update (five installed platform/transitive packages); package.json adds no direct sharp dependency. sharp-patched-audit.txt exits0 with no high/critical advisories and existing ignore unchanged. sharp-patch-image-compatibility.json validates PNG/WebP/SVG raster operations; sharp-patched-dependencies.txt verifies the sole Nextpatch. Normal final build pending.

### ENV217 — Fresh normal-runtime smoke used the transport port as canonical Host

- Status: Verified.
- Actual: first unauthenticated MCP request returned403, correctly rejecting Host127.0.0.1:3111 while the isolated runtime canonical configuration remains127.0.0.1:3107. No product failure or qualifying Red.
- Fix: explicitly send the configured canonical Host over the standalone transport port; keep the foreign-host negative separate. No host-policy change.

DEP214 Verified: final-production-build-unmodified-config.txt completes normal repository build with sharp0.35.5; final-normal-action-manifest.txt and final-normal-runtime-smoke.json pass. ENV217 corrected seven-case smoke Green; foreign-host403 remains enforced.

### ENV218 — Browser MCP rename request lost its HTTP connection

- Status: Verified.
- Command: final-bdd-browser-resumed.txt, browser_playlist_items_ui.feature, BDD-BROWSER-ITEMS-003 stale clip-save example.
- Expected: successful intermediate MCP rename followed by stale browser conflict. Actual: APIRequestContext POST /mcp read ECONNRESET during the intermediate rename; final revision assertions were not reached.
- Evidence: retained browser error context is token-redacted; managed test server remains running, and inspected server log has no fatal/heap signal. No GC-crash cause claimed.
- Next: finish unrelated browser cases, then rerun this isolated scenario with a fresh fixture and inspect the real response. Do not automatically retry the possibly committed mutation on the same fixture.

### ENV219 — Standalone consent regression exhausted its whole-journey timeout

- Status: Verified.
- Actual: real_consent.feature BDD-US1-025 timed out at60seconds waiting for callback navigation; its fixture combines registration, provider redirect, privacy reload, consent and token/read verification. No final protocol assertion reached.
- Fix: use the same180second whole-browser-journey budget and rate-limit-aware registration as existing playlist journeys; explicitly keyboard-select and assert the actual HeroUI creator checkbox before approval. Add owner fixture cleanup on all outcomes. Individual dependency deadlines remain unchanged.

ENV218 investigation: the managed dev server later logs aborted requests, Unexpected end of JSON input and Manifest file is empty. Normal build uses.next while E2Edev uses.next-playwright, so no shared dist directory was found. The server remains alive; heap13GiB RSS alone does not prove GC/OOM. Fresh restart and serial browser reruns are required before classifying the initial connection reset.

### ENV220 — Browser scenarios were included in the parallel native lane

- Status: Verified.
- Actual: bulk_partial_ui.feature has @bulk-partial-ui but lacks @real-browser, so its two real dashboard examples ran with two native workers alongside the main browser lane. Both timed out before the final bulk behavior; dashboard rows vanished during privacy reload. Subsequent SDK browser scenario remained Loading overlays; managed dev log reports aborted/empty-manifest responses.
- Fix: classify actual page-bound steps as browser work, run these cases serially after a clean managed-server restart, retain all original failures. Do not weaken assertions, retry ambiguous mutations or claim a proven GC crash.

ENV219 follow-up: the newly added untagged cleanup hook caused bddgen to infer two unrelated test instances for auth-engine-rewrite.feature. Restricting the hook to its owning @BDD-US1-025 scenario preserves original test ownership; regenerate and verify before execution.

### ENV221 — Owner mutation target moved into the shared overlay read service

- Status: Verified.
- Actual: targeted final wrong-owner run passes baseline but cannot locate the original predicate in resources/overlays.ts after shared read refactoring. No mutant was applied; no strength pass claimed.
- Fix: target the actual current shared owner-bound read predicate, retain the original missing-target failure, then prove foreign-resource assertion failure and restored Green in an isolated copy.

ENV221 Verified: final-overlay-owner-mutant-corrected.txt and mutants-final-overlay/report.json establish actual native foreign-resource assertion failure and restored Green at the new shared read predicate. final-invariant-mutant-gate.json verifies all five current invariant source hashes and preserved proof paths.

ENV218 Verified: final-browser-scoped-repair.txt fresh-fixture stale clip-save scenario passes1.8m after clean managed-server restart; actual intermediate MCP rename and final revision conflict assertions execute. No blind retry of the old mutation. ENV219 Verified: corrected actual consent/code-exchange/overlay-read journey passes4.8s; tagged cleanup and nonempty regenerated ownership gate pass. Original ECONNRESET and60second timeout remain retained. ENV220 bulk status/delete examples pass34.2s/15.7s serially; final SDK overlay proof pending.

ENV220 Verified: all five isolated browser repairs pass4.6m, including actual SDK overlay consent/edit/limits/delete/create/deny/revoke journey1.9m. Corrected bulk cases execute serially34.2s/15.7s; native lane audit finds no other actual page fixture beyond bulk (pagination uses the word page only). Original native2failures and browser3failures remain retained.

### ENV222 — Prefix resume selector omitted refresh outline Example10

- Status: Verified.
- Actual: previous passed-title regex for Example1 also excluded Example10 in refresh_rotation.feature. Generated file-line audit finds609/610 native cases passed, exact missing location62.
- Fix: run exact file:62 and reconcile coverage by unique generated file/line; do not claim selected count alone proves complete catalogue.

ENV222 Verified: exact refresh Example10 passes4.6s. final-ordinary-bdd-location-coverage.json reconciles generated file and line with retained pass proofs;610/610native and28/28browser examples Green with zero missing. Original failures and interrupted runs remain retained separately. Quiet71examples executing exclusively.

### ENV223 — Local staged browser runner restarted before owned Next process exited

- Status: Verified.
- Actual: final-existing-browser-regressions.txt has4/4acceptance tests Green, then local restart readiness fails. Fresh Next log reports Another next dev server is already running (owned PID2242778); shutdown204 had closed HTTP listener while app.close left process/Next lock alive. No ATDD assertion executed.
- Fix: wait for the owned process, not just HTTP status, and gracefully terminate only the verified owned scripts/playwright-server.mjs process after a bounded shutdown grace. Resume ATDDshard1 without repeating4passed acceptance tests. No database/cache/lock deletion or product behavior change.

Final status-field reconciliation: UI196/204/205 and ENV193–207,213,215 current fixes are verified by final integrated full+exact-repair regression, all required source thresholds, complete96/44editor cases and exact709native/browser/timing acceptance. Original failures remain retained; this current verification does not waive ENV-011/ENV-023historical chronology. ENV223first corrected ATDDshard10/10passes; subsequent clean restart/stages still under verification.

### ENV224 — Existing legal BDD asserted interactivity before its readiness was verified

- Status: Verified.
- Actual: original legal BDD A3 fails axe scrollable-region-focusable for HeroUI ScrollShadow; A5 cannot open Privacy preferences within5seconds.59other original BDD cases and all19ATDD cases pass. No legal production source changed by MCP.
- Next: inspect actual selected/tabindex state and cookie trigger after real HeroUI interaction; preserve original failures and make only a proven fixture or product correction. First diagnostic cannot connect because the staged runner exited and its owned server child ended; start a separate owned server session before diagnosis. No missing-behavior Red claimed for connection refusal.

ENV224 diagnosis confirmed: existing-legal-interactive-diagnostic.txt observes server-rendered tabs all-1and initial axe serious violation; existing-legal-steady-diagnostic.txt observes hydrated selected tab0and zero axe violations WITHOUT focusing tabs. A fresh hydrated Cookie preferences keyboard action opens the dialog before any choice. Fixture now waits for selected legal tab0before unchanged axe/keyboard assertions; cookie trigger waits for the actual hydrated consent control, then uses focus/Enter. No sleeps, forced action, axe exclusions or legal production changes. Focused two-case verification pending.

ENV223 Verified: staged remaining19ATDD and61originalBDD execute after owned-process shutdown/Next-lock release fixes; no unowned process or lock/cache/database deletion. ENV224 Verified: two unchanged legal accessibility/dialog acceptance cases pass2.3s/9.5s(12.8scombined), after condition-based hydration readiness; original59Green examples are reused. No legal production source change, fixed sleep, focus-before-axe workaround or axe exclusion.

---

## Consolidated workflow expansion

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

## FB-DEF-001 — Feedback fixture DSN rejected by installed SDK

The first post-implementation acceptance run passed all five denial cases but rejected four valid reports as SERVICE_UNAVAILABLE. The real SDK rejected the synthetic nonhex public key before creating its client. Correct the fixture DSN to a valid synthetic hex key; the controlled transport remains local and never contacts Sentry. Production availability checks remain intact. Evidence: feedback-bdd-green.log and feedback-diagnostic.log; Verified by feedback-bdd-complete.log, all 16 cases passed.

## FB-DEF-002 — Installed Sentry Scope API differs from older SDKs

Type checking rejected the older scope.clear method and a removed fixture option. Use a fresh installed Sentry.Scope with only the verified user ID and bound client, and remove the unsupported fixture option. Evidence: feedback-types.log; Verified by feedback-types-verified.log and feedback-bdd-complete.log.

## FB-DEF-003 — Initial daily bucket was not a rolling 24-hour quota

feedback-rolling-red.log proves later reports could lose their quota before 24 hours when the first report expired. Retain per-report timestamps and expire receipts individually; user state expires after the latest report. The RAM-only limit remains five across creators/clients. Verified by feedback-memory-final.log and feedback-bdd-complete.log.

## FB-DEF-004 — Activity UI imported a server-owned type

Scoped lint flagged the existing type import from server/mcp/schemas in the client activity component. Move its unchanged labels (plus feedback) into a client-safe data module; enforce exact catalogue completeness through a focused unit assertion and render the new label in the existing component test. No exception to the import restriction was added. Evidence: feedback-lint.log; Verified by feedback-lint-verified.log and feedback-labels-green.log.

## FB-DEF-005 — Deduplicated retry aliases were not payload-bound

feedback-alias-red.log proves a new retry key accepted for identical content could later submit different content. Bind each accepted alias to the original report digest. Bound each receipt to five key hashes to avoid unbounded RAM growth; original-key retries remain accepted at alias capacity. No raw content is retained. Focused Verified by feedback-memory-final.log and feedback-bdd-complete.log.

## Shared-limiter verification corrections

- Test file used the browser-global name Cache without being a module. Types/build failed; adding export {} fixed the collision. Final types/build pass.
- A verification command supplied MCP_PROBE_COVERAGE_PROBE_DIRECTORY instead of MCP_COVERAGE_PROBE_DIRECTORY, selecting an uncompiled fixture and failing Sentry SDK flush setup. Corrected instrumented command passed all 17 actual MCP examples. No production change required.
- Initial aggregate omitted shared-core refund counters because Jest collectCoverageFrom lacked the new file. Added src/server/rate-limit.ts to collection and recaptured affected tests. Strict coverage passes all 91 required files and unchanged global/gallery thresholds.

Retained logs use the shared-feedback prefix under test-results/mcp-workflows; final successful evidence uses final/verified/complete suffixes. All corrections are closed locally.

## Focused editing migration defects

- FE-DEF-001: Existing risk-table count assumed 15 non-workflow schemas. Focused tools add 19 schemas while three legacy contracts stay internal; public discovery has 66 tools. Corrected the count and exact public discovery assertions without skipping tests. Scoped native checks and the complete execution plus exact assertion repairs verified. Normal final publication regression is pending.
- FE-DEF-002: Native fixture callers and composite gallery option cases used removed broad public names. Migrated metadata cases to focused tools; multi-area cases sequence updates using returned revisions. Preserved existing plan, role and revision assertions. Scoped native checks and the complete execution plus exact assertion repairs verified. Normal final publication regression is pending.

- FE-DEF-003: Initial direct BDD invocation used Bun react-server conditions, which cannot load the existing mixed React/Next probe imports. Rerun with the established compiled Node probe route; no production behavior change or test-worker patch is required.
- FE-DEF-004: Client settings initially imported static examples through the server module, violating the repository boundary lint rule. Moved static example data to src/app/lib/mcpPrompts.ts and retained SDK registration/server instructions in the server module. Scoped lint and both production build variants verified.

- FE-DEF-005: Capability reporting still included three internal legacy names and advertised Pro-only overlay editing as available on Free. Added a failing native capability test, restricted reporting to the 66 public names and flagged theme/filter/playback updates with the existing Pro restriction. No backend policy change.

- FE-ENV-001: The standalone action-manifest checker initially had no .next/server because only .next-playwright existed. Built the ordinary standalone artifact and reran the checker: 91 files passed. A migration-policy invocation omitted the required staged mode; reran with staged mode against the prepared index and passed. No product code or migration guard changes were needed.

- FE-DEF-006: Full regression found a metadata-only result assertion still expecting playback volume. Updated it to require the narrow metadata response and separately verify unchanged stored volume. The targeted native case passes in focused-entitlement-green.log.
- FE-DEF-007: The load benchmark still read a full overlay from focused metadata mutations. Updated only its response projection; identity, revision, private-data, persisted-row and timing checks remain. Fresh compiled-probe benchmark passes in focused-benchmark-green.log: 20 independent creators, unchanged private-data/revision checks, p95 reads 329 ms and mutations 925 ms.

- FE-DEF-008: Eight workflow option assertions expected incidental gallery renames, and the custom source/filter case expected one revision for two focused writes. Require preservation of the saved gallery name and revision 3 for that two-write case. The full 37-option rerun supplies the repair evidence; no production behavior changed.

- FE-DEF-009: Full coverage exposed earlier callback-handoff component coverage absence and near-threshold consent/configuration/connection/gallery paths. Added current-behavior tests without production changes. Four suites/40 tests and the native missing-playlist case pass. All 96 strict files and original global/gallery thresholds pass after combining fresh counters. Scoped reports alone still fail global thresholds because unrelated tests were not run; they are never advertised as complete coverage.
- FE-ENV-002: The temporary aggregation helper initially omitted the canonical JSON roundtrip that normalizes non-finite source-map columns. It duplicated counter locations. Matched the existing collector serialization, preserved all counters, then reran the strict gate; no application instrumentation or thresholds were changed.

- FE-DEF-010: Previous CI browser logs showed native Better Auth throttling uses X-Retry-After, whereas the browser registration fixture accepted only Retry-After. A new expected-failure test precedes the fixture correction; all eight helper checks pass. Actual dashboard journeys respected the provider wait and completed; no limiter was disabled, reset or widened.
- FE-DEF-011: The core consent fixture requested every workflow scope while asserting a core-only selection, and its BDD discovery assertion still listed 15 tools. Narrowed the fixture's requested/selected scopes to its core scenario and shared the independent approved 66-name expectation between contract and BDD checks. Sixteen native consent/catalogue scenarios pass. A substring test filter also selected the real-browser consent case without its server; the exact-path rerun is Green.
- FE-DEF-012: A browser overlay metadata mutation asserted the removed full-overlay response. Require the narrow settings projection and keep the subsequent persisted-state assertions. The broader affected browser batch passed 11 cases; its already-loaded stale assertion failed. The exact fresh-worker rerun passes (focused-ci-browser-repair.log).
- FE-ENV-003: Pre-commit rejected a test fixture comparison between general strings and the literal scope union. Changed membership comparison to typed equality; runtime scope selection is unchanged. The normal hook is rerun, never bypassed.

Final closure: focused-push-verified.log proves the normal hook passed all 426 suites / 4,553 tests on the corrected committed source. FE-DEF-001 through FE-DEF-012 and the documented local verification environment corrections are closed. External development login/schema and live-host acceptance prerequisites remain unchanged.

## CF-DEF-001 — Preserve asynchronous rate-limit errors

The complexity cleanup accidentally removed `async` from `consumeMcpRateLimit`, causing invalid inputs to throw synchronously instead of returning rejected promises. The focused negative-boundary suite caught eleven failures. Restored the existing public async contract and audited the changed TypeScript declarations for other removed async functions. All 16 rate-limit input tests now pass; assertions and limits remain unchanged. Evidence: `/tmp/clipify-refactor-final-focused.log` and `/tmp/clipify-refactor-rate-limit-fixed.log`.

## CF-ENV-001 — Overlapping verification runs timed out a dependency probe

The intermediate MCP regression reported `spawnSync ETIMEDOUT` for the provider deadline `headers` probe while the final full push-hook regression was also running. Contention is suspected, not established. Stopped the publication regression before transfer to restore isolation; no deadline, assertion, worker policy or hook was changed. The isolated rerun passed all three unchanged deadline cases in 37.816 seconds (`/tmp/clipify-refactor-provider-isolated.log`), consistent with a transient contention failure. The broader intermediate batch passed 142 of 143 suites and 1,446 of 1,447 tests. The fresh isolated normal push-hook run passed all 436 suites / 4,603 tests, including the unchanged deadline suite, in 2,406.372 seconds. Current CI is also Green. This verification defect is closed; no product change was needed for its rerun.

## CF-DEF-002 — Browser OAuth helper expected the removed automatic redirect

The completed prior CI BDD shard failed 15 real browser journeys and took 2.5 hours because their shared `connectBrowserPlaylist` helper waited for callback navigation after authorization. Retained CI page snapshots show successful authorization and the approved manual `Continue to Browser playlist revision` link. Update the helper to assert that success page and click the continuation link before observing callback navigation and exchanging the code. Product UX, OAuth validation, timeouts and retries remain unchanged. All 15 affected real-browser journeys pass in three minutes against the existing success-page flow (`/tmp/clipify-browser-handoff-repair.log`). CI failure evidence: run 37783995209, job 113334139596. The repair is published in 66e0ed7; CI run 37808034227 passes all 372 owning BDD shard examples in 13.0 minutes. The defect is closed.

## Approved historical evidence disposition — 2026-10-08

The user explicitly approved the scoped review in merge-readiness-review.md.
The twelve historical evidence obligations and dependent T249 are closed by
accepted exception. Original limitations (including ENV-023) remain retained;
no historical test-first proof is invented. T577 remains a nonblocking
production collector follow-up with an explicit owner and rollout deadline.

## CQ-DEF-001 — Generated test path CodeQL finding (closed)

GitHub CodeQL alert #9 identified filesystem-derived `JSON.stringify(plans)`
interpolated into executable preload source in
`test/mcp/unit/test-runner-database-budget.test.ts`. There is no demonstrated
remote input; the generated-code boundary nevertheless warranted a narrow fix.
Commit ecae530 uses a static sibling URL resolved through `import.meta.url` and
`fileURLToPath`, eliminating data interpolation. Both actual runner lanes pass
(two tests, each exercising three fixture tests); ordinary and special-character
path controls, focused ESLint, formatting, typecheck and normal hooks pass.
Independent read-only investigation and candidate review found no surviving
route or legitimate regression. GitHub analysis run 37822095362 confirms alert
#9 fixed; its required review thread was resolved. The alert was not dismissed.
