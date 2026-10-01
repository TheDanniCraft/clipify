@auth-engine-rewrite
Feature: Creator identity and delegated team access

  @US1 @ATDD-US1-003
  Scenario: A live overlay continues while its creator is signed out
    Given an unchanged live overlay URL and runtime secret
    When the creator is signed out of the dashboard
    Then overlay HTTP and WebSocket runtime access remains available
    And the overlay URL and runtime secret remain byte-for-byte unchanged

  @US2 @ATDD-US2-001
  Scenario: A creator starts onboarding through Better Auth and Twitch
    Given a creator is signed out of Clipify
    When the creator starts Twitch sign-in from the public login page
    Then Better Auth requests the complete Twitch permission set
    And the callback targets the Clipify Better Auth Twitch route
    And a database-backed Better Auth session opens the creator dashboard

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

  # Shared ATDD/BDD ownership: these agency journeys prove creator ownership,
  # live intersection, and creator-seat semantics at the stakeholder boundary.
  @US4 @ATDD-US4-003
  Scenario: Provisioned agency owner activates the Agency Account
    Given a Clipify administrator provisioned an Agency Account after custom commercial terms were agreed
    When its designated first owner verifies the invited email and accepts the invitation
    Then the person becomes the Agency Account owner
    And the owner can sign in by email code without connecting Twitch

  @US4 @ATDD-US4-001
  Scenario: Agency gains access after creator approval
    Given an agency requests access to an independent Creator Account with one staff member authorized by an agency role
    When the creator owner accepts the request with a creator-approved permission set
    Then the staff member can manage the creator only through permissions present in both sets
    And the creator owner remains the owner

  @US4 @ATDD-US4-002
  Scenario: Agency allocates a paid creator license
    Given an agency has an available paid creator license and an accepted creator link
    When the agency allocates the license to that creator
    Then the creator receives the agency-funded capabilities
    And creator and agency team members do not consume additional creator licenses
    And the creator receives one transactional allocation notice

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
