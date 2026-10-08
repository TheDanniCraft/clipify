@BDD @US5 @FR-010 @SC-005
Feature: MCP runners workflows

  @BDD-US5-001
  Scenario Outline: Approved agent completes a supported operation
    Given a workflow tool "<tool>" under case "success"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | tool |
      | get_runner_setup |
      | list_runners |
      | get_runner |
      | create_runner |
      | update_runner |
      | delete_runner |
      | unlink_runner |
      | list_stream_sessions |
      | get_stream_session |
      | configure_stream_session |
      | control_stream_session |
      | get_runner_snapshot |

  @BDD-US5-002 @EC-001 @EC-003
  Scenario Outline: Invalid or unauthorized operations have no useful result
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool | case |
      | get_runner_setup | wrong_creator |
      | get_runner_setup | invalid_input |
      | get_runner_setup | missing_scope |
      | get_runner_setup | revoked |
      | list_runners | wrong_creator |
      | list_runners | invalid_input |
      | list_runners | missing_scope |
      | list_runners | revoked |
      | get_runner | wrong_creator |
      | get_runner | invalid_input |
      | get_runner | missing_scope |
      | get_runner | revoked |
      | create_runner | wrong_creator |
      | create_runner | invalid_input |
      | create_runner | missing_scope |
      | create_runner | revoked |
      | update_runner | wrong_creator |
      | update_runner | invalid_input |
      | update_runner | missing_scope |
      | update_runner | revoked |
      | delete_runner | wrong_creator |
      | delete_runner | invalid_input |
      | delete_runner | missing_scope |
      | delete_runner | revoked |
      | unlink_runner | wrong_creator |
      | unlink_runner | invalid_input |
      | unlink_runner | missing_scope |
      | unlink_runner | revoked |
      | list_stream_sessions | wrong_creator |
      | list_stream_sessions | invalid_input |
      | list_stream_sessions | missing_scope |
      | list_stream_sessions | revoked |
      | get_stream_session | wrong_creator |
      | get_stream_session | invalid_input |
      | get_stream_session | missing_scope |
      | get_stream_session | revoked |
      | configure_stream_session | wrong_creator |
      | configure_stream_session | invalid_input |
      | configure_stream_session | missing_scope |
      | configure_stream_session | revoked |
      | control_stream_session | wrong_creator |
      | control_stream_session | invalid_input |
      | control_stream_session | missing_scope |
      | control_stream_session | revoked |
      | get_runner_snapshot | wrong_creator |
      | get_runner_snapshot | invalid_input |
      | get_runner_snapshot | missing_scope |
      | get_runner_snapshot | revoked |

  @BDD-US5-003 @EC-002
  Scenario Outline: Setup and streaming require separate Runner access
    Given a workflow tool "<tool>" under case "no_runner_access"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool |
      | get_runner_setup |
      | create_runner |
      | configure_stream_session |
      | control_stream_session |

  @BDD-US5-004 @EC-002
  Scenario Outline: Existing runner records remain readable and removable after access expires
    Given a workflow tool "<tool>" under case "no_runner_access"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | tool |
      | list_runners |
      | get_runner |
      | delete_runner |
      | unlink_runner |
      | list_stream_sessions |
      | get_stream_session |

  @BDD-US5-005 @FR-011 @EC-008
  Scenario Outline: Unavailable runner frames are explicit and contain no image
    Given a workflow tool "get_runner_snapshot" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | case |
      | no_snapshot |
      | runner_offline |
      | foreign_assignment |
