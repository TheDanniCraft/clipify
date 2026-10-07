@BDD
Feature: Public MCP rate limits
  @US4 @FR-015 @EC-018 @SC-005
  @BDD-US4-001
  Scenario: It submits another registration — a registration caller exhausts its configured registration budget
    Given a registration caller exhausts its configured registration budget
    When it submits another registration
    Then registration is throttled with retry guidance and no client record is created

  @US4 @FR-015 @EC-019 @SC-005
  @BDD-US4-002
  Scenario: It attempts another mutation — a client exhausts its configured tool-call budget
    Given a client exhausts its configured tool-call budget
    When it attempts another mutation
    Then the call is throttled with retry guidance and no business resource changes
