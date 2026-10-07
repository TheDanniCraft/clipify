@BDD
Feature: Preserve playlist items when AI authority expires while waiting
  @US3 @BDD-EXPIRY-003
  Scenario Outline: Playlist item changes recheck authority after waiting for the playlist
    Given an AI playlist item "<operation>" waits with "<authority>" authority
    When the playlist lock is released after the authority boundary
    Then expired authority preserves playlist items revision and audit while active authority commits the item change
    Examples:
      | operation | authority |
      | remove | token |
      | remove | grant |
      | remove | active |
      | reorder | token |
      | reorder | grant |
      | reorder | active |
      | replace | token |
      | replace | grant |
      | replace | active |
