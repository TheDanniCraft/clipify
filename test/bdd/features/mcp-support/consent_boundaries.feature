@BDD @ATDD @US1 @FR-003 @FR-005 @BDD-CONSENT-BOUNDARIES-001
Feature: Authenticated consent and issued grant boundaries

  Scenario: Invalid consent requests cannot create authority
    When consent requests omit or change origin session or signed authorization state
    Then all eight invalid consent requests issue no code and retain no grant

  Scenario: Signed credentials require exact binding and a live grant
    When signed credentials change binding or their stored grant is revoked or expired
    Then all seven invalid credentials are challenged and both valid controls can read
