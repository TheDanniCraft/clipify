# TDD Cycle Log

Baseline: existing stack profile retained. Feature checks pending; full local coverage owner not started per repository push-checkpoint policy.

## Cycle 1 — phase boundaries (U5/U16; FR-005/FR-016, EC-001/EC-006)

Baseline: existing consentOrigins whole-file suite passed 3/3 outside sandbox with Node 26.13.0. Sandbox subprocess output limitation confirmed; no product/config change needed.
Red: `test/server/events/policy.test.ts` failed resolving absent `src/app/lib/events` before production file existed; output `/tmp/events-policy-red.log`.
Change: strict timezone/ordered schedule validation and half-open server phase boundaries, review release, draft/results precedence.
Green: 14/14 tests passed in policy.test.ts (Node 26.13.0, 0.605s). No unrelated behavior added.

## Cycle 2 — configuration validation

Red: missing eventConfiguration module, `/tmp/events-config-red.log`. Green: policy + configuration whole files passed 32/32 tests. Covers all supported source discriminators, choices, unlimited submission limit, invalid title/vote count/categories and duplicate IDs, reversed source dates. No refactor needed.

## Cycle 3 — event persistence and optimistic revision

Red: absent persistence module, `/tmp/events-persistence-red.log`. Implementation adds schema-only event table, creator-scoped locked create/read/update, hashed presenter secret and expected revision guard. First Green attempt exposed a test fixture missing the schema UUID default; corrected fixture, not production semantics. Final Green recorded after rerun.

Persistence Green: 4/4 PGlite tests passed (1.736s), including secret hashing, foreign authority denial, invalid input and stale revision retention.

## Cycle 4 — viewer callback privileges (FR-007)

Red: new participant callback case fails because completeTwitchSignIn runs twice; 48 existing cases passed (`/tmp/events-auth-red.log`).
Change: verified OAuth-state event callback marker suppresses creator provisioning, welcome and creator access restoration, without granting any privileges.
Green: all 49 auth-config-callbacks tests pass. Full installed OAuth participant probe and intentional viewer→creator transition remain pending; this unit evidence alone does not complete FR-007.

## Cycle 5 — candidates (FR-008/013/017/021)

Red: absent eventCandidates module (`/tmp/events-candidates-red.log`). Green: 7/7 tests covering canonical IDs, independent text entries, host/date/view/title restrictions, group visibility, shared/team ties, zero votes and unsafe media protocols. No refactor needed.

## Cycle 6 — publication lifecycle

Red: absent lifecycle module (`/tmp/events-lifecycle-red.log`). Green: persistence whole file 6/6. Explicit publish is required, results rejected before voting end, repeated publish is idempotent, published configuration guarded and secret rotation changes capability. Upload-backed publication remains safely blocked until storage connector integration.

## Cycle 7 — submission quota and withdrawal

Red: absent submissions module (`/tmp/events-submissions-red.log`). Green: persistence whole file 8/8. Tests cover original retention, quota at limit, recovery by withdrawal, foreign withdrawal denial, source mismatch and submission-close boundary. External-source metadata still requires trusted adapter integration before exposing submit publicly.

## Cycle 8 — review and voting composition

Red: absent review/voting modules (`/tmp/events-review-red.log`). Green: persistence whole file 9/9. One SQL-backed scenario groups two text proposals, rejects independent child nomination, preserves original personal text, nominates the group, releases review, changes/clears own vote and rejects excess/closed voting. Refactor: shared review transaction helper retains creator lock and authority recheck.

## Cycle 9 — public projection secrecy

Red: absent eventPublicView module (`/tmp/events-public-red.log`). Production projection explicitly selects safe fields and hides data categories/results before release. Green pending below.
