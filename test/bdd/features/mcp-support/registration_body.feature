@BDD
Feature: Bound anonymous OAuth client registration input
  @US1 @BDD-REGISTRATION-001
  Scenario Outline: Client registration limits body processing
    Given an anonymous OAuth client sends "<body>" registration input
    When the real authentication provider processes that registration
    Then bounded registration input preserves storage and finishes safely
    Examples:
      | body |
      | oversized-declared |
      | oversized-chunked |
      | deadline |
      | cancel |
      | valid |
