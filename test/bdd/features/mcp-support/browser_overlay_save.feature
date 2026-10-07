@BDD @US2 @FR-007 @FR-017 @BDD-BROWSER-OVERLAY-SAVE-001
Feature: Verified browser overlay configuration uses shared backend revisions
 Scenario Outline: Authorized configuration commits once
  Given a shared browser playlist mutation is <mode>
  When its verified session mutation completes
  Then the browser overlay edit commits at its next revision
  Examples:
   | mode             |
   | overlay-save     |
   | overlay-save-pro |
 Scenario Outline: Unsafe configuration cannot commit
  Given a shared browser playlist mutation is overlay-save-<mode>
  When its verified session mutation completes
  Then the browser overlay edit is refused
  Examples:
   | mode          |
   | stale         |
   | missing       |
   | removed       |
   | free-advanced |
