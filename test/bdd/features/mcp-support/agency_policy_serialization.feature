@BDD @US3 @FR-017 @BDD-POLICY-WRITER-004
Feature: Current agency creator permission ceiling serializes with resource commit
 Scenario Outline: Agency access reduction waits for the current authorized write
  When a mcp resource write races a <change> owner policy update
  Then the owner policy change waits for the committed resource write
  Examples:
   | change         |
   | agency-ceiling |
   | agency-revoke  |
   | agency-delete  |
