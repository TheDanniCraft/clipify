# Clipify Auth Production Cutover Handoff

This is the self-contained operator handoff for migrating Clipify production to
the Better Auth identity, session, credential, organization, and membership
runtime.

It contains no credentials, database URLs, personal data, backup archives, or
one-shot approvals. Those values must remain in Infisical or the operator's
protected filesystem.

## Current readiness

- Feature branch: `feature/auth-engine-rewrite`
- Latest retained remote-development rehearsal evidence:
  [`specs/002-auth-engine-rewrite/evidence/migration/ce41b141-ae1a-43c4-bbdd-ad7a040765ef/summary.md`](../specs/002-auth-engine-rewrite/evidence/migration/ce41b141-ae1a-43c4-bbdd-ad7a040765ef/summary.md)
- Production-shaped dump rehearsal: Green
- Two-times-production synthetic rehearsal: Green
- Actual remote development database cutover: Green
- Production database contacted: no

The exact production revision is not known until the feature pull request lands
on `master` and the `Generate Migrations` workflow commits the ordinary Drizzle
migration. Do not substitute the current feature commit for that final master
revision.

## Stop conditions

Stop and keep public traffic closed if any of these is true:

- the generated migration has not been reviewed;
- the checked-out commit differs from the reviewed production image commit;
- a fresh backup is missing, unreadable, stale, or has an unverified checksum;
- the dry-run source fingerprint changes after the backup attestation is made;
- any unexplained creator, editor, credential, resource, subscription, or
  entitlement count appears;
- any blocking migration anomaly exists;
- `validate`, `auth:legacy-check`, manual observations, or persisted smoke fails;
- the final manifest cannot be verified and retained.

Never use `db:push` against production. Never run a locally generated or
handwritten ordinary migration. Never restore automatically.

## One-page operator checklist

1. Merge the feature pull request into `master`.
2. Wait for `Generate Migrations` to commit exactly one ordinary migration.
3. Review the generated SQL and select the exact resulting master commit.
4. Create the release from that exact commit to build and publish the production
   image, but do not start it yet. Confirm image publication cannot automatically
   restart the production service.
5. Open a persistent remote shell such as `tmux`; use a trusted source checkout
   at the exact commit for the cutover CLI.
6. Confirm Infisical production secrets, Bun, PostgreSQL client tools, `jq`, disk
   space, and the artifact directory.
7. Announce maintenance, stop the frontend and conflicting workers, and leave
   PostgreSQL available.
8. Create a fresh custom-format backup, verify its checksum and archive listing,
   and retain the tested restore reference.
9. Run the reviewed ordinary migration with `bun run db:migrate`.
10. Run `auth:migrate -- dry-run`; inspect every count and anomaly.
11. Create the backup attestation bound to that exact dry-run fingerprint.
12. Set the separate apply approval and run `auth:migrate -- apply`.
13. Run `auth:migrate -- validate` and `auth:legacy-check`.
14. Start the new image while traffic remains closed and perform the manual
    sign-in, authorization, overlay, credential-refresh, billing, and mail
    observations.
15. Set the separate reopen approval and run `auth:migrate -- smoke` exactly
    once. This performs persisted smoke, writes the signed final manifest, and
    marks the run reopened.
16. Restore public traffic and workers only after the final command succeeds.
17. Retain the backup, attestation, dry-run manifest, final manifest, reviewed
    commit, generated migration hash, timings, and redacted logs.

## 1. Prepare the remote maintenance host

Use a persistent shell so a mobile-network or SSH disconnect does not terminate
the operation:

```bash
tmux new -s clipify-auth-cutover
```

The host needs:

- Git;
- Bun 1.4.x;
- Infisical CLI authenticated for Clipify production;
- PostgreSQL client tools compatible with PostgreSQL 17;
- `jq`, `sha256sum`, and enough protected disk space for the backup;
- network access to production PostgreSQL;
- a source checkout separate from the running application container.

The normal production image runs ordinary Drizzle migrations on startup, but it
does not contain Bun plus the TypeScript `auth:migrate` CLI. Run the cutover from
the exact source checkout on the maintenance host, not from the app container.

After the migration workflow has committed its output:

```bash
export CUTOVER_COMMIT='<exact-master-commit-containing-generated-migration>'
export CUTOVER_ROOT='/var/lib/clipify/auth-cutover'
export CUTOVER_ARTIFACT_DIR="$CUTOVER_ROOT/artifacts-$(date -u +%Y%m%dT%H%M%SZ)"
export CUTOVER_BACKUP="$CUTOVER_ROOT/clipify-before-auth-$(date -u +%Y%m%dT%H%M%SZ).dump"

mkdir -p "$CUTOVER_ARTIFACT_DIR"
chmod 700 "$CUTOVER_ROOT" "$CUTOVER_ARTIFACT_DIR"

git clone https://github.com/TheDanniCraft/clipify.git clipify-auth-cutover
cd clipify-auth-cutover
git fetch --all --tags
git checkout --detach "$CUTOVER_COMMIT"
test "$(git rev-parse HEAD)" = "$CUTOVER_COMMIT"
```

Do not place the artifact directory or backup inside the Git checkout.

## 2. Load production secrets without printing them

Start an Infisical-injected subshell using the production environment configured
for the deployment:

```bash
infisical run --env=prod -- bash
```

If the remote host requires an explicit project ID or path, use the same
Infisical project and secret path as the production Clipify deployment.

Confirm presence without printing values:

```bash
test -n "$DATABASE_URL"
test -n "$BETTER_AUTH_SECRET"
test -n "$DB_SECRET_KEY"
test -n "$HEROUI_AUTH_TOKEN"
```

Install the exact locked dependencies while the private HeroUI registry token
is available only to this subshell:

```bash
bun install --frozen-lockfile
```

Set only non-persistent, process-scoped cutover inputs:

```bash
export AUTH_CUTOVER_ENV=production
export AUTH_CUTOVER_PRODUCTION_APPROVED=1
export AUTH_CUTOVER_DATABASE_URL="$DATABASE_URL"
export AUTH_CUTOVER_ARTIFACT_DIR="$CUTOVER_ARTIFACT_DIR"
```

`AUTH_CUTOVER_PRODUCTION_APPROVED`, `AUTH_CUTOVER_OPERATOR_APPROVED`, and
`AUTH_CUTOVER_REOPEN_APPROVED` are one-shot operator approvals, not application
feature flags. Do not save them in Infisical.

## 3. Enter maintenance

Use the production platform controls to:

1. enable the maintenance response;
2. stop the frontend and all workers that can write to PostgreSQL;
3. keep PostgreSQL running;
4. confirm no preview or old deployment points at production;
5. record the application image and source commit currently deployed.

Check active sessions. Explain every remaining application session before
continuing:

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c '
SELECT pid, usename, application_name, client_addr, state,
       COALESCE(EXTRACT(EPOCH FROM (now() - xact_start))::bigint, 0)
         AS transaction_age_seconds
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
ORDER BY pid;'
```

Do not hold one long table or database lock across the cutover. Stop writers and
keep maintenance active instead; the migration needs its own transactions.

## 4. Create and verify the fresh backup

```bash
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --blobs \
  --verbose \
  --file="$CUTOVER_BACKUP"

pg_restore --list "$CUTOVER_BACKUP" >/dev/null
export BACKUP_SHA256="$(sha256sum "$CUTOVER_BACKUP" | awk '{print $1}')"
export BACKUP_BYTES="$(stat -c '%s' "$CUTOVER_BACKUP")"
export AVAILABLE_BYTES="$(df --output=avail -B1 "$(dirname "$CUTOVER_BACKUP")" | tail -1 | tr -d ' ')"

test -n "$BACKUP_SHA256"
test "$AVAILABLE_BYTES" -ge "$BACKUP_BYTES"
```

Store the checksum in the protected operator record. Do not paste the database
URL, tokens, personal data, or the dump into Git, chat, or public logs.

The restore-drill reference may point to the completed rehearsal of this exact
backup or to the approved recent same-version restore drill. It must be concrete
and auditable.

## 5. Apply the reviewed ordinary migration

Verify that the checked-out `drizzle/` directory contains the reviewed workflow
output. Then run:

```bash
bun run db:migrate
```

Stop if this differs from the reviewed SQL or reports an error. Do not continue
to the data cutover merely because some tables were created.

## 6. Create the dry-run manifest

```bash
bun run auth:migrate -- dry-run | tee "$AUTH_CUTOVER_ARTIFACT_DIR/dry-run.output.log"
```

The final JSON line provides:

- `runId`;
- `sourceFingerprint`;
- `manifestPath`;
- source counts.

Inspect every count. Record the three values without editing the manifest:

```bash
export AUTH_CUTOVER_RUN_ID='<runId-from-dry-run>'
export SOURCE_FINGERPRINT='<sourceFingerprint-from-dry-run>'
export AUTH_CUTOVER_MANIFEST_PATH='<absolute-manifestPath-from-dry-run>'
```

The expected production-shaped editor outcome from the retained dump was two
eligible Operations memberships plus one accepted deleted-account prune. A
missing creator or owner remains blocking. Current production data may differ;
all relationships must still be fully explained.

## 7. Create the fingerprint-bound backup attestation

Create this file outside the repository:

```bash
export AUTH_CUTOVER_BACKUP_ATTESTATION="$AUTH_CUTOVER_ARTIFACT_DIR/$AUTH_CUTOVER_RUN_ID.backup-attestation.json"

jq -n \
  --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg checksum "sha256:$BACKUP_SHA256" \
  --arg restoreDrillReference '<approved-restore-drill-reference>' \
  --arg sourceFingerprint "$SOURCE_FINGERPRINT" \
  --arg postgresServer "$(psql "$DATABASE_URL" -X -Atc 'SHOW server_version')" \
  --arg pgDump "$(pg_dump --version | head -1)" \
  --arg applicationCommit "$CUTOVER_COMMIT" \
  --argjson availableBytes "$AVAILABLE_BYTES" \
  --argjson requiredBytes "$BACKUP_BYTES" \
  '{
    createdAt: $createdAt,
    checksum: $checksum,
    checksumVerified: true,
    restoreDrillReference: $restoreDrillReference,
    sourceFingerprint: $sourceFingerprint,
    versions: {
      postgresServer: $postgresServer,
      pgDump: $pgDump,
      applicationCommit: $applicationCommit
    },
    availableBytes: $availableBytes,
    requiredBytes: $requiredBytes
  }' >"$AUTH_CUTOVER_BACKUP_ATTESTATION"

jq . "$AUTH_CUTOVER_BACKUP_ATTESTATION"
```

The attestation must be less than 24 hours old when `apply` starts. Its source
fingerprint must match the untouched dry-run manifest and current database.

## 8. Apply the data cutover

This is the first separate write approval:

```bash
export AUTH_CUTOVER_OPERATOR_APPROVED=1
bun run auth:migrate -- apply | tee "$AUTH_CUTOVER_ARTIFACT_DIR/apply.output.log"
unset AUTH_CUTOVER_OPERATOR_APPROVED
```

Expected output includes creator, owner, Operations, credential, anomaly, and
prune counts. Stop on any unexplained value.

If the process is interrupted, understand and correct the failure before using
the same run ID, manifest, attestation, and a new one-shot operator approval:

```bash
export AUTH_CUTOVER_OPERATOR_APPROVED=1
bun run auth:migrate -- resume | tee "$AUTH_CUTOVER_ARTIFACT_DIR/resume.output.log"
unset AUTH_CUTOVER_OPERATOR_APPROVED
```

Do not use `resume` as a substitute for investigating a failed invariant.

## 9. Validate before starting the application

```bash
bun run auth:migrate -- validate | tee "$AUTH_CUTOVER_ARTIFACT_DIR/validate.output.log"
bun run auth:legacy-check | tee "$AUTH_CUTOVER_ARTIFACT_DIR/legacy-check.output.log"
```

Require:

- `valid: true`;
- zero blocking anomalies;
- exact creator, owner, editor/prune, credential, resource, subscription, and
  entitlement accounting;
- no duplicate identities or memberships;
- zero production consumers of legacy dashboard JWT, editor authorization, or
  custom Twitch refresh paths.

Useful direct status check:

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "SELECT id, status, completed_at FROM public.migration_runs WHERE id = '$AUTH_CUTOVER_RUN_ID';"
```

## 10. Start the new image while traffic stays closed

Deploy/start the exact image built from `CUTOVER_COMMIT`, but leave the external
maintenance response active. Remember that the image startup command also runs
ordinary Drizzle migrations; at this point that should be a no-op.

Using an operator-only/private origin that does not reopen public traffic,
manually verify:

- an existing creator can complete Twitch sign-in;
- the owner sees unchanged resources, subscriptions, and entitlements;
- a migrated Operations member has the intended access but no billing/team/
  account-deletion authority;
- an existing overlay URL and secret work over HTTP and WebSocket;
- a Twitch credential refresh succeeds and writes only Better Auth account
  storage;
- allow and deny authorization paths behave correctly;
- transactional notification/outbox processing is healthy;
- removing paid access does not delete creator data.

Do not run the CLI `smoke` command during these preliminary observations. That
command is the final approved persisted smoke-and-reopen operation.

## 11. Perform the one-shot smoke and reopen

Only after all prior checks are Green:

```bash
export AUTH_CUTOVER_REOPEN_APPROVED=1
bun run auth:migrate -- smoke | tee "$AUTH_CUTOVER_ARTIFACT_DIR/smoke-reopen.output.log"
unset AUTH_CUTOVER_REOPEN_APPROVED
```

This command:

1. runs the persisted cutover smoke checks;
2. removes only accepted stale editor relationships;
3. writes the checksummed and HMAC-signed final manifest;
4. marks the run `reopened` with maintenance false.

Confirm persisted state:

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "SELECT id, status, completed_at FROM public.migration_runs WHERE id = '$AUTH_CUTOVER_RUN_ID';" \
  -c \
  "SELECT count(*) AS open_blockers FROM public.migration_anomalies WHERE run_id = '$AUTH_CUTOVER_RUN_ID' AND blocking = true AND status = 'open';"
```

Require `reopened`, a completion timestamp, and `open_blockers = 0`. Retain the
final manifest and verify its required fields before ending the maintenance
session:

```bash
export FINAL_MANIFEST="$AUTH_CUTOVER_ARTIFACT_DIR/$AUTH_CUTOVER_RUN_ID.final-manifest.json"
test -s "$FINAL_MANIFEST"
jq -e '
  .runId == env.AUTH_CUTOVER_RUN_ID and
  .status == "reopened" and
  (.checksum | length > 0) and
  (.signature | length > 0)
' "$FINAL_MANIFEST" >/dev/null
```

Only then remove the external maintenance response and restart all workers.

## 12. Failure and restore boundary

The cutover runner never restores automatically.

- Before `apply`: correct the problem, create a new dry-run if the source changed,
  and keep traffic closed.
- During/after `apply` but before reopen: keep traffic closed. Fix forward and use
  `resume` only when the cause is understood, or explicitly choose restoration.
- After reopen: do not restore reflexively. Assess writes made since reopen and
  choose a coordinated fix-forward or restore plan.

For an explicitly approved restore, stop every writer again and restore the
fresh custom-format backup according to the infrastructure's established
database replacement procedure. Do not restore over a database that is still
accepting application writes.

## 13. Post-cutover

- Monitor sign-in, session, authorization-denial, overlay, credential-refresh,
  billing, and outbox errors.
- Preserve the backup and evidence through the agreed rollback/soak period.
- Legacy `editors` and dashboard-token tables remain temporarily; the application
  must not consume them.
- Run `bun run auth:legacy-check` again after the soak period.
- Remove legacy tables only through the separately reviewed contraction pull
  request and the master-owned migration workflow.

## Secrets and artifacts that intentionally remain outside Git

These cannot and should not be placed in the repository:

- production `DATABASE_URL`;
- `BETTER_AUTH_SECRET` and `DB_SECRET_KEY`;
- the private-registry `HEROUI_AUTH_TOKEN` needed for a clean dependency install;
- Infisical credentials/service token;
- the production backup archive;
- backup attestation containing operator-local paths/reference details;
- dry-run and final manifests containing operational run metadata;
- HMAC manifest signature;
- raw logs that may contain infrastructure metadata;
- one-shot production, apply, and reopen approvals.

Everything else required to understand and execute the cutover is contained in
the repository at the reviewed production commit.
