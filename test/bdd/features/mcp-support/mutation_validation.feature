@BDD @ATDD
Feature: Reject invalid mutation inputs without partial changes
  @US2 @FR-012 @EC-013
  @BDD-US2-016
  Scenario Outline: The client submits the mutation — the request includes an unknown input field
    Given a <operation> request includes an unknown input field
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-017
  Scenario Outline: The client submits the mutation — the request includes an invalid identifier
    Given a <operation> request includes an invalid identifier
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-018
  Scenario Outline: The client submits the mutation — the request includes a wrong field type
    Given a <operation> request includes a wrong field type
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-019
  Scenario Outline: The client submits the mutation — the request includes an out-of-range value
    Given a <operation> request includes an out-of-range value
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-020
  Scenario: The client submits the mutation — the request includes an invalid playlist item reference
    Given the request includes an invalid playlist item reference
    When the client submits the mutation
    Then an invalid-input error is returned and no partial change occurs

  @US2 @FR-012 @EC-013
  @BDD-US2-021
  Scenario: The client submits the mutation — the request includes a non-permutation playlist reorder
    Given the request includes a non-permutation playlist reorder
    When the client submits the mutation
    Then an invalid-input error is returned and no partial change occurs
