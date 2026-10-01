# Production-shaped rehearsal 55047955-b73e-4bbe-943f-e1c038df26a2

Historical result: superseded by the approved deleted-editor disposition and
Green rerun `7e075732-4e0a-47a8-8537-2e94dcb08097`.

Date: 2026-09-29

Environment: isolated database on the Infisical `dev` PostgreSQL server

Production database contacted: no

## Source and restore

- Source archive SHA-256: `3dd334d93bfda69a8cb8d0c33e7819f505f00b1da6a32492ebe06f9ca448f6d9`
- Source PostgreSQL: 16.15; rehearsal PostgreSQL: 17.10; pg_dump: 17.4
- Restore completed into a new database with 32 application/migration tables.
- Source fingerprint: `sha256:107d051f90602dbdfa97911e099a6bb0938360305f46f66ac95fd2372703aeb4`
- Manifest checksum: `sha256:c44d01ed44b70129643bfebe45825703484488bb832ea620170a4842559a4d44`

## Baseline and preservation

| Entity                       | Before | After | Result    |
| ---------------------------- | -----: | ----: | --------- |
| Creators                     |    114 |   114 | Preserved |
| Legacy editor relationships  |      3 |     3 | Preserved |
| Legacy encrypted credentials |    114 |   114 | Preserved |
| Overlays                     |     84 |    84 | Preserved |
| Playlists                    |     14 |    14 | Preserved |
| Playlist clips               |    597 |   597 | Preserved |
| Galleries                    |      0 |     0 | Preserved |
| Runners                      |      1 |     1 | Preserved |
| Runner enrollments           |      1 |     1 | Preserved |
| Subscriptions                |      2 |     2 | Preserved |
| Entitlements                 |    118 |   118 | Preserved |

Deterministic full-row hashes matched for users, editors, legacy credentials,
overlays (including secrets), playlists/items, galleries, runners/enrollments,
and entitlements. The ten pre-existing subscription columns also matched. The
target schema adds only `latest_stripe_event_created = 0` to each subscription.

## Cutover result

- Initial apply using the development encryption key failed closed and rolled back all identity data.
- Resume using production-compatible encryption secrets remained bound to the rehearsal URL and completed all three checkpoints.
- Result: 114 creator identities, 114 owner memberships, 2 Operations memberships, 114 Better Auth Twitch credentials, and 1 blocking redacted anomaly.
- Idempotent resume: 29.956 seconds; zero duplicate provider accounts or memberships.
- Orphan creator accounts, identity links, and owned resources: zero.
- Better Auth credential decrypt and serialized-refresh suite: 3/3 Green.
- Legacy runtime consumer scan: Green.
- Validation: correctly blocked with `CUTOVER_INVARIANT_FAILED`; smoke/reopen was not authorized.

## Historical blocking disposition

One legacy editor Twitch subject has never created a Clipify user and has no
legacy credential. Safe migration therefore cannot fabricate a verified email
identity. The relationship remains present in `editors`, is represented by one
redacted blocking anomaly, and must be resolved by verified Twitch
authentication or explicit owner removal before Team-only retirement. The
operator subsequently approved treating an editor subject absent from `users`
as stale account residue; the superseding rehearsal proved its audited removal.
