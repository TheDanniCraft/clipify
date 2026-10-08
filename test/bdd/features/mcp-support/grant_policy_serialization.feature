@BDD @US3 @FR-017 @BDD-POLICY-WRITER-005
Feature: Current Pro entitlement grant policy serializes with resource commit
 Scenario Outline: Personal or global grant reduction waits for the authorized write
  When a <caller> resource write races a <change> owner policy update
  Then the owner policy change waits for the committed resource write
  Examples:
   | caller | change              |
   | mcp | grant-revoke        |
   | mcp | grant-remove        |
   | mcp | grant-expire        |
   | mcp | global-grant-revoke  |
   | mcp | global-grant-remove  |
   | mcp | global-grant-expire  |
   | chat | grant-revoke        |
   | chat | global-grant-revoke |
