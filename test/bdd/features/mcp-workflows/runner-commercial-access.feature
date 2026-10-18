@BDD @US5 @runner-commercial-native
Feature: Scoped Runner benefits retain their existing lifetime
  @FR-021 @BDD-US5-FR021
  Scenario: A lifetime Runner grant enables Scheduled control without unrelated Pro access
    Given a Free creator with a lifetime Runner grant
    When they request Scheduled Runner control through MCP
    Then their Scheduled control is saved and unrelated Pro controls remain unavailable

  @FR-021 @BDD-US5-OPT068
  Scenario: An active bounded Runner grant retains advanced Runner eligibility
    Given a Free creator with an active bounded Runner grant
    When they request Scheduled Runner control through MCP
    Then their Scheduled control is saved and unrelated Pro controls remain unavailable

  @FR-021 @BDD-US5-OPT069
  Scenario: An expired Runner grant cannot enable Scheduled control
    Given a Free creator with an expired Runner grant
    When they request Scheduled Runner control through MCP
    Then Scheduled control is denied without saving a paid configuration or unrelated Pro access

  @FR-021 @BDD-US5-OPT070
  Scenario: A revoked Runner grant cannot enable Scheduled control
    Given a Free creator with a revoked Runner grant
    When they request Scheduled Runner control through MCP
    Then Scheduled control is denied without saving a paid configuration or unrelated Pro access

  @FR-021 @BDD-US5-OPT071
  Scenario: An active agency Runner allocation retains advanced Runner eligibility
    Given a Free creator with an active agency Runner allocation
    When they request Scheduled Runner control through MCP
    Then their Scheduled control is saved and unrelated Pro controls remain unavailable

  @FR-021 @BDD-US5-OPT072
  Scenario Outline: An ended agency Runner allocation cannot enable Scheduled control (<allocationState>)
    Given a Free creator whose agency Runner allocation is "<allocationState>"
    When they request Scheduled Runner control through MCP
    Then Scheduled control is denied without saving a paid configuration or unrelated Pro access

    Examples:
      | allocationState            |
      | past its end               |
      | ended before its deadline  |
