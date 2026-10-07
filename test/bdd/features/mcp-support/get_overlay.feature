@BDD
Feature: Read an approved creator overlay

  @US2 @FR-007 @BDD-US2-004
  Scenario: The client reads an overlay through approved creator access
    Given an approved creator has an existing private overlay
    When the client reads that creator’s overlay
    Then the overlay’s safe configuration and revision are returned
