@BDD
Feature: Preserve credentials after invalid provider refresh responses
  @US4 @BDD-DEPENDENCY-006
  Scenario Outline: Validate tokens before encrypted persistence
    Given the actual isolated provider returns "<response>" refresh metadata
    When Better Auth refreshes the expired creator credential
    Then only valid refresh metadata may replace stored credentials and coordination is released
    Examples:
      | response |
      | missing-access |
      | blank-access |
      | object-access |
      | bad-expiry |
      | negative-expiry |
      | bad-refresh |
      | oversized |
      | success |
