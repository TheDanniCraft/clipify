@BDD @ATDD @US3 @FR-009 @FR-010 @EC-011 @BDD-QUOTA-COUNT-001
Feature: Current resource count determines Free creation limits

  Scenario Outline: Creation preserves the authoritative count at each limit boundary
    Given an approved Free creator has "<kind>" usage at the "<boundary>" boundary
    When the agent creates that resource and repeats its original retry key
    Then the current Free quota permits only available capacity and preserves count

    Examples:
      | kind     | boundary |
      | overlay  | zero     |
      | overlay  | below    |
      | overlay  | exact    |
      | overlay  | above    |
      | playlist | zero     |
      | playlist | below    |
      | playlist | exact    |
      | playlist | above    |
