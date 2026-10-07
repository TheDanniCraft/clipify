@BDD @ATDD @US2 @FR-014 @BDD-OVERLAY-EFFECT-001
Feature: Reward edits retain durable provider intent

  Scenario: A committed reward edit retains its pending provider intent
    When a verified Pro owner saves a reward through the shared overlay backend
    Then its committed revision has a durable pending subscription job

  Scenario: Stale reward edits cannot schedule provider work
    When a verified Pro owner saves a reward using a stale overlay revision
    Then neither reward configuration nor a subscription job is committed

  @BDD-OVERLAY-EFFECT-007
  Scenario: Public save leaves subscription delivery to the durable worker
    When the public save action commits a verified Pro reward selection
    Then exactly one durable reward job exists without an immediate provider call
