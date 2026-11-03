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

