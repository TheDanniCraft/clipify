@BDD @US2 @US3 @US5 @FR-003 @FR-006 @FR-009 @EC-003 @EC-009
Feature: MCP workflow pagination preserves safe bounded result sets

  @BDD-WORKFLOW-PAGINATION-001
  Scenario Outline: Resource pages return distinct safe rows
    Given a workflow tool "<tool>" under case "pagination"
    When the approved client executes the workflow through MCP
    Then the workflow result is "success" and has a safe projection

    Examples:
      | tool |
      | search_clips |
      | list_galleries |
      | get_gallery_preview |
      | list_runners |
      | list_stream_sessions |

  @BDD-WORKFLOW-PAGINATION-002
  Scenario Outline: Malformed cursors cannot access resource pages
    Given a workflow tool "<tool>" under case "malformed_cursor"
    When the approved client executes the workflow through MCP
    Then the workflow result is "denied" and has a safe projection

    Examples:
      | tool |
      | search_clips |
      | list_galleries |
      | get_gallery_preview |
      | list_runners |
      | list_stream_sessions |
      | get_overlay_queues |
