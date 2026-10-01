@auth-engine-rewrite @harness
Feature: Auth rewrite acceptance harness

  Scenario: Deterministic acceptance fixtures are available
    Given the auth rewrite acceptance harness is initialized
    Then its controlled token sequence starts from a known value
