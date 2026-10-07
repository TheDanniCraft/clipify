@BDD @real-browser @browser-playlist-revision @US2 @FR-017 @EC-021 @BDD-BROWSER-DELETE-002
Feature: Confirm revision-aware playlist deletion from the real dashboard
  Scenario: The browser owner confirms deletion at the displayed revision
    Given the browser dashboard has read a playlist deletion revision
    When the browser confirms deletion of its cached playlist
    Then the deleted playlist is unavailable through MCP
  Scenario: The browser refuses deletion after an MCP rename
    Given the browser dashboard has read a playlist deletion revision
    When the MCP client renames that playlist first
    And the browser confirms deletion of its cached playlist
    Then the stale browser deletion is blocked and the MCP rename remains
