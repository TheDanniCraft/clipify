# Production-shaped orphan-prune rehearsal 7e075732-4e0a-47a8-8537-2e94dcb08097

Date: 2026-09-29

Environment: isolated database on the Infisical `dev` PostgreSQL server

Production database contacted: no

## Source and backup

- Source archive SHA-256: `3dd334d93bfda69a8cb8d0c33e7819f505f00b1da6a32492ebe06f9ca448f6d9`
- Source fingerprint: `sha256:107d051f90602dbdfa97911e099a6bb0938360305f46f66ac95fd2372703aeb4`
- Restored source counts: 114 creators, 3 legacy editor relationships, 114 encrypted credentials, 99 resources, 2 subscriptions, and 118 entitlements.
- The verified backup attestation remained fresh and matched the identical archive checksum, source fingerprint, and completed restore drill.

## Cutover result

| Gate                                                        | Result                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Dry-run and checksum-bound manifest                         | Green                                                                                                          |
| Apply                                                       | Green: 114 creators/owners, 2 Operations, 114 credentials, 0 blocking anomalies, 1 approved stale-editor prune |
| Idempotent resume                                           | Green with identical counts and no duplicates                                                                  |
| Validate                                                    | Green with `2 Operations + 1 approved prune = 3 source relationships`                                          |
| Signed smoke/reopen                                         | Green                                                                                                          |
| Legacy runtime consumer scan                                | Green                                                                                                          |
| Production-compatible credential decrypt/serialized refresh | 3/3 Green                                                                                                      |

At successful reopen, the runner deleted only the accepted legacy relationship
whose editor subject had no `users` Creator Profile. Both eligible relationships
remained and have Operations memberships. The final manifest checksum is
`sha256:9c36569a94607042ecc1e7a71536d0b5024174801747081b54272d19636c3c41`;
the HMAC signature remains only in the uncommitted local run artifact.

## Preservation evidence

Deterministic full-row hashes and counts matched the untouched baseline for
users, encrypted legacy credentials, overlays (including secrets), playlists,
playlist items, galleries, runners, runner enrollments, and entitlements. The
ten pre-existing subscription columns also matched. The only legacy row change
was the approved editor relationship: `3 -> 2`. Final editor accounting was
`2 legacy rows / 2 Operations memberships / 1 accepted prune / 0 open blocking anomalies`.

The production-shaped schema/apply/validate/smoke path completed comfortably
inside the provisional five-minute window. The slower 2× rehearsal remains the
limiting measurement at approximately 101 seconds, leaving approximately 66%
time headroom; this is unused time capacity, not a probability of success.
