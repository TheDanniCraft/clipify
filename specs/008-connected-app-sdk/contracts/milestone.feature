@BDD @ATDD @US1 @US2 @US3
Feature: Independent Awards connection
  @BDD-US1-001 @FR-001 @FR-002 @SC-001
  Scenario: Administrator provisions an application without a creator session
    Given a verified platform administrator and an active creator
    When the administrator provisions the clip-search application
    Then machine credentials identify the application and select only that creator
  @BDD-US2-001 @FR-003 @FR-004 @FR-005 @SC-002
  Scenario: SDK searches only permitted cached clips
    Given an independently authenticated Awards application
    When its SDK searches the selected creator by title
    Then only matching clips and honest cache completeness are returned
    And foreign creators and revoked grants are denied
  @BDD-US3-001 @FR-006 @FR-007 @FR-008 @SC-003
  Scenario: Private independent Docker deployments
    Given Clipify and Awards run in separate disposable Compose projects
    When the Awards container checks its own database and searches through its SDK
    Then neither PostgreSQL has a published host port
    And the Awards network cannot connect to the Clipify database
    And the existing show is unchanged
