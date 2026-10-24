@BDD @ATDD @US4 @FR-019 @runner-presentation-browser @runner-standby-boundaries
Feature: Standby image format boundaries

  @BDD-US4-BND025
  Scenario: A png standby file is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby file in "png" format
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND026
  Scenario: A jpeg standby file is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby file in "jpeg" format
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND027
  Scenario: A webp standby file is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby file in "webp" format
    Then the standby image is "accepted" and the saved appearance is consistent

  @BDD-US4-BND028 @BDD-US4-OPT078 @BDD-US4-EC012
  Scenario: A svg standby file is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby file in "svg" format
    Then the standby image is "rejected" and the saved appearance is consistent

  @BDD-US4-BND029
  Scenario: A html standby file is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby file in "html" format
    Then the standby image is "rejected" and the saved appearance is consistent

  @BDD-US4-BND030 @BDD-US4-OPT080 @BDD-US4-EC012
  Scenario: A unreadable standby file is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they upload a standby file in "unreadable" format
    Then the standby image is "rejected" and the saved appearance is consistent
