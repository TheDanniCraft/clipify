@BDD @ATDD @US2 @US3 @FR-008 @SC-004 @FR-009 @FR-012 @EC-013
Feature: Require each operation's approved OAuth permission
  @BDD-MUTATION-SCOPES-001 @BDD-READ-SCOPES-001 @BDD-US3-001
  Scenario Outline: Reject a validly signed token missing the operation's scope
    Given the valid token lacks "<permission>" for "<tool>"
    When the authenticated client attempts the affected operation without its scope
    Then the missing scope is rejected before inputs or resources are processed
    Examples:
      | tool                   | permission            |
      | create_overlay         | overlay:create        |
      | update_overlay_settings         | overlay:update        |
      | delete_overlay         | overlay:delete        |
      | create_playlist        | playlist:create       |
      | update_playlist        | playlist:update       |
      | delete_playlist        | playlist:delete       |
      | add_playlist_items     | playlist-items:manage |
      | remove_playlist_items  | playlist-items:manage |
      | reorder_playlist_items | playlist-items:manage |
      | list_creators          | creator:read          |
      | get_capabilities       | creator:read          |
      | list_overlays          | overlay:read          |
      | get_overlay            | overlay:read          |
      | list_playlists         | playlist:read         |
      | get_playlist           | playlist:read         |
