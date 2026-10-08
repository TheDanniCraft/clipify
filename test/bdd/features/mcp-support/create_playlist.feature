@BDD
Feature: Create a playlist through approved agent access

  @US2 @FR-007 @BDD-US2-010
  Scenario: A Free creator creates one playlist and retries the same request
    Given an approved Free creator has no playlists
    When the agent creates a playlist and retries its request
    Then one safe playlist is created and the retry returns the original result
