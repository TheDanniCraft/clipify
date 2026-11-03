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

