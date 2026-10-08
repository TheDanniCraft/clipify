@BDD
Feature: Connect through the actual consent page

  @US1 @FR-003 @BDD-US1-025 @real-browser
  Scenario: Signed provider state reaches a usable consent page
    Given a real browser has an authenticated creator and registered MCP client
    When the browser approves the provider’s signed consent request
    Then the client exchanges the code and reads its approved overlay
