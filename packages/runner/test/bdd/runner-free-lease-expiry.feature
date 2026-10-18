Feature: Free Runner native lease expiry
  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: Monotonic expiry drains real output and persists closure
    Given a Free broadcast with a valid fresh signed lease and a playing clip
    When monotonic time reaches the final lease deadline without renewal
    Then the current clip finishes without a successor and output closure is persisted before acknowledgment
