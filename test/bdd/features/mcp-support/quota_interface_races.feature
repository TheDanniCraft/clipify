@BDD @ATDD @US3 @FR-010 @EC-011
Feature: Independent browser and MCP creation requests share backend quota

  @BDD-US3-030
  Scenario: Twenty browser session creation requests share one allowance
    Given twenty independent "browser" requests target an empty Free creator
    When all creation requests run concurrently through their public interfaces
    Then exactly one overlay exists and nineteen requests receive plan limit errors with 20 browser and 0 MCP requests

  @BDD-US3-031
  Scenario: Twenty MCP HTTP creation requests share one allowance
    Given twenty independent "mcp" requests target an empty Free creator
    When all creation requests run concurrently through their public interfaces
    Then exactly one overlay exists and nineteen requests receive plan limit errors with 0 browser and 20 MCP requests

  @BDD-US3-032
  Scenario: Ten browser and ten MCP requests share one allowance
    Given twenty independent "mixed" requests target an empty Free creator
    When all creation requests run concurrently through their public interfaces
    Then exactly one overlay exists and nineteen requests receive plan limit errors with 10 browser and 10 MCP requests
