@BDD @ATDD @US1 @FR-001 @FR-003 @FR-005 @FR-007 @BDD-CUSTOM-SDK-001
Feature: Use an independently implemented official SDK client

  Scenario Outline: Complete native auth and enforce current policy over actual HTTP
    When the independent SDK uses <mode> transport against the isolated HTTP service
    Then native discovery and OAuth lead to permitted reads and edits within Free limits
    And denial adds no grant and revocation rejects old SDK and refresh access

    Examples:
      | mode   |
      | legacy |
      | auto   |
