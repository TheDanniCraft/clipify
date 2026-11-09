@BDD @US1 @FR-001 @FR-005 @FR-025 @SC-001
Feature: Set up a community award show
  @BDD-US1-101
  Scenario: Creator creates an awards draft and edits its roadmap
    Given a creator is ready to organize an award show
    When the creator creates an event named "Babbler Awards"
    Then the award editor preserves its name and shows editable phase dates

  @BDD-US2-102 @US2 @US4 @FR-012 @FR-016 @FR-017 @EC-006 @SC-002
  Scenario: Participant replaces a proposal and votes before the deadline
    Given a creator is ready to organize an award show
    And a published award show is accepting text proposals without review
    When the participant submits the proposal "hahaha die Lampe"
    Then the personal proposals show "hahaha die Lampe"
    When the participant withdraws that proposal
    And the participant submits the proposal "Lampe raucht ab"
    And voting opens for the award show
    And the participant votes for "Lampe raucht ab"
    Then the award vote is persisted
    When voting closes for the award show
    Then the saved choice stays visible without revealing results

  @BDD-US2-103 @US2 @US4 @FR-009 @FR-017 @SC-002
  Scenario: Participant uploads an image to creator-owned Drive and views its nomination
    Given a creator is ready to organize an award show
    And a published award show is accepting images into connected Google Drive
    When the participant uploads a picture named "Lampe.png"
    Then the personal proposals show "Lampe"
    When voting opens for the award show
    Then the nominated image opens as a full preview

  @BDD-US3-104 @US3 @FR-014 @FR-005 @SC-001
  Scenario: Team groups related proposals and releases a held review
    Given a creator is ready to organize an award show
    And the team is reviewing two related text proposals after the planned voting start
    When the team adds a candidate named "Team insider"
    And the team groups those proposals as "Lampe raucht ab"
    And nominates the group and finishes review
    Then viewers see one nominee without its original grouped proposals

  @BDD-US3-105 @US3 @US6 @FR-015 @FR-023 @SC-001
  Scenario: Team records a manual data winner and explicitly publishes the archive
    Given a creator is ready to organize an award show
    And an award show has closed with an unconfirmed watchtime result
    When the team records "Babbler One" with 321 watched hours
    And explicitly publishes the award results
    Then the public archive shows that data winner and its number

  @BDD-US3-106 @US3 @FR-006 @FR-011 @SC-001
  Scenario: Team adds a stored image nominee before voting
    Given a creator is ready to organize an award show
    And a published award show is accepting images into connected Google Drive
    When the team adds an image candidate named "Lampe.png"
    And voting opens for the award show
    Then the team image is available as a public nominee
