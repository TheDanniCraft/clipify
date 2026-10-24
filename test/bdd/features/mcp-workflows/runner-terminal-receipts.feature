Feature: Runner terminal receipt confirmation
  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: Exact terminal confirmations survive a lost response
    Given an authenticated Free Runner creator
    When the device retries its closed-output receipt and a wrong-generation receipt
    Then only the exact terminal generation is explicitly confirmed without replay mutation
