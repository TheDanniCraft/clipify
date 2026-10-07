@BDD @US3 @FR-006 @SC-003
Feature: MCP galleries workflows

  @BDD-US3-001
  Scenario Outline: Approved agent completes a supported operation
    Given a workflow tool "<tool>" under case "success"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | tool |
      | list_galleries |
      | get_gallery |
      | create_gallery |
      | update_gallery |
      | delete_gallery |
      | publish_gallery |
      | get_gallery_embed |
      | get_gallery_preview |
      | get_overlay_embed |

      | get_player_embed |

  @BDD-US3-002 @EC-001 @EC-003
  Scenario Outline: Invalid or unauthorized operations have no useful result
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool | case |
      | list_galleries | wrong_creator |
      | list_galleries | invalid_input |
      | list_galleries | missing_scope |
      | list_galleries | revoked |
      | get_gallery | wrong_creator |
      | get_gallery | invalid_input |
      | get_gallery | missing_scope |
      | get_gallery | revoked |
      | create_gallery | wrong_creator |
      | create_gallery | invalid_input |
      | create_gallery | missing_scope |
      | create_gallery | revoked |
      | update_gallery | wrong_creator |
      | update_gallery | invalid_input |
      | update_gallery | missing_scope |
      | update_gallery | revoked |
      | delete_gallery | wrong_creator |
      | delete_gallery | invalid_input |
      | delete_gallery | missing_scope |
      | delete_gallery | revoked |
      | publish_gallery | wrong_creator |
      | publish_gallery | invalid_input |
      | publish_gallery | missing_scope |
      | publish_gallery | revoked |
      | get_gallery_embed | wrong_creator |
      | get_gallery_embed | invalid_input |
      | get_gallery_embed | missing_scope |
      | get_gallery_embed | revoked |
      | get_gallery_preview | wrong_creator |
      | get_gallery_preview | invalid_input |
      | get_gallery_preview | missing_scope |
      | get_gallery_preview | revoked |
      | get_overlay_embed | wrong_creator |
      | get_overlay_embed | invalid_input |
      | get_overlay_embed | missing_scope |
      | get_overlay_embed | revoked |

  @BDD-US3-003 @EC-002
  Scenario Outline: Free galleries preserve commercial policy
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "<result>" and has a safe projection

    Examples:
      | tool | case | result |
      | create_gallery | free | denied |
      | update_gallery | paid_theme | denied |
      | update_gallery | free_preserve | success |

  @BDD-US3-004 @EC-001 @EC-003
  Scenario Outline: Public player embeds require current authority
    Given a workflow tool "get_player_embed" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | case |
      | wrong_creator |
      | invalid_input |
      | missing_scope |
      | revoked |

  @BDD-US3-005 @FR-007
  Scenario Outline: Public website embeds use supported formats and options
    Given a workflow tool "get_player_embed" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | case |
      | iframe |
      | elements_options |
