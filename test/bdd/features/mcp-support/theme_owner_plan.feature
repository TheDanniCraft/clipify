@BDD @ATDD @real-browser @theme-owner-plan @US3 @FR-009 @BDD-THEME-OWNER-PLAN-001
Feature: Theme editor reflects the overlay creator plan
 Scenario: Actor personal Pro cannot unlock a Free creator theme editor
  Given a native Pro browser actor owns access to a separate Free creator overlay
  When that actor opens the Free creator theme editor
  Then the actual theme editor displays its creator Pro feature lock
