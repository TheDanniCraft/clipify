# PR519 static review ledger

Baseline: b8b72b27. All scanner outcomes below remain pending a fresh run.

| Finding | Original location                                            | Category                                                                 | Local work                                              |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| CF01    | src/server/runner/schedules.ts:246                           | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF02    | test/support/mcp/runner-commercial-transitions-probe.ts:216  | Complex Method                                                           | Pending                                                 |
| CF03    | packages/runner/src/index.ts:520                             | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF04    | packages/runner/src/execution-runtime.ts:40                  | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF05    | src/server/runner/benefits.ts:15                             | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF06    | src/server/runner/branding-profiles.ts:65                    | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF07    | test/support/mcp/runner-commercial-probe.ts:6                | Complex Method                                                           | Pending                                                 |
| CF08    | test/support/mcp/runner-branding-probe.ts:5                  | Complex Method                                                           | Pending                                                 |
| CF09    | packages/runner/src/execution-runtime.ts:299                 | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF10    | test/support/mcp/runner-multistream-media.ts:36              | Complex Method                                                           | Pending                                                 |
| CF11    | src/server/runner/admission.ts:41                            | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF12    | packages/runner/src/execution-journal.ts:8                   | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF13    | src/server/resources/runners.ts:253                          | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF14    | src/server/runner/destinations.ts:204                        | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF15    | src/server/runner/lease.ts:39                                | Complex Method                                                           | Pending                                                 |
| CF16    | packages/runner/src/engine.ts:550                            | Complex Method                                                           | Pending                                                 |
| CF17    | test/support/mcp/runner-free-pro-probe.ts:116                | Very Complex Method                                                      | Pending                                                 |
| CF18    | packages/runner/src/schedule-cache.ts:206                    | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF19    | src/server/mcp/tools.ts:24                                   | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF20    | src/server/runner/destinations.ts:72                         | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF21    | packages/runner/src/schedule-cache.ts:129                    | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF22    | src/server/runner/schedules.ts:524                           | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF23    | packages/runner/test/support/drain-probe.mjs:5               | 'dirname' is defined but never used. (@typescript-eslint/no-unused-vars) | Refactor in progress; owning checks recorded separately |
| CF24    | packages/runner/run-coverage.mjs:15                          | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF25    | test/support/mcp/runner-destinations-probe.ts:31             | Very Complex Method                                                      | Pending                                                 |
| CF26    | test/support/mcp/runner-manual-configuration-probe.ts:8      | Complex Method                                                           | Pending                                                 |
| CF27    | test/support/mcp/runner-commercial-transitions-probe.ts:6    | Complex Method                                                           | Pending                                                 |
| CF28    | packages/runner/src/engine.ts:851                            | Complex Method                                                           | Pending                                                 |
| CF29    | test/support/mcp/runner-presentation-provider-preload.mjs:21 | Complex Method                                                           | Pending                                                 |
| CF30    | packages/runner/test/support/drain-probe.mjs:155             | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF31    | test/support/mcp/runner-schedule-continuity-probe.ts:12      | Complex Method                                                           | Pending                                                 |
| CF32    | packages/runner/src/protocol.ts:239                          | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF33    | packages/runner/src/protocol.ts:82                           | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF34    | test/support/mcp/runner-schedule-contract-probe.ts:10        | Very Complex Method                                                      | Pending                                                 |
| CF35    | src/server/runner/lease.ts:179                               | Complex Method                                                           | Pending                                                 |
| CF36    | scripts/check-mcp-coverage.mjs:96                            | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF37    | test/support/mcp/runner-free-boundary-probe.ts:11            | Complex Method                                                           | Pending                                                 |
| CF38    | packages/runner/src/protocol.ts:297                          | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF39    | src/server/resources/runners.ts:300                          | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF40    | packages/runner/src/protocol.ts:44                           | Complex Method                                                           | Refactor in progress; owning checks recorded separately |
| CF41    | test/support/mcp/runner-multistream-probe.ts:10              | Complex Method                                                           | Pending                                                 |

## Security disposition

The current pull-request-head intake contains15 open alerts. Three SHA256 alerts concern token/cache identity or integrity; static triage finds no password verifier. Twelve generated test-module alerts are being addressed by static shim modules with protected JSON configuration. No alerts have been dismissed and no scanner rules disabled. Fresh CodeQL is required.

## Qualification

The runtime CI on b8b72b27 passed, but it predates these refactors. Current whole-file checks include146 protocol/runtime/cache tests,27 heartbeat/CLI tests and69 admission tests. They do not replace the final full coverage, browser, build, type, lint, formatting, CodeFactor or CodeQL gates.
