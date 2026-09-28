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

  # Shared ATDD/BDD ownership: owner lifecycle journeys exercise the release
  # boundary; the non-owner denial and mail timing live in the BDD feature.
  @US5 @ATDD-US5-001
  Scenario Outline: Owner manages account and subscription
    Given a recently authenticated creator account owner
    When the owner <operation>
    Then <expected_result>

    Examples:
      | operation                    | expected_result                                      |
      | updates account information  | the changes are recorded for that account            |
      | requests an account export   | an export is prepared without support intervention   |
      | cancels the subscription     | cancellation is recorded for the displayed date     |

  @US5 @ATDD-US5-002
  Scenario Outline: Account deletion observes the recovery boundary
    Given deletion suspension has begun for a creator account
    When <recovery_time> has elapsed
    Then <deletion_outcome>

    Examples:
      | recovery_time      | deletion_outcome                                             |
      | less than 30 days  | the account remains recoverable and cannot be purged          |
      | at least 30 days   | the account becomes eligible for permanent erasure            |

  @US5 @ATDD-US5-003
  Scenario: Owner recovers a suspended account through authenticated recovery
    Given a suspended creator account with a recovery entry point
    When the owner signs in confirms identity and cancels deletion before 30 days
    Then account dashboard overlay and integration access are restored
    And the recovery entry point alone cannot authenticate the owner
    And billing and agency allocations are not restarted

  @US5 @ATDD-US5-004
  Scenario Outline: Owner chooses when deletion suspension begins
    Given a recently authenticated owner with paid access through a future date
    When the owner chooses <deletion_choice>
    Then <suspension_result>
    And Stripe remains responsible for billing lifecycle notices

    Examples:
      | deletion_choice           | suspension_result                                  |
      | delete after paid access  | suspension starts on the paid-through date         |
      | delete now                | suspension starts immediately with data retained   |

  # Shared ATDD/BDD ownership: these scenarios prove release boundaries. The
  # individual checkpoint failure examples remain owned by the BDD feature.
  @US6 @ATDD-US6-001
  Scenario: Automated cutover completes successfully and idempotently
    Given a verified backup and a valid pre-migration database
    When the operator completes the cutover workflow twice against the same database state
    Then all cutover records are migrated exactly once
    And every required invariant and smoke check passes before maintenance mode is removed
    And the immutable cutover manifest remains valid

  @US6 @ATDD-US6-002
  Scenario: Cutover removes the legacy runtime after validation
    Given migration validation and smoke checks have passed
    When the new identity runtime is activated
    Then no request depends on the legacy auth runtime
    And the legacy structures are eligible for approved removal
