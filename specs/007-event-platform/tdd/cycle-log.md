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

## Cycle 10 — trusted source resolution

Red: absent sources module (`/tmp/events-sources-red.log`). Green: 4/4 whole-file tests: pasted URL resolves canonical provider metadata, foreign/under-view clips rejected, invalid choice/unsafe links rejected, direct URL autocomplete uses same resolver. YouTube/game/upload adapters remain pending.

## Cycle 11 — public persisted read

Red: absent public-read module (`/tmp/events-read-red.log`). Green: persistence whole file 10/10 includes unpublished denial, valid/invalid/rotated secret and safe public projection. Counts queried only for released results or eligible presenter.

## Cycle 12 — action identity

Red: absent action module (`/tmp/events-actions-red.log`). Green: 2/2 verifies unauthenticated denial and server-principal delegation. Other action branches inherit shared service boundaries; whole-flow acceptance remains pending.

## Cycle 13 — creation defaults and library recovery

Red: absent eventDefaults and EventLibrary (`/tmp/events-defaults-red.log`, `/tmp/events-library-red.log`). Green: 2/2 tests verify valid future local-timezone unlisted defaults and preservation of entered title after failed creation. Initial mocked TextField did not propagate labels/value; controlled Input now has explicit accessible name and state. Real installed-component browser journey specified separately before editor implementation.

## Cycle 14 — event editor and roadmap

Red: absent EventEditor (`/tmp/events-editor-red.log`), then real browser reaches newly created draft but editor is absent (`/tmp/events-creator-browser-red2.log`). Editor, category fields, source conditions and ordered deck settings implemented with installed HeroUI/Pro.
Green: editor draft-preservation test passes. Real BDD-US1-101 browser journey passes (7.1s test, 13.1s run, `/tmp/events-creator-browser-green3.log`). A prior browser check found duplicate DatePicker accessible names; removed redundant aria-label rather than weakening the intended single-name assertion.

## Cycle 15 — scoped event team role

Red: event-manager permissions missing (`/tmp/events-permissions-red.log`). Green: event permissions + existing role-assignment + persistence files passed 16 tests. Role added through authorization, Better Auth statements, role assignment and team selector; services now request event-specific permissions.

## Cycle 16 — short Explore tour

Red: missing Events route/progress (`/tmp/events-tour-red.log`). Green: tour + editor + library files pass 3 tests. Events placed after Clip layouts; exactly one informative Explore step, no creation journey.

## Cycle 17 — participant identity and creator promotion

Red: missing participant module (`/tmp/events-participant-red.log`); creator-only scope default fails new assertion (`/tmp/events-scope-red.log`); viewer login incorrectly redirects (`/tmp/events-promotion-red.log`).
Green: participant test passes; auth callbacks/LoginClient/Runner linking/Runner connections whole files pass 143 tests including real OAuth probes. Login page whole file passes 10 tests. Creator permissions now requested contextually; viewer callback only reduces onboarding privileges.

## Cycle 18 — public interactions and media

Red: missing submit action (`/tmp/events-public-actions-red.log`), missing media component (`/tmp/events-media-red.log`), missing public page (`/tmp/events-public-page-red.log`), game source returns unavailable (`/tmp/events-game-red.log`). Green: action/source files 7 tests; media 2; public-page/source files 6. Standard mock Checkbox had no input behavior; a local functional adapter preserves selection assertions. Real browser submission/voting/media journeys still required.

## Cycle 19 — creator-owned S3 transport

Red: missing storage-http (`/tmp/events-storage-http-red.log`). Green: 20 tests including official AWS GET signature and reserved/mapped/private IPv4/IPv6 addresses. First implementation mixed IPv6-mapped blocks into IPv4 checks and rejected public IPv4; removed redundant IPv6 blocks, keeping global-unicast allow restriction. DNS pinning/upload lifecycle integration still pending.

## Cycle 20 — contextual Google and YouTube sources

Red: missing connection and YouTube adapters. Green: connection tests initially 2, YouTube 11, sources/configuration/defaults 27; real auth callback file 51. Connection intents bind the session, creator, requested scope and selected Google account. Video search resolves full public, embeddable metadata and rejects other channels without maintaining an index.

## Cycle 21 — bounded media upload validation

Red: missing upload-policy module. Green: 3 tests (`/tmp/events-upload-policy-green.log`): supported types/size, magic-byte validation across chunks, truncated and oversized body rejection. Transport integration remains pending.

## Cycle 22 — withdrawn proposals and closed selections

Red: withdrawn candidates remained nominated, and closed cards lacked an explicit saved-choice label. Green: persistence whole file 11 tests and media 3 tests (`/tmp/events-closed-selection-green.log`). Last active withdrawal removes nomination; replacement and repeat canonical submissions still work. Voting controls now remain visible but disabled during persistence. The participant browser journey reached voting, then was blocked by an unhandled consent banner in the fixture; the fixture now exercises the existing consent rejection flow rather than forcing clicks.

## Cycle 23 — creator S3 connection and settings recovery

Red: `saveEventS3Connection` missing (`/tmp/events-s3-connect-red.log`); storage settings component missing (`/tmp/events-storage-settings-red.log`). Green: native connection whole file 4 tests (`/tmp/events-s3-connect-green.log`), including successful encrypted persistence and failed replacement preserving the original row. UI recovery passes after using a modal/loading-aware fixture; existing editor panel isolated in its recovery test. Secret credentials clear only after success. Storage upload integration and real browser connection setup remain pending.

## Cycle 24 — held review and authorized group table

Red: a review held beyond its planned voting start rejected nomination (`/tmp/events-review-hold-red2.log`); authorized review read and team table missing (`/tmp/events-review-read-red.log`, `/tmp/events-review-ui-red.log`). Green: persistence whole file 13 tests (`/tmp/events-review-read-green.log`); team table + existing editor 2 tests (`/tmp/events-review-ui-green.log`). Unreleased review can continue until voting ends; votes remain blocked until explicit release; nominees lock upon release. Review table supports filtering, bulk nomination, common group title and expandable originals. Nested group creation is rejected; original viewer receipts remain untouched. Real browser review acceptance still pending.

## Cycle 25 — provider file transfer, receipt and private playback

Red: provider uploader, upload service, route, upload form and media service missing (`/tmp/events-upload-provider-red.log`, `/tmp/events-uploads-red.log`, `/tmp/events-upload-route-red.log`, `/tmp/events-upload-ui-red.log`, `/tmp/events-upload-media-red.log`). Green: provider file 3 tests; upload service/media 3; upload route 2; file-form recovery 1. Completed transfer metadata is checked before receipt creation, and receipt creation checks the submission phase again under the event lock. Crossing the deadline removes provider bytes and creates no receipt. Drive resumable-session URLs remain server-side. S3 uses DNS-pinned signed requests. The application retains metadata only; playback proxies supported media with safe headers and range support. Original files remain private until nomination or an authorized own/team preview.

## Cycle 26 — upload publishing, cleanup and retained media

Red: upload publishing was a placeholder (`/tmp/events-upload-publish-red.log`); cleanup runner missing (`/tmp/events-upload-cleanup-red.log`); changing a used bucket broke retained files (`/tmp/events-storage-preserve-red.log`); stored-image nominee had no thumbnail (`/tmp/events-upload-thumbnail-red.log`). Green: upload/cleanup whole file 5 tests; storage connections 5; media + storage-security 24. Publishing verifies connected storage belongs to the event creator. Stale uploads retain durable object keys until cleanup succeeds. Replacing a used endpoint/bucket is rejected while credential rotation remains possible. Uploaded image cards use stored media thumbnails. Full TypeScript check passed (`/tmp/events-typecheck-current3.log`) and browser build 5 passed; new browser image journey execution pending.

## Browser acceptance checkpoint

Creator setup/roadmap passed against build 4. Participant proposal → withdrawal → replacement → vote → reload → closed saved choice passed against build 4 (`/tmp/events-participant-browser-green5.log`, 8.8s). The first voting fixture tried to click HeroUI's intentionally hidden native input; changed it to click the actual visible label, keeping checked-state and database assertions. No force click or product-policy relaxation.

## Cycle 27 — deployment upload origin and real Drive playback

The first real Drive upload returned ACCESS_DENIED before any provider call. Red reproduced the public HTTPS host behind an internal Next origin (`/tmp/events-upload-origin-red.log`). Green uses the same validated forwarded-protocol/Host convention as existing Clipify export routes; upload route whole file 3 tests (`/tmp/events-upload-origin-green.log`). Foreign-origin rejection stays intact. Real browser upload → stored image nomination → full-size image loaded successfully against build 6 (`/tmp/events-upload-review-browser6.log`, 8.5s), with only Google transport controlled. The fixture supplies Google provider configuration and uses real stored OAuth-token retrieval.

## Cycle 28 — Pro lock and withdrawn file retention

Red: unavailable white-label toggle changed value instead of opening upgrade (`/tmp/events-pro-lock-red.log`); withdrawn image remained completed (`/tmp/events-upload-withdraw-red.log`). Green: editor 2 tests (`/tmp/events-pro-lock-green.log`); uploads + persistence 19 tests (`/tmp/events-upload-withdraw-green.log`). Existing upgrade modal opens without changing the unavailable setting. Withdrawing a final file proposal queues deletion through the durable cleanup worker.

## Browser review checkpoint

Team group → common display title → nominate group → release review after planned voting start → public single nominee without originals passed against build 6 (`/tmp/events-review-browser-green7.log`, 9.7s). The first fixture assumed an exact checkbox name, but the installed table appends row-header text. The fixture now scopes to the actual proposal row and selects with keyboard Space; policy and UI assertions unchanged. Build 6 includes a complete TypeScript check. Lint checkpoint: `/tmp/events-lint-current5.log`.

## Cycle 29 — frozen and manual data awards

Red: snapshot service missing (`/tmp/events-freeze-red.log`); observation crossing cutoff was accepted (`/tmp/events-freeze-deadline-red.log`); manual result service missing (`/tmp/events-manual-results-red.log`); archive published with missing results (`/tmp/events-result-publish-red.log`); public projection substituted unfrozen settings (`/tmp/events-frozen-projection-red.log`). Green: freeze + persistence 19 tests (`/tmp/events-result-publish-green.log`), projection/public page 4 (`/tmp/events-frozen-projection-green.log`), management panels 4 (`/tmp/events-data-ui-green.log`). Snapshot timestamps account for elapsed work and late observations are discarded. No later live counter is substituted for missed historical data; incomplete libraries require manual confirmation. Manual entries retain explicit provenance and lock after publication. Real manual watchtime entry → explicit publication → archive passed against build 7 (`/tmp/events-data-browser-green8.log`, 8.6s). NumberField's installed input is a textbox, not a spinbutton; browser locator corrected without changing value assertions.

## Cycle 30 — team nominations and static option lists

Red: team options not seeded, team candidate service missing (`/tmp/events-team-candidates-red.log`); team uploads went through viewer rules (`/tmp/events-team-upload-red.log`, `/tmp/events-team-upload-route-red.log`). Green: persistence 15, upload lifecycle 7, upload route/form 5; source lookup 7. Configured team choice lists are seeded at publication. Text/media candidates use the same trusted source and upload validation with server-verified team authority, and create no viewer receipt. Team authority and phase are rechecked after file transfer. Browser team text addition + grouping/review release and team image addition → public playback passed against build 8 (`/tmp/events-team-browser8.log`, 10.8s/9.6s). TypeScript and build 8 passed. Team/data panel regression checkpoint: `/tmp/events-team-data-ui-green.log`.
