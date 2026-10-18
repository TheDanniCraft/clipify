Feature: Runner destination input boundaries

  @BDD @US2 @FR-009 @BDD-US2-FR009 @runner-manual-browser
  Scenario: Deleting a saved destination requires confirmation
    Given a Free creator is configuring a local Runner in the browser
    When they enter a custom destination with a name containing 1 characters
    Then the destination name is "accepted" and saved data agrees
    When they cancel and then confirm deleting that saved destination
    Then the destination is removed from the browser and storage

  @BDD @US2 @FR-009 @runner-manual-browser
  Scenario Outline: Destination names have explicit length boundaries
    Given a Free creator is configuring a local Runner in the browser
    When they enter a custom destination with a name containing <length> characters
    Then the destination name is "<outcome>" and saved data agrees

    @BDD-US2-BND001
    Examples: Empty
      | length | outcome  |
      | 0      | rejected |

    @BDD-US2-BND002
    Examples: Minimum
      | length | outcome  |
      | 1      | accepted |

    @BDD-US2-BND003
    Examples: Maximum
      | length | outcome  |
      | 80     | accepted |

    @BDD-US2-BND004
    Examples: Too long
      | length | outcome  |
      | 81     | rejected |

  @BDD @US2 @FR-009 @BDD-US2-FR009 @runner-manual-browser
  Scenario: Existing broadcasts gain one reusable destination when saved
    Given a Free creator is configuring a local Runner in the browser
    When they choose Live fallback with Manual control and save its destination
    And they reopen a legacy broadcast and save its configuration twice
    Then its converted destination remains visible once after reloading

  @BDD @US3 @FR-011 @BDD-US3-BND005 @runner-schedule-browser
  Scenario: Schedule title length 0 is rejected
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a schedule title with 0 characters
    Then the schedule boundary is "rejected" without changing a previously saved event

  @BDD @US3 @FR-011 @BDD-US3-BND006 @runner-schedule-browser
  Scenario: Schedule title length 1 is accepted
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a schedule title with 1 characters
    Then the schedule boundary is "accepted" without changing a previously saved event

  @BDD @US3 @FR-011 @BDD-US3-BND007 @runner-schedule-browser
  Scenario: Schedule title length 80 is accepted
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a schedule title with 80 characters
    Then the schedule boundary is "accepted" without changing a previously saved event

  @BDD @US3 @FR-011 @BDD-US3-BND008 @runner-schedule-browser
  Scenario: Schedule title length 81 is rejected
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a schedule title with 81 characters
    Then the schedule boundary is "rejected" without changing a previously saved event

  @BDD @US3 @FR-011 @BDD-US3-BND009 @runner-schedule-browser
  Scenario: Schedule duration 0 minutes is rejected
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a UTC schedule lasting 0 minutes
    Then the schedule boundary is "rejected" without changing a previously saved event

  @BDD @US3 @FR-011 @BDD-US3-BND010 @runner-schedule-browser
  Scenario: Schedule duration 1440 minutes is accepted
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a UTC schedule lasting 1440 minutes
    Then the schedule boundary is "accepted" without changing a previously saved event

  @BDD @US3 @FR-011 @BDD-US3-BND011 @runner-schedule-browser
  Scenario: Schedule duration 1441 minutes is accepted
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a UTC schedule lasting 1441 minutes
    Then the schedule boundary is "accepted" without changing a previously saved event
