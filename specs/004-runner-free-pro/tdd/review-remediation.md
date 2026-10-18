# PR519 static review ledger

Current published source: `4be68ca3`. CodeFactor passes with zero issues and zero annotations (check 117659385846). All 41 baseline findings and the intermediate anonymous OS-shim warning are cleared. Full source/runtime evidence and the remaining CodeQL disposition are recorded below.

| Finding | Original location                                            | Category                                                                 | Local work                                          |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------- |
| CF01    | src/server/runner/schedules.ts:246                           | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF02    | test/support/mcp/runner-commercial-transitions-probe.ts:216  | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF03    | packages/runner/src/index.ts:520                             | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF04    | packages/runner/src/execution-runtime.ts:40                  | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF05    | src/server/runner/benefits.ts:15                             | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF06    | src/server/runner/branding-profiles.ts:65                    | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF07    | test/support/mcp/runner-commercial-probe.ts:6                | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF08    | test/support/mcp/runner-branding-probe.ts:5                  | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF09    | packages/runner/src/execution-runtime.ts:299                 | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF10    | test/support/mcp/runner-multistream-media.ts:36              | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF11    | src/server/runner/admission.ts:41                            | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF12    | packages/runner/src/execution-journal.ts:8                   | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF13    | src/server/resources/runners.ts:253                          | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF14    | src/server/runner/destinations.ts:204                        | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF15    | src/server/runner/lease.ts:39                                | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF16    | packages/runner/src/engine.ts:550                            | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF17    | test/support/mcp/runner-free-pro-probe.ts:116                | Very Complex Method                                                      | Cleared by published CodeFactor check on `4be68ca3` |
| CF18    | packages/runner/src/schedule-cache.ts:206                    | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF19    | src/server/mcp/tools.ts:24                                   | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF20    | src/server/runner/destinations.ts:72                         | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF21    | packages/runner/src/schedule-cache.ts:129                    | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF22    | src/server/runner/schedules.ts:524                           | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF23    | packages/runner/test/support/drain-probe.mjs:5               | 'dirname' is defined but never used. (@typescript-eslint/no-unused-vars) | Cleared by published CodeFactor check on `4be68ca3` |
| CF24    | packages/runner/run-coverage.mjs:15                          | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF25    | test/support/mcp/runner-destinations-probe.ts:31             | Very Complex Method                                                      | Cleared by published CodeFactor check on `4be68ca3` |
| CF26    | test/support/mcp/runner-manual-configuration-probe.ts:8      | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF27    | test/support/mcp/runner-commercial-transitions-probe.ts:6    | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF28    | packages/runner/src/engine.ts:851                            | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF29    | test/support/mcp/runner-presentation-provider-preload.mjs:21 | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF30    | packages/runner/test/support/drain-probe.mjs:155             | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF31    | test/support/mcp/runner-schedule-continuity-probe.ts:12      | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF32    | packages/runner/src/protocol.ts:239                          | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF33    | packages/runner/src/protocol.ts:82                           | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF34    | test/support/mcp/runner-schedule-contract-probe.ts:10        | Very Complex Method                                                      | Cleared by published CodeFactor check on `4be68ca3` |
| CF35    | src/server/runner/lease.ts:179                               | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF36    | scripts/check-mcp-coverage.mjs:96                            | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF37    | test/support/mcp/runner-free-boundary-probe.ts:11            | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF38    | packages/runner/src/protocol.ts:297                          | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF39    | src/server/resources/runners.ts:300                          | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF40    | packages/runner/src/protocol.ts:44                           | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |
| CF41    | test/support/mcp/runner-multistream-probe.ts:10              | Complex Method                                                           | Cleared by published CodeFactor check on `4be68ca3` |

## Security disposition

The fresh CodeQL check on f75e1091 clears all 12 generated-test-source alerts. Three high SHA256 classifications remain open. Static triage identifies random bearer-token/cache fingerprints and content integrity, not password verification; each use and its authentication boundary is documented in [security-alert-disposition.md](security-alert-disposition.md). No alert has been dismissed and no rule disabled. The final refactor checkpoint still needs fresh CodeQL.

## Qualification

The first published refactor checkpoint passes complete native coverage (450 cases and unchanged per-file thresholds), all six browser jobs, five application coverage lanes, builds, types, lint, formatting and the official five-platform native matrix. Its unit lane fails because an unrelated overlay-effects worker outlives a mocked startup fixture; the isolated repair passes29 cases across four whole files and awaits fresh complete CI.

Follow-up local checks pass376 server/commercial/branding/lease cases,69 destination/manual cases,201 schedule/admission cases,285 native unit cases, three real drain regressions and five real multistream workflows. These runs cover successive refactor checkpoints and are not summed as unique feature cases. Final affected-suite, complete native coverage, exact Free acceptance, strength, type, lint and formatting evidence is recorded separately. All required full CI and current-source platform gates remain mandatory. No assertion, coverage floor or scan threshold was weakened.

Final follow-up regression checkpoint: all312 cases in ten complete server owners pass, including the revised calendar/destination/commercial observers. Exact Free acceptance passes2/2 and real multistream delivery passes5/5, both with retries0. Application lint exits0 with five unrelated existing warnings; application and native types pass. The current mapping audit retains376 unique primary artifacts,1046 unique tasks and1041 completed tasks. Complete native coverage now passes52 suites,450 cases, its one inherited updater TODO and every configured per-file floor (aggregate S94.78/B90.41/F95.61/L97.53). All six refreshed invariant-fault checks are caught by their existing owners, every restored owner passes and every source/input hash is restored exactly. Full published qualification remains pending.

Current scanner checkpoint: CodeFactor 0 issues; CodeQL 12 generated-source alerts cleared, three non-password SHA256 classifications remain open (#24, #26 and #27; #27 replaces #25 after helper extraction). All three are not_actionable/high-confidence in the current source-bound triage. Automatic approval review rejects external dismissal without explicit user approval, so no state changes occur. See security-alert-disposition.md and github-disposition-proposal.json for the concrete proposed metadata changes.

Final complete CI verification: run 39122026804 passes every runtime job, all six coverage lanes, all six browser owners and the merged Test gate on `4be68ca3`. Downloaded application/native coverage artifacts both match the frozen 1660-input fingerprint; all 39 application/workflow and 13 native sources pass unchanged floors. CodeFactor remains zero. The only blocker is explicit approval of the three documented CodeQL false-positive dispositions; the proposed writeback was automatically rejected and no alert state changed.
