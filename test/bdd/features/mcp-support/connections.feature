@BDD
Feature: Revoke a connected app

  @US1 @FR-005 @EC-006 @SC-001 @SC-004 @BDD-US1-020
  Scenario: The user lists connections and revokes the first — two connected clients have separate approved grants
    Given two connected clients have separate approved grants
    When the user lists connections and revokes the first
    Then the first client’s old access and refresh are rejected while the second remains usable
