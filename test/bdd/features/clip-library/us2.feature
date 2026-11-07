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
      | next saved page |

