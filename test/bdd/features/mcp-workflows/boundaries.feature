@BDD
Feature: MCP additional workflow boundaries

  @US2 @SC-002 @FR-003 @FR-004 @FR-005 @EC-002 @EC-005 @EC-007 @BDD-US2-005
  Scenario Outline: Import and provider boundaries are explicit
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "<result>" and has a safe projection
    Examples:
      | tool | case | result |
      | search_clips | provider_rate_limit | denied |
      | search_clips | provider_malformed | denied |
      | search_clips | provider_foreign | denied |
      | search_clips | provider_duplicate | denied |
      | search_clips | provider_repeated_cursor | denied |
      | preview_playlist_import | provider_partial | success |
      | preview_playlist_import | quota_full | success |
      | preview_playlist_import | free_filtered | denied |
      | preview_playlist_import | filtered | success |
      | preview_playlist_import | missing_secondary_scope | denied |
      | commit_playlist_import | downgrade_filtered | denied |
      | commit_playlist_import | duplicate_selection | success |
      | commit_playlist_import | unconfirmed | denied |

  @US1 @SC-001 @FR-002 @EC-003 @EC-006 @BDD-US1-005
  Scenario Outline: Remote boundaries preserve volume limits and queue order
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "<result>" and has a safe projection
    Examples:
      | tool | case | result |
      | control_overlay | volume_0 | success |
      | control_overlay | volume_100 | success |
      | control_overlay | volume_-1 | denied |
      | control_overlay | volume_101 | denied |
      | get_overlay_queues | fifo | success |

  @US3 @SC-003 @FR-006 @EC-001 @BDD-US3-006
  Scenario: Gallery publication requires edit authority as well as publication authority
    Given a workflow tool "publish_gallery" under case "missing_secondary_scope"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

  @US5 @SC-005 @FR-009 @FR-010 @FR-011 @EC-001 @EC-003 @EC-008 @BDD-US5-006
  Scenario Outline: Runner setup and snapshots retain their actual state boundaries
    Given a workflow tool "<tool>" under case "<case>"
    When the approved client executes the workflow through MCP
    Then the workflow result is "<result>" and has a safe projection
    Examples:
      | tool | case | result |
      | get_runner_setup | platform_windows | success |
      | get_runner_setup | platform_linux-arm64 | success |
      | get_runner_setup | platform_macos | success |
      | get_runner_setup | platform_macos-arm64 | success |
      | configure_stream_session | missing_secondary_scope | denied |
      | control_stream_session | missing_stream_key | denied |
      | control_stream_session | stop | success |
      | get_runner_snapshot | snapshot_stale_revision | success |
      | get_runner_snapshot | snapshot_expired | success |
