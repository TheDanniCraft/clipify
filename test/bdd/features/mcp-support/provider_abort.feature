@BDD
Feature: Preserve Twitch connection after cancelling AI work
  @US4 @BDD-CANCELLATION-002
  Scenario: Cancellation preserves a serialized provider credential rotation
    Given Twitch refresh is in flight during an MCP request
    When the client cancels that request before Twitch responds
    Then the request is cancelled while Twitch refresh remains serialized and its rotated credentials are stored encrypted
