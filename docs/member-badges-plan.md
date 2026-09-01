# Clipify Member Cards and badges

## Naming

- **Member Card** is the personal, shareable identity card.
- **Badges** are the user-facing recognition system. This fits permanent statuses such as Founder as well as earned milestones.
- Awarded badges can appear on the Member Card and Creator Page.

## Phase 1: foundation (this branch)

- Add a stable member number for new registrations without guessing numbers for legacy accounts.
- Reuse the existing `users.created_at`; do not add a second join-date field.
- Add an empty badge catalog and an award join table. No badges or awards are seeded.
- Add a premium public Member Card page, authenticated and public image endpoints, native sharing, PNG download, a settings Badges section, and Creator Page badges.
- Add internal idempotent definition/grant/revoke functions for future billing and admin workflows.

The member-number sequence is declared in the Drizzle schema so CI can generate it. Until backfill, every new registration receives the next sequence value plus the number of legacy `NULL` accounts, reserving the existing population's range without guessing its order. Existing accounts remain `NULL` until the legacy backfill is reviewed. A member number of `0` is the explicit fallback for legacy accounts whose order cannot be reconstructed. Positive values are unique; multiple legacy accounts may safely use `0`.

PostgreSQL does not retain a reliable, automatic row-creation timestamp when the schema did not store one. System columns such as `xmin` identify row versions/transactions, are affected by updates and vacuum/freeze behavior, and must not be used as durable membership order.

## Phase 2: legacy member-number backfill

1. Export legacy accounts with Twitch ID, username, available Clipify timestamps, Twitch account creation date, and any older operational evidence.
2. Produce a proposed deterministic ordering, then manually resolve accounts whose Clipify `created_at` was introduced by the historical migration.
3. Assign `0` to accounts whose relative order cannot be supported by evidence.
4. Dry-run uniqueness and range checks. Reconstructed accounts use positive values within the legacy range; newer sequence-assigned accounts remain above that range.
5. Apply the reviewed mapping in one transaction using the included `member-badges-backfill.sql` runbook and retain the reviewed input as an audit artifact outside the application repository.
6. Only after this backfill, use member ordering as evidence for Founder eligibility.

## Planned badges

### Founder

- Eligibility: the first 100 registered Clipify accounts, based on the reviewed legacy ordering rather than Twitch account age.
- Permanence: never expires after award.
- Rollout: create the `founder` definition, preview the exact 100-account grant list, then bulk-award with an auditable `source` such as `founder_backfill_2026`.
- Card behavior: highest display priority so `Founder` is the default card status.

### Founder Supporter

- Eligibility: a verified Clipify payment completed within the announced campaign/claim window.
- Permanence: the opportunity expires, but an awarded badge does not.
- Rollout: define the campaign's start/end timestamps and eligible Stripe products; award idempotently from verified billing data or a reviewed bulk job. Email copy should state the exact deadline and timezone.
- Abuse controls: never award from a client-side success page or an unverified email address; use the Stripe customer/account relationship already stored by Clipify.

### Beta Access

- Eligibility: participation in a specifically named Clipify beta, using an explicit allow-list or recorded beta enrollment.
- Permanence: keep it as a commemorative badge after the beta closes.
- Rollout: defer until beta enrollment has a reliable source of truth; create one badge per meaningful beta only if users should distinguish them.

## Follow-up admin UI

- Badge definition management with immutable slugs and configurable display priority. The internal service functions already exist in `src/server/membership.ts`.
- Single-account grant/revoke controls restricted to admins. The data model already records actor, source, and timestamp.
- Bulk grant import with validation, preview, idempotency, and a dry-run report.
- Optional user choice of featured badge once accounts commonly hold more than one.
