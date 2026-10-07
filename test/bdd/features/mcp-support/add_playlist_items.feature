@BDD
Feature: Append provider-validated playlist items

  @US2 @FR-007 @FR-011 @BDD-US2-013
  Scenario: A creator adds validated Twitch clips through approved agent access
    Given an approved creator has a playlist with two ordered clips
    When the agent appends two provider-validated clips using the current revision
    Then the approved playlist contains four ordered clips and a new revision


  @BDD-SHARED-ITEM-PROJECTION-001 @ATDD @FR-014
  Scenario: Failed safe result projection cannot commit playlist changes
    Given a playlist append has saved metadata outside the safe output contract
    When the MCP client appends validated clips to that playlist
    Then the result failure rolls back clips revision and successful audit
