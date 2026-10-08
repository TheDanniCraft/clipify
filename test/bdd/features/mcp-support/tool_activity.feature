@BDD @US4 @FR-016 @BDD-ACTIVITY-001
Feature: Record safe authenticated MCP call activity
  Scenario Outline: The authenticated call records its safe outcome
    Given an authenticated MCP activity call uses <mode>
    When that call completes through the public MCP route
    Then its activity records <outcome> without session or private target data
    Examples:
      | mode                              | outcome |
      | resources:playlist-get            | success |
      | resources:overlay-get:denied       | denied  |
      | resources:overlays:unknown         | denied  |
      | resources:overlay-delete:no-scope  | denied  |
      | resources:overlay-create:rate-limit | denied |
