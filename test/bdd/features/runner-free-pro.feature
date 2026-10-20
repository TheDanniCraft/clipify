@BDD @US1 @runner-manual-browser
Feature: Manual Runner configuration

  @FR-005 @BDD-US1-FR005
  Scenario: A Free creator configures manual live fallback without scheduling
    Given a Free creator is configuring a local Runner in the browser
    When they choose Live fallback with Manual control and save its destination
    Then the browser retains manual fallback and keeps scheduling unavailable

  @FR-002 @BDD-US1-FR002
  Scenario: A denied second Start explains the occupied Free slot
    Given a Free creator is configuring a local Runner in the browser
    When they choose Live fallback with Manual control and save its destination
    And another Runner already occupies their Free broadcast slot
    And they request Start for this Runner
    Then the browser explains the denied Start and this broadcast remains stopped

  @US2 @FR-008 @BDD-US2-FR008
  Scenario: Destination status remains independent in the browser
    Given a Free creator is configuring a local Runner in the browser
    When they choose Live fallback with Manual control and save its destination
    And their Pro broadcast reports one retrying and one live destination
    Then the browser shows each named destination's own status

  @US3 @FR-011 @BDD-US3-DEC004 @runner-schedule-browser
  Scenario: A moved one-time event keeps its logical occurrence identity
    Given a Pro creator is authoring a Runner schedule in the browser
    When they save a one-time event and move its future start and end
    Then the saved event and occurrence identities remain stable across the edit

  @US3 @FR-011 @BDD-US3-DEC005 @runner-schedule-browser
  Scenario: A vacation event spans weeks without clipping its saved end
    Given a Pro creator is authoring a Runner schedule in the browser
    When they save a Monday to next Wednesday vacation event
    Then the explicit dates survive reload and the active rolling cache retains the full end

  @US3 @FR-011 @BDD-US3-DEC006 @runner-schedule-browser
  Scenario Outline: All-day events respect actual local calendar-day duration
    Given a Pro creator is authoring a Runner schedule in the browser
    When they save an all-day Berlin event on "<date>"
    Then its saved elapsed duration is <hours> hours
    Examples:
      | date       | hours |
      | 2026-03-29 | 23    |
      | 2026-10-25 | 25    |

  @US3 @FR-011 @BDD-US3-FR011 @runner-schedule-browser
  Scenario Outline: Schedule choices persist at the browser boundary
    Given a Pro creator is authoring a Runner schedule in the browser
    When they save a "<recurrence>" event with its timezone source and destinations
    Then the saved schedule choices survive a browser reload
    @BDD-US3-OPT030
    Examples: One time
      | recurrence |
      | once       |
    @BDD-US3-OPT031
    Examples: Weekly
      | recurrence |
      | weekly     |

  @US3 @FR-011 @EC-006 @BDD-US3-EC006 @runner-schedule-browser
  Scenario Outline: Invalid edits preserve the saved schedule
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit a schedule with "<invalid>"
    Then the schedule boundary is "rejected" without changing a previously saved event
    @BDD-US3-OPT032
    Examples: End before start
      | invalid          |
      | end before start |
    @BDD-US3-OPT033
    Examples: Equal bounds
      | invalid      |
      | equal bounds |
    @BDD-US3-OPT034
    Examples: No source
      | invalid        |
      | missing source |
    @BDD-US3-OPT035
    Examples: No targets
      | invalid         |
      | missing targets |
    @BDD-US3-OPT036
    Examples: Invalid timezone
      | invalid          |
      | invalid timezone |

  @US3 @FR-011 @BDD-US3-OPT090 @runner-schedule-browser
  Scenario: A saved timed event crosses midnight in its declared timezone
    Given a Pro creator is authoring a Runner schedule in the browser
    When they save a timed Berlin event across midnight
    Then the saved midnight boundaries survive reload

  @US3 @FR-011 @BDD-US3-OPT091 @runner-schedule-browser
  Scenario: A future weekly event can change timezone while preserving its previous series
    Given a Pro creator is authoring a Runner schedule in the browser
    When they change a saved future weekly event timezone
    Then its future timezone changes while its previous series is preserved

  @US3 @FR-011 @EC-011 @BDD-US3-EC011 @runner-schedule-browser
  Scenario: A failed database save keeps the previously saved schedule authoritative
    Given a Pro creator is authoring a Runner schedule in the browser
    When storage rejects an edit to a saved schedule
    Then the browser reports the save failure and retains the prior saved schedule

  @US3 @FR-010 @FR-011 @BDD-US3-DEC009 @runner-agenda-browser
  Scenario: Mobile day navigation preserves a multi-week event's true dates
    Given a Pro creator is authoring a Runner schedule in the browser
    When they open a multi-week vacation schedule on a mobile calendar
    Then its day segments retain one event with editable true start and end dates

  @US3 @FR-010 @FR-011 @BDD-US3-DEC009 @runner-agenda-browser
  Scenario: Desktop week segments follow the installed calendar locale
    Given a Pro creator is authoring a Runner schedule in the browser
    When they view a vacation spanning the first day of a desktop week
    Then the first displayed day retains its vacation segment

  @US3 @FR-010 @BDD-US3-FR010 @BDD-US3-OPT020 @runner-agenda-browser
  Scenario: Pointer creation opens equivalent explicit schedule controls
    Given a Pro creator is authoring a Runner schedule in the browser
    When they drag an empty calendar range from eighteen to twenty
    Then the explicit editor persists the selected pointer calendar range

  @US3 @FR-010 @FR-011 @FR-015 @BDD-US3-DEC007 @runner-agenda-browser
  Scenario: An active scheduled occurrence is visibly locked for editing
    Given a Pro creator is authoring a Runner schedule in the browser
    And their scheduled occurrence is inside its original active window
    Then its schedule editor is locked while broadcast controls remain available

  @US3 @FR-010 @FR-011 @FR-015 @BDD-US3-DEC007 @runner-agenda-browser
  Scenario: Output drain keeps an ended occurrence locked
    Given a Pro creator is authoring a Runner schedule in the browser
    And their scheduled occurrence is inside its original active window
    And that window ended while its captured output is still draining
    Then its schedule stays locked until the draining outputs close

  @US3 @FR-010 @runner-agenda-browser
  Scenario Outline: A future schedule can be deleted with an explicit confirmation
    Given a Pro creator is authoring a Runner schedule in the browser
    When they open a saved future schedule using "<interaction>"
    Then they can confirm its deletion using "<interaction>" without deleting its source or targets
    @BDD-US3-OPT028
    Examples: Pointer
      | interaction |
      | pointer     |
    @BDD-US3-OPT029
    Examples: Keyboard
      | interaction |
      | keyboard    |

  @US3 @FR-010 @runner-agenda-browser
  Scenario Outline: Moving a schedule retains its logical identity
    Given a Pro creator is authoring a Runner schedule in the browser
    When they move a saved future interval one hour using "<interaction>"
    Then they can save its full moved interval using "<interaction>" with the same event identity
    @BDD-US3-OPT022
    Examples: Pointer
      | interaction |
      | pointer     |
    @BDD-US3-OPT023
    Examples: Keyboard
      | interaction |
      | keyboard    |

  @US3 @FR-010 @runner-agenda-browser
  Scenario Outline: Resizing a schedule preserves its real start
    Given a Pro creator is authoring a Runner schedule in the browser
    When they extend a future schedule by one hour using "<interaction>"
    Then they can save its extended end using "<interaction>" while retaining its start and identity
    @BDD-US3-OPT024
    Examples: Pointer
      | interaction |
      | pointer     |
    @BDD-US3-OPT025
    Examples: Keyboard
      | interaction |
      | keyboard    |

  @US3 @FR-010 @FR-011 @BDD-US3-DEC009 @runner-agenda-browser
  Scenario: A continuation segment exposes full dates instead of a clipped resize end
    Given a Pro creator is authoring a Runner schedule in the browser
    When they view a vacation spanning the first day of a desktop week
    Then the continuation has no resize end and its full end date can be edited by keyboard

  @US3 @FR-010 @BDD-US3-OPT021 @runner-agenda-browser
  Scenario: A schedule can be created with keyboard activation of the explicit editor
    Given a Pro creator is authoring a Runner schedule in the browser
    When they create a future schedule through keyboard form controls
    Then the keyboard-authored schedule retains its selected dates source and targets

  @US3 @FR-010 @runner-agenda-browser
  Scenario Outline: Metadata editing retains the event interval
    Given a Pro creator is authoring a Runner schedule in the browser
    When they rename a saved future schedule using "<interaction>"
    Then the renamed schedule is saved using "<interaction>" with its original bounds and source
    @BDD-US3-OPT026
    Examples: Pointer
      | interaction |
      | pointer     |
    @BDD-US3-OPT027
    Examples: Keyboard
      | interaction |
      | keyboard    |

  @US3 @FR-010 @BDD-US3-DEC009 @runner-agenda-browser
  Scenario Outline: An ambiguous gesture explains the explicit full-event editor
    Given a Pro creator is authoring a Runner schedule in the browser
    When they drag an event with "<ambiguity>"
    Then the full-event editor explains why the gesture needs explicit dates and times
    Examples:
      | ambiguity          |
      | weekly recurrence  |
      | different timezone |

  @US3 @FR-010 @FR-011 @FR-015 @BDD-US3-DEC008 @runner-agenda-browser
  Scenario: Re-enabling scheduling catches up inside the original window
    Given a Pro creator is authoring a Runner schedule in the browser
    And their scheduled occurrence is inside its original active window
    And its previous captured execution is fully closed after a manual stop
    When they re-enable scheduling for the stopped occurrence
    Then a new generation retains Scheduled mode and the original end without claiming output is already live

  @US3 @FR-010 @FR-011 @FR-015 @BDD-US3-DEC008 @runner-agenda-browser @runner-schedule-stop-browser
  Scenario Outline: Stop suppresses the captured occurrence and switches to Manual control
    Given a Pro creator is authoring a Runner schedule in the browser
    And their scheduled occurrence is inside its original active window
    And its previous captured execution is fully closed after a manual stop
    And its captured scheduled execution is "<state>"
    When they request a graceful scheduled Stop
    Then this occurrence is durably suppressed and its original window remains locked
    Examples:
      | state    |
      | active   |
      | reserved |

  @US3 @FR-014 @BDD-US3-OPT037 @runner-schedule-browser
  Scenario: Overlapping schedule changes preserve the existing event
    Given a Pro creator is authoring a Runner schedule in the browser
    When they submit an event overlapping an existing saved event
    Then the overlap explanation appears and the original schedule remains authoritative after reload

  @US4 @FR-018 @BDD-US4-FR018 @runner-presentation-browser @runner-pro-appearance-browser
  Scenario: A Pro owner chooses a clean generated presentation
    Given a Pro Runner has an active broadcast with playable clips
    When its owner opens the Runner appearance settings
    Then choosing branding off persists clean preview and generated playback

  @US4 @FR-018 @BDD-US4-OPT093 @runner-presentation-browser @runner-pro-appearance-browser
  Scenario: A Pro owner voluntarily shows Clipify branding
    Given a Pro Runner has an active broadcast with playable clips
    When its owner opens the Runner appearance settings
    Then choosing branding on persists branded preview and generated playback

  @US4 @FR-018 @FR-022 @BDD-US4-EXP001 @runner-presentation-browser @runner-pro-appearance-expiry-browser
  Scenario: Known Pro expiry restores branding without interrupting the playing clip
    Given a Pro Runner has an active broadcast with playable clips
    When its admitted paid deadline is reached during generated playback
    Then required branding returns while its original clip and execution keep running

  @US4 @FR-018 @FR-022 @BDD-US4-EXP001 @runner-presentation-browser @runner-pro-appearance-expiry-browser
  Scenario: Renewed Pro stays clean beyond its former appearance deadline
    Given a Pro Runner has an active broadcast with playable clips
    When its admitted paid deadline is reached during generated playback
    And its owner renews Pro before that deadline
    Then its original clip stays clean beyond the former deadline
