# Feature Specification: Creator Event Platform — Awards

**Feature Branch**: `feature/event-platform`

**Created**: 2026-11-09

**Status**: Specified; implementation not started

**Input**: Approved multi-turn requirements for a reusable Awards platform capable of running the complete Babbler Awards.

## Clarifications

### Session 2026-11-09

All material product questions were answered in the preceding conversation. No further stakeholder questions required. Data freezes at submission close; results publish manually; original submissions survive grouping; host-only media; both S3 and Drive; partner-only public discovery; event-wide voting limit.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configure an event (Priority: P1)

**BDD**: Required. **ATDD**: Required.

**Why this priority**: Required to conduct the complete award show.

**Independent Test**: Exercise the corresponding real event entry point with isolated fixtures.

**Acceptance Scenarios**:

1. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-001 holds: Create and manage Awards events for the selected creator, including agency context, title, description, category groups, draft/published state and deletion safeguards.
2. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-002 holds: Place Events with clip tools and add one short Explore Clipify tour step without a separate creation tour.
3. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-003 holds: Permit public discovery only for partner creators; all creators may share unlisted events. Enforce this through UI, server and MCP.
4. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-004 holds: Keep core events free and gate white-label/additional branding through existing Pro upgrades without silently saving unavailable values.
5. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-005 holds: Provide a timezone-aware phase roadmap with inline date/time controls and current progress: announcement, submission, optional review, voting and closed. Publication begins announcement; review can be skipped or await authorized release.
6. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-006 holds: Support category groups, source types clip/image/video/audio/text/link/youtube/person/game/choice, category submission limits including unlimited, nomination limits and audience/team/data selection modes.
7. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-025 holds: Reuse installed HeroUI/Pro and existing editors; use Mobbin references for each major screen/flow; support desktop/mobile, both themes, ordinary keyboard access, loading/empty/retry and preserved drafts.

### User Story 2 - Submit award candidates (Priority: P1)

**BDD**: Required. **ATDD**: Required.

**Why this priority**: Required to conduct the complete award show.

**Independent Test**: Exercise the corresponding real event entry point with isolated fixtures.

**Acceptance Scenarios**:

7. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-007 holds: Authenticate participants with Twitch from the event page without creating creator access, creator organizations or sending creator welcome/onboarding email. Existing creators may participate and viewers may later onboard deliberately.
8. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-008 holds: Search only the host creator clips using a single autocomplete supporting query and pasted Twitch URL with thumbnail/title/clipper metadata; apply date, view and title conditions to search, resolve and submit.
9. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-009 holds: Connect the host YouTube channel through existing account linking, preserving Brand-channel identity; resolve videos to metadata/player and support channel-scoped live search without a persistent video index. Reject foreign or rule-ineligible videos.
10. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-010 holds: Offer Twitch game catalog selection with name and cover, Twitch-person input, choice selection and text with optional description.
11. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-011 holds: Require creator-owned S3-compatible or Google Drive storage for image/video/audio uploads; support both, contextual Google scopes, validated types/sizes and authorized upload/delivery without persistent Clipify media storage.
12. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-012 holds: Show personal original submissions and allow withdrawal during submission; limits count active personal entries even after grouping. Enforce limits atomically.

### User Story 3 - Review nominations and freeze data (Priority: P1)

**BDD**: Required. **ATDD**: Required.

**Why this priority**: Required to conduct the complete award show.

**Independent Test**: Exercise the corresponding real event entry point with isolated fixtures.

**Acceptance Scenarios**:

13. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-013 holds: Automatically deduplicate canonical clip/video/game IDs within a category without leaking personal identities.
14. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-014 holds: Let authorized team members filter/select a review table, nominate and group text/general links under one display candidate. Retain original personal entries; nominate a group once and hide its children from voting/presenter.
15. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-015 holds: Freeze data-derived results at submission close; hide these categories from submission/voting. Never substitute later live counters as historical values. Allow team-entered watchtime/team/other results.

### User Story 4 - Vote and retain selections (Priority: P1)

**BDD**: Required. **ATDD**: Required.

**Why this priority**: Required to conduct the complete award show.

**Independent Test**: Exercise the corresponding real event entry point with isolated fixtures.

**Acceptance Scenarios**:

16. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-016 holds: Use an event-wide maximum choices-per-category, default one; save immediately, permit changes until server-enforced close, and never require all available votes.
17. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-017 holds: Display nominee media cards with separate accessible selection and enlargement/play controls; retain own selections after close while concealing results.

### User Story 5 - Run the live award show (Priority: P1)

**BDD**: Required. **ATDD**: Required.

**Why this priority**: Required to conduct the complete award show.

**Independent Test**: Exercise the corresponding real event entry point with isolated fixtures.

**Acceptance Scenarios**:

18. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-018 holds: Provide revocable secret presenter access with keyboard arrows and two subtle navigation buttons, creator fonts/colors and light/dark presentation.
19. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-019 holds: Arrange welcome/text/statistics/category/closing slides; statistics support multiple built-in or manual label-number values with counting animation and usable overflow layout.
20. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-020 holds: Animate category introduction and show nominees; open all content manually in a large view with optional approximately 3:1 media/chat split; do not autoplay each nominee.
21. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-021 holds: Reveal result percentages using animated bottom-up translucent fills; highlight winners but enlarge/play only on click; support configurable shared-winner/team tie resolution and result-detail visibility.
22. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-022 holds: Show Twitch chat with Twitch badges/emotes and 7TV emotes, configurable hidden accounts and command prefixes. Handle chat disconnect/retry. 7TV badges are best-effort optional.

### User Story 6 - Publish and revisit results (Priority: P1)

**BDD**: Required. **ATDD**: Required.

**Why this priority**: Required to conduct the complete award show.

**Independent Test**: Exercise the corresponding real event entry point with isolated fixtures.

**Acceptance Scenarios**:

23. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-023 holds: Publish results only by explicit authorized dashboard/presenter action, including a distinct prompt after final slide. Preserve same URL as winner/candidate archive.
24. **Given** a correctly authorized event context, **When** the participant uses this capability, **Then** FR-024 holds: Expose creator/team event operations through MCP with same authorization, restrictions, validation and secret handling as dashboard.

### Edge Cases

- **EC-001**: Reject unordered/invalid schedules, stale updates and cross-creator access.
- **EC-002**: Reject malformed/foreign/ineligible media links, unsupported uploads, unsafe storage endpoints and expired/revoked storage credentials with local recovery.
- **EC-003**: Reject concurrent limit bypass and submissions at/after close; withdrawal must not delete another viewer entry.
- **EC-004**: Reject cross-category grouping, duplicate membership, grouping after voting and child nominations.
- **EC-005**: Missing/incomplete frozen source data is an explicit unavailable result requiring recovery, never an invented historical winner.
- **EC-006**: Reject votes from stale open pages, over-limit selections, unapproved candidates, foreign categories and unauthorized identities; atomic retry must not duplicate votes.
- **EC-007**: Reject expired/rotated presenter secrets and prevent secrets/results from leaking through public responses, caches or logs.
- **EC-008**: Handle missing/deleted media, provider throttling, chat disconnect and blocked playback without breaking navigation.
- **EC-009**: Deny nonpartner public listing and unauthorized result publication; repeated publication is safe and presenter navigation alone never publishes.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST create and manage Awards events for the selected creator, including agency context, title, description, category groups, draft/published state and deletion safeguards.
- **FR-002**: System MUST place Events with clip tools and add one short Explore Clipify tour step without a separate creation tour.
- **FR-003**: System MUST permit public discovery only for partner creators; all creators may share unlisted events. Enforce this through UI, server and MCP.
- **FR-004**: System MUST keep core events free and gate white-label/additional branding through existing Pro upgrades without silently saving unavailable values.
- **FR-005**: System MUST provide a timezone-aware phase roadmap with inline date/time controls and current progress: announcement, submission, optional review, voting and closed. Publication begins announcement; review can be skipped or await authorized release.
- **FR-006**: System MUST support category groups, source types clip/image/video/audio/text/link/youtube/person/game/choice, category submission limits including unlimited, nomination limits and audience/team/data selection modes.
- **FR-007**: System MUST authenticate participants with Twitch from the event page without creating creator access, creator organizations or sending creator welcome/onboarding email. Existing creators may participate and viewers may later onboard deliberately.
- **FR-008**: System MUST search only the host creator clips using a single autocomplete supporting query and pasted Twitch URL with thumbnail/title/clipper metadata; apply date, view and title conditions to search, resolve and submit.
- **FR-009**: System MUST connect the host YouTube channel through existing account linking, preserving Brand-channel identity; resolve videos to metadata/player and support channel-scoped live search without a persistent video index. Reject foreign or rule-ineligible videos.
- **FR-010**: System MUST offer Twitch game catalog selection with name and cover, Twitch-person input, choice selection and text with optional description.
- **FR-011**: System MUST require creator-owned S3-compatible or Google Drive storage for image/video/audio uploads; support both, contextual Google scopes, validated types/sizes and authorized upload/delivery without persistent Clipify media storage.
- **FR-012**: System MUST show personal original submissions and allow withdrawal during submission; limits count active personal entries even after grouping. Enforce limits atomically.
- **FR-013**: System MUST automatically deduplicate canonical clip/video/game IDs within a category without leaking personal identities.
- **FR-014**: System MUST let authorized team members filter/select a review table, nominate and group text/general links under one display candidate. Retain original personal entries; nominate a group once and hide its children from voting/presenter.
- **FR-015**: System MUST freeze data-derived results at submission close; hide these categories from submission/voting. Never substitute later live counters as historical values. Allow team-entered watchtime/team/other results.
- **FR-016**: System MUST use an event-wide maximum choices-per-category, default one; save immediately, permit changes until server-enforced close, and never require all available votes.
- **FR-017**: System MUST display nominee media cards with separate accessible selection and enlargement/play controls; retain own selections after close while concealing results.
- **FR-018**: System MUST provide revocable secret presenter access with keyboard arrows and two subtle navigation buttons, creator fonts/colors and light/dark presentation.
- **FR-019**: System MUST arrange welcome/text/statistics/category/closing slides; statistics support multiple built-in or manual label-number values with counting animation and usable overflow layout.
- **FR-020**: System MUST animate category introduction and show nominees; open all content manually in a large view with optional approximately 3:1 media/chat split; do not autoplay each nominee.
- **FR-021**: System MUST reveal result percentages using animated bottom-up translucent fills; highlight winners but enlarge/play only on click; support configurable shared-winner/team tie resolution and result-detail visibility.
- **FR-022**: System MUST show Twitch chat with Twitch badges/emotes and 7TV emotes, configurable hidden accounts and command prefixes. Handle chat disconnect/retry. 7TV badges are best-effort optional.
- **FR-023**: System MUST publish results only by explicit authorized dashboard/presenter action, including a distinct prompt after final slide. Preserve same URL as winner/candidate archive.
- **FR-024**: System MUST expose creator/team event operations through MCP with same authorization, restrictions, validation and secret handling as dashboard.
- **FR-025**: System MUST reuse installed HeroUI/Pro and existing editors; use Mobbin references for each major screen/flow; support desktop/mobile, both themes, ordinary keyboard access, loading/empty/retry and preserved drafts.

### Key Entities

Event; category; source rules; storage connection; personal submission; canonical candidate/group; nomination; voter selection; frozen result; presenter deck/slide/secret; manual statistic. Every managed entity belongs to the host creator.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A creator can configure all supplied Babbler categories and publish an announcement.
- **SC-002**: A viewer can submit, withdraw, vote, revise and revisit through the real public flow without creator onboarding.
- **SC-003**: A team can review/group/nominate and run the complete show using persisted data without exposing hidden results.
- **SC-004**: A creator can explicitly publish and viewers can revisit winners at the original link.
- **SC-005**: All required positive and negative acceptance scenarios pass with no unresolved release-blocking defects.

## Assumptions

- Existing authorization, billing, creator branding, provider linking and media helpers are reused.
- Recaps, tournaments, plugin marketplace, newsletter, automatic YouTube rankings and Twitch polls/predictions are out of scope. 7TV badges are optional.
- The pilot category list below is fixture/acceptance data, not hard-coded product behavior.
- Basic keyboard accessibility is required; exhaustive device/screenreader/scaling certification is not.
- Normal uploads retain provider references; lifecycle/deletion must preserve published candidate integrity.

## Pilot categories

Jan Deluxe: Bestes YouTube Thumbnail; Größter Technischer Fail; Bester Play des Jahres von Jan; Dümmstes Zitat von Jan; Bester Erschrecker; Bester Holy (choices).
Community: Größter Troll; Bester Fail; Bester Play; Lustigstes Bild von Jan; Größter Ragebaiter/Trashtalker (Twitch person); Insider (name/description); Größter Lachflash; Bestes Side-Game; Überraschungskategorie.
Data/team: most-viewed Twitch clip; most-viewed YouTube video (manual allowed); Top Watchtime (manual); Babbler Team des Jahres (manual).

## Test Classification and Applicability Matrix

| Source | TDD      | BDD      | ATDD     | Intent                                                                                |
| ------ | -------- | -------- | -------- | ------------------------------------------------------------------------------------- |
| FR-001 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-002 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-003 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-004 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-005 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-006 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-007 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-008 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-009 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-010 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-011 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-012 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-013 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-014 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-015 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-016 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-017 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-018 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-019 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-020 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-021 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-022 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-023 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-024 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| FR-025 | Required | Required | Required | Positive capability plus applicable EC boundaries; one owning artifact, shared roles. |
| US1    | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| US2    | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| US3    | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| US4    | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| US5    | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| US6    | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| SC-001 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| SC-002 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| SC-003 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| SC-004 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| SC-005 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-001 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-002 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-003 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-004 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-005 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-006 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-007 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-008 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |
| EC-009 | Required | Required | Required | Trace through associated feature behavior and acceptance boundary.                    |

## Planned evidence

Canonical scenario and implementation-test inventories are maintained in `test-traceability.md` and `tdd/test-list.md` before implementation. Each FR receives distinct scenario examples for supported types and each EC has negative examples; one executable owner may provide both BDD and ATDD when the same real boundary proves both. No passing evidence is claimed at specification time.
