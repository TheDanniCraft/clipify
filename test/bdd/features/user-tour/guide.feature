@BDD @real-browser @shard:scenario
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
    Then the appearance guide completes without changing the saved style

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
  Scenario: Continue from creation through source settings
    Given an isolated authenticated Clipify guide account
    When the first overlay journey is followed
    Then the next task guides source without changing Save behavior

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

  @US1 @FR-006 @SC-002 @BDD-TOUR-US1-033
  Scenario: Keep account progress after browser data is cleared
    Given an isolated authenticated Clipify guide account
    When the first section is finished and browser data is cleared
    Then the same account keeps its progress without reopening onboarding

  @US1 @FR-001 @SC-003 @BDD-TOUR-US1-034
  Scenario: Expand only one section at a time
    Given an isolated authenticated Clipify guide account
    When different checklist sections are expanded
    Then only the last selected section remains expanded

  @US1 @FR-002 @SC-001 @BDD-TOUR-US1-035
  Scenario: Replay overlay creation from its real entry point
    Given an isolated authenticated Clipify guide account
    When completed overlay creation is replayed from the editor
    Then Add Overlay is highlighted without opening or creating an overlay

  @US1 @FR-006 @SC-002 @BDD-TOUR-US1-036
  Scenario: Recognize an existing account without nagging
    Given an isolated authenticated Clipify guide account
    When an account with existing resources has no guide record
    Then existing setup is recognized with the checklist minimized

  @US1 @FR-002 @SC-001 @BDD-TOUR-US1-037
  Scenario: Learn how to access an overlay from another page
    Given an isolated authenticated Clipify guide account
    When an overlay task is started from Tools
    Then normal Dashboard navigation opens the overlay through its edit control

  @US1 @FR-006 @SC-003 @BDD-TOUR-US1-038
  Scenario: Confirm skipping an active task in a popover
    Given an isolated authenticated Clipify guide account
    When a running task's checkbox is opened and cancellation is retried
    Then the task is skipped only after its popover confirmation

  @US4 @FR-012 @SC-004 @BDD-TOUR-US4-039
  Scenario: Keep the report widget usable from its introduction
    Given an isolated authenticated Clipify guide account
    When the report button is clicked during its introduction
    Then the normal report form opens with the guide paused

  @US2 @FR-004 @SC-002 @BDD-TOUR-US2-040
  Scenario: Resume styling through its real entry point
    Given an isolated authenticated Clipify guide account
    When customization is started inside Theme Studio and left at its save step
    Then resuming teaches the route back to Theme Studio and allows reviewing the look

  @US2 @FR-004 @SC-001 @BDD-TOUR-US2-041
  Scenario: Keep the color-and-style task focused on appearance
    Given an isolated authenticated Clipify guide account
    When the color-and-style task keeps its default look
    Then the launcher retains personalization progress after reload

  @US1 @FR-009 @SC-003 @BDD-TOUR-US1-042
  Scenario: Keep dropdowns above a continuously dimmed tour
    Given an isolated authenticated Clipify guide account
    When the clip source dropdown is opened during the guide
    Then its options stay usable above the dimming and section progress survives reload

  @US1 @FR-009 @SC-003 @BDD-TOUR-US1-043
  Scenario: Review clip settings with HeroUI guide controls
    Given an isolated authenticated Clipify guide account
    When the clip task is reviewed backward from save to source
    Then every later action has a HeroUI Back button and the ring always shows percent

  @US2 @FR-004 @SC-002 @BDD-TOUR-US2-044
  Scenario: Go back across the Theme Studio entry
    Given an isolated authenticated Clipify guide account
    When Back is used from the styling workspace
    Then normal app navigation returns to the first styling step

  @US3 @FR-005 @SC-004 @BDD-TOUR-US3-045
  Scenario: Guide selection across clip picker pages
    Given an isolated authenticated Clipify guide account
    When clips are selected across pages through the guided picker
    Then adding advances automatically to arrangement and saving keeps all selected clips

  @US3 @FR-006 @SC-002 @BDD-TOUR-US3-046
  Scenario: Resume a cancelled clip picker checkpoint
    Given an isolated authenticated Clipify guide account
    When the guided picker is cancelled during selection
    Then resuming reopens the picker through Add Clips and continues from selection

  @US3 @FR-005 @SC-002 @BDD-TOUR-US3-047
  Scenario: Follow the actual overlay source type in playlist guidance
    Given an isolated authenticated Clipify guide account
    When playlist source guidance changes to Playlist and back to another type
    Then it stays in the flow and advances again when Playlist is selected

  @US1 @FR-001 @SC-001 @BDD-TOUR-US1-048
  Scenario: Start the guided journey from the welcome modal
    Given an isolated authenticated Clipify guide account
    When the fresh welcome offers the guided journey
    Then starting the welcome teaches the real Add Overlay control

  @US1 @FR-001 @SC-004 @BDD-TOUR-US1-049
  Scenario: Defer the welcome without repeated prompts
    Given an isolated authenticated Clipify guide account
    When the fresh welcome is deferred
    Then a new browser session keeps the guide available without the welcome

  @US1 @FR-002 @SC-001 @BDD-TOUR-US1-050
  Scenario: Earn the Clipify Expert badge after every guide
    Given an isolated authenticated Clipify guide account
    When every guide including the final discovery step is completed
    Then the Clipify Expert graduation badge persists on the member card

  @US1 @FR-014 @SC-004 @BDD-TOUR-US1-051
  Scenario: Finish guides with existing settings to earn Expert
    Given an isolated authenticated Clipify guide account
    When three remaining guides confirm the existing settings
    Then all guides are completed and the Expert badge is awarded

  @US3 @FR-005 @SC-004 @BDD-TOUR-US3-052
  Scenario: Save a preselected playlist instead of the tutorial playlist
    Given an isolated authenticated Clipify guide account
    When the editor preselects a different playlist during overlay guidance
    Then saving the overlay completes the guide with the actual playlist

  @US4 @FR-015 @SC-004 @BDD-TOUR-US4-053
  Scenario: Discover runners without setting up a device
    Given an isolated authenticated Clipify guide account
    When the runner discovery guide is followed
    Then runner discovery completes without creating a runner

  @US4 @FR-015 @SC-004 @BDD-TOUR-US4-054
  Scenario: Find account settings and review security
    Given an isolated authenticated Clipify guide account
    When the settings discovery guide is followed
    Then settings discovery completes without changing account settings

  @US4 @FR-015 @SC-004 @BDD-TOUR-US4-055
  Scenario: Find AI connections without authorizing an app
    Given an isolated authenticated Clipify guide account
    When the AI discovery guide is followed
    Then AI discovery completes without connecting an app

  @US4 @FR-015 @SC-004 @BDD-TOUR-US4-056
  Scenario: Find team members without sending invitations
    Given an isolated authenticated Clipify guide account
    When the editor discovery guide is followed
    Then editor discovery completes without inviting anyone

  @US1 @FR-001 @SC-004 @BDD-TOUR-US1-057
  Scenario: Reveal the next chapter without starting its optional tour
    Given an isolated authenticated Clipify guide account
    When the final first-overlay task is completed
    Then the checklist opens with personalization expanded and the finished chapter collapsed

  @US2 @FR-004 @SC-004 @BDD-TOUR-US2-058
  Scenario: Personalize filters style components and preview through native controls
    Given an isolated authenticated Clipify guide account
    When the complete personalization chapter is followed
    Then the playlist chapter is revealed without starting its tour

  @US1 @FR-009 @SC-004 @BDD-TOUR-US1-059
  Scenario: Keep the guide checkpoint while handling unsaved changes
    Given an isolated authenticated Clipify guide account
    When guided navigation opens the unsaved changes dialog
    Then Cancel restores the guide and Discard continues through normal navigation

  @US3 @FR-005 @SC-004 @BDD-TOUR-US3-060
  Scenario: Add selected clips directly without guide Continue
    Given an isolated authenticated Clipify guide account
    When selected clips are added directly from the search checkpoint
    Then the guide advances to arrangement and the playlist saves normally

  @US4 @FR-015 @SC-004 @BDD-TOUR-US4-061
  Scenario: Discover AI directly from the Team settings tab
    Given an isolated authenticated Clipify guide account
    When AI discovery starts from Team with a creator settings draft
    Then Connections opens directly and the creator draft is retained
