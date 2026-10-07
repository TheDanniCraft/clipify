@BDD @ATDD @US3 @FR-010 @EC-011 @BDD-QUOTA-INVARIANT-001
Feature: Quota transactions release failed work and isolate unrelated creators

  Scenario: Failed insert releases capacity and its retry reservation
    Given an approved quota transaction will fail during "rollback"
    When the agent exercises that quota transaction through authenticated public interfaces
    Then the failed insert leaves no resource retry or successful audit and its retry succeeds

  Scenario: Concurrent browser delete and MCP create preserve capacity
    Given an approved quota transaction will exercise "delete-create"
    When the agent exercises that quota transaction through authenticated public interfaces
    Then the original overlay is deleted and concurrent creation cannot exceed the allowance

  Scenario: A locked creator does not block an unrelated creator
    Given an approved quota transaction will exercise "isolation"
    When the agent exercises that quota transaction through authenticated public interfaces
    Then the unrelated creator completes while the first creator remains blocked
