@BDD @US2 @FR-007 @BDD-BROWSER-OVERLAY-PATCH-001
Feature: Shared browser configuration preserves existing editor capabilities
 Scenario: Authorized Pro browser can save its selected reward
  Given a shared browser playlist mutation is overlay-save-reward
  When its verified session mutation completes
  Then the browser selected reward is committed
 Scenario: Free editor can save its name with unchanged advanced values
  Given a shared browser playlist mutation is overlay-save-free-snapshot
  When its verified session mutation completes
  Then the browser overlay edit commits at its next revision
