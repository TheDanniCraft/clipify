@BDD @ATDD @US4 @FR-019
Feature: Standby obeys native broadcast windows

  @BDD-US4-OPT094
  Scenario Outline: A cold Runner cannot start empty standby outside its signed window
    Given a Pro Runner has valid stored signed schedule authority and an empty playlist
    When it restores the schedule in a fresh process "<boundary>" its broadcast window
    Then no engine, content read or output starts and its execution journal remains unchanged

    Examples:
      | boundary |
      | before   |
      | after    |
