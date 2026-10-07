@BDD @ATDD
Feature: Supported tool results never expose private credentials
  @US2 @FR-012 @SC-002
  @BDD-US2-022
  Scenario: The client reads every supported tool result — a creator has overlays, OAuth connections, and runner credentials
    Given a creator has overlays, OAuth connections, and runner credentials
    When the client reads every supported tool result
    Then no secret or credential appears and excluded operations are unavailable
