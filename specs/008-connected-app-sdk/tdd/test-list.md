---
feature: connected-app-sdk
profile: .specify/memory/tdd-profile.md
---

# Test list

## Outer loop

| ID  | Behavior                                                                                                                            | Trace                                      | Owner                                                   | State |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- | ----- |
| A1  | Standalone container searches authorised creator using real token/gateway and its own private database; deny foreign/revoked access | US1..3 FR-001..008 SC-001..004 EC-001..007 | native integration + Docker smoke (BDD/ATDD equivalent) | Green |

## Inner loops

| ID  | Observable behavior inventory                                                                                                                                                                          | Trace                      | State             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ----------------- |
| U1  | Own admin only; machine tokens exact resource/scope; existing user grants unchanged; non-admin machine/resource provisioning denied                                                                    | FR-001,002 EC-001,002      | Green             |
| U2  | Provision valid creator, reject disabled/missing; grant expires exactly at boundary; revoke idempotently; no user impersonation; audit contains no credentials                                         | FR-001,003 EC-002..004     | Green             |
| U3  | Validate token/type/audience/client and bounded payload, exact operation/creator; share cached search, preserve completeness/cursors; final expiry/revocation check, rate limit and safe outage errors | FR-003,004 EC-001,003..007 | Green             |
| U4  | SDK caches only valid short token, bounded timeout/response, no redirects or secret leaks, exact operation/input, abort/429/non-JSON/malformed/foreign-response rejection                              | FR-005 EC-001,005,006      | Green             |
| U5  | Self-contained package/image; private Compose DB; *_FILE secrets; own database connectivity and structured CLI errors with no HTTP audience endpoint                                                   | FR-006..008 EC-007         | Green; TEST_AFTER |

## Verification commands

PATH=/tmp/node-v26.13.0-linux-x64/bin:$PATH bun run test --runInBand --runTestsByPath <file> --coverage=false
Full coverage/build/types/lint/format: existing CI owners; container smoke added as required runtime evidence. Mutation tool unavailable: deliberate policy-boundary spot checks. No full local suite is required just to push.

Green means observed passing behavior. It does not certify test-first history: U5 initial CLI and later characterized defensive checks remain explicitly test-after. SC-004 complete CI is pending.
