@BDD @ATDD @US2 @FR-009 @FR-012 @EC-013
Feature: Every mutation follows current creator authority and plan
  @BDD-MUTATION-AUTHORITY-001
  Scenario Outline: Evaluate every applicable mutation against current backend state
    Given the mutation authority catalogue selects "<phase>"
    When every applicable mutation uses the actual public MCP route
    Then each result and persisted state agree with that authority boundary
    Examples:
      | phase              |
      | unapproved-creator |
      | denied-role        |
      | foreign-resource   |
      | failed-audit       |
      | direct-pro         |
      | direct-free        |
      | owner-free         |
      | agency-pro         |
      | agency-free        |
      | paid-boundary      |
