@BDD @US2 @FR-017 @BDD-OVERLAY-RUNTIME-003
Feature: Source activity cannot restore presence after current runtime access changes
 Scenario Outline: Presence frame is refused after independent policy change
  When an existing overlay source announces activity after <change>
  Then the source is disconnected without broadcasting its frame
  Examples:
   | change     |
   | paused     |
   | deleted    |
   | disabled   |
   | suspended  |
   | rotated    |
   | restricted |
