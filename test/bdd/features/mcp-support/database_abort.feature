@BDD
Feature: Cancel request-owned MCP database work
  @US4 @BDD-CANCELLATION-001
  Scenario Outline: Aborting a database request does not commit later or cancel unrelated work
    Given the MCP database request is "<state>" with independently borrowed database connections
    When the client aborts that database request
    Then that request terminates promptly without a later commit and unrelated database work remains healthy
    Examples:
      | state  |
      | busy   |
      | queued |
      | mismatched-backend |
