Feature: Runner attribution avoids theme decorations

  @BDD @US4 @FR-017 @BDD-US4-DEC012 @runner-decoration-browser
  Scenario: A clip panel shadow keeps its required attribution clearance
    Given a branded Runner previews a Pro clip panel above its bottom-left preference
    When its owner opens the Runner appearance settings
    Then the preview and generated attribution clear the actual themed shadow

  @BDD @US4 @FR-017 @BDD-US4-DEC012 @runner-decoration-browser
  Scenario: Progress and corner panels leave a safe attribution edge
    Given a branded Runner previews all corner panels and its progress bar
    When its owner opens the Runner appearance settings
    Then the preview and generated attribution clear all panels and progress
