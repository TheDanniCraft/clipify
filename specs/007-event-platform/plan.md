# Implementation Plan: Event Platform — Awards

Branch: `feature/event-platform`. Scope: complete agreed Babbler Awards flow; no optional predictions/polls or automatic YouTube rankings.

## Technical Context

Bun, TypeScript, Next.js App Router, React, PostgreSQL/Drizzle, Better Auth, installed HeroUI/Pro, motion, existing creator authorization/MCP infrastructure. Source modules live in `src/server/events/` with shared schemas/pure phase policy in `src/app/lib/events.ts`; UI in `src/app/components/events/`, routes `/dashboard/events`, `/events`, `/events/[id]`, `/events/[id]/present`. Keep event-type policy separate from persistence; only Awards implemented.

## Constitution Check

Mandatory test-first Red/Green per behavior, one executable owner, shared BDD/ATDD only for identical acceptance boundaries. Never use shared/production fixtures. Do not generate migration artifacts; edit schema only. Existing thresholds and required CI remain unchanged. No scope expansion through quality work.

## Phase 0: Research

Inspect existing creator authorization, account linking, clip library/filter/cache, branding, tour, native MCP and browser fixtures. Use Mobbin for setup, submission, review, voting and presenter interaction patterns. Resolve provider permissions and safe media delivery before claiming uploads complete. Research decisions retained in research.md.

## Phase 1: Design

See data-model.md and contracts/events.md. Use typed action results, creator authorization before resource access, transactional event row locks for limits/votes/grouping/phase writes and frozen snapshot idempotence. Public read DTOs must omit votes/results until explicit publication, personal identities and secrets. Secrets are random, hashed at rest and rotated. Creator credentials encrypted using existing encryption helper. Public media delivery is tied to accepted event assets, never arbitrary URLs.

## Test Plan and incremental delivery

Setup existing stack, then test/implement shared schedule/schema policy, persistence/permissions, participant auth, sources/storage, review/freeze, voting, presenter/chat, publication/MCP/tour. Each behavior starts with a real failing executable test before its production implementation. Browser outer loop spans complete creator/team/viewer/presenter journeys with deterministic provider fixtures. Native service tests own transactional rules; browser tests own real component interaction/media/navigation/layout.

### Commands and gates

- Inner whole-file Jest: `bun run test --runInBand --runTestsByPath <file> --coverage=false`.
- Browser prerequisites and environment: docs/local-testing.md; disposable loopback PostgreSQL and job-owned MCP_TEST_TEMPLATE_ID, installed Chromium dependencies.
- Browser: `bun run test:e2e:build`, `bunx bddgen`, then targeted `bunx playwright test --project=bdd-chromium <generated-file> --workers=1`.
- Required CI: existing `bun run test:coverage` owning lanes, all owning browser scenarios, `bun run app:lint`, `bun run app:prettier:check`, `bun run app:typecheck`, `bun run app:build`, migration policy and existing security/dependency gates. No lowered thresholds.
- Run scoped whole-file tests and relevant browser journeys before pushing a coherent slice. Full CI owns expensive complete validation before merge.
- Mutation tool unavailable in current profile: deliberate mutant spot checks for phase/authorization/result-secrecy boundaries, not a new dependency.
- Gate evidence retained in CI artifacts and feature traceability registry. cycle-log.md retains local Red/Green evidence. No speculative pass claims.

## Overall Test Summary Destination

Rolling: `reports/test-summary.md`; no release ID because this is a feature PR.

## Completion boundary

All required FR/SC/EC evidence passes, complete Babbler pilot rehearsal succeeds, no open release-blocking defects, normal reviewable PR opened. Incomplete work uses a draft PR with explicit remaining tasks, never a false completion claim.
