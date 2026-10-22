# Twitch onboarding: before and after

Before the Better Auth migration, `/callback` exchanged the OAuth code and called
`setAccessToken()`. That fetched the Twitch Helix profile and called `insertUser()`.
For new users, `insertUser()` allocated a membership number, created the seven-day
trial and default settings, and synchronized the UseSend contact. The callback
then recorded the login and redirected to the dashboard.

The replacement account trigger created users and creator ownership, but omitted
those business initialization steps. Legacy unit tests still exercised
`insertUser()`. The real Better Auth integration test asserted only identity and
ownership rows, so it also accepted an incomplete account.

## Simplified fix

The Better Auth Twitch account hooks call `completeTwitchSignIn()` during account
creation and returning OAuth callbacks. Better Auth retains responsibility for
OAuth state, token storage and session handling.

The hook fetches the matching Twitch profile, then runs one database transaction:

- For a creator awaiting initial setup, allocate a missing membership number,
  insert settings without replacing existing rows, and grant the trial through
  the existing helper, including its notification outbox.
- Save the authoritative Twitch creation date, record the login and clear the
  pending flag. These writes commit or roll back together.

`users.onboarding_pending` defaults to false for existing creators. The account
trigger sets it to true only when inserting a genuinely new creator; reconnects
never reset it. It preserves first-signup eligibility if Better Auth commits its
account before our callback work fails. The next Twitch sign-in retries setup.
Existing trial history still prevents trial duplication or renewal.

There is no onboarding job table, lease, polling loop or scheduler change.
UseSend synchronization is best effort after database setup, observes the saved
consent choice and can be retried on a later sign-in. A failed Twitch profile
lookup or mandatory database setup fails the sign-in instead of silently
reporting a fully initialized account. Automatic retries while the user is absent
are intentionally not provided.

The entitlement and member-allocation helpers accept the current transaction so
their writes participate in this unit of work. Allocation rules and entitlement
resolution are unchanged. The Windows test-probe fix and adjacent lazy-settings
change have been removed from the hotfix.

## Deployment and existing accounts

The generated migration must add the pending flag before the reviewed trigger
definition is installed. The repository's migration workflow owns generation;
changing the TypeScript trigger installer does not replace the installed database
function. No production migration, trigger installation or repair has been run.

Existing affected creators remain a separate reviewed repair. Identify exact IDs
and missing fields with read-only queries, check paid/agency/granted access and
trial history, preserve existing settings and member numbers, and agree on a fresh
seven-day trial start for eligible users. Backfill Twitch dates only from matching
Helix profiles. Do not infer newsletter consent or automatically enroll accounts.
Save before-images and repair identifiers; never recycle allocated numbers.

## Validation

Regression tests cover the real Better Auth account path, seven-day trial and
notification creation, settings and membership allocation, concurrent signups,
initialization rollback, retry on the next sign-in, expired-trial preservation,
and existing paid/manual-disabled identity linking. Twitch HTTP responses are
controlled fixtures; databases are disposable and loopback-only.

The revised implementation passed 88 affected unit tests and all 13 disposable
PostgreSQL integration tests. Scoped lint passes. Local type checking still reports
the unchanged missing HeroUI Pro artifacts and stale generated route reference.
Fresh GitHub coverage, browser and build checks are required for this revision;
the earlier job-based implementation's CI results do not validate the revised code.
Live Twitch/UseSend behavior, production cohort counts and deployed
callback/recovery scenarios remain unverified.
