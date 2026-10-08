@BDD
Feature: Read approved creator overlays

  @US2 @FR-007 @BDD-US2-003
  Scenario: The client lists overlays for an approved creator
    Given an approved creator has an existing private overlay
    When the client lists that creator’s overlays
    Then safe overlay configuration and revisions are returned

  @US2 @FR-012 @EC-013 @BDD-US2-033
  Scenario Outline: Overlay listing rejects malformed tool input safely
    Given a listed-overlay request has "<input>"
    When the client lists that creator’s overlays
    Then the overlay request returns a safe invalid-input result

    Examples:
      | input     |
      | unknown   |
      | bad-limit |
      | bad-id    |
