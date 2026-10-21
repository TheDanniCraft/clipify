# Better Auth onboarding regression: before and after

## Root cause

The legacy `insertUser()` in `src/app/actions/database.ts` allocated the member
number, parsed Twitch Helix `created_at`, granted a reverse trial, created
settings with the signup consent/default visibility policy, and synchronized the
UseSend contact. Better Auth replaced this entry point with an `auth.account`
insert and `clipify_provision_twitch_creator()` in
`src/auth/onboarding-database-boundary.ts`. That trigger implemented identity,
creator, organization and owner membership creation, but omitted those business
initialization steps. Successful authentication therefore did not mean a complete
creator account.

The supplied production audit reports 16/16 missing trials, member numbers and
genuine Twitch dates, and 3/16 missing settings for October 2–20. These counts are
provided evidence, not a fresh production query performed for this patch.

## Why tests passed

The old `database.user.test.ts` exercises `insertUser()` with mocked persistence.
It can pass after production stops calling that function. More significantly,
the real Better Auth integration test in
`test/auth-engine-rewrite/integration/creator-onboarding-trigger.test.ts` asserted
only creator, organization, identity link and owner counts. A creator with no
trial, member number, settings or Twitch date satisfied its entire contract.
The suite was also conditional on `AUTH_TEST_DATABASE_URL` and could be skipped.
There was no test comparing the complete legacy signup contract to the new path.

The revised suite uses a disposable loopback database per case and checks the
real `createOAuthUser` path for mandatory settings, member allocation, the exact
seven-day trial, trial notification and a Helix creation date. The provider HTTP
response is a controlled fixture; Better Auth and database provisioning are real.
Missing database infrastructure now fails instead of silently skipping.

## Change inventory

| Behavior                     | Before hotfix                                                                    | Intended behavior after hotfix                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Trial                        | New trigger never grants one                                                     | Durable job initializes exactly once using the existing grant helper and notification outbox                      |
| Member number                | Omitted                                                                          | Existing persisted allocator, in the initialization transaction; existing numbers preserved                       |
| Settings                     | Created lazily on `getSettingsServer()`                                          | Created during initialization; conflict leaves customized rows unchanged                                          |
| Twitch creation date         | Database fallback May 1, 2016                                                    | Validated matching Twitch Helix subject and `created_at`; external failures remain retryable                      |
| Consent/contact              | Lazy settings read may synchronize                                               | Existing signup defaults recorded once; contact synchronization checks recorded consent and retries independently |
| Creator Page/community       | Depends on whether settings were read                                            | Explicit discoverable/community defaults match legacy signup; existing choices preserved                          |
| Welcome email                | Better Auth user hook already queues it                                          | Existing hook retained; no duplicate welcome added                                                                |
| Trial notices                | No trial means no notices                                                        | Existing `queueGrantEmails` transaction queues grant/reminder/expiry notices                                      |
| Profile refresh              | Verified auth-user trigger syncs name/email/avatar                               | Existing replacement retained                                                                                     |
| Returning login              | Account insert sets first login; session creation omitted returning-login update | Session hook updates `last_login` for linked creators                                                             |
| Automatic reactivation       | Existing callback hook restores `automatic` disables                             | Retained; manual disables remain preserved                                                                        |
| Legacy-null disable type     | Legacy code reactivated it; replacement only handles explicit automatic          | Behavior difference recorded; requires policy decision before broadening reactivation                             |
| Deletion recovery            | Separate lifecycle service                                                       | No automatic recovery or status reset added by onboarding                                                         |
| Dashboard/onboarding notices | Derived from entitlement and content-state records                               | Existing dashboard resolver retained; restored grants make trial content available                                |

The lazy settings path is a concrete explanation for partial settings coverage,
but attributing each of the 13 production rows to a specific request requires
production logs. The prior lazy upsert could also overwrite a concurrent
community preference; the hotfix changes that conflict to do nothing and reads
the actual winning row.

## Provisioning contract

An account insert that creates a genuinely new `public.users` row also inserts a
`creator_onboarding_jobs` row in the same transaction. Existing creators,
identity links, reconnects and provider updates do not create eligibility.
After Better Auth commits, the account hook consumes the job. A background
scheduler recovers interrupted jobs. A row lock serializes mandatory
initialization; number, settings, trial, trial outbox and completion either commit
together or roll back together. An expired/revoked trial history blocks another
trial through the existing helper. A paid plan does not receive a trial.

Profile and contact enrichment have separate completion timestamps. A five-minute
lease prevents ordinary multi-process duplicate work and permits recovery after
a crash. External requests can be retried without resetting mandatory records.
This is a reliable deferred provisioning contract, not a claim that an external
Twitch/UseSend request participates in the OAuth database transaction. Monitor
pending jobs and repeated attempts; do not disable background jobs in production.

## Deployment and review

1. Review the schema and trigger changes together. The repository's Generate
   Migrations workflow owns generation of the new table migration after merge.
   No generated migration has been hand-written by this hotfix.
2. Apply that generated schema migration before installing the updated trigger
   and enabling the job consumer. The production trigger is an installed database
   object: changing the TypeScript installer alone does not update it.
3. The trigger installer must run inside an explicit transaction and be reviewed
   as a database deployment step. Do not run `db:push` against production.
4. Verify a controlled new creator through the actual OAuth callback and inspect
   member number, settings, trial period, outbox and job completion. Reconnect the
   same account and confirm those IDs and trial dates stay unchanged.
5. Accounts created between schema/application/trigger rollout steps belong in a
   separately reviewed repair cohort. Do not infer eligibility on every login.

Production repair and trigger installation have not been executed by this patch.

## Existing-account repair: dry run and rollback

`scripts/audit-auth-onboarding.ts` starts a read-only transaction and outputs the
exact cohort IDs, missing fields, consent evidence, trial history, active grants
and agency access. It defaults to October 2 inclusive through October 21
exclusive in UTC; pass explicit bounds if the incident cohort uses another zone.
It has no mutation mode. Review its output against the expected 16 accounts and
also reconcile active billing subscriptions before approving trial candidates.

Recommended repair procedure, separately reviewed:

1. Freeze an explicit account allowlist and save before-images of users, settings,
   entitlements and relevant outbox rows. Recheck every predicate under row locks
   when applying; a dry-run decision is not authorization to overwrite newer data.
2. Allocate only missing member numbers through the existing allocator. Never
   reset its high-water mark, fill historical gaps or change existing numbers.
3. Insert only missing settings using conflict-do-nothing. Do not infer marketing
   consent for historical accounts lacking a recorded consent event; choose and
   document the repair defaults separately. Do not create newsletter subscriptions
   during the core repair.
4. For free creators with no previous reverse trial, paid subscription, active
   grant or agency Pro allocation, propose a fresh seven days starting at the
   approved repair time. Review that start time and eligibility list explicitly.
   Grant with the existing helper and queue its usual notifications atomically.
5. Fetch each matching Twitch subject from Helix; update only missing/fallback
   dates with a valid authoritative date. Leave unavailable results pending.
6. Compare post-repair rows against the reviewed report and run the report again.
   Repetition must propose no duplicate trial, settings or member allocation.

Rollback: disable the job consumer first if needed; retain the new table and
allocator. Restore the reviewed prior trigger definition transactionally.
Reverse only rows/fields created or changed by the repair whose current values
still match its recorded after-image. Revoke an erroneous grant and cancel its
unsent notices with an audit trail; never blindly delete entitlements. Do not
recycle allocated numbers. An already delivered email cannot be rolled back.

## Outstanding verification

Local validation on October 21: 97 affected unit tests and all 13 onboarding
integration tests passed against disposable PostgreSQL, including simultaneous
Better Auth signups, initialization rollback, expired-trial retry, preservation
of settings and member numbers, existing paid/manual-disabled identity linking,
and recovery from a mismatched Twitch profile. Scoped ESLint and Prettier pass.
Provider HTTP responses are fixtures; no production account was used.
The read-only cohort report also passed against a seeded disposable database,
including a check that reporting left the account unchanged.

The full TypeScript check reports missing downloaded HeroUI Pro modules in
unchanged UI files and a stale `.next/dev/types` reference to a removed route.
The public HeroUI Pro package on this PC contains metadata but no component
artifacts, and no `HEROUI_AUTH_TOKEN` is present. These errors block the required
pre-commit typecheck; the hook has not been bypassed. Full coverage, build and
browser release gates have not been completed.

- Fresh production cohort counts, installed trigger definition and schema version.
- Actual Twitch/UseSend responses, consent evidence, delivery and retry monitoring.
- Full OAuth browser journey, browser-level concurrency, disabled-account and
  deleted-account recovery scenarios on the deployed release candidate.
- Full required merge gates: coverage, owning scenarios, browser tests, lint,
  formatting, type checking and production build.
- Legacy-null automatic reactivation policy and any intentional differences from
  the old login side effects.

Prevent recurrence by making complete creator-account invariants the release
contract, checking them through the entry point production actually invokes, and
requiring a side-effect parity checklist for future authentication migrations.
