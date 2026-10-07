@BDD @ATDD @US1 @FR-003 @BDD-CONSENT-NATIVE-QUERY-001
Feature: Verify authorization queries before displaying consent

  Scenario: An untrusted signature cannot reach consent or login
    When an unsigned app supplies a forged OAuth consent signature
    Then Clipify shows an invalid authorization request before login or consent
