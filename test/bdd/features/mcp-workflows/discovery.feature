@BDD @US2 @FR-003 @SC-002
Feature: MCP discovery workflows

  @BDD-US2-001
  Scenario Outline: Approved agent completes a supported operation
    Given a workflow tool "<tool>" under case "success"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | tool |
      | search_clips |
      | resolve_clip |
      | preview_playlist_import |
      | commit_playlist_import |

  @BDD-US2-002 @EC-001 @EC-003
  Scenario Outline: Invalid or unauthorized operations have no useful result
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool | case |
      | search_clips | wrong_creator |
      | search_clips | invalid_input |
      | search_clips | missing_scope |
      | search_clips | revoked |
      | resolve_clip | wrong_creator |
      | resolve_clip | invalid_input |
      | resolve_clip | missing_scope |
      | resolve_clip | revoked |
      | preview_playlist_import | wrong_creator |
      | preview_playlist_import | invalid_input |
      | preview_playlist_import | missing_scope |
      | preview_playlist_import | revoked |
      | commit_playlist_import | wrong_creator |
      | commit_playlist_import | invalid_input |
      | commit_playlist_import | missing_scope |
      | commit_playlist_import | revoked |

  @BDD-US2-003 @EC-005
  Scenario Outline: Preview commits reject changed or tampered intent
    Given a workflow tool "commit_playlist_import" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | case |
      | tampered_preview |
      | stale_revision |

  @BDD-US2-004 @EC-007
  Scenario Outline: Provider failures never create an import
    Given a workflow tool "<tool>" under case "provider_failure"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool |
      | search_clips |
      | resolve_clip |
      | preview_playlist_import |
