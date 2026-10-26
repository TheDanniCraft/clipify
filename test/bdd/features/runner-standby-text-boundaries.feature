@BDD @ATDD @US4 @FR-019 @runner-presentation-browser @runner-standby-boundaries
Feature: Standby message boundaries

  @BDD-US4-BND012
  Scenario: A 159-character plain-text message is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they submit a standby message containing 159 characters
    Then the standby message is "accepted" and the saved appearance is consistent

  @BDD-US4-BND013
  Scenario: A 160-character plain-text message is accepted
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they submit a standby message containing 160 characters
    Then the standby message is "accepted" and the saved appearance is consistent

  @BDD-US4-BND014
  Scenario: A 161-character plain-text message is rejected
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And they submit a standby message containing 161 characters
    Then the standby message is "rejected" and the saved appearance is consistent
