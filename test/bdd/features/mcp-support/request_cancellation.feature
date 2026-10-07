@BDD @US4 @FR-012 @BDD-HTTP-003
Feature: Release incomplete MCP request bodies
  Scenario Outline: An incomplete request body is bounded before authentication
    Given an MCP client sends an incomplete body that is <mode>
    When the public MCP route finishes reading the body
    Then the request returns <status> and releases the body reader
    Examples:
      | mode         | status |
      | aborted-body | 400    |
      | stalled-body | 408    |
