@BDD
Feature: Clean AI app data after account deletion
  @US4 @BDD-PRIVACY-005
  Scenario Outline: Deleted identities clear orphan AI app history without affecting recovery or unrelated audits
    Given a creator's MCP data has an "<lifecycle>" account lifecycle change
    When the bounded MCP privacy cleanup runs after that change
    Then deleted account MCP records are cleaned while foreign history billing audits and suspended recovery data are preserved
    Examples:
      | lifecycle |
      | actor     |
      | creator   |
      | suspended |
