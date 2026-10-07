@BDD @US1 @US2 @US3 @US5 @FR-001 @EC-006 @EC-009
Feature: Approved creator scopes cannot access foreign-owned workflow resources

  @BDD-WORKFLOW-OWNERSHIP-001
  Scenario Outline: Existing foreign-owned resource IDs remain unusable
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool | case |
      | get_overlay_runtime | foreign_owned |
      | get_overlay_queues | foreign_owned |
      | control_overlay | foreign_owned |
      | enqueue_overlay_clip | foreign_owned |
      | clear_overlay_queue | foreign_owned |
      | preview_playlist_import | foreign_owned |
      | commit_playlist_import | foreign_owned |
      | get_gallery | foreign_owned |
      | update_gallery | foreign_owned |
      | delete_gallery | foreign_owned |
      | publish_gallery | foreign_owned |
      | get_gallery_embed | foreign_owned |
      | get_gallery_preview | foreign_owned |
      | get_overlay_embed | foreign_owned |
      | get_player_embed | foreign_owned |
      | get_runner | foreign_owned |
      | update_runner | foreign_owned |
      | delete_runner | foreign_owned |
      | unlink_runner | foreign_owned |
      | get_stream_session | foreign_owned |
      | configure_stream_session | foreign_owned |
      | control_stream_session | foreign_owned |
      | get_runner_snapshot | foreign_owned |
      | configure_stream_session | foreign_runner_assignment |
      | configure_stream_session | foreign_overlay_assignment |
      | control_stream_session | foreign_runner_assignment |
      | control_stream_session | foreign_overlay_assignment |
