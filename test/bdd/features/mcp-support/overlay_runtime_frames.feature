@BDD @US2 @FR-017 @BDD-OVERLAY-RUNTIME-001
Feature: Existing source frames honor independently committed current runtime policy
 Scenario Outline: A source stops after policy changes outside its process
  When an existing overlay source sends a frame after <change>
  Then the source is disconnected without broadcasting its frame
  Examples:
   | change     |
   | paused     |
   | deleted    |
   | disabled   |
   | suspended  |
   | rotated    |
   | restricted |
