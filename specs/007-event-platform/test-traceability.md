# Test Traceability

This is the current evidence index. The generated BDD-001…034 placeholders have been reconciled into the concrete journeys below; they are not counted as executed scenarios. One browser journey may provide both BDD and ATDD for the same behavior. Native OAuth/MCP owns its service journey rather than duplicating it as a browser label.

## Evidence Artifact Registry

Commands run with the disposable local environment in docs/local-testing.md. Red/Green chronology and exact local log names are retained once in [tdd/cycle-log.md](tdd/cycle-log.md). Local log paths are session evidence, not a claim of immutable CI or historical test-first retention.

| Artifact | Owner and roles                                   | Executable boundary / command                                                                                                                                  | Current evidence                                                                                                                    |
| -------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| E1       | Event suite; TDD and verification                 | `bun run test --runInBand test/server/events --coverage=false`                                                                                                 | 39 files / 180 checks passed at slice 13. Later whole-file benefit/lifecycle caller checks pass; overlapping totals are not summed. |
| E2       | Chromium; BDD and ATDD                            | `bunx playwright test --project=bdd-chromium .features-gen/bdd/events/awards.feature.spec.js --workers=1`                                                      | Concrete scenarios 101–113 below; final combined run passed.                                                                        |
| E3       | Native OAuth/MCP; BDD and ATDD                    | `bun run test --runInBand --runTestsByPath test/mcp/integration/events.test.ts --coverage=false`                                                               | Passed: real OAuth, tool discovery, creation/update, team grouping/nomination/release, data award, capability and publication.      |
| E4       | Native OAuth scope contracts                      | `bun run test --runInBand --runTestsByPath test/mcp/contract/mutation-scope-catalogue.test.ts test/mcp/contract/read-scope-catalogue.test.ts --coverage=false` | 21 passed, including every new independently approved event permission.                                                             |
| E5       | Existing MCP callers                              | Nine registry/risk/scope/consent files and existing official-client/capability contracts; commands in cycle-log                                                | 163 registry/caller checks and 15 official-client/capability checks passed. Overlaps with E1 are not added to a unique total.       |
| E6       | Signed webhook, embedded routes, homepage callers | Whole-file commands in cycle-log                                                                                                                               | 18 signed-webhook checks; embedded-route and homepage callers passed.                                                               |
| E7       | Targeted mutation spot checks                     | Exact deadline, public secrecy, grouped children; bounded temporary mutants restored in `finally`                                                              | All three mutants killed; logs in cycle-log. No exhaustive mutation score claimed.                                                  |

## Source-to-Artifact Coverage Map

E1 filenames below are under `test/server/events/` with `.test.ts` or `.test.tsx`. E2 numbers refer to the single concrete browser owner below. E3/E4 apply to management permissions and contracts throughout; provider consent/setup remains a dashboard browser action rather than an MCP credential upload.

| Source | Behavior                                                                   | E2 scenario(s)                       | E1 focused files / other owner                                                                  |
| ------ | -------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| FR-001 | Configuration, creator/agency authority and persisted drafts               | 101,111                              | configuration, persistence, permissions                                                         |
| FR-002 | Navigation and one Explore tour entry                                      | 101                                  | tour                                                                                            |
| FR-003 | Partner-only public listing and unlisted access                            | 110                                  | discovery, persistence, mcp                                                                     |
| FR-004 | Free core, Pro lock and existing upgrade flow                              | 101                                  | editor, persistence                                                                             |
| FR-005 | Timezone roadmap, optional held review and current phase                   | 101,104,109                          | policy, configuration, persistence                                                              |
| FR-006 | Ten source kinds, category groups and selection modes                      | 103,106,111,112                      | configuration, sources, youtube, upload-policy, defaults                                        |
| FR-007 | Twitch participant isolation and deliberate creator promotion              | 102                                  | participant-auth, participant, actions                                                          |
| FR-008 | Host-only query/link clip picker, attribution and rule revalidation        | 112                                  | sources, candidates                                                                             |
| FR-009 | Contextual Google linking, Brand-channel identity, YouTube metadata/search | 112 (shared picker)                  | youtube, connections, sources                                                                   |
| FR-010 | Game/person/choice/text inputs                                             | 102,104,111                          | sources, configuration                                                                          |
| FR-011 | Creator-owned S3/Drive streaming uploads and protected delivery            | 103,106,111                          | storage-security, connections, upload-provider, upload-policy, uploads, upload-route, upload-ui |
| FR-012 | Original personal entries, withdrawal and atomic limits                    | 102,104                              | persistence, concurrency, uploads                                                               |
| FR-013 | Canonical deduplication with separate private receipts                     | 112                                  | candidates, concurrency, persistence                                                            |
| FR-014 | Team table, nomination, grouping and hidden children                       | 104,106                              | persistence, review-ui, public-view                                                             |
| FR-015 | Frozen counters, missing-snapshot recovery and manual awards               | 105                                  | freeze, data-results-ui, public-view                                                            |
| FR-016 | Immediate replaceable global-limit ballots and exact server close          | 102                                  | persistence, concurrency, policy                                                                |
| FR-017 | Separate media/selection controls and retained private choice              | 102,103                              | media, public-page, public-view                                                                 |
| FR-018 | Rotatable fragment capability, arrows, branding, themes                    | 107,109                              | presenter, presenter-ui, presenter-plan                                                         |
| FR-019 | Arranged deck, multiple/custom statistics and count-up                     | 113                                  | configuration, presenter-plan, presenter-ui, persistence                                        |
| FR-020 | Animated category intro and manual large media/chat stage                  | 107,108,109                          | media, presenter-plan, presenter-ui                                                             |
| FR-021 | Percentage fills, shared/team ties, result-detail visibility               | 107                                  | candidates, presenter, public-view                                                              |
| FR-022 | Signed Twitch chat, Twitch badges/emotes, 7TV, account/prefix filters      | 108                                  | chat-buffer, chat-catalog, presenter-chat-ui, presenter                                         |
| FR-023 | Explicit dashboard/final-slide publication and same-link archive           | 105,107                              | presenter, persistence, public-view                                                             |
| FR-024 | Shared MCP operations, independent scopes and secret handling              | Native MCP owns this service journey | mcp; native OAuth/MCP and scope contracts                                                       |
| FR-025 | Installed HeroUI/Pro, preserved drafts and inspected responsive themes     | 101–113                              | editor, storage-settings, discovery-ui, media, upload-ui                                        |
| EC-001 | Invalid schedules, stale revisions, foreign authority                      | 101                                  | policy, configuration, persistence; MCP scope contracts                                         |
| EC-002 | Ineligible media, unsafe endpoints, expired credentials                    | 103,112                              | sources, youtube, connections, storage-security, upload-policy, uploads                         |
| EC-003 | Concurrent quota, deadline and foreign withdrawal                          | 102                                  | concurrency, persistence, uploads                                                               |
| EC-004 | Group membership, category, phase and child nomination guards              | 104                                  | persistence, candidates                                                                         |
| EC-005 | Incomplete historical results are explicit missing states                  | 105                                  | freeze, public-view                                                                             |
| EC-006 | Stale-page votes, allowed nominees and atomic retries                      | 102                                  | policy, persistence, concurrency                                                                |
| EC-007 | Revoked capability, private DTOs and script isolation                      | 107                                  | presenter, public-view; embeddedRoutes caller                                                   |
| EC-008 | Media retry, provider failure and independent navigation                   | 103,108,109                          | media, upload-provider, upload-ui, presenter-chat-ui                                            |
| EC-009 | Partner/publication boundaries and idempotent explicit release             | 105,107,110                          | discovery, presenter, persistence; MCP scope contracts                                          |

| Source       | Owning evidence                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| US1 / SC-001 | E2-101, E2-111 and E1 configuration/defaults/persistence; E3                     |
| US2 / SC-002 | E2-102, E2-103, E2-112; E1 participant-auth, sources, uploads and concurrency    |
| US3 / SC-003 | E2-104, E2-105, E2-106, E2-107, E2-113; E1 freeze/persistence; E3                |
| US4          | E2-102; E1 policy/persistence/concurrency/media                                  |
| US5          | E2-107, E2-108, E2-109, E2-113; E1 presenter/media/chat                          |
| US6 / SC-004 | E2-105, E2-107, E2-110; E3/E4                                                    |
| SC-005       | E1–E7 plus final quality gates below; no merge/release claim while CI is pending |

## Scenario Coverage Matrix

| E2 stable tag | Concrete journey                                                      | Current result                                                                                |
| ------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| BDD-US1-101   | Create awards and edit inline phase dates                             | Passed                                                                                        |
| BDD-US2-102   | Propose, withdraw, replace, vote, reload and retain closed choice     | Passed                                                                                        |
| BDD-US2-103   | Stream image into creator Drive, nominate and open real image         | Passed                                                                                        |
| BDD-US3-104   | Team add/group/nominate and release held review, hide originals       | Passed                                                                                        |
| BDD-US3-105   | Enter manual watchtime, explicitly publish and revisit result         | Passed                                                                                        |
| BDD-US3-106   | Team image candidate and public media playback                        | Passed                                                                                        |
| BDD-US5-107   | Manual nominee stage, reveal, secrecy, final prompt and publication   | Passed                                                                                        |
| BDD-US5-108   | Signed chat with Twitch badge/emote, 7TV and bot/command filters      | Passed build 15                                                                               |
| BDD-US5-109   | Both themes, desktop/phone, current phase, keyboard and focus return  | Passed build 15; twelve settled screenshots retained and inspected                            |
| BDD-US6-110   | Empty discovery, active partner listing and revoked-grant removal     | Passed build 11                                                                               |
| BDD-US1-111   | All nineteen Babbler categories and published countdown               | Passed build 11                                                                               |
| BDD-US2-112   | Clip query/link autocomplete, attribution, rule rejection and receipt | Passed build 15 with query/link, eligibility feedback, attribution and persisted canonical ID |
| BDD-US5-113   | Edit, arrange, save and present a custom statistics slide             | Passed build 15                                                                               |

## Applicability and Limits

BDD and ATDD share E2 because these are the same stakeholder acceptance boundaries. E3 is the highest verified real OAuth/MCP boundary and carries both roles without a duplicate browser execution. E1 provider transports, quota/ballot races, DNS pinning, signature checks and schema rules are technical checks; they do not pretend to exercise a live Google consent screen or cloud account. The real browser owns installed components, media interaction, keyboard/focus and responsive layout. No exhaustive screenreader/device certification is required.

The production behaviors have recorded Red/Green cycles, but some UI glue and acceptance checks were added as verification after implementation. Those checks are not retroactively labeled test-first. Original chronology is a known process limitation; current passing behavior and three deliberate killed mutants are compensating evidence, not replacement history.

## Quality Gate Results

| Gate                                          | Current result                                                                                                                        | Owner                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Local feature whole files                     | 39-file checkpoint Green; final benefit/lifecycle whole-file checks Green                                                             | E1                                         |
| Real browser and visual inspection            | All thirteen concrete journeys passed through the combined run and scoped retakes; build 15 combined run Green (13/13, 2.2m)          | E2                                         |
| Native OAuth/MCP and caller compatibility     | Green                                                                                                                                 | E3–E6                                      |
| Targeted mutation strength                    | Three killed mutants; no full mutation percentage                                                                                     | E7                                         |
| Lint / formatting                             | Repository lint Green (0 errors, 12 existing warnings); all 97 final owned files formatted; commit hooks Green                        | Repository checks and commit hook          |
| TypeScript / browser production build         | Build 15 Green, including TypeScript                                                                                                  | Existing build command                     |
| Complete coverage and required CI             | Initial full run found catalogue/tour/login caller gaps; local corrections Green; replacement full gate pending; thresholds unchanged | GitHub required gate                       |
| Real creator accounts / production deployment | Not executed; controlled provider evidence only                                                                                       | Operator rehearsal and ordinary deployment |
