@BDD
Feature: Preserve client metadata transport and callback identity
  @US1 @BDD-CIMD-HTTPS-001
  Scenario Outline: Resolve remote metadata through the native pinned TLS transport
    Given the isolated metadata HTTPS service has "<boundary>" behavior
    When the actual provider authorizes using that client metadata document
    Then only valid metadata reaches consent and transport connections are closed without leaking credentials
    Examples:
      | boundary |
      | valid |
      | rebind |
      | mixed-dns |
      | redirect-chain |
      | oversized |
      | oversized-chunked |
      | wrong-identity |
      | wrong-callback |
      | tls-mismatch |
      | redirect-open |
      | non-json-open |
