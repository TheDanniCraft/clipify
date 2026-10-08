@BDD @ATDD
Feature: Authorize a custom tool identified by a metadata URL
  @US1 @FR-003 @BDD-CIMD-CONSENT-001
  Scenario: Retain exact URL client identity through consent and authenticated read
    Given the isolated metadata HTTPS service has "complete" behavior
    When the actual provider authorizes using that client metadata document
    Then the URL client completes real consent and reads only its approved creator
