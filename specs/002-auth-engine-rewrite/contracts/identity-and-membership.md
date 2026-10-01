# Contract: Identity and Membership

## Authentication routes

- Better Auth is mounted at `/api/auth/[...all]` through the supported Next.js handler.
- Creator sign-up/sign-in begins with Twitch and requires the configured Clipify creator scopes.
- Email OTP is available to invited team/agency people and recovery flows, not as a way to create a creator without Twitch.
- Passkeys are optional alternate sign-in credentials and are never labelled as two-factor authentication by themselves.
- Legacy `/auth`, `/callback`, `/logout`, and the dashboard JWT cookie redirect or retire at cutover; purpose-specific bot OAuth remains a separate reviewed integration.

## Creator onboarding transaction

Input: successful Twitch provider assertion with required subject, verified email, profile, scopes, and encrypted credentials.

Atomic outcome:

1. Reuse the one Better Auth person/account for the Twitch subject, or create them.
2. Reject a subject/person conflict; never merge by email alone.
3. Reuse or create exactly one stable Creator Profile and Creator Account.
4. Create owner membership and creator identity link.
5. Synchronize Twitch-authoritative email/profile fields.
6. Emit audit history and the required welcome/security notification intent.

Retrying the callback is idempotent.

## Invitation API

`createInvitation(accountId, email, roles, delivery)` returns an invitation identifier, expiry, and one copyable URL. `delivery` is `copy` or `copy-and-email`; selecting email enqueues that same invitation rather than generating another.

Acceptance requires:

- pending, unrevoked, unconsumed invitation;
- current time before the seven-day expiry;
- authenticated, verified email matching the normalized bound address;
- active target account;
- roles valid for the target account type.

Consumption and membership creation are atomic. Replay, wrong email, expiry, revocation, and role invalidation fail without membership changes.

## Legacy editor binding

Migration creates an Operations membership when both sides of a legacy editor relationship still have Creator Profiles and the editor's migrated Twitch provider account uniquely proves the subject. If the editor Creator Profile no longer exists, migration records a redacted, non-blocking accepted stale-relationship disposition and deletes only that `editors` row inside the successful reopen transaction. If the creator/owner profile is missing, or an existing editor profile cannot be safely bound, migration remains blocked. No unverified username/email creates an active person.

## Agency provisioning/linking

- Only a Clipify administrator can provision an Agency Account.
- The designated owner receives an email-bound invitation and activates through email OTP.
- A proposed creator link contains an explicit permission ceiling.
- Only the Creator Account owner can accept/reduce/revoke it; acceptance never transfers ownership.
- Agency staff operate transitively and do not receive duplicate Creator Account memberships.
