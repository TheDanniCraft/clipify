@BDD
Feature: Authenticate each MCP request

  @US1
  @BDD-US1-013
  Scenario: It calls a tool — the client presents missing access
    Given the client presents missing access
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1
  @BDD-US1-014
  Scenario: It calls a tool — the client presents expired access
    Given the client presents expired access
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1
  @BDD-US1-015
  Scenario: It calls a tool — the client presents an invalid signature
    Given the client presents an invalid signature
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1
  @BDD-US1-016
  Scenario: It calls a tool — the client presents an incorrect issuer
    Given the client presents an incorrect issuer
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1
  @BDD-US1-017
  Scenario: It calls a tool — the client presents an audience for another service
    Given the client presents an audience for another service
    When it calls a tool
    Then the call is rejected without reading or changing creator data
