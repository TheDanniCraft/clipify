@BDD
Feature: Refresh a Clipify connection

  @US1 @FR-004 @BDD-US1-018
  Scenario: The client refreshes access — a valid refresh grant exists
    Given a valid refresh grant exists
    When the client refreshes access
    Then renewed access preserves or narrows the approved permissions

  @US1 @FR-004 @EC-005 @BDD-US1-019
  Scenario Outline: The client refreshes access — a refresh grant is expired or the client requests wider permissions
    Given the client presents <invalid>
    When the client refreshes access
    Then refresh is rejected without widening access

    Examples:
      | invalid |
      | an expired refresh grant |
      | a request for wider permissions |
