## Schedule history and recurring scope, 2026-10-19

Past/current occurrences open details with streaming settings read-only. Completed one-time events cannot be rescheduled or deleted; a separate title action leaves execution revisions and selections unchanged. Future weekly changes offer This occurrence / This and following, preserving earlier windows and linked exceptions. Schema changes remain migration-workflow owned.

Validation: six affected service/calendar suites pass 140 tests; the Runner recurrence file passes 40 tests. Build/types and affected lint pass. The existing Runner/locale browser owners pass five cases, and the complete new history owner passes separately, including all four recurring choices, cancellation, database persistence, active-series future editing and desktop/mobile details in both themes. Final full-width scope-button refinement passes the complete history browser owner; captures are inspected. Full latest-head CI remains required before merge.

## Calendar and locale review, 2026-10-19

The calendar uses grouped HeroUI controls, a primary Add schedule action, icon-labelled automation controls, and native all-day strips/month spanning bars. Browser-visible dates follow browser locale through shared formatting; ISO transport and explicit schedule timezones remain unchanged.

Validation: 32 affected suites / 441 tests, plus the final exact-midnight regression and editor files (17 tests), without coverage. Production build passes. The real-browser owner checks en-US/de-DE all-day save/edit and locale behavior, desktop/mobile and both themes; the complete Runner owner remains included. All five final browser cases pass. Latest-source complete PR CI is still required before merge.

# Test Summary Report: Free Runner and Pro Broadcasting

> Event-state appearance follow-up (2026-10-19): editable Agenda events use a vivid fill and dashed border; locked entries use a darker solid surface and an accessible bottom-corner lock. Day/week/month, both themes, mobile icon bounds and locked selection protection pass in the real Pro owner, with the setup owner also green. Free behavior and the complete Agenda unit file pass; build/types/lint and inspected desktop/mobile captures pass. Saved events remain scheduled. Latest-source full CI remains required before merge.

> Schedule-title follow-up (2026-10-19): show missing/overlong title feedback on the HeroUI title input with focus and an associated error, preserve drafts and validate before calling the existing server action. Server validation remains in place with readable boundary messages. Both affected whole-file suites pass107/107; the106-case service owner passes with new message assertions, and the complete real browser3/3 covers field errors and recovery. Build/types/lint and dark/light field-error review pass. Latest-source full CI remains required before merge.

> Schedule-destination follow-up (2026-10-19): replace the schedule checkbox stack with the shared HeroUI multiselect and secondary styling. Both affected component suites pass9/9; complete Runner browser3/3 passes, including selection toggling, multiple-selection semantics, Escape, schedule save and database destination persistence. Build/types/lint pass; desktop/mobile light/dark captures reviewed. Fresh latest-source full CI remains required before merge.

> Contextual-upgrade follow-up (2026-10-19): audit and correct feature intent across scheduling, resource limits, filters, Theme Studio, imports, trial and Creator Page upgrade prompts. Generic account upgrades remain generic. Use a HeroUI secondary comparison action and selected-cycle primary price CTA without em dashes. Six affected unit suites pass376/376; complete Runner3/3 and feature-context browser1/1 covering13 intents pass. Build/types/lint and inspected light/dark desktop/mobile captures pass. Prices are synthetic test metadata and checkout is intercepted before payments. Fresh full PR CI remains required before merge.

> Shared-editor follow-up (2026-10-19): Runner navigation/name/status/unlink now live inside the primary card under generic page chrome. Runner, Overlay, Gallery, Playlist and Tools share editor width/gutters. Fix Tools padding, Playlist mobile name sizing/labels, Overlay mobile ID visibility/Back label and a reproduced reward-input overflow. Five affected unit files pass152/152; cross-editor browser1/1 and complete Runner3/3 pass. Final build/types/lint and inspected light/dark desktop/mobile captures pass. Fresh full PR CI is required before merge.

> Schedule-alignment follow-up (2026-10-19): Schedule sits inline to the right of Control, with a shared bottom edge and the selector filling the remaining row. Real desktop/mobile alignment checks and the complete editor3/3 pass in52.7s. Revised dark/light desktop and mobile captures inspected; build/types/lint pass. This supersedes the earlier floating-button layout. Fresh full PR CI is required before merge.

> Explicit-schedule follow-up (2026-10-19): Save configuration no longer opens the calendar. Schedule sits beside its control selector, requires a saved draft and opens only on explicit action. Complete real editor3/3 passes in52.8s, including desktop/mobile opening and event creation. Build/types/lint and inspected dark/light desktop and mobile captures pass. Fresh full PR CI is required before merge.

> Upgrade-modal follow-up (2026-10-19): one selected-price surface, native cycle Tabs, concise shared feature highlights, Pro crown and one footer action replace duplicated pricing and the long Runner paragraph. Complete real editor3/3 passes in52.6s, including keyboard cycle selection, monthly checkout payload and retry after an intercepted network failure. All four light/dark desktop/mobile captures inspected; build/types/lint pass. Synthetic price transport is isolated from the payment provider. Fresh full PR CI is required before merge.

> Provider-endpoint follow-up (2026-10-19): Twitch/YouTube use their presets and expose no editable URL; Custom RTMP retains its URL editor. Build/types/lint and complete real editor3/3 pass in54.0s, including provider switching and custom URL saving. Named-provider modal capture inspected. Fresh full PR CI is required before merge.

> Stream-key follow-up (2026-10-19): one HeroUI password field replaces the credential-action selector. Real Free/Pro editor checks verify empty initial input, password masking, untouched ciphertext/revision preservation, saved replacement and cancelled draft preservation. Complete editor3/3 passes in55.9s; production build/types and affected lint pass. Masked-field captures inspected. Fresh full PR CI remains required before merge.

> Destination-deletion follow-up (2026-10-19): confirmed deletion detaches stopped saved broadcasts atomically, clears the last legacy endpoint/key, preserves alternate selections and protects live/cached/uncertain executions and schedules. Complete destination-editor48/48 and related destinations19/19 pass. Real editor3/3 passes on Free/Pro, including actual Delete confirmation, stable focus/Escape, empty selection and disabled Start, database clearing, reload and explicitly saving a replacement. Build/types/lint pass; confirmation and deleted-state screenshots were inspected. Earlier full CI belongs to its recorded inputs; fresh PR CI must qualify this change before merge.

> Destination-table follow-up (2026-10-19): replace the card grid with a responsive HeroUI table and separated right-aligned icon actions. Production build/types and affected lint pass; the complete editor acceptance owner passes3/3 with multi-row/long-content desktop/mobile geometry, keyboard Edit and cancellation, deletion cancellation, and inspected dark/light captures. This changes execution inputs after the full qualification below; fresh PR CI is required before merge.

> Current correction checkpoint (2026-10-19): full CI39218922432 and five-platform native matrix39218915226 pass on9b49c632. CodeQL and CodeFactor pass. The merged application/native evidence matches execution fingerprint b610c21f97e5542206040fc854e8b344e241f6bbc85e61bc8b9594f2eb025ab6. All implementation and correction tasks are complete. Historical pending/No-Go statements below describe earlier candidates and are superseded by this qualification. No merge or production deployment is performed.

**Updated:** 2026-10-19 · **Branch:** `plan/free-runner-branding`

**Specification:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md) · **Registry:** [test-traceability.md](test-traceability.md) · **Defects:** [defect-log.md](defect-log.md)

## Current corrective implementation

The icon/layout/tab/corner-picker refinements pass31 affected unit/component cases and3 real editor journeys; the complete affected presentation owners additionally pass27/27 with inspected clean captures. Final [full CI39218922432](https://github.com/TheDanniCraft/clipify/actions/runs/39218922432) passes every application coverage lane, all six browser groups, merged coverage, native coverage, build, types, lint and formatting. Native coverage passes450 tests across52 suites with one inherited updater TODO. The [native matrix39218915226](https://github.com/TheDanniCraft/clipify/actions/runs/39218915226) passes all five platforms. Retained qualification metadata is `tdd/evidence/ux-correction/final-qualified-ci.json`.

CI152f8b70 exposed an exact-boundary fixture that suspended the native watchdog for renderer proof, then relied on a single estimated clock tick for shutdown. A deliberately early tick reproduces its open-output failure. Restore the real watchdog after the renderer proof and require the persisted closure receipt; the whole recovery owner passes6/6 and final native coverage passes. All original final-frame, no-next-clip and closed-output assertions and deadlines remain intact. No production shutdown code changes.

The Runner editor and standalone-entitlement hard cut are implemented in `6f87bd3b`/`9433536e`, with enrollment cleanup in `ec95eae8`, pushed to PR #519. The PR is ready for review so complete CI owns completion validation. The complete Runner browser regression owner passes 42/42 scenarios on the corrected production build. Required push feedback passes 201 suites and 3,043 cases (one existing conditional suite and three conditional cases skipped); this is scoped feedback, not the full coverage gate.

The correction uses inline destination creation, recoverable configuration saves, modal appearance/scheduling, the shared overlay color picker, HeroUI Pro DropZone and Agenda, local timezone/date controls, stable message-driven previews and effective-Pro-only advanced access. AGENTS.md now requires real-component UX acceptance and visual review. Historical standalone Runner benefits are removed; unrelated Pro grants/trials/creator seats remain supported.

Real-component editor acceptance passes 3/3 with inspected desktop/mobile and light/dark captures. Complete acceptance passes22/22. The mobile-padding correction additionally passes35 complete collision/readability/upload-boundary/pause cases without weakening width, canvas or readability checks. These overlapping owners are not summed. A final redundant destination heading/paragraph is removed; fresh final editor acceptance passes3/3 and the complete destination-boundary/custom-standby owners pass20/20. Full CI39166929160 qualified all browser/native/static owners but failed database-2 because the stored notification function referenced the retired enum. The user-approved migration0028 repairs that actual Pro-grant defect; its original database owner now passes with all23 underlying assertions unchanged. Full CI39171941186 passes all runtime/browser/native lanes, but its aggregate coverage rejects two UI file floors. Additional behavioral coverage is implemented and passes102 affected cases; fresh merged evidence remains required. SQL migrations now participate in execution-input fingerprints, verified by a new Red/Green regression.

The unfinished local completion attempts are excluded: coverage passed341 ordinary owners before stopping during database owners, and the broad browser run passed68 before one interruption/44 unrun. They are not full gates. Final qualification will use complete CI for the final frozen inputs, with all existing coverage floors and inventories. No release readiness claim is made for these changed inputs. See the current closure evidence in [UX audit](tdd/ux-audit.md).

## Historical prior-candidate outcome

The following statements describe the previously qualified candidate, superseded by the corrective implementation above.

All 23 delivery slices and 376 primary artifacts are implemented. The published source is `4be68ca38f0057eb783685894ad7f02e0ae2c091`. Implementation recommendation is **Go for final review**. All implementation/runtime qualification and the user-approved security dispositions are complete. No merge or deployment is authorized.

**CodeFactor passes with zero issues and zero annotations**, clearing all 41 baseline findings. CodeQL clears all 12 generated-test-source alerts. The three high classifications [#24](https://github.com/TheDanniCraft/clipify/security/code-scanning/24), [#26](https://github.com/TheDanniCraft/clipify/security/code-scanning/26) and [#27](https://github.com/TheDanniCraft/clipify/security/code-scanning/27) were individually reviewed as false positives: random bearer-token fingerprints or private schedule content addressing, rather than password verification. Following the user's explicit approval, each was dismissed with its documented reason. GitHub verifies zero open PR alerts and a successful CodeQL check; cryptographic checks and scanner rules remain intact. See [approved disposition evidence](tdd/evidence/F1-approved-security-dispositions.json).

Current local qualification passes 312 cases in ten complete server owners and 450 native cases in 52 suites, with the sole inherited updater TODO and all unchanged per-file coverage floors. Local native aggregate coverage is S94.78/B90.41/F95.61/L97.53. Exact Free acceptance passes 2/2 and real multistream delivery passes 5/5, with retries0. Application/native types, lint, formatting and migration-policy checks pass. The mandatory push hook additionally passes 248 related cases and eight fixture/coverage harness cases; these overlapping runs are not summed as unique feature cases.

All six refreshed invariant faults are caught: signature, expiry, identity, capture fencing, clip completion and owner-wide admission limit. Every restored whole-file owner passes and all 1660 source/test/execution-input hashes match the frozen fingerprint `be699c61e99437437c1721d70ffde7e259442f68eebece586bc421012d2be43d`. The unfavorable initial signature-owner selection and rejected setup commands are retained as failed evidence, not qualifying passes.

The official [five-platform native workflow](https://github.com/TheDanniCraft/clipify/actions/runs/39122022382) passes every build, executable self-test, matrix validation and preview manifest publication. Its source fingerprint `54ff2834fbd8a9b6def81fe791c3ff6ee28e3118445410423683dee190c8daba` matches current native inputs; the downloaded manifest passes the repository verifier. Production execution signing/public trust remains deployment-owned under [runner-signing.md](../../docs/runner-signing.md).

The current [full application CI](https://github.com/TheDanniCraft/clipify/actions/runs/39122026804) passes **every required runtime job**, including all six coverage lanes, the merged Test gate, all six browser owners, complete native coverage, both builds, types, lint and formatting. It also confirms the startup isolation repair under the complete unit lane. Downloaded application and native coverage artifacts both verify the same frozen fingerprint above: 39 application/workflow sources and 13 native sources, with unchanged floors and exact inventory checks. Final documentation-only follow-up must retain these verified execution inputs and the existing required GitHub checks.

The final mapping audit preserves376 unique primary artifacts and1046 unique completed tasks. All17 quality gates are Green; the five final story/full-validation gates are closed. Complete runtime CI39123709920 passes on04402364, retaining the qualified1660-input fingerprint. The official five-platform matrix remains valid for the identical native input fingerprint. The earlier **7,574-case** checkpoint and source inventories below remain historical evidence for their recorded inputs. Production execution signing/public trust must be configured through the deployment-owned process before rollout.

The approved Free/Pro names and prices remain. Free Runner has unlimited hours and registered devices, one owner-wide active broadcast and one destination, Manual/fallback operation and generated-content attribution. Pro adds local multi-destination/broadcast execution, Agenda scheduling, clean branding and custom standby. Media and scheduling execute on the end user's computer. Historical scoped Runner benefits and records remain supported; new standalone Runner purchases are retired.

## Historical frozen-input qualification

The following frozen-input execution, counts and review conclusions describe the earlier candidate only. They do not qualify the current review refactors; the Outcome above is the current readiness decision.

### Exact candidate and execution policy

The source/execution fingerprint is `5bcb13275c521475a2f04a15832de856fb2f0440575ff02f1f3d96a20cc3dd78`; its1657 input hashes are in [F1-v2-frozen-execution-inputs.json](tdd/evidence/F1-v2-frozen-execution-inputs.json). Node22.23.3, Bun1.4.2, disposable loopback PostgreSQL18.6, generated local media and local RTMP receivers were used. Native packaging targets Node24; the local binary is Linux x64 only.

Complete lanes ran sequentially to isolate timing/media ownership. Normal browser jobs use the same uninstrumented precompiled probes as CI and distinct fresh disposable databases. Browser fixture state and final case IDs are verified, not inferred from head SHA or counts. No assertion, observation deadline, coverage floor or accepted-retry rule was weakened. No generated Drizzle files, protected migration guards or approval override changed.

## Executed physical cases

| Owner                 | Complete inventory                        | Passed | Remaining                 |
| --------------------- | ----------------------------------------- | ------ | ------------------------- |
| Root Jest             | 517 owners                                | 5777   | 0                         |
| Native Runner Jest    | 52 owners                                 | 450    | 1 inherited updater TODO  |
| Native MCP workflows  | 434 examples, one BDD/ATDD/coverage owner | 434    | 0                         |
| Root browser projects | 913 exact case IDs                        | 913    | 0                         |
| Total                 | Actual owning executions                  | 7574   | Sole inherited TODO above |

The five normal Jest test lanes pass5766 cases; their11 pre-existing environment-conditional auth cases were then executed with their required independent disposable fixtures and fake credentials. The [complete inventory gate](tdd/evidence/F1-v2-complete-test-inventory-gate.json) matches those11 exact owner/case names back to the original pending cases, adding no duplicate count. Both complete auth owners pass8+3 cases without skips.

Browser results are4 acceptance,22 ATDD,885 BDD across275/325/285-case shards, and2 compliance cases. The [browser inventory gate](tdd/evidence/F1-v2-complete-browser-inventory-gate.json) confirms913/913 unique expected IDs, six distinct job databases, zero retries/skips/foreign cases. Native mcp-workflows remain excluded from ordinary root projects and execute once under their separate owner. Failed or flaky prior attempts never qualify these totals.

## Artifact and source traceability

| Primary role | Green artifacts |
| ------------ | --------------- |
| TDD          | 196             |
| BDD          | 174             |
| ATDD         | 6               |
| Total        | 376             |

| Story                                   | Primary artifacts covered |
| --------------------------------------- | ------------------------- |
| US1 Free/manual access and admission    | 63                        |
| US2 Destinations and fan-out            | 47                        |
| US3 Scheduling and lifecycle            | 130                       |
| US4 Attribution and standby             | 98                        |
| US5 Commercial access and compatibility | 38                        |

These are registry artifact counts, not additional physical tests. Shared labels/aliases have one execution owner. All47 core source IDs map to the376 primary artifacts, all1046 task IDs are unique, and all683 recorded physical owner references exist. The final [mapping audit](tdd/evidence/F1-v2-final-mapping-audit.json), [physical-path audit](tdd/evidence/F1-physical-owner-path-audit.json), generated-scenario audit and canonical registry contain the normalized relationships. Original intended Red and honest retained-baseline evidence remain in [cycle-log.md](tdd/cycle-log.md).

## Coverage and quality gates

| Gate                                       | Current local result                                                                  | Evidence                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Complete six-lane coverage merge           | Passed; exact source/inventory validation                                             | [merge log](tdd/evidence/F1-v2-merged-coverage.log)                             |
| Root merged coverage                       | S86.55 / B81.66 / F83.89 / L88.86                                                     | `coverage/coverage-final.json`, `coverage/lcov.info`                            |
| Declared feature sources                   | 39 app/workflow and13 native, exact inventories                                       | `coverage/runner-feature/gate.json`, native `coverage/runner-feature/`          |
| Native whole collected coverage            | S94.48 / B90.16 / F95.16 / L97.41                                                     | [complete native log](tdd/evidence/F1-v2-full-native.log)                       |
| Critical and legacy floors                 | Unchanged critical L/S/F95 B90; ordinary90/85 and explicit legacy baselines protected | Gate registry and coverage policies                                             |
| App/native types                           | Passed; native TS/config/dependency inputs verified identical before retention        | [type input review](tdd/evidence/F1-v2-native-type-input-retention.json)        |
| Lint                                       | Passed:0 errors,6 retained warnings                                                   | [lint log](tdd/evidence/F1-v2-preflight-lint.log)                               |
| Final formatting                           | Passed:810 changed files                                                              | [format log](tdd/evidence/F1-v2-final-format.log)                               |
| Root/native High audit and negative owners | Passed; identical locks, unchanged existing ignore, no new exception                  | [security review](tdd/evidence/F1-v2-security-input-retention.json)             |
| Production/browser builds and actions      | Passed; both100-file action manifests                                                 | `F1-v2-standalone-*` and `F1-v2-browser-*` logs                                 |
| Script/CI/migration policy checks          | 69/69 pass; source-only schema diff                                                   | [migration ownership review](tdd/evidence/F1-v2-migration-ownership-check.json) |
| Deliberate fault detection/restoration     | Reviewed; risk-bearing guard modules/bodies unchanged, complete current owners reran  | [strength review](tdd/evidence/F1-v2-strength-retention-review.json)            |
| Three-receiver real media                  | Passed independent recovery, decoded packets and process/socket cleanup               | Complete native `output.integration.test.ts` owner                              |
| Fresh local Linux artifact/self-test       | Passed; actual binary hash and public build inputs recorded                           | [Linux artifact](tdd/evidence/F1-v2-linux-native-artifact.json)                 |
| Official five-platform native workflow     | Blocked: not executed in this Linux workspace                                         | T651 / QG-13                                                                    |
| Required full CI                           | Pending publication and CI execution; local evidence is not a CI run                  | Story gates and T660 review checkpoint                                          |

Critical per-file and ordinary aggregate native policies are exactly those in the native Jest configuration. The existing CLI whole-file baseline is not relabeled as a per-file90% guarantee. The large legacy player cannot hide missing new Runner counters. No lower coverage threshold or new risk/audit exception is approved.

## Visual and quickstart review

All nine [quickstart](quickstart.md) journeys map to complete local owning evidence in [F1-v2-quickstart-journey-review.json](tdd/evidence/F1-v2-quickstart-journey-review.json): unlimited Free/manual limits; races/uncertain slots/tombstone ACK; independent three-target recovery; Agenda/form/keyboard/DST; cached scheduling and clip completion; restart/Stop/Resume/Pause; branding/assets/outside-window standby; commercial expiry/legacy scope; unsupported old clients and v2/scalar storage compatibility.

Public pricing retains two plans and groups Runner/broadcasting alongside existing feature categories. Final [desktop](tdd/evidence/F1-v2-pricing-desktop.png) and [mobile](tdd/evidence/F1-v2-pricing-mobile.png) screenshots were visually inspected. Both show the Runner group and existing20EUR annual fixture price, with document widths equal to1440/390-pixel viewports. Price data is supplied by a local fixture matching existing2EUR monthly/20EUR annual tests; this is not a live Stripe catalog review. No checkout action was taken. Served LLM documentation and feature/pricing copy were updated in C1 and remain covered by the complete current owners.

## Defects, rejected evidence and limitations

All242 canonical defects are Verified;0 remain open or deferred and no High/Critical exception exists. Earlier source candidates, failed setup attempts and flaky browser reports are retained and excluded. DEF237 fixed a real eager-encryption-import regression during disabled-MCP privacy cleanup; the encryption production guard is unchanged and both scoped and complete owning regressions pass. Earlier native/provider timing failures pass complete isolated owners without changed deadlines; their exact shared-host cause remains unproven. The browser expiry setup omission and reused-job dialog flake are recorded honestly; qualifying browser jobs use CI precompilation and fresh fixtures with no retries. Supplemental auth and manual preview setup errors affected only local fixture helpers, not application/test source.

Free control-channel loss still requires renewable authority and bounded drain before slot recovery. Offline schedulers cannot instantly learn unknown revocations; signed validity limits and reconnect reconciliation apply. Old binaries must advertise supported v2 enforcement before new-policy starts. Multiple destinations consume the user's own hardware/upload capacity. These approved design limits remain documented, not newly accepted defects.

[F1-v2-fixture-cleanup.json](tdd/evidence/F1-v2-fixture-cleanup.json) confirms the six completed browser-job databases are absent, the original rejected browser database was removed, and all16 exact job-owned template identifiers were cleaned/confirmed absent. No production/shared-development data was used. The read-only commercial/key rollout preflight is documented; no live billing/account/key rollout verification is claimed.

## Final review and release readiness

Local runtime, source coverage, build, native smoke, security, traceability, visual and cleanup evidence is complete; final formatting passes. All required master/full-CI validation remains intact. The final checkpoint records **No-Go for release** because the official full CI and five-platform native matrix have not run on this candidate. T149/T235/T316/T521/T639/T651 remain open for that evidence. T660 keeps PRs draft by default and preserves complete ready-for-review/master validation. The unattended implementation continues through the required CI checkpoint. No merge or deployment is authorized by this report.

Historical planning/delivery details remain in the cycle log, immutable A1–E4 checkpoint artifacts, and the [prior rolling summary](tdd/evidence/F1-v2-prior-summary.md). This report supersedes its earlier planning/in-progress status fields.

The versioned [evidence archive](tdd/evidence.tar.gz) and [manifest](tdd/evidence-manifest.json) preserve the original text test-first outputs and structured results without adding thousands of generated files to the source review. See [evidence instructions](tdd/README.md) to inspect or restore historical paths. Coverage directories, HTML/media reports, executables and crash dumps remain outside Git.

## Post-restart qualification

The implementation commit survived shutdown unchanged across all1657 recorded inputs. Restored PostgreSQL18 and Chromium prerequisites resolve DEF-US5-243 (five harness/fixture suites, eight tests). Post-restart broader feedback exposed DEF-US5-244: wall-clock resume examples overlapped an earlier recurring event. The test fixture now disables earlier examples and explicitly creates its future recovery event; the complete schedule owner passes106/106 (`tdd/evidence/F1-restart-schedule-v2.log`). Both findings are Verified. The earlier7574-pass full qualification belongs to its recorded input manifest; it is not relabeled as execution of the revised fixture. Complete CI and the native matrix remain pending, and the six gate tasks remain open.

## Official native matrix and first full CI

Official native workflow39109206765 passes all five platform builds/executable self-tests, matrix validation and artifact manifest publication. Current native source fingerprint3838cbac9f93dd9b5bb5e00d5a4a98bad6402aa2372a573975e0481796b8307c matches the published manifest despite later CI/schema-only changes; evidence is `tdd/evidence/F1-official-native-matrix.json`. T651 is complete;1041/1046 tasks are complete. Five story gates still require full CI. The configured public trust mapping is empty; production signing setup remains deployment-owned as documented in `docs/runner-signing.md`.

Full CI39109433179 verifies the shared native dependency fix (DEF-US5-245), including complete native coverage/media tests. Its workflow coverage lacks FFmpeg (DEF-US5-246), and browser schema initialization exposes composite foreign-key/index ordering (DEF-US5-247). Both fixes require a fresh owning CI run. Revised schema owners pass178 tests across three whole files; CI/schema-wrapper checks pass25 cases. A reported SQL error now fails the restricted schema-push wrapper even if Drizzle exits0. No generated migration, guard bypass or assertion weakening is introduced.
