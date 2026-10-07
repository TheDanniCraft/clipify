@BDD
Feature: Retain privacy cleanup while public AI access is disabled
  @US4 @BDD-PRIVACY-006
  Scenario Outline: Disabling MCP does not abandon stored activity retention
    Given public MCP is disabled with "<schema>" database readiness
    When the background privacy cleanup worker runs
    Then ready schema removes expired MCP activity and legacy schema stays untouched while the endpoint remains disabled
    Examples:
      | schema |
      | ready |
      | legacy |
