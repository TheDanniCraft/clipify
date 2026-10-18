Feature: Free Runner output admission at capture completion
  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: A lease expires while real capture is starting
    Given a fresh signed Free assignment starting real browser capture
    When the monotonic lease deadline is reached before capture returns
    Then no output encoder is opened and closed state is persisted
