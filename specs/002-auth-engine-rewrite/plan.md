# Implementation Plan: Creator Identity and Access Rewrite

**Branch**: `feature/auth-engine-rewrite` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-auth-engine-rewrite/spec.md`

## Summary

Replace Clipify's custom Twitch OAuth, dashboard JWT, editor checks, and provider-token runtime with Better Auth as the identity, provider-account, session, membership, invitation, role, passkey, and auth-rate-limit infrastructure. Preserve `users.id` as the stable Creator Profile identifier and preserve every resource owner ID, public overlay secret, URL, subscription, and entitlement. Better Auth person IDs remain separate from Creator Profile IDs and Twitch subjects.

Creator Accounts and Agency Accounts are both Better Auth organizations, classified and connected by Clipify domain tables. Every protected operation uses one server-side policy evaluator: authenticated person + active direct membership or accepted agency link + required permission + Creator Profile ownership + active entitlement + lifecycle state. Agency access is the live intersection of the agency member's role permissions and the creator-approved link ceiling. Existing editors with retained Creator Profiles become operational team members. A stale relationship whose editor Creator Profile was deleted is recorded through a redacted accepted disposition and removed only at successful reopen; no person record is fabricated.

The cutover is an idempotent expand/backfill/verify/switch/contract workflow with a verified backup gate, maintenance mode, checkpoints, dry-run, production-shaped rehearsal, automated invariants and smoke tests, and no automatic restore. Dashboard sessions may expire at cutover; overlays and purpose-specific runtime credentials remain independent. The current destructive Pro downgrade reconciliation is removed before allocation or cancellation work and replaced with non-destructive capability gating.

## Technical Context

**Language/Version**: TypeScript 6 on Bun (tooling) and Node.js (standalone Next.js runtime)

**Primary Dependencies**: Next.js 16.3.x, React 19, Better Auth 1.7.6 (exact pin), Better Auth Drizzle/passkey companions resolved from the official 1.7.6 package metadata and recorded as exact pins before installation, Drizzle ORM 0.45.x, Stripe 22.x, UseSend 1.6.x

**Storage**: PostgreSQL; existing Clipify domain tables remain in `public`, Better Auth-managed tables live in an `auth` schema, and new Clipify authorization/lifecycle/outbox/migration tables live in `public`

**Testing**: Jest 30 + jsdom + PGlite for TDD/integration/migration tests; Playwright 1.63 + playwright-bdd 9.2 for ATDD/BDD; fast-check for authorization and idempotency properties

**Target Platform**: Linux container deployment of Next.js standalone output backed by PostgreSQL; current Windows development remains supported

**Project Type**: Full-stack Next.js web application with server actions, route handlers, scheduled workers, browser-source overlays, and a PostgreSQL migration/cutover CLI

**Performance Goals**: Local authorization evaluation p95 ≤100 ms and database-backed session resolution p95 ≤200 ms in production-shaped rehearsal; Twitch onboarding and invitation acceptance remain below the three-minute user outcome; full migration plus validation fits the announced maintenance window with at least 25% measured headroom

**Constraints**: No Creator Profile/resource ID rewrite; no plaintext provider secrets or OTPs; exactly one provider-token refresh authority; deny by default; no client-only authorization; no deletion on downgrade; no automatic database restore; no production Stripe setting mutation in this feature; no indefinite legacy runtime or compatibility tables

**Scale/Scope**: All current creators, editor relationships, provider credentials, owned resources, subscriptions, and entitlement grants; six user journeys, 31 functional requirements, 12 success criteria, and 15 edge cases

## Architecture Decisions

1. **Identity versus domain ownership**: Better Auth `user.id` identifies a person. Existing `users.id` remains the Creator Profile/ownership key and is never replaced with a Better Auth ID. An explicit creator identity link and Creator Account classification map the two domains.
2. **Account boundaries**: Better Auth organizations back both Creator and Agency Accounts. Clipify classification tables enforce exactly one Creator Profile per Creator Account and permit an Agency Account to link many independent Creator Accounts.
3. **Authorization seam**: Rewrite `validateAuth` as a temporary Better Auth-backed compatibility facade while routes migrate to `authorize(actor, creatorId, permission)`. Remove duplicate editor checks only after dependency scanning proves every protected operation uses the central evaluator.
4. **Sessions**: Use revocable database sessions with cookie caching disabled for the first release. Owner-only and destructive actions require a session authenticated within five minutes. Proxy checks are navigation hints only; server operations always resolve and authorize the session.
5. **Provider credentials**: Better Auth account storage becomes the sole Twitch refresh authority. The cutover includes a blocking compatibility spike to prove legacy AES-GCM credentials can be decrypted and re-encrypted into the exact pinned Better Auth format without exposing plaintext outside process memory.
6. **Email and passkeys**: Twitch is primary for creators. Email OTP is for invited team/agency members and recovery; OTPs are hashed, expire after ten minutes, allow three attempts, and rotate on resend. Passkeys are optional alternate credentials. Invitations expire after seven days and use one token for copy or optional email delivery.
7. **Notifications**: Add a transactional mail port backed by existing UseSend and a durable PostgreSQL outbox with deduplication, retries, dead-letter state, and a multi-instance-safe claim. Stripe remains the sender/source for billing lifecycle mail.
8. **Abuse controls**: Better Auth routes use shared database rate-limit storage. Invitation, account-linking, recovery, and other application endpoints use a shared database limiter; the current process-memory limiter is not an authorization control.
9. **Downgrade safety**: Replace `reconcileFreeConstraintsIfNeeded` deletion with retained-data feature gating before any paid-through cancellation or agency grace behavior is enabled.
10. **Cutover**: Use expand/backfill/verify/switch/contract phases, deterministic checkpoints, immutable audit output, a verified backup attestation, and manual authorization for restoration. Old dashboard JWTs intentionally stop working; overlay secrets and unrelated controller/checkout purpose tokens are reviewed independently rather than conflated with dashboard sessions.

## Test Plan

### Ownership and locations

- **TDD owner**: `test/auth-engine-rewrite/{unit,integration,contract,property,migration}/`; run one file with `bunx jest <file> --runInBand`, the feature set with `bunx jest test/auth-engine-rewrite --runInBand`, and the repository suite with `bun run test`.
- **ATDD owner**: `test/atdd/features/auth-engine-rewrite.feature` and `test/atdd/steps/auth-engine-rewrite.steps.ts`; add `bun run test:atdd`. Scenarios carrying both ATDD and BDD roles live here once and are not duplicated.
- **BDD owner**: `test/bdd/features/auth-engine-rewrite.feature` and `test/bdd/steps/auth-engine-rewrite.steps.ts`; run with `bun run test:bdd`.
- **Browser smoke owner**: non-duplicative browser and cutover smoke coverage in `test/acceptance/auth-engine-rewrite.spec.ts`; run with `bun run test:acceptance`.
- **Shared deterministic fixtures**: `test/support/auth-engine-rewrite/`, including an anonymized legacy snapshot, clocks, Twitch/Stripe/UseSend adapters, credential fixtures, permission matrices, and failure injection.

### Red–Green–Refactor policy

For each task, first add the smallest relevant test and run its exact file path to prove an intentional Red failure. Implement only enough behavior to turn it Green, then refactor while retaining the focused Green result. A nonexistent or filter-mismatched test is not Red evidence; Jest `-t` is therefore not accepted as the sole Red command. Commit/PR evidence records the Red command and expected failure, Green command and result, and refactor regression command.

### Required suites and gates

| Gate                        | Command                                                                                              | Release policy                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature TDD                 | `bunx jest test/auth-engine-rewrite --runInBand`                                                     | 100% pass; no skipped required tests                                                                                                                                  |
| Repository unit/integration | `bun run test`                                                                                       | 100% pass                                                                                                                                                             |
| Coverage                    | `bun run test:coverage`                                                                              | No regression below global 50% branches, 65% functions, 60% lines/statements; changed auth/migration/lifecycle code ≥90% branches and ≥95% functions/lines/statements |
| ATDD                        | `bun run test:atdd`                                                                                  | Every mapped ATDD scenario/example passes                                                                                                                             |
| BDD                         | `bun run test:bdd`                                                                                   | Every mapped BDD scenario/example passes                                                                                                                              |
| Acceptance/smoke            | `bun run test:acceptance` and `bun run test:e2e`                                                     | 100% pass on Chromium; overlay fixture set 100% unchanged                                                                                                             |
| Compliance                  | `bun run test:compliance`                                                                            | 100% pass                                                                                                                                                             |
| Lint/format/types           | `bun run app:lint`, `bun run app:prettier:check`, `bun run app:typecheck`                            | All pass with no new suppression                                                                                                                                      |
| Build/manifest              | `bun run app:build`, `bun run app:check-action-manifest`                                             | Both pass                                                                                                                                                             |
| Dependency security         | `bun run audit:high`                                                                                 | No unaccepted high/critical advisory in shipped dependencies; the command scopes any reviewed no-fix tooling exception                                                |
| Migration rehearsal         | `bun run auth:migrate -- dry-run` then `bun run auth:migrate -- apply` against disposable PostgreSQL | Backup gate, invariants, rerun idempotency, credential refresh, and smoke checks Green; measured window has ≥25% headroom                                             |
| Legacy dependency scan      | planned `bun run auth:legacy-check`                                                                  | Zero production runtime imports, reads, or writes through custom dashboard JWT, editor authorization, custom Twitch refresh, or destructive downgrade paths           |
| Performance outcomes        | planned `bun run test:auth-performance`                                                              | Authorization p95 ≤100 ms; database session resolution p95 ≤200 ms; timed Twitch onboarding and invitation acceptance each <3 minutes                                 |

Mutation tooling is not installed. A general mutation-score gate is N/A; deterministic manual mutant checks are required for deny-by-default authorization, invitation replay, migration idempotency, deletion timing, and non-destructive downgrade behavior.

### Evidence and retention

- Canonical inventory and mappings: [test-traceability.md](./test-traceability.md)
- Defects and risk decisions: [defect-log.md](./defect-log.md)
- Rolling overall summary: [test-summary.md](./test-summary.md); release/build ID is N/A until implementation.
- CI retains Playwright reports and `test-results` for 14 days. Retain coverage, migration manifests/invariant reports, dry-run/apply logs, dependency audit output, and legacy-scan output for at least 30 days; retain the final cutover manifest with the release indefinitely.
- All plan-time artifacts begin `Planned`; none are represented as executed.

| Setting              | Value                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overall summary mode | rolling                                                                                                                                                                          |
| Release ID           | N/A                                                                                                                                                                              |
| Output path          | `reports/test-summary.md`                                                                                                                                                        |
| Rationale            | The project has no supplied release ID, so convergence should maintain one latest aggregate report. Feature-specific history remains in this directory and CI/release artifacts. |

## Constitution Check

_Gate before Phase 0: PASS. Re-check after Phase 1: PASS._

| Principle              | Plan evidence                                                                                                     | Result |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| Test-first development | Focused-file Red proof, minimal Green, refactor regression policy; complete TDD inventory and scenarios           | Pass   |
| BDD/ATDD               | All six stories require both practices; shared evidence is owned once and examples are enumerated                 | Pass   |
| Traceability           | FR-001–FR-031, SC-001–SC-012, US1–US6, EC-001–EC-015 map to planned artifacts                                     | Pass   |
| Determinism/isolation  | Controlled clock/random/network/provider/filesystem; PGlite plus disposable PostgreSQL                            | Pass   |
| Quality gates          | Commands, thresholds, security audit, rehearsal, reports, defects, retention, and release policy defined          | Pass   |
| Security/privacy       | Server deny-by-default, revocable sessions, encrypted credentials, hashed OTP, redacted records, explicit restore | Pass   |

No constitution violation requires an exception.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-engine-rewrite/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── test-traceability.md
├── defect-log.md
├── test-summary.md
├── contracts/
│   ├── authorization.md
│   ├── identity-and-membership.md
│   ├── lifecycle-and-notifications.md
│   └── migration.md
└── tasks.md                    # created by /speckit.tasks, not this command
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/auth/[...all]/route.ts
│   ├── actions/                # migrated server boundaries
│   └── dashboard/              # sign-in, members, roles, agency, lifecycle UI
├── auth/
│   ├── config.ts
│   ├── permissions.ts
│   ├── authorize.ts
│   ├── session.ts
│   └── transactional-mail.ts
├── db/
│   ├── schema.ts               # Clipify domain tables
│   └── auth-schema.ts          # generated/pinned Better Auth schema
├── server/
│   ├── entitlements.ts
│   ├── notifications/
│   └── account-lifecycle/
└── proxy.ts                    # navigation only, never final authorization

scripts/
├── auth-cutover.ts
├── auth-cutover/{preflight,backfill,validate,smoke,manifest}.ts
└── run-migrations.mjs

drizzle/                        # workflow-generated migrations committed from master

test/
├── auth-engine-rewrite/{unit,integration,contract,property,migration}/
├── atdd/features/ and steps/
├── bdd/features/ and steps/
├── acceptance/
└── support/auth-engine-rewrite/
```

**Structure Decision**: Keep the existing single Next.js application and established `src`, `scripts`, `drizzle`, and `test` roots. Isolate authentication orchestration under `src/auth`, keep business ownership and entitlement rules in Clipify domain services, and expose Better Auth only at the framework route/config boundary. Generate and commit migrations; production does not depend on schema push or auto-generated commits.

## Delivery Phases

1. **Safety foundations**: freeze permission vocabulary; add non-destructive downgrade gating; add maintenance switch, shared limiter, transactional outbox, audit primitives, and migration fixtures.
2. **Better Auth infrastructure**: pin packages; create `auth` schema; configure Twitch, email OTP, passkeys, organizations, invitations, sessions, hooks, and database rate limits; prove token encryption conversion.
3. **Domain authorization**: add Creator/Agency classifications, links, allocations, lifecycle tables, roles, central evaluator, and `validateAuth` compatibility facade; migrate each protected operation.
4. **Cutover tooling construction**: implement dry-run/checkpoint/apply/resume/invariants/smoke/manifest and publish the post-cutover contraction runbook; this phase does not authorize reopening or destructive schema removal.
5. **Product flows**: creator onboarding, team roles/invitations, agency admin provisioning/link acceptance, allocation grace, account/subscription/deletion/recovery, and notifications.
6. **Rehearsal, switch, and contract**: after all selected product flows are Green, run production-shaped and 2× synthetic rehearsals, verify timing/headroom and all gates, deploy the switch during maintenance, and only then explicitly promote/remove legacy runtime paths and tables after zero-dependency proof.

## Complexity Tracking

No constitution violations require justification. The separate auth schema, domain authorization tables, and cutover CLI are necessary separation-of-authority boundaries, not additional deployable projects.
