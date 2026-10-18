Feature: Runner signed execution configuration binding
  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: Signed execution binds the actual credential and generated source
    Given an authenticated Free Runner creator
    When the assigned device requests a credential-bound lease for its source
    Then the verified lease binds the actual destination credential digest and source without exposing the key
