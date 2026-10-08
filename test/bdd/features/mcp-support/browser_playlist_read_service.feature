@BDD @ATDD @US2 @FR-007 @FR-011
Feature: Browser playlist reads preserve current backend authority

  @BDD-BROWSER-PLAYLIST-READ-001
  Scenario Outline: Playlist reads retain allowed saved data and exclude denied creators
    Given a browser playlist "<operation>" request has "<mode>" authority
    When the verified browser requests playlist records
    Then playlist saved contents follow the current "<mode>" permission

    Examples:
      | operation | mode        |
      | list      | owner       |
      | list      | removed     |
      | list      | read-denied |
      | get       | owner       |
      | get       | removed     |
      | get       | read-denied |
