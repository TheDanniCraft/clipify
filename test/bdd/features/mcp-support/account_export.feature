@BDD
Feature: Export personal AI app approvals
  @US4 @BDD-PRIVACY-001
  Scenario Outline: A private account export includes the user's AI app approval history
    Given an account has an AI app approval that is "<state>"
    When the account's comprehensive private export is collected
    Then it includes that app's approved scopes and creators without another user's approval or app credentials
    Examples:
      | state   |
      | active  |
      | revoked |
