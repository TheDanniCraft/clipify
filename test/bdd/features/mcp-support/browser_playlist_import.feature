@BDD @US2 @FR-011 @BDD-BROWSER-IMPORT-001
Feature: Auto import checks the current Pro entitlement at commit
 Scenario: A current Pro import is audited as a browser import
  Given a shared browser playlist mutation is items-import
  When its verified session mutation completes
  Then the Pro import is committed with its browser audit
 Scenario: An import stops after a downgrade during clip validation
  Given a shared browser playlist mutation is items-import-downgrade
  When its verified session mutation completes
  Then the browser clip edit is not committed
