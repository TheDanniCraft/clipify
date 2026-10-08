@BDD
Feature: Recover provider coordination after lock cleanup fails
  @US4 @BDD-DEPENDENCY-004
  Scenario Outline: Credential coordination stays usable for another connection
    Given provider lock cleanup has "<behavior>" behavior
    When the completed credential operation releases its database lease
    Then an independent database connection can coordinate that provider account and the pool stays healthy
    Examples:
      | behavior |
      | failure |
      | healthy |
