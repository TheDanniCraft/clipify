@BDD
Feature: Remove approved playlist items

  @US2 @FR-007 @FR-011 @BDD-US2-014
  Scenario: Removing a playlist item preserves safe contiguous order
    Given an approved creator has a playlist with two ordered clips
    When the agent removes its first clip with the current revision
    Then the remaining clip has position zero and the playlist has a new revision
