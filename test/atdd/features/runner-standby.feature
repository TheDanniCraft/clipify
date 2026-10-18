@ATDD @US4 @SC-004 @runner-standby-acceptance
Feature: Review generated Runner appearance before broadcast

  @ATDD-US4-SC004
  Scenario: Review custom standby at all four corners and in both preview modes
    Given a Pro creator has a saved custom standby and a playable generated source
    When they review real standby and clip previews at all four attribution corners
    Then clearing optional images previews the saved color and message before applying them
