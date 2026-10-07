@BDD @real-browser @browser-playlist-revision @US2 @FR-007 @FR-017 @BDD-BROWSER-OVERLAY-SAVE-002
Feature: Dashboard overlay settings respect revisions shared with AI apps
 Scenario: Browser settings advance the revision visible to MCP
  Given the browser overlay editor has read its configuration
  When the browser saves a new overlay name
  Then MCP observes the browser overlay name at the next revision
 Scenario: A stale browser save cannot replace an MCP edit
  Given the browser overlay editor has read its configuration
  When the MCP client renames the cached overlay first
  And the browser saves a new overlay name
  Then the stale overlay save preserves the MCP edit
