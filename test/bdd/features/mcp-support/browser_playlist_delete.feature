@BDD @US2 @FR-017 @EC-021 @BDD-BROWSER-DELETE-001
Feature: Share playlist deletion policy with the verified browser session adapter
  Scenario Outline: Browser deletion preserves current revision and authorization
    Given a browser playlist deletion has <mode> context
    When its verified session adapter deletes the playlist
    Then browser deletion is <outcome> with atomic reference state
    Examples:
      | mode            | outcome |
      | normal          | deleted |
      | stale           | denied  |
      | removed         | denied  |
      | suspended       | denied  |
      | expired-session | denied  |
