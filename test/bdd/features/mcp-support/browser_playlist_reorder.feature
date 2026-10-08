@BDD @US2 @FR-007 @BDD-BROWSER-ITEMS-001
Feature: Browser item edits use the same revision transaction
  Scenario: A verified browser reorder advances its playlist revision
    Given a shared browser playlist mutation is reorder
    When its verified session mutation completes
    Then the browser item order is committed at the next revision
  Scenario Outline: Invalid or stale browser item changes preserve current state
    Given a shared browser playlist mutation is reorder-<mode>
    When its verified session mutation completes
    Then the browser item order remains unchanged
    Examples:
      | mode    |
      | stale   |
      | missing |
      | invalid |
      | removed |
