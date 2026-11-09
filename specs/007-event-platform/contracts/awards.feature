@BDD
Feature: Creator Awards

  @BDD-US1-001 @US1 @FR-001
  Scenario: create and manage Awards events for the selected creator, including agency context, title, description, category groups, draft/published state and deletion safeguards
    Given an isolated awards event for this scenario
    When the participant exercises "FR-001"
    Then the agreed "FR-001" outcome holds

  @BDD-US1-002 @US1 @FR-002
  Scenario: place Events with clip tools and add one short Explore Clipify tour step without a separate creation tour
    Given an isolated awards event for this scenario
    When the participant exercises "FR-002"
    Then the agreed "FR-002" outcome holds

  @BDD-US1-003 @US1 @FR-003
  Scenario: permit public discovery only for partner creators; all creators may share unlisted events. Enforce this through UI, server and MCP
    Given an isolated awards event for this scenario
    When the participant exercises "FR-003"
    Then the agreed "FR-003" outcome holds

  @BDD-US1-004 @US1 @FR-004
  Scenario: keep core events free and gate white-label/additional branding through existing Pro upgrades without silently saving unavailable values
    Given an isolated awards event for this scenario
    When the participant exercises "FR-004"
    Then the agreed "FR-004" outcome holds

  @BDD-US1-005 @US1 @FR-005
  Scenario: provide a timezone-aware phase roadmap with inline date/time controls and current progress: announcement, submission, optional review, voting and closed. Publication begins announcement; review can be skipped or await authorized release
    Given an isolated awards event for this scenario
    When the participant exercises "FR-005"
    Then the agreed "FR-005" outcome holds

  @BDD-US1-006 @US1 @FR-006
  Scenario: support category groups, source types clip/image/video/audio/text/link/youtube/person/game/choice, category submission limits including unlimited, nomination limits and audience/team/data selection modes
    Given an isolated awards event for this scenario
    When the participant exercises "FR-006"
    Then the agreed "FR-006" outcome holds

  @BDD-US2-007 @US2 @FR-007
  Scenario: authenticate participants with Twitch from the event page without creating creator access, creator organizations or sending creator welcome/onboarding email. Existing creators may participate and viewers may later onboard deliberately
    Given an isolated awards event for this scenario
    When the participant exercises "FR-007"
    Then the agreed "FR-007" outcome holds

  @BDD-US2-008 @US2 @FR-008
  Scenario: search only the host creator clips using a single autocomplete supporting query and pasted Twitch URL with thumbnail/title/clipper metadata; apply date, view and title conditions to search, resolve and submit
    Given an isolated awards event for this scenario
    When the participant exercises "FR-008"
    Then the agreed "FR-008" outcome holds

  @BDD-US2-009 @US2 @FR-009
  Scenario: connect the host YouTube channel through existing account linking, preserving Brand-channel identity; resolve videos to metadata/player and support channel-scoped live search without a persistent video index. Reject foreign or rule-ineligible videos
    Given an isolated awards event for this scenario
    When the participant exercises "FR-009"
    Then the agreed "FR-009" outcome holds

  @BDD-US2-010 @US2 @FR-010
  Scenario: offer Twitch game catalog selection with name and cover, Twitch-person input, choice selection and text with optional description
    Given an isolated awards event for this scenario
    When the participant exercises "FR-010"
    Then the agreed "FR-010" outcome holds

  @BDD-US2-011 @US2 @FR-011
  Scenario: require creator-owned S3-compatible or Google Drive storage for image/video/audio uploads; support both, contextual Google scopes, validated types/sizes and authorized upload/delivery without persistent Clipify media storage
    Given an isolated awards event for this scenario
    When the participant exercises "FR-011"
    Then the agreed "FR-011" outcome holds

  @BDD-US2-012 @US2 @FR-012
  Scenario: show personal original submissions and allow withdrawal during submission; limits count active personal entries even after grouping. Enforce limits atomically
    Given an isolated awards event for this scenario
    When the participant exercises "FR-012"
    Then the agreed "FR-012" outcome holds

  @BDD-US3-013 @US3 @FR-013
  Scenario: automatically deduplicate canonical clip/video/game IDs within a category without leaking personal identities
    Given an isolated awards event for this scenario
    When the participant exercises "FR-013"
    Then the agreed "FR-013" outcome holds

  @BDD-US3-014 @US3 @FR-014
  Scenario: let authorized team members filter/select a review table, nominate and group text/general links under one display candidate. Retain original personal entries; nominate a group once and hide its children from voting/presenter
    Given an isolated awards event for this scenario
    When the participant exercises "FR-014"
    Then the agreed "FR-014" outcome holds

  @BDD-US3-015 @US3 @FR-015
  Scenario: freeze data-derived results at submission close; hide these categories from submission/voting. Never substitute later live counters as historical values. Allow team-entered watchtime/team/other results
    Given an isolated awards event for this scenario
    When the participant exercises "FR-015"
    Then the agreed "FR-015" outcome holds

  @BDD-US4-016 @US4 @FR-016
  Scenario: use an event-wide maximum choices-per-category, default one; save immediately, permit changes until server-enforced close, and never require all available votes
    Given an isolated awards event for this scenario
    When the participant exercises "FR-016"
    Then the agreed "FR-016" outcome holds

  @BDD-US4-017 @US4 @FR-017
  Scenario: display nominee media cards with separate accessible selection and enlargement/play controls; retain own selections after close while concealing results
    Given an isolated awards event for this scenario
    When the participant exercises "FR-017"
    Then the agreed "FR-017" outcome holds

  @BDD-US5-018 @US5 @FR-018
  Scenario: provide revocable secret presenter access with keyboard arrows and two subtle navigation buttons, creator fonts/colors and light/dark presentation
    Given an isolated awards event for this scenario
    When the participant exercises "FR-018"
    Then the agreed "FR-018" outcome holds

  @BDD-US5-019 @US5 @FR-019
  Scenario: arrange welcome/text/statistics/category/closing slides; statistics support multiple built-in or manual label-number values with counting animation and usable overflow layout
    Given an isolated awards event for this scenario
    When the participant exercises "FR-019"
    Then the agreed "FR-019" outcome holds

  @BDD-US5-020 @US5 @FR-020
  Scenario: animate category introduction and show nominees; open all content manually in a large view with optional approximately 3:1 media/chat split; do not autoplay each nominee
    Given an isolated awards event for this scenario
    When the participant exercises "FR-020"
    Then the agreed "FR-020" outcome holds

  @BDD-US5-021 @US5 @FR-021
  Scenario: reveal result percentages using animated bottom-up translucent fills; highlight winners but enlarge/play only on click; support configurable shared-winner/team tie resolution and result-detail visibility
    Given an isolated awards event for this scenario
    When the participant exercises "FR-021"
    Then the agreed "FR-021" outcome holds

  @BDD-US5-022 @US5 @FR-022
  Scenario: show Twitch chat with Twitch badges/emotes and 7TV emotes, configurable hidden accounts and command prefixes. Handle chat disconnect/retry. 7TV badges are best-effort optional
    Given an isolated awards event for this scenario
    When the participant exercises "FR-022"
    Then the agreed "FR-022" outcome holds

  @BDD-US6-023 @US6 @FR-023
  Scenario: publish results only by explicit authorized dashboard/presenter action, including a distinct prompt after final slide. Preserve same URL as winner/candidate archive
    Given an isolated awards event for this scenario
    When the participant exercises "FR-023"
    Then the agreed "FR-023" outcome holds

  @BDD-US6-024 @US6 @FR-024
  Scenario: expose creator/team event operations through MCP with same authorization, restrictions, validation and secret handling as dashboard
    Given an isolated awards event for this scenario
    When the participant exercises "FR-024"
    Then the agreed "FR-024" outcome holds

  @BDD-US1-025 @US1 @FR-025
  Scenario: reuse installed HeroUI/Pro and existing editors; use Mobbin references for each major screen/flow; support desktop/mobile, both themes, ordinary keyboard access, loading/empty/retry and preserved drafts
    Given an isolated awards event for this scenario
    When the participant exercises "FR-025"
    Then the agreed "FR-025" outcome holds

  @BDD-US1-026 @US1 @EC-001
  Scenario: Reject unordered/invalid schedules, stale updates and cross-creator access
    Given an isolated awards event for this scenario
    When the participant exercises "EC-001"
    Then the agreed "EC-001" outcome holds

  @BDD-US2-027 @US2 @EC-002
  Scenario: Reject malformed/foreign/ineligible media links, unsupported uploads, unsafe storage endpoints and expired/revoked storage credentials with local recovery
    Given an isolated awards event for this scenario
    When the participant exercises "EC-002"
    Then the agreed "EC-002" outcome holds

  @BDD-US2-028 @US2 @EC-003
  Scenario: Reject concurrent limit bypass and submissions at/after close; withdrawal must not delete another viewer entry
    Given an isolated awards event for this scenario
    When the participant exercises "EC-003"
    Then the agreed "EC-003" outcome holds

  @BDD-US3-029 @US3 @EC-004
  Scenario: Reject cross-category grouping, duplicate membership, grouping after voting and child nominations
    Given an isolated awards event for this scenario
    When the participant exercises "EC-004"
    Then the agreed "EC-004" outcome holds

  @BDD-US3-030 @US3 @EC-005
  Scenario: Missing/incomplete frozen source data is an explicit unavailable result requiring recovery, never an invented historical winner
    Given an isolated awards event for this scenario
    When the participant exercises "EC-005"
    Then the agreed "EC-005" outcome holds

  @BDD-US4-031 @US4 @EC-006
  Scenario: Reject votes from stale open pages, over-limit selections, unapproved candidates, foreign categories and unauthorized identities; atomic retry must not duplicate votes
    Given an isolated awards event for this scenario
    When the participant exercises "EC-006"
    Then the agreed "EC-006" outcome holds

  @BDD-US5-032 @US5 @EC-007
  Scenario: Reject expired/rotated presenter secrets and prevent secrets/results from leaking through public responses, caches or logs
    Given an isolated awards event for this scenario
    When the participant exercises "EC-007"
    Then the agreed "EC-007" outcome holds

  @BDD-US5-033 @US5 @EC-008
  Scenario: Handle missing/deleted media, provider throttling, chat disconnect and blocked playback without breaking navigation
    Given an isolated awards event for this scenario
    When the participant exercises "EC-008"
    Then the agreed "EC-008" outcome holds

  @BDD-US6-034 @US6 @EC-009
  Scenario: Deny nonpartner public listing and unauthorized result publication; repeated publication is safe and presenter navigation alone never publishes
    Given an isolated awards event for this scenario
    When the participant exercises "EC-009"
    Then the agreed "EC-009" outcome holds

  @BDD-US1-035 @US1 @FR-005 @EC-001 @EC-006
  Scenario Outline: Server phase boundaries control participation
    Given a published event with submissions from January 1 to February 1
    And voting from February 8 to February 15 with review released
    When the server time is "<time>"
    Then the phase is "<phase>"
    Examples:
      | time                     | phase        |
      | 2025-12-31T23:59:59.999Z | announcement |
      | 2026-01-01T00:00:00.000Z | submissions  |
      | 2026-02-01T00:00:00.000Z | review       |
      | 2026-02-08T00:00:00.000Z | voting       |
      | 2026-02-15T00:00:00.000Z | closed       |
