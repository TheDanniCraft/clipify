@BDD
Feature: Edit an overlay through approved agent access

  @US2 @FR-007 @BDD-US2-006
  Scenario: An agent edits the configuration it just read
    Given an approved creator has an existing private overlay
    When the agent edits that overlay with its current revision
    Then the safe edited configuration has a new revision
