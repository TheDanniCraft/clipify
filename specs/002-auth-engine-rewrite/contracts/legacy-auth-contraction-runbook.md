# Legacy Auth Contraction Runbook

This runbook governs removal of the legacy `editors`, `tokens`, and completed
cutover-state tables. It is not a migration and does not authorize production
schema changes.

The contraction happens in a separate, operator-approved, post-cutover pull
request. That pull request removes the legacy table definitions from
`src/db/schema.ts`; the `Generate Migrations` workflow on `master` owns the
ordinary Drizzle migration generation. Feature branches must not create or edit
generated files under `drizzle/`.

## Entry criteria

- [ ] The Better Auth expand/backfill/verify/switch cutover completed successfully.
- [ ] Clipify reopened on the Better Auth runtime and completed the agreed live soak period.
- [ ] The final cutover manifest checksum and source fingerprint are verified.
- [ ] `bun run auth:legacy-check` reports zero production editor and custom-refresh consumers.
- [ ] Every eligible legacy editor relationship has a real Operations membership, every deleted-editor residue has an accepted prune disposition and was removed at reopen, and pending safe-auth anomalies are zero.
- [ ] Better Auth account storage is the sole Twitch refresh authority.
- [ ] Creator/resource IDs, ownership, overlay secrets/URLs, subscriptions, and entitlements retain exact parity.
- [ ] A fresh production backup has a verified checksum and tested restore reference.
- [ ] The operator explicitly approves the destructive contraction pull request.

## Contraction pull request

- [x] Remove `editorsTable`, `tokenTable`, and completed cutover-state tables from `src/db/schema.ts`.
- [x] Remove migration-only code that is no longer required after the retained evidence period.
- [x] Remove the one-time cutover CLI, rehearsal seed, legacy scan, maintenance gate, package commands, migration fixtures, and cutover-only tests.
- [x] Preserve the atomic Twitch onboarding database boundary and Better Auth credential coverage as permanent auth infrastructure.
- [ ] Do not add, edit, or promote a handwritten or locally generated migration under `drizzle/`.
- [ ] Merge only after the entry criteria and destructive schema diff receive human review.
- [ ] Confirm the `Generate Migrations` workflow creates exactly one ordinary migration from the final schema diff on `master`.
- [ ] Review the generated SQL and metadata; require only the intended legacy table and dependent-object removals.

## Rehearsal after generation

- [ ] Restore the final anonymized snapshot into a newly created disposable PostgreSQL database.
- [ ] Apply every migration through the generated contraction migration using the normal migration runner.
- [ ] Run the permanent auth integration, authorization, provider credential, and application smoke suites and require all checks Green.
- [ ] Verify Twitch sign-in/refresh, owner and Operations access, overlay continuity, subscriptions, entitlements, and notification delivery.
- [ ] Verify the generated migration cannot affect a database whose source fingerprint differs from the reviewed target.
- [ ] Record timings, invariant counts, migration hash, application/schema versions, and redacted errors in the rehearsal evidence.

## Production execution

- [ ] Announce the short contraction maintenance window.
- [ ] Enter maintenance mode and stop conflicting workers.
- [ ] Create and verify a fresh backup; never rely only on the earlier cutover backup.
- [ ] Confirm the deployed application version has zero legacy consumers before applying the generated migration.
- [ ] Apply the reviewed generated migration through the normal production migration runner.
- [ ] Run the same validation and smoke suite used during rehearsal.
- [ ] Reopen only after all checks are Green.
- [ ] On failure, remain in maintenance and choose fix-forward or separately authorize restore; never restore automatically.

## Completion evidence

- [ ] Production no longer contains `public.editors` or `public.tokens`.
- [ ] The final legacy scan reports zero findings.
- [ ] The contraction manifest, generated migration hash, backup attestation, smoke evidence, and operator approval are retained without secrets or personal data.
- [ ] The SpecKit defect log, traceability matrix, test summary, and rolling aggregate reflect the completed contraction.
