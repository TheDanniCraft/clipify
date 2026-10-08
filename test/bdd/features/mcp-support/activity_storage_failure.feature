@BDD @ATDD @US4 @FR-016 @BDD-ACTIVITY-STORAGE-001
Feature: Fail closed when required MCP activity cannot be persisted

  Scenario Outline: Audit storage failure prevents a successful or private result
    Given required MCP audit storage fails for "<mode>"
    When the authenticated request reaches the actual MCP route
    Then it reports a safe service error without data or an unrecorded successful operation

    Examples:
      | mode                         |
      | resources:creators           |
      | resources:capabilities       |
      | resources:overlays           |
      | resources:overlay-get        |
      | resources:playlists          |
      | resources:playlist-get       |
      | resources:overlay-get:denied |
      | resources:overlays:unknown   |
