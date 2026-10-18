Feature: Runner manual stop command propagation

  @BDD @US1 @FR-004 @BDD-US1-FR004
  Scenario: Explicit emergency stop retains occupancy until output closure
    Given an authenticated Free Runner creator
    When they request Stop now for their active broadcast generation
    Then immediate stop intent is accepted without claiming the output is already closed

  @BDD @US1 @FR-004 @BDD-US1-FR004
  Scenario: A delayed stopped snapshot cannot target a replacement active generation
    Given an authenticated Free Runner creator
    When a newer generation starts between the heartbeat session snapshot and command lookup
    Then no stop command targets that replacement generation and it remains running
