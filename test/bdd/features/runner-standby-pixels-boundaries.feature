@BDD @ATDD @US4 @FR-019 @runner-presentation-browser @runner-standby-boundaries
Feature: Standby image pixels boundaries

  @BDD-US4-BND022
  Scenario: A 3999 by 4000 raster image is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a 3999 by 4000 standby raster image
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND023
  Scenario: A 4000 by 4000 raster image is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a 4000 by 4000 standby raster image
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND024
  Scenario: A 4001 by 4000 raster image is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a 4001 by 4000 standby raster image
    Then the standby image is "rejected" and the saved appearance is consistent
