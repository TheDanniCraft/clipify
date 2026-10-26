@mode:serial
Feature: Runner multistream delivery

  @BDD @US2 @FR-006 @BDD-US2-FR006
  Scenario: A Pro broadcast delivers one capture to YouTube and Twitch
    Given a Pro creator selects saved YouTube and Twitch destinations
    When their Runner broadcasts a clip and they request a graceful stop
    Then both destinations receive the complete clip from one capture and encoder

  @BDD @US2 @FR-007 @BDD-US2-FR007
  Scenario: Two Pro devices broadcast independently at the same time
    Given a Pro creator starts independent broadcasts on two Runner devices
    When both devices play their clips and receive a graceful stop
    Then both independent broadcasts finish their clips and close their own outputs

  @BDD @US2 @FR-006
  Scenario Outline: A selected provider receives the complete broadcast
    Given a Pro creator selects a saved "<provider>" destination
    When their Runner broadcasts a clip and they request a graceful stop
    Then the selected provider receives the complete clip with audio

    @BDD-US2-OPT010
    Examples: YouTube
      | provider |
      | youtube  |

    @BDD-US2-OPT011
    Examples: Twitch
      | provider |
      | twitch   |

    @BDD-US2-OPT012
    Examples: Custom RTMP without a separate key
      | provider |
      | custom   |
