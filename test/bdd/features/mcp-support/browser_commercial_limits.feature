@BDD @ATDD @US3 @FR-009
Feature: Browser actions use current shared commercial resource policy

  @BDD-US3-007 @EC-009
  Scenario Outline: Free browser paid setting changes preserve saved data
    Given the browser commercial operation is "paid-<setting>"
    When the verified browser session executes its commercial operation
    Then the browser update is denied and retained saved data is unchanged
    Examples:
      | setting |
      | volume  |
      | filter  |
      | styling |

  @BDD-US3-008
  Scenario: Browser creation honors creator subscription over actor Free
    Given the browser commercial operation is "create-subscription"
    When the verified browser session executes its commercial operation
    Then the browser creates a second overlay while actor personal plan remains Free

  @BDD-US3-009
  Scenario: Browser creation honors creator trial over actor Free
    Given the browser commercial operation is "create-trial"
    When the verified browser session executes its commercial operation
    Then the browser creates a second overlay while actor personal plan remains Free

  @BDD-US3-010
  Scenario: Browser creation honors creator grant over actor Free
    Given the browser commercial operation is "create-grant"
    When the verified browser session executes its commercial operation
    Then the browser creates a second overlay while actor personal plan remains Free

  @BDD-US3-011
  Scenario: Browser creation honors creator agency allocation over actor Free
    Given the browser commercial operation is "create-allocation"
    When the verified browser session executes its commercial operation
    Then the browser creates a second overlay while actor personal plan remains Free

  @BDD-US3-012 @EC-010
  Scenario: Browser reads retained overlay without clearing saved styling
    Given the browser commercial operation is "overlay-read"
    When the verified browser session executes its commercial operation
    Then the retained browser overlay is readable with its saved accent and unchanged data

  @BDD-US3-013 @EC-010
  Scenario: Browser cannot edit retained overlay beyond the Free allowance
    Given the browser commercial operation is "overlay-update"
    When the verified browser session executes its commercial operation
    Then the browser update is denied and retained saved data is unchanged

  @BDD-US3-014 @EC-010
  Scenario: Browser activation cannot run retained overlay beyond the allowance
    Given the browser commercial operation is "overlay-run"
    When the verified browser session executes its commercial operation
    Then retained overlay activation and runtime are denied with unchanged data

  @BDD-US3-015 @EC-010
  Scenario: Browser reads retained playlist and saved clips
    Given the browser commercial operation is "playlist-read"
    When the verified browser session executes its commercial operation
    Then the retained browser playlist keeps its readable saved clip and unchanged data

  @BDD-US3-016 @EC-010
  Scenario: Browser cannot rename retained playlist beyond the allowance
    Given the browser commercial operation is "playlist-update"
    When the verified browser session executes its commercial operation
    Then the browser update is denied and retained saved data is unchanged

  @BDD-US3-017 @EC-010
  Scenario: Browser saved selection cannot enable retained playlist runtime
    Given the browser commercial operation is "playlist-run"
    When the verified browser session executes its commercial operation
    Then browser playlist selection remains saved but runtime excludes retained clips
