@BDD @ATDD @US2 @FR-014 @BDD-OVERLAY-REWARD-OWNERSHIP-001
Feature: Validate a changed reward against its server-derived creator

  Scenario: Commit an owned reward after validation without holding an overlay lock
    When a verified browser reward edit has owned metadata behavior
    Then the owned reward, audit and subscription intent commit together

  Scenario Outline: Reject invalid metadata and changes made during validation
    When a verified browser reward edit has <behavior> metadata behavior
    Then the reward edit leaves no configuration change, audit or subscription intent

    Examples:
      | behavior          |
      | foreign-reward    |
      | wrong-reward      |
      | empty             |
      | not-found         |
      | rate              |
      | provider-error    |
      | malformed         |
      | wrong-content-type|
      | oversized         |
      | plan-change       |
      | membership-change |
      | revision-change   |
      | rollback          |

  @BDD-OVERLAY-REWARD-OWNERSHIP-002
  Scenario Outline: Bound the complete reward-validation operation
    When a verified browser reward edit has <behavior> metadata behavior
    Then stalled reward validation returns without committing within five seconds

    Examples:
      | behavior    |
      | headers     |
      | body        |
      | credentials |
