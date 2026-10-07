@BDD
Feature: Rename a playlist through approved agent access

  @US2 @FR-007 @BDD-US2-011
  Scenario: The agent renames a current playlist
    Given an approved creator has an existing playlist
    When the agent renames the playlist with its current revision
    Then the renamed playlist has a new revision
