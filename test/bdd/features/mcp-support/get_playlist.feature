@BDD
Feature: Read an approved creator playlist

  @US2 @FR-007 @BDD-US2-009
  Scenario Outline: The client reads playlist configuration and ordered clips
    Given an approved creator has an existing playlist
    And the playlist read occurs <concurrency>
    When the client reads that creator’s playlist
    Then safe playlist metadata and ordered items are returned

    Examples:
      | concurrency |
      | without another writer |
      | during an atomic configuration update |
