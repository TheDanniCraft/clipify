@BDD @US3 @runner-schedule-control-browser
Feature: Explicit schedule automation control

  @FR-015 @BDD-US3-OPT088
  Scenario: Pausing automation keeps the current broadcast and its original end visible
    Given a Pro creator is authoring a Runner schedule in the browser
    And their scheduled occurrence is inside its original active window
    And that scheduled broadcast currently has a captured running execution
    When they pause schedule automation
    Then automation is paused without changing Scheduled mode or the current broadcast end
