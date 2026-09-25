@BDD @infrastructure @smoke
Feature: Public login availability
  As a visitor
  I want to reach Clipify's public login entry point
  So that I can begin authentication from the running application

  @BDD-SMOKE-001
  Scenario: The Twitch login entry point is available
    Given the Clipify application is running
    When I open the public login page
    Then I can start Twitch login
