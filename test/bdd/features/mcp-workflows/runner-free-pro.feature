Feature: Free Runner registration

  @BDD @US1 @FR-001 @BDD-US1-FR001
  Scenario: A Free creator registers a second device without a purchase
    Given an authenticated Free Runner creator
    When they register two Runner devices through MCP
    Then both Runner devices remain registered without a purchase

  @BDD @US1 @FR-001 @BDD-US1-OPT001
  Scenario: A Free creator registers devices with no paid benefit
    Given a Runner creator with "free" access
    When they register two Runner devices through MCP
    Then both Runner devices remain registered without a purchase

  @BDD @US1 @FR-001 @BDD-US1-OPT002
  Scenario: A creator with pro access registers Runner devices
    Given a Runner creator with "pro" access
    When they register two Runner devices through MCP
    Then both Runner devices remain registered without a purchase

  @BDD @US1 @FR-001 @BDD-US1-OPT003
  Scenario: A creator with legacy access registers Runner devices
    Given a Runner creator with "legacy" access
    When they register two Runner devices through MCP
    Then both Runner devices remain registered without a purchase

  @BDD @US1 @FR-001 @BDD-US1-OPT004
  Scenario: A creator with agency access registers Runner devices
    Given a Runner creator with "agency" access
    When they register two Runner devices through MCP
    Then both Runner devices remain registered without a purchase

  @BDD @US1 @FR-001 @BDD-US1-OPT005
  Scenario: A creator with trial access registers Runner devices
    Given a Runner creator with "trial" access
    When they register two Runner devices through MCP
    Then both Runner devices remain registered without a purchase

  @BDD @US1 @EC-003 @BDD-US1-EC003
  Scenario: An operator without Runner control permission cannot start edit or stop a broadcast
    Given an operator without Runner control permission
    When they start edit or stop the runner
    Then the operation is rejected without changing the broadcast

  @BDD @US1 @EC-001 @BDD-US1-EC001
  Scenario: Concurrent dashboard and MCP starts reserve one Free owner broadcast
    Given two supported devices belong to one Free Runner creator
    When dashboard and MCP request a start concurrently
    Then one start is accepted and the other explains the Free owner limit

  @BDD @US1 @FR-002 @BDD-US1-FR002
  Scenario: An active Free clip broadcast prevents fallback on a second device
    Given a Free Runner creator with an active clip broadcast
    When they start live fallback on another Runner device
    Then the owner limit is explained and the active clip broadcast is unchanged

  @BDD @US1 @FR-002 @BDD-US1-OPT006
  Scenario: Clip playback occupies the Free owner broadcast slot
    Given a Free Runner creator already broadcasting in "Clip playback"
    When a second Runner device requests a start
    Then the existing broadcast remains and the owner limit is explained

  @BDD @US1 @FR-002 @BDD-US1-OPT007
  Scenario: Live fallback forwarding live input occupies the Free owner broadcast slot
    Given a Free Runner creator already broadcasting in "Live fallback forwarding live input"
    When a second Runner device requests a start
    Then the existing broadcast remains and the owner limit is explained

  @BDD @US1 @FR-002 @BDD-US1-OPT008
  Scenario: Live fallback playing clips occupies the Free owner broadcast slot
    Given a Free Runner creator already broadcasting in "Live fallback playing clips"
    When a second Runner device requests a start
    Then the existing broadcast remains and the owner limit is explained

  @BDD @US1 @FR-002 @BDD-US1-OPT009
  Scenario: Live fallback showing standby occupies the Free owner broadcast slot
    Given a Free Runner creator already broadcasting in "Live fallback showing standby"
    When a second Runner device requests a start
    Then the existing broadcast remains and the owner limit is explained

  @BDD @US1 @FR-003 @BDD-US1-FR003
  Scenario: A Pro operator follows the Free creator's broadcast limit
    Given a Pro operator managing a Free creator with an occupied broadcast slot
    When the Pro operator starts another broadcast for that creator
    Then the Free creator's limit applies without changing the broadcast

  @BDD @US1 @FR-002 @BDD-US1-OPT087
  Scenario: A start rejected before output leaves the Free slot available
    Given a Free creator whose first device lacks required destination credentials
    When that start fails and they start on another configured device
    Then the second device is accepted without an occupied slot from the failed start

  @BDD @US1 @FR-003 @BDD-US1-OPT082
  Scenario: An operator without permission cannot request start
    Given a read-only Runner operator requesting "start"
    When they submit that protected Runner command
    Then the protected command is denied without configuration or successful audit writes

  @BDD @US1 @FR-003 @BDD-US1-OPT083
  Scenario: An operator without permission cannot request stop
    Given a read-only Runner operator requesting "stop"
    When they submit that protected Runner command
    Then the protected command is denied without configuration or successful audit writes

  @BDD @US1 @FR-003 @BDD-US1-OPT084
  Scenario: An operator without permission cannot request destination
    Given a read-only Runner operator requesting "destination"
    When they submit that protected Runner command
    Then the protected command is denied without configuration or successful audit writes

  @BDD @US1 @EC-002 @BDD-US1-EC002
  Scenario: An offline unconfirmed broadcast retains the Free slot with recovery guidance
    Given a Free creator whose broadcasting Runner went offline without confirming shutdown
    When they request a start from another online Runner
    Then the occupied slot is retained and reconnect guidance is shown

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC002
  Scenario: A revoked credential can only acknowledge its closed-output generation
    Given an offline active device is unlinked or deleted
    When its old token attempts heartbeat then submits its matching closed-output terminal ACK
    Then heartbeat and renewal are denied, terminal-only ACK succeeds and frees only its generation

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC002
  Scenario: A retired device credential cannot acknowledge another generation
    Given an offline active device is unlinked or deleted
    When its old token submits a receipt for a different generation before its matching receipt
    Then the unmatched receipt keeps occupancy and only the matching receipt reconciles

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC002
  Scenario: A repeated old receipt leaves the replacement generation running
    Given an offline active device is unlinked or deleted
    When its receipt is replayed after a replacement generation starts for the same session
    Then only the old generation is reconciled and the new attempt is unchanged

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: A supported Free claim can recover only after its issued deadline and drain margin
    Given a Free broadcast with a persisted supported execution lease
    When another Runner requests Start exactly at final lease expiry plus 305 seconds
    Then its old generation is recovered and exactly one replacement is admitted

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: A supported Free claim remains occupied one millisecond before recovery
    Given a Free broadcast with a persisted supported execution lease
    When another Runner requests Start one millisecond before final lease expiry plus 305 seconds
    Then the old generation retains the slot and recovery guidance is returned

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-EC002
  Scenario: A legacy broadcast without an admission record still occupies its Free owner slot
    Given an offline old Runner broadcasting from before admission records existed
    When another device requests Start during the legacy rollout
    Then the unleased legacy claim is retained and the replacement is rejected with guidance

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-EC002
  Scenario: Stopping an untracked pending legacy attempt cannot manufacture a closed-output acknowledgment
    Given a legacy pending Start with old stopped telemetry and no admission record
    When its owner requests Stop then tries Start on another device
    Then its uncertain generation drains without releasing the slot or applying the replacement

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC002
  Scenario: Unlinking a pre-admission device preserves its original terminal reconciliation
    Given an offline legacy broadcast with no admission record
    When the owner unlinks its device then requests Start elsewhere
    Then its unleased draining tombstone retains the former terminal credential and blocks replacement

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC002
  Scenario: Deleting a pre-admission device cannot erase terminal reconciliation
    Given an offline legacy broadcast with no admission record
    When the owner deletes its device then requests Start elsewhere
    Then the deleted device leaves an unleased draining tombstone and its original terminal credential

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-EC002
  Scenario: Stop then Start cannot revive a dispatched generation before output closure
    Given a dispatched Runner attempt whose owner has requested Stop
    When the owner requests Start for that same session before shutdown acknowledgment
    Then the draining generation and stopped intent remain unchanged until closure

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: Free dispatch persists a signed generation-bound lease before sending the assignment
    Given a Free owner with one accepted reserved broadcast and a supported lease client
    When the device requests its first authenticated signed lease assignment
    Then the committed generation and 300 second deadline match its valid signed permit

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: Authenticated renewal commits a later deadline for the same Free generation
    Given a Free owner with one accepted reserved broadcast and a supported lease client
    When its device renews with a fresh nonce before the current lease expires
    Then its renewed signed permit matches the stored deadline and original generation

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: A matching generation acknowledgment applies running state without reallocating output
    Given a Free owner with one accepted reserved broadcast and a supported lease client
    When the assigned device acknowledges its dispatched lease generation as active
    Then only that admitted generation and session become applied running

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: A matching all-outputs-closed acknowledgment releases only its execution
    Given a Free owner with one accepted reserved broadcast and a supported lease client
    When its assigned device confirms all outputs closed for the exact lease generation
    Then that generation is terminal and no output credentials or occupied slot remain

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario Outline: An invalid terminal report cannot release another execution
    Given a Free owner with one accepted reserved broadcast and a supported lease client
    When a closed-output report has invalid "<field>" authority
    Then the valid broadcast keeps its occupied slot and original state

    Examples:
      | field                 |
      | admissionId           |
      | sessionId             |
      | executionGeneration   |
      | leaseId               |
      | configurationRevision |
      | allOutputsClosed      |
      | other_device          |
      | foreign_owner         |

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario Outline: Renewal honors the exact expiry boundary without releasing uncertain output
    Given a Free owner with one accepted reserved broadcast and a supported lease client
    When its device requests renewal "<boundary>" the exact lease expiry
    Then expired output cannot renew or free occupancy and a valid lease alone permits output

    Examples:
      | boundary |
      | before   |
      | at       |
      | after    |

  @BDD @US1 @FR-002 @EC-002 @BDD-US1-DEC001
  Scenario: An old authenticated terminal report cannot stop a newer same-device broadcast
    Given a Free owner with one accepted reserved broadcast and a supported lease client
    When the same device replays a closed generation report after a new generation is active
    Then the new broadcast remains running with its current generation and occupied slot

  @BDD @US1 @FR-003 @BDD-US1-OPT085
  Scenario: A read-only operator cannot edit a Runner schedule
    Given an authenticated read-only Runner schedule operator
    When they submit a schedule edit through the authenticated Server Action
    Then schedule editing is denied without changing Runner state or recording a successful mutation

  @BDD @ATDD @US1 @FR-003 @BDD-US1-OPT086
  Scenario: An authenticated operator without permission cannot edit standby appearance
    Given an operator without the required standby editing permission
    When they request edit standby
    Then standby appearance remains unchanged after the authenticated denial
