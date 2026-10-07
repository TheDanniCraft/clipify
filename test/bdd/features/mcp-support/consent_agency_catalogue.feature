@BDD @ATDD
Feature: Consent uses current server-validated agency access
  @US1 @FR-003 @BDD-CONSENT-AGENCY-001
  Scenario: Validate every agency consent boundary and unique creator approval
    Given the consent actor has an agency link to a creator they do not directly own
    When the real provider consent is attempted with valid and invalid agency contexts
    Then only current agency membership and a matching permission ceiling issue creator authority
