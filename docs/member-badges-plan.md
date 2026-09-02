# Clipify Member Cards and badges

## Naming

- **Member Card** is the personal, shareable identity card.
- **Badges** are the user-facing recognition system. This fits permanent statuses such as Founder as well as earned milestones.
- Awarded badges can appear on the Member Card and Creator Page.

## Phase 1: foundation (this branch)

- Add a stable member number for new registrations without guessing numbers for legacy accounts.
- Reuse the existing `users.created_at`; do not add a second join-date field.
- Add an empty badge catalog and an award join table. No badges or awards are seeded.
- Add a premium public Member Card page, authenticated and public image endpoints, a social-share menu, PNG download, and Creator Page badges. The dashboard Member Card is the home for the badge collection; Settings links there instead of duplicating it.
- Add internal idempotent definition/grant/revoke functions for future billing and admin workflows.

The singleton member-number allocator is declared in the Drizzle schema so CI can generate it. On first allocation it reserves a fixed legacy range using the greater of the current population and highest existing number. Every allocation atomically increments its persisted high-water mark using PostgreSQL ON CONFLICT; later user deletions or backfills never shrink the reservation or reuse numbers. Existing accounts remain `NULL` until the legacy backfill is reviewed. A member number of `0` is the explicit fallback for legacy accounts whose order cannot be reconstructed. Positive values are unique; multiple legacy accounts may safely use `0`. Failed or concurrent duplicate signups can leave harmless gaps; numbers are permanent, not a live population count.

This schema replaces the unmerged sequence-based prototype. If that prototype has already been deployed to any persistent environment, review historical issued numbers before initializing the new allocator; surviving user rows cannot reconstruct deleted issued numbers. Never delete or reset the allocator row.

PostgreSQL does not retain a reliable, automatic row-creation timestamp when the schema did not store one. System columns such as `xmin` identify row versions/transactions, are affected by updates and vacuum/freeze behavior, and must not be used as durable membership order.

The card displays the stored `users.created_at` independently of member-number assignment. Migration 0005 populated older accounts with its execution timestamp (`DEFAULT now()`); this is not evidence of their original signup order.

Public URLs use `/members/<derived-uuid>` and `/api/member-card/public/<derived-uuid>`. The UUID is deterministically derived from `users.id`: SHA-256 of the UTF-8 string `clipify:member-card:v1:<user-id>`, truncated to 128 bits with UUIDv8 version and RFC variant bits set. The namespace and algorithm are permanent URL-contract constants, not secrets. No card-ID column, secret key, extension, or backfill is needed. Existing and future users derive the same identifier in application code and PostgreSQL, independent of username changes or member-number assignment. Username and raw Twitch-ID URLs do not resolve. This replaces the earlier random UUID proposal; preview links generated under that proposal change.

Public lookup compares the derived UUID in PostgreSQL, without loading all user IDs into the application. This is a computed scan, not a primary-key lookup; revisit an expression index if population or request volume warrants it. No opt-in or privacy settings are added: anyone with the URL can view the card, and enabled Creator Pages link to it. Pages request no search indexing, but UUIDs and noindex are not access controls. Someone who knows the derivation and a Twitch ID can compute the URL; preventing that is explicitly not the goal.

## Phase 2: legacy member-number backfill

1. Export legacy accounts with Twitch ID, username, available Clipify timestamps, Twitch account creation date, and any older operational evidence.
2. Produce a proposed deterministic ordering, then manually resolve accounts whose Clipify `created_at` was introduced by the historical migration.
3. Assign `0` to accounts whose relative order cannot be supported by evidence.
4. Dry-run uniqueness and range checks. Reconstructed accounts use positive values within the fixed legacy range; newer allocated accounts remain above that range.
5. Apply the reviewed mapping in one transaction using the included `member-badges-backfill.sql` runbook and retain the reviewed input as an audit artifact outside the application repository.
6. Only after this backfill, use member ordering as evidence for Founder eligibility.

The SQL runbook locks the allocator before the users table, seeds the reservation if needed, rejects changes to assigned numbers, and never resets the counter. It can be rerun with the same mapping, including legacy zero values.

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
