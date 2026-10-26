Feature: Runner attribution readability

  @BDD @US4 @FR-017 @BDD-US4-DEC011 @runner-readability-browser
  Scenario Outline: Fixed attribution remains readable on <background> frames at <width> pixels
    Given a Free Runner plays the <background> readability fixture
    When its owner opens the Runner appearance settings
    Then its actual attribution is readable on <background> frames at <width> pixels

    Examples:
      | background | width |
      | light      | 1920  |
      | dark       | 1920  |
      | busy       | 1920  |
      | light      | 360   |
      | dark       | 360   |
      | busy       | 360   |
