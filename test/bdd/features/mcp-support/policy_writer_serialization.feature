@BDD @US3 @FR-017 @BDD-POLICY-WRITER-001
Feature: Current owner policy and resource commits serialize
 Scenario Outline: An independent owner policy writer waits for the authorized transaction
  When a <caller> resource write races a <change> owner policy update
  Then the owner policy change waits for the committed resource write
  Examples:
   | caller | change   |
   | mcp    | plan     |
   | mcp    | disabled |
   | chat   | plan     |
   | chat   | disabled |
