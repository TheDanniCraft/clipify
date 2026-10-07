@BDD @real-browser @browser-playlist-revision
Feature: Preserve browser changes during MCP playlist edits

  @US2 @FR-017 @EC-021 @BDD-US2-030
  Scenario: MCP refuses its stale playlist edit after a browser rename
    Given a browser and MCP client have read the same owned playlist
    When the browser renames and saves that playlist
    Then the MCP edit with its old revision conflicts and preserves the browser name

  @US2 @FR-017 @EC-021 @BDD-US2-030
  Scenario: The browser gets reload guidance after an MCP playlist rename
    Given a browser and MCP client have read the same owned playlist
    When the MCP client renames that playlist first
    And the browser tries to save its stale playlist name
    Then the browser receives reload guidance and preserves the MCP name
