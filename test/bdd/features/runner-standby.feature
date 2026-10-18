@BDD @US1 @runner-manual-browser
Feature: Runner standby customization

  @US4 @FR-019 @BDD-US4-OPT081 @runner-presentation-browser @runner-custom-standby-browser
  Scenario: An image upload storage failure preserves the saved standby screen
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    When its owner opens the Runner appearance settings
    And image storage fails while they upload a new standby image
    Then the standby image is "rejected" and the saved appearance is consistent

  @US4 @FR-019 @BDD-US4-FR019 @runner-presentation-browser @runner-custom-standby-browser
  Scenario: An active Pro broadcast with no playable clips shows its saved standby
    Given a Pro Runner has an active broadcast with playable clips
    And its saved custom standby has an existing image and message
    And its playlist has no playable clips
    Then its active presentation shows the configured empty-playlist standby

  @US4 @FR-019 @BDD-US4-OPT059 @runner-presentation-browser @runner-custom-standby-browser
  Scenario: A Pro owner previews and saves a standby background color
    Given a Pro Runner has an active broadcast with playable clips
    When its owner opens the Runner appearance settings
    Then their standby background color matches draft preview and saved generated standby

  @US4 @FR-019 @BDD-US4-OPT060 @runner-presentation-browser @runner-custom-standby-browser
  Scenario: A Pro owner previews and saves a standby background image
    Given a Pro Runner has an active broadcast with playable clips
    When its owner opens the Runner appearance settings
    Then their uploaded background image matches preview and saved generated standby

  @US4 @FR-019 @BDD-US4-OPT061 @runner-presentation-browser @runner-custom-standby-browser
  Scenario: A Pro owner previews and saves a standby logo
    Given a Pro Runner has an active broadcast with playable clips
    When its owner opens the Runner appearance settings
    Then their uploaded logo matches preview and saved generated standby

  @US4 @FR-019 @BDD-US4-OPT062 @runner-presentation-browser @runner-custom-standby-browser
  Scenario: A Pro owner previews and saves a plain-text standby message
    Given a Pro Runner has an active broadcast with playable clips
    When its owner opens the Runner appearance settings
    Then their standby message matches draft preview and the already active presentation

  @US4 @FR-019 @BDD-US4-OPT063 @runner-presentation-browser @runner-custom-standby-browser
  Scenario: A Pro owner previews the next broadcast in its saved timezone
    Given a Pro Runner has an active broadcast with playable clips
    And its schedule includes a future Berlin broadcast beyond the current cache horizon
    When its owner opens the Runner appearance settings
    Then the optional next broadcast time matches preview and generated standby
