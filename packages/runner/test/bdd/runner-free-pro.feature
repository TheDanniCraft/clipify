Feature: Free Runner and Pro native broadcasting
  @BDD @US2 @EC-005 @BDD-US2-EC005
  Scenario: All unavailable outputs exhaust their bounded retries
    Given a broadcast sending to two real receivers
    When every receiver becomes unavailable and remains unavailable
    Then each destination reports failed after bounded retries

  @BDD @US2 @FR-008 @BDD-US2-OPT092
  Scenario: A recovered destination rejoins independently
    Given two real receivers receiving the same encoded broadcast
    When a disconnected receiver becomes available again
    Then that output reconnects and the healthy output is never restarted

  @BDD @US2 @FR-008 @BDD-US2-FR008
  Scenario: A failed destination retries while the healthy destination keeps receiving
    Given two real loopback receivers receiving a shared encoded broadcast
    When one receiver disconnects
    Then its status is retrying and the healthy receiver continues receiving media

  @BDD @US1 @FR-004 @BDD-US1-FR004
  Scenario: Manual stop finishes the current generated clip
    Given a manual broadcast playing a generated clip
    When the owner requests stop while the clip is playing
    Then the current clip completes, no next clip starts, and all native outputs close

  @BDD @US1 @FR-004 @BDD-US1-FR004
  Scenario: Explicit Stop now interrupts the playing clip
    Given a manual broadcast playing a generated clip
    When the owner explicitly requests Stop now
    Then the current clip is interrupted and all native outputs close

  @BDD @US1 @FR-023 @BDD-US1-FR023
  Scenario: Connected Free playback continues across a month after extended streaming
    Given a Free execution keeps receiving fresh valid leases
    When connected execution time passes a calendar month boundary
    Then real encoded playback continues without a usage warning or a quota-driven stop

  @BDD @US3 @EC-007 @BDD-US3-EC007
  Scenario: The native calendar planner explains a skipped spring-forward boundary
    Given a weekly Berlin event with a boundary in the clock-change gap
    When the native calendar planner evaluates the cached date range
    Then it reports a visible skip reason and keeps the following week's local time

  @BDD @US3 @EC-008 @BDD-US3-EC008
  Scenario: The native calendar planner resolves a repeated local boundary once
    Given a Berlin event in the repeated fall-back hour
    When the native calendar planner evaluates that date
    Then it selects only the first instant

  @BDD @US3 @FR-012 @BDD-US3-FR012
  Scenario: A protected cached event executes locally without control connectivity
    Given a running local Runner with a signed protected future event cache
    When the control connection disconnects before its original start
    Then the event starts locally and finishes its current encoded clip at the original end

  @BDD @US3 @EC-009 @BDD-US3-EC009 @BDD-US3-OPT076
  Scenario: An unresponsive current clip reaches the no-progress watchdog
    Given a real generated broadcast is playing a clip
    When the clip stops progressing for sixty seconds during finishing
    Then every output closes and playback timeout is reported

  @BDD @US3 @OPT-077 @BDD-US3-OPT077
  Scenario: Progressing playback cannot extend finishing beyond five minutes
    Given a generated broadcast with a long progressing current clip
    When the finishing overrun reaches five minutes
    Then every output closes and playback timeout is reported

  @BDD @US3 @OPT-038 @BDD-US3-OPT038
  Scenario: A following clip can start before the scheduled end
    Given cached scheduled playback inside its original window
    When the current clip completes before that window ends
    Then the following clip starts and finishes when the original end requests drain

  @BDD @US3 @OPT-039 @BDD-US3-OPT039
  Scenario: Clip completion exactly at event end queues no following clip
    Given real media whose current clip completes at the original event boundary
    When that completion happens between native watchdog ticks
    Then the player refuses next-clip advancement and every output closes

  @BDD @US3 @OPT-041 @BDD-US3-OPT041
  Scenario: An active standby ends when its scheduled window closes
    Given a signed scheduled broadcast currently showing standby without a playing clip
    When the original window ends
    Then capture and output close without waiting for a clip or reporting playback timeout


  @BDD @US3 @FR-014 @BDD-US3-FR014 @BDD-US3-OPT048
  Scenario: A different adjacent target starts after the current clip completes
    Given signed cached adjacent events with different destinations and a playing clip
    When the first original window ends before its current clip completes
    Then its final frame is encoded before the following active window opens its output


  @BDD @US3 @FR-014 @BDD-US3-OPT049
  Scenario: A following window expires while the earlier clip finishes
    Given adjacent signed events whose following window ends before the earlier clip completes
    When the earlier clip completes and all its output resources close
    Then the expired following occurrence is closed unused without activating capture or output


  @BDD @US3 @FR-014 @BDD-US3-OPT046 @BDD-US3-DEC010
  Scenario: Matching events continue across the Sunday midnight week boundary
    Given separately signed adjacent events with identical source and actual destinations
    When Sunday midnight passes during the original current clip
    Then that playback advances with the same capture and encoder without reconnecting or falsely closing its occurrence

  @BDD @US3 @FR-014 @BDD-US3-OPT047
  Scenario: A different source starts after the earlier clip completes
    Given adjacent signed cached events with different overlay sources and destinations
    When the first original window ends during its current clip
    Then the first final frame and physical closure precede loading the following active source and opening its output

  @BDD @US3 @EC-010 @BDD-US3-EC010
  Scenario: Manual Stop remains authoritative inside the cached current occurrence
    Given an active signed cached schedule whose current clip is playing
    When its owner stops the occurrence before its original scheduled end
    Then the clip finishes and outputs close while subsequent real watchdog checks do not restart that occurrence

  @BDD @US3 @EC-010 @BDD-US3-EC010
  Scenario: A fresh signed Pause snapshot removes an unstarted cached continuation
    Given a running current event and a separately signed matching adjacent future window
    When the real watchdog restores an accepted newer signed snapshot with no future automatic starts
    Then current playback remains live until its original end and closes after its current clip without activating the removed future membership


  @BDD @US3 @FR-015 @BDD-US3-FR015 @BDD-US3-OPT045
  Scenario: A cold Runner process resumes the remaining captured window once
    Given real scheduled capture stopped with a persisted active journal and valid signed cache
    When a new Node process restores the same device journal and cache inside the original window
    Then one real capture and encoder produce fresh output under the same generation and original end through repeated watchdog checks


  @BDD @US3 @FR-015 @BDD-US3-OPT042 @BDD-US3-OPT089
  Scenario: Offline return starts the next weekly occurrence without replaying its stopped predecessor
    Given the prior occurrence was manually stopped and the next signed weekly window was cached before going offline
    When a cold Runner process returns inside that later occurrence's original bounds
    Then fresh encoded output starts once for that new occurrence while its predecessor remains stopped and suppressed


  @BDD @US3 @FR-015 @BDD-US3-OPT043
  Scenario Outline: A cold return skips an ended cached occurrence
    Given valid signed future authority was saved before the Runner went offline
    When a cold process returns <boundary> the original event end
    Then the cache remains valid but unused authority closes without constructing any output pipeline

    Examples:
      | boundary   |
      | exactly at |
      | just after |


  @BDD @US3 @FR-015 @BDD-US3-OPT044
  Scenario: A soft control failure preserves already accepted local playback
    Given signed cached playback is already producing real encoded output
    When the actual heartbeat endpoint returns HTTP 503
    Then local media continues and its original end still finishes the clip with no successor and closed outputs
