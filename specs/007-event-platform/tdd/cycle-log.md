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

## Cycle 31 — CI caller and account-export integration

First draft CI completed: build, lint, formatting, action-manifest boundary and typecheck passed; scoped tests failed in settings/recovery exact OAuth expectations, the MCP-owned startup fixture importing a new unrelated scheduler, and the account-export table inventory. Kept exact OAuth assertions and included the now-contextual creator scopes; isolated the award startup worker just like the existing unrelated workers. Those whole files pass 66 tests (`/tmp/events-ci-callers-green.log`).

New event export ownership test Red: helper absent (`/tmp/events-export-red.log`). Green: native event ownership + archive unit files 12 tests (`/tmp/events-export-green.log`); complete existing account-export integration owner 10 tests (`/tmp/events-export-integration-green.log`). Creator-owned content/storage metadata is exported; private participant receipts/votes are scoped only to the actor. Personal uploads on another creator's event omit that creator's storage key/connection, and credentials stay in the security archive section. No table-inventory exclusion or threshold change was used to pass the gate.

## Cycle 32 — presenter capability, deck and publication

Red: missing step planner (`/tmp/events-presenter-plan-red.log`), presentation save (`/tmp/events-presentation-settings-red.log`), presenter publication (`/tmp/events-presenter-publish-red.log`), route classification (`/tmp/events-presenter-embed-red.log`). Green: planner 2; presentation/config/defaults 37; presenter/persistence 20; presenter interaction/planner/route isolation 22 (`/tmp/events-presenter-ui-green.log`). The default deck is materialized before adding custom slides so statistics do not silently remove categories. Published events can save only presentation settings; source/voting rules stay locked. Public reads reject disabled owners and recheck white-label entitlement. The PostgreSQL presenter tests verify revoked capabilities, private identity exclusion, closed voting and explicit publication using the same locked result validation as dashboard publication. The existing minimal persistence fixture gained the owner-disabled field used by the new public boundary.

UI recovery guards and presenter component interaction tests were verification-first rather than claimed as test-first evidence. They cover preserving drafts before a contextual Google redirect, keyboard navigation, manually enlarged media, closing winners and explicit final publication.

## Cycle 33 — live chat

Red: missing bounded chat buffer (`/tmp/events-chat-buffer-red.log`). Green: buffer 3; catalog/buffer/presenter 6 (`/tmp/events-chat-green.log`); native capability/chat access 4 (`/tmp/events-chat-access-green.log`); whole signed EventSub route 18 (`/tmp/events-chat-eventsub-green.log`). Chat uses the existing authenticated Clipify bot EventSub path, never an anonymous IRC assumption. Relay accepts only validated messages after signature verification, keeps 50 messages for at most a minute on active presenter channels, and filters hidden accounts and configured command prefixes. Twitch badges and Twitch/7TV emotes use fixed providers and validated CDN URLs; provider bodies and requests are bounded. Catalog parsing and signature-integration checks are recorded as verification, not retroactive Red evidence. Like existing overlays, the transient relay is process-local; replicas require shared pubsub.

Browser presenter checkpoint: BDD-US5-107 passed build 9 (`/tmp/events-presenter-browser9.log`, 8.3s): manual nominee enlargement/escape, winner reveal, public secrecy during the show, explicit last-slide publication and public archive.

## Cycle 34 — partner discovery and complete MCP management

Red: public discovery service absent (`/tmp/events-discovery-red.log`); MCP schemas and shared service facade absent (`/tmp/events-mcp-red.log`); team tie decision absent (`/tmp/events-tie-red.log`). Green: partner listing native query 1, discovery recovery UI 1; presenter/persistence/tie rules 22; affected MCP registry/risk/scope/consent callers 163 (`/tmp/events-mcp-callers-green.log`). The actual OAuth+MCP journey also passes (`/tmp/events-mcp-native.log`): tool discovery, draft creation/update, publication, team candidates/group/nomination/release, frozen manual result, presenter secret rotation and explicit archive publication. Standard reads and creation do not expose presenter credentials. Existing official-client/capabilities contracts pass 15 tests with the complete public tool count updated from 76 to 92 (`/tmp/events-mcp-catalogue-callers.log`). No original tool or scope was removed.

## Cycle 35 — browser findings and requested clip attribution

The first real chat check found a fixture credential mismatch; fixed the controlled provider to use browserProviderEnvironment's canonical secret. The unchanged application then passes signed EventSub → chat rendering → Twitch badge and 7TV emote image delivery with account/prefix filtering (`/tmp/events-chat-browser10b.log`, 9.8s). The responsive browser check found that the original nominee DOM node is unmounted during large-media viewing; focus restoration now resolves the newly mounted nominee by its stable candidate ID. This is a product fix, not a weakened focus assertion.

Red: presenter data categories appeared only at vote close and would shift the running deck (`/tmp/events-presenter-stability-red.log`); clipper attribution was discarded from source suggestions (`/tmp/events-clip-attribution-red.log`). Green: public projection/presenter interaction 6; source/candidate rules 16 (`/tmp/events-presenter-stability-green.log`, `/tmp/events-clip-attribution-green.log`). Presenter category positions are stable while results remain hidden. Trusted clipper name, duration and localized creation date now accompany thumbnail/title in the single autocomplete. Verification-only: full nineteen-category pilot fixture, not a product preset.

Whole-file checkpoint before these last two small fixes: 15 affected event/export/webhook/public-page files, 82 tests passed (`/tmp/events-show-whole-files10.log`). Browser build 11, including TypeScript, passed. Further browser and final slice evidence remains separate.

## Cycle 36 — final browser acceptance gaps

Red: the active mobile phase was clipped (`/tmp/events-progress-browser-red.log`); native image/audio/video failures had no retry (`/tmp/events-media-retry-red.log`, three intended failures). Green: media file 7 (`/tmp/events-media-retry-green.log`). Current-phase visibility now keeps the installed Stepper's active item in view, including on resize. BDD-US5-109 passes against build 12 with full current-step visibility, keyboard tab selection, media Escape/focus return, and desktop/phone light/dark screenshots (`/tmp/events-convergence-browser12.log`, 15.6s). Screenshots are inspected after waiting for the real category animation, not during its opacity-zero first frame.

BDD-US5-108 now verifies signed chat delivery plus Twitch badges, Twitch emotes and 7TV emotes with hidden account/command filtering (9.4s). BDD-US5-113 verifies creating a statistic, editing its number, arranging it before a category, saving the published deck and presenting the counted value (10.6s). BDD-US1-111 verifies publishing all nineteen supplied pilot categories with connected creator-owned storage (`/tmp/events-layout-pilot-browser11b.log`). These remain acceptance verification rather than retroactive test-first claims.

The first clip browser assertion matched both the product error and Next's route announcer. It now scopes to the product main content; the unchanged expected eligibility message is retained. Final clip selection and final full journey evidence are recorded separately below.

## Cycle 37 — completed-slice strength and public lifecycle consistency

The complete event suite passed 39 files / 180 tests (`/tmp/events-feature-final13.log`, 17.3s). Explicit persistence benefit checks then passed the whole 19-test file (`/tmp/events-benefit-boundaries-green.log`), including server-side Pro denial without writes and rechecking partner access at publication. Real simultaneous PostgreSQL quota, deduplication and ballot replacement checks passed (`/tmp/events-concurrency-green.log`); these are bounded concurrency contract verification, not a load-test program.

Three temporary deliberate mutants were killed: accepting the exact closed-voting deadline (2 failures), revealing unpublished results (3 failures), and exposing grouped children (1 failure). Source was restored in `finally` after each check (`/tmp/events-mutant-deadline.log`, `/tmp/events-mutant-result-secrecy.log`, `/tmp/events-mutant-group-children.log`). No exhaustive mutation percentage is claimed.

Red: a stale page could still submit after the creator was disabled (`/tmp/events-disabled-host-red.log`). Green: concurrency, persistence, uploads and sources whole files 39 checks (`/tmp/events-disabled-host-green.log`). Public read and media already rejected disabled owners; writes/source lookup now share that policy. The owner lifecycle share lock precedes the event lock, matching management lock order. The existing source routing fixture was updated for the locked transaction; its expectations were retained.

The first 13-journey combined browser checkpoint passed 11; the team-image fixture clicked an ARIA tab before the existing hydration-ready fieldset, and the clip assertion did not account for the open suggestions popover and accessible metadata. The fixture now waits for the actual enabled save control, and eligibility feedback is rendered inside the active popover. Real image outage → retry and team image → voting both passed the scoped retake (`/tmp/events-browser-recovery13b.log`); no timeout or assertion was weakened. Chat settings are now configured through the actual dashboard instead of direct fixture state and the signed-reaction journey passes (`/tmp/events-picker-chat-browser14.log`, 11.5s). Final clip and full-slice gate evidence follows separately.


Final source-picker proof: BDD-US2-112 passes build 14 with input-triggered query suggestions, direct-link eligibility rejection inside the accessible active popover, trusted clipper/timing metadata and the persisted canonical clip ID (`/tmp/events-picker-browser14c.log`, 8.6s). Its first failed exact-title locator did not include the real option's metadata; the corrected locator still checks title/attribution and now also asserts the stored reference.

Build 15, including TypeScript and the final disabled-owner guard, passes. Repository lint passes with zero errors and twelve pre-existing warnings (`/tmp/events-final-lint15.log`). Final combined browser and native/inventory checkpoints are recorded below.


## Final local checkpoint

Build 15 passes TypeScript and the optimized Next build. All 13 concrete browser journeys pass together (`/tmp/events-browser-final15.log`, 2.2m), including actual chat-settings UI, signed Twitch badges/Twitch/7TV emotes, full pilot announcement, image outage/retry, canonical clip lookup/submission and saved/reordered statistics. Twelve settled desktop/phone light/dark screenshots are retained under `/tmp/events-visual-final15` and inspected; current step and keyboard/media focus remain asserted. Native OAuth/MCP plus the repository acceptance inventory pass 7 checks (`/tmp/events-final-native-inventory15.log`). New provider mocks are restricted to the owning chat scenario so unrelated browser app-token behavior is preserved. Repository lint is Green with twelve existing warnings and zero errors. Final formatting and required GitHub gates are tracked separately; no full local coverage owner was started.


## Cycle 38 — complete CI caller reconciliation

Full required CI run 42573028335 found three previously unselected caller boundaries: independent public catalogue expectations omitted the sixteen event tools; MCP activity labels omitted those tools; the PostgreSQL tour aggregate retained the old 23-step denominator. The existing native catalogue BDD failed for the same shared expectation. Expectations now independently enumerate all 92 public tools, all sixteen activity labels are present, and tour metrics assert 24 tasks, 28/120 average progress and the new event task (excluding invalid accounts from per-task rates as before). No assertions or thresholds were removed.

The creator-login ATDD also bypassed the real button with a direct social-sign-in request that omitted contextual creator scopes. It now clicks the actual installed login button and inspects its actual Twitch authorization URL, with only the external Twitch page transport controlled. All original scope/callback/dashboard assertions remain. The first response-body capture raced the real navigation; capturing the outgoing authorization URL fixes the test at the relevant boundary.

Green: the four complete MCP catalogue/activity/tour files pass 49 checks (`/tmp/events-ci-callers-green3.log`, 6.77s). The actual creator login browser journey passes (`/tmp/events-ci-login-browser2.log`, 7.5s). These changes do not alter provider scope policy. The earlier thirteen Awards browser journeys remain passing evidence for unchanged application flows. The two complete native BDD owners pass 22 scenarios, including the six new event-scope cases (`/tmp/events-ci-native-bdd.log`, 15.4s). The complete CI checkpoint is allowed to finish before pushing this coherent correction.


## Cycle 39 — existing mobile navigation acceptance boundary

The final acceptance shard in run 42573028335 reported two native Sheet navigation races: clip-export background navigation and unsaved gallery search/navigation at 390px. Its trace shows Playwright scrolling a control while the swipe sheet is still entering, moving its native scroll container and dismissing the drawer. The repository's existing dashboard-consistency/support owners already wait for the complete mobile sidebar to enter the viewport before interacting. The affected five opening sites now use that same asserted viewport condition, without forced clicks, sleeps or increased timeouts. Production navigation behavior is unchanged.

The first local two-file run passed all six export cases, but the four shared editor checks were blocked by omitted APP_ENV/E2E_TEST_MODE in the local wrapper, not a product Red. The corrected command explicitly restores both required disposable test variables. Both complete affected browser owners pass all ten checks (`/tmp/events-ci-mobile-green.log`, 3.1m), including mobile/light/dark export background navigation, all shared resource editors, unsaved gallery search/navigation and cold hydration. Final CI evidence is tracked on the PR. No CI run was cancelled to replace a checkpoint early.


## Cycle 40 — unchanged per-source MCP coverage gate

At source 08639fec all 41 applicable CI producer/check jobs passed, including every browser group and all twelve coverage lanes. The final merged Test gate correctly rejected src/server/mcp/events/tools.ts at 79.03% statements, 80% functions, 81.39% lines and 67.85% branches. Global coverage passed; this was a concrete existing per-source threshold failure, not new product scope.

The missing transport boundaries now have focused tests: creator listing rejects forged identity; published deck updates preserve expected revision and normalized chat settings; tie reads/decisions forward the trusted principal and explicit category/candidate; errors map missing resources, absent authentication and uncoded service failures without private detail. Existing real OAuth/MCP flow remains the success-path owner. Production source and thresholds are unchanged.

Both whole files pass 10 checks under the existing partial coverage producer (`/tmp/events-mcp-target-coverage.log`, 4.672s). This diagnostic is limited to the affected two owners, not passing full-suite evidence. The affected file reports 100% lines, 100% functions, 98.38% statements and 92.85% branches; evaluateMcpCoverage passes using that file's unchanged manifest classification and thresholds. The next full GitHub run remains the final merge gate and is tracked on PR #560.


## Cycle 41 — type-correct conflict fixture

CI 42577725280 caught the new presentation mock using the unsupported literal REVISION_CONFLICT; the service's established code is CONFLICT. The test now uses and asserts that actual contract. Application source, coverage branches and thresholds are unchanged. Local repository TypeScript check emits no errors (`/tmp/events-mcp-typecheck-final.log`), and both complete MCP files pass all ten checks (`/tmp/events-mcp-boundary-green2.log`, 12.577s). The failed CI checkpoint is allowed to finish before this correction is pushed.


## Cycle 42 — direct generic event creation and shared load errors

User refinement: keep creation generic for future event modules, remove the preliminary title modal, reduce load-error emphasis and integrate retry actions. Red: two of three library checks fail on the original modal/title-error behavior (`/tmp/events-polish-red.log`). Green: the three complete event UI files pass seven checks and both existing layout owners pass thirteen (`/tmp/events-polish-green.log`, `/tmp/events-polish-callers.log`). New defaults are still unlisted and server-validated; busy state prevents repeated creation while pending. Server errors no longer blame the title. The shared load-error surface preserves existing retry handlers and local drafts.

A read-only Infisical dev query confirms award_events and associated award tables are absent. The operator schema push has not run: automatic approval rejected it because the user had asked for diagnosis, not explicitly approved the shared-dev mutation. No migrations or production schema are changed. The normal PR remains the code review vehicle; the dev schema action requires explicit operator approval under AGENTS.md.


Final refinement verification: all four actual browser creation/recovery cases pass (390/1440px × light/dark, `/tmp/events-polish-browser3.log`, 38.3s). The three affected existing creation/full-pilot/discovery journeys pass (`/tmp/events-polish-bdd.log`, 31.3s). Eight error/editor screenshots were retained in `/tmp/events-polish-visual`; mobile light and desktop dark recovery plus the editor were visually inspected. The new checks assert 14px muted error copy, a colocated Retry action, keyboard retry, server failure recovery, no title modal, generic New event defaults and exactly one saved event after retry. Initial fixture locators also matched Next's route announcer and desktop sign-in status; they now target the actual event messages without weakening expectations. Build/TypeScript and affected lint pass; the final post-build source edit only makes the route tagline generic. No shared-dev schema push occurred.


## Development schema synchronization — 2026-11-09

The user explicitly authorized db:push against Infisical dev and clarified that this normal development operation needs no additional approval; manual SQL migration files remain separately authorized. AGENTS.md records this dev-only authorization without extending it to other database targets. The full Drizzle diff contained unrelated Runner constraint/enum drift, so it was aborted without changes. The final scoped push used the seven unchanged Event table models and preserved the live enum inventory; its reviewed SQL contained only new Event tables, their foreign keys and indexes. No existing rows/tables/types were changed, no SQL migration file was created, and production was untouched.

Drizzle reported Changes applied. Read-only inspection confirms award_events, award_candidates, award_submissions, award_votes, event_connections, event_connection_intents and award_assets now exist. An anonymous real-browser read of https://beta-560.clipify.cloud.thedannicraft.de/events displays No public events right now successfully. No creator session was impersonated and no shared-dev fixture event was inserted; the signed-in creator's next creation attempt remains a user check.

## Event UI audit and visible progress, 2026-11-09

User reported silent creation, an apparently ineffective review action and wrapping, and requested a fresh Mobbin audit of all Event pages. Scope and inspected references are in ../ux-audit.md.

Red evidence: the new library regression failed because Creating event… was absent (`/tmp/events-pending-red.log`, one failed/three passed). Successful navigation must also retain the disabled state until the old page unmounts. The new real-browser audit exposed document overflow from a long slide title on both mobile themes (`/tmp/events-audit-browser.log`). The initial review test's cell locator was incorrect for the installed React Aria grid: the page snapshot already showed Nominated and the successful save message. It now asserts gridcell and the saved database value instead of treating that locator failure as a product defect.

Changes: explicit creation spinners/status, pending retained across navigation, single-line scrolling editor tabs, readable contained review table, selected count, locked-state explanation, review saving feedback, bounded wrapping slide navigation, inline connection retry, and local recovery for rejected presenter-link/result-publication requests. No schema, migration, role or external-provider change.

Affected whole-file checks: library, review-ui, editor and storage-settings pass 14 checks (`/tmp/events-audit-unit2.log`); the two owners changed by the final spinner/retry adjustment pass seven checks (`/tmp/events-audit-unit-final.log`). ESLint passes for every changed UI/test file (`/tmp/events-audit-lint2.log`). The final production browser build and TypeScript check pass (`/tmp/events-audit-build3.log`). An intermediate build identified a test-only Testing Library option mismatch, which was corrected; an intermediate lint check kept retry state updates in the user action rather than synchronously in an effect.

Final browser evidence: eight Event creation/editor audit cases pass in 1.3 minutes (`/tmp/events-audit-browser-final.log`), covering every editor tab, real mouse nomination/removal with persisted database state, preview/Escape, S3 modal open/cancel, failed connection reload/retry, long slide selection and a held creation request with explicit disabled button/spinner/status. All thirteen complete Event BDD journeys pass in 2.2 minutes (`/tmp/events-audit-bdd-final.log`), including the full nineteen-category pilot, submission replacement, Drive upload recovery, group review, data results, voting, archive, presenter, chat and discovery. Browser screenshots were inspected across both themes and widths; the fresh audit captures are retained in `/tmp/events-audit-final` and public/presenter captures in `/tmp/events-audit-bdd`. Standalone before/after boards for the reproduced long-slide overflow are `/tmp/events-audit-board-light.html` and `/tmp/events-audit-board-dark.html`, with captured PNGs alongside them. The complete current-head CI gate remains separate from these local checks; live provider consent and an actual stream were not exercised.

## Event workspace, visible controls and read-only previews — 2026-11-09

The user's follow-up established that the earlier audit had missed a real visible-control defect. Installed HeroUI Switch.Content owns the interactive button: Control/Thumb outside it looked like a switch but did not respond to a mouse click. The real-browser Red is `/tmp/events-switch-red.log`. Corrected the five Event switches, preserving paid locks and upgrade behavior. Tests now click the visible Control, not merely its hidden input.

Scoped follow-up: Event-aware sidebar with same-page history/draft preservation, inline Chat, slide tiles and actual show-renderer preview, compact library date metadata and empty Review guidance. Mobbin and Payloadbay PR 13 references are in ux-audit.md. The all-time Babbler example uses the supplied nineteen categories and only the selected creator's real cached media; fictional proposals/manual results are labelled demo. No fake clip identifiers, live votes, uploaded test files or direct shared-database fixture insertion are introduced.

A separate signed seven-day read-only preview capability is bound to event/presenter generation. Draft projection excludes grouped originals and voter identity; only root-referenced protected media is authorized. Presenter rotation revokes preview access and the preview cannot publish. The private-media Red expected 200 for a valid signed preview and got 404 (`/tmp/events-preview-media-red.log`); after the shared media guard fix all eight upload/media checks pass (`/tmp/events-preview-media-green.log`). Final native/service verification passes fifteen checks across uploads, presenter and the genuine OAuth/HTTP MCP workflow (`/tmp/events-rework-runtime-final.log`). That workflow creates the nineteen-category example from an isolated 2023 cached clip, obtains its preview and proves the event remains unpublished.

Other affected whole-file checks: seventeen checks in five Event/UI/token owners (`/tmp/events-rework-unit2.log`), 122 checks in risk inventory/library/embedded-route owners (`/tmp/events-rework-remaining-unit.log`), five connection-service checks (`/tmp/events-rework-connections.log`), 76 shared shell/navbar/editor/review/library/storage checks (`/tmp/events-rework-ui-unit.log`), two final empty Review checks (`/tmp/events-review-empty-unit-final.log`) and nine media/presenter UI checks (`/tmp/events-rework-media-ui.log`). MCP contracts/discovery/integration had 151 passing checks plus one outdated workflow count, corrected from 62 to 64 and then verified in the complete risk owner. This is affected-owner evidence, not a full local coverage gate.

Installed Google provider checks and real browser redirects verify separate contextual drive.file/youtube.readonly scopes with incremental authorization. No real Google consent/token exchange or account credentials are used as test fixtures.

Twelve actual browser editor/control/recovery cases pass on 390/1440px × light/dark (`/tmp/events-rework-browser-final2.log`, 2.5m). They exercise all five visible switches, the real upgrade modal, scoped keyboard/mobile navigation, nineteen-category example plus category editing, all-time cache lookup, OAuth redirects/cancel feedback, signed-out preview, no publishing, nomination/removal persistence, missing connection retry, delayed creation and useful empty Review. Captures are retained at `/tmp/events-rework-browser-visual-final`; inspected phone/light presentation, desktop/dark chat, phone/dark empty Review and desktop/light presentation. This inspection caught long text nominees inheriting a button's single-line whitespace, corrected in the shared card. Final build/TypeScript and patched-dependency verification pass (`/tmp/events-rework-build5.log`). Changed-file lint/formatting pass (`/tmp/events-rework-final-static.log`, `/tmp/events-rework-static-last.log`).

An intermediate mobile audit failure was a test readiness bug: it read the desktop SSR aria-expanded state and skipped opening the drawer before hydration established the mobile context. The navigation control already disables interaction until ready; the shared helper now waits for it to be enabled before reading its state. No arbitrary sleep, forced click or product workaround was added.

The complete thirteen-journey run passed twelve cases; the remaining image-team journey used the previous empty-state action label Add candidate instead of Add the first candidate (`/tmp/events-rework-bdd-final.log`). Updated both team-add step callers to recognize the meaningful empty/nonempty actions. The remaining journey and the whole four-case editor owner are rechecked separately, including settled motion/long-title rendering; no unchanged successful journey needs repetition.

External account status: the refreshed Clipify MCP list_creators and get_capabilities succeed for the user's approved creator. The deployed capability inventory includes no Event operations, rather than denying them, so the live server does not yet run the branch's Event tools. Infisical login is not a prerequisite for the normal account/MCP workflow and the unused task login process was closed. No actual-account example is claimed. The preceding full CI #3933 passed; the follow-up commit still requires its own complete CI gate before merge.

Final recheck: all five selected cases pass (`/tmp/events-rework-browser-last.log`, 1.2m): the complete four-case editor owner plus the corrected team image-upload journey. Together with the unchanged twelve successful journeys from the preceding run, all thirteen Event journeys have passing final-source evidence. The settled desktop/light preview screenshot now shows the full category heading and wrapped/clamped nominee text; the full title remains readable beneath it. Final captures are retained in `/tmp/events-rework-final-recheck`. The earlier failing locator run remains documented rather than presented as green.


## Google return origin and complete CI callers — 2026-11-09

The Event completion route used request.url.origin behind the proxy, producing http://0.0.0.0:3000 destinations. Four whole-file regression cases failed for that exact reason, then passed after switching all completion outcomes to the existing resolveBaseUrl helper. Real authenticated HTTP/browser coverage sends an internal Host header and follows the resulting public-origin editor redirect (one passing case, /tmp/events-return-browser.log). Build/type checks and changed-file lint/format pass. No additional Google callback handler or registered redirect URI was introduced.

CI run 42698250565 failed in database-1/database-2 and browser bdd-1/bdd-3/bdd-7: discovery callers still expected 92 tools after the addition of two Event tools, and the public activity label map omitted create_event_example/get_event_preview. Reconciled all four stale count callers to 94 and added the two actual labels. Three affected whole-file database owners pass (18 tests, /tmp/events-ci-callers.log); both independent SDK transport scenarios pass (/tmp/events-ci-browser.log); both real browser consent/edit/revoke scenarios pass (/tmp/events-ci-browser-final.log). The first combined browser attempt lacked the disposable runtime database and failed fixture setup with ECONNREFUSED on the documented unreachable fallback; it is setup evidence, not a product failure. Retested the two actual browser cases using a fresh disposable database, removed afterward. No assertion, policy or coverage threshold was weakened. Complete new-head CI remains a separate required gate.

## Independent Google grants and live MCP approval — 2026-11-10

The former shared Google account flow is superseded: Better Auth Generic OAuth registers google-drive and google-events-youtube alongside the existing Runner google account. Browser linking now calls authClient.linkSocial directly, with separate provider IDs and include_granted_scopes=false. Better Auth retains state, PKCE, verified OIDC, callbacks, proxy exchange, encrypted tokens and refresh. Production must register the providers before preview callbacks can complete; prerequisite PR #561 passed complete CI and was squash-merged as 7ab6f64a. The user confirmed all three stable Google callback URIs are registered. Production release/live Google verification remain pending.

The independent-link native tests verify three encrypted credential rows for one Google subject, separate refreshes and denial preservation. Existing Runner reauthentication reproduced overwriting its credential with login-only-access; extending the established preservation hook fixes both production and preview cases. Affected connection/account suites passed 41 checks; the callback owner passed 51 checks. The final browser checkpoint passed 43 cases across Event connection recovery, editor controls, Event BDD and MCP scope denials. Build, TypeScript, lint and formatting passed before pushing fbb90b78. The original transient error's Sentry stack was unavailable; local browser observers saw no global error screen through the corrected linking flow, but this is not evidence of live Google consent.

The correct development PostgreSQL logs identified the real MCP approval rejection: mcp_connection_grants.expires_at remained NOT NULL while current grants intentionally omit expiry. The full authorized Infisical dev db:push was blocked by unrelated Runner constraint dependencies, without truncation. A scoped Drizzle push re-exported the unchanged MCP models and existing enums and introspected only public MCP tables. The reviewed generated SQL contained only ALTER TABLE mcp_connection_grants ALTER COLUMN expires_at DROP NOT NULL. It applied successfully; information_schema verified is_nullable=YES. No manual SQL migration or production schema mutation was used.

Normal codex mcp login clipify-preview completed with all advertised scopes. Actual authenticated SDK calls then listed the approved creator, read capabilities and existing events, created one nineteen-category Babbler Awards draft on creator 274252231, and obtained a seven-day read-only preview. The draft is unlisted and unpublished; all nine clip categories have empty date rules (all time). No tokens or callback codes are recorded here.

## Resource table consistency — 2026-11-10

Events and Clip layouts now use the same installed HeroUI Table compound components as existing dashboard resource lists. Existing create/error/retry states and layout editing/default/deletion handlers remain in place. The event workspace's top navigation now returns home. Source build, TypeScript and 43 affected whole-file component checks pass. Four existing Event load/create/retry browser journeys pass. Four new real-component journeys cover both themes at 390px and 1440px, event row navigation, keyboard return home, layout defaults, deletion cancellation and keyboard layout editing. The first new run used a desktop-only sidebar locator and failed on the portal-rendered sidebar; locating the named Event workspace fixes the test without a product workaround. All four corrected cases passed (/tmp/resource-library-tables-retry.log); screenshots were inspected in both themes and sizes. No live Google-consent claim follows from these UI tests.

## Shared action toasts and silent OAuth draft preservation — 2026-11-10

Red: a manual Event save did not call the shared success toast; five existing editor checks passed and the new notification assertion failed (/tmp/event-save-toast-red.log). Green: the explicit save/publish handlers use notify, while the protective save before Google linking is silent. Callback success/failure uses a toast and consumes its query flag without dropping the active section or history state. The callback owner verifies success is not repeated on rerender and failed callback flags are removed. Failed public proposal withdrawal now also catches transport errors, reports the failure and leaves the original receipt/retry available.

The action-feedback audit covers the Event flows and older Runner, connected-app, admin, agency-return, controller and checkout notices described in research.md. It reuses the established notify helper and installed HeroUI toast queue; the only new component is a client boundary for server-rendered agency action returns. Persistent field guidance, progress, service status and resource recovery remain contextual. Affected whole-file owners cover 171 checks after the owning reruns: /tmp/feedback-all-unit-green.log plus the corrected unchanged Settings assertion (/tmp/feedback-settings-unit-green.log), callback flag case (/tmp/feedback-google-status-final.log), and withdrawal recovery (/tmp/feedback-withdrawal-unit.log). No assertions or coverage thresholds were removed.

The first browser checkpoint passed 30 of 31 journeys. The repeated-proposal binding was observing the previous success toast and advancing before its second action completed; after waiting for the submit button to return to ready, its assertion also needed to accept two legitimate queued success toasts. The final owning rerun passed (/tmp/feedback-proposal-final-browser.log). All 31 relevant Event/awards and Runner UI journeys now have passing evidence, including both themes/viewport sizes, real Better Auth linking failures/retries, silent pre-redirect saving, protected uploads, nomination/grouping, voting closure, presenter/results, clipboard, appearance, destinations and schedules. The final shared checkout correction passed the Free Runner upgrade/retry journey against the final build (/tmp/feedback-final-browser.log). Screenshots of the actual toast were inspected in mobile light/dark themes and copied to /tmp/clipify-feedback-reviewed-screens. Final build, TypeScript, changed-source lint and formatting pass. Fixtures and job-owned templates were removed by their browser-run cleanup; no application database was used as a fixture. Complete CI remains the pre-merge gate.

## Complete feedback callers after CI — 2026-11-10

The full aa68cc96 checkpoint exposed stale feedback locators in additional Runner BDD/ATDD bindings, beyond the initially selected browser journeys. All remaining appearance-save, collision/error, schedule-failure and connected-app revocation bindings now target the shared toast surface; iframe layout warnings and true field validation remain separate. Repeated saves wait for the owning button to become ready, preventing an earlier queued toast from satisfying the next action. The clip-search proposal binding preserves its expected disabled state after a successful submission clears the selection; only free-text submission waits for re-enabled readiness.

Additional real-browser evidence: nine representative bindings passed, including the exact failing Runner ATDD journey and actual SDK consent/revocation (/tmp/feedback-bindings-browser.log). All five invalid-schedule examples, controlled database-save failure, and clip-link submission passed (/tmp/feedback-remaining-callers-browser.log). Voluntary branding and renewed-Pro repeated appearance saves passed (/tmp/feedback-repeated-appearance-browser.log). These are browser-owned journeys; native scenario inventories were excluded by the existing project configuration rather than duplicated. Application source/build and the 171 owning unit checks are unchanged by this caller-only correction.

Several independent CI browser jobs failed before any test executed because Ubuntu archive metadata downloads exceeded the existing three-minute dependency-install deadline (for example job 129579268456). That is recorded separately from the stale UI assertions; no application timeout, dependency deadline, scenario inventory or coverage threshold was weakened. The old checkpoint was allowed to reach its final gate before pushing the caller correction.

## Hosted package mirror recovery — 2026-11-10

The corrected caller checkpoint 42742285142 failed twelve jobs during prerequisite installation, before their tests ran. Logs show repeated HTTP archive retries; one unit job reached the HTTPS mirror only immediately before the unchanged three-minute deadline. The disposable-runner mirror rewrite now selects HTTPS directly for both Azure and primary archive entries. Local repository configuration is unchanged. A failing regression proved the HTTP entries remained HTTP; the corrected whole-file installer owners pass all seven tests (/tmp/ci-mirror-red26.log, /tmp/ci-mirror-green.log). Network/lock timeouts, failure propagation and the whole-command deadline remain unchanged.

## Event workspace coverage completion — 2026-11-10

Checkpoint 42743823510 passed every build, coverage producer and browser shard after the HTTPS prerequisite correction. Its final merged gate correctly rejected dashboardShell.tsx function coverage (82.25% against 90%). The owning component suite had never rendered the Event workspace and its HeroUI GroupLabel mock was missing. Tests now verify selected/fallback Event sections, home/chat destinations, the event-read permission boundary and selected Settings connections. The whole-file owner passes all 36 checks without coverage (/tmp/toast-sidebar-tests.log); the canonical wrapper’s focused lane reports 91.93% functions, 96.07% lines and 89.63% branches (/tmp/toast-sidebar-coverage.log). This is local scoped evidence, not a replacement for the full merged CI gate. No application source, scenario inventory or threshold changed.

## Presenter layout and working Babbler review — 2026-11-10

The actual shared preview was captured before editing. Its notice plus a full-viewport stage caused vertical overflow; three statistics occupied four reserved columns; nominee/result header remounts animated the category again; provider iframes were blocked by the page CSP. Event routes now allow only the two required provider origins, while preserving frame-ancestor restrictions. Provider frames send an origin referrer so the no-referrer preview document does not break YouTube embedding. The stage and footer share one viewport, category headings stay mounted, and winner cards are larger with an accent border above smaller nominees, including on phones. The closing grid fits the larger winner set more compactly. Quote presets use text.

Affected whole-file checks: 18 pass across presenter UI/planning, media, defaults and CSP (/tmp/babbler-layout-unit-final.log). The production-style browser build and TypeScript pass (/tmp/babbler-layout-build-final.log), as do changed-file lint/formatting. Four real-component browser cases pass on the final build at 390/1440 pixels in light/dark (/tmp/babbler-layout-final-browser.log). They verify viewport fit, centered statistics, stable category-header position, winner hierarchy, no horizontal overflow and an actual provider-frame document admitted by the CSP. Screenshots were inspected in both themes. The first new test attempt used the JWT fallback instead of the fixture's configured Better Auth secret; that fixture-token error was corrected and all four whole cases rerun. Existing show publication, chat, nineteen-category pilot and statistics journeys also passed (/tmp/babbler-layout-browser.log). All test databases and templates are disposable loopback fixtures.

Separately, the user explicitly requested realistic development example data rather than a simulated preview. Only their identified Babbler demo event was populated: 75 nominated candidates, 100 fictional auth users and 1,500 stored ballots, with actual protected uploads through the connected Drive service and five real linked-channel YouTube thumbnails. No simulated-result renderer, schema change or production data mutation was introduced. The normal read-only preview reads the real stored results; the event is unlisted and its public results remain unpublished. Source clips were checked through Twitch's API. The native player can still show Twitch's own audience-content gate.

## Finish full-viewport show sizing — 2026-11-10

A stricter desktop geometry assertion reproduced 44 pixels of result-slide overflow on the first layout checkpoint (two desktop failures and two mobile passes in /tmp/babbler-fullscreen-red.log). Category spacing, winner width and nominee grid width now leave room for the normal footer. Text nominees use a naturally sized reading area rather than a cropped video-shaped box. The owning browser cases also open a text quote and check that its content remains inside its surface. Eight relevant browser journeys passed after that correction (/tmp/babbler-fullscreen-final-browser.log), including the four theme/viewport geometry cases and the existing presenter, chat, pilot and statistics journeys. A live pass through all 42 populated slides identified a further 29-pixel closing-slide overflow; the same stage padding now applies to closing slides. The final source builds with TypeScript (/tmp/babbler-closing-final-build.log), and its whole presenter UI owner and changed-file lint pass (/tmp/babbler-closing-final-unit.log, /tmp/babbler-closing-final-lint.log). The final browser geometry owner is rerun against that exact build before pushing.

The deployed clip was checked without a provider mock: its Twitch iframe was admitted by the Event policy, the video reached readyState 4 and currentTime 4.62 seconds with paused=false and no media error after Twitch's audience confirmation. The development example's five YouTube thumbnail images also loaded, and its normal result projection returned 48/24/15/9/4 percent and the corresponding stored vote counts. No authentication, deployment, database schema or coverage policy was changed for this sizing follow-up.

Final checkpoint evidence: all four exact-build browser cases pass (/tmp/babbler-closing-final-browser.log), including the stricter desktop nominee/result viewport checks and readable mobile quote expansion. The preceding application checkpoint a9464839 completed its full required CI successfully in run 42814238030 before this final spacing follow-up was pushed. That remains baseline evidence; the follow-up retains its own complete CI gate.

## Remove repeated text-media captions — 2026-11-10

The actual mobile quote inspection revealed a repeated title: EventMedia already rendered the text title, and the presenter added it again underneath. Only visual media now receive the separate presenter caption; text, choices, people, links and audio retain their own heading. The whole browser owner checks exactly one quote heading in both themes and viewport sizes. Its four cases and all three Settings deployment-detection cases pass together (/tmp/babbler-caption-browser.log); the exact Settings test that failed in CI 42816359047 could not be reproduced locally. No Settings/deployment source, retry policy or assertion was changed. The presenter whole-file unit owner, changed-file lint, production-style build and TypeScript pass (/tmp/babbler-caption-unit.log, /tmp/babbler-caption-lint.log, /tmp/babbler-caption-build.log).

The deployed 64b666ca development show was walked through all 42 slides: no desktop or horizontal overflow and all nominee images loaded (/tmp/babbler-final-audit.json). This remains valid deck-layout evidence for the caption-only follow-up, whose changed opened-text state has its own browser coverage. The cached preview rebuild initially failed without an exposed debug reason; a single same-commit preview-only retry succeeded. Twitch playback reached a progressing video with no error. The real YouTube iframe and origin referrer were confirmed, but automated playback encountered YouTube's own bot-verification prompt; successful playback there is not claimed.

## Stage the award vote reveal — 2026-11-10

The presenter-plan owner first failed because the deck jumped directly from nominees to results (/tmp/award-reveal-red.log). It now checks an anonymous step before each result page and stable entry order between those two steps. The presenter UI owner checks that no names are shown before reveal, that the heading stays mounted, and that navigating back lets the host replay the reveal. Existing tally tests still cover ties and zero votes.

The six presenter browser cases passed with a disposable PostgreSQL fixture, including both desktop and phone themes, the zero-vote category and the private presenter to public archive journey (/tmp/award-browser-fonts.log). Screenshot review prompted a two-column mobile layout so viewers can compare vote bars side by side; the same browser owner verifies the final layout and that the animated fill reaches the expected track width.

## Category modes, contextual connections and Twitch interactions — 2026-11-11

The existing storage-settings owner initially failed because it expected every storage action at once. Its updated expectations select S3 explicitly and retain failed-form recovery; the production component now shows only the selected provider. This was an affected-caller update, not a claim of a test-first feature cycle.

New database tests cover one remote creation across concurrent starts, unique complete option labels, waiting before prediction resolution, actual winning outcome mapping, oversized poll rejection without provider requests, preview-secret denial, provider outage recovery, cancellation-warning persistence and tied-winner refunds. Data nomination tests cover a five-entry total allowing four additional nominees and unlimited low-view team selections. Public projection and presenter-plan tests cover frozen top entries, winner-inclusive limits, legacy defaults and slide mode overrides. Component tests cover waiting, resolving and skip recovery. No test-first Red is claimed for new behaviors whose first recorded test run was Green.

The final caller audit found legacy data-category denials in team search and upload reservation. The team-upload owner first failed with INVALID_INPUT (/tmp/events-data-upload-red.log), then passed with the shared eligibility guard. Extending the same owner to an anonymous presenter proved a missing media capability (/tmp/events-data-media-red.log); the existing revocable preview capability now protects these private files, with public access still denied. All nineteen upload/route/presenter cases pass (/tmp/events-data-media-green.log). No new authentication or storage protocol was added.

The archive component first rendered the data winner twice (/tmp/events-archive-red.log). Its whole-file Green verifies one highlighted winner before the additional nominees (/tmp/events-archive-green.log). Real installed-component browser coverage follows a two-view creator clip through team search, addition and nomination, and then publication of the fixture archive. Review reports additional nominees against the remaining capacity, reserving one position for the frozen winner.

The final six-case presenter owner passes (/tmp/events-stage-lock-browser.log), including desktop/mobile and both themes, title separation, fixed nominee slots, text scale during flights, Space/Escape, and complete poll/prediction waiting, reload and resolution. The seven-case Review/options owner passes (/tmp/events-data-final-browser.log), including the existing Better Auth Twitch redirect, disabled incompatible interactions and low-view team nomination. Earlier selector and fixture setup failures were corrected in the test owners; no product authentication diagnostics were introduced.

The development Event interaction column is confirmed present, with both existing events retained. The broad development schema sync encountered unrelated existing drift; truncation was not approved and no generated/custom migration was created. No production schema mutation or live Twitch poll/prediction was performed. Full current-head CI remains required before merge.

Final-source build and TypeScript pass. The final three-case browser owner passes (/tmp/events-complete-browser.log), including the two-view clip's complete search/add/nominate/archive journey and both responsive presentation-options/Better Auth consent cases. The preceding whole Review and stage/Twitch owners remain passing for their unchanged boundaries. Changed-file lint, formatting and migration-artifact checks pass. The completed follow-up introduces no dependency and uses the existing HeroUI, Better Auth, provider-request, media-capability and database-fixture mechanisms.

## Stable reveal and reverse navigation — 11 November 2026

The live baseline was captured in /tmp/award-reveal-before at early, intermediate and final reveal/back states. It shows clipped/missing captions during shared-layout travel. The focused presenter-card Red (/tmp/award-reverse-red.log) found a transient 0% alongside the final vote count. The presentation-only variant now reserves result metadata, shows the final numeric score as its bar appears and removes the floating image badge. The existing public card rendering remains covered by its owning component file.

Actual browser checks now compare the featured footer before/after reveal, verify text opacity and featured-card position over 120 frames after Back, rapidly traverse backwards then forward, and check the immediate Escape return. Nominee art in the fixture has distinct colors/identities rather than blank white pixels. Dedicated early/arrival/score screenshots are captured before waiting for the final percentage. Controller unit tests keep timing in the browser owner rather than waiting on AnimatePresence in jsdom.

The preceding complete CI (43010283024) passed all application coverage lanes but failed the YouTube connection-start browser case: its default Twitch-only fixture expected a now-contextual YouTube action. The caller now selects a YouTube category through the actual editor before asserting connection errors, silent protective saving and Better Auth consent. No authentication implementation was changed for this test correction.

Final checks: all four presenter browser journeys pass at 390px/1440px in both themes (/tmp/award-reveal-presenter-final.log), including 120-frame reverse-navigation sampling, unchanged rail/header positions, fixed footer height, rapid Back/Next and immediate Escape restoration. The two Twitch interaction and two connection-start journeys pass against the same final application build (/tmp/award-reveal-stable-browser.log); its four presenter failures were a duplicate quote-button test selector, corrected by selecting the featured area. All three component owner files pass (eight tests, /tmp/award-reveal-stable-native.log). Build/TypeScript, changed-file lint and formatting pass. Physical macOS rendering and live Twitch actions remain untested; complete CI is required before merge.

## Restore single-card flights — 11 November 2026

A new controller assertion first failed because the same nominee rendered twice (/tmp/award-single-flight-red.log). The corrected stage renders each nominee once, either featured or in its reserved strip slot. The three whole component files pass (eight tests, /tmp/award-single-flight-green.log). Browser ownership additionally checks physical downward travel during a nominee transition, captures the in-flight state, verifies unique nominee controls and retains the prior layout, reverse-navigation, keyboard and text-distortion checks. No shared data or schema is changed.

Final browser owner: all four desktop/mobile and light/dark presenter cases pass (/tmp/award-single-flight-browser.log), with measured downward card movement, unique nominee controls, in-flight screenshots, fixed footer/rail positions, rapid reverse/forward steps, 120-frame caption/position checks, media Space/Escape and quote-scale checks. Build/TypeScript and changed-file lint/formatting pass. Native owner remains eight passing tests with the obsolete presence mock removed. Physical macOS rendering remains unverified.

The deployed single-card sequence was also captured at thirteen real demo frames (/tmp/award-single-flight-live): no duplicate nominee controls or page errors. Inspecting these images found a partial third caption line where the 48px reserve used 20px line spacing. Matching two complete 24px lines fixes that without changing card geometry or motion. The browser owner now rejects fractional caption-line boxes; both desktop themes pass (/tmp/award-caption-lines-browser.log), and all eight component tests remain passing (/tmp/award-caption-native.log). Build/TypeScript, lint and formatting pass.

Placement readability: increased the featured rank labels from 14px accent text to bold foreground text (24px narrow / 30px desktop), retaining reserved height. The presenter component file passes all four tests (/tmp/award-placement-native.log); both desktop browser themes pass the full presenter journey (/tmp/award-placement-browser.log), including fixed rail/header geometry, actual flights and reverse/media recovery. Build/TypeScript, lint and formatting pass. Inspected third-place and winner screenshots in both themes.

## Label landing and first-place emphasis — 11 November 2026

The real read-only preview probe first failed with labelTravel=24 and overlap=16 (/tmp/award-label-jump-red.log). It observes the label and card through 90 animation frames; no demo mutation is performed. The flight now reserves its full parent height, including the placement line. The owning browser test samples the same 90-frame geometry and rejects both movement and overlap. First place is explicitly named, announced with a trophy and emphasized on the existing card; controller coverage asserts the First place heading. The three component files pass eight tests (/tmp/award-label-green.log). Twitch clip playback remains the existing embed; no playback or authorization flow was changed.

All four final presenter browser cases pass at mobile/desktop in both themes (/tmp/award-label-winner-browser.log). Each placement is sampled over 90 frames with less than 2px permitted travel and no label/card overlap, retaining actual single-card flights, fixed rail/footer geometry, text-scale checks, rapid Back/Next and Space/Escape recovery. The First place heading is asserted. Winner and third-place screenshots were inspected. Build/TypeScript, lint and formatting pass; the initial type check caught an unsupported testing-library option, corrected before the passing run. No full CI or physical Mac result is claimed here.
