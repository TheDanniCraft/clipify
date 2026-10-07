@mcp @US2 @atdd @playlist-drag-ui
Feature: Browser playlist drag keeps the intended shared resource revision
  Scenario: Dropping a clip keeps its previewed order until the owner saves
    Given a native playlist editor contains two saved clips for dragging
    When the owner drags the first clip below the second and drops it
    Then the changed clip order can be saved and survives reloading

  Scenario: Overlay playlist management opens the actual owned editor
    Given a native playlist editor contains two saved clips for dragging
    When the owner follows Manage from the linked overlay settings
    Then the owned playlist editor shows its saved name and both clips

  Scenario: Quick playlist edits stay in the overlay settings
    Given a native playlist editor contains two saved clips for dragging
    When the owner opens quick editing from the linked overlay settings
    Then the owned playlist opens in an inline dialog without leaving overlay settings

  Scenario: Quick playlist drag preserves the saved item order
    Given a native playlist editor contains two saved clips for dragging
    When the owner opens quick editing from the linked overlay settings
    And the owner drags the first clip below the second and drops it
    Then the quick-edited order saves and appears in the full playlist editor
