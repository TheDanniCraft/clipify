@BDD @ATDD @US2 @FR-014 @BDD-OVERLAY-EFFECT-005
Feature: Deliver reward subscription intent through provider HTTP

  Scenario Outline: Preserve the exact provider contract and report failures for retry
    When reward provider HTTP returns <response>
    Then the subscription adapter succeeds only for accepted or existing subscriptions

    Examples:
      | response      |
      | accepted      |
      | exists        |
      | rate          |
      | denied        |
      | app-auth      |
      | invalid-json  |
      | missing-token |

  @BDD-OVERLAY-EFFECT-006
  Scenario Outline: Bound stalled provider stages by one complete deadline
    When reward provider HTTP stalls at <stage>
    Then the stalled reward request fails within ten seconds without subscription success

    Examples:
      | stage                |
      | token-headers        |
      | token-body           |
      | subscription-headers |

  @BDD-OVERLAY-EFFECT-010
  Scenario Outline: Validate configuration and token responses before subscription
    When reward provider HTTP returns <response>
    Then reward configuration and token validation preserve the expected request boundary

    Examples:
      | response        |
      | preview         |
      | missing-client  |
      | missing-secret  |
      | missing-webhook |
      | missing-callback|
      | bad-callback    |
      | bad-webhook     |
      | token-array     |
      | oversized-token |
      | bad-token       |
      | bad-token-type  |
      | bad-expiry      |
