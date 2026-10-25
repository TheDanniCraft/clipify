@BDD @real-browser
Feature: Clipify guided onboarding

  @US1 @FR-001 @SC-001 @BDD-TOUR-US1-001
  Scenario: Open and minimize the guide
    Given an isolated authenticated Clipify guide account
    When the guide panel is opened and minimized
    Then the launcher preserves section progress

  @US1 @FR-002 @SC-001 @BDD-TOUR-US1-002
  Scenario: Follow real overlay actions
    Given an isolated authenticated Clipify guide account
    When the first overlay journey is followed
    Then the named configured overlay is saved

  @US1 @FR-003 @SC-001 @BDD-TOUR-US1-003
  Scenario: Preview available clips
    Given an isolated authenticated Clipify guide account
    When the clip preview is opened with available clips
    Then the preview task completes

  @US1 @EC-002 @SC-004 @BDD-TOUR-US1-004
  Scenario: Recover from empty clips
    Given an isolated authenticated Clipify guide account
    When the clip preview has no matching clips
    Then preview stays incomplete with recovery guidance

  @US1 @FR-008 @SC-004 @BDD-TOUR-US1-005
  Scenario: Confirm external installation
    Given an isolated authenticated Clipify guide account
    When the URL is copied without installation confirmation
    Then setup stays incomplete until confirmation

  @US1 @EC-005 @SC-004 @BDD-TOUR-US1-006
  Scenario: Retry a denied clipboard write
    Given an isolated authenticated Clipify guide account
    When the clipboard write is denied
    Then copy guidance remains available without setup completion

  @US1 @EC-001 @SC-004 @BDD-TOUR-US1-007
  Scenario: Retry failed creation
    Given an isolated authenticated Clipify guide account
    When overlay creation fails
    Then the creation task stays incomplete

  @US1 @EC-001 @SC-004 @BDD-TOUR-US1-008
  Scenario: Retry a failed save
    Given an isolated authenticated Clipify guide account
    When an overlay save fails
    Then the configuration task stays incomplete

  @US1 @FR-006 @SC-002 @BDD-TOUR-US1-009
  Scenario: Pause and resume after reload
    Given an isolated authenticated Clipify guide account
    When the running tour is paused and the page reloaded
    Then the same task can resume without creating another overlay

  @US1 @EC-003 @SC-002 @BDD-TOUR-US1-010
  Scenario: Recover from a missing target
    Given an isolated authenticated Clipify guide account
    When the current spotlight target disappears
    Then the guide pauses with a recoverable message

  @US1 @EC-004 @SC-002 @BDD-TOUR-US1-011
  Scenario: Recover from malformed storage
    Given an isolated authenticated Clipify guide account
    When saved guide progress is malformed
    Then the guide opens with safe defaults

  @US1 @EC-004 @SC-002 @BDD-TOUR-US1-012
  Scenario: Recover from unavailable storage
    Given an isolated authenticated Clipify guide account
    When browser storage is unavailable
    Then guide actions remain usable for the session

  @US1 @EC-007 @SC-004 @BDD-TOUR-US1-013
  Scenario: Keep accounts isolated
    Given an isolated authenticated Clipify guide account
    When another account owns the opened overlay
    Then personal progress is unchanged

  @US1 @FR-009 @SC-003 @BDD-TOUR-US1-014
  Scenario: Use the guide by keyboard
    Given an isolated authenticated Clipify guide account
    When a keyboard user starts and pauses a tour with Escape
    Then focus returns to the guide launcher

  @US1 @FR-007 @SC-004 @BDD-TOUR-US1-015
  Scenario: Recognize independent actions
    Given an isolated authenticated Clipify guide account
    When an owned overlay is saved outside a tour
    Then the matching checklist tasks complete

  @US1 @FR-010 @SC-004 @BDD-TOUR-US1-016
  Scenario: Protect private data in analytics
    Given an isolated authenticated Clipify guide account
    When guide analytics are emitted
    Then only allowlisted task and journey metadata are present

  @US1 @FR-011 @SC-001 @BDD-TOUR-US1-017
  Scenario: Keep initial scope bounded
    Given an isolated authenticated Clipify guide account
    When the guide sections are inspected
    Then the supported journeys are offered

  @US2 @FR-004 @SC-004 @BDD-TOUR-US2-018
  Scenario: Save an appearance change
    Given an isolated authenticated Clipify guide account
    When a visible theme change is saved through its guide
    Then the appearance task completes

  @US2 @FR-004 @SC-004 @BDD-TOUR-US2-019
  Scenario: Keep the default appearance
    Given an isolated authenticated Clipify guide account
    When the default appearance is kept
    Then customization is not falsely marked complete

  @US3 @FR-005 @SC-004 @BDD-TOUR-US3-020
  Scenario: Create and populate a playlist
    Given an isolated authenticated Clipify guide account
    When the playlist guide creates names and saves clips
    Then the saved playlist tasks complete

  @US3 @FR-005 @SC-004 @BDD-TOUR-US3-021
  Scenario: Save a playlist order
    Given an isolated authenticated Clipify guide account
    When playlist clips are arranged and saved
    Then the saved order is retained

  @US3 @FR-005 @SC-004 @BDD-TOUR-US3-022
  Scenario: Use the playlist in an overlay
    Given an isolated authenticated Clipify guide account
    When the guided playlist is selected and the overlay saved
    Then the playlist association task completes

  @US3 @EC-006 @SC-002 @BDD-TOUR-US3-023
  Scenario: Replay without creating duplicates
    Given an isolated authenticated Clipify guide account
    When a completed playlist tour is replayed
    Then the existing playlist is reused

  @US1 @FR-009 @SC-003 @BDD-TOUR-US1-024
  Scenario: Use the guide on a narrow screen
    Given an isolated authenticated Clipify guide account
    When the guide is opened on a narrow screen
    Then the guide stays within the viewport above other widgets

  @US1 @EC-003 @SC-002 @BDD-TOUR-US1-025
  Scenario: Choose a replacement for a deleted overlay
    Given an isolated authenticated Clipify guide account
    When the guided overlay is deleted before the user returns
    Then the user can choose a replacement without automatic creation

  @US2 @FR-004 @SC-004 @BDD-TOUR-US2-026
  Scenario: Explain unavailable theme customization
    Given an isolated authenticated Clipify guide account
    When a Free account selects the optional theme journey
    Then the guide explains Pro availability without starting a paywall

  @US1 @FR-001 @SC-001 @BDD-TOUR-US1-027
  Scenario: Show the checklist in the corner by default
    Given an isolated authenticated Clipify guide account
    Then the checklist is open in the corner with progress and no automatic spotlight

  @US1 @FR-006 @SC-002 @BDD-TOUR-US1-028
  Scenario: Skip and restore a task with the real checkbox
    Given an isolated authenticated Clipify guide account
    When a task is manually skipped and the page reloaded
    Then it is marked skipped and can be restored

  @US1 @FR-002 @SC-001 @BDD-TOUR-US1-029
  Scenario: Continue from creation through source and filters
    Given an isolated authenticated Clipify guide account
    When the first overlay journey is followed
    Then the next task guides source and filters without changing Save behavior

  @US4 @FR-012 @SC-004 @BDD-TOUR-US4-030
  Scenario: Install the public website player
    Given an isolated authenticated Clipify guide account
    When the website player guide is followed
    Then the website guide completes after copying public installation code

  @US4 @FR-012 @SC-004 @BDD-TOUR-US4-031
  Scenario: Discover galleries through the real tab
    Given an isolated authenticated Clipify guide account
    When the gallery introduction is followed
    Then the gallery introduction is complete

  @US4 @FR-012 @SC-004 @BDD-TOUR-US4-032
  Scenario: Find tools and support without changing consent
    Given an isolated authenticated Clipify guide account
    When the tools and support introductions are followed
    Then the introductions finish with consent choices unchanged
