@auth-engine-rewrite
Feature: Identity and team access behavior

  @US2 @BDD-US2-001
  Scenario: A returning Twitch subject keeps one Clipify identity
    Given a Twitch subject has already completed Clipify onboarding
    When the same Twitch subject returns with a newly verified email
    Then Clipify keeps one person and creator account
    And the verified notification email is synchronized

  @US2 @BDD-US2-002
  Scenario Outline: OAuth failures produce precise recoverable outcomes
    Given Twitch returns the OAuth error <provider_error>
    When Clipify maps the provider callback failure
    Then the public auth error is <public_error>

    Examples:
      | provider_error                              | public_error               |
      | access_denied                               | TWITCH_CONSENT_DECLINED     |
      | state_not_found                             | TWITCH_STATE_EXPIRED        |
      | invalid_code                                | TWITCH_CALLBACK_FAILED      |
      | account_already_linked_to_different_user    | TWITCH_IDENTITY_CONFLICT    |

  @US2 @BDD-US2-003
  Scenario: A conflicting Twitch identity is rejected without partial records
    Given a Twitch subject is bound to an inconsistent person
    When Clipify attempts creator onboarding
    Then onboarding fails with TWITCH_IDENTITY_CONFLICT
    And no creator records are added

  @US3 @BDD-US3-001
  Scenario: A team member cannot use a permission outside the assigned role
    Given a direct team member only has analytics read access
    When the team member attempts to delete an overlay
    Then authorization is denied with PERMISSION_DENIED
    And the protected mutation is not invoked

  @US3 @BDD-US3-002
  Scenario Outline: Invalid invitations never create membership
    Given a pending team invitation
    And the invitation becomes <invalid_state>
    When the invited identity attempts acceptance
    Then invitation acceptance is denied with <error_code>
    And no team membership is created

    Examples:
      | invalid_state | error_code                 |
      | expired       | INVITATION_EXPIRED         |
      | replayed      | INVITATION_ALREADY_USED    |
      | revoked       | INVITATION_REVOKED         |
      | wrong-email   | INVITATION_EMAIL_MISMATCH  |

  @US3 @BDD-US3-003
  Scenario Outline: Email code remains available when a passkey cannot authenticate
    Given the account passkey is <passkey_state>
    When the person chooses a sign-in method
    Then the selected sign-in method is <method>

    Examples:
      | passkey_state    | method    |
      | unavailable      | email-otp |
      | removed          | email-otp |
      | replayed         | email-otp |
      | counter_regressed | email-otp |

  @US3 @BDD-US3-004
  Scenario: Repeated invitation attempts are throttled across instances
    Given the shared invitation threshold is exhausted
    When another invitation request arrives from the same identity and network
    Then the request is denied with RATE_LIMITED
    And retry timing is returned without creating an invitation

  @US3 @BDD-US3-005
  Scenario Outline: Sensitive team operations create redacted audit outcomes
    Given a protected <action_class> operation with outcome <outcome>
    When the operation records its audit result
    Then one append-only audit event is visible
    And the audit event contains no credential material

    Examples:
      | action_class          | outcome |
      | invitation            | success |
      | invitation            | denied  |
      | membership            | success |
      | membership            | denied  |
      | role                  | success |
      | role                  | denied  |
      | agency-link           | success |
      | agency-link           | denied  |
      | allocation            | success |
      | allocation            | denied  |
      | sensitive-integration | success |
      | sensitive-integration | denied  |
      | account-deletion      | success |
      | account-deletion      | denied  |
