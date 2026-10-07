@BDD @US2 @FR-007 @FR-017 @BDD-BROWSER-OVERLAY-DELETE-001
Feature: Verified browser overlay deletion shares the backend transaction
 Scenario: A matching browser revision permits deletion
  Given a shared browser playlist mutation is overlay-delete
  When its verified session mutation completes
  Then the browser overlay is deleted with verified session attribution
 Scenario Outline: A stale or unauthorized overlay deletion is refused
  Given a shared browser playlist mutation is overlay-<mode>
  When its verified session mutation completes
  Then the browser overlay deletion is refused
  Examples:
   | mode             |
   | stale            |
   | missing-revision |
   | removed          |
   | suspended        |
