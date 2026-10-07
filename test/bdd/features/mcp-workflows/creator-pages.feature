@BDD @US4 @FR-008 @SC-004
Feature: MCP creator-pages workflows

  @BDD-US4-001
  Scenario Outline: Approved agent completes a supported operation
    Given a workflow tool "<tool>" under case "success"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | tool |
      | get_creator_page |
      | update_creator_page |
      | publish_creator_page |

  @BDD-US4-002 @EC-001 @EC-003
  Scenario Outline: Invalid or unauthorized operations have no useful result
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool | case |
      | get_creator_page | wrong_creator |
      | get_creator_page | invalid_input |
      | get_creator_page | missing_scope |
      | get_creator_page | revoked |
      | update_creator_page | wrong_creator |
      | update_creator_page | invalid_input |
      | update_creator_page | missing_scope |
      | update_creator_page | revoked |
      | publish_creator_page | wrong_creator |
      | publish_creator_page | invalid_input |
      | publish_creator_page | missing_scope |
      | publish_creator_page | revoked |
