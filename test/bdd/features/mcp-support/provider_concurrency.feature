@BDD
Feature: Keep provider credential reads usable under simultaneous AI work
  @US4 @BDD-DEPENDENCY-003
  Scenario: Concurrent provider requests do not starve their own credential storage
    Given twenty concurrent AI operations need cached creator provider credentials
    When they read those credentials through serialized Better Auth access
    Then all credential reads finish promptly and release their lock without exhausting database work
