@BDD @US2 @FR-017 @BDD-OVERLAY-RUNTIME-002
Feature: Idle overlay source presence follows committed runtime policy on the existing heartbeat
 Scenario Outline: Idle source stops after policy changes outside its process
  When an existing idle overlay source is checked after <change>
  Then the source is disconnected without broadcasting its frame
  Examples:
   | change     |
   | paused     |
   | deleted    |
   | disabled   |
   | suspended  |
   | rotated    |
   | restricted |
