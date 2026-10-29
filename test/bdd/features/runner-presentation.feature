@BDD @US4 @runner-presentation-browser
Feature: Runner-generated presentation

  @FR-016 @BDD-US4-OPT056
  Scenario: Free generated standby retains Clipify attribution
    Given a Free Runner has an active broadcast without playable clips
    When the Runner requests its generated presentation
    Then its generated standby visibly credits Clipify

  @FR-016 @BDD-US4-OPT058
  Scenario: Ordinary overlay remains free of Runner attribution
    Given a Free Runner has an active broadcast without playable clips
    When the owner opens the ordinary overlay source
    Then the ordinary overlay contains its player without Runner attribution

  @FR-016 @BDD-US4-OPT054
  Scenario: Free generated clip playback retains Clipify attribution
    Given a Free Runner has an active broadcast with playable clips
    When the Runner starts generated clip playback
    Then its playing clip visibly retains Clipify attribution

  @FR-016 @BDD-US4-FR016 @BDD-US4-OPT055 @BDD-US4-OPT057 @requires:native-media
  Scenario: Live forwarding bypasses attribution across generated fallback and return
    Given a Free Runner has an active live-fallback broadcast with playable clips
    When its live input disconnects and then returns through the native Runner
    Then only the generated fallback is branded in the encoded output
