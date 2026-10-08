@BDD
Feature: Connect with explicit creator and permission consent

  @US1
  @BDD-US1-004
  Scenario: The signed-in user approves those permissions and that creator — a registered client requests read access to a creator the user owns
    Given a registered client requests read access to a creator the user owns
    When the signed-in user approves those permissions and that creator
    Then the client reads that creator and cannot access an unapproved creator

  @US1
  @BDD-US1-005
  Scenario: The user denies consent — the user is shown the client and requested permissions
    Given the user is shown the client and requested permissions
    When the user denies consent
    Then no grant is issued and no creator data is accessible

  @US1
  @BDD-US1-006
  Scenario: The client exchanges the code — an approved authorization code and matching proof exist
    Given an approved authorization code and matching proof exist
    When the client exchanges the code
    Then expiring access bound to Clipify MCP is issued

  @US1
  @BDD-US1-007
  Scenario: The client exchanges authorization — missing PKCE proof is presented
    Given missing PKCE proof is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1
  @BDD-US1-008
  Scenario: The client exchanges authorization — incorrect PKCE proof is presented
    Given incorrect PKCE proof is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1
  @BDD-US1-009
  Scenario: The client exchanges authorization — a reused authorization code is presented
    Given a reused authorization code is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1
  @BDD-US1-012
  Scenario: The client exchanges authorization — a changed callback is presented
    Given a changed callback is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1
  @BDD-US1-024
  Scenario Outline: Approve the final customized permission selection
    Given the consent screen offers Read and Read & edit with individual permissions
    When the user selects <selection> and approves the connection
    Then the connection grants exactly <permissions> and no unselected permission

    Examples:
      | selection | permissions |
      | Read | discovery and permitted reads |
      | Read & edit | discovery, reads, creates, updates and playlist-item management |
      | Read & edit with overlay deletion explicitly selected | read/edit permissions and overlay deletion only |
      | Read & edit with playlist deletion explicitly selected | read/edit permissions and playlist deletion only |
      | Read & edit with both delete permissions selected | read/edit permissions and overlay and playlist deletion |
      | Read & edit with create and update deselected | discovery, reads and playlist-item management |


  @US1 @FR-004 @EC-003 @BDD-US1-010
  Scenario: The client exchanges authorization — an expired authorization code is presented
    Given an expired authorization code is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1 @FR-004 @EC-003 @BDD-US1-011
  Scenario: The client exchanges authorization — an unregistered callback is presented
    Given an unregistered callback is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens
