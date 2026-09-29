# Contract: Auth Cutover Workflow

## Command surface

Package commands (all configuration and credentials are injected into the
process; no database URL or secret is accepted as an argument):

```text
bun run auth:migrate -- dry-run
bun run auth:migrate -- apply
bun run auth:migrate -- resume
bun run auth:migrate -- validate
bun run auth:migrate -- smoke
bun run auth:legacy-check
```

`AUTH_CUTOVER_DATABASE_URL`, `AUTH_CUTOVER_ARTIFACT_DIR`, run/manifest paths,
and approval markers are process-scoped inputs. Rehearsal uses
`AUTH_CUTOVER_ENV=rehearsal` and a disposable database. Production requires
`AUTH_CUTOVER_ENV=production` plus the one-shot
`AUTH_CUTOVER_PRODUCTION_APPROVED=1`; apply separately requires
`AUTH_CUTOVER_OPERATOR_APPROVED=1`, and reopen requires
`AUTH_CUTOVER_REOPEN_APPROVED=1`. None of these approvals are persistent
application feature flags. Production apply remains bound to the exact dry-run
source fingerprint and a verified fresh backup attestation. Restore has no
command in this workflow; it follows a separately authorized runbook.

## Phases and checkpoints

1. `preflight`: versions, schema, secrets, Twitch/Stripe/UseSend reachability policy, disk/DB capacity, maintenance capability.
2. `backup_verified`: validate artifact timestamp, checksum, restore drill reference, and source fingerprint.
3. `onboarding_boundary`: idempotently install the reviewed Twitch-account provisioning and verified-profile synchronization functions/triggers in the same transaction as the backfill. Set the transaction-local backfill guard before identity rows are written.
4. `identity`: person/provider/session target mappings and uniqueness.
5. `creator_accounts`: one organization/owner/link per Creator Profile.
6. `memberships`: eligible editors to Operations membership; deleted-editor residue to an accepted, redacted prune disposition; all other unresolved relationships to a blocking anomaly.
7. `credentials`: in-memory decrypt/re-encrypt and scope/expiry validation.
8. `domain_invariants`: resources, secrets, subscriptions, entitlements, counts, ownership.
9. `switch`: enable Better Auth runtime, disable dashboard JWT/custom refresh/editor authorization.
10. `smoke`: sign-in, authorization allow/deny, overlay HTTP/WebSocket, credential refresh, subscription/entitlement state, outbox.
11. `reopen`: only after every blocking invariant and smoke check passes.
12. `contract`: later removal of legacy structures after zero-dependency scan.

Each phase uses deterministic idempotency keys and transactional batches. Completed checkpoints replay as no-ops. A blocking error leaves maintenance active and preserves the originating failure in redacted output.

The ordinary schema migration remains owned by the post-merge `master` workflow and must run before this cutover command. The custom onboarding boundary is not a generated `drizzle/` artifact: `auth:migrate apply` installs it transactionally immediately before the legacy backfill, so a failed installation or backfill rolls back both.

## Mandatory invariants

- 100% accounting of creators, eligible editor Operations memberships, accepted deleted-editor prunes, blocking anomalies, provider accounts, resources, subscriptions, entitlements, and overlay fixtures.
- Creator/resource IDs, owner IDs, overlay secrets/URLs, Stripe references, and entitlement sources compare byte-for-byte where applicable.
- Exactly one Creator Account per Creator Profile and one owner membership agreeing with the identity link.
- No duplicate Twitch provider subject, membership, invitation acceptance, agency link, allocation, or resource.
- Migrated Twitch credentials remain encrypted, preserve required scopes/expiry, and pass one serialized refresh test.
- Rerun/resume creates zero duplicates and no unexplained updates.
- Legacy dashboard JWT, editor authorization, custom Twitch refresh, and destructive downgrade paths have zero production consumers before contract removal.

## Manifest

The final immutable manifest contains run/version/source/backup fingerprints, phase timings, row counts, anomaly dispositions, invariant and smoke results, application/schema versions, operator identity, and a checksum. It contains no credentials or personal mail content.
