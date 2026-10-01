# Remote development cutover rehearsal ce41b141-ae1a-43c4-bbdd-ad7a040765ef

Date: 2026-10-01

Environment: actual remote development PostgreSQL database through Infisical

Production database contacted: no

## Backup and restore evidence

- A full custom-format PostgreSQL backup was created before mutation.
- Backup SHA-256: `2eabfa7a2aacc08d83f59826d1d86ace54210467d64e4ae46f829c85ffc8d91e`.
- Archive listing validation passed.
- A temporary same-server restore drill reproduced `3 users / 1 editor / 3 overlays / 3 legacy tokens / 3 Better Auth accounts` and the temporary database was removed.
- The fresh backup attestation was bound to source fingerprint `sha256:2a6a1b1a0f26f151f07d28b5853e160e523e1321f66b766cbe9816969dd47d50`.

The first post-restore count command had a local PowerShell quoting error around a reserved auth table name. The restore itself had completed and the `finally` cleanup removed the temporary database. The drill was repeated from database creation with a corrected non-reserved table query and passed; this was an operator-command defect, not a product, archive, or migration failure.

## Schema alignment

The permitted Infisical-backed development `db:push` completed successfully. It normalized two foreign-key constraint names plus existing array and timestamp defaults. No generated Drizzle migration artifact was created or modified.

## Cutover result

| Gate                         | Result                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Dry-run                      | Green: 3 creators, 1 legacy editor, 3 legacy tokens, 7 resources, 4 subscriptions, 3 entitlements |
| Apply                        | Green: 3 creators/owners, 1 Operations membership, 3 credentials, 0 anomalies, 0 prunes           |
| Idempotent resume            | Green with identical counts and no duplicates                                                     |
| Validate                     | Green with `valid: true`                                                                          |
| Legacy runtime consumer scan | Green                                                                                             |
| Approved smoke/reopen        | Green                                                                                             |
| Repeated reopened smoke      | Green with identical final checksum and signature                                                 |
| Direct persisted-state query | Green: reopened with completion timestamp and zero open blocking anomalies                        |

Persisted post-cutover counts were `3 users / 3 creator accounts / 3 identity links / 3 organizations / 4 memberships / 3 provider accounts / 1 retained legacy editor / 3 retained legacy tokens`. The four memberships are the expected three owners plus one Operations member.

The final manifest checksum is `sha256:7dff9d2c7aad6a09d4aff1d96c8a57e780bbaaa7bbb565b49dc9cffa05cd49d1`. The HMAC signature and raw operational artifacts remain outside Git.

## Scope note

This rehearsal proves the complete cutover runner against the actual remote development service, including network access, Infisical injection, backup/restore handling, persisted checkpoints, idempotency, validation, and reopen. It uses the permitted development `db:push`; the exact ordinary Drizzle migration generated after merge to `master` still requires its own reviewed restore rehearsal before production.
