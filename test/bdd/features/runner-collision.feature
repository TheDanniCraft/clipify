Feature: Runner attribution avoids overlay content

  @BDD @US4 @FR-017 @BDD-US4-DEC012 @runner-collision-browser
  Scenario Outline: A <corner> preference avoids visible overlay panels
    Given a Free Runner plays with a <corner> attribution preference
    When its owner opens the Runner appearance settings
    Then the preview and generated attribution avoid the visible overlay panels

    Examples:
      | corner       |
      | bottom-right |
      | top-left     |
      | top-right    |
      | bottom-left  |

  @BDD @US4 @FR-017 @BDD-US4-DEC012 @runner-collision-browser
  Scenario: Attribution returns to its preferred corner after panels fade
    Given a Free Runner plays with a top-left attribution preference
    When its owner opens the Runner appearance settings
    Then the attribution avoids visible panels and returns to top-left after they fade

  @BDD @US4 @FR-017 @BDD-US4-DEC012 @runner-collision-browser
  Scenario: A fully occupied mobile preview reports a configuration error
    Given an admitted branded Runner has a later Pro layout filling its mobile frame
    When its owner opens the Runner appearance settings
    Then the fully occupied preview reports that the overlay layout must be adjusted
    And saving that blocked appearance is refused without changing the profile
    And the known conflict remains blocked when the preview returns to standby

  @BDD @US4 @FR-017 @BDD-US4-DEC012 @runner-collision-browser
  Scenario Outline: Mobile preview keeps the configured <resolution> broadcast canvas
    Given a Free Runner previews a <resolution> broadcast
    When its owner opens the Runner appearance settings
    Then its mobile preview uses the configured broadcast resolution

    Examples:
      | resolution |
      | 720p       |
      | 1080p      |

  @BDD @US4 @FR-017 @BDD-US4-DEC012 @runner-collision-browser @runner-presentation-browser @runner-blocked-startup-browser @requires:native-media
  Scenario: A blocked playing layout prevents native output startup
    Given an admitted branded Runner has a later Pro layout filling its mobile frame
    When its native Runner attempts to start the blocked generated layout
    Then no encoder or destination opens and the Runner returns a normal layout refusal
