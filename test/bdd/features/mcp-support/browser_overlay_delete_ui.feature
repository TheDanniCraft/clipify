@BDD @real-browser @browser-playlist-revision @US2 @FR-007 @FR-017 @BDD-BROWSER-OVERLAY-DELETE-002
Feature: Confirm revision-aware overlay deletion from the dashboard
 Scenario: The browser owner deletes the displayed overlay revision
  Given the browser dashboard has read an overlay deletion revision
  When the browser confirms deletion of its cached overlay
  Then the deleted overlay is unavailable through MCP
 Scenario: The browser cannot delete an overlay changed by MCP
  Given the browser dashboard has read an overlay deletion revision
  When the MCP client renames the cached overlay first
  And the browser confirms deletion of its cached overlay
  Then the stale overlay deletion preserves the MCP edit
