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

2026-11-16 CI repair: reproduced native discovery/resource-seed failures (2 failed,24 passed) and missing connected-app result in runner gate fixture (1 failed). Updated expected advertised grants, assert exact two distinct resource identifiers under concurrent startup, and supply/assert mandatory CONNECTED_APPS result in gate test. Green:26 native contract tests;11 native CI-policy tests. No production authorization checks or thresholds changed. Rebased onto master a0d9510c before repair.

## Standalone website integration follow-up (2026-11-16)

Added explicit `resolve_clip` and `get_clip_playback` grant operations and SDK 0.2 methods. The new clip-read tests first failed because the module did not exist; operation tests then failed for unsupported operations. Green evidence: 250 tests across 15 affected suites, including legacy Twitch actions, SDK, gateway/grants and native consent/OIDC contracts (`/tmp/gateway-full-slice.log`). Playback resolution moved from the existing excluded legacy action into a server-only module; the public action retains its original authorization checks. No caller-controlled application bypass was added.

Identity isolation tests failed for missing identity scopes/reference bypass and leaking MCP claims before implementation (`/tmp/gateway-identity-red.log`). Native authorization-code/PKCE, signed ID token, UserInfo, callback rejection and public identity-registration rejection pass against disposable loopback PostgreSQL (`/tmp/gateway-identity-native.log`). Native fixture cleanup initially leaked the separately imported application pool; it now closes both pools. This integration probe was added after the options implementation and does not establish test-first chronology for that integration behavior.

The earlier TDD-001 chronology exception remains disclosed and unresolved. Live deployment, independent-site browser acceptance and current-source CI remain required; this evidence does not certify release readiness.

CI follow-up: resource-seeding race acceptance now expects the identity resource as well as MCP/machine resources. The container job exposed a stale tarball hash after SDK source formatting; regenerate the single SDK lock entry from a clean cache and verify the actual artifact hash. Two-project Docker acceptance now passes all 18 security checks. CodeQL flagged the native test's URL prefix assertion; compare parsed URL origins instead. No security alert was suppressed and no threshold was lowered.

## Preview OAuth URL length regression (2026-11-16)

A real Awards → PR569 → Twitch redirect reproduced an 8,571-byte authorization
URL (8,122 bytes of state), exceeding CloudFront's 8,192-byte URL limit. The
provider client already preserves the signed authorization request in OAuth
server context; duplicating it in our error callback inflated the proxy's nested
encrypted state. The focused component test first failed because that callback
still contained the full signed query (`/tmp/login-414-red.log`).

Keep only a short retry reference in the error callback, with its signed login
query held in tab-local session storage for ten minutes. Restore signed parameters
before the provider client's next request. Missing/expired/damaged storage fails
closed with an actionable restart message; no shared credentials, callback
registration or provider signature/PKCE/state checks change.

Green: 30 tests across the three owning login files, lint and TypeScript. The
whole real-component login browser file passes all five scenarios, including
light/dark mobile/desktop layouts and provider cancellation followed by retry.
The initial dev-server cold consent compilation timeout is setup evidence, not
an intended Red; its warmed whole-file run passed. The new browser test also
needed to wait for the failure navigation's load before retrying hydration.
A live request using the shortened callback produced a 5,587-byte URL and Twitch
HTTP302 instead of414. Logs: `/tmp/login-414-green.log`,
`/tmp/login-414-browser-green.log`; no user OAuth state was copied into the repo.
The existing TDD chronology exception remains unchanged. CI and deployed-head
verification remain separate gates.
