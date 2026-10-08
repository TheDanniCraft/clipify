@BDD @US4 @FR-016 @BDD-ACTIVITY-002
Feature: Inspect creator activity with current audit permission
  Scenario Outline: Current access controls private creator activity
    Given a creator activity viewer has <mode> access
    When the viewer requests creator MCP activity
    Then the activity result is <outcome> and private payloads remain hidden
    Examples:
      | mode       | outcome |
      | normal     | visible |
      | analyst    | visible |
      | foreign    | denied  |
      | no-audit   | denied  |
      | removed    | denied  |
      | suspended  | denied  |
      | free-team  | denied  |
