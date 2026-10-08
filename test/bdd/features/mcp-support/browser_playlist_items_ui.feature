@BDD @real-browser @browser-playlist-revision @US2 @FR-007 @FR-017 @BDD-BROWSER-ITEMS-003
Feature: Browser clip saves preserve MCP revisions
 Scenario: Browser clip removal advances the same parent revision
  Given the browser and MCP have read a populated playlist
  When the browser removes its cached clips and saves
  Then the cleared playlist has its next revision through MCP
 Scenario: Browser clip removal cannot overwrite an MCP rename
  Given the browser and MCP have read a populated playlist
  When the MCP client renames that playlist first
  And the browser removes its cached clips and saves
  Then the stale browser clip save preserves the MCP playlist and its clips
