@BDD @FB-FR-001 @FB-FR-002 @FB-FR-003 @FB-FR-004 @FB-SC-001
Feature: Agents submit user-requested Clipify feedback

  @BDD-FEEDBACK-001
  Scenario Outline: User requested feedback reaches the existing feedback product
    Given a workflow tool "submit_feedback" under case "<case>"
    When the approved client executes the workflow through MCP
    Then feedback submission is queued once without private context

    Examples:
      | case |
      | success |
      | suggestion |
      | free |
      | replay |

  @BDD-FEEDBACK-002 @FB-EC-001
  Scenario Outline: Unapproved or invalid feedback cannot reach Sentry
    Given a workflow tool "submit_feedback" under case "<case>"
    When the approved client executes the workflow through MCP
    Then feedback submission is rejected without contacting Sentry

    Examples:
      | case |
      | unconfirmed |
      | missing_scope |
      | read_only |
      | revoked |
      | wrong_creator |
      | sentry_unavailable |
      | empty_message |
      | long_message |
      | unexpected_transcript |
      | sentry_disabled |

  @BDD-FEEDBACK-003 @FB-EC-001
  Scenario: A sixth distinct report cannot bypass the RAM feedback limit
    Given a workflow tool "submit_feedback" under case "limit"
    When the approved client executes the workflow through MCP
    Then the sixth feedback report is rate limited

  @BDD-FEEDBACK-004 @FB-EC-001
  Scenario: An accepted retry alias cannot change the approved feedback
    Given a workflow tool "submit_feedback" under case "alias_conflict"
    When the approved client executes the workflow through MCP
    Then changed feedback under the accepted alias is rejected

  @BDD-FEEDBACK-005 @FB-EC-001
  Scenario: Feedback shares the application limiter infrastructure
    Given a workflow tool "submit_feedback" under case "shared_limit"
    When the approved client executes the workflow through MCP
    Then the shared feedback budget prevents submission
