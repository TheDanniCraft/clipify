@BDD @US2 @FR-007 @FR-017 @BDD-OVERLAY-VOLUME-002
Feature: Public and trusted chat volume entry points use current backend policy
 Scenario Outline: A volume entry point updates shared revisions
  Given a shared browser playlist mutation is volume-public-<kind>
  When its verified session mutation completes
  Then all overlay volumes and revisions are committed
  Examples:
   | kind       |
   | session    |
   | controller |
   | chat       |
 Scenario Outline: A cached or direct entry cannot bypass current Pro entitlement
  Given a shared browser playlist mutation is volume-public-<kind>
  When its verified session mutation completes
  Then no overlay volume or revision change is committed
  Examples:
   | kind           |
   | session-free   |
   | chat-downgrade |
