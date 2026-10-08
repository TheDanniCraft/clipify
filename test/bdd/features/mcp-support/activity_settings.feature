@BDD @US4 @FR-016 @SC-005 @real-browser @browser-playlist-revision
Feature: Inspect connected AI app activity in settings
  @ATDD @BDD-US4-003
  Scenario: The authorized owner inspects successful and denied authenticated activity
    Given a connected AI app has successful and denied playlist activity
    When the creator owner inspects AI app activity in settings
    Then the activity shows safe actor app creator operation time and outcome

  @ATDD @BDD-US4-004
  Scenario: A different creator cannot inspect the owner's AI app activity
    Given a connected AI app has successful and denied playlist activity
    When a different creator inspects AI app activity in settings
    Then the owner's creator and AI app activity are unavailable to that creator
