@auth-engine-rewrite
Feature: Creator identity and delegated team access

  # Shared ATDD/BDD ownership: these journeys cover the externally visible
  # continuity outcome; deterministic migration and session edge cases live in TDD.
  @US1 @ATDD-US1-001
  Scenario: An existing creator keeps resources and editor authority after migration
    Given a representative legacy creator snapshot
    When the snapshot is migrated to Better Auth identities and memberships
    Then all creator resource subscription and entitlement identifiers are unchanged
    And the safely matched legacy editor receives Operations access

  @US1 @ATDD-US1-002
  Scenario: A legacy dashboard session recovers through Twitch sign-in
    Given an otherwise valid legacy dashboard JWT
    When the creator opens a protected dashboard after cutover
    Then the legacy dashboard JWT is rejected
    And the creator receives a recoverable Better Auth sign-in path

  @US1 @ATDD-US1-003
  Scenario: A live overlay continues while dashboard authentication is unavailable
    Given an unchanged live overlay URL and runtime secret
    When dashboard authentication is unavailable during cutover
    Then overlay HTTP and WebSocket runtime access remains available
    And the overlay URL and runtime secret remain byte-for-byte unchanged

  @US2 @ATDD-US2-001
  Scenario: A creator starts onboarding through Better Auth and Twitch
    Given a creator is signed out of Clipify
    When the creator starts Twitch sign-in from the public login page
    Then Better Auth requests the complete Twitch permission set
    And the callback targets the Clipify Better Auth Twitch route

  # Shared ATDD/BDD ownership: this outer journey proves the complete owner-to-member
  # outcome; lower-level invalid invitation states remain in the BDD feature.
  @US3 @ATDD-US3-001
  Scenario Outline: An owner delegates access with one invitation token
    Given a creator owner is ready to invite a team member
    When the owner creates a <delivery> team invitation
    Then the same invitation token is available to the owner and delivery channel
    When the invited person accepts with the verified account email
    Then the team member can open the authorized creator view
    And delegation completes in under three minutes

    Examples:
      | delivery      |
      | copy-link     |
      | optional-email |
