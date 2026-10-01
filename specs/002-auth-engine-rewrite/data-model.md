# Data Model: Creator Identity and Access Rewrite

## Ownership boundaries

Better Auth migrations own identity tables in PostgreSQL schema `auth`. Clipify domain tables remain in `public`. Existing `public.users.id` remains the stable Creator Profile identifier even though the table name is historical.

## Better Auth-managed records (`auth`)

| Entity       | Purpose and invariants                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| User         | Provider-neutral person ID and verified notification email projection. One person may have multiple credentials/providers. |
| Account      | Provider identity; Twitch unique on `(providerId, accountId)`. OAuth credentials encrypted at rest; one refresh authority. |
| Session      | Revocable database session with expiry and recent-authentication time. Suspended/deleted people have no usable session.    |
| Verification | Hashed email OTP/challenge with purpose, expiry, attempts, and one-time consumption; never plaintext in storage/logs.      |
| Organization | Identity/membership boundary backing either one Creator Account or one Agency Account, never both.                         |
| Member       | Active person membership and roles. Creator owner membership agrees with the Clipify ownership link.                       |
| Role         | Standard/custom subset of the applicable delegable catalogue. Owner-only actions cannot be encoded.                        |
| Invitation   | Email-bound, single-use offer expiring after seven days. Copy/email delivery reference one token.                          |
| Passkey      | Optional WebAuthn credential with stable RP/origins, counter, and revocation.                                              |
| Rate limit   | Shared Better Auth route counters by normalized identity/network signal and expiry.                                        |

## Existing records retained

`users` (Creator Profile), overlays, playlists, gallery items, runners, settings, subscriptions, subscription items, webhook claims, entitlement grants, and every current resource ID/FK remain stable. `editors` and custom `tokens` are migration sources only. A separately approved post-cutover schema pull request removes them after runtime reads/writes reach zero; the normal `master` workflow generates that contraction migration.

## New Clipify records (`public`)

### `creator_accounts`

`organization_id` (PK), `creator_id` (unique FK `users.id`), `status` (`active`, `suspension_scheduled`, `suspended`, `purge_eligible`), nullable `suspension_at`, nullable `purge_eligible_at`, timestamps.

Invariants: an organization has one classification; one Creator Profile has one Creator Account; the active owner membership agrees with `creator_identity_links`.

### `creator_identity_links`

`creator_id` (PK/FK), `auth_user_id` (indexed Better Auth user reference; not globally unique), `source` (`migration`, `twitch_onboarding`, `admin_repair`), timestamps. No link is inferred from email equality. Twitch provider uniqueness must agree with the Creator Profile subject.

### `agency_accounts`

`organization_id` (PK), `status` (`provisioned`, `owner_invited`, `active`, `suspended`, `closed`), nullable non-secret `commercial_reference`, `provisioned_by`, timestamps. Only trusted administration may create one.

### `agency_creator_links`

`id` (PK), agency organization, creator organization, `status` (`proposed`, `accepted`, `revoked`), validated `permission_ceiling`, acceptance/revocation actor and time, timestamps. One non-revoked link per pair. Revocation affects the next authorization even with a live session.

### `agency_license_allocations`

`id` (PK), `link_id`, `creator_id`, `status` (`active`, `removal_scheduled`, `ended`, `released_by_deletion`), `effective_at`, nullable request/end times, `source_reference`, timestamps. Active and removal-scheduled allocations consume one creator seat; human members consume none. Recovery does not recreate a released allocation.

### `account_deletion_requests`

`id`, account type/organization, `choice` (`paid_through`, `immediate`), `status` (`scheduled`, `suspended`, `recovered`, `purge_eligible`, `purged`, `cancelled`), request actor/time, suspension/purge boundaries, recovery actor/time, and a redacted Stripe state snapshot. Only one nonterminal request per account. Purge eligibility is actual suspension + 30 days. Recovery links navigate but never authenticate.

### `notification_outbox`

ID, event type, recipient/authority, template version/locale, non-secret payload, scheduled time, status (`pending`, `claimed`, `sent`, `retry`, `dead`), attempts, claim lease, provider message ID, redacted error, unique dedupe key. Domain change and outbox insertion are atomic. OTPs, OAuth/invitation/recovery tokens, overlay secrets, and credentials are prohibited in payload/logs.

### `audit_events`

Append-only ID/time, actor person/session/account context, target, action, outcome/reason, request correlation, minimized IP/user-agent values, and redacted metadata. Routine updates/deletes are denied; secrets are prohibited.

### `migration_runs`, `migration_checkpoints`, `migration_anomalies`

- Runs record version/mode/source fingerprint, backup attestation/checksum, state, app/schema versions, counts, invariants, smoke results, and manifest checksum.
- Checkpoints use run + phase + cursor uniqueness, counts/checksum/status, and replay completed work as a no-op.
- Anomalies record redacted source/category, blocking state, and resolution. An editor with a retained Creator Profile but no safely bindable identity is blocking. An editor relationship whose editor Creator Profile no longer exists receives a non-blocking accepted `orphan-editor-pruned` disposition and is deleted only at successful reopen; identities are never fabricated.

## Permission catalogue

- `account:read`, `account:update`, `account:export`
- `member:read`, `member:invite`, `member:update`, `member:remove`
- `role:read`, `role:create`, `role:update`, `role:delete`
- `creator:read`, `creator:update`, `creator:connect`, `creator:disconnect`
- `overlay:create`, `overlay:read`, `overlay:update`, `overlay:delete`, `overlay:control`, `overlay-secret:read`, `overlay-secret:rotate`
- `playlist:create`, `playlist:read`, `playlist:update`, `playlist:delete`, `playlist-items:manage`, `playlist:control`
- `gallery:create`, `gallery:read`, `gallery:update`, `gallery:delete`, `gallery:publish`
- `runner:create`, `runner:read`, `runner:update`, `runner:delete`, `runner:control`, `runner-credential:read`, `runner-credential:rotate`
- `analytics:read`, `analytics:export`
- `integration:read`, `integration:connect`, `integration:disconnect`, `integration:reauthorize`
- `subscription:read`, `subscription:manage`, `subscription:cancel`
- `billing:read`, `billing:manage`, `audit:read`
- `agency:read`, `agency:update`, `agency:link-creator`, `agency:unlink-creator`, `agency:allocate-license`, `agency:revoke-license`

`account:delete`, ownership transfer, Agency Account provisioning, forced purge, and restore authorization are internal owner/operator policies and cannot appear in roles or ceilings.

## Standard roles

| Role            | Scope                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Owner           | All account-applicable permissions plus owner-only operations                                                          |
| Operations      | Existing editor-equivalent resource operation, excluding member/role/billing/subscription/deletion/ownership authority |
| Content manager | Playlist item and gallery management without infrastructure/team authority                                             |
| Analyst         | Analytics/audit read and permitted exports                                                                             |
| Billing manager | Subscription/billing read/manage/cancel, not account deletion                                                          |
| Custom          | Owner-selected subset of delegable permissions                                                                         |

## State transitions

```text
Invitation: pending -> accepted | revoked | expired
Agency link: proposed -> accepted -> revoked
Allocation: active -> removal_scheduled -> ended
                         \-> released_by_deletion
Deletion: scheduled -> suspended -> purge_eligible -> purged
             |             |
             +-> cancelled +-> recovered
Migration: created -> preflighted -> backup_verified -> migrating
           -> validated -> switched -> reopened -> contracted
           any blocking failure -> maintenance_blocked
```

Transitions use compare-and-set/version checks and create audit/outbox records atomically. Clocks are injected in tests.

## Migration mapping

| Legacy source                 | Target/rule                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users.id`                    | Preserve as Creator Profile ID exactly                                                                                                                                                                                         |
| Creator Twitch subject        | Unique Better Auth Twitch account; conflict blocks cutover                                                                                                                                                                     |
| Creator                       | Person + Creator organization + owner membership + identity link; rerun duplicates none                                                                                                                                        |
| `editors(user_id, editor_id)` | Operations membership when both Creator Profiles exist; otherwise an accepted stale-editor removal at successful reopen when only the editor profile is absent. Missing owner profiles block; email identity is never guessed. |
| Encrypted `tokens`            | In-memory decrypt/re-encrypt into Better Auth account; no plaintext persistence/log; old refresh disabled at switch                                                                                                            |
| Overlay/resource FKs/secrets  | No change                                                                                                                                                                                                                      |
| Subscription/entitlement rows | No change; validate referential and effective-state parity                                                                                                                                                                     |
| Dashboard JWTs                | No target; intentionally invalid after switch                                                                                                                                                                                  |

## Purge ordering

Permanent erasure is a separately authorized, idempotent operation after `purge_eligible_at`: create the minimal lawful audit tombstone, revoke sessions/credentials, remove personal notification data under retention rules, delete eligible domain data, then remove identity/membership data where permitted. A backup restore never runs automatically; retention exceptions appear in the purge manifest.
