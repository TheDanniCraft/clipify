@BDD
Feature: Create an overlay through approved agent access

  @US2 @FR-007 @BDD-US2-005
  Scenario: A Free creator creates one overlay and retries the same request
    Given an approved Free creator has no overlays
    When the agent creates an overlay and retries its request
    Then one safe overlay is created and the retry returns the original result
