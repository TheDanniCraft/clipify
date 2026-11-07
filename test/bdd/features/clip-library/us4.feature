@BDD @US4
Feature: Creator library story 4

  @FR-010 @SC-004
  @BDD-US4-001
  Scenario Outline: Export complete selected packages - <example>
    Given one then twenty-five then fifty eligible small MP4 fixtures
    And the required fixture class is "<example>"
    When I export each explicitly selected set
    Then one video or ZIP contains exactly the selected complete MP4s without a metadata sidecar

    Examples:
      | example |
      | one eligible clip |
      | twenty-five eligible clips |
      | fifty eligible clips |

  @FR-010 @FR-013 @SC-004
  @BDD-US4-COMP-001 @requires:ffmpeg
  Scenario: Export named versions with an authoritative clip override
    Given a creator has paired layout templates and an isolated clip override
    When I export Original and both formats from two templates
    Then five complete videos apply my clip override without changing global or foreign layouts
