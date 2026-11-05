@BDD @US2
Feature: Creator library story 2

  @FR-004 @SC-002
  @BDD-US2-001
  Scenario Outline: Compute creation-window clip metrics - <example>
    Given known clips before at and after the local 30-day boundaries with tied views
    And the required fixture class is "<example>"
    When I open Home
    Then the recent clip metrics and all-time top five or actionable empty state are shown

    Examples:
      | example |
      | start minus one millisecond |
      | exact start |
      | end minus one millisecond |
      | exact exclusive end |
      | equal view tie |
      | zero clips |

  @FR-005 @SC-002
  @BDD-US2-002
  Scenario Outline: Browse available broadcasts including empty ones - <example>
    Given two archive broadcasts one with no matching clips and a non-archive video
    And the required fixture class is "<example>"
    When I browse Streams and open both archive broadcasts
    Then the archives appear newest first and the empty stream shows zero clip counts

    Examples:
      | example |
      | archive with clips |
      | zero-clip archive |
      | exclude highlight |
      | exclude upload |
      | next provider page |

  @FR-006 @EC-003
  @BDD-US2-003
  Scenario Outline: Associate clips by VOD rather than creation date - <example>
    Given a clip created later from VOD A and clips with blank or deleted VOD IDs
    And the required fixture class is "<example>"
    When I open stream A and the inventory
    Then only VOD A matches its stream and all authorized unmatched clips remain in inventory

    Examples:
      | example |
      | later-created VOD clip |
      | blank video ID |
      | deleted VOD ID |

  @FR-004 @FR-016 @EC-002
  @BDD-US2-004
  Scenario Outline: Show partial and stale metric truth - <example>
    Given incomplete clip sync and stale cached broadcasts during provider outage
    And the required fixture class is "<example>"
    When I open Home and retry broadcasts
    Then known data is retained with separate freshness and incomplete-data notices

    Examples:
      | example |
      | incomplete clip sync |
      | stale broadcast cache |
      | provider outage no cache |
      | one section fails |

  @FR-005 @EC-002
  @BDD-US2-005
  Scenario Outline: Show first-run stream and clip states - <example>
    Given a creator with no known clips and no available broadcasts
    And the required fixture class is "<example>"
    When I open Home Streams and Inventory
    Then each surface offers a relevant empty state and existing permitted refresh or reconnect action

    Examples:
      | example |
      | Home |
      | Streams |
      | Inventory |

  @FR-004 @FR-008 @EC-004
  @BDD-US2-006
  Scenario Outline: Respect local dates through DST - <example>
    Given clips straddling local midnight and DST transitions
    And the required fixture class is "<example>"
    When I change a valid timezone and date range
    Then the displayed dates and exclusive-end membership agree across Home and Inventory

    Examples:
      | example |
      | local midnight |
      | DST spring transition |
      | DST fall transition |
      | saved timezone |
      | browser timezone fallback |

  @FR-005 @FR-013 @EC-001
  @BDD-US2-007
  Scenario Outline: Reject foreign stream and cursor access - <example>
    Given a VOD or cursor belonging to another creator and an expired session
    And the required fixture class is "<example>"
    When I request broadcast pages and detail
    Then each unauthorized request reveals no protected stream or clip data

    Examples:
      | example |
      | foreign VOD ID |
      | foreign creator cursor |
      | expired session |

