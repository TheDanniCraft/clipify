@BDD
Feature: Validate selected creators for offline-only consent

  @US1 @FR-003 @FR-004 @BDD-US1-026
  Scenario Outline: Offline access does not skip creator authority
    Given offline-only consent selects an "<creator>" creator
    When the signed-in actor approves that offline connection
    Then consent returns status <status> with <grants> active grants

    Examples:
      | creator | status | grants |
      | owned   | 200    | 1      |
      | foreign | 403    | 0      |
