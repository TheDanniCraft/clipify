@BDD
Feature: Inspect MCP operational metrics as an administrator

  @US4 @real-browser @mcp-metrics
  Scenario: Admin sees process metrics and client adoption with real HeroUI tables
    Given an administrator opens the MCP operational overview
    Then process-local metrics and self-reported client adoption are accessible

  @US4 @real-browser @mcp-metrics
  Scenario: A creator cannot access the administrative MCP overview
    Given a creator opens the administrative MCP overview
    Then MCP operational statistics are not exposed
