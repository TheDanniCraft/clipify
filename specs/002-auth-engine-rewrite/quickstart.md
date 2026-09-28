# Quickstart: Planning-to-Implementation Handoff

This document describes the developer and rehearsal workflow after `/speckit.tasks` creates implementation tasks. The `auth:*` commands are stable entry points; their implementations are added by the migration tasks and must fail closed until then.

## Prerequisites

- Bun 1.4.2 or a compatible 1.4.x release and Node.js 24.x (Next.js also supports Node.js `>=20.9.0`)
- Disposable PostgreSQL with credentials that cannot connect to production
- Test credentials for Twitch, Stripe, and UseSend or deterministic adapters
- Stable WebAuthn RP ID/origin for passkey acceptance tests
- An anonymized legacy snapshot and a 2× generated dataset

Pin Better Auth and every Better Auth companion package to the reviewed exact version. Generate its Drizzle schema using the pinned tool, review the diff, and commit migrations; do not rely on preview `push` or production startup to perform the data backfill.

For ordinary schema work, update the Drizzle schema and commit no locally generated migration artifacts. After merge, `.github/workflows/migrations.yaml` runs `bun run db:generate` once on `master` and commits the resulting migration. Never run migration SQL or `db:push` manually against production. `bun run db:push` is reserved for the disposable development database and receives its connection through Infisical. Handwritten SQL for behavior Drizzle cannot model requires separate explicit review and must not be mixed into locally generated output.

## Rehearsal isolation rules

Every rehearsal database must be created specifically for the run, use a distinct database name and least-privilege credentials, and be disposable without affecting any shared environment. The cutover CLI must reject a production hostname/database fingerprint, missing environment marker, or absent backup attestation. Never paste database credentials into command arguments, evidence, logs, or committed files.

Use only one of these data sources:

1. An anonymized snapshot whose direct identifiers and credentials have been irreversibly replaced. Record its checksum and anonymization procedure in the run evidence.
2. A deterministic synthetic dataset containing at least 2× the current production row counts for creators, editors/team mappings, resources, subscriptions, entitlements, and provider credentials. Synthetic credentials must be non-routable and unusable against Twitch, Stripe, or UseSend.

Before each run, prove the target is disposable, record its database fingerprint, and verify that outbound provider calls are disabled or routed to deterministic adapters. Production databases and production-derived snapshots containing live personal data or secrets are never valid rehearsal targets.

## TDD loop

```powershell
bunx jest test/auth-engine-rewrite/unit/<behavior>.test.ts --runInBand
bunx jest test/auth-engine-rewrite/unit/<behavior>.test.ts --runInBand
bunx jest test/auth-engine-rewrite --runInBand
```

The first run must fail for the intended missing behavior, the second pass after the smallest change, and the feature regression remain Green after refactor. Record all three results in PR evidence.

## Local quality checks

```powershell
bun run test
bun run test:coverage
bun run test:atdd
bun run test:bdd
bun run test:acceptance
bun run test:compliance
bun run app:lint
bun run app:prettier:check
bun run app:typecheck
bun run app:build
bun run app:check-action-manifest
bun audit --audit-level=high
```

Update [test-traceability.md](./test-traceability.md), [defect-log.md](./defect-log.md), and [test-summary.md](./test-summary.md) from actual evidence; never change `Planned` to Green without a reproducible result.

## Migration rehearsal

1. Restore the anonymized snapshot into disposable PostgreSQL and record its checksum.
2. Run planned `bun run auth:migrate -- --dry-run ...`; review blocking anomalies and predicted counts.
3. Produce a verified backup attestation for the disposable database.
4. Enable test maintenance mode and run planned `--apply`.
5. Run planned `--validate`, `--smoke`, and `auth:legacy-check`.
6. Run `--apply` again and assert zero duplicates/unexplained changes.
7. Repeat against the 2× dataset; confirm total time fits the proposed production window with 25% headroom.
8. Exercise explicit failure injection at every checkpoint and resume. Confirm no code path restores a database automatically.

Store setup evidence under `specs/002-auth-engine-rewrite/evidence/setup/` and per-run migration evidence under `specs/002-auth-engine-rewrite/evidence/migration/<run-id>/`. Evidence may contain counts, hashes, timings, and redacted errors, but never database URLs, tokens, OTPs, invitation secrets, or personal data.

## Required manual observations

- A migrated creator signs in again and sees unchanged resources/subscription/entitlements.
- A valid pre-cutover overlay still loads and subscribes while dashboard auth is unavailable.
- An editor becomes an Operations member without gaining billing/team/deletion authority.
- Twitch credential refresh is serialized and writes only Better Auth account storage.
- Removing Pro never deletes a resource.
- Agency revocation blocks the next operation even with the same session.
- Deletion suspension and every notification boundary use controlled time and dedupe exactly once.

## Production cutover outline

Communicate the maintenance window, verify the pre-rehearsed image and migrations, enter maintenance, stop conflicting background workers, create and verify the full backup, run the exact reviewed cutover command, inspect the manifest/invariants/smoke evidence, then explicitly reopen. On failure, remain in maintenance and decide whether to fix-forward or separately authorize restore. Do not improvise a restore inside the migration command.
