@BDD
Feature: List approved creator playlists

  @US2 @FR-007 @BDD-US2-008
  Scenario: The client lists playlists for an approved creator
    Given an approved creator has an existing playlist
    When the client lists that creator’s playlists
    Then safe playlist summaries and revisions are returned
