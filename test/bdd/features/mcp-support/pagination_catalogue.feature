@BDD @ATDD @US2 @FR-007 @FR-008 @FR-012 @BDD-PAGINATION-CATALOGUE-001
Feature: Read complete resource lists through bounded signed pages

  Scenario Outline: Follow every page without omissions, duplicates or private credentials
    When an authorized MCP client reads all pages of <tool>
    Then the pages preserve stable order, bounded sizes and safe resource metadata

    Examples:
      | tool           |
      | list_creators  |
      | list_overlays  |
      | list_playlists |

  Scenario Outline: Reject untrusted and mismatched cursor contexts
    When an authorized MCP client reads all pages of <tool>
    Then malformed, tampered, expired and other-grant cursors cannot read another page

    Examples:
      | tool           |
      | list_creators  |
      | list_overlays  |
      | list_playlists |
