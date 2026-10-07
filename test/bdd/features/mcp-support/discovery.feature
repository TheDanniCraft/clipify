@BDD
Feature: Manage Clipify through authorized AI clients

  @US1 @FR-001
  @BDD-US1-001
  Scenario: It discovers the service — a compatible client has no prior Clipify configuration
    Given a compatible client has no prior Clipify configuration
    When it discovers the service
    Then it receives the service and authorization metadata

  @US1 @FR-002
  @BDD-US1-002
  Scenario: It registers valid client metadata — a custom client has no Clipify session or assigned credentials
    Given a custom client has no Clipify session or assigned credentials
    When it registers valid client metadata
    Then it receives a client identity but cannot read creator data

  @US1 @FR-002 @EC-001
  @BDD-US1-003
  Scenario Outline: The client registers — client registration metadata has an invalid callback or unsupported grant
    Given registration metadata contains <invalid>
    When the client registers
    Then registration is rejected and no client record is created

    Examples:
      | invalid |
      | an invalid callback |
      | an unsupported grant |
      | an unsupported scope |
      | a null JSON root |
      | an array JSON root |
      | a scalar JSON root |
