@BDD
Feature: Recover from an unresponsive Twitch token service
  @US4 @BDD-DEPENDENCY-002
  Scenario Outline: Provider refresh has a bounded outcome without damaging stored credentials
    Given the isolated Twitch refresh service has "<behavior>" behavior
    When Clipify needs fresh Twitch credentials during an MCP request
    Then the request finishes within the dependency deadline and releases its credential lock with valid stored tokens
    Examples:
      | behavior |
      | headers |
      | body |
      | success |
