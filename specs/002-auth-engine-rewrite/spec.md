# Feature Specification: Creator Identity and Access Rewrite

**Feature Branch**: `feature/auth-engine-rewrite`

**Created**: 2026-09-27

**Status**: Implementation verified; production cutover pending operator approval

**Input**: Replace Clipify's custom authentication and broad editor access model with managed identity, sessions, provider accounts, creator-owned teams, agency-to-creator relationships, granular permissions, and an automated zero-legacy cutover that preserves existing creator functionality.

## Scope

This feature establishes a provider-neutral identity and authorization model for creators, team members, and agencies. Every existing creator keeps an independent Creator Account and ownership of existing resources. Team members receive explicit roles and permissions. Agencies receive separate Agency Accounts that can link Creator Accounts and allocate paid creator licenses without treating ordinary team members as paid creators.

The feature includes creator onboarding through Twitch, email one-time-code access for invited team and agency members, optional passkeys as an alternate sign-in method, secure invitations, granular custom roles, session replacement, automated migration, operational validation, and removal of the legacy authentication runtime after a successful cutover.

## Clarifications

### Session 2026-09-29

- A legacy `editors` relationship whose editor subject no longer has a `users` Creator Profile is stale account residue, not an eligible team member. The cutover MUST record a redacted accepted disposition and delete only that relationship at successful reopen. It MUST NOT fabricate an identity or block the cutover. A missing creator/owner profile remains a blocking integrity failure.

### Session 2026-09-27

- Q: How should the first owner create a new Agency Account when they do not have or need a Twitch identity? → A: Clipify administrators provision Agency Accounts after the agency contacts Clipify and agrees custom pricing; the first owner then accepts an email-bound invitation and signs in by email code.
- Q: When a creator approves an agency relationship, how should the permissions of agency staff be determined? → A: Effective access is the intersection of the creator-approved permission set on the agency link and the staff member's Agency Account role.
- Q: What should happen to a Creator Account and its overlays immediately after its owner requests account deletion? → A: When deletion suspension begins—immediately for “delete now,” or at the paid-through date for scheduled deletion—suspend dashboard access, overlays, and integrations; retain the account for owner recovery during 30 days; then permanently erase eligible data. Send deletion and recovery reminders with a secure recovery entry point.
- Q: When must a Twitch-first creator establish a verified notification email? → A: Use the verified email asserted by Twitch as the creator's canonical notification email; creators change it on Twitch, while Clipify synchronizes it and does not offer a separate local creator-email edit.
- Q: What should happen to billing and agency-funded Pro access when a Creator Account enters deletion or an agency removes its allocation? → A: Default self-paid deletion to the paid-through date with an explicit “delete now” option; Stripe owns billing emails, Clipify owns product/security emails; ordinary agency removal has a seven-day grace while its seat remains occupied; losing Pro never deletes creator data.

### Out of Scope

- Kick sign-in or Kick creator connections.
- Per-individual-resource grants, such as access to only one playlist or one overlay.
- MCP clients or other external agent integrations.
- Allowing third-party applications to use Clipify as their authorization server.
- Username-and-password authentication or magic-link authentication.
- Automatically executing a production database restore without operator approval.
- Changing the commercial definition or price of current plans beyond supporting future agency-funded creator allocations.
- Self-service Agency Account registration or public fixed-price agency checkout.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Existing Creator Continues After Cutover (Priority: P1)

As an existing creator, I can return after the authentication migration, sign in through Twitch, and find my account, subscription benefits, team access, and resources unchanged. Public and runtime overlay links continue working throughout the dashboard-session cutover.

**Why this priority**: Existing creators and live overlays must not lose service because the identity infrastructure changed.

**Independent Test**: Migrate a representative existing creator with resources, a subscription, an editor, and a live overlay secret; verify the overlay before and after cutover, sign in again through Twitch, and confirm the same resources, entitlements, and identifiers are available.

**BDD**: Required — continuity, reauthentication, and observable failure states are user-visible behaviors.

**ATDD**: Required — preserving creator data and live overlay operation is a release boundary.

**Acceptance Scenarios**:

```gherkin
@ATDD @BDD @US1 @FR-005 @FR-006 @FR-017 @FR-027 @SC-001 @SC-002
@ATDD-US1-001
Scenario: Existing creator resumes work after migration
  Given an existing creator with resources, entitlements, and an editor
  When the identity migration completes and the creator signs in through Twitch
  Then the creator sees the same resources and effective entitlements
  And the former editor has the migrated operational role

@ATDD @BDD @US1 @FR-005 @EC-001
@ATDD-US1-002
Scenario: Legacy dashboard session requires a fresh sign-in
  Given an existing creator still has a legacy dashboard session
  When the new identity system becomes active
  Then the legacy session is rejected
  And the creator can establish a new session through Twitch

@ATDD @BDD @US1 @FR-006 @FR-027 @SC-002 @EC-002
@ATDD-US1-003
Scenario: Existing overlay remains usable during session cutover
  Given a valid overlay URL was issued before migration
  When dashboard sessions are replaced
  Then the overlay continues serving its existing runtime behavior without requiring an interactive sign-in
```

The scenarios are owned by the ATDD suite and also provide BDD evidence because their stakeholder release boundary and observable creator behavior are identical.

---

### User Story 2 - Creator Onboards and Signs In Safely (Priority: P1)

As a creator, I begin with Twitch, grant the channel capabilities Clipify needs, and receive a Creator Account that I own. I am not asked to begin with email and then unexpectedly connect Twitch.

**Why this priority**: Twitch is the primary creator platform and is required for the core Clipify experience.

**Independent Test**: Start with a person who has no Clipify account, complete Twitch authorization, verify exactly one person identity and one Creator Account are created, sign out, and sign back in without creating duplicates.

**BDD**: Required — onboarding, repeat sign-in, consent failure, and account-linking behavior are user-visible.

**ATDD**: Required — successful creator onboarding is a primary stakeholder acceptance boundary.

**Acceptance Scenarios**:

```gherkin
@ATDD @BDD @US2 @FR-001 @FR-002 @FR-007 @FR-029 @FR-030 @SC-003
@ATDD-US2-001
Scenario: New creator onboards through Twitch
  Given a Twitch creator has no Clipify identity
  When the creator successfully completes Twitch authorization
  Then one person identity and one creator-owned Creator Account are created
  And the verified email asserted by Twitch becomes the creator's notification email
  And the creator can enter the dashboard

@BDD @US2 @FR-001 @FR-002 @EC-003
@BDD-US2-001
Scenario: Returning creator does not receive a duplicate account
  Given a creator has already connected the same Twitch identity
  When the creator signs in again through Twitch
  Then the existing person identity and Creator Account are reused

@BDD @US2 @FR-002 @EC-004
@BDD-US2-002
Scenario Outline: Creator declines or loses Twitch authorization
  Given a creator begins Twitch authorization
  When authorization returns with <failure>
  Then no partially usable Creator Account is exposed
  And the creator receives a recoverable explanation and retry path

  Examples:
    | failure |
    | declined consent |
    | expired state |
    | insufficient access |
    | callback processing failure |

@BDD @US2 @FR-001 @EC-015
@BDD-US2-003
Scenario: Conflicting provider identity is not merged silently
  Given a Twitch identity would violate an existing person or creator uniqueness rule
  When the person attempts to connect or sign in with that identity
  Then the system rejects the ambiguous link
  And no identity or Creator Account records are merged or duplicated
```

The primary onboarding scenario is ATDD-owned and also supplies BDD evidence; the distinct alternate and error behaviors are BDD-owned because they test different observable outcomes.

---

### User Story 3 - Owner Manages Granular Team Access (Priority: P1)

As a creator owner, I invite team members by email or copied claim link, assign a standard or custom role, and restrict them to the precise categories of work they need. A team member can use email one-time codes without connecting Twitch and may add a passkey as an alternate sign-in method.

**Why this priority**: Replacing the all-or-nothing editor relationship with auditable, least-privilege access is a core reason for the rewrite.

**Independent Test**: Create a custom role that can manage playlist items and read analytics but cannot delete overlays or manage billing; invite an email-only member with a copied link and confirm allowed and denied operations server-side.

**BDD**: Required — invitations, authentication, custom roles, allowed actions, and denied actions are observable business behavior.

**ATDD**: Required — successful least-privilege delegation is a stakeholder acceptance boundary.

**Acceptance Scenarios**:

```gherkin
@ATDD @BDD @US3 @FR-003 @FR-008 @FR-010 @FR-011 @SC-004 @SC-007
@ATDD-US3-001
Scenario Outline: Owner invites an email-only team member with a custom role
  Given a creator owner has defined a role with playlist-management and analytics-read permissions
  When the owner creates one invitation and shares it by <delivery_method>
  And the invited person verifies the bound email and accepts it
  Then the person becomes a team member with exactly that role

  Examples:
    | delivery_method |
    | copying its claim link |
    | requesting optional email delivery |

@BDD @US3 @FR-010 @FR-028 @SC-004 @EC-005
@BDD-US3-001
Scenario: Team member is denied an ungranted operation
  Given a team member can manage playlist items but cannot delete overlays
  When the team member attempts to delete an overlay
  Then the server rejects the operation
  And the overlay remains unchanged

@BDD @US3 @FR-011 @EC-006
@BDD-US3-002
Scenario Outline: Invalid invitation cannot create a membership
  Given an invitation is <invitation_state>
  When a person attempts to accept it
  Then the invitation is rejected without adding a membership

  Examples:
    | invitation_state |
    | bound to a different verified email |
    | expired |
    | already consumed |
    | revoked |

@BDD @US3 @FR-004 @EC-007
@BDD-US3-003
Scenario Outline: Team member retains a usable sign-in path when passkey state changes
  Given a team member has an <passkey_state> passkey
  When the member attempts to sign in
  Then <outcome>

  Examples:
    | passkey_state | outcome |
    | available | a session can be established with the passkey |
    | unavailable | email-code sign-in remains available |
    | removed | email-code sign-in remains available |
    | failing | email-code sign-in remains available |

@BDD @US3 @FR-003 @FR-020 @EC-013
@BDD-US3-004
Scenario: Repeated authentication requests are throttled safely
  Given a person has exceeded an authentication abuse threshold
  When the person requests another email code or invitation verification
  Then the request is throttled with a retry indication
  And an eligible normal recovery path remains available after the limit period

@BDD @US3 @FR-025
@BDD-US3-005
Scenario Outline: Sensitive access changes create audit history
  Given an authorized actor attempts a sensitive <action>
  When the change succeeds or is rejected
  Then an immutable audit event records the actor, target, action, time, and outcome
  And secret credential values are not recorded

  Examples:
    | action |
    | invitation change |
    | membership change |
    | role change |
    | agency link change |
    | license allocation change |
    | sensitive integration change |
    | account deletion change |
```

The end-to-end delegation scenario is ATDD-owned and also provides BDD evidence. Permission denial, invitation misuse, and optional passkey behavior are materially different BDD-owned scenarios.

---

### User Story 4 - Agency Manages Linked Creators and Licenses (Priority: P2)

As an agency owner, I accept the first-owner invitation for an administrator-provisioned Agency Account, invite agency staff, request access to independent Creator Accounts, manage accepted creators centrally, and allocate paid creator licenses. Creator owners retain ownership and may revoke the agency relationship.

**Why this priority**: The model must support future agency pricing and centralized operations without weakening creator ownership or charging for ordinary editors as creators.

**Independent Test**: Link two creator-owned accounts to an agency after owner acceptance, grant an agency operator limited permissions, allocate a paid license to one creator, and verify access, entitlement, revocation, and non-consumption by team members.

**BDD**: Required — link approval, centralized access, allocation, revocation, and denial are business rules visible to agencies and creators.

**ATDD**: Required — agency management without transferring creator ownership is the stakeholder acceptance boundary.

**Acceptance Scenarios**:

```gherkin
@ATDD @BDD @US4 @FR-012
@ATDD-US4-003
Scenario: Provisioned agency owner activates the Agency Account
  Given a Clipify administrator provisioned an Agency Account after custom commercial terms were agreed
  When its designated first owner verifies the invited email and accepts the invitation
  Then the person becomes the Agency Account owner
  And the owner can sign in by email code without connecting Twitch

@ATDD @BDD @US4 @FR-012 @FR-013 @FR-014 @SC-010
@ATDD-US4-001
Scenario: Agency gains access after creator approval
  Given an agency requests access to an independent Creator Account with one staff member authorized by an agency role
  When the creator owner accepts the request with a creator-approved permission set
  Then the staff member can manage the creator only through permissions present in both sets
  And the creator owner remains the owner

@BDD @US4 @FR-013 @FR-014 @EC-008
@BDD-US4-001
Scenario: Creator revokes agency access
  Given an agency has active access to a Creator Account
  When the creator owner revokes the link
  Then agency-derived access ends immediately
  And direct creator-team memberships remain unchanged

@BDD @US4 @FR-010 @FR-013 @FR-014 @EC-005
@BDD-US4-003
Scenario: Agency staff access is limited by both authorization boundaries
  Given an agency staff role permits overlay deletion but the creator-approved agency permission set does not
  When that staff member attempts to delete the creator's overlay
  Then the server rejects the operation
  And the overlay remains unchanged

@ATDD @BDD @US4 @FR-015 @FR-016 @FR-029 @SC-010 @SC-011
@ATDD-US4-002
Scenario: Agency allocates a paid creator license
  Given an agency has an available paid creator license and an accepted creator link
  When the agency allocates the license to that creator
  Then the creator receives the agency-funded capabilities
  And creator and agency team members do not consume additional creator licenses
  And the creator receives one transactional allocation notice

@BDD @US4 @FR-016 @FR-029 @FR-031 @SC-011 @SC-012 @EC-009
@BDD-US4-002
Scenario: Removing agency funding provides non-abusable grace and preserves data
  Given a creator has both creator-owned benefits and an agency-funded allocation
  When the agency schedules the allocation for removal
  Then the creator keeps the agency-funded capabilities for seven days
  And the allocation continues consuming its agency seat during that grace period
  And after grace only the agency-funded capabilities are removed
  And creator-owned benefits remain active
  And no creator data is deleted
  And the creator receives notices when removal is scheduled, when 3 and 1 days remain, and when access ends
```

The accepted agency relationship and paid allocation scenarios are ATDD-owned and also provide BDD evidence. Revocation paths are separate BDD-owned behaviors.

---

### User Story 5 - Owner Controls Account and Subscription Lifecycle (Priority: P2)

As an account owner, I can view and update account information, export account data, manage or cancel a subscription, and request account deletion. Destructive actions require recent identity confirmation and cannot be delegated through custom roles.

**Why this priority**: Owners need complete control over their account and commercial relationship without giving destructive authority to ordinary team members.

**Independent Test**: Exercise owner account update, export, subscription cancellation, and deletion request; confirm reauthentication, recovery-period behavior, and denial for non-owners.

**BDD**: Required — account lifecycle and destructive-action restrictions are visible business rules.

**ATDD**: Required — owner control and non-owner denial define release acceptance.

**Acceptance Scenarios**:

```gherkin
@ATDD @BDD @US5 @FR-009 @FR-018 @FR-019 @SC-005
@ATDD-US5-001
Scenario Outline: Owner manages account and subscription
  Given an authenticated Creator Account owner has recently confirmed identity
  When the owner <operation>
  Then <expected_result>

  Examples:
    | operation | expected_result |
    | updates account information | the changes are recorded for that account |
    | requests an account data export | an export is prepared without support intervention |
    | cancels the subscription | cancellation is recorded for the displayed effective date |

@BDD @US5 @FR-009 @FR-018 @EC-010
@BDD-US5-001
Scenario: Non-owner cannot delete the account
  Given a team member has a custom role with all delegable operational permissions
  When the team member attempts to delete the Creator Account
  Then the request is rejected because account deletion is owner-only

@ATDD @BDD @US5 @FR-018 @SC-006
@ATDD-US5-002
Scenario Outline: Account deletion observes the recovery boundary
  Given deletion suspension has begun after the owner requested account deletion and recently confirmed identity
  When <recovery_time> has elapsed
  Then <deletion_outcome>

  Examples:
    | recovery_time | deletion_outcome |
    | less than 30 days | the suspended account remains recoverable and ineligible for permanent erasure |
    | at least 30 days | the account becomes eligible for permanent erasure under applicable obligations |

@ATDD @BDD @US5 @FR-018 @FR-029 @SC-006
@ATDD-US5-003
Scenario: Owner recovers a suspended account during the recovery period
  Given a Creator Account is suspended pending deletion and its owner has a valid recovery entry point
  When the owner signs in through an allowed authentication method, recently confirms identity, and cancels deletion before 30 days elapse
  Then the account, dashboard access, overlays, and integrations return to their recoverable pre-suspension state
  And the recovery entry point alone was not accepted as authentication

@BDD @US5 @FR-018 @FR-029 @SC-011
@BDD-US5-002
Scenario: Owner receives staged deletion notices
  Given an owner has requested account deletion
  When deletion is requested, suspension begins with 30 days remaining, or 7, 3, 1, or 0 days remain before permanent erasure eligibility
  Then the owner receives a transactional notice stating the scheduled date and current account state
  And the notice contains a secure entry point to the authenticated recovery flow

@ATDD @BDD @US5 @FR-018 @FR-019 @FR-029 @FR-031 @SC-005 @SC-006 @SC-012
@ATDD-US5-004
Scenario Outline: Owner chooses when deletion suspension begins
  Given a recently authenticated owner has creator-paid access through a future paid-through date
  When the owner chooses <deletion_choice>
  Then <suspension_result>
  And Stripe remains responsible for the corresponding billing lifecycle notice

  Examples:
    | deletion_choice | suspension_result |
    | delete after paid access | renewal is scheduled to stop at period end and deletion suspension begins on the paid-through date |
    | delete now | deletion suspension begins immediately and remaining service is handled under the displayed cancellation and refund policy |
```

The owner lifecycle scenarios are ATDD-owned and also provide BDD evidence; the non-owner denial is a distinct BDD-owned security behavior.

---

### User Story 6 - Operator Executes a Safe Automated Cutover (Priority: P1)

As a Clipify operator, I can run a repeatable migration workflow that checks prerequisites, verifies a backup, enables maintenance mode, migrates all identity and authorization records, validates invariants, starts the new runtime, executes smoke checks, and reopens service only when every blocking check passes.

**Why this priority**: The new model cannot safely ship without a deterministic cutover that protects user data and live functionality.

**Independent Test**: Execute the complete workflow twice against an isolated production-shaped database snapshot, inject failures at each phase, and verify idempotence, fail-closed maintenance behavior, diagnostic output, and unchanged protected identifiers.

**BDD**: Required — the operator workflow, failure states, and recovery guidance are observable operational behaviors.

**ATDD**: Required — successful automated cutover and invariant validation are release boundaries.

**Acceptance Scenarios**:

```gherkin
@ATDD @BDD @US6 @FR-022 @FR-023 @FR-024 @SC-001 @SC-008 @SC-009
@ATDD-US6-001
Scenario: Automated cutover completes successfully and idempotently
  Given a verified backup and a valid pre-migration database
  When the operator completes the cutover workflow twice against the same database state
  Then all identities, memberships, permissions, provider accounts, and entitlements are migrated
  And every required invariant and smoke check passes before maintenance mode is removed
  And the second run creates no duplicate domain or authorization records

@BDD @US6 @FR-022 @FR-023 @EC-011
@BDD-US6-001
Scenario Outline: Failed migration remains closed and resumable
  Given the cutover workflow is running in maintenance mode
  When the <checkpoint> checkpoint fails
  Then maintenance mode remains enabled
  And the workflow reports the failed checkpoint and safe next action
  And rerunning the workflow does not duplicate completed records

  Examples:
    | checkpoint |
    | preflight |
    | backup verification |
    | identity migration |
    | membership and role migration |
    | provider credential migration |
    | invariant validation |
    | runtime activation |
    | smoke checks |

@ATDD @BDD @US6 @FR-024 @FR-026 @SC-008
@ATDD-US6-002
Scenario: Cutover removes the legacy runtime after validation
  Given migration validation and smoke checks have passed
  When the new identity runtime is activated
  Then no request depends on the legacy session, editor, or provider-token runtime
  And the legacy structures are eligible for removal under the approved migration

@BDD @US6 @FR-023 @EC-012
@BDD-US6-002
Scenario: Restore requires an explicit operator decision
  Given a cutover failure has produced verified rollback guidance
  When no operator has authorized restoration
  Then the workflow does not restore or overwrite the production database automatically

@BDD @US6 @FR-021 @FR-024 @EC-014
@BDD-US6-003
Scenario: Revoked provider credential fails without corrupting ownership
  Given a migrated provider account has an invalid or revoked refresh credential
  When the credential refresh smoke check runs
  Then the cutover reports the originating provider failure
  And no creator ownership, provider-account uniqueness, or existing credential record is overwritten
  And service is not reopened while the blocking check fails
```

The successful cutover and legacy-removal scenarios are ATDD-owned and also provide BDD evidence. Failure and restore-safety paths are distinct BDD-owned behaviors.

### Edge Cases

- **EC-001**: A legacy dashboard session is presented after the cutover.
- **EC-002**: A public or runtime overlay is requested while dashboard authentication is unavailable.
- **EC-003**: A returning Twitch identity already maps to an existing person or Creator Account.
- **EC-004**: Twitch authorization is declined, expires, lacks required capabilities, or fails during callback processing.
- **EC-005**: A member attempts an operation absent from every effective direct or agency-derived role.
- **EC-006**: An invitation link is expired, already consumed, revoked, or opened by a person with a different verified email.
- **EC-007**: A passkey is unavailable, removed, or fails while email-code or Twitch sign-in remains available.
- **EC-008**: A creator revokes an agency link while agency staff have active sessions.
- **EC-009**: An agency allocation is revoked while the creator has overlapping creator-owned benefits.
- **EC-010**: A non-owner attempts ownership transfer, account deletion, or another non-delegable action.
- **EC-011**: Migration is interrupted after only some checkpoints have completed.
- **EC-012**: A failed cutover has a valid backup but restoration has not been explicitly authorized.
- **EC-013**: Multiple simultaneous invitation or sign-in attempts exceed abuse controls.
- **EC-014**: A provider refresh credential is invalid or revoked during or after migration.
- **EC-015**: A linked person or creator is already associated with another record that would violate uniqueness.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST maintain a provider-neutral person identity and MUST support linking one or more external sign-in accounts without changing that identity's stable identifier.
- **FR-002**: The system MUST use Twitch as the primary creator onboarding and sign-in path and MUST create or reuse exactly one Creator Account for the connected creator.
- **FR-003**: Invited team and agency members MUST be able to sign in through a time-limited email one-time code without connecting Twitch.
- **FR-004**: Authenticated people MUST be able to register, list, rename, use, and remove passkeys as an optional alternate sign-in method; passkeys MUST NOT be represented as two-factor authentication by themselves.
- **FR-005**: The system MUST issue revocable server-validated sessions, reject legacy dashboard sessions after cutover, and preserve a recoverable sign-in path.
- **FR-006**: Migration MUST preserve existing creator identifiers, resource identifiers, ownership relationships, overlay secrets, subscriptions, entitlement grants, and externally used runtime URLs.
- **FR-007**: Every Creator Account MUST contain exactly one creator profile and MUST have that creator as its owner.
- **FR-008**: Creator owners MUST be able to create, read, update, and delete custom roles composed from the delegable permission catalogue and assign standard or custom roles to team members.
- **FR-009**: Creator and Agency Account owners MUST receive all permissions applicable to their account type; ownership transfer, account deletion, and other designated non-delegable actions MUST remain owner-only.
- **FR-010**: Every protected operation MUST be authorized server-side using authenticated identity, active membership or accepted agency access, required permission, resource ownership, and required entitlement.
- **FR-011**: Invitations MUST be single-use, bound to a verified email, expire after seven days, be copyable by default, and support optional email delivery without generating a second invitation.
- **FR-012**: The system MUST support Agency Accounts that are separate from Creator Accounts and may contain agency members and links to multiple independent Creator Accounts; only a Clipify administrator may provision an Agency Account after custom commercial terms are agreed, and its designated first owner MUST activate ownership through an email-bound invitation and email-code sign-in without connecting Twitch.
- **FR-013**: An agency link MUST require creator-owner acceptance of an explicit permission set, MUST NOT transfer creator ownership, and MUST be revocable or permission-reducible by the creator owner.
- **FR-014**: Agency members MUST receive access to linked creators through agency membership and the accepted link without requiring duplicate direct memberships in every Creator Account; their effective creator permission set MUST be the intersection of permissions granted by their active Agency Account roles and the creator-approved permission set on the agency link, recalculated on every protected operation.
- **FR-015**: Paid agency allocations MUST count creators receiving paid capabilities, not creator team members or agency staff.
- **FR-016**: Effective creator capabilities MUST combine creator-owned benefits with active agency-funded allocations. Ordinary agency removal MUST schedule the agency-funded portion to end after a seven-day grace period, keep the allocation counted against the agency's paid seats throughout that period, and send the required notices; creator-owned benefits and creator data MUST remain unchanged. Creator Account deletion may release an agency allocation when deletion suspension begins and MUST NOT automatically reclaim that allocation on recovery.
- **FR-017**: Each eligible existing editor relationship whose editor still has a Creator Profile MUST migrate to an operational team membership that preserves current resource-management access without adding billing, ownership-transfer, account-deletion, or team-administration authority. A relationship whose editor Creator Profile no longer exists MUST receive a redacted accepted stale-relationship disposition and MUST be deleted only when the validated cutover successfully reopens; a missing creator/owner profile remains blocking.
- **FR-018**: Owners MUST be able to read, update, export, and request deletion of their account. Deletion MUST require recent identity confirmation. If creator-paid access remains, the default choice MUST schedule renewal cancellation and deletion suspension for the paid-through date; an explicit “delete now” choice MUST begin suspension immediately under the displayed cancellation and refund policy. When suspension begins, the system MUST suspend dashboard sessions, overlays, and integrations, release active agency allocations, retain eligible account data for owner recovery during a 30-day recovery period, and permanently erase eligible data only after that period. A recovery request MUST require an allowed sign-in method and recent identity confirmation; a recovery link alone MUST NOT authenticate the owner, and recovery MUST NOT restart billing or reclaim an agency allocation automatically.
- **FR-019**: Owners MUST be able to read, manage, and cancel subscriptions, with the effective cancellation date shown before confirmation. Stripe MUST remain the source of billing lifecycle emails, while Clipify MUST avoid duplicating receipts, invoices, failed-payment notices, or subscription cancellation notices and MUST derive effective subscription state from authenticated Stripe lifecycle events.
- **FR-020**: Authentication, invitation, verification, and account-linking operations MUST enforce abuse controls that limit repeated requests by relevant identity and network signals without blocking normal recovery paths.
- **FR-021**: Existing provider credentials MUST migrate without exposing plaintext secrets, and exactly one active authority MUST be responsible for refreshing a given provider account.
- **FR-022**: The cutover MUST be executable through an idempotent, checkpointed workflow that can dry-run, resume safely, and migrate all eligible records without manual per-user edits.
- **FR-023**: The cutover workflow MUST verify prerequisites and a recoverable backup before mutation, keep maintenance mode active on blocking failure, and require explicit operator authorization before database restoration.
- **FR-024**: The cutover workflow MUST run automated post-migration invariants and smoke checks covering sign-in, authorization, resource continuity, overlay runtime access, provider credential refresh, subscriptions, and entitlements before reopening service.
- **FR-025**: The system MUST create an audit history for invitations, membership changes, role changes, agency links, license allocations, sensitive integration changes, account deletion requests, and other designated security-sensitive actions.
- **FR-026**: After successful validation, production requests MUST have no dependency on the legacy custom session, editor authorization, or provider-token runtime, and obsolete structures MUST be removed through the approved migration rather than retained as indefinite compatibility tables.
- **FR-027**: Overlay runtime access MUST remain independent from interactive dashboard sessions so an authentication cutover does not interrupt valid existing overlays.
- **FR-028**: The delegable permission catalogue MUST support the following resource actions:
  - account: read, update, export; account deletion remains owner-only;
  - member: read, invite, update, remove;
  - role: read, create, update, delete;
  - creator: read, update, connect, disconnect;
  - overlay: create, read, update, delete, control; overlay secret: read, rotate;
  - playlist: create, read, update, delete, manage items, control;
  - gallery: create, read, update, delete, publish;
  - runner: create, read, update, delete, control; runner credential: read, rotate;
  - analytics: read, export;
  - integration: read, connect, disconnect, reauthorize;
  - subscription: read, manage, cancel;
  - billing: read, manage;
  - audit: read;
  - agency: read, update, link creator, unlink creator, allocate license, revoke license.
- **FR-029**: Clipify MUST provide product and security notifications to the person's verified notification email. Account-deletion notices MUST be sent when deletion is requested, when suspension begins with 30 days remaining, when 7, 3, 1, and 0 days remain before permanent-erasure eligibility, and when deletion is recovered. Agency-allocation notices MUST be sent when Pro is granted, when removal is scheduled, when 3 and 1 days remain, and when access ends. Notices MUST state the applicable access or erasure date, MUST distinguish loss of Pro features from deletion of data, and deletion notices MUST provide a secure entry point to the authenticated recovery flow.
- **FR-030**: For a Twitch-linked creator, the verified email asserted by Twitch MUST be the canonical notification email, MUST be synchronized from Twitch on sign-in and applicable provider updates, and MUST NOT be directly editable in Clipify; the creator changes it through Twitch. A person who uses email-code authentication without Twitch MUST manage changes through a Clipify flow that verifies the replacement address before activation.
- **FR-031**: Expiration or removal of creator-paid or agency-funded Pro access MUST NOT delete creator resources. Features unavailable on the resulting plan MAY be disabled, made read-only, or blocked from new use, but retained data and the exact downgrade behavior MUST be shown before cancellation or allocation removal.

### Key Entities

- **Person Identity**: A human who can authenticate; remains independent of Twitch, email, passkey, or future providers and references one canonical verified notification email with a recorded authority source.
- **Provider Account**: A sign-in or connected-platform identity associated with one person, including provider identity, granted capabilities, and credential lifecycle state.
- **Session**: A revocable authenticated interaction associated with a person and recent-authentication state.
- **Creator Profile**: The stable Clipify creator/business record that owns current domain relationships and connects to a streaming-platform channel.
- **Creator Account**: The creator-owned authorization boundary containing one creator profile, direct team memberships, roles, resources, and creator-owned benefits.
- **Agency Account**: A separate authorization and commercial boundary containing agency members, creator links, and creator-license allocations.
- **Membership**: A person's active relationship to a Creator Account or Agency Account, with one or more assigned roles.
- **Role**: A named reusable permission set, either standard or owner-defined.
- **Permission**: A resource/action capability evaluated together with ownership and entitlements.
- **Invitation**: A single-use, expiring, email-bound offer of membership and roles, distributable by copied link or optional email.
- **Agency Creator Link**: A creator-approved and creator-revocable relationship with an explicit maximum permission set; an agency member may operate within the Creator Account only where that set intersects with the member's active Agency Account roles.
- **Creator License Allocation**: An agency-funded paid capability assignment to one linked creator, distinct from human team membership.
- **Entitlement**: A capability originating from a creator-owned purchase, agency allocation, administrative grant, or another approved source.
- **Audit Event**: An immutable security-relevant record describing actor, target, action, time, and outcome.
- **Migration Run**: The checkpointed record of cutover preflight, backup verification, transformations, validations, deployment checks, and final state.
- **Transactional Notification**: A security- or entitlement-relevant message addressed to a person's verified notification email, with delivery state, event type, and non-secret correlation to the originating action.

## Test Classification Matrix

Every listed source has mandatory evidence. Exact executable paths and commands are resolved during planning.

| Source IDs            | Required Evidence           | Test Intent                                                                                                                                                              |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-001–FR-005         | TDD, BDD, ATDD              | Identity uniqueness, provider linking, creator and email sign-in, optional passkeys, session issuance/revocation, and observable recovery paths.                         |
| FR-006–FR-007         | TDD, ATDD                   | Identifier preservation, ownership invariants, and exactly-one-creator account structure.                                                                                |
| FR-008–FR-010, FR-028 | TDD, BDD, ATDD              | Permission composition, custom roles, owner authority, non-delegable actions, direct and agency authorization decisions, and every allowed/denied resource action class. |
| FR-011                | TDD, BDD, ATDD              | Invitation creation, optional delivery, email binding, expiry boundary, one-time acceptance, revocation, and replay denial.                                              |
| FR-012–FR-016         | TDD, BDD, ATDD              | Agency separation, link acceptance/revocation, transitive staff access, creator-license counting, and entitlement union/removal.                                         |
| FR-017                | TDD, BDD, ATDD              | Existing editor conversion preserves allowed operational access while excluding newly sensitive authority.                                                               |
| FR-018–FR-019         | TDD, BDD, ATDD              | Account update/export/deletion, recent authentication, deletion recovery boundaries, subscription management, and cancellation timing.                                   |
| FR-020                | TDD, BDD                    | Abuse-control thresholds, recovery allowance, retry timing, and observable throttling errors.                                                                            |
| FR-021                | TDD, ATDD                   | Encrypted credential migration, uniqueness, expiry, refresh success, refresh failure, and single refresh authority.                                                      |
| FR-022–FR-026         | TDD, BDD, ATDD              | Dry run, idempotence, resume, backup gate, maintenance behavior, invariant validation, smoke checks, auditing, and legacy-runtime removal.                               |
| FR-027                | TDD, BDD, ATDD              | Overlay runtime continuity independent of dashboard session state.                                                                                                       |
| FR-029                | TDD, BDD, ATDD              | Deletion request/recovery/reminder notices, agency allocation notices, secure recovery entry points, scheduling boundaries, and delivery state.                          |
| FR-030                | TDD, BDD, ATDD              | Twitch-asserted creator email synchronization, prohibition of local creator-email edits, and verified replacement for email-only identities.                             |
| FR-031                | TDD, BDD, ATDD              | Paid-through scheduling, immediate deletion choice, downgrade behavior, data retention, Stripe billing-email ownership, and webhook-derived subscription state.          |
| SC-001–SC-012         | ATDD and applicable BDD/TDD | Stakeholder-visible completion outcomes and all supporting boundaries.                                                                                                   |
| EC-001–EC-015         | TDD plus mapped BDD/ATDD    | Every identified negative path, conflict, boundary, interruption, misuse, and provider failure.                                                                          |

### Planned Scenario Coverage Matrix

| Scenario ID  | Primary Sources                                        | Evidence Roles | Polarity / Inputs                                                                       | Observable Interface                         | Sampling or Sharing Rationale                                                                                                                             |
| ------------ | ------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATDD-US1-001 | FR-006, FR-017, SC-001                                 | ATDD, BDD      | Positive; representative creator with each migrated relationship class                  | Creator dashboard                            | One end-to-end scenario owns both roles because stakeholder continuity and visible behavior are the same outcome; per-entity boundaries remain TDD-owned. |
| ATDD-US1-002 | FR-005, EC-001                                         | ATDD, BDD      | Negative then recovery; legacy session                                                  | Dashboard sign-in                            | Shared acceptance and behavior evidence for mandatory reauthentication.                                                                                   |
| ATDD-US1-003 | FR-027, SC-002, EC-002                                 | ATDD, BDD      | Positive during auth outage                                                             | Existing overlay URL                         | Shared because uninterrupted overlay behavior is itself the release boundary.                                                                             |
| ATDD-US2-001 | FR-001, FR-002, FR-007, FR-029, FR-030, SC-003         | ATDD, BDD      | Positive; new Twitch creator                                                            | Creator onboarding                           | Shared primary onboarding evidence, including establishment of the provider-asserted notification address.                                                |
| BDD-US2-001  | FR-001, FR-002, EC-003                                 | BDD            | Boundary; returning linked identity                                                     | Twitch sign-in                               | Separate from new onboarding because duplicate prevention has a distinct outcome.                                                                         |
| BDD-US2-002  | FR-002, EC-004                                         | BDD            | Negative; declined, expired, insufficient, callback failure examples                    | Twitch authorization return                  | The outline enumerates all four externally distinct failure classes.                                                                                      |
| BDD-US2-003  | FR-001, EC-015                                         | BDD            | Conflict; provider identity violates uniqueness                                         | Sign-in and account linking                  | Prevents an ambiguous identity from being silently merged or duplicated.                                                                                  |
| ATDD-US3-001 | FR-003, FR-008, FR-011, SC-007                         | ATDD, BDD      | Positive; copy-link and email delivery classes                                          | Invitation acceptance                        | Shared delegation acceptance with both delivery variants explicitly represented.                                                                          |
| BDD-US3-001  | FR-010, FR-028, SC-004, EC-005                         | BDD            | Negative; ungranted actions across permission resource classes                          | Protected server operation                   | Risk-based representative sampling may group equivalent CRUD denials, but sensitive actions require explicit examples.                                    |
| BDD-US3-002  | FR-011, EC-006                                         | BDD            | Negative; wrong email, expired, consumed, revoked                                       | Invitation acceptance                        | The outline enumerates every invalid invitation state.                                                                                                    |
| BDD-US3-003  | FR-004, EC-007                                         | BDD            | Positive and fallback; passkey available, unavailable, removed, or failing              | Sign-in                                      | Covers optional alternative without treating it as 2FA.                                                                                                   |
| BDD-US3-004  | FR-003, FR-020, EC-013                                 | BDD            | Boundary; repeated authentication requests exceed abuse threshold                       | Authentication and invitation verification   | Proves throttling remains observable and normal recovery resumes.                                                                                         |
| BDD-US3-005  | FR-025                                                 | BDD            | Seven action classes, each with positive and negative outcomes                          | Audit history                                | Proves invitation, membership, role, agency-link, allocation, sensitive-integration, and account-deletion audit completeness while excluding secrets.     |
| ATDD-US4-003 | FR-012                                                 | ATDD, BDD      | Positive; administrator-provisioned agency and invited first owner                      | Agency activation                            | Shared because restricted agency creation and email-only owner activation form one commercial onboarding boundary.                                        |
| ATDD-US4-001 | FR-012–FR-014                                          | ATDD, BDD      | Positive; accepted agency link                                                          | Agency creator selection                     | Shared because central management without ownership transfer is the release boundary.                                                                     |
| BDD-US4-001  | FR-013, FR-014, EC-008                                 | BDD            | Negative transition; revocation with active agency session                              | Protected creator operation                  | Must prove existing session cannot retain derived authority.                                                                                              |
| BDD-US4-003  | FR-010, FR-013, FR-014, EC-005                         | BDD            | Negative; permission exists on only one side of the agency relationship                 | Protected creator operation                  | Proves neither the creator grant nor agency staff role can authorize an operation independently.                                                          |
| ATDD-US4-002 | FR-015, FR-016, FR-029, SC-010, SC-011                 | ATDD, BDD      | Positive; allocation with creator and team members                                      | Agency billing/allocation flow               | Shared commercial acceptance and visible behavior, including the required allocation notice.                                                              |
| BDD-US4-002  | FR-016, FR-029, FR-031, SC-011, SC-012, EC-009         | BDD            | Boundary; overlapping entitlement sources and seven-day occupied-seat grace             | Capability check and product email           | Distinguishes agency-funded removal from creator-owned retention and prevents seat-rotation abuse without deleting data.                                  |
| ATDD-US5-001 | FR-009, FR-018, FR-019                                 | ATDD, BDD      | Positive; recently authenticated owner                                                  | Account and subscription settings            | Shared owner-control acceptance.                                                                                                                          |
| BDD-US5-001  | FR-009, EC-010                                         | BDD            | Negative; non-owner with maximal delegable role                                         | Destructive account operation                | Tests non-delegable boundary independently.                                                                                                               |
| ATDD-US5-002 | FR-018, SC-006                                         | ATDD, BDD      | Positive and time boundary; before/after 30 days                                        | Account deletion flow                        | Examples cover recovery and permanent-erasure eligibility on both sides of the boundary.                                                                  |
| ATDD-US5-003 | FR-018, FR-029, SC-006                                 | ATDD, BDD      | Positive; authenticated recovery before 30 days                                         | Account recovery flow                        | Shared because restoring suspended runtime behavior is both user-visible and an account-lifecycle release boundary.                                       |
| BDD-US5-002  | FR-018, FR-029, SC-011                                 | BDD            | Positive and time boundaries; request, suspension/30-day, 7-, 3-, 1-, and 0-day notices | Transactional email and recovery entry point | Covers every promised deletion-notice threshold without treating the link as authentication.                                                              |
| ATDD-US5-004 | FR-018, FR-019, FR-029, FR-031, SC-005, SC-006, SC-012 | ATDD, BDD      | Choice boundary; paid-through scheduling or immediate suspension                        | Account deletion and billing lifecycle       | Proves the default preserves paid access while an explicit immediate path remains available without duplicate billing messages.                           |
| ATDD-US6-001 | FR-022–FR-024, SC-001, SC-009                          | ATDD, BDD      | Positive and repeat run; production-shaped snapshot                                     | Operator cutover workflow                    | Shared because the operator-visible successful and idempotent workflow is the release gate.                                                               |
| BDD-US6-001  | FR-022, FR-023, EC-011                                 | BDD            | Negative; failure injected at every checkpoint                                          | Operator cutover workflow                    | Pairwise sampling may combine independent phases only if all state-transition boundaries remain covered.                                                  |
| ATDD-US6-002 | FR-024, FR-026, SC-008                                 | ATDD, BDD      | Positive; validated new runtime                                                         | Application smoke surface                    | Shared release boundary for removal of legacy dependencies.                                                                                               |
| BDD-US6-002  | FR-023, EC-012                                         | BDD            | Negative; rollback available but unauthorized                                           | Operator recovery workflow                   | Proves destructive restore is never implicit.                                                                                                             |
| BDD-US6-003  | FR-021, FR-024, EC-014                                 | BDD            | Negative; invalid or revoked provider refresh credential                                | Credential-refresh smoke check               | Preserves the originating failure and blocks unsafe reopening without corrupting identity data.                                                           |

### TDD Inventory Requirements

Planning MUST enumerate implementation-level behaviors for every rule above, including:

- successful, duplicate, conflicting, missing, expired, revoked, and replayed identity/account links;
- both sides of invitation expiry, deletion recovery, rate-limit, entitlement-effective-date, and recent-authentication boundaries;
- notification scheduling, retry, deduplication, redaction, and delivery-state transitions for every required transactional event;
- paid-through versus immediate deletion choices, subscription-event reordering, seven-day agency grace, occupied-seat counting, and every post-downgrade feature restriction without resource deletion;
- every membership, role, permission, resource-ownership, agency-link, and entitlement state transition;
- every provider exchange and refresh result class, with the precise originating failure preserved;
- migration dry-run versus apply, first run versus rerun, resume from each checkpoint, partial-row conflicts, and transaction rollback;
- backup absent, invalid, incomplete, and verified states;
- overlay secret validity independent from every dashboard-session state;
- audit-event creation and redaction for every designated security-sensitive action;
- contract tests for all authentication, invitation, membership, authorization, agency, allocation, migration, and smoke-check interfaces;
- deterministic behavior with controlled clock, network, database, random, credential, and filesystem boundaries.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A migration rehearsal accounts for 100% of existing creators, editor relationships (Operations memberships plus approved stale-relationship removals), connected provider accounts, subscriptions, entitlement grants, and owned resources, with no unexplained count difference.
- **SC-002**: 100% of the pre-cutover overlay regression fixture set continues producing its expected runtime response during and after dashboard-session replacement.
- **SC-003**: A new creator can complete Twitch onboarding and reach the dashboard in under three minutes, excluding time spent on the external provider's own service interruption.
- **SC-004**: Every authorization case in the permission matrix produces the expected allow or deny result, and denied mutations leave protected data unchanged.
- **SC-005**: An owner can complete account update, data export request, or subscription cancellation without support intervention, while non-owners succeed in zero owner-only operations.
- **SC-006**: Every account deletion request remains recoverable throughout the documented 30-day recovery period and is ineligible for permanent erasure before that period expires.
- **SC-011**: In controlled delivery tests, 100% of account-deletion, recovery, scheduled deletion-reminder, and agency-allocation events produce exactly one correctly addressed transactional notification record without embedding authentication credentials or provider secrets.
- **SC-012**: Across every paid-access expiry and agency-allocation removal fixture, zero creator resources are deleted, and every affected owner sees the effective date and resulting feature restrictions before confirming the change.
- **SC-007**: An invited team member can accept a valid invitation and reach their authorized creator view in under three minutes after receiving the link or email.
- **SC-008**: After a successful cutover rehearsal, automated dependency checks report zero runtime reads or writes through the legacy session, editor-authorization, or provider-token paths.
- **SC-009**: Repeating the migration workflow against an already migrated isolated snapshot produces zero duplicate identities, memberships, provider accounts, creator links, allocations, or resources.
- **SC-010**: Adding or removing any number of creator team members or agency staff changes the paid creator-license count by zero; only explicit creator allocations change that count.

## Assumptions

- Existing creator and resource identifiers are stable domain identifiers and remain valid after authentication identities become provider-neutral.
- Existing editors were granted broad operational resource access but not billing, ownership transfer, account deletion, or team-administration authority; migration therefore maps them to the standard operational role.
- A Creator Account contains one creator, while an Agency Account links to multiple independent Creator Accounts rather than containing those creators directly.
- Agency pricing is negotiated rather than self-served: the public product directs agencies and enterprise customers to contact Clipify, and only Clipify administrators can provision the resulting Agency Account.
- Creator owners must explicitly accept agency links and may revoke them at any time.
- The default invitation experience presents a copyable link; email delivery is optional and uses the same invitation.
- Invitation recipients prove control of the email to which the invitation is bound before acceptance.
- Invitation validity is seven days.
- Account deletion uses a 30-day recovery period subject to applicable legal retention and erasure obligations.
- Passkeys are optional alternate sign-in credentials presented under security/sign-in settings, not the primary onboarding path and not automatically described as two-factor authentication.
- Twitch is authoritative for a Twitch-linked creator's verified notification email; Clipify is authoritative for verified notification-email changes made by email-only people.
- Existing dashboard sessions may be invalidated at cutover; existing overlays and other non-interactive runtime integrations must continue operating.
- The production cutover occurs during a communicated maintenance window with a verified database backup.
- Operators may automate backup verification, migration, validation, deployment checks, and smoke tests, but database restoration always requires an explicit human decision.
- Stripe remains the source of billing lifecycle events and billing emails; Clipify owns product, access, security, deletion, recovery, invitation, and agency-allocation emails.
- Stripe customer-email configuration is reviewed and changed only through a separately authorized pre-implementation operation; this specification does not itself modify the live Stripe account.
- Transactional email delivery, Twitch availability, database access, and deployment infrastructure are external dependencies whose implementation and failure handling are detailed during planning.
- The approved identity platform, database mapping, email provider, and deployment mechanism are implementation-plan decisions and do not alter the behavioral requirements in this specification.
