@BDD
Feature: Explicit item-management permission

  @US2 @FR-004 @FR-007 @BDD-US2-034
  Scenario Outline: Item management uses its declared scope
    Given a client approved item management without playlist read access
    When the agent performs "<operation>" using its current revision
    Then the item operation succeeds without requiring another scope

    Examples:
      | operation |
      | add       |
      | remove    |
      | reorder   |
