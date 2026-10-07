@BDD @real-browser @browser-playlist-revision @US2 @FR-007 @FR-017 @BDD-BROWSER-OVERLAY-SAVE-003
Feature: Overlay style editor uses the same revision as AI configuration
 Scenario: Browser style edit advances the shared revision
  Given the browser style editor has read its configuration
  When the browser saves a new overlay text color
  Then MCP observes the browser style at the next revision
 Scenario: Stale browser style edit cannot overwrite an MCP configuration change
  Given the browser style editor has read its configuration
  When the MCP client renames the cached overlay first
  And the browser saves a new overlay text color
  Then the stale overlay save preserves the MCP edit
 Scenario: Chosen overlay colors remain exact in the recent palette
  Given the browser style editor has read its configuration
  When the browser commits the exact overlay text color ABCDEF
  Then the recent theme palette preserves its exact RGB channels
