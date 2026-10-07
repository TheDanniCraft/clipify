@BDD @ATDD @US2 @FR-013 @BDD-US2-029
Feature: Isolate retry intents across client, actor and creator contexts

  Scenario Outline: Reuse textual keys only inside the exact authorized context
    When independently authorized MCP create retries differ by <context>
    Then each context gets its own resource and replays only its own result

    Examples:
      | context |
      | client  |
      | actor   |
      | creator |
