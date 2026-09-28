# Research: Creator Identity and Access Rewrite

**Date**: 2026-09-27  
**Status**: Complete for planning; implementation spikes remain explicit gates

## Better Auth boundary

**Decision**: Pin Better Auth 1.7.6 and compatible companion packages. Better Auth owns person records, provider accounts, Twitch OAuth, sessions, email OTP, passkeys, organizations, memberships, invitations, roles, auth-route rate limiting, and provider credentials. Clipify owns stable Creator Profiles, resources, ownership, subscriptions, entitlement composition, Creator/Agency classification, cross-account links, seat allocations, deletion lifecycle, audit semantics, and final authorization.

**Resolved package set**: `better-auth@1.7.6` and `@better-auth/passkey@1.7.6` are direct exact pins. The Drizzle adapter is bundled by `better-auth` as `@better-auth/drizzle-adapter@1.7.6`; it is not installed as a second direct dependency. Published 1.7.6 metadata accepts the repository's `drizzle-orm@^0.45.2`, `drizzle-kit@>=0.31.4`, `pg@^8`, Next.js 16, and React 19. The passkey package peers on Better Auth/Core `^1.7.6`, so the exact 1.7.6 pair prevents cross-release schema/plugin drift while satisfying the supported peer ranges.

**Rationale**: This uses the plugin for commodity identity/session work while keeping product-specific rules explicit. A Better Auth organization cannot alone express the creator-approved ceiling intersected with an agency member's role.

**Rejected**: Replacing `users.id` with Better Auth IDs would cascade through nearly all domain resources. Treating Clipify as an OAuth provider is unrelated to using Twitch as an OAuth client and remains out of scope.

**Sources**: [database](https://better-auth.com/docs/concepts/database), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [organization plugin](https://better-auth.com/docs/plugins/organization), npm registry metadata captured on 2026-09-27 for `better-auth@1.7.6` and `@better-auth/passkey@1.7.6`

## Stable creator identity

**Decision**: Keep the existing `users.id`—currently the Twitch user ID—as the Creator Profile ID and FK target. Create separate Better Auth person IDs and provider accounts where `providerId = twitch` and `accountId` is the Twitch subject. Link ownership through explicit Clipify mappings and owner membership.

**Rationale**: Overlays, playlists, galleries, runners, subscriptions, entitlements, settings, and billing already use this ID. A provider-neutral person may eventually manage multiple creator contexts.

**Rejected**: Provider columns such as `twitchId` and `kickId` on a Clipify user row hardcode providers and recreate identity-linking problems.

## Typed organization model

**Decision**: Back Creator and Agency Accounts with Better Auth organizations, classified by Clipify tables. A Creator Account has exactly one Creator Profile. Agency Accounts are administrator-provisioned after commercial agreement and link to independent Creator Accounts through accepted, revocable, permission-bounded links.

**Rationale**: Membership, invitation, and role infrastructure is shared while business ownership and creator licensing remain distinct.

**Rejected**: Putting creators inside the agency organization blurs ownership; charging for human members conflicts with creator-seat pricing.

## Server authorization

**Decision**: Every protected operation uses a Clipify `authorize` service. Direct access requires a current session, active Creator Account membership, the permission, matching Creator Profile/resource ownership, required entitlement, and active lifecycle. Agency access uses an accepted link and computes `agencyRolePermissions ∩ creatorApprovedCeiling` on every operation. Owners receive all applicable permissions; owner-only actions cannot be delegated.

**Rationale**: Current editor checks are duplicated. Live evaluation makes revocation effective without waiting for session expiry.

**Rejected**: Proxy/client checks are only navigation hints. Persisting effective agency permissions in a session would become stale.

**Sources**: [organization access control](https://better-auth.com/docs/plugins/organization), [Next.js integration](https://better-auth.com/docs/integrations/next)

## Sessions and freshness

**Decision**: Use revocable database sessions with cookie caching disabled initially. Require authentication within five minutes for ownership transfer, account deletion/recovery, provider disconnect, credential rotation, billing changes, and other destructive actions. Proxy logic may test cookie presence but never authorize.

**Rationale**: Immediate membership/link/deletion revocation is more important than avoiding one database lookup.

**Sources**: [session management](https://better-auth.com/docs/concepts/session-management), [Next.js security note](https://better-auth.com/docs/integrations/next)

## Twitch, email OTP, and passkeys

**Decision**: Creator onboarding starts with Better Auth's Twitch provider. Twitch's verified email is canonical for a linked creator and synchronizes on sign-in. Invited members use email OTP without Twitch. OTPs are hashed, valid for ten minutes, allow three attempts, and rotate on resend. Passkeys are optional alternate credentials.

**Rationale**: Creators need a Twitch channel, but managers may not have Twitch. Email OTP avoids passwords and supports invitations/recovery. Passkeys stay optional for usability.

**Rejected**: Email-first creator onboarding creates an unusable partial creator account and a confusing mandatory second step. Passwords and magic links are excluded.

**Sources**: [Twitch provider](https://better-auth.com/docs/authentication/twitch), [email OTP](https://better-auth.com/docs/plugins/email-otp), [passkeys](https://better-auth.com/docs/plugins/passkey)

## Provider credential migration

**Decision**: Encrypted Better Auth account storage becomes the sole Twitch refresh authority. Before bulk work, a blocking spike must prove on a restored fixture that legacy AES-GCM ciphertext using AAD `twitchUser:{creatorId}:oauth` decrypts in memory, re-encrypts to the exact pinned Better Auth format, reads successfully, refreshes once, and atomically persists rotation.

**Rationale**: Encryption compatibility cannot be assumed, Better Auth token encryption is off by default, and account schema behavior has changed across releases. Concurrent refresh authorities can invalidate rotating tokens.

**Rejected**: Long-lived dual read/refresh violates the clean cutover. Mandatory relinking is a last-resort business decision, not the plan.

**Sources**: [OAuth concepts](https://better-auth.com/docs/concepts/oauth), [options](https://better-auth.com/docs/reference/options), [1.7 account-schema incident](https://better-auth.com/blog/1-7-account-schema)

## Transactional email

**Decision**: Reuse the installed UseSend SDK behind a transactional-mail port separate from newsletter code. Write notification intent atomically with domain changes. A worker safely claims outbox rows across instances, sends idempotently by dedupe key, retries with bounded backoff, and dead-letters persistent failures. Stripe remains responsible for receipts, invoices, payment failures, and subscription cancellation mail; Clipify sends invitations, security, deletion/recovery, and agency allocation/access mail.

**Rationale**: Required notices need durable exactly-once intent and at-least-once delivery processing. A single owner per email class prevents contradictions.

**Rejected**: Direct sending inside state transactions loses or duplicates mail. SES/SMTP adds infrastructure with no current requirement advantage. Live Stripe settings need separate authorization.

## Downgrade safety

**Decision**: Replace destructive `reconcileFreeConstraintsIfNeeded` behavior with capability gating. Data over a free limit remains stored and may become read-only, disabled, or unavailable for new use according to a displayed matrix. Seven-day agency removal keeps the seat occupied, then removes only the funded entitlement source.

**Rationale**: Current code deletes excess overlays, playlists, clips, and editor relationships on downgrade, which violates FR-031 and makes recovery lossy.

**Rejected**: Immediate deletion/truncation cannot support cancellation, allocation grace, or recovery safely.

## Migration and operational model

**Decision**: Use committed additive migrations plus an explicit cutover CLI with preflight, dry-run, backup attestation, maintenance activation, checkpointed batches, validation, runtime switch, smoke tests, manifest, resume, and rerun. Restoration is never automatic. Contract migrations remove legacy tables only after dependency scanning and validation.

**Rationale**: The repository auto-runs Drizzle migrations in production and uses schema push in preview, but has no maintenance switch, backup gate, checkpoint model, or restore authorization boundary. A data backfill must not hide in container startup.

**Rejected**: One uncheckpointed startup migration is not safely resumable; indefinite legacy tables violate the requested outcome.

## Test database choice

**Decision**: Use PGlite for fast deterministic schema/migration/invariant tests and disposable PostgreSQL for locks, concurrent outbox claims, constraints, and cutover timing. Rehearse an anonymized production snapshot and a 2× synthetic set.

**Rationale**: PGlite fits current tests but cannot establish all real PostgreSQL concurrency and operational characteristics.

## Resolved unknowns

- UI uses “Creator Account”, “Agency Account”, and “team member”; it does not expose “organization” by default.
- Editors who never logged in are bound safely on provider authentication or invited by verified email. Unresolvable records become blocking or owner-remediation anomalies; no person is fabricated from a username.
- Shared PostgreSQL stores rate limits; process memory does not.
- Dashboard users sign in again after cutover; overlays continue because overlay secrets are separate.
- The special Twitch bot OAuth and controller/checkout capability JWTs are purpose-specific and reviewed separately; “remove legacy JWT” means the dashboard session JWT.
- Release performance uses measured full-snapshot time plus 25% headroom, not an invented throughput estimate.
