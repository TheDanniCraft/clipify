Feature: Pro broadcast acceptance
  @ATDD @US2 @SC-002 @ATDD-US2-SC002
  Scenario: Three destinations receive the same encode and recover independently
    Given YouTube, Twitch and custom RTMP represented by three isolated loopback receivers
    When one receiver disconnects and returns during broadcasting
    Then it rejoins while both healthy destinations continue without restarting
    And all destinations decode the same H264 content with AAC audio
    And stopping leaves no owned process or receiver socket

  @ATDD @US3 @SC-003 @ATDD-US3-SC003 @BDD-US3-FR013 @BDD-US3-OPT040
  Scenario: A cached event starts promptly and ends at the real clip boundary
    Given an awake Runner with verified protected cached schedule authority
    When its actual local watchdog reaches the original start and end
    Then encoded output starts within thirty seconds
    And the final clip frame is encoded before every output closes without starting another clip
