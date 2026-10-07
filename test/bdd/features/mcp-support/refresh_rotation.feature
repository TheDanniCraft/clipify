@BDD
Feature: Rotate OAuth refresh credentials without transferring creator authority
  @US1 @BDD-REFRESH-CATALOGUE-001
  Scenario Outline: Provider rotation preserves the immutable approved grant
    Given the consented refresh request has "<boundary>" behavior
    When the actual provider handles that refresh boundary
    Then refresh cannot widen or transfer authority and consumed refresh credentials cannot be reused
    Examples:
      | boundary |
      | valid |
      | narrow |
      | reuse |
      | concurrent |
      | expired |
      | widen |
      | wrong-client |
      | wrong-resource |
      | revoked-grant |
      | expired-grant |
