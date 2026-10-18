@BDD @US5 @runner-commercial-native
Feature: Scoped Runner benefits retain their existing lifetime
  @FR-021 @BDD-US5-FR021
  Scenario: A lifetime Pro grant enables Scheduled control through effective Pro
    Given a creator with a lifetime Pro grant
    When they request Scheduled Runner control through MCP
    Then their Scheduled control is saved and effective Pro controls are available

  @FR-021 @BDD-US5-OPT068
  Scenario: An active bounded Pro grant retains advanced Runner eligibility
    Given a creator with an active bounded Pro grant
    When they request Scheduled Runner control through MCP
    Then their Scheduled control is saved and effective Pro controls are available

  @FR-021 @BDD-US5-OPT069
  Scenario: An expired Pro grant cannot enable Scheduled control
    Given a Free creator with an expired Pro grant
    When they request Scheduled Runner control through MCP
    Then Scheduled control is denied without saving a paid configuration or unrelated Pro access

  @FR-021 @BDD-US5-OPT070
  Scenario: A revoked Pro grant cannot enable Scheduled control
    Given a Free creator with a revoked Pro grant
    When they request Scheduled Runner control through MCP
    Then Scheduled control is denied without saving a paid configuration or unrelated Pro access

  @FR-021 @BDD-US5-OPT071
  Scenario: An active agency creator Pro allocation retains advanced Runner eligibility
    Given a creator with an active agency creator Pro allocation
    When they request Scheduled Runner control through MCP
    Then their Scheduled control is saved and effective Pro controls are available

  @FR-021 @BDD-US5-OPT072
  Scenario Outline: An ended agency creator Pro allocation cannot enable Scheduled control (<allocationState>)
    Given a Free creator whose agency creator Pro allocation is "<allocationState>"
    When they request Scheduled Runner control through MCP
    Then Scheduled control is denied without saving a paid configuration or unrelated Pro access

    Examples:
      | allocationState            |
      | past its end               |
      | ended before its deadline  |
