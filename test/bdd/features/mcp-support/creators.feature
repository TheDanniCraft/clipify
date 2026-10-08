@BDD
Feature: Discover creators and current capabilities

  @US2 @FR-006 @BDD-US2-001
  Scenario: The client lists creators — owned, directly shared, agency-linked, and inaccessible creators exist
    Given owned, directly shared, agency-linked, and inaccessible creators exist
    When the client lists creators
    Then only creators permitted by both the grant and current membership appear

  @US2 @FR-006 @BDD-US2-002
  Scenario: The client requests capabilities — the user selects an accessible creator with current usage and grants
    Given the user selects an accessible creator with current usage and grants
    When the client requests capabilities
    Then the effective plan, current usage, limits, and eligible operations are reported
