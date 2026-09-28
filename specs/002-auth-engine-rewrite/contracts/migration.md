# Contract: Auth Cutover Workflow

## Command surface

Planned package commands:

```text
bun run auth:migrate -- --dry-run --source <database-url> --artifact-dir <path>
bun run auth:migrate -- --apply --run-id <id> --backup-attestation <path>
bun run auth:migrate -- --resume --run-id <id>
bun run auth:migrate -- --validate --run-id <id>
bun run auth:migrate -- --smoke --run-id <id>
bun run auth:legacy-check
```

Credentials are supplied through secret environment/configuration, never CLI values or logs. Production `--apply` requires maintenance mode, the exact dry-run source fingerprint, a verified fresh backup attestation, and explicit operator confirmation. Restore has no command in this workflow; it follows a separately authorized runbook.

## Phases and checkpoints

1. `preflight`: versions, schema, secrets, Twitch/Stripe/UseSend reachability policy, disk/DB capacity, maintenance capability.
2. `backup_verified`: validate artifact timestamp, checksum, restore drill reference, and source fingerprint.
3. `identity`: person/provider/session target mappings and uniqueness.
4. `creator_accounts`: one organization/owner/link per Creator Profile.
5. `memberships`: editors to Operations membership or explicit anomaly.
6. `credentials`: in-memory decrypt/re-encrypt and scope/expiry validation.
7. `domain_invariants`: resources, secrets, subscriptions, entitlements, counts, ownership.
8. `switch`: enable Better Auth runtime, disable dashboard JWT/custom refresh/editor authorization.
9. `smoke`: sign-in, authorization allow/deny, overlay HTTP/WebSocket, credential refresh, subscription/entitlement state, outbox.
10. `reopen`: only after every blocking invariant and smoke check passes.
11. `contract`: later removal of legacy structures after zero-dependency scan.

Each phase uses deterministic idempotency keys and transactional batches. Completed checkpoints replay as no-ops. A blocking error leaves maintenance active and preserves the originating failure in redacted output.

## Mandatory invariants

- 100% accounting of eligible creators, editors/pending anomalies, provider accounts, resources, subscriptions, entitlements, and overlay fixtures.
- Creator/resource IDs, owner IDs, overlay secrets/URLs, Stripe references, and entitlement sources compare byte-for-byte where applicable.
- Exactly one Creator Account per Creator Profile and one owner membership agreeing with the identity link.
- No duplicate Twitch provider subject, membership, invitation acceptance, agency link, allocation, or resource.
- Migrated Twitch credentials remain encrypted, preserve required scopes/expiry, and pass one serialized refresh test.
- Rerun/resume creates zero duplicates and no unexplained updates.
- Legacy dashboard JWT, editor authorization, custom Twitch refresh, and destructive downgrade paths have zero production consumers before contract removal.

## Manifest

The final immutable manifest contains run/version/source/backup fingerprints, phase timings, row counts, anomaly dispositions, invariant and smoke results, application/schema versions, operator identity, and a checksum. It contains no credentials or personal mail content.
