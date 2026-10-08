@BDD @ATDD @US3 @FR-014
Feature: Safe resource errors preserve privacy and committed data

  @BDD-US3-040
  Scenario Outline: Missing resources do not reveal private existence or contents
    Given the approved MCP request targets unavailable resource operation "<operation>"
    When the agent requests that unavailable resource
    Then Clipify returns only the safe unavailable resource error

    Examples:
      | operation                |
      | overlay-get:missing      |
      | overlay-get:foreign      |
      | playlist-get:missing     |
      | overlay-update:missing   |
      | playlist-update:missing  |
      | overlay-delete:missing   |
      | playlist-delete:missing  |
      | playlist-add:missing     |
      | playlist-remove:missing  |
      | playlist-reorder:missing |

  @BDD-US3-041
  Scenario: Persistence failure restores all deleted references
    Given a playlist deletion audit cannot persist
    When the agent deletes the playlist with approved authority
    Then Clipify reports a safe service failure and preserves the playlist and its references

  @BDD-US3-042
  Scenario Outline: Provider timeout cannot commit playlist changes
    Given the clip provider stalls during "<phase>" for an approved append
    When the agent adds validated provider clips to the playlist
    Then Clipify reports a safe timeout failure with unchanged playlist items and audit

    Examples:
      | phase   |
      | headers |
      | body    |
