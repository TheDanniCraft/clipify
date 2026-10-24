Feature: Runner commercial expiry transitions

  @BDD @US5 @FR-022 @BDD-US5-FR022
  Scenario: Signed owner policy becomes Free while an accepted manual broadcast continues
    Given a creator with signed paid Runner access before a known expiry
    When the device refreshes its owner policy at expiry
    Then its verified owner policy requires Free presentation while its accepted manual generation continues

  @BDD @US5 @FR-022 @BDD-US5-FR022
  Scenario: Known benefit expiry blocks a delayed paid Start but preserves accepted manual output
    Given a creator with bounded Runner benefits and a newly signed manual Start
    When the known benefit deadline passes before its active acknowledgment arrives
    Then no new paid Start is authorized and the already accepted generation can acknowledge continuation

  @BDD @US5 @FR-022 @BDD-US5-FR022
  Scenario: Expiry keeps an active Scheduled window until its captured graceful end
    Given a Pro creator with an accepted active Scheduled window
    When Pro expires before the captured window ends
    Then the window stays active until its signed end and requests graceful drain at that end

  @BDD @US5 @FR-022 @BDD-US5-OPT075
  Scenario: All grandfathered outputs must close before Free admission is available
    Given a Pro creator with two active manual broadcasts
    When Pro expires and they close each broadcast in turn
    Then closing only the first broadcast keeps new Free admission blocked

  @BDD @US5 @EC-013 @BDD-US5-EC013
  Scenario: Existing manual broadcasts survive expiry while new admissions respect Free limits
    Given a Pro creator with two admitted manual broadcasts
    When their Pro access expires and entitlement reconciliation runs
    Then their existing broadcasts remain commanded online and a third broadcast is denied

  @BDD @US5 @FR-022 @BDD-US5-OPT073
  Scenario: Expiry without an active broadcast keeps Scheduled settings and allows basic manual broadcasting
    Given a Pro creator with saved Scheduled control and no active broadcasts
    When their Pro access expires before a new Scheduled Start
    Then the paid Start is denied and one basic manual broadcast remains available

  @BDD @US5 @FR-022 @BDD-US5-OPT074
  Scenario: One grandfathered broadcast retains the Free slot until its output closure is acknowledged
    Given a Pro creator with one active manual broadcast
    When Pro expires and they Stop that broadcast
    Then a matching closed-generation receipt releases it for one new Free broadcast

  @BDD @US5 @FR-022 @BDD-US5-FR022
  Scenario: Revocation before dispatch releases only the never-opened paid reservation
    Given a paid reservation whose Runner grant is revoked before first dispatch
    When the device requests its first execution permission after revocation
    Then it receives no paid permission and another basic manual admission is available

  @BDD @US5 @FR-022 @BDD-US5-FR022
  Scenario: Revocation after dispatch preserves uncertain output and a matching late acknowledgment
    Given a paid execution dispatched before Runner grant revocation
    When the device polls after revocation before acknowledging its accepted output
    Then the generation retains occupancy without a fresh permit and may acknowledge continuation

  @BDD @US5 @FR-022 @BDD-US5-FR022
  Scenario: Renewed access resumes a pending paid generation without duplicating Start
    Given a paid manual Start awaiting acknowledgment when its known benefit expires
    When Runner access is renewed and the same Start is retried
    Then fresh permission uses renewed validity and the original generation and captured history remain

  @BDD @US5 @FR-022 @BDD-US5-FR022
  Scenario: Healthy policy refresh preserves a month-long grant beyond the first snapshot horizon
    Given a Runner owner with a month-long benefit and a seven-day signed policy snapshot
    When their device refreshes policy before the first snapshot expires
    Then paid features continue beyond seven days and end at the original known benefit deadline
