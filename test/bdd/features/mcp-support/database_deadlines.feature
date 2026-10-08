@BDD
Feature: Bound unavailable database dependencies
  @US4 @BDD-DEPENDENCY-001
  Scenario Outline: A stalled database leaves no unbounded MCP work
    Given the MCP database dependency stalls during "<kind>"
    When the client requests MCP tools from that unavailable dependency
    Then the MCP database wait fails safely within ten seconds and releases its work
    Examples:
      | kind       |
      | statement  |
      | connection |
