@BDD @ATDD @real-browser @overlay-create-failure @US2 @FR-007 @EC-013 @BDD-OVERLAY-CREATE-FAILURE-001
Feature: Dashboard handles an interrupted overlay creation request
 Scenario: Failed server action keeps the existing overlay and permits retry
  Given a native authenticated creator dashboard is ready for overlay creation
  When the overlay creation server request loses its connection
  Then the dashboard reports creation failure and keeps its create button usable
