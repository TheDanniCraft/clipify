# Clipify Member Cards and badges

## Naming

- **Member Card** is the personal, shareable identity card.
- **Badges** are the user-facing recognition system. This fits permanent statuses such as Founder as well as earned milestones.
- Awarded badges can appear on the Member Card and Creator Page.

## Phase 1: foundation (this branch)

- Add a stable member number for new registrations without guessing numbers for legacy accounts.
- Reuse the existing `users.created_at`; do not add a second join-date field.
- Define badge identity and presentation in the type-safe `badgeCatalog` code registry. The database stores only the generated badge enum and user awards; no badge catalog or awards are seeded automatically.
- Add a premium public Member Card page, authenticated and public image endpoints, a social-share menu, PNG download, and Creator Page badges. The account menu's **Badges** entry opens the Member Card and badge collection; Settings has no duplicate link or collection.
- Add internal idempotent grant/revoke functions for future billing and admin workflows.

The share menu offers link copying, LinkedIn, X, Discord-ready text, WhatsApp, and **Share via device…**. Device sharing uses the browser's native Web Share API (HTTPS and browser support required); unavailable/failed sharing falls back to copying the card link, then a selectable link if clipboard access fails. Cancelling the native picker does not copy or download anything. LinkedIn opens its URL composer and copies ready-to-paste post text; other text-capable destinations receive the community introduction plus a short explanation of Clipify. A failed post-text copy provides selectable text instead. Download remains a separate PNG attachment.

`member-badge-test.sql` is an optional, manually executed example for user `274252231`, not a migration or automatic seed. It grants the `beta-tester` badge as recognition only; it does not grant beta access or entitlements.

The code registry is authoritative for badge slugs, names, descriptions, Tabler icon keys, priority, and optional automatic conditions. `badgeSlugs` is derived from the registry keys and passed to Drizzle's `pgEnum`, so TypeScript and PostgreSQL accept the same values without duplicating a list. Conditions are declarative names whose exhaustive server-side resolver map contains the database query; raw SQL and executable functions do not live in the schema-imported catalog. The `user_badges` table stores only manual ownership and audit metadata. Condition-backed badges are resolved from their existing source of truth and are not duplicated as award rows. Adding or removing a registry entry is therefore a database schema change that CI must turn into a reviewed Drizzle migration; no migration is created manually in this branch. Rendering resolves all presentation metadata from code.

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

## Badge catalog

### Founder

- Eligibility: the first 100 registered Clipify accounts, based on the reviewed legacy ordering rather than Twitch account age.
- Permanence: never expires after award.
- Rollout: ensure the `founder` enum value is deployed, preview the exact 100-account grant list, then bulk-award with an auditable `source` such as `founder_backfill_2026`.
- Card behavior: highest display priority so `Founder` is the default card status.

### Founder Supporter

- Eligibility: a verified Clipify payment completed within the announced campaign/claim window.
- Permanence: the opportunity expires, but an awarded badge does not.
- Rollout: define the campaign's start/end timestamps and eligible Stripe products; award idempotently from verified billing data or a reviewed bulk job. Email copy should state the exact deadline and timezone.
- Abuse controls: never award from a client-side success page or an unverified email address; use the Stripe customer/account relationship already stored by Clipify.

### Clipify Partner

- Eligibility: a currently active, user-specific `pro_access` grant whose source is `partner`.
- Lifecycle: the badge is resolved automatically from the grant's start, end, and revocation state. Adding a partner grant makes it appear; expiring or revoking the grant removes it on the next read.
- Consistency: the Partner badge is not written to `user_badges`, and stale manual Partner rows are ignored, so the entitlement grant remains the single source of truth.
- Freshness: public card images use `no-store` because their URL is permanent while condition-backed status can change.

### Beta Tester

- Eligibility: people who actively tested and helped shape Clipify in its earliest phase.
- Permanence: remains as commemorative recognition after the beta closes.
- Rollout: award manually from a reviewed list, using `beta-tester` as the registry and PostgreSQL enum value.

### Contributor

- Eligibility: meaningful bug reports, feature ideas, product feedback, or other contributions that improved Clipify.
- Permanence: remains after it is awarded.
- Rollout: award manually with an auditable source describing the contribution or campaign.

## Follow-up admin UI

- Badge definitions remain code-reviewed in `src/app/lib/badgeCatalog.ts`; they are not editable through an admin UI.
- Single-account grant/revoke controls restricted to admins. The data model already records actor, source, and timestamp.
- Bulk grant import with validation, preview, idempotency, and a dry-run report.
- Optional user choice of featured badge once accounts commonly hold more than one.
