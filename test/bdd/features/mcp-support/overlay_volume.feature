@BDD @US2 @FR-007 @FR-017 @BDD-OVERLAY-VOLUME-001
Feature: Browser and trusted chat volume changes keep configuration revisions current
 Scenario Outline: Current Pro volume commands update configuration atomically
  Given a shared browser playlist mutation is volume-<kind>-pro
  When its verified session mutation completes
  Then all overlay volumes and revisions are committed
  Examples:
   | kind    |
   | session |
   | chat    |
 Scenario Outline: Current policy or revision exhaustion refuses the whole volume command
  Given a shared browser playlist mutation is volume-<mode>
  When its verified session mutation completes
  Then no overlay volume or revision change is committed
  Examples:
   | mode              |
   | session-free      |
   | chat-free         |
   | session-removed   |
   | chat-suspended    |
   | session-overflow  |
