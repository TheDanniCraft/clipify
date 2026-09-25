@BDD @ATDD
Feature: Local legal and privacy center
  As a visitor
  I want Clipify's legal navigation to stay on Clipify-controlled pages
  So that I can review the applicable information without relying on GoAdopt

  @ATDD-US1-001 @A1 @US1 @FR-001 @FR-002 @SC-001 @SC-002
  Scenario: A visitor reaches every local legal destination
    Given a visitor is on a public Clipify page
    When they inspect the legal navigation
    Then every required legal destination is hosted by Clipify and available

  @ATDD-US2-002 @A2 @US1 @FR-004 @FR-005 @FR-006 @FR-007 @SC-006
  Scenario: A visitor reviews a complete service disclosure
    Given a visitor opens the cookie policy
    When they inspect the "Sentry Session Replay" service declaration
    Then its purpose, data, storage, recipient, retention, consent, and transfer information are shown

  @ATDD-US1-001 @A3 @US1 @FR-003 @SC-009
  Scenario: Legal information remains accessible on a narrow viewport
    Given a visitor opens the privacy policy at a 320 pixel viewport
    When they inspect its semantic and keyboard navigation
    Then the legal document remains readable and every legal destination is keyboard reachable

  @ATDD-US2-001 @A4 @US2 @FR-006 @FR-007 @FR-011 @SC-003
  Scenario: The cookie policy exposes every consent category and service
    Given a visitor opens the cookie policy
    When they inspect the complete consent inventory
    Then every declared category and service is disclosed with its operating details

  @ATDD-US2-003 @A5 @US2 @FR-009 @SC-002 @SC-004
  Scenario: A visitor opens existing cookie preferences from the legal page
    Given a visitor opens the cookie policy
    When they activate cookie preferences from the legal document
    Then the existing privacy preferences dialog opens without leaving the cookie policy

  @ATDD-US1-002 @ATDD-US2-004 @A6 @US2 @EC-001 @EC-004 @SC-004
  Scenario: Legal disclosures survive an unavailable consent backend
    Given the consent backend is unavailable
    When a visitor opens the cookie policy
    Then the complete disclosures remain readable without claiming a saved preference

  @ATDD-US3-001 @A7 @US3 @FR-014 @FR-015 @SC-007
  Scenario: A visitor can understand the complete privacy-request process
    Given a visitor opens the privacy-request page
    When they inspect the rights and response guidance
    Then supported rights, verification, response stages, and complaint options are shown

  @ATDD-US3-001 @A8 @US3 @FR-014 @FR-015 @SC-007
  Scenario: A person without an account can start a privacy request
    Given a visitor opens the privacy-request page
    When they inspect the no-account contact route
    Then an accessible durable email route is available without signing in

  @ATDD-US3-001 @A9 @US3 @EC-006 @EC-007
  Scenario: Privacy-rights outcomes remain legally qualified
    Given a visitor opens the privacy-request page
    When they inspect applicability and lawful limits
    Then no right, timeline, or outcome is promised unconditionally

  @ATDD-US4-001 @A10 @US4 @FR-018 @FR-019 @SC-005
  Scenario: Undeclared browser behavior blocks release
    Given a reviewed browser inventory declaration
    When an undeclared storage key and external origin are observed
    Then the browser-backed audit reports the changes and fails the release gate

  @ATDD-US4-002 @A11 @US4 @FR-017 @EC-005 @SC-008
  Scenario Outline: Material processing changes require a recorded policy decision
    When the reviewed "<change>" is classified
    Then "<change>" requires a version review and a recorded consent or notice decision

    Examples:
      | change             |
      | broadened-purpose  |
      | new-recipient      |
      | legal-basis-change |
      | category-move      |

  @ATDD-US1-003 @A12 @US4 @FR-008 @EC-003
  Scenario: The cookie policy does not expose current-device storage values
    Given an approved local storage name contains a private value
    When a visitor opens the cookie policy
    Then the policy keeps the declared inventory authoritative without exposing the private value

  @ATDD-US3-002 @US3 @FR-016
  Scenario: A prospective user can review the complete service terms
    Given a visitor opens the terms of service
    When they inspect account, paid-plan, and self-hosted Runner terms
    Then the complete contractual topics are available before commitment

  @ATDD-US4-003 @US4 @FR-020
  Scenario: Incomplete legal metadata blocks publication
    Given a policy release with missing mandatory metadata
    When the publication gate validates the release
    Then publication is rejected with an actionable metadata error

  @ATDD-US4-004 @US4 @FR-021 @FR-022
  Scenario: The published legal set keeps its reviewed regional scope
    Given the reviewed legal scope and provenance
    When a visitor reviews the published document set
    Then it is one English EU and German baseline set without a worldwide compliance promise
