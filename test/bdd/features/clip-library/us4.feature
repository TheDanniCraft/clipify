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

