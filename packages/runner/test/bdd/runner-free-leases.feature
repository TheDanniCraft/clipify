Feature: Free Runner native signed lease enforcement
  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: A fresh valid signed lease opens a real native broadcast
    Given an assigned execution with a fresh signed Free lease
    When the native controller applies its heartbeat response
    Then it opens encoded output through that admitted generation and closes it at the clip boundary
