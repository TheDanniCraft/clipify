@BDD
Feature: Delete a playlist through explicit agent permission

  @US2 @FR-007 @FR-018 @BDD-US2-012
  Scenario: Playlist deletion preserves consistent overlay and gallery references
    Given an approved creator has a playlist linked to an overlay and gallery
    When the agent deletes the playlist with its current revision
    Then its items are removed and references are cleared with a new overlay revision
