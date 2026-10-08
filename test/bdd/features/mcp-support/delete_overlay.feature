@BDD
Feature: Delete an overlay through explicit agent permission

  @US2 @FR-007 @FR-018 @BDD-US2-007
  Scenario: An agent deletes a current overlay with explicit delete scope
    Given an approved creator has an existing private overlay
    When the agent deletes the overlay with its current revision
    Then only that overlay is deleted
