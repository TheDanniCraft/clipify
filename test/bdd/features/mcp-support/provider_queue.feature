@BDD
Feature: Bounded provider credential admission
  @US4 @BDD-DEPENDENCY-005
  Scenario: Timed-out waiting credential work is removed from admission
    Given two native provider credential coordinators occupy available admission
    When a third credential operation waits beyond its dependency deadline
    Then its callback never executes and subsequent credential work can acquire released capacity
