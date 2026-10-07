@BDD @US1 @FR-002 @SC-001
Feature: MCP remote workflows

  @BDD-US1-001
  Scenario Outline: Approved agent completes a supported operation
    Given a workflow tool "<tool>" under case "success"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | tool |
      | get_overlay_runtime |
      | get_overlay_queues |
      | control_overlay |
      | enqueue_overlay_clip |
      | clear_overlay_queue |

  @BDD-US1-002 @EC-001 @EC-003
  Scenario Outline: Invalid or unauthorized operations have no useful result
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool | case |
      | get_overlay_runtime | wrong_creator |
      | get_overlay_runtime | invalid_input |
      | get_overlay_runtime | missing_scope |
      | get_overlay_runtime | revoked |
      | get_overlay_queues | wrong_creator |
      | get_overlay_queues | invalid_input |
      | get_overlay_queues | missing_scope |
      | get_overlay_queues | revoked |
      | control_overlay | wrong_creator |
      | control_overlay | invalid_input |
      | control_overlay | missing_scope |
      | control_overlay | revoked |
      | enqueue_overlay_clip | wrong_creator |
      | enqueue_overlay_clip | invalid_input |
      | enqueue_overlay_clip | missing_scope |
      | enqueue_overlay_clip | revoked |
      | clear_overlay_queue | wrong_creator |
      | clear_overlay_queue | invalid_input |
      | clear_overlay_queue | missing_scope |
      | clear_overlay_queue | revoked |

  @BDD-US1-003
  Scenario Outline: All existing playback commands target the selected overlay
    Given a workflow tool "control_overlay" under case "command_<command>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | command |
      | play |
      | pause |
      | skip |
      | hide |
      | show |
      | volume |
      | mute |
      | unmute |
      | toggle_mute |

  @BDD-US1-004 @EC-002
  Scenario Outline: Remote control remains Pro
    Given a workflow tool "<tool>" under case "free"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool |
      | get_overlay_runtime |
      | get_overlay_queues |
      | control_overlay |
      | enqueue_overlay_clip |
      | clear_overlay_queue |
