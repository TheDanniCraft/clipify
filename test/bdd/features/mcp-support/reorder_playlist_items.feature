@BDD
Feature: Reorder approved playlist items

  @US2 @FR-007 @FR-011 @BDD-US2-015
  Scenario: An exact permutation changes playlist order atomically
    Given an approved creator has a playlist with two ordered clips
    When the agent reverses all playlist items using the current revision
    Then the returned and persisted order match with a new revision
