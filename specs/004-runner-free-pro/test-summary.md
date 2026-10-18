# Test Summary Report: Free Runner and Pro Broadcasting

**Updated:** 2026-10-18 · **Branch:** `plan/free-runner-branding`  
**Specification:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md) · **Registry:** [test-traceability.md](test-traceability.md) · **Defects:** [defect-log.md](defect-log.md)

## Outcome

All23 delivery slices and376 primary artifacts are implemented and locally qualified. The complete current-source test inventory passes **7,574 physical cases**. The sole inherited native updater TODO is explicitly retained and is not counted as a pass. The final changed-file formatting check passes810 files.

Release recommendation remains **No-Go** until required full CI and the official five-platform native workflow qualify the published source. Six tasks remain blocked on that evidence after local formatting: T149, T235, T316, T521, T639 and T651. These are release/story quality gates, not unbuilt feature work. This is the completed local checkpoint before CI publication; it claims no official CI pass, merge, deployment or release email.

The approved Free/Pro names and prices remain. Free Runner has unlimited hours and registered devices, one owner-wide active broadcast and one destination, Manual/fallback operation and generated-content attribution. Pro adds local multi-destination/broadcast execution, Agenda scheduling, clean branding and custom standby. Media and scheduling execute on the end user's computer. Historical scoped Runner benefits and records remain supported; new standalone Runner purchases are retired.

## Exact candidate and execution policy

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
