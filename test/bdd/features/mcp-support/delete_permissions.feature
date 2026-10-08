@BDD @ATDD
Feature: Preserve delete authority independently of host prompts

  @US2 @FR-007 @FR-008 @FR-018
  @BDD-US2-032
  Scenario Outline: Enforce explicit deletion permissions independently of host prompts
    Given <resource> belongs to an accessible creator and the client has <permission>
    When <client> calls its accurately annotated destructive deletion tool
    Then <outcome>

    Examples:
      | resource | permission | client | outcome |
      | overlay | explicit overlay delete permission | a client that confirms destructive calls | deletion succeeds without a dashboard confirmation |
      | playlist | explicit playlist delete permission | a client that confirms destructive calls | deletion succeeds without a dashboard confirmation |
      | overlay | read/edit without delete permission | a client that ignores destructive hints | deletion is denied without changing state |
      | playlist | read/edit without delete permission | a client that ignores destructive hints | deletion is denied without changing state |
      | overlay | explicit overlay delete permission | a custom client that ignores destructive hints | deletion succeeds without a dashboard confirmation |
      | playlist | explicit playlist delete permission | a custom client that ignores destructive hints | deletion succeeds without a dashboard confirmation |
