@BDD @US3 @FR-017 @BDD-POLICY-WRITER-006
Feature: Current Pro agency allocation policy serializes with resource commit
 Scenario Outline: Allocation access reduction waits for the authorized write
  When a <caller> resource write races a <change> owner policy update
  Then the owner policy change waits for the committed resource write
  Examples:
   | caller | change            |
   | mcp    | allocation-revoke |
   | mcp    | allocation-remove |
   | mcp    | allocation-expire |
   | chat   | allocation-revoke |
