@BDD @ATDD @US3 @FR-008 @EC-007 @SC-004
Feature: Enforce current authorization at the public MCP boundary

  @BDD-US3-002
  Scenario Outline: The member lacks the current operation permission
    Given the native authority boundary is "<phase>" for "<tool>" in "<catalogue>"
    When the authenticated client reaches the public operation boundary
    Then current backend access is denied without private data or state changes
    Examples:
      | tool | phase | catalogue |
      | get_capabilities | denied-role | read |
      | list_overlays | denied-role | read |
      | get_overlay | denied-role | read |
      | list_playlists | denied-role | read |
      | get_playlist | denied-role | read |
      | create_overlay | denied-role | mutation |
      | update_overlay | denied-role | mutation |
      | delete_overlay | denied-role | mutation |
      | create_playlist | denied-role | mutation |
      | update_playlist | denied-role | mutation |
      | delete_playlist | denied-role | mutation |
      | add_playlist_items | denied-role | mutation |
      | remove_playlist_items | denied-role | mutation |
      | reorder_playlist_items | denied-role | mutation |

  @BDD-US3-003
  Scenario Outline: The resource belongs to a creator outside the approved set
    Given the native authority boundary is "<phase>" for "<tool>" in "<catalogue>"
    When the authenticated client reaches the public operation boundary
    Then current backend access is denied without private data or state changes
    Examples:
      | tool | phase | catalogue |
      | get_capabilities | unapproved-creator | read |
      | list_overlays | unapproved-creator | read |
      | get_overlay | unapproved-creator | read |
      | list_playlists | unapproved-creator | read |
      | get_playlist | unapproved-creator | read |
      | create_overlay | unapproved-creator | mutation |
      | update_overlay | unapproved-creator | mutation |
      | delete_overlay | unapproved-creator | mutation |
      | create_playlist | unapproved-creator | mutation |
      | update_playlist | unapproved-creator | mutation |
      | delete_playlist | unapproved-creator | mutation |
      | add_playlist_items | unapproved-creator | mutation |
      | remove_playlist_items | unapproved-creator | mutation |
      | reorder_playlist_items | unapproved-creator | mutation |

  @BDD-US3-004
  Scenario Outline: The agency role exceeds the creator permission ceiling
    Given the native authority boundary is "<phase>" for "<tool>" in "<catalogue>"
    When the authenticated client reaches the public operation boundary
    Then current backend access is denied without private data or state changes
    Examples:
      | tool | phase | catalogue |
      | list_playlists | agency-ceiling | read |
      | get_playlist | agency-ceiling | read |
      | create_overlay | agency-ceiling-write | read |
      | update_overlay | agency-ceiling-write | read |
      | delete_overlay | agency-ceiling-write | read |
      | create_playlist | agency-ceiling-write | read |
      | update_playlist | agency-ceiling-write | read |
      | delete_playlist | agency-ceiling-write | read |
      | add_playlist_items | agency-ceiling-write | read |
      | remove_playlist_items | agency-ceiling-write | read |
      | reorder_playlist_items | agency-ceiling-write | read |

  @BDD-US3-005
  Scenario Outline: A caller supplied creator selector cannot establish authority
    Given the native authority boundary is "<phase>" for "<tool>" in "<catalogue>"
    When the authenticated client reaches the public operation boundary
    Then current backend access is denied without private data or state changes
    Examples:
      | tool | phase | catalogue |
      | get_capabilities | unapproved-creator | read |
      | list_overlays | unapproved-creator | read |
      | get_overlay | unapproved-creator | read |
      | list_playlists | unapproved-creator | read |
      | get_playlist | unapproved-creator | read |
      | create_overlay | unapproved-creator | mutation |
      | update_overlay | unapproved-creator | mutation |
      | delete_overlay | unapproved-creator | mutation |
      | create_playlist | unapproved-creator | mutation |
      | update_playlist | unapproved-creator | mutation |
      | delete_playlist | unapproved-creator | mutation |
      | add_playlist_items | unapproved-creator | mutation |
      | remove_playlist_items | unapproved-creator | mutation |
      | reorder_playlist_items | unapproved-creator | mutation |
