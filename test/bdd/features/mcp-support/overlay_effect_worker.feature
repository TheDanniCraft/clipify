@BDD @ATDD @US2 @FR-014 @BDD-OVERLAY-EFFECT-002
Feature: Retry committed reward intents

  Scenario: Retry a failed provider call without recreating the overlay
    When a pending reward job encounters a provider failure and the next due worker succeeds
    Then provider calls run outside resource locks and durable retry completes the existing job

  @BDD-OVERLAY-EFFECT-003
  Scenario Outline: Compare pending work with the current desired reward
    When pending reward work encounters <change> configuration
    Then provider work has <calls> calls and <status> status

    Examples:
      | change    | calls | status   |
      | cleared   | 0     | obsolete |
      | changed   | 0     | obsolete |
      | name-only | 1     | done     |
      | deleted   | 0     | absent   |

  @BDD-OVERLAY-EFFECT-004
  Scenario Outline: Durable leases coordinate independent workers
    When reward workers encounter <condition> job leases
    Then their exact provider rewards are <rewards>

    Examples:
      | condition       | rewards             |
      | lease-replaced  | RewardOne,RewardTwo |
      | concurrent      | RewardOne           |
      | expired-reclaim | RewardOne           |
      | not-due         | none                |
