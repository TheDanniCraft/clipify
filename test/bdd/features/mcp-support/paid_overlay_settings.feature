@BDD
Feature: Preserve creator plan restrictions for agents

  @US3 @FR-009 @EC-009 @BDD-US3-019
  Scenario Outline: A Free creator cannot enable paid settings through MCP
    Given an approved Free creator attempts "<setting>" paid settings
    When the agent submits the paid overlay change
    Then the paid change is rejected and the saved configuration is preserved

    Examples:
      | setting      |
      | free         |
      | free-filter  |
      | free-styling |
