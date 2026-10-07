@BDD
Feature: Maintain usable tool latency across independent creators
  @US4 @BDD-LOAD-001
  Scenario: Twenty independently scoped creators use an authorized custom app concurrently
    Given twenty independent creators have one authorized custom app
    When their real MCP reads and mutations execute after warmup
    Then p95 reads finish within one second and mutations within two seconds without bypassing policies
