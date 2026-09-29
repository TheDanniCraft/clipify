---
description: "Dependency-ordered implementation tasks for the Creator Identity and Access Rewrite"
---

# Tasks: Creator Identity and Access Rewrite

**Input**: Design documents from `/specs/002-auth-engine-rewrite/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Mandatory. Every behavior slice follows Red → Green → Refactor, and every required BDD/ATDD scenario is defined and bound before its production implementation.

**Organization**: Tasks are grouped by user story. Same-priority stories are ordered by technical dependency: US2 → US3 → US1 → US6, then US5 → US4 so non-destructive downgrade behavior exists before agency-funded removal.

## Format: `[ID] [P?] [Story?] [Suite?] Description`

- **[P]**: Parallelizable because it changes different files and has no dependency on another unfinished task.
- **[US#]**: Canonical story identifier from [spec.md](./spec.md).
- **[TDD] / [BDD] / [ATDD]**: Owning executable suite.
- **[GATE]**: Non-product validation or evidence task and its protected suite/report.

---

## Phase 1: Setup and Reproducible Tooling

**Purpose**: Pin the reviewed stack, expose deterministic commands, and create the feature test/evidence structure without adding product behavior.

- [x] T001 Resolve Better Auth Drizzle/passkey companion versions from the official `better-auth@1.7.6` package metadata, record the compatibility rationale, pin every package exactly, retain Bun as package manager, and update `package.json`, `bun.lock`, and `specs/002-auth-engine-rewrite/research.md` before product work
- [x] T002 [P] Add `auth:migrate`, `auth:legacy-check`, `test:auth-performance`, `test:atdd`, and focused auth feature commands without production credentials in `package.json`
- [x] T003 [P] Configure distinct ATDD and BDD Playwright projects plus generated-feature output in `playwright.config.ts` and `package.json`
- [x] T004 [P] Create suite directories and shared support entry points under `test/auth-engine-rewrite/`, `test/atdd/`, `test/bdd/`, and `test/support/auth-engine-rewrite/`
- [x] T005 [P] Add reviewed non-secret Infisical auth names, Twitch callback URLs, WebAuthn RP/origin requirements, Better Auth URL/secret requirements, and UseSend transactional configuration to `specs/002-auth-engine-rewrite/infisical-configuration.md` without introducing env files
- [x] T006 [P] Configure Better Auth schema generation to target `src/db/auth-schema.ts` and PostgreSQL schema `auth` in `drizzle.config.ts`
- [x] T007 Document disposable PostgreSQL, anonymized snapshot, 2× synthetic data, and “never production” rehearsal safeguards in `specs/002-auth-engine-rewrite/quickstart.md`
- [x] T008 [GATE] Record the exact dependency pins, commands, supported Node/Bun versions, and setup evidence destinations in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T009 [GATE] Run the unchanged repository baseline (`bun run test`, `bun run app:lint`, `bun run app:typecheck`) and record any pre-existing failure without fixing unrelated code in `specs/002-auth-engine-rewrite/defect-log.md`

**Checkpoint**: Tooling and evidence destinations are reproducible; no auth behavior has been implemented.

---

## Phase 2: Foundational Test Infrastructure

**Purpose**: Build deterministic fixtures and adapters required by every story. These tasks are test infrastructure only and block all production behavior.

- [x] T010 [P] Add isolated PGlite setup, schema reset, transaction, and fixture-builder helpers in `test/support/auth-engine-rewrite/database.ts`
- [x] T011 [P] Add controlled clock, random/token generator, lease clock, and five-minute recent-auth boundary fixtures in `test/support/auth-engine-rewrite/time.ts`
- [x] T012 [P] Add deterministic Twitch success/failure/refresh fixtures covering required scopes, verified email, expiry, revocation, and rotation in `test/support/auth-engine-rewrite/twitch.ts`
- [x] T013 [P] Add deterministic Stripe subscription/webhook fixtures including reordered events, paid-through dates, and authenticated signatures in `test/support/auth-engine-rewrite/stripe.ts`
- [x] T014 [P] Add deterministic UseSend success/transient/permanent failure adapters with captured dedupe keys and redaction assertions in `test/support/auth-engine-rewrite/mail.ts`
- [x] T015 [P] Add WebAuthn/passkey fixtures for available, unavailable, removed, replayed, counter-regressed, and failing credentials in `test/support/auth-engine-rewrite/passkeys.ts`
- [x] T016 [P] Build an anonymized legacy creator/editor/resource/token fixture and 2× synthetic generator without real credentials or personal data in `test/support/auth-engine-rewrite/legacy-snapshot.ts`
- [x] T017 [P] Add permission-matrix, resource-ownership, entitlement-source, lifecycle-state, and agency-intersection generators in `test/support/auth-engine-rewrite/authorization.ts`
- [x] T018 [P] Add cutover checkpoint failure injection, backup-attestation fixtures, filesystem isolation, and subprocess capture in `test/support/auth-engine-rewrite/cutover.ts`
- [x] T019 [P] Configure ATDD and BDD world fixtures to use isolated database/network/clock boundaries in `test/atdd/support/auth-engine-rewrite.ts` and `test/bdd/support/auth-engine-rewrite.ts`
- [x] T020 [GATE] Register every shared fixture, controlled boundary, owning suite, command, and evidence path before product work in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T021 [GATE] Prove the empty harness discovers intended test files and rejects unmatched Gherkin bindings; record results in `specs/002-auth-engine-rewrite/test-summary.md`

**Checkpoint**: Deterministic foundations are ready. No story implementation begins before T020–T021 pass.

---

## Phase 3: User Story 2 — Creator Onboards and Signs In Safely (Priority: P1)

**Goal**: A new or returning creator uses Twitch first, receives exactly one provider-neutral person and Creator Account, synchronizes Twitch-authoritative email, and gets recoverable provider errors without partial records.

**Independent Test**: Complete Twitch onboarding twice for one subject; verify one person/account/creator, verified email synchronization, required scopes, dashboard entry, and atomic failure/conflict behavior.

### Scenario definitions and bindings

- [x] T022 [US2] [ATDD] Add `ATDD-US2-001` with Twitch-first onboarding and the dual ATDD/BDD equivalence rationale to `test/atdd/features/auth-engine-rewrite.feature`
- [x] T023 [US2] [ATDD] Bind `ATDD-US2-001` through the real route/session/dashboard boundary in `test/atdd/steps/auth-engine-rewrite.steps.ts` (the real login/Better Auth/Twitch redirect boundary is Green; database session/dashboard completion remains)
- [x] T024 [US2] [BDD] Add `BDD-US2-001` returning identity, `BDD-US2-002` four OAuth failure examples, and `BDD-US2-003` uniqueness conflict to `test/bdd/features/auth-engine-rewrite.feature`
- [x] T025 [US2] [BDD] Bind every US2 BDD example to observable callback and sign-in outcomes in `test/bdd/steps/auth-engine-rewrite.steps.ts`
- [x] T026 [US2] [GATE] Register US2 scenario rows, example rows, source relationships, and shared-role rationale as Planned in `specs/002-auth-engine-rewrite/test-traceability.md`

### Slice US2-A — Identity, schema, and idempotent Twitch onboarding

- [x] T027 [US2] [TDD] Implement `TDD-US2-001` first with new/returning/conflicting/missing Twitch subjects, verified-email synchronization, exactly-one Creator Account, retry idempotence, and atomic rollback cases in `test/auth-engine-rewrite/integration/twitch-identity.test.ts`
- [x] T028 [US2] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/twitch-identity.test.ts --runInBand`, prove an intentional Red result, and mark `TDD-US2-001` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T029 [US2] Create Better Auth tables in schema `auth` plus `creator_accounts` (`active|suspension_scheduled|suspended|purge_eligible`) and `creator_identity_links` (`migration|twitch_onboarding|admin_repair`) with one Creator Profile per Creator Account and no email-equality linking in `src/db/auth-schema.ts`, `src/db/schema.ts`, and `drizzle/`
- [x] T030 [US2] Configure Better Auth database sessions, encrypted Twitch accounts, Twitch-first callbacks, cookie caching disabled, and idempotent onboarding hooks in `src/auth/config.ts`, `src/auth/session.ts`, and `src/app/api/auth/[...all]/route.ts`
- [x] T031 [US2] Implement Creator Profile/account/owner membership creation and Twitch-authoritative email synchronization in `src/auth/creator-onboarding.ts`
- [x] T032 [US2] [GATE] Re-run `TDD-US2-001` Green and record the command/result in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T033 [US2] Refactor onboarding transaction boundaries while `TDD-US2-001` remains Green in `src/auth/creator-onboarding.ts`

### Slice US2-B — Provider contract, failure preservation, and creator UI

- [x] T034 [US2] [TDD] Implement `TDD-US2-002` first for success, declined consent, expired state, insufficient scopes, callback failure, conflicting identity, and precise originating error preservation in `test/auth-engine-rewrite/contract/twitch-oauth.test.ts`
- [x] T035 [US2] [GATE] Run `bunx jest test/auth-engine-rewrite/contract/twitch-oauth.test.ts --runInBand`, prove intentional Red, and mark `TDD-US2-002` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T036 [US2] Implement the Twitch provider adapter, required-scope validation, sanitized denial mapping, and retry-safe callback responses in `src/auth/providers/twitch.ts` and `src/app/lib/twitchErrors.ts`
- [x] T037 [US2] Replace the creator login entry with Twitch-first sign-in, retry messaging, and no email-first partial creator path in `src/app/login/page.tsx` and `src/app/login/LoginClient.tsx`
- [x] T038 [US2] [GATE] Re-run `TDD-US2-002`, `bun run test:atdd`, and `bun run test:bdd` Green for US2 and record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T039 [US2] Refactor provider/callback error boundaries while focused TDD and US2 scenario suites remain Green in `src/auth/providers/twitch.ts`
- [x] T040 [US2] [GATE] Update US2 artifact statuses, defects, timings against the three-minute outcome, and residual risks in `specs/002-auth-engine-rewrite/test-summary.md` and `specs/002-auth-engine-rewrite/defect-log.md`

**Checkpoint**: US2 is independently usable and testable; one Twitch subject cannot create duplicate or ambiguous identities.

---

## Phase 4: User Story 3 — Owner Manages Granular Team Access (Priority: P1)

**Goal**: Owners define least-privilege roles, invite verified email-only members by one copyable/optionally emailed token, and every server operation applies permission, ownership, entitlement, lifecycle, and recent-auth rules.

**Independent Test**: Invite an email-only member with playlist/analytics permission, prove allowed operations and denied overlay deletion, exercise all invalid invitation states, OTP/passkey fallback, rate limits, and redacted audit history.

### Scenario definitions and bindings

- [x] T041 [US3] [ATDD] Add `ATDD-US3-001` with copy-link and optional-email examples plus shared ATDD/BDD rationale to `test/atdd/features/auth-engine-rewrite.feature`
- [x] T042 [US3] [ATDD] Bind US3 delegation through invitation acceptance and authorized creator view, capturing the under-three-minute SC-007 outcome, in `test/atdd/steps/auth-engine-rewrite.steps.ts`
- [x] T043 [US3] [BDD] Add `BDD-US3-001` through `BDD-US3-005`, enumerating permission denial, four invalid invitation states, four passkey states, throttling, and positive/negative audit outcomes for invitation, membership, role, agency-link, allocation, sensitive-integration, and account-deletion actions in `test/bdd/features/auth-engine-rewrite.feature`
- [x] T044 [US3] [BDD] Bind every US3 scenario/example, including all seven audit action classes, to real server operations and observable errors in `test/bdd/steps/auth-engine-rewrite.steps.ts`
- [x] T045 [US3] [GATE] Register US3 scenario/example rows and the risk-based permission sampling rule while requiring explicit sensitive-action cases in `specs/002-auth-engine-rewrite/test-traceability.md`

### Slice US3-A — Permission catalogue and central authorization

- [x] T046 [US3] [TDD] Implement `TDD-US3-001` first as property/matrix tests for every FR-028 action, owner/direct paths, missing membership, ownership mismatch, entitlement absence, suspended state, five-minute freshness boundary, non-delegable actions, and denied-mutation immutability in `test/auth-engine-rewrite/property/authorization.test.ts`
- [x] T047 [US3] [GATE] Run `bunx jest test/auth-engine-rewrite/property/authorization.test.ts --runInBand`, prove intentional Red, and mark `TDD-US3-001` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T048 [US3] Freeze the full permission catalogue and standard Owner/Operations/Content manager/Analyst/Billing manager roles, excluding account deletion, ownership transfer, agency provisioning, forced purge, and restore authorization, in `src/auth/permissions.ts`
- [x] T049 [US3] Implement the sole `authorize()` decision point and denial codes in the specified order—session, lifecycle, freshness, creator/resource ownership, access path, permission, owner-only, entitlement—in `src/auth/authorize.ts`
- [x] T050 [US3] Generate Better Auth organization/member/role constraints in `src/db/auth-schema.ts`; add only Clipify-owned audit tables and append-only secret-redacted constraints in `src/db/schema.ts` and `drizzle/`
- [x] T051 [US3] [GATE] Re-run `TDD-US3-001` Green, including deliberate deny-by-default mutant proof, and record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T052 [US3] Refactor policy composition without caching effective authority while `TDD-US3-001` remains Green in `src/auth/authorize.ts`

### Slice US3-B — Invitations, email OTP, memberships, and passkeys

- [x] T053 [US3] [TDD] Implement `TDD-US3-002` first for normalized email binding, exactly-seven-day expiry boundary, single use/replay, revocation, role invalidation, copy versus copy-and-email using one token, atomic membership creation, hashed ten-minute OTPs with three attempts/rotation, and passkey lifecycle/fallback in `test/auth-engine-rewrite/integration/invitation-credentials.test.ts`
- [x] T054 [US3] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/invitation-credentials.test.ts --runInBand`, prove intentional Red, and mark `TDD-US3-002` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T055 [US3] Configure Better Auth organizations, members, roles, invitations, email OTP, and passkeys with hashed challenges and stable RP/origins in `src/auth/config.ts` and `src/db/auth-schema.ts`
- [x] T056 [US3] Implement invitation creation/acceptance/revocation, one-token optional delivery, email-only verified-address changes, transactional membership assignment, and invitation/security notification intents in `src/auth/invitations.ts` and `src/auth/memberships.ts`
- [x] T057 [US3] Implement team, role, invitation, email-code, and passkey settings UI without calling passkeys 2FA in `src/app/dashboard/settings/team/page.tsx`, `src/app/dashboard/settings/roles/page.tsx`, and `src/app/dashboard/settings/security/page.tsx`
- [x] T058 [US3] [GATE] Re-run `TDD-US3-002`, `bun run test:atdd`, and `bun run test:bdd` Green for US3 and record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T059 [US3] Refactor invitation/credential orchestration while preserving replay denial and focused Green evidence in `src/auth/invitations.ts`

### Slice US3-C — Shared abuse controls, durable mail, and audit redaction

- [x] T060 [US3] [TDD] Implement `TDD-US3-003` first for identity/network thresholds, retry timing, recovery after expiry, atomic outbox intent, dedupe, multi-worker lease, transient retry, permanent dead-letter, delivery state, welcome/invitation/security/agency-access notification classes, all seven FR-025 audit action classes, and token/OTP/credential/secret redaction in `test/auth-engine-rewrite/integration/security-controls.test.ts`
- [x] T061 [US3] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/security-controls.test.ts --runInBand`, prove intentional Red, and mark `TDD-US3-003` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T062 [US3] Add shared rate-limit and notification-outbox tables with `pending|claimed|sent|retry|dead`, attempts, lease, provider ID, redacted error, and unique dedupe key in `src/db/schema.ts` and `drizzle/`
- [x] T063 [US3] Implement database-backed auth/application limiters, append-only audit writing, atomic notification enqueue, skip-locked-equivalent claim, bounded retry, and dead-letter alert hooks in `src/auth/rate-limit.ts`, `src/auth/audit.ts`, and `src/server/notifications/outbox.ts`
- [x] T064 [US3] Implement the UseSend transactional-mail adapter separately from newsletter code plus versioned welcome, invitation, security, and agency-access templates in `src/auth/transactional-mail.ts` and `src/server/notifications/templates/identity-security.ts`
- [x] T065 [US3] [GATE] Re-run `TDD-US3-003` Green and record redaction/dedupe evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T066 [US3] Refactor the limiter/outbox claim loop while concurrency evidence remains Green in `src/server/notifications/outbox.ts`
- [x] T067 [US3] [GATE] Run the full US3 TDD/BDD/ATDD suites, update statuses and coverage mappings in `specs/002-auth-engine-rewrite/test-traceability.md`, and reconcile defects/results in `specs/002-auth-engine-rewrite/defect-log.md` and `specs/002-auth-engine-rewrite/test-summary.md`

**Checkpoint**: US3 independently provides least-privilege delegation with server-side denial, secure invitations, resilient sign-in, and auditable changes.

---

## Phase 5: User Story 1 — Existing Creator Continues After Cutover (Priority: P1)

**Goal**: Existing creators, editor access, resource identifiers, entitlements, subscriptions, overlay secrets, and runtime URLs survive identity/session replacement unchanged.

**Independent Test**: Migrate a representative creator and editor, reject the legacy dashboard session, sign in through Twitch, and compare all domain/runtime fixtures byte-for-byte before and after.

### Scenario definitions and bindings

- [x] T068 [US1] [ATDD] Add `ATDD-US1-001` through `ATDD-US1-003` and their dual-role rationales to `test/atdd/features/auth-engine-rewrite.feature`
- [x] T069 [US1] [ATDD] Bind creator continuity, fresh sign-in, and dashboard-independent overlay HTTP/WebSocket behavior in `test/atdd/steps/auth-engine-rewrite.steps.ts`
- [x] T070 [US1] [GATE] Register all US1 scenario rows, continuity fixtures, and source mappings as Planned in `specs/002-auth-engine-rewrite/test-traceability.md`

### Slice US1-A — Stable IDs and safe editor migration

- [x] T071 [US1] [TDD] Implement `TDD-US1-001` first for exact creator/resource/owner/subscription/entitlement ID preservation, unique Twitch binding, editor-to-Operations authority parity, exclusion of billing/team/deletion authority, unresolved-editor anomaly, first-safe-auth binding, transaction rollback, and rerun no-duplicates in `test/auth-engine-rewrite/migration/legacy-continuity.test.ts`
- [x] T072 [US1] [GATE] Run `bunx jest test/auth-engine-rewrite/migration/legacy-continuity.test.ts --runInBand`, prove intentional Red, and mark `TDD-US1-001` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T073 [US1] Add `migration_runs`, `migration_checkpoints`, and `migration_anomalies` with run/phase/cursor uniqueness, checksums, redacted anomalies, and completed-checkpoint no-op semantics in `src/db/schema.ts` and `drizzle/`
- [x] T074 [US1] Implement idempotent Creator Account/identity/editor mapping without fabricated email/person records in `scripts/auth-cutover/backfill.ts`
- [x] T075 [US1] [GATE] Re-run `TDD-US1-001` Green and record count/parity evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T076 [US1] Refactor batch/cursor boundaries while `TDD-US1-001` remains Green in `scripts/auth-cutover/backfill.ts`

### Slice US1-B — Overlay and runtime-secret continuity

- [x] T077 [US1] [TDD] Implement `TDD-US1-002` first for valid/invalid overlay secrets across every dashboard-session state, HTTP and WebSocket fixtures, auth outage, suspension distinction, and byte-for-byte URL/secret continuity in `test/auth-engine-rewrite/integration/overlay-continuity.test.ts`
- [x] T078 [US1] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/overlay-continuity.test.ts --runInBand`, prove intentional Red, and mark `TDD-US1-002` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T079 [US1] Decouple overlay runtime authorization from dashboard sessions while preserving existing secret and owner lookup contracts in `src/server/overlays.ts`, `src/app/embed/[overlayId]/page.tsx`, and `src/app/ws/route.ts`
- [x] T080 [US1] [GATE] Re-run `TDD-US1-002` Green and the pre-cutover overlay fixture set at 100% parity; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T081 [US1] Refactor overlay runtime context without introducing Better Auth session dependencies in `src/server/overlays.ts`

### Slice US1-C — Legacy dashboard session rejection and compatibility facade

- [x] T082 [US1] [TDD] Implement `TDD-US1-003` first for every legacy JWT validity state, Better Auth session issuance/revocation/expiry, recoverable Twitch sign-in, and purpose-token separation in `test/auth-engine-rewrite/unit/legacy-session.test.ts`
- [x] T083 [US1] [GATE] Run `bunx jest test/auth-engine-rewrite/unit/legacy-session.test.ts --runInBand`, prove intentional Red, and mark `TDD-US1-003` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T084 [US1] Replace `validateAuth` internals with the Better Auth session/ActorContext compatibility facade without accepting or issuing dashboard JWTs in `src/app/actions/auth.ts` and `src/auth/session.ts`
- [x] T085 [US1] Retire/redirect legacy creator `/auth`, `/callback`, and `/logout` behavior while preserving separately reviewed bot/controller/checkout tokens in `src/app/auth/route.ts`, `src/app/callback/route.ts`, and `src/app/logout/route.ts`
- [x] T086 [US1] [GATE] Re-run `TDD-US1-003` and all US1 ATDD scenarios Green; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T087 [US1] Refactor compatibility boundaries while legacy-session denial and purpose-token regression suites remain Green in `src/auth/session.ts`
- [x] T088 [US1] [GATE] Update US1 artifact statuses, parity counts, defects, risks, and recommendation in `specs/002-auth-engine-rewrite/test-traceability.md`, `specs/002-auth-engine-rewrite/defect-log.md`, and `specs/002-auth-engine-rewrite/test-summary.md`

**Checkpoint**: US1 proves continuity; this remains a rehearsal result until US6 completes the safe operational workflow.

---

## Phase 6: User Story 6 — Operator Executes a Safe Automated Cutover (Priority: P1)

**Goal**: Operators can dry-run, verify backup, enter maintenance, apply/resume deterministic checkpoints, validate/smoke, switch, reopen, and later contract legacy structures—with no automatic restore.

**Independent Test**: Run twice against a production-shaped disposable snapshot, inject every checkpoint failure, verify fail-closed maintenance/resume/idempotence, refresh exactly once, and measure ≥25% maintenance-window headroom.

### Scenario definitions and bindings

- [x] T089 [US6] [ATDD] Add `ATDD-US6-001` idempotent cutover and `ATDD-US6-002` validated legacy removal with shared-role rationales to `test/atdd/features/auth-engine-rewrite.feature`
- [x] T090 [US6] [ATDD] Bind the operator command surface, manifest, smoke, and legacy scan to US6 ATDD scenarios in `test/atdd/steps/auth-engine-rewrite.steps.ts`
- [x] T091 [US6] [BDD] Add `BDD-US6-001` eight checkpoint examples, `BDD-US6-002` restore denial, and `BDD-US6-003` revoked credential behavior to `test/bdd/features/auth-engine-rewrite.feature`
- [x] T092 [US6] [BDD] Bind every US6 failure/example to redacted diagnostics and fail-closed state in `test/bdd/steps/auth-engine-rewrite.steps.ts`
- [x] T093 [US6] [GATE] Register US6 rows, checkpoint example coverage, and any pairwise sampling rationale in `specs/002-auth-engine-rewrite/test-traceability.md`

### Slice US6-A — Cutover state machine and resumable command

- [x] T094 [US6] [TDD] Implement `TDD-US6-001` first for dry-run/apply/resume/validate/smoke modes, first/rerun behavior, every legal/illegal state transition, checkpoint cursor replay, partial-batch rollback, deterministic idempotency keys, maintenance gating, and immutable manifest checksum in `test/auth-engine-rewrite/migration/cutover-state-machine.test.ts`
- [x] T095 [US6] [GATE] Run `bunx jest test/auth-engine-rewrite/migration/cutover-state-machine.test.ts --runInBand`, prove intentional Red, and mark `TDD-US6-001` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T096 [US6] Implement the CLI parser and state machine with credentials forbidden from arguments/logs in `scripts/auth-cutover.ts` and `scripts/auth-cutover/manifest.ts`
- [x] T097 [US6] Implement transactional checkpoint batches and maintenance switch orchestration in `scripts/auth-cutover/checkpoints.ts` and `src/server/maintenance.ts`
- [x] T098 [US6] [GATE] Re-run `TDD-US6-001` Green, perform the migration-idempotency deliberate mutant check, and record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T099 [US6] Refactor state transition/manifest composition while focused Green evidence remains stable in `scripts/auth-cutover.ts`

### Slice US6-B — Backup gate, invariants, and provider credential conversion

- [x] T100 [US6] [TDD] Implement `TDD-US6-002` first for backup absent/invalid/incomplete/stale/verified states; exact source fingerprint; 100% entity counts; byte parity; duplicate/conflict detection; legacy AES-GCM AAD `twitchUser:{creatorId}:oauth`; in-memory re-encryption; success/expiry/revocation/rotation; one refresh authority; and no plaintext output in `test/auth-engine-rewrite/migration/invariants-and-tokens.test.ts`
- [x] T101 [US6] [GATE] Run `bunx jest test/auth-engine-rewrite/migration/invariants-and-tokens.test.ts --runInBand`, prove intentional Red, and mark `TDD-US6-002` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T102 [US6] Implement preflight and backup-attestation verification for timestamp, checksum, restore-drill reference, source fingerprint, versions, capacity, and external reachability policy in `scripts/auth-cutover/preflight.ts`
- [x] T103 [US6] Implement invariant comparison, anomaly disposition, encrypted credential conversion, serialized refresh, and atomic rotation in `scripts/auth-cutover/validate.ts` and `scripts/auth-cutover/credentials.ts`
- [x] T104 [US6] Disable the custom Twitch refresh authority only at the validated switch boundary in `src/server/tokens.ts` and `src/server/twitch-auth.ts`
- [x] T105 [US6] [GATE] Re-run `TDD-US6-002` Green and attach redacted conversion/count evidence to `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T106 [US6] Refactor credential/invariant adapters without exposing plaintext or weakening exact-count checks in `scripts/auth-cutover/credentials.ts`

### Slice US6-C — Failure handling, smoke, reopen, and legacy contract

- [x] T107 [US6] [TDD] Implement `TDD-US6-003` first for failure at preflight/backup/identity/membership/credential/invariant/switch/smoke, maintenance persistence, safe-next-action diagnostics, explicit restore authorization absence, sign-in/allow-deny/overlay/refresh/subscription/entitlement/outbox smoke, and zero legacy consumers in `test/auth-engine-rewrite/migration/fault-injection.test.ts`
- [x] T108 [US6] [GATE] Run `bunx jest test/auth-engine-rewrite/migration/fault-injection.test.ts --runInBand`, prove intentional Red, and mark `TDD-US6-003` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T109 [US6] Implement fail-closed phase execution, redacted originating errors, smoke checks, explicit reopen, and no restore command in `scripts/auth-cutover/smoke.ts` and `scripts/auth-cutover.ts`
- [x] T110 [US6] Implement AST/dependency scanning for legacy dashboard JWT, editor authorization, custom Twitch refresh, and destructive downgrade consumers in `scripts/auth-legacy-check.ts`
- [x] T111 [US6] Publish the reviewed legacy `editors`/`tokens` contraction checklist in `contracts/legacy-auth-contraction-runbook.md`; require final zero-dependency evidence, a separate post-cutover schema-only pull request, normal migration generation on `master`, disposable-database rehearsal, and explicit operator approval before production contraction
- [x] T112 [US6] [GATE] Re-run `TDD-US6-003`, all US6 BDD/ATDD scenarios, `bun run auth:legacy-check`, and tooling smoke suites Green without executing schema contraction; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T113 [US6] Refactor smoke/failure reporting while fail-closed and no-auto-restore evidence remains Green in `scripts/auth-cutover/smoke.ts`
- [ ] T114 [US6] [GATE] Rehearse the US1–US3 cutover tooling on anonymized and 2× disposable PostgreSQL datasets without reopening or schema contraction; retain timing/manifests for the full post-US4/US5 rehearsal in Phase 9
- [ ] T115 [US6] [GATE] Reconcile US6 defects, anomaly dispositions, residual restore risks, and Go/No-Go state in `specs/002-auth-engine-rewrite/defect-log.md` and `specs/002-auth-engine-rewrite/test-summary.md`

**Checkpoint**: US6 cutover tooling is Green but is not operationally releasable until US4/US5 selected-release behavior and the Phase 9 final rehearsal, performance, reopen/switch, and contract gates are Green.

---

## Phase 7: User Story 5 — Owner Controls Account and Subscription Lifecycle (Priority: P2)

**Goal**: Owners update/export/manage/cancel/delete/recover safely; non-owners cannot invoke destructive actions; paid-through and immediate deletion preserve data and use the correct Stripe/Clipify email boundary.

**Independent Test**: Exercise owner actions and non-owner denials, both deletion choices, every 30-day boundary/notice, recovery, reordered Stripe events, and prove zero resource deletion.

### Scenario definitions and bindings

- [x] T116 [US5] [ATDD] Add `ATDD-US5-001` through `ATDD-US5-004` with all owner-operation, recovery-boundary, recovery-flow, and deletion-choice examples to `test/atdd/features/auth-engine-rewrite.feature`
- [x] T117 [US5] [ATDD] Bind US5 account/subscription/deletion/recovery entry points to the real server and UI boundary in `test/atdd/steps/auth-engine-rewrite.steps.ts`
- [x] T118 [US5] [BDD] Add `BDD-US5-001` owner-only denial and `BDD-US5-002` request/30/7/3/1/0-day notices to `test/bdd/features/auth-engine-rewrite.feature`
- [x] T119 [US5] [BDD] Bind every US5 denial and notice boundary with a controlled clock and captured mail in `test/bdd/steps/auth-engine-rewrite.steps.ts`
- [x] T120 [US5] [GATE] Register all US5 scenario/example rows and dual-role rationales as Planned in `specs/002-auth-engine-rewrite/test-traceability.md`

### Slice US5-A — Non-destructive downgrade foundation

- [x] T121 [US5] [TDD] Implement `TDD-US5-003` first as properties across all resource/plan/entitlement combinations, reordered paid events, effective-date boundaries, unsupported-feature block/read-only behavior, and zero delete calls/rows for downgrade in `test/auth-engine-rewrite/property/non-destructive-downgrade.test.ts`
- [x] T122 [US5] [GATE] Run `bunx jest test/auth-engine-rewrite/property/non-destructive-downgrade.test.ts --runInBand`, prove intentional Red, and mark `TDD-US5-003` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T123 [US5] Replace `reconcileFreeConstraintsIfNeeded` destructive cleanup with retained-data capability gating and an explicit downgrade-effects model in `src/app/lib/entitlements.ts` and `src/server/entitlements.ts`
- [x] T124 [US5] Show exact post-downgrade restrictions before confirmation in `src/app/dashboard/settings/subscription-change-summary.tsx`
- [x] T125 [US5] [GATE] Re-run `TDD-US5-003` Green, perform the deliberate resource-deletion mutant check, and record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T126 [US5] Refactor capability composition while non-destructive properties remain Green in `src/server/entitlements.ts`

### Slice US5-B — Owner account/subscription operations and deletion state

- [x] T127 [US5] [TDD] Implement `TDD-US5-001` first for owner read/update/export, subscription read/manage/cancel, non-owner denial, five-minute recent-auth boundaries, paid-through versus immediate choice, authenticated Stripe event ordering/signature, suspension effects, owner-only transitions, and immutable account-deletion audit outcomes in `test/auth-engine-rewrite/integration/account-lifecycle.test.ts`
- [x] T128 [US5] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/account-lifecycle.test.ts --runInBand`, prove intentional Red, and mark `TDD-US5-001` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T129 [US5] Add `account_deletion_requests` with one nonterminal request, `paid_through|immediate`, `scheduled|suspended|recovered|purge_eligible|purged|cancelled`, actual-suspension-plus-30-days eligibility, actors/times, and redacted Stripe snapshot in `src/db/schema.ts`; defer generated `drizzle/` output to the master-owned migration workflow
- [x] T130 [US5] Implement owner/recent-auth account update/export/subscription/deletion transitions, session revocation, overlay/integration pause, agency-allocation release, and authenticated Stripe webhook state in `src/server/account-lifecycle/service.ts`, `src/app/actions/subscription.ts`, and `src/app/payment/webhook/route.ts`
- [x] T131 [US5] Implement settings UI that defaults to paid-through, offers explicit delete-now consequences, and never delegates account deletion in the repository's combined `src/app/dashboard/settings/page.tsx` surface and authenticated `src/app/dashboard/settings/account/recovery/page.tsx` route
- [x] T132 [US5] [GATE] Re-run `TDD-US5-001` and owner/non-owner ATDD/BDD cases Green; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T133 [US5] Refactor lifecycle transitions with compare-and-set semantics while focused suites remain Green in `src/server/account-lifecycle/service.ts`

### Slice US5-C — Recovery, purge eligibility, and staged notifications

- [x] T134 [US5] [TDD] Implement `TDD-US5-002` first for before/at/after 30 days, authenticated recovery versus link-only denial, no billing/allocation restart, request/suspension/7/3/1/0/recovery intents, account-deletion audit events, dedupe/retry/redaction, and idempotent eligible purge ordering in `test/auth-engine-rewrite/integration/deletion-notifications.test.ts`
- [x] T135 [US5] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/deletion-notifications.test.ts --runInBand`, prove intentional Red, and mark `TDD-US5-002` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T136 [US5] Implement controlled-clock scheduling, secure recovery navigation that never authenticates, recent-auth recovery, eligible purge ordering, lawful audit tombstone, and no automatic restore in `src/server/account-lifecycle/recovery.ts` and `src/server/account-lifecycle/purge.ts`
- [x] T137 [US5] Implement versioned deletion/recovery notification templates that distinguish feature loss from data deletion and contain no credentials in `src/server/notifications/templates/account-lifecycle.ts`
- [x] T138 [US5] [GATE] Re-run `TDD-US5-002`, all US5 BDD/ATDD scenarios, and the deletion-timing deliberate mutant check Green; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T139 [US5] Refactor schedulers/templates while boundary, dedupe, and recovery evidence remains Green in `src/server/account-lifecycle/recovery.ts`
- [x] T140 [US5] [GATE] Update US5 artifact statuses, execution totals, defects, Stripe-mail ownership, and residual legal-retention risks in `specs/002-auth-engine-rewrite/test-traceability.md`, `specs/002-auth-engine-rewrite/defect-log.md`, and `specs/002-auth-engine-rewrite/test-summary.md`

**Checkpoint**: US5 is independently testable and no paid-access loss deletes creator resources.

---

## Phase 8: User Story 4 — Agency Manages Linked Creators and Licenses (Priority: P2)

**Goal**: Admin-provisioned agencies activate through email, staff manage creator-approved links using intersected permissions, and allocations count creators—not people—with seven-day occupied-seat grace.

**Independent Test**: Provision an agency, activate its owner, link two independent creators, limit staff by both permission sets, allocate/remove one seat, revoke access immediately, and retain creator-owned benefits/data.

### Scenario definitions and bindings

- [x] T141 [US4] [ATDD] Add `ATDD-US4-003`, `ATDD-US4-001`, and `ATDD-US4-002` with shared-role rationales to `test/atdd/features/auth-engine-rewrite.feature`
- [x] T142 [US4] [ATDD] Bind admin provisioning, creator approval, and allocation outcomes through real server/UI boundaries in `test/atdd/steps/auth-engine-rewrite.steps.ts`
- [x] T143 [US4] [BDD] Add `BDD-US4-001`, `BDD-US4-003`, and `BDD-US4-002` for revocation, intersection denial, and seven-day grace/data preservation in `test/bdd/features/auth-engine-rewrite.feature`
- [x] T144 [US4] [BDD] Bind US4 revocation/intersection/allocation behavior with controlled sessions, clock, entitlements, seats, and mail in `test/bdd/steps/auth-engine-rewrite.steps.ts`
- [x] T145 [US4] [GATE] Register all US4 scenario/example rows and shared-role rationales in `specs/002-auth-engine-rewrite/test-traceability.md`

### Slice US4-A — Agency provisioning and creator-owned link lifecycle

- [x] T146 [US4] [TDD] Implement `TDD-US4-001` first for admin-only provisioning, `provisioned|owner_invited|active|suspended|closed`, first-owner email activation, proposed/accepted/revoked links, one non-revoked pair, explicit ceiling validation, owner-only accept/reduce/revoke, no ownership transfer, immediate next-operation revocation, and immutable agency-link audit outcomes in `test/auth-engine-rewrite/integration/agency-links.test.ts`
- [x] T147 [US4] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/agency-links.test.ts --runInBand`, prove intentional Red, and mark `TDD-US4-001` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T148 [US4] Add `agency_accounts` and `agency_creator_links` with the exact statuses, non-secret commercial reference, provisioner, actors/times, validated ceiling, and uniqueness constraints in `src/db/schema.ts` (generated `drizzle/` artifacts are intentionally master-workflow-owned)
- [x] T149 [US4] Implement trusted admin provisioning, first-owner invitation activation, creator-owner link proposal/accept/reduce/revoke, audit intents, and agency-access notification intents in `src/server/agencies/service.ts`
- [x] T150 [US4] Implement admin and creator approval UI while labeling public pricing as contact/custom pricing in `src/app/admin/agencies/page.tsx`, `src/app/dashboard/settings/agencies/page.tsx`, and `src/app/components/Pricing/index.tsx`
- [x] T151 [US4] [GATE] Re-run `TDD-US4-001` and agency provisioning/link scenarios Green; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T152 [US4] Refactor agency state transitions while immediate-revocation evidence remains Green in `src/server/agencies/service.ts`

### Slice US4-B — Live permission intersection

- [x] T153 [US4] [TDD] Implement `TDD-US4-002` first as properties for `activeAgencyRolePermissions ∩ acceptedCreatorLinkCeiling`, absent/revoked membership/link, reduced ceiling, stale sessions, owner/direct independence, every permission class, ownership, entitlement, and denied-mutation immutability in `test/auth-engine-rewrite/property/agency-authorization.test.ts`
- [x] T154 [US4] [GATE] Run `bunx jest test/auth-engine-rewrite/property/agency-authorization.test.ts --runInBand`, prove intentional Red, and mark `TDD-US4-002` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T155 [US4] Add agency-path resolution to the central evaluator without persisting effective permissions in sessions in `src/auth/authorize.ts`
- [x] T156 [US4] Implement agency staff role management and linked-creator context selection without duplicate creator memberships in `src/server/agencies/access.ts` and `src/app/dashboard/agency/page.tsx`
- [x] T157 [US4] [GATE] Re-run `TDD-US4-002`, `BDD-US4-001`, and `BDD-US4-003` Green; record matrix evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T158 [US4] Refactor live intersection queries while property suites remain Green in `src/server/agencies/access.ts`

### Slice US4-C — Creator-seat allocation, entitlement union, and grace

- [x] T159 [US4] [TDD] Implement `TDD-US4-003` first for `active|removal_scheduled|ended|released_by_deletion`, seat availability, linked-creator requirement, members consuming zero seats, active/removal-scheduled consuming one seat, source union, request+7-day boundary, overlapping creator benefits, deletion release/no recovery reclaim, concurrent allocation, immutable allocation audit outcomes, event dedupe, and grant/7/3/1/end notices in `test/auth-engine-rewrite/integration/agency-allocations.test.ts`
- [x] T160 [US4] [GATE] Run `bunx jest test/auth-engine-rewrite/integration/agency-allocations.test.ts --runInBand`, prove intentional Red, and mark `TDD-US4-003` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T161 [US4] Add `agency_license_allocations` with exact statuses, effective/request/end times, source reference, and concurrency/seat constraints in `src/db/schema.ts` (generated `drizzle/` artifacts are intentionally master-workflow-owned)
- [x] T162 [US4] Implement allocation/grace/seat accounting and entitlement-source union without data deletion in `src/server/agencies/allocations.ts` and `src/server/entitlements.ts`
- [x] T163 [US4] Implement allocation/removal UI with effective date, occupied-seat grace, exact downgrade effects, and creator/team-member distinction in `src/app/dashboard/agency/allocations/page.tsx`
- [x] T164 [US4] Implement allocation notification templates for grant, removal scheduled, 3 days, 1 day, and ended in `src/server/notifications/templates/agency-allocation.ts`
- [x] T165 [US4] [GATE] Re-run `TDD-US4-003`, all US4 BDD/ATDD scenarios, and seat/data-preservation checks Green; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T166 [US4] Refactor allocation/entitlement scheduling while focused suites remain Green in `src/server/agencies/allocations.ts`
- [x] T167 [US4] [GATE] Update US4 artifact statuses, notification counts, seat invariants, defects, risks, and summary in `specs/002-auth-engine-rewrite/test-traceability.md`, `specs/002-auth-engine-rewrite/defect-log.md`, and `specs/002-auth-engine-rewrite/test-summary.md`

**Checkpoint**: US4 is independently testable and never transfers creator ownership or charges human members as creator seats.

---

## Phase 9: Polish, Security, and Release Gates

**Purpose**: Finish migration of every protected boundary, verify no legacy/runtime gaps, run all mandatory gates, and produce release evidence.

- [x] T168 [US3] [TDD] Implement `TDD-US3-004` first for every migrated server action/route using `authorize()`, every denial code, denied-mutation immutability, absence of client-only authorization, and sensitive-integration audit outcomes in `test/auth-engine-rewrite/contract/protected-boundaries.test.ts`
- [x] T169 [GATE] Run `bunx jest test/auth-engine-rewrite/contract/protected-boundaries.test.ts --runInBand`, prove intentional Red for remaining legacy boundaries, and mark `TDD-US3-004` Red in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T170 Migrate the smallest remaining protected-boundary batch to `authorize()` in `src/app/actions/` and `src/app/api/` without changing unrelated behavior
- [x] T171 [GATE] Re-run `TDD-US3-004` Green and record boundary and sensitive-integration audit coverage in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T172 Refactor shared protected-boundary adapters while the contract file remains Green in `src/auth/authorize.ts`
- [x] T173 [P] Add non-duplicative Chromium smoke coverage for sign-in, team, agency, lifecycle, and overlay continuity in `test/acceptance/auth-engine-rewrite.spec.ts`
- [x] T174 [P] Update security/privacy inventory for sessions, OAuth credentials, OTPs, passkeys, notification data, audit retention, and deletion processing in `test/compliance/inventory-audit.spec.ts`
- [x] T175 [GATE] Run `bunx jest test/auth-engine-rewrite --runInBand` and `bun run test`; require 100% pass with no skipped required test and record results in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T176 [GATE] Run `bun run test:atdd`, `bun run test:bdd`, `bun run test:acceptance`, and `bun run test:e2e`; require every mapped example and 100% overlay fixture parity and record reports in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T177 [GATE] Run `bun run test:coverage`; require global ≥50% branches, ≥65% functions, ≥60% lines/statements and changed auth/migration/lifecycle code ≥90% branches and ≥95% functions/lines/statements; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T178 [GATE] Run `bun run app:lint`, `bun run app:prettier:check`, and `bun run app:typecheck` with no new suppression; record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T179 [GATE] Run `bun run app:build`, `bun run app:check-action-manifest`, and `bun run test:compliance`; require all pass and record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T180 [GATE] Run `bun audit --audit-level=high`; resolve or explicitly approve every high/critical advisory and record evidence in `specs/002-auth-engine-rewrite/defect-log.md`
- [x] T181 [GATE] Run and retain the five deliberate-mutant checks for deny-by-default authorization, invitation replay, migration idempotency, deletion timing, and non-destructive downgrade in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T188 [P] Implement the deterministic performance harness for local authorization, database session resolution, Twitch onboarding, and invitation acceptance in `scripts/auth-performance-check.ts`
- [x] T189 [GATE] Run `bun run test:auth-performance`; require authorization p95 ≤100 ms, database session p95 ≤200 ms, and both user journeys <3 minutes; record distributions and environment in `specs/002-auth-engine-rewrite/test-summary.md`
- [ ] T182 [GATE] After US4 and US5 are Green, run the final disposable-PostgreSQL dry-run/apply/validate/smoke/rerun and `bun run auth:legacy-check`; require every invariant Green, zero duplicates/legacy consumers, and ≥25% timing headroom in `specs/002-auth-engine-rewrite/test-summary.md`
- [ ] T190 [GATE] After T182, review `contracts/legacy-auth-contraction-runbook.md` and prepare the separately operator-approved post-cutover schema-only pull-request plan; forbid handwritten or locally generated `drizzle/` artifacts on this branch, require the `master` Generate Migrations workflow to own the later contraction migration, and require that generated migration to pass disposable-database rehearsal before production approval
- [ ] T183 [GATE] Reconcile every artifact/source/scenario row, command, status, and evidence link; forbid dangling or duplicated coverage in `specs/002-auth-engine-rewrite/test-traceability.md`
- [ ] T184 [GATE] Close/verify or explicitly defer every defect with owner, risk, expiry, and compensating evidence in `specs/002-auth-engine-rewrite/defect-log.md`
- [ ] T185 [GATE] Publish final execution totals, coverage, traceability, defects, risks, approvals, and evidence-based Go/No-Go recommendation in `specs/002-auth-engine-rewrite/test-summary.md`
- [ ] T186 [GATE] Update the rolling aggregate without duplicating feature evidence in `reports/test-summary.md`
- [ ] T187 Validate every developer and rehearsal command in `specs/002-auth-engine-rewrite/quickstart.md`

---

## Phase 10: Convergence — Production Runtime and Cutover Wiring

**Purpose**: Close implementation gaps discovered after the first complete pass. These tasks are prerequisites for the still-open Phase 6 and Phase 9 gates; they do not authorize a production cutover or contract migration.

- [x] T191 [US3] [TDD] Extend `TDD-US3-004` and focused integration coverage so every remaining `editorsTable`-backed protected operation fails the contract until live Better Auth membership/role or accepted agency access, permission, ownership, entitlement, lifecycle, and recent-auth checks flow through the central server-side authorization boundary in `test/auth-engine-rewrite/contract/protected-boundaries.test.ts` and focused action tests
- [x] T192 [US3] Replace every production editor-authorization read/write in `src/app/actions/`, `src/app/api/`, and `src/server/` with organization membership, custom-role, and live agency-intersection resolution feeding `authorize()`; retain the legacy editor table only as a cutover source until the separately approved post-cutover contraction pull request
- [x] T193 [US3] [GATE] Re-run the protected-boundary contract, focused action suites, and `bun run auth:legacy-check`; require zero legacy editor-authorization consumers and record the exact boundary inventory in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T194 [US6] [TDD] Add subprocess and disposable-PostgreSQL integration tests that invoke the real `auth:migrate` CLI and prove preflight/backup blocking, maintenance persistence, checkpoint commits, safe resume, idempotent rerun, originating-error preservation, manifest output, no implicit restore, and fail-closed reopen behavior in `test/auth-engine-rewrite/migration/cutover-cli.test.ts`
- [x] T195 [US6] Implement real database-backed cutover repositories and wire `scripts/auth-cutover.ts` to dry-run/apply/resume/validate/smoke modes, verified backup attestation, maintenance state, checkpointed creator/membership/provider-account conversion, invariant comparison, smoke execution, and signed/checksummed manifest output without adding generated `drizzle/` artifacts
- [x] T196 [US6] [GATE] Re-run `TDD-US6-001` through `TDD-US6-003`, the real CLI subprocess suite, and US6 BDD/ATDD; require tests to observe persisted database and process outcomes rather than only pure fixture state and update `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T197 [US6] [TDD] Add a database-backed credential-switch test proving legacy AES-GCM conversion, Better Auth account readability, exactly one serialized Twitch refresh, atomic rotation, revoked-token failure preservation, and zero fallback to the custom refresh runtime in `test/auth-engine-rewrite/migration/provider-credential-switch.test.ts`
- [x] T198 [US6] After validated credential conversion evidence and explicit operator approval of the runtime switch, make encrypted Better Auth account storage the sole Twitch refresh authority and remove production calls/defaults for the legacy token/custom-refresh runtime in `src/server/tokens.ts`, `src/server/twitch-auth.ts`, and `src/app/actions/twitch.ts`
- [x] T199 [US6] [GATE] Re-run the credential-switch suite, provider integration tests, application smoke, and `bun run auth:legacy-check`; require zero custom-refresh consumers before T112, T114, T182, or T190 may complete and record evidence in `specs/002-auth-engine-rewrite/test-traceability.md`
- [x] T200 [P] Add focused branch/function/line coverage for the real session, membership, invitation, rate-limit, notification-outbox, agency, lifecycle, and cutover database adapters until the changed-code threshold required by T177 is met without excluding production files
- [ ] T201 [US6] [GATE] Execute T114 and T182 only after T191–T200 are Green, using both the anonymized and 2× disposable PostgreSQL datasets; retain CLI logs, manifests, invariant counts, rerun duplicate counts, legacy-scan output, and timing headroom as evidence
- [x] T202 [US2] After exact operator approval for the custom migration, add the idempotent PostgreSQL trigger/function that provisions the stable creator record, creator organization, identity link, and owner membership inside a new Twitch Better Auth account transaction; ordinary Drizzle generation cannot express this behavior and no generated `drizzle/` artifact may be added without that approval
- [x] T203 [US2] [GATE] Prove T202 on disposable PostgreSQL with real Better Auth account insertion, rollback on rejected domain state, retry/idempotence, returning-account no-op, profile synchronization, backfill suppression, and creator/organization/owner invariants before T114 or T182 may run

---

## Dependencies and Execution Order

### Phase dependencies

1. **Setup (Phase 1)** starts immediately.
2. **Foundational fixtures (Phase 2)** depend on Phase 1 and block all stories.
3. **US2 (Phase 3)** establishes identity, Twitch onboarding, and the base auth schema.
4. **US3 (Phase 4)** depends on US2 and establishes authorization, organizations, invitations, credentials, abuse controls, audit, and outbox.
5. **US1 (Phase 5)** depends on US2 and US3 so migrated creators/editors can target real identities, memberships, and sessions.
6. **US6 (Phase 6)** depends on US1–US3 and builds/tests cutover tooling, but does not authorize reopen, final switch, or contract migration.
7. **US5 (Phase 7)** depends on US3 authorization/outbox and must complete its non-destructive downgrade slice before US4 allocations.
8. **US4 (Phase 8)** depends on US3 plus US5 Slice A; it can otherwise progress independently of later US5 lifecycle slices.
9. **Release gates (Phase 9)** depend on every story selected for release; final rehearsal, reopen/switch evidence, and contract promotion specifically require US4 and US5 Green.

### Red–Green–Refactor ordering

For every behavior slice, preserve this order without batching future Red tests:

1. Add only that slice’s executable TDD/BDD/ATDD evidence.
2. Run the focused suite and retain an intentional Red result.
3. Implement the smallest production change that makes it Green.
4. Re-run the focused suite Green.
5. Refactor and re-run while Green.
6. Update traceability, defects, and summary evidence before the next slice.

### Parallel opportunities

- T002–T006 can run in parallel after T001.
- T010–T019 can run in parallel after the setup checkpoint.
- Scenario text and step-definition work may proceed in parallel only when it touches different suite files; edits to the shared ATDD or BDD feature file must be serialized.
- Within US3, mail-adapter implementation can proceed beside limiter/audit work after the shared Red test exists.
- US5 account lifecycle work and US4 agency-link work may proceed in parallel only after US5 Slice A is Green and shared schema migrations are serialized.
- T173, T174, and T188 can run in parallel after all story behavior is Green; gates T175–T181 and T189 can run in parallel where they do not contend for the same database/server, while T182, T190, and T183–T187 remain ordered by their stated evidence dependencies.

### Parallel example: US3

```text
After T060–T061 establish the Red security-controls slice:
- Implement database limiter/audit/outbox logic in src/auth/rate-limit.ts, src/auth/audit.ts, and src/server/notifications/outbox.ts
- Implement the UseSend port in src/auth/transactional-mail.ts
Then combine and run T065 before refactoring.
```

### Parallel example: US4 and US5

```text
After T121–T126 make non-destructive downgrade gating Green:
- Continue US5 account deletion work in src/server/account-lifecycle/
- Begin US4 agency link work in src/server/agencies/
Serialize src/db/schema.ts and drizzle/ migration edits and rerun both focused suites after integration.
```

---

## Implementation Strategy

### P1 continuity tranche

The smallest demonstrable P1 tranche is Setup + Foundations + US2 + US3 + US1. It proves creator onboarding, least-privilege delegation, migration continuity, and overlay survival. It is **not production-releasable** until US6 cutover gates are Green.

### Production release tranche

Complete US6, rehearse twice on production-shaped disposable data, and require all P1 gates before any maintenance-window cutover. US5 and US4 may ship later only if their schema and authorization additions remain additive and all selected-release gates are rerun.

### Full feature delivery

Complete US5 before enabling agency removal/allocation behavior in US4. Finish Phase 9 and use the evidence—not task completion alone—to make the Go/No-Go decision.

---

## Evidence Coverage Decisions

- **Gherkin feature ownership**: `test/atdd/features/auth-engine-rewrite.feature` owns 14 base ATDD scenarios that also provide BDD evidence where the spec records equivalence; `test/bdd/features/auth-engine-rewrite.feature` owns 16 distinct BDD base scenarios. No equivalent scenario is duplicated between suites.
- **Expanded scenario coverage**: 57 planned example rows are maintained in `specs/002-auth-engine-rewrite/test-traceability.md`; every outline example has its own row. Risk-based representative sampling is allowed only for equivalent permission CRUD denials, and checkpoint pairwise sampling is allowed only if every state-transition boundary remains represented.
- **BDD/ATDD N/A decisions**: None. All six stories require both BDD and ATDD evidence.
- **Mutation gate**: General mutation score is N/A because no runner is installed. Five deterministic deliberate-mutant checks are mandatory and recorded by T181.
- **Traceability/report destinations**: Canonical mappings and execution evidence live in `specs/002-auth-engine-rewrite/test-traceability.md`; defects live in `specs/002-auth-engine-rewrite/defect-log.md`; feature totals/risks/recommendation live in `specs/002-auth-engine-rewrite/test-summary.md`; rolling aggregate lives in `reports/test-summary.md`.
- **Identifier consistency**: Every task/story label and suite artifact reuses `US1`–`US6`; no parallel story alias is introduced.

## Completion Definition

- Every selected task is checked only after its exact command/evidence succeeds.
- No implementation task precedes the required Red evidence for its behavior slice.
- All required TDD inventory categories—happy paths, boundaries, invalid inputs, transitions, integration contracts, originating errors, deterministic controls, and every EC-001–EC-015 path—are represented.
- Every mandatory gate is Green or has an explicitly approved scoped exception with compensating evidence.
- The final recommendation in `specs/002-auth-engine-rewrite/test-summary.md` is based on reproducible evidence.
