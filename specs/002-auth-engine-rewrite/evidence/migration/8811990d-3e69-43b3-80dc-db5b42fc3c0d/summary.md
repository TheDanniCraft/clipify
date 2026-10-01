# 2× synthetic rehearsal 8811990d-3e69-43b3-80dc-db5b42fc3c0d

Date: 2026-09-29

Environment: isolated database on the Infisical `dev` PostgreSQL server

Production database contacted: no

## Dataset and backup

- Synthetic, non-routable rows: 228 creators, 6 editor relationships, 228 encrypted credentials, 198 resources, 4 subscriptions, and 237 entitlements.
- Backup SHA-256: `f5d0e92d1f7827814d9db6300fa42560d6e96382fb3fc6b102a4d564af68d42d`
- Independent restore drill reproduced `228/6/228/198/4/237` exactly.
- Source fingerprint: `sha256:389ce0b603386dd5cfc737c28e14537bf34db50a971b233cb205648f68db35fc`

## Cutover evidence

| Gate                                 | Result                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Dry-run and checksum-bound manifest  | Green                                                                  |
| Backup attestation and restore drill | Green                                                                  |
| Apply                                | Green: 228 creators/owners, 6 Operations, 228 credentials, 0 anomalies |
| Apply time                           | 69.932 seconds                                                         |
| Idempotent resume                    | Green in 69.900 seconds                                                |
| Validate                             | Green with all persisted invariants                                    |
| Signed smoke/reopen                  | Green                                                                  |
| Repeated smoke                       | Same checksum and HMAC signature                                       |
| Duplicate provider accounts          | 0                                                                      |
| Duplicate memberships                | 0                                                                      |
| Completed checkpoints                | 3                                                                      |

The final manifest checksum is
`sha256:d6ac97641ebeb81791286e54522c1d67d4a8303460154a0d55f9f3d7f81977ee`.
The HMAC signature remains only in the uncommitted local run artifact.

Using a conservative 101-second schema/apply/validate/smoke path, a provisional
five-minute maintenance window has approximately 66% headroom, exceeding the
required 25%. The production window remains subject to operator approval.
