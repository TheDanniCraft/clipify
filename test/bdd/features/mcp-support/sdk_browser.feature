@BDD @ATDD @US1 @US2 @FR-001 @FR-003 @FR-005 @FR-007 @BDD-SDK-BROWSER-001
Feature: Manage Clipify through an official SDK and actual browser consent

  Scenario Outline: Approve a custom client for <area>, observe agent changes, leave without approval and revoke on actual pages
    When the official SDK completes <area> approval edit abandoned consent and revoke through Clipify pages

    Examples:
      | area      |
      | overlays  |
      | playlists |
