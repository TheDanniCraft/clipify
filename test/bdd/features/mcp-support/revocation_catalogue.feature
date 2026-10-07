@BDD @ATDD @US1 @FR-005 @EC-006 @BDD-REVOCATION-CATALOGUE-001
Feature: Durable connection revocation and provider cleanup failures

  Scenario: Reject invalid revocations and preserve authority until durable commit
    When real consented connection revocation encounters invalid requests database failure and queued cleanup
    Then denied requests preserve the grant and a failed commit preserves real bearer access
    And completed revocation denies the next public call despite provider cleanup failure
    And retry cleans credentials without restoring access or an inaccurate connection listing
