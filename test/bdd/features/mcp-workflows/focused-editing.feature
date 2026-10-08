@BDD @ATDD @WF-US8 @FR-FE-001 @focused-editing
Feature: Focused MCP editing preserves unrelated configuration
  AI apps can discover and change a specific editing area without resubmitting other settings.

  Scenario: Theme Studio editing preserves overlay configuration
    Given an AI app is authorized to edit an overlay theme
    When it changes only the overlay text color
    Then the theme revision advances and the overlay name, filters and playback remain unchanged

  Scenario: Gallery layout editing preserves the theme
    Given an AI app is authorized to edit a gallery layout
    When it changes only the gallery layout
    Then the layout revision advances and the gallery name and theme remain unchanged

  Scenario Outline: Editing areas reject unrelated fields
    When an AI app submits a cross-area patch to "<tool>"
    Then the focused tool rejects the patch without changing either resource
    Examples:
      | tool                    |
      | update_overlay_theme    |
      | update_overlay_filters  |
      | update_gallery_layout   |
      | update_gallery_theme    |
