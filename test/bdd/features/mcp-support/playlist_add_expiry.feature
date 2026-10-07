@BDD
Feature: Reject late AI authority expiry when adding validated clips
  @US3 @BDD-EXPIRY-005
  Scenario Outline: Validated clip addition rechecks authority after waiting for the playlist
    Given AI clip addition uses creator credentials and waits with "<authority>" authority
    When the playlist becomes available after that addition authority boundary
    Then expired authority preserves items revision and audit while active authority appends the validated clip
    Examples:
      | authority |
      | token |
      | grant |
      | active |
