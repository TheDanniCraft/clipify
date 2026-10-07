@BDD
Feature: Preserve atomic creation when AI authority expires during persistence
  @US3 @BDD-EXPIRY-004
  Scenario Outline: Resource creation rechecks authority after waiting for audit persistence
    Given AI "<resource>" creation waits for audit persistence with "<authority>" authority
    When the audit persistence lock is released after the authority boundary
    Then expired authority rolls back the resource retry record and audit while active authority commits them together
    Examples:
      | resource | authority |
      | overlay | token |
      | overlay | grant |
      | overlay | active |
      | playlist | token |
      | playlist | grant |
      | playlist | active |
