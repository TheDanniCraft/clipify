@BDD @US3 @FR-017 @BDD-POLICY-WRITER-002
Feature: Membership policy changes serialize with authorized resource commit
 Scenario Outline: Membership removal or role reduction waits for current mutation
  When a mcp resource write races a <change> owner policy update
  Then the owner policy change waits for the committed resource write
  Examples:
   | change            |
   | membership-remove |
   | membership-role   |
