Feature: Runner named destinations

  @BDD @US2 @FR-009 @BDD-US2-FR009
  Scenario Outline: Destination deletion respects saved references
    Given a Pro creator submits the named destination change "<variant>"
    When they submit that named destination edit
    Then the named destination deletion is "<outcome>" with references preserved

    Examples:
      | variant           | outcome |
      | delete            | deleted |
      | delete_referenced | blocked |

  @BDD @US2 @FR-009 @BDD-US2-FR009
  Scenario: A creator reopens a named destination without exposing its protected stream key
    Given a Pro creator saves a named Runner destination with a protected key
    When they reopen the named destination editor
    Then its credential is configured and keep replace and clear actions are available without exposing secrets

  @BDD @US2 @FR-009 @EC-004 @BDD-US2-EC004
  Scenario Outline: Invalid destination edits preserve protected settings
    Given a Pro creator submits the named destination change "<variant>"
    When they submit that named destination edit
    Then the edit is rejected and the prior destination and credential remain unchanged

    @BDD-US2-OPT013
    Examples: Invalid RTMP URL
      | variant     |
      | invalid_url |

    @BDD-US2-OPT014
    Examples: Missing YouTube key
      | variant         |
      | missing_youtube |

    @BDD-US2-OPT015
    Examples: Missing Twitch key
      | variant        |
      | missing_twitch |

    @BDD-US2-OPT016
    Examples: Duplicate destination
      | variant   |
      | duplicate |

  @BDD @US2 @FR-009
  Scenario Outline: Credential edits have explicit intent
    Given a Pro creator submits the named destination change "<variant>"
    When they submit that named destination edit
    Then the named credential change "<variant>" succeeds without exposing secrets

    @BDD-US2-OPT017
    Examples: Keep the current key
      | variant |
      | keep    |

    @BDD-US2-OPT018
    Examples: Replace the current key
      | variant |
      | replace |

    @BDD-US2-OPT019
    Examples: Explicitly clear the key
      | variant |
      | clear   |


  @BDD @US2 @FR-009 @BDD-US2-FR009
  Scenario: Saving a legacy broadcast repeatedly preserves one protected named destination
    Given a Pro creator submits the named destination change "legacy_repeat"
    When they submit that named destination edit
    Then the legacy broadcast exposes one reusable destination without revealing its key

  @BDD @US2 @FR-009 @BDD-US2-FR009
  Scenario: MCP configuration edits convert legacy targets without exposing credentials
    Given a Pro creator submits the named destination change "legacy_mcp_repeat"
    When they submit that named destination edit
    Then the legacy broadcast exposes one reusable destination without revealing its key

  @BDD @US2 @FR-009 @EC-004 @BDD-US2-EC004
  Scenario: Failed MCP target conversion preserves the previous public broadcast configuration
    Given a Pro creator submits the named destination change "legacy_mcp_rollback"
    When they submit that named destination edit
    Then failed legacy MCP conversion preserves the previous public configuration

  @BDD @US2 @FR-009 @BDD-US2-OPT017
  Scenario Outline: Metadata edits keep a newer named destination configuration
    Given a Pro creator submits the named destination change "legacy_authority_<entry>"
    When they submit that named destination edit
    Then the named editor retains the newer destination and its protected credential

    Examples:
      | entry     |
      | dashboard |
      | mcp       |
