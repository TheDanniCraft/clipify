@BDD @ATDD @US2 @FR-013
Feature: Replay a committed create intent without duplicating resources

  @BDD-US2-023
  Scenario: Replay an overlay create after its response is lost
    When the public MCP create retry is overlay lost-response
    Then the retry returns the original resource with exactly one creation

  @BDD-US2-024
  Scenario: Serialize simultaneous identical overlay creates
    When the public MCP create retry is overlay concurrent
    Then the retry returns the original resource with exactly one creation

  @BDD-US2-025
  Scenario: Reject changed input for a committed overlay retry key
    When the public MCP create retry is overlay conflict
    Then the changed retry is rejected and the original resource is preserved

  @BDD-US2-026
  Scenario: Replay a playlist create after its response is lost
    When the public MCP create retry is playlist lost-response
    Then the retry returns the original resource with exactly one creation

  @BDD-US2-027
  Scenario: Serialize simultaneous identical playlist creates
    When the public MCP create retry is playlist concurrent
    Then the retry returns the original resource with exactly one creation

  @BDD-US2-028
  Scenario: Reject changed input for a committed playlist retry key
    When the public MCP create retry is playlist conflict
    Then the changed retry is rejected and the original resource is preserved
