@BDD @US1
Feature: Creator library story 1

  @FR-001 @SC-001
  @BDD-US1-001
  Scenario Outline: Navigate permitted sidebar destinations - <example>
    Given an owner with all creator tools
    And the required fixture class is "<example>"
    When I visit every sidebar destination
    Then the selected location and correct existing resource list are shown

    Examples:
      | example |
      | Home |
      | Streams |
      | Clip Inventory |
      | Overlays |
      | Playlists |
      | Galleries |
      | Runner |
      | Tools |
      | Settings |

  @FR-002 @EC-010 @SC-001
  @BDD-US1-002
  Scenario Outline: Keep editor bookmarks and guards - <example>
    Given bookmarks for overlay playlist gallery Runner and settings editors
    And the required fixture class is "<example>"
    When I open each bookmark and edit then navigate away
    Then the same resource opens and unsaved changes receive the existing guard

    Examples:
      | example |
      | overlay |
      | playlist |
      | gallery |
      | Runner |
      | settings |

  @FR-001 @FR-003 @FR-015 @SC-006
  @BDD-US1-003
  Scenario Outline: Operate mobile and collapsed navigation - <example>
    Given the sidebar in each mobile or desktop light or dark layout
    And the required fixture class is "<example>"
    When I collapse open and operate it using only the keyboard
    Then all controls are named focus is visible and the mobile sheet closes after navigation

    Examples:
      | example |
      | 390px light |
      | 390px dark |
      | 1440px light |
      | 1440px dark |
      | drawer closes before search opens |
      | Ctrl or Command B outside editable fields |
      | default-open contextual groups |
      | breadcrumb ancestor navigation |
      | drawer scroll after keyboard closure |

  @FR-003 @SC-001
  @BDD-US1-004
  Scenario Outline: Search destinations and clip titles - <example>
    Given a creator with cached clips and permitted destinations
    And the required fixture class is "<example>"
    When I open search with Control or Command K and search a matching title
    Then matching destinations and creator clips appear and selecting one navigates

    Examples:
      | example |
      | destination match |
      | clip title match |
      | keyboard Control K |
      | keyboard Command K |

  @FR-003 @EC-001
  @BDD-US1-005
  Scenario: Clear search when switching creator
    Given search results and a pending request for creator A
    When I switch to creator B before the response arrives
    Then no creator A result is displayed or selectable

  @FR-003 @EC-002
  @BDD-US1-006
  Scenario Outline: Recover from search empty and failed requests - <example>
    Given a search with no matches followed by a failed clip lookup
    And the required fixture class is "<example>"
    When I inspect the empty state and retry the failed lookup
    Then distinct no-results and retry states preserve the typed query

    Examples:
      | example |
      | no destination matches |
      | no clip matches |
      | clip lookup error then retry |

  @FR-001 @EC-010
  @BDD-US1-007
  Scenario Outline: Preserve account and paid controls - <example>
    Given an agency member an admin viewer and a Free creator with an active campaign
    And the required fixture class is "<example>"
    When I exercise their existing account theme upgrade help and exit-view controls
    Then each control retains its authorization and existing behavior

    Examples:
      | example |
      | agency member |
      | admin viewing creator |
      | Free owner campaign |
      | Pro owner |

  @FR-003 @FR-015
  @BDD-US1-008
  Scenario Outline: Dismiss search and restore focus - <example>
    Given search opened from a focused trigger while an editor is present
    And the required fixture class is "<example>"
    When I use arrows Enter and Escape and type in an ordinary field
    Then search selection and dismissal work and shortcuts do not disrupt editing

    Examples:
      | example |
      | arrow and Enter selection |
      | Escape dismissal |
      | shortcut in editable field |

