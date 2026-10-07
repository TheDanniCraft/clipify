@BDD @ATDD @US1 @FR-003 @FR-006 @FR-008 @FR-011
Feature: Creator approval remains explicit while membership changes

  @BDD-US1-022 @BDD-US1-023
  Scenario: Approve A and B, acquire C without extending access, then remove B membership
    Given an authenticated owner has approved one creator for a real OAuth client
    When another creator is owned and a new consent approves both creators
    Then creator calls require explicit approval and current membership
