@BDD @US3 @US4 @US5 @FR-006 @FR-008 @FR-010 @EC-002 @EC-003 @EC-009
Feature: Gallery and Creator Page options retain current product policy

  @BDD-WORKFLOW-OPTIONS-001
  Scenario Outline: Supported configuration options remain explicit
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "<result>" and has a safe projection

    Examples:
      | tool | case | result |
      | update_gallery_settings | paid_fields_pro | success |
      | update_gallery_settings | layout_grid | success |
      | update_gallery_settings | layout_list | success |
      | update_gallery_settings | layout_carousel | success |
      | update_gallery_settings | live_source | success |
      | update_gallery_settings | free_unchanged_style | success |
      | update_gallery_settings | custom_dates | success |
      | update_gallery_settings | clear_custom_dates | success |
      | update_gallery_settings | paid_fields_free | denied |
      | update_gallery_settings | free_stable_sort | denied |
      | update_gallery_settings | free_custom_window | denied |
      | update_gallery_settings | free_custom_start | denied |
      | update_gallery_settings | free_custom_end | denied |
      | update_gallery_settings | free_result_limit | denied |
      | update_gallery_settings | curated_without_playlist | denied |
      | get_gallery_preview | preview_live | success |
      | get_gallery_preview | preview_free | success |
      | get_creator_page | existing_page | success |
      | get_creator_page | free_existing_page | success |
      | update_creator_page | social_edit | success |
      | update_creator_page | free_unchanged_social | success |
      | update_creator_page | clear_social | success |
      | update_creator_page | free_clear_absent | success |
      | update_creator_page | page_bio | success |
      | update_creator_page | free_social_edit | denied |
      | publish_creator_page | publish_on | success |
      | configure_stream_session | success | success |
      | configure_stream_session | new_session | success |
      | configure_stream_session | destination_youtube | success |
      | configure_stream_session | destination_twitch | success |
      | get_stream_session | unassigned | success |
      | get_stream_session | custom_destination | success |
      | get_stream_session | session_error | success |
      | get_runner | runner_metadata | success |
      | control_stream_session | unassigned | denied |
      | control_stream_session | inactive_overlay | denied |
      | control_stream_session | custom_destination | success |
