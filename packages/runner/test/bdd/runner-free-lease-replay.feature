@BDD @US1 @EC-002 @BDD-US1-DEC003
Feature: Offline Free execution replay
  Scenario: A restarted device cannot reopen saved output with an old lease
    Given a valid leased native broadcast has produced real encoded output
    When its saved lease and execution journal are replayed in a fresh offline process with its wall clock rolled back
    Then the saved lease, changed generation and terminal generation cannot open any new output
