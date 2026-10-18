Feature: Free Runner end-to-end acceptance

  @ATDD @US1 @SC-001 @ATDD-US1-SC001
  Scenario: A Free creator registers two devices and completes one admitted manual broadcast
    Given a creator uses Free without a paid Runner benefit
    When they register two devices and complete the manual Runner protocol journey
    Then both devices are available but only one concurrent broadcast is admitted and its shutdown is confirmed

  @ATDD @US1 @FR-023 @SC-006 @ATDD-US1-SC006
  Scenario: Extended Free streaming retains its live lease and rejects another start for concurrency
    Given a Free broadcast has a long-running history across a calendar month
    When they register two devices and complete the manual Runner protocol journey
    Then the additional start is denied for concurrency while streaming time remains unlimited
