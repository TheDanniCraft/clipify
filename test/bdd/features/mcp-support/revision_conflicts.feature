@BDD @ATDD @US2 @FR-007 @FR-014 @FR-017 @EC-021
Feature: Protect edits with the revision each interface actually read

  @BDD-US2-030
  Scenario Outline: Reject the second writer's stale revision
    When resource "<resource>" is edited first by <first> and then by <second>
    Then the stale second writer preserves the first committed configuration

    Examples:
      | resource       | first   | second  |
      | overlay        | browser | MCP     |
      | overlay        | MCP     | browser |
      | overlay        | MCP     | MCP     |
      | overlay        | browser | browser |
      | playlist       | browser | MCP     |
      | playlist       | MCP     | browser |
      | playlist       | MCP     | MCP     |
      | playlist       | browser | browser |
      | playlist items | browser | MCP     |
      | playlist items | MCP     | browser |
      | playlist items | MCP     | MCP     |
      | playlist items | browser | browser |

  @BDD-US2-031
  Scenario Outline: Read the latest revision before retrying the desired edit
    When resource "<resource>" is edited first by MCP and then by MCP
    Then the rejected writer can read the latest revision and commit its new edit

    Examples:
      | resource       |
      | overlay        |
      | playlist       |
      | playlist items |
