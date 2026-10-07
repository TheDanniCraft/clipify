@BDD
Feature: Recheck AI authority after queued resource access
  @US3 @BDD-EXPIRY-001
  Scenario Outline: Expired authority cannot commit a queued edit
    Given an AI "<resource>" edit waits for a resource lock with "<authority>" authority
    When the resource lock is released after that authority boundary
    Then expired authority leaves configuration revision and audit unchanged while active authority commits
    Examples:
      | resource | authority |
      | overlay  | token     |
      | overlay  | grant     |
      | playlist | token     |
      | playlist | grant     |
      | overlay  | active    |
      | playlist | active    |
