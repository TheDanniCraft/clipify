@BDD @US4 @FR-016 @BDD-BROWSER-AUDIT-001
Feature: Keep browser session mutations distinct from AI app activity
  Scenario Outline: Shared browser mutation preserves its real authentication kind
    Given a shared browser playlist mutation is <mode>
    When its verified session mutation completes
    Then its audit is <action> for the verified browser session
    Examples:
      | mode   | action          |
      | normal | playlist.delete |
      | rename | playlist.update |
