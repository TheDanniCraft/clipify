@BDD @ATDD @US4 @FR-019 @runner-presentation-browser @runner-standby-boundaries
Feature: Standby image dimensions boundaries

  @BDD-US4-BND018
  Scenario: A 4096 by 1 raster image is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a 4096 by 1 standby raster image
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND019
  Scenario: A 4097 by 1 raster image is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a 4097 by 1 standby raster image
    Then the standby image is "rejected" and the saved appearance is consistent

  @BDD-US4-BND020
  Scenario: A 1 by 4096 raster image is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a 1 by 4096 standby raster image
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND021
  Scenario: A 1 by 4097 raster image is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a 1 by 4097 standby raster image
    Then the standby image is "rejected" and the saved appearance is consistent
