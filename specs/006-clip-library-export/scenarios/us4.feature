@BDD @US4
Feature: Creator library story 4

  @FR-010 @SC-004
  @BDD-US4-001
  Scenario Outline: Export complete selected packages - <example>
    Given one then twenty-five then fifty eligible small MP4 fixtures
    And the required fixture class is "<example>"
    When I export each explicitly selected set
    Then one ZIP per set has exactly those complete MP4s and a manifest for every ID

    Examples:
      | example |
      | one eligible clip |
      | twenty-five eligible clips |
      | fifty eligible clips |

  @FR-010
  @BDD-US4-002
  Scenario Outline: Preserve actual media variant - <example>
    Given one clip with landscape and portrait plus a clip with only portrait
    And the required fixture class is "<example>"
    When I export both clips
    Then landscape is preferred and portrait fallback is recorded without transcoding

    Examples:
      | example |
      | landscape and portrait |
      | portrait only |
      | landscape only |

  @FR-012 @EC-006
  @BDD-US4-003
  Scenario Outline: Reconnect missing or revoked Twitch access - <example>
    Given selected clips with missing download scope then revoked provider authorization
    And the required fixture class is "<example>"
    When I export and follow the reconnect action
    Then no success is claimed and the selected IDs survive the existing reconnect flow

    Examples:
      | example |
      | missing scope |
      | revoked provider token |

  @FR-012 @EC-006
  @BDD-US4-004
  Scenario Outline: Recover after rate limit or provider failure - <example>
    Given Twitch returns 429 with reset time then a 5xx response
    And the required fixture class is "<example>"
    When I export and inspect recovery actions
    Then retry timing is respected no busy retries occur and selection is retained

    Examples:
      | example |
      | provider 429 reset |
      | provider 5xx |
      | local export start rate limit |

  @FR-012 @EC-009 @SC-004
  @BDD-US4-005
  Scenario Outline: Report mixed available and unavailable clips - <example>
    Given a set containing successful deleted and provider-failed clips
    And the required fixture class is "<example>"
    When I export then retry failed
    Then the ZIP and summary agree on partial results and retry includes only retryable failed IDs

    Examples:
      | example |
      | one failed clip |
      | several failed clips |
      | retryable and nonretryable mixed |
      | provider 429 after one success |
      | provider 401 after one success |

  @FR-011 @EC-007 @SC-005
  @BDD-US4-006
  Scenario Outline: Validate selection count and empty input - <example>
    Given empty malformed duplicated fifty and fifty-one unique selected IDs
    And the required fixture class is "<example>"
    When I request export for each input class
    Then only valid nonempty sets of at most fifty unique IDs reach the provider

    Examples:
      | example |
      | empty IDs |
      | malformed ID |
      | duplicate IDs |
      | one unique ID |
      | fifty unique IDs |
      | fifty-one unique IDs |

  @FR-011 @EC-007
  @BDD-US4-007
  Scenario Outline: Enforce real byte limits - <example>
    Given files exactly at and one byte above 32MiB or remaining 128MiB total with absent or misleading lengths
    And the required fixture class is "<example>"
    When I export the fixtures
    Then only complete entries within actual-byte caps are included and final response stays within 130MiB

    Examples:
      | example |
      | file exactly32MiB |
      | file32MiB plus one byte |
      | total exactly128MiB |
      | total128MiB plus one byte |
      | absent Content-Length |
      | underreported Content-Length |
      | final response130MiB cap |

  @FR-014 @EC-008 @SC-005
  @BDD-US4-008
  Scenario Outline: Reject unsafe source and redirect targets - <example>
    Given provider results with HTTP credentials nonstandard ports unknown hosts and redirects to loopback or private addresses
    And the required fixture class is "<example>"
    When I attempt export for each unsafe target
    Then no unsafe connection is made no API credentials are forwarded and no unsafe entry is included

    Examples:
      | example |
      | HTTP scheme |
      | URL credentials |
      | nonstandard port |
      | unknown host |
      | redirect loopback |
      | redirect private address |
      | redirect unknown host |
      | redirect chain limit |

  @FR-014 @EC-008
  @BDD-US4-009
  Scenario Outline: Reject invalid media and unsafe filenames - <example>
    Given HTML error empty truncated media and valid clips with traversal reserved colliding long Unicode titles
    And the required fixture class is "<example>"
    When I export these fixtures
    Then invalid media is skipped and complete valid files have distinct safe root ZIP names

    Examples:
      | example |
      | HTML status200 |
      | empty body |
      | truncated MP4 |
      | path traversal title |
      | reserved filename |
      | colliding title |
      | long title |
      | Unicode title |

  @FR-012 @EC-009
  @BDD-US4-010
  Scenario Outline: Handle all failed and timed-out exports - <example>
    Given all clips unavailable then provider reads exceeding per-file and total deadlines
    And the required fixture class is "<example>"
    When I export each set
    Then no empty successful ZIP is returned and failures have actionable local reasons

    Examples:
      | example |
      | all unavailable |
      | all provider errors |
      | per-file timeout |
      | whole-request timeout |

  @FR-012 @EC-009
  @BDD-US4-011
  Scenario Outline: Cancel and recover from browser failures - <example>
    Given an in-progress export followed by cancellation disconnect or rejected browser save initiation
    And the required fixture class is "<example>"
    When I cancel or trigger each failure then retry
    Then work is aborted resources are released and no disk-save success is claimed

    Examples:
      | example |
      | user cancellation |
      | request disconnect |
      | browser read failure |
      | save initiation rejected |

  @FR-013 @EC-001 @SC-005
  @BDD-US4-012
  Scenario Outline: Enforce explicit export permissions - <example>
    Given owner operations contentManager analyst billingManager custom role revoked agency and suspended creator
    And the required fixture class is "<example>"
    When I request exports as each context including a foreign ID
    Then only authorized read-plus-export contexts receive media and any foreign ID rejects the whole request

    Examples:
      | example |
      | owner allowed |
      | operations allowed |
      | contentManager allowed |
      | analyst denied |
      | billingManager denied |
      | custom read-only denied |
      | custom read-plus-export allowed |
      | revoked agency denied |
      | suspended creator denied |
      | mixed owned and foreign ID denied |

  @FR-013 @EC-001
  @BDD-US4-013
  Scenario: Recheck grants during preparation
    Given a valid export with a grant revoked after one media file is buffered
    When I let the next batch begin
    Then the entire archive is withheld and no media response is emitted

  @FR-015 @SC-006
  @BDD-US4-014
  Scenario Outline: Complete export with real controls in both themes - <example>
    Given mobile and desktop light and dark layouts with real installed components
    And the required fixture class is "<example>"
    When I complete first-run success partial error retry and keyboard journeys
    Then feedback remains readable focus remains usable and original selections recover correctly

    Examples:
      | example |
      | 390px light |
      | 390px dark |
      | 1440px light |
      | 1440px dark |

