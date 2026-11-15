# TDD cycle log

Baseline: master 0de55083. This ledger preserves observed execution, not retrospective chronology claims. Raw owner logs are retained in [evidence](evidence/). Temporary absolute log paths inside those logs identify original executions.

| Slice | Observed Red | Green / outcome |
| --- | --- | --- |
| U1 machine OAuth/admin isolation | Five auth cycles and administrator-role mutant in awards-auth-cycle.log | Whole auth files pass; removed-role mutant detected and restored. Lazy database bootstrap regression reproduced then fixed. |
| U2 grant lifecycle | awards-grants-red2.log: nine failed, two passed; exact expiry and authority assertions | Grant, storage and admin whole files pass in final 276-test run. |
| U3 gateway | awards-gateway-red2.log rejects allowed request; awards-review-red.log records seven failed authority/error assertions | Token, bounded input, final authority, rate and safe errors pass. |
| Operator provisioning | awards-cli-red.log; admin cleanup and redirect regression Reds | Secure files, no credential output, compensating cleanup and provider-compatible provisioning pass. |
| HTTP and account export | awards-http-red.log (JSONP); awards-export-red.log | Strict MIME and creator-owned account export pass. |
| U4 SDK | awards-sdk-cycle.log records missing-module, 12 configuration guards, 15 HTTP/error assertions, four private-host guards, two typed errors | SDK 43 tests pass within final focused run. Additional defensive characterization tests are test-after, explicitly identified in owner log. |
| U5 Awards CLI | No initial Red: first 11 CLI tests were added after prototype | TEST_AFTER exception remains open; 13 packaging/CLI checks pass. Runtime failures do not rewrite this chronology. |
| A1 containers | Real packaging/provider/bootstrap failures documented in owner logs | Actual two-project Docker acceptance passes: signed OAuth/JWKS, private DBs, cross-DB denial, revoke and 18 security assertions. |
| Coverage inventory | awards-coverage-inventory-red.log: one failed, 30 passed | 31 tests pass; unchanged thresholds and complete source inventory. |

Setup calibration excluded from intended Red: consumed Response mock, malformed Jest matrix, sandbox TypeScript lookup, and initial PGlite callback deadlock. Native OAuth bootstrap ECONNREFUSED was a real regression caused by eager policy DB import; moving import after actor verification restored existing native workflows (75 tests).

The original CLI test-after delivery cannot be repaired by manufacturing a later Red. See verification.md and defect TDD-001. Full CI/merged coverage/build remain separate required gates, not implied by local green checks.

Final defensive characterization: failing stream cancellation during abort/oversized upload preserves the original safe error. Added against existing handlers; no test-first implementation claim.

Retained terminal logs have trailing spaces stripped for repository whitespace hygiene; assertion text and execution results are preserved.
