# Twitch signup: application-owned setup

Better Auth owns `auth.user`, `auth.account`, OAuth tokens and sessions. Its
`account.create.after` hook calls `completeTwitchSignIn(creatorId, authUserId)`.
Returning Twitch callbacks call the same function; token refresh does not.

The function gets the access token through Better Auth, checks the matching Helix
profile and retrieves its authoritative Twitch creation date. First signup does
not require an existing Clipify identity link to retrieve that token.

`initializeCreator()` then uses one Drizzle transaction to:

1. Lock and validate the verified auth identity and its matching Twitch account.
2. Reject conflicting creator ownership or organization mappings.
3. Create the Clipify creator, organization, creator account, identity link and
   owner membership, or preserve their existing identities and status.
4. For a creator inserted by this transaction, allocate the member number, insert
   default settings and create the seven-day trial with its notification outbox.
5. Update the verified profile, genuine Twitch date and login timestamp.

All Clipify writes commit together. If setup fails, the auth records may already
exist, but the Clipify transaction rolls back. A subsequent Twitch callback uses
the same function to complete setup. Concurrent calls for one auth identity are
serialized by its database row lock. Existing paid plans, manual disables, custom
settings, member numbers and trial history are preserved. The pending field is
read only for compatibility with accounts left pending by the previous design;
new signup eligibility comes from the insert result, not a trigger-set flag.

Better Auth's `user.update.after` calls `syncCreatorProfile()` to synchronize
verified identities to their linked creator and organization. Newsletter contact
synchronization remains best effort after setup and observes recorded consent.

## Database deployment

Custom migration `0031_remove_auth_onboarding_triggers.sql` removes the old
creator-provisioning and profile-sync triggers and their functions. It runs once
through the existing production migration command before the application starts.
Fresh databases need no onboarding trigger. There is no startup installer and
no SQL implementation of onboarding kept as a fallback.

The old implementation depended on a manually installed trigger. The first
hotfix updated that trigger's TypeScript definition but did not deploy it.
Tests manually installed the desired definition, so they missed the actual
deployment gap. The revised suite runs committed migrations on empty disposable
databases, invokes the real Better Auth hooks, and models an upgrade that removes
old installed triggers before signup and profile update.

## Other flow findings

- Production has three notification triggers for entitlements, badges and account
  access. They overlap application helpers but are not Better Auth concerns.
  Removing them requires covering every grant, badge and disable/enable writer,
  including legacy actions and direct SQL. They are unchanged here.
- The earlier compensation SQL fires the entitlement trigger and queues a grant
  announcement. It does not suppress email. Do not use it unchanged if an operator
  will send the compensation announcement separately.
- Two production-only demo-overlay protection triggers are absent from migration
  history. They are unrelated to auth and are unchanged here.
- Migration 0030's timestamp predates 0029's. Drizzle compares timestamps, so a
  database already at 0029 can skip 0030. Production currently has its clip-cache
  index, but read-only DB permissions prevent checking the migration ledger.
  Published timestamps are unchanged; 0031 is later than both.

## Existing affected accounts

No production repair is included or executed. A read-only check on October 23
found 17 accounts missing member numbers; the old fixed list of 16 is outdated.
Select the repair cohort from October 2 through the verified effective deployment
of the working fix, not a GitHub release timestamp. Review missing fields
independently, preserve paid access and custom settings, and use a stable repair
identifier so the agreed 30-day compensation cannot be granted twice. Fetch any
historical Twitch dates from matching Helix profiles. Do not infer newsletter
consent. Keep the repair outside the application change.

## Local verification

106 affected unit tests and 11 PostgreSQL integration tests pass. The integration
suite replays migration history and tests hook-driven signup without auth
triggers, removal of old deployed triggers, rollback/retry, concurrency, profile
updates, preserved paid/manual-disabled accounts and membership roles, and member
number 1 on a fresh installation. Scoped lint and formatting pass. Whole-project
type checking remains blocked by existing consent-package/HeroUI dependency
errors and a stale generated route reference, outside the changed files. No
commit, push, production migration or repair has been executed for this revision.
