@BDD @US2 @FR-007 @BDD-OVERLAY-SANITIZE-001
Feature: Shared overlay configuration preserves safe rendering and playback semantics
 Scenario Outline: Configuration inputs receive the same backend normalization
  Given a shared browser playlist mutation is overlay-save-sanitize-<mode>
  When its verified session mutation completes
  Then the stored overlay configuration is normalized for <mode>
  Examples:
   | mode  |
   | font  |
   | color |
   | type  |
