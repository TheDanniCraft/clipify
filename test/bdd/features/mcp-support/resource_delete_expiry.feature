@BDD
Feature: Recheck AI authority before queued deletion
  @US3 @BDD-EXPIRY-002
  Scenario Outline: Expired authority cannot delete a queued resource
    Given an AI "<resource>" deletion waits for a resource lock with "<authority>" authority
    When the deletion resource lock is released after that authority boundary
    Then expired authority preserves the resource and audit while active explicit delete authority commits
    Examples:
      | resource | authority |
      | overlay  | token     |
      | overlay  | grant     |
      | playlist | token     |
      | playlist | grant     |
      | overlay  | active    |
      | playlist | active    |
