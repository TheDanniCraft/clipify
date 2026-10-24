Feature: Runner attribution placement

  @BDD @US4 @FR-017 @BDD-US4-FR017 @BDD-US4-OPT050 @runner-branding-browser
  Scenario: A Free owner saves a preferred top-left attribution position
    Given a Free Runner has an active broadcast without playable clips
    When its owner opens the Runner appearance settings
    Then choosing top-left persists and the preview and generated presentation use that corner

  @BDD @US4 @FR-017 @BDD-US4-OPT051 @runner-branding-browser
  Scenario: A Free owner saves a preferred top-right attribution position
    Given a Free Runner has an active broadcast without playable clips
    When its owner opens the Runner appearance settings
    Then choosing top-right persists and the preview and generated presentation use that corner

  @BDD @US4 @FR-017 @BDD-US4-OPT052 @runner-branding-browser
  Scenario: A Free owner saves a preferred bottom-left attribution position
    Given a Free Runner has an active broadcast without playable clips
    When its owner opens the Runner appearance settings
    Then choosing bottom-left persists and the preview and generated presentation use that corner

  @BDD @US4 @FR-017 @BDD-US4-OPT053 @runner-branding-browser
  Scenario: A Free owner saves a preferred bottom-right attribution position
    Given a Free Runner has an active broadcast without playable clips
    When its owner opens the Runner appearance settings
    Then choosing bottom-right persists and the preview and generated presentation use that corner
