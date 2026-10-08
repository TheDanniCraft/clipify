@BDD @ATDD @US3 @FR-009 @EC-008
Feature: Shared backend limits apply to approved MCP clients

  @BDD-US3-018
  Scenario: A Free creator cannot create a second overlay through MCP
    Given a Free creator has one existing overlay before an MCP create
    When the MCP client requests a second overlay
    Then the quota error reports one used overlay and a limit of one without changing saved data

  @BDD-US3-019 @EC-009
  Scenario Outline: Free creators cannot save paid overlay settings through MCP
    Given a Free creator has saved overlay settings before a "<mode>" change
    When the MCP client requests the paid settings change
    Then the paid settings error preserves the overlay name volume and revision

    Examples:
      | mode         |
      | free         |
      | free-filter  |
      | free-styling |

  @BDD-US3-020 @EC-012
  Scenario: Creator subscription access overrides the actor personal Free plan
    Given the creator has Pro through "subscription" while the actor personal creator is Free
    When the MCP client requests another overlay for that creator
    Then the second overlay follows creator entitlement source "billing" and replays safely

  @BDD-US3-021 @EC-012
  Scenario: Creator trial access overrides the actor personal Free plan
    Given the creator has Pro through "trial" while the actor personal creator is Free
    When the MCP client requests another overlay for that creator
    Then the second overlay follows creator entitlement source "reverse_trial" and replays safely

  @BDD-US3-022 @EC-012
  Scenario: Creator grant access overrides the actor personal Free plan
    Given the creator has Pro through "grant" while the actor personal creator is Free
    When the MCP client requests another overlay for that creator
    Then the second overlay follows creator entitlement source "grant" and replays safely

  @BDD-US3-023 @EC-012
  Scenario: Creator agency allocation overrides the actor personal Free plan
    Given the creator has Pro through "allocation" while the actor personal creator is Free
    When the MCP client requests another overlay for that creator
    Then the second overlay follows creator entitlement source "agency" and replays safely

  @commercial-inverse-actor @EC-012
  Scenario: Actor personal Pro cannot expand a Free creator quota
    Given the actor personal creator is Pro while the target creator is Free with one overlay
    When the MCP client requests another overlay for that creator
    Then actor Pro does not bypass the target creator quota or create an overlay on retry

  @BDD-US3-006 @EC-008
  Scenario: Browser overlay quota denial gives current usage and limit
    Given a verified creator owner already has the one Free overlay
    When the browser owner requests another overlay through backend creation
    Then the browser receives one used overlay and limit one without another saved overlay

  @commercial-source-inactive @EC-012
  Scenario Outline: Inactive entitlement sources do not expand creator limits
    Given creator entitlement state is "<source>" with one existing overlay
    When the MCP client requests another overlay for that creator
    Then inactive creator entitlement keeps usage one and limit one on initial request and retry

    Examples:
      | source             |
      | trial-expired      |
      | grant-expired      |
      | grant-future       |
      | grant-revoked      |
      | allocation-expired |
      | allocation-future  |

  @commercial-allocation-removal-scheduled @EC-012
  Scenario: Agency access remains active before scheduled removal ends
    Given creator entitlement state is "allocation-removal-active" with one existing overlay
    When the MCP client requests another overlay for that creator
    Then the second overlay follows creator entitlement source "agency" and replays safely

  @BDD-US3-024 @EC-010
  Scenario: Downgraded creator can read a retained paid overlay
    Given a downgraded creator retains an overlay outside the Free allowance
    When the MCP client reads that retained overlay
    Then the retained overlay remains readable with its saved paid settings intact

  @BDD-US3-025 @EC-010
  Scenario: Downgraded creator cannot modify a retained overlay outside the allowance
    Given a downgraded creator retains an overlay outside the Free allowance
    When the MCP client changes that retained overlay
    Then the retained update is denied without clearing its saved paid settings

  @BDD-US3-026 @EC-010
  Scenario: MCP activation cannot run an overlay outside the Free allowance
    Given a downgraded creator retains an overlay outside the Free allowance
    When the MCP client attempts to activate the retained overlay
    Then activation is denied and existing overlay runtime policy keeps it unavailable

  @BDD-US3-027 @EC-010
  Scenario: Downgraded creator can read a retained playlist and saved clips
    Given a downgraded creator retains a playlist outside the Free allowance
    When the MCP client reads the retained playlist
    Then saved playlist metadata and ordered clips remain readable and intact

  @BDD-US3-028 @EC-010
  Scenario: Retained playlist rename cannot bypass the Free allowance
    Given a downgraded creator retains a playlist outside the Free allowance
    When the MCP client renames the retained playlist
    Then the retained playlist change is denied without losing saved clips

  @BDD-US3-029 @EC-010
  Scenario: Selecting a retained playlist does not enable paid runtime access
    Given a downgraded creator retains a playlist outside the Free allowance
    When the MCP client selects that playlist for the active Free overlay
    Then saved selection remains intact but runtime policy excludes retained playlist clips

  @BDD-US3-033 @FR-011 @EC-012
  Scenario: Connected client sees upgrade on its next mutation
    Given an approved MCP client has connected before "upgrade"
    When the creator authority change commits and the client edits without reconnecting
    Then the mutation follows current authority for "upgrade" and preserves denied settings

  @BDD-US3-034 @FR-011 @EC-012
  Scenario: Connected client sees downgrade on its next mutation
    Given an approved MCP client has connected before "downgrade"
    When the creator authority change commits and the client edits without reconnecting
    Then the mutation follows current authority for "downgrade" and preserves denied settings

  @BDD-US3-035 @FR-011 @EC-012
  Scenario: Connected client sees trial-expiry on its next mutation
    Given an approved MCP client has connected before "trial-expiry"
    When the creator authority change commits and the client edits without reconnecting
    Then the mutation follows current authority for "trial-expiry" and preserves denied settings

  @BDD-US3-036 @FR-011 @EC-012
  Scenario: Connected client sees grant-expiry on its next mutation
    Given an approved MCP client has connected before "grant-expiry"
    When the creator authority change commits and the client edits without reconnecting
    Then the mutation follows current authority for "grant-expiry" and preserves denied settings

  @BDD-US3-037 @FR-011 @EC-012
  Scenario: Connected client sees team-removal on its next mutation
    Given an approved MCP client has connected before "team-removal"
    When the creator authority change commits and the client edits without reconnecting
    Then the mutation follows current authority for "team-removal" and preserves denied settings

  @BDD-US3-038 @FR-011 @EC-012
  Scenario: Connected client sees agency-unlink on its next mutation
    Given an approved MCP client has connected before "agency-unlink"
    When the creator authority change commits and the client edits without reconnecting
    Then the mutation follows current authority for "agency-unlink" and preserves denied settings

  @BDD-US3-039 @FR-011 @EC-012
  Scenario: Connected client sees suspension on its next mutation
    Given an approved MCP client has connected before "suspension"
    When the creator authority change commits and the client edits without reconnecting
    Then the mutation follows current authority for "suspension" and preserves denied settings
