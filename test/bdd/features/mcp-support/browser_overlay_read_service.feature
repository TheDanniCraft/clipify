@BDD @ATDD @US2 @FR-007 @FR-011
Feature: Browser overlay reads share current backend authority

  @BDD-BROWSER-OVERLAY-READ-001
  Scenario Outline: Overlay reads preserve current authority and owner records
    Given a browser overlay "<operation>" request has "<mode>" authority
    When the verified browser requests the overlay records
    Then browser overlay records are "<availability>" with the correct owner boundary

    Examples:
      | operation | mode        | availability |
      | list      | owner       | available    |
      | list      | removed     | unavailable  |
      | list      | read-denied | unavailable  |
      | list      | read-only   | unavailable  |
      | get       | owner       | available    |
      | get       | removed     | unavailable  |
      | get       | read-denied | unavailable  |
      | get       | read-only   | unavailable  |
      | editor    | allowed     | available    |
      | editor    | removed     | empty        |
      | editor    | read-only   | empty        |
