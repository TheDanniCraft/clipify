@BDD @US2 @FR-017 @BDD-OVERLAY-PAUSE-001
Feature: Committed MCP pause stops the connected local overlay source
 Scenario: Pause succeeds
  When an authenticated MCP client pauses an active overlay
  Then its connected local source is stopped
 Scenario: Stale pause is refused
  When an authenticated MCP client submits a stale pause
  Then its connected local source remains active
