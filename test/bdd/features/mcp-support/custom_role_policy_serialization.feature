@BDD @US3 @FR-017 @BDD-POLICY-WRITER-003
Feature: Custom role definitions serialize with an authorized resource commit
 Scenario Outline: Permission reduction or definition deletion waits for current mutation
  When a mcp resource write races a <change> owner policy update
  Then the owner policy change waits for the committed resource write
  Examples:
   | change             |
   | custom-role        |
   | custom-role-remove |
