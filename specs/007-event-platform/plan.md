# Implementation Plan: Event Platform — Awards

Branch: `feature/event-platform`. Scope: complete agreed Babbler Awards flow; includes the requested optional Twitch predictions/polls; no automatic YouTube rankings.

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

### Presenter follow-up implementation

Extend the existing category/slide configuration with optional presentation and nominee-source fields, preserving legacy defaults. Snapshot top clip content with the existing frozen result rather than querying historical counters later. Reuse root candidate nominations for team selections and count the data winner against limits. The public projection supplies the same candidates to show playback and Twitch options.

Store Twitch remote interaction state by slide on the event. Use the existing account link, Better Auth access-token refresh and serialized provider-credential helper. Serialize starts under the event row and broadcaster advisory lock, enforce complete nominee limits, and persist outcome IDs for winner resolution. Integrate one presenter control into existing footer navigation; previews never mount it. The schema addition follows normal migration ownership after merge.

### Live preview chat and push delivery

Retain Twitch EventSub webhook ingestion and push accepted messages through the existing /ws route. The removed browser polling timer was the avoidable delay; Twitch EventSub WebSockets require a separate user-token transport and are not needed to make website delivery immediate. Initial socket frames carry the event-bound preview/presenter capability outside URLs. Validate enabled chat, creator status and capability mode, recheck authorization, and clean up listeners on disconnect. Deliver text before asynchronous badge enrichment, retain message state through reconnects, and replay the bounded recent buffer. Preview chat is read-only and never mounts poll/prediction controls. The existing single-process transport limit remains.

Protocol references: [Twitch WebSocket transport and user-token requirements](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/) and [EventSub subscription callback identity](https://dev.twitch.tv/docs/api/reference/eventsub/). The website WebSocket reuses existing server heartbeat and upgrade handling; subscriptions are isolated from overlay/controller roles.

### Native playback and optional audio leveling

Reuse the authorized Twitch clip resolver with an event context and the existing bounded byte-range media proxy. Project event-local clip URLs and attach existing preview media capabilities for private playback; check access before using cached resolver URLs. Share the native player across EventMedia callers. Preserve browser audio preferences, use installed HeroUI volume/mute/leveling controls, and hydrate preferences through the established client-ready pattern. Process only the active media through Web Audio, with gated/capped gain adjustment, fast peak compression and slower amplification. Account for media-element volume before analysis and apply the user's volume after processing. Reuse the graph across toggles and disconnect/close it on media changes or unmount.

Reference: [Disney+ playback controls](https://mobbin.com/screens/2c79a674-393f-42c1-a232-2c6f6201e92c) informs keeping controls together beneath media. This is a control-placement reference, not evidence of audio normalization behavior. Retain Clipify/HeroUI visual conventions.

### Ultrawide presenter layout — 12 November 2026

The presenter fills its browser viewport rather than enforcing a 16:9 canvas. At desktop widths of 1920px and above, remove the page/stage width caps, grow the featured nominee and strip cards within height-aware readability limits, and keep the chat column at 28rem. Preserve the aspect ratio of individual media. OBS/browser-source framing belongs to the host's chosen viewport. [Canva presenter reference](https://mobbin.com/screens/597fac49-7dbf-496d-9650-7dafa9f16bcd) informs separating stage space from a bounded side panel; retain Clipify's existing controls and manual single-card flights.

### Podium ceremony — 12 November 2026

Each manual placement step reserves an outgoing-card beat, shows its bronze/silver/gold cue on the empty stage, then flies the same nominee card up from its strip slot. Show placement, score and frame emphasis after arrival, with a longer first-place cue, warm spotlight/podium light and one brief finite confetti burst. Keep lower nominees, media playback, navigation and all geometry stable. Back/Escape and reduced-motion restoration do not replay celebration. Data awards use the same stage, including winner-only mode. No sound autoplay or new configuration layer is added.

[Duolingo milestone reference](https://mobbin.com/screens/5c97a190-7800-4f7d-b672-c7259474a2b7) informs a distinct illustration-led celebration before the statistics, not the exact podium motion. Keep Clipify's existing single-card flight and caption patterns.

### Continuous stage lighting — 12 November 2026

[Kahoot!'s iOS podium reference](https://mobbin.com/screens/2019296c-8e14-448b-a02d-19ccf2b0c573) uses a continuous background behind the podium. Remove the added horizontal floor strip and fade the existing halo through a soft mask that extends into the nominee area. Keep cards, animation timing, ranking, controls and chat intact; this fixes the clipped lighting boundary rather than replacing the presenter with a leaderboard.

### Host-controlled podium announcements

Split audience podium reveals into announcement and result steps. The announcement persists until Next; the outgoing card lands before it appears. Only a revealed rank may move to a bronze/silver position, with gold staying prominent in the featured area. Keep the already-inspected [Kahoot iOS podium](https://mobbin.com/screens/2019296c-8e14-448b-a02d-19ccf2b0c573) as the spatial reference; a static reference does not establish its timing. Preserve the existing single-card flights and original order for unrevealed nominees. Predictions resolve on the actual winner result, not its announcement.

### Left-stack reveal choreography

The host clarification replaces the lower-row reorder approximation: after the results introduction, Next gathers every nominee into a vertical left-hand stack. Ranked reveals draw one card from that stack into the featured area. On the following cue, revealed bronze/silver fly into separate lower podium slots; first place remains the highest featured card. Remaining nominees stay in the left stack and receive their scores with the winner reveal. Reuse the existing measured single-card flights, with explicit width/height morphing for the compact stack shape and no text scaling. Keep the intro and winner-only/data flows intact. [Gamma web](https://mobbin.com/screens/ddf68377-321d-40e0-b409-f359d8a5bcea) provides a reference for a separate vertical thumbnail rail beside the main content; the draw choreography follows the user rather than a claim about that reference.

### Persistent grouped podium

Keep bronze, gold and silver destination frames mounted from the first reveal cue. These are empty reserved positions, not copies of nominees. The winner flies into the center position rather than remaining in a disconnected upper area; small fixed height differences form one adjacent podium. Keep the left stack and manually held announcements. [Kahoot iOS podium](https://mobbin.com/screens/250e8d39-50a3-4074-8514-2853d1bb5c79) informs the adjacent, modestly staggered grouping. Browser acceptance measures the same destination rectangles before and after landing and exercises the real draw, media and reverse paths. Kreddel’s earlier anonymous distribution-before-identities suggestion is not added by this layout correction.
