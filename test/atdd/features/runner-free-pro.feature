@ATDD @US5 @runner-commercial-acceptance
Feature: Existing Runner customers keep basic access

  @SC-005 @ATDD-US5-SC005
  Scenario: An expired Pro grant retains configuration and basic manual broadcasting
    Given an existing Runner customer has saved Scheduled configuration and a Pro grant
    When their Pro grant expires and they reopen the Runner
    Then the saved destination remains available and they can switch to basic Manual control without a purchase

  @SC-005 @ATDD-US5-SC005
  Scenario: A known paid billing deadline takes effect before the billing webhook updates the saved plan
    Given an existing Runner customer has saved Scheduled configuration and a Pro grant
    When their known paid billing deadline passes while the saved plan still says Pro
    Then the saved destination remains available and they can switch to basic Manual control without a purchase
