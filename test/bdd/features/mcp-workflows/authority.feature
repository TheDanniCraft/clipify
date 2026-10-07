@BDD @US1 @US2 @US3 @US4 @US5 @FR-001 @EC-001 @EC-009
Feature: Current authorization applies to every new workflow family

  @BDD-WORKFLOW-AUTHORITY-001
  Scenario Outline: Expired grants and suspended creators cannot perform mutations
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool | case |
      | control_overlay | expired_grant |
      | control_overlay | suspended_creator |
      | commit_playlist_import | expired_grant |
      | commit_playlist_import | suspended_creator |
      | update_gallery | expired_grant |
      | update_gallery | suspended_creator |
      | update_creator_page | expired_grant |
      | update_creator_page | suspended_creator |
      | control_stream_session | expired_grant |
      | control_stream_session | suspended_creator |
