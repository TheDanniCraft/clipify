@BDD
Feature: Bound client metadata DNS lookup before OAuth authorization
  @US1 @BDD-CIMD-DEADLINE-001
  Scenario Outline: Remote client metadata cannot cause an unbounded DNS wait
    Given the isolated client metadata hostname has "<dns>" DNS behavior
    When the actual provider resolves client metadata for authorization
    Then metadata fails within the dependency budget without creating a client or contacting a forbidden host
    Examples:
      | dns |
      | stalled |
      | private |
