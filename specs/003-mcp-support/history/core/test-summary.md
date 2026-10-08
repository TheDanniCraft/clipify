# Test Summary Report: MCP Support

Updated: 2026-10-07. Branch: `feature/mcp-support`.

## Executive Summary

391/405 tasks complete (96.5%, unweighted; not shipping readiness). All 15 MCP tools are implemented using official MCP server 2.3.0 and native Better Auth/MCP/OAuth 1.7.7. The BetterAuth patch is removed; only the existing Next 16.3.6 patch remains.

Shared backend authorization, creator entitlements, quotas, revisions, retry and activity policies apply to browser and MCP callers. Free includes MCP within the existing one-overlay/one-playlist/50-clip allowance. Consent, connected apps and activity use actual HeroUI/HeroUIPro components. Pricing and llms content are updated.

All 709 locally executable MCP examples pass. Current coverage, normal production build/runtime, audit and deliberate invariant mutants pass. All 86 existing browser regression cases pass. Final formatting/report reconciliation is complete. Required named-host acceptance and historical test-first provenance exceptions remain unresolved. Release recommendation: **No-Go**; local implementation/verification continues.

## Scope and References

[Specification](spec.md), [plan](plan.md), [tasks](tasks.md), [traceability](test-traceability.md), [defects](defect-log.md), [cycle journal](tdd/cycle-log.md). Earlier measurements are preserved in [historical checkpoints](test-summary-history.md), not presented as current results.

Scope: US1–US4, FR-001–FR-018, SC-001–SC-005, EC-001–EC-021. Fifteen tools cover creators/capabilities, overlay and playlist CRUD, and playlist item add/remove/reorder. Live playback/queue remote control is outside this feature.

## Execution Summary

| Check                          | Current result                                                                                                                               | Evidence                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Frozen full Jest regression    | 4,131 passed, 48 failed, 11 existing skips;383 passed/3 failed/2 skipped suites;2,409.063s                                                   | test-results/mcp/final-integrated-coverage.txt                                          |
| Exact failed-suite repair      | metadata and pagination 49 cases pass with unchanged production sources/process caps; guard/helper 31 cases pass; original failures retained | final-contention-scoped-coverage.txt; browser-provider-isolation-shared-guard-green.txt |
| Native MCP BDD                 | 610/610unique generated locations pass across retained initial/resumed/exact-example runs                                                    | final-all-local-bdd-location-coverage.json                                              |
| Real browser MCP BDD           | 28/28unique locations pass; five failed examples subsequently pass serially with fresh fixtures; original failures retained                  | final-browser-scoped-repair.txt; final-all-local-bdd-location-coverage.json             |
| Exclusive timing MCP BDD       | 71/71 pass in 7.3 minutes, zero failed                                                                                                       | final-bdd-quiet.txt                                                                     |
| Complete local MCP acceptance  | 709/709unique current file/line locations; zero missing local examples                                                                       | final-all-local-bdd-location-coverage.json                                              |
| Original acceptance regression | 4/4 pass in 1.9 minutes                                                                                                                      | final-existing-browser-regressions.txt                                                  |
| Original ATDD regression       | 19/19 pass across two shards                                                                                                                 | final-existing-browser-regressions-staged.txt                                           |
| Original BDD regression        | 61/61 pass: 59 original passes plus two exact hydration repairs                                                                              | final-existing-browser-location-coverage.json                                           |
| Original compliance regression | 2/2 pass                                                                                                                                     | final-existing-browser-location-coverage.json                                           |
| Scenario generation            | Nonempty 770 BDD/19 ATDD/709 MCP; no parse/binding failure                                                                                   | final-generation-after-consent-fix.txt                                                  |

Raw files listed above are under `test-results/mcp/`. Scoped results are not summed into a fictitious fresh full-run total. All 48 original full-run failures are addressed through exact scoped verification; original raw failures remain available.

## Coverage and Traceability Summary

The full snapshot exceeds unchanged whole-repository thresholds: 85.75% statements/79.37% branches/84.94% functions/88.36% lines. Actual full counters merged with exact same-source instrumented repairs pass every required MCP source threshold: 96.82%statements/91.01%branches/97.54%functions/98.81%lines. Critical files require 90% statements/functions, 95% lines and 90% branches; UI files require 90% statements/functions/lines and 85% branches. No counter fabrication, source exclusion or threshold reduction.

Evidence: `final-integrated-repaired-source-gate.json`, `final-integrated-repaired-coverage-check.txt`, `final-integrated-source-freeze-verification.json` (77 source/config hashes unchanged through integrated repair).

Canonical published catalogue: 101/102 required scenario IDs materialized; only real-host BDD-US1-021 remains unavailable. The current 709 local examples include explicit expanded boundaries. `final-scenario-catalogue-audit.json` and `final-all-local-bdd-location-coverage.json` preserve ID/location reconciliation. Before-production Red obligations remain separately audited; current Green does not establish missing historical chronology.

## Quality Gates

| Gate                             | Status                                         | Current evidence                                                                                                       |
| -------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Source/global coverage           | Green                                          | final-integrated-repaired-coverage-check.txt                                                                           |
| PostgreSQL races/deadlines       | Green                                          | final-bdd-quiet.txt; final-all-local-bdd-location-coverage.json                                                        |
| Warmed performance               | Green                                          | 20 independent creators; p95 read 240.60 ms/mutation 354.66 ms, within 1000/2000 ms budgets                            |
| Repository lint                  | Green                                          | final-lint-after-ci.txt:zero errors, five existing warnings; final-reconciled-scoped-lint.txt                          |
| Typecheck                        | Green                                          | final-reconciled-typecheck.txt; final-production-build-unmodified-config.txt                                           |
| Format                           | Green                                          | final-reconciled-format.txt: 465 changed files; final report-only check after verdict update                           |
| High/critical dependency audit   | Green                                          | sharp-patched-audit.txt; sharp 0.35.5 fixes GHSA-wq5f-xc86-pv6w; existing ignore unchanged                             |
| Image compatibility              | Green                                          | sharp-patch-image-compatibility.json:PNG/WebP/SVG                                                                      |
| Normal production build          | Green                                          | final-production-build-unmodified-config.txt; normal repository config, 61 static pages, standalone patch verification |
| Action manifest/runtime HTTP     | Green                                          | final-normal-action-manifest.txt; final-normal-runtime-smoke.json:seven checks                                         |
| Deliberate invariant mutants     | Green                                          | final-invariant-mutant-gate.json:all five current-source invariants killed/restored                                    |
| Migration ownership              | Green                                          | final-migration-policy.txt:11 guard tests; no generated drizzle changes                                                |
| CI wiring                        | Applied/reviewed; GitHub execution not claimed | final-ci-wiring-validated.json; sole guarded loopback clipify_e2e browser-tests schema push retained                   |
| Graphify code index              | Updated                                        | final-graphify-legal-fixture-refresh.txt: 6,737 nodes/14,868 edges/306 communities                                     |
| Existing browser regressions     | Green                                          | final-existing-browser-location-coverage.json: 86/86 unique cases                                                      |
| Named hosts                      | Blocked                                        | client-matrix/prerequisites-blocked.md; task T247                                                                      |
| Historical test-first provenance | Review pending                                 | cycle journal and disclosed ENV-011/ENV-023/provider-schema/benchmark exceptions                                       |

Graphify refresh uses code AST extraction. Optional SQL parser and semantic LLM labels are not newly installed or claimed refreshed.

## Defect Summary

Current product fixes and fixture failures retain their original evidence in the defect log. UI196/204/205 narrow playlist drag/quick-edit fixes pass current component and native browser checks. ENV216original full-run contention/diagnostic failures are resolved through exact repairs. ENV218–222connection reset, consent fixture, browser-lane classification, moved mutant target and omitted outline example are verified by current retained proofs. ENV223 staged server ownership/restart and ENV224 legal hydration readiness are verified; all 86 original regression locations now pass.

No release waiver or fabricated historical Red is recorded. Current defect/evidence review preserves the twelve historical task obligations and the independent ENV-011 exception; see the authoritative [defect log](defect-log.md).

## Risks, Exceptions, and Limitations

- T247 requires purpose-created ChatGPT/Claude connector accounts, authenticated Codex host setup and an isolated reachable HTTPS deployment. Local SDK/Chromium evidence does not replace the four named-host journeys or prove their destructive-confirmation UI.
- Original connected-app UI/action and playlist-create chronology exceptions, missing raw provider-schemaRed and initial-Green benchmark provenance require explicit review. Current passing tests do not recreate past evidence.
- GitHub CI has been wired and inspected locally; an external workflow execution has not been triggered or claimed.
- Ordinary Drizzle migration generation remains owned by the post-merge master workflow. MCP must be enabled with the resulting schema available; no feature-branch generated migration or production database push.

## Environment and Tooling

Bun 1.4.2, Node 22.23.3, TypeScript 6.0.3, Next 16.3.6, Better Auth and its MCP/OAuth/CIMD/passkey/Drizzle adapters 1.7.7, official MCP server/client 2.3.0. Isolated loopback PostgreSQL with separate per-probe databases; no production credentials or provider APIs substituted for named-host acceptance.

Jest budgets detect effective CPU, cgroup/available RAM and PostgreSQL connection capacity per phase. Ordinary workers cap 8, native database workers cap 4, strict timing runs use 1. Browser server heap respects available memory and caps 12 GiB. Native probes are compiled once; exact affected failures are rerun instead of another unrelated 4,000-test sweep. Original browser stages remain serial and ATDD is sharded with owned server restarts.

## Release Recommendation

**No-Go** until required real-host evidence and historical workflow review are resolved. All locally executable behavior checks and final report/format verification pass. This is a verification verdict, not a claim that the 15 tools are unimplemented. Continue all locally actionable work; keep genuine external blockers at the end of tasks.

## Approvals

No deployment, push, publish, generated migration or release approval has been performed. Existing release-owner review requirements remain unchanged; no additional approval flow is introduced.

## Required Checks

- [x] Current raw regression failures, repairs, coverage and local acceptance are separately recorded.
- [x] Exact709local scenario locations and per-source/global thresholds are verified.
- [x] Native authentication/backend policy evidence is distinguished from real-host acceptance.
- [x] Original browser regressions and final types/lint/format gates complete.
- [x] Fourteen genuine remaining task blockers are individually recorded and moved to the end.
- [x] Final defect/report/registry/gate review records No-Go for required host/history evidence.

Individual blockers and required actions: [blockers.md](blockers.md). No current tool implementation is left missing. Final source-hash audit shows76source/config entries unchanged; the only changed snapshot entry is the explicitly tested sharp lockfile patch. Browser evidence redaction audit checks1,980small raw artifacts,redacts fixture JWTs in one embedded failed report and confirms zero retained traces.
