@BDD @US3
Feature: Creator library story 3

  @FR-007 @SC-003
  @BDD-US3-001
  Scenario Outline: Browse clip metadata and preview - <example>
    Given clips with complete metadata
    And the required fixture class is "<example>"
    When I open Inventory and preview a clip
    Then the actual thumbnail category local date duration views and provider link are shown

    Examples:
      | example |
      | public creator page enabled |
      | public creator page disabled |

  @FR-008 @SC-003
  @BDD-US3-002
  Scenario Outline: Apply every supported inventory filter - <example>
    Given clips differing in title category creation date views and duration
    And the required fixture class is "<example>"
    When I apply each filter then their combined intersection and restore the URL
    Then results and total counts exactly match case-insensitive title category date minimum-view and duration predicates

    Examples:
      | example |
      | title substring mixed case |
      | category |
      | start boundary |
      | exclusive end boundary |
      | minimum views |
      | minimum duration |
      | maximum duration |
      | combined intersection |
      | restore URL |

  @FR-008 @SC-003
  @BDD-US3-003
  Scenario Outline: Sort and page with deterministic ties - <example>
    Given more than fifty clips with equal dates or views
    And the required fixture class is "<example>"
    When I use newest and most-viewed sorts and traverse pages
    Then results have stable ID tie-breaks with no duplicates and correct page totals

    Examples:
      | example |
      | newest tie |
      | most viewed tie |
      | first page |
      | next page |
      | last page |

  @FR-009 @EC-005 @SC-003
  @BDD-US3-004
  Scenario: Select visible pages across pagination
    Given three inventory pages
    When I select page one remove a row and select items on page two
    Then only explicit selected IDs persist and selected count equals their unique count

  @FR-009 @EC-005
  @BDD-US3-005
  Scenario Outline: Reset selection on scope changes - <example>
    Given a populated selection and a pending inventory request
    And the required fixture class is "<example>"
    When I change filters stream or creator while an older response arrives
    Then selection clears with feedback and the old response cannot restore it

    Examples:
      | example |
      | filter change |
      | stream change |
      | creator change |
      | stale response after change |

  @FR-008 @EC-004
  @BDD-US3-006
  Scenario Outline: Validate invalid filter boundaries - <example>
    Given negative views nonfinite duration reversed ranges invalid timezone and excessive page size
    And the required fixture class is "<example>"
    When I submit each invalid query
    Then field-level validation preserves entered values and no provider fetch occurs

    Examples:
      | example |
      | negative views |
      | nonfinite duration |
      | negative duration |
      | reversed duration range |
      | reversed date range |
      | invalid timezone |
      | page size above fifty |
      | invalid timestamp |

  @FR-007 @FR-006 @EC-003
  @BDD-US3-007
  Scenario Outline: Keep clips without optional metadata usable - <example>
    Given clips with missing thumbnail VOD offset and category metadata
    And the required fixture class is "<example>"
    When I browse and preview them
    Then text links and available metadata remain usable without invented images or stream matches

    Examples:
      | example |
      | missing thumbnail |
      | missing VOD ID |
      | missing VOD offset |
      | missing category |

  @FR-013 @EC-001
  @BDD-US3-008
  Scenario Outline: Enforce read context access - <example>
    Given owner permitted direct member permitted agency revoked member suspended account and foreign creator
    And the required fixture class is "<example>"
    When I request inventory for each context
    Then only currently authorized contexts receive clip data under existing entitlement rules

    Examples:
      | example |
      | owner allowed |
      | direct Pro member allowed |
      | direct Free member denied |
      | agency permitted |
      | agency revoked |
      | member revoked |
      | account suspended |
      | foreign creator |
      | session expired |

  @FR-016 @EC-002
  @BDD-US3-009
  Scenario Outline: Refresh within crawler policy - <example>
    Given an incomplete inventory with a failed request or refresh cooldown
    And the required fixture class is "<example>"
    When I retry a read and attempt refresh
    Then valid selection survives unchanged-request failure and existing refresh policy is respected

    Examples:
      | example |
      | read failure unchanged query |
      | refresh cooldown |
      | incomplete sync |

  @FR-008 @SC-006
  @BDD-US3-010
  Scenario: Bound warm-cache page response
    Given a CI-class fixture with ten thousand cached clips
    When I request a warm 25-row inventory page
    Then the correct page is displayed within two seconds without starting a historical crawl
