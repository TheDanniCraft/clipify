@BDD @US2 @FR-007 @FR-014 @BDD-BROWSER-ITEMS-002
Feature: Browser clip edits share backend limits and revisions
 Scenario Outline: Browser item save commits atomically
  Given a shared browser playlist mutation is <mode>
  When its verified session mutation completes
  Then the browser clip edit commits once
  Examples:
   | mode          |
   | items         |
   | items-clear   |
   | items-retained|
   | items-rename  |
   | items-pro     |
 Scenario Outline: Browser item failure preserves existing clips
  Given a shared browser playlist mutation is <mode>
  When its verified session mutation completes
  Then the browser clip edit is not committed
  Examples:
   | mode                 |
   | items-stale          |
   | items-limit          |
   | items-provider-error |
   | items-lost-access    |
   | items-raced          |
