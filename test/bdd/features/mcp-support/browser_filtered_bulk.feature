@BDD @ATDD @real-browser @filtered-bulk-ui @US2 @FR-007 @FR-017 @BDD-FILTERED-BULK-001
Feature: Dashboard bulk actions preserve filtered-out overlays
 Scenario Outline: Select all applies only to the filtered collection
  Given a native dashboard filters two overlays to the paused overlay
  When the creator applies bulk "<operation>" to the filtered selection
  Then the active overlay outside the filter remains unchanged
  Examples:
   | operation |
   | delete    |
   | status    |
