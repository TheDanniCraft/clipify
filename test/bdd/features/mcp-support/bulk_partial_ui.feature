@BDD @bulk-partial-ui
Feature: Retain committed dashboard bulk results
  @US2 @BDD-BULK-UI-001
  Scenario Outline: One stale row does not hide another row's committed change
    Given an authenticated dashboard has two overlays and one becomes stale
    When the creator performs bulk "<operation>" on both overlays
    Then the successful "<operation>" result is visible and the stale row remains
    Examples:
      | operation |
      | status |
      | delete |
