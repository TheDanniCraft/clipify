@BDD @ATDD @US4 @FR-019 @runner-presentation-browser @runner-standby-boundaries
Feature: Standby image file byte boundaries

  @BDD-US4-BND015
  Scenario: A 2097151-byte image file is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby image containing 2097151 file bytes
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND016
  Scenario: A 2097152-byte image file is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby image containing 2097152 file bytes
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND017 @BDD-US4-OPT079 @BDD-US4-EC012
  Scenario: A 2097153-byte image file is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby image containing 2097153 file bytes
    Then the standby image is "rejected" and the saved appearance is consistent
