@BDD
Feature: Reject malformed access credentials at the public MCP endpoint
  @US1 @BDD-TOKEN-CATALOGUE-001
  Scenario: Evaluate the complete access token boundary catalogue
    Given a real provider issued a consented creator access token
    When every explicit malformed header and signed claim case reaches the public MCP route
    Then all listed invalid credentials receive an OAuth challenge and both supported bearer controls can read
      | case |
      | empty-header |
      | basic-header |
      | empty-bearer |
      | extra-token |
      | multiple-token |
      | malformed-compact |
      | missing-sub |
      | object-sub |
      | missing-client |
      | object-client |
      | wrong-client |
      | invalid-grant |
      | unknown-grant |
      | zero-generation |
      | string-generation |
      | array-scope |
      | missing-scope |
      | string-expiry |
      | null-expiry |
      | missing-expiry |
      | object-issued-at |
      | numeric-audience |
      | missing-audience |
      | object-issuer |
      | missing-issuer |
      | future-not-before |
      | expiry-boundary |
      | valid |
      | lowercase-bearer |
