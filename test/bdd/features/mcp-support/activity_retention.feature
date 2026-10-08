@BDD
Feature: Bound AI app activity retention
  @US4 @BDD-PRIVACY-002
  Scenario Outline: Expired AI app activity is cleaned up without unrelated audit deletion
    Given MCP activity includes expired and current entries with "<mode>" retention cleanup
    When the bounded MCP activity cleanup runs
    Then only the permitted batch of expired MCP activity is removed and unrelated audits remain
    Examples:
      | mode       |
      | normal     |
      | bounded    |
      | concurrent |
      | configured |
