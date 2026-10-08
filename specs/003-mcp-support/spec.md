# Feature Specification: MCP Support

> Consolidated MCP server scope: 66 tools on `feature/mcp-support`. The original foundation, workflow expansion, feedback and focused editing tools belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

**Feature Branch**: `feature/mcp-support`

**Created**: 2026-10-04

**Status**: Implemented locally; external release validation pending

**Input**: User description: “Manage Clipify from ChatGPT or another compatible AI tool through MCP. Allow custom clients to register themselves through OAuth2. Enforce permissions and plan limits in the shared backend for browser and MCP requests, so a Free creator cannot create twenty overlays.”

## Clarifications

### Session 2026-10-04

- Q: Which AI clients must work before we consider the first release complete? → A: ChatGPT, Claude, Codex, and a custom compatible client.

- Q: Should one AI client connection access one creator account or several creator accounts you approve? → A: Multiple explicitly selected creators; adding another requires new consent.

- Q: What should happen when an AI tool edits an overlay or playlist that someone changed in the browser after the AI last read it? → A: Reject stale edits; fetch the latest state before retrying.

- Q: Should an approved AI client be able to delete overlays and playlists without another confirmation in Clipify? → A: Allow deletion with explicitly approved delete permission; offer Read and Read & edit consent presets with editable individual scopes, and mark destructive tools for client-side confirmation.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Connect and revoke an AI client (Priority: P1)

A creator connects a compatible AI client, including a custom client, approves limited access, and can revoke it.

**Why this priority**: Connection is the entry point and must preserve user control.

**Independent Test**: Connect a newly registered custom client, read approved data, then revoke its access.

**BDD**: Required. **ATDD**: Required. All behavior and acceptance evidence for this story is enumerated below.

**Acceptance Scenarios**:

1. **Given** a compatible client has no prior Clipify configuration, **When** it discovers the service, **Then** it receives the service and authorization metadata. (FR-001)
2. **Given** a custom client has no Clipify session or assigned credentials, **When** it registers valid client metadata, **Then** it receives a client identity but cannot read creator data. (FR-002)
3. **Given** client registration metadata has an invalid callback or unsupported grant, **When** the client registers, **Then** registration is rejected and no client record is created. (FR-002, EC-001)
4. **Given** a registered client requests read access to a creator the user owns, **When** the signed-in user approves those permissions and that creator, **Then** the client reads that creator and cannot access an unapproved creator. (FR-003, SC-001)
5. **Given** the user is shown the client and requested permissions, **When** the user denies consent, **Then** no grant is issued and no creator data is accessible. (FR-003, EC-002)
6. **Given** an approved authorization code and matching proof exist, **When** the client exchanges the code, **Then** expiring access bound to Clipify MCP is issued. (FR-004)
7. **Given** missing PKCE proof is presented, **When** the client exchanges authorization, **Then** access is rejected without issuing tokens. (FR-004, EC-003)
8. **Given** incorrect PKCE proof is presented, **When** the client exchanges authorization, **Then** access is rejected without issuing tokens. (FR-004, EC-003)
9. **Given** a reused authorization code is presented, **When** the client exchanges authorization, **Then** access is rejected without issuing tokens. (FR-004, EC-003)
10. **Given** an expired authorization code is presented, **When** the client exchanges authorization, **Then** access is rejected without issuing tokens. (FR-004, EC-003)
11. **Given** an unregistered callback is presented, **When** the client exchanges authorization, **Then** access is rejected without issuing tokens. (FR-004, EC-003)
12. **Given** a changed callback is presented, **When** the client exchanges authorization, **Then** access is rejected without issuing tokens. (FR-004, EC-003)
13. **Given** the client presents missing access, **When** it calls a tool, **Then** the call is rejected without reading or changing creator data. (FR-004, EC-004, SC-004)
14. **Given** the client presents expired access, **When** it calls a tool, **Then** the call is rejected without reading or changing creator data. (FR-004, EC-004, SC-004)
15. **Given** the client presents an invalid signature, **When** it calls a tool, **Then** the call is rejected without reading or changing creator data. (FR-004, EC-004, SC-004)
16. **Given** the client presents an incorrect issuer, **When** it calls a tool, **Then** the call is rejected without reading or changing creator data. (FR-004, EC-004, SC-004)
17. **Given** the client presents an audience for another service, **When** it calls a tool, **Then** the call is rejected without reading or changing creator data. (FR-004, EC-004, SC-004)
18. **Given** a valid refresh grant exists, **When** the client refreshes access, **Then** renewed access preserves or narrows the approved permissions. (FR-004)
19. **Given** a refresh grant is expired or the client requests wider permissions, **When** the client refreshes access, **Then** the refresh is rejected without widening access. (FR-004, EC-005)
20. **Given** two connected clients have separate approved grants, **When** the user lists connections and revokes the first, **Then** the first client’s old access and refresh are rejected while the second remains usable. (FR-005, EC-006, SC-001, SC-004)

### User Story 2 - Manage overlays and playlists through chat (Priority: P1)

An authorized creator uses an AI client to inspect and manage overlays and playlists and sees the same changes in the dashboard.

**Why this priority**: This provides the initial useful Clipify management experience.

**Independent Test**: Exercise each initial operation through a connected client and verify resulting dashboard state.

**BDD**: Required. **ATDD**: Required. All behavior and acceptance evidence for this story is enumerated below.

**Acceptance Scenarios**:

1. **Given** owned, directly shared, agency-linked, and inaccessible creators exist, **When** the client lists creators, **Then** only creators permitted by both the grant and current membership appear. (FR-006)
2. **Given** the user selects an accessible creator with current usage and grants, **When** the client requests capabilities, **Then** the effective plan, current usage, limits, and eligible operations are reported. (FR-006)
3. **Given** an eligible creator has consent and current permission for list overlay, **When** the client performs list overlay, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
4. **Given** an eligible creator has consent and current permission for read overlay, **When** the client performs read overlay, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
5. **Given** an eligible creator has consent and current permission for create overlay, **When** the client performs create overlay, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
6. **Given** an eligible creator has consent and current permission for update overlay, **When** the client performs update overlay, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
7. **Given** an eligible creator has consent and current permission for delete overlay, **When** the client performs delete overlay, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
8. **Given** an eligible creator has consent and current permission for list playlist, **When** the client performs list playlist, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
9. **Given** an eligible creator has consent and current permission for read playlist, **When** the client performs read playlist, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
10. **Given** an eligible creator has consent and current permission for create playlist, **When** the client performs create playlist, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
11. **Given** an eligible creator has consent and current permission for update playlist, **When** the client performs update playlist, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
12. **Given** an eligible creator has consent and current permission for delete playlist, **When** the client performs delete playlist, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
13. **Given** an eligible creator has consent and current permission for add playlist item, **When** the client performs add playlist item, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
14. **Given** an eligible creator has consent and current permission for remove playlist item, **When** the client performs remove playlist item, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
15. **Given** an eligible creator has consent and current permission for reorder playlist item, **When** the client performs reorder playlist item, **Then** the correct result and resulting state are visible to the creator in the dashboard. (FR-007, SC-002)
16. **Given** the request includes an unknown input field, **When** the client submits the mutation, **Then** an invalid-input error is returned and no partial change occurs. (FR-012, EC-013)
17. **Given** the request includes an invalid identifier, **When** the client submits the mutation, **Then** an invalid-input error is returned and no partial change occurs. (FR-012, EC-013)
18. **Given** the request includes a wrong field type, **When** the client submits the mutation, **Then** an invalid-input error is returned and no partial change occurs. (FR-012, EC-013)
19. **Given** the request includes an out-of-range value, **When** the client submits the mutation, **Then** an invalid-input error is returned and no partial change occurs. (FR-012, EC-013)
20. **Given** the request includes an invalid playlist item reference, **When** the client submits the mutation, **Then** an invalid-input error is returned and no partial change occurs. (FR-012, EC-013)
21. **Given** the request includes a non-permutation playlist reorder, **When** the client submits the mutation, **Then** an invalid-input error is returned and no partial change occurs. (FR-012, EC-013)
22. **Given** a creator has overlays, OAuth connections, and runner credentials, **When** the client reads every supported tool result, **Then** no secret or credential appears and excluded operations are unavailable. (FR-012, SC-002)
23. **Given** a overlay create succeeds but its response is lost, **When** the client retries identical inputs with the same retry key, **Then** the original result is returned and exactly one resource exists. (FR-013, EC-014)
24. **Given** two identical overlay creates share a retry key, **When** they arrive concurrently, **Then** both return the same committed resource without duplicate creation. (FR-013, EC-014)
25. **Given** a overlay retry key already has a successful result, **When** the client reuses the key with changed inputs, **Then** a retry-conflict error occurs and the original resource is unchanged. (FR-013, EC-015)
26. **Given** a playlist create succeeds but its response is lost, **When** the client retries identical inputs with the same retry key, **Then** the original result is returned and exactly one resource exists. (FR-013, EC-014)
27. **Given** two identical playlist creates share a retry key, **When** they arrive concurrently, **Then** both return the same committed resource without duplicate creation. (FR-013, EC-014)
28. **Given** a playlist retry key already has a successful result, **When** the client reuses the key with changed inputs, **Then** a retry-conflict error occurs and the original resource is unchanged. (FR-013, EC-015)
29. **Given** two clients or actors or creators use the same textual retry key, **When** each performs an authorized creation, **Then** their independent requests do not reuse another context’s result. (FR-013)

### User Story 3 - Preserve permissions and plan limits everywhere (Priority: P1)

Creators receive the same backend rules whether requests originate in the browser or an AI client.

**Why this priority**: MCP must not become a route around existing product limits or delegated permissions.

**Independent Test**: Exercise allowed and denied requests across both interfaces, including concurrent creation and live entitlement changes.

**BDD**: Required. **ATDD**: Required. All behavior and acceptance evidence for this story is enumerated below.

**Acceptance Scenarios**:

1. **Given** the client lacks the operation scope, **When** the client attempts the affected operation, **Then** access is denied without revealing resource contents or changing state. (FR-008, EC-007, SC-004)
2. **Given** the team member lacks the operation permission, **When** the client attempts the affected operation, **Then** access is denied without revealing resource contents or changing state. (FR-008, EC-007, SC-004)
3. **Given** the resource belongs to an unapproved creator, **When** the client attempts the affected operation, **Then** access is denied without revealing resource contents or changing state. (FR-008, EC-007, SC-004)
4. **Given** the agency role exceeds the creator permission ceiling, **When** the client attempts the affected operation, **Then** access is denied without revealing resource contents or changing state. (FR-008, EC-007, SC-004)
5. **Given** the caller supplies a forged creator identity, **When** the client attempts the affected operation, **Then** access is denied without revealing resource contents or changing state. (FR-008, EC-007, SC-004)
6. **Given** a Free creator already has one overlay, **When** the browser requests another overlay, **Then** a plan-limit error reports usage and limit and no overlay is created. (FR-009, EC-008)
7. **Given** a Free creator lacks paid-feature access, **When** the browser attempts paid overlay settings, **Then** the paid-feature change is rejected and saved settings are preserved. (FR-009, EC-009)
8. **Given** a creator has effective Pro access through a subscription, **When** the browser creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
9. **Given** a creator has effective Pro access through a trial, **When** the browser creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
10. **Given** a creator has effective Pro access through a grant, **When** the browser creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
11. **Given** a creator has effective Pro access through a agency allocation, **When** the browser creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
12. **Given** a downgraded creator retains multiple overlay resources, **When** the browser reads a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
13. **Given** a downgraded creator retains multiple overlay resources, **When** the browser updates a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
14. **Given** a downgraded creator retains multiple overlay resources, **When** the browser runs a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
15. **Given** a downgraded creator retains multiple playlist resources, **When** the browser reads a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
16. **Given** a downgraded creator retains multiple playlist resources, **When** the browser updates a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
17. **Given** a downgraded creator retains multiple playlist resources, **When** the browser runs a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
18. **Given** a Free creator already has one overlay, **When** the MCP requests another overlay, **Then** a plan-limit error reports usage and limit and no overlay is created. (FR-009, EC-008)
19. **Given** a Free creator lacks paid-feature access, **When** the MCP attempts paid overlay settings, **Then** the paid-feature change is rejected and saved settings are preserved. (FR-009, EC-009)
20. **Given** a creator has effective Pro access through a subscription, **When** the MCP creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
21. **Given** a creator has effective Pro access through a trial, **When** the MCP creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
22. **Given** a creator has effective Pro access through a grant, **When** the MCP creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
23. **Given** a creator has effective Pro access through a agency allocation, **When** the MCP creates another overlay, **Then** creation follows the current effective plan rather than the actor’s personal plan. (FR-009)
24. **Given** a downgraded creator retains multiple overlay resources, **When** the MCP reads a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
25. **Given** a downgraded creator retains multiple overlay resources, **When** the MCP updates a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
26. **Given** a downgraded creator retains multiple overlay resources, **When** the MCP runs a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
27. **Given** a downgraded creator retains multiple playlist resources, **When** the MCP reads a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
28. **Given** a downgraded creator retains multiple playlist resources, **When** the MCP updates a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
29. **Given** a downgraded creator retains multiple playlist resources, **When** the MCP runs a retained resource, **Then** the operation follows the existing retained-resource policy without deleting saved paid settings. (FR-009, EC-010)
30. **Given** an empty Free creator has no active qualifying entitlement, **When** twenty all browser creation requests execute concurrently, **Then** exactly one overlay exists and nineteen requests receive plan-limit errors. (FR-010, EC-011, SC-003)
31. **Given** an empty Free creator has no active qualifying entitlement, **When** twenty all MCP creation requests execute concurrently, **Then** exactly one overlay exists and nineteen requests receive plan-limit errors. (FR-010, EC-011, SC-003)
32. **Given** an empty Free creator has no active qualifying entitlement, **When** twenty ten browser and ten MCP creation requests execute concurrently, **Then** exactly one overlay exists and nineteen requests receive plan-limit errors. (FR-010, EC-011, SC-003)
33. **Given** a client has connected before a creator’s upgrade, **When** the change occurs and the client makes its next mutation, **Then** current permissions, lifecycle, and entitlements determine the result without reconnecting. (FR-011, EC-012, SC-004)
34. **Given** a client has connected before a creator’s downgrade, **When** the change occurs and the client makes its next mutation, **Then** current permissions, lifecycle, and entitlements determine the result without reconnecting. (FR-011, EC-012, SC-004)
35. **Given** a client has connected before a creator’s trial expiry, **When** the change occurs and the client makes its next mutation, **Then** current permissions, lifecycle, and entitlements determine the result without reconnecting. (FR-011, EC-012, SC-004)
36. **Given** a client has connected before a creator’s grant expiry, **When** the change occurs and the client makes its next mutation, **Then** current permissions, lifecycle, and entitlements determine the result without reconnecting. (FR-011, EC-012, SC-004)
37. **Given** a client has connected before a creator’s team removal, **When** the change occurs and the client makes its next mutation, **Then** current permissions, lifecycle, and entitlements determine the result without reconnecting. (FR-011, EC-012, SC-004)
38. **Given** a client has connected before a creator’s agency unlinking, **When** the change occurs and the client makes its next mutation, **Then** current permissions, lifecycle, and entitlements determine the result without reconnecting. (FR-011, EC-012, SC-004)
39. **Given** a client has connected before a creator’s account suspension, **When** the change occurs and the client makes its next mutation, **Then** current permissions, lifecycle, and entitlements determine the result without reconnecting. (FR-011, EC-012, SC-004)
40. **Given** a requested resource is absent or inaccessible, **When** the client requests it, **Then** a safe unavailable-resource error reveals no private existence or contents. (FR-014, EC-016)
41. **Given** a persistence failure occurs during a mutation, **When** the client receives the outcome, **Then** a service-failure error appears without false success or partial resource changes. (FR-014, EC-017)
42. **Given** a dependent-service timeout occurs during a mutation, **When** the client receives the outcome, **Then** a service-failure error appears without false success or partial resource changes. (FR-014, EC-017)

### User Story 4 - Inspect and control connected-client activity (Priority: P2)

A creator reviews client activity and retains control when a client generates excessive requests.

**Why this priority**: Users need accountability and predictable behavior for automated clients.

**Independent Test**: Inspect successful and denied operations and exhaust isolated registration and call budgets.

**BDD**: Required. **ATDD**: Required. All behavior and acceptance evidence for this story is enumerated below.

**Acceptance Scenarios**:

1. **Given** a registration caller exhausts its configured registration budget, **When** it submits another registration, **Then** registration is throttled with retry guidance and no client record is created. (FR-015, EC-018, SC-005)
2. **Given** a client exhausts its configured tool-call budget, **When** it attempts another mutation, **Then** the call is throttled with retry guidance and no business resource changes. (FR-015, EC-019, SC-005)
3. **Given** a connected client has successful and denied authenticated operations, **When** an authorized user inspects activity, **Then** each entry identifies actor, client, creator, operation, time, and outcome without secrets or private payloads. (FR-016, SC-005)
4. **Given** a user cannot access another creator’s activity, **When** the user requests that activity, **Then** access is denied and the activity remains private. (FR-016, EC-020)

### Edge Cases

- **EC-001**: client registration metadata has an invalid callback or unsupported grant; registration is rejected and no client record is created.
- **EC-002**: the user is shown the client and requested permissions; no grant is issued and no creator data is accessible.
- **EC-003**: missing PKCE proof is presented; access is rejected without issuing tokens / incorrect PKCE proof is presented; access is rejected without issuing tokens / a reused authorization code is presented; access is rejected without issuing tokens / an expired authorization code is presented; access is rejected without issuing tokens / an unregistered callback is presented; access is rejected without issuing tokens / a changed callback is presented; access is rejected without issuing tokens.
- **EC-004**: the client presents missing access; the call is rejected without reading or changing creator data / the client presents expired access; the call is rejected without reading or changing creator data / the client presents an invalid signature; the call is rejected without reading or changing creator data / the client presents an incorrect issuer; the call is rejected without reading or changing creator data / the client presents an audience for another service; the call is rejected without reading or changing creator data.
- **EC-005**: a refresh grant is expired or the client requests wider permissions; the refresh is rejected without widening access.
- **EC-006**: two connected clients have separate approved grants; the first client’s old access and refresh are rejected while the second remains usable.
- **EC-007**: the client lacks the operation scope; access is denied without revealing resource contents or changing state / the team member lacks the operation permission; access is denied without revealing resource contents or changing state / the resource belongs to an unapproved creator; access is denied without revealing resource contents or changing state / the agency role exceeds the creator permission ceiling; access is denied without revealing resource contents or changing state / the caller supplies a forged creator identity; access is denied without revealing resource contents or changing state.
- **EC-008**: a Free creator already has one overlay; a plan-limit error reports usage and limit and no overlay is created.
- **EC-009**: a Free creator lacks paid-feature access; the paid-feature change is rejected and saved settings are preserved.
- **EC-010**: a downgraded creator retains multiple overlay resources; the operation follows the existing retained-resource policy without deleting saved paid settings / a downgraded creator retains multiple playlist resources; the operation follows the existing retained-resource policy without deleting saved paid settings.
- **EC-011**: an empty Free creator has no active qualifying entitlement; exactly one overlay exists and nineteen requests receive plan-limit errors.
- **EC-012**: a client has connected before a creator’s upgrade; current permissions, lifecycle, and entitlements determine the result without reconnecting / a client has connected before a creator’s downgrade; current permissions, lifecycle, and entitlements determine the result without reconnecting / a client has connected before a creator’s trial expiry; current permissions, lifecycle, and entitlements determine the result without reconnecting / a client has connected before a creator’s grant expiry; current permissions, lifecycle, and entitlements determine the result without reconnecting / a client has connected before a creator’s team removal; current permissions, lifecycle, and entitlements determine the result without reconnecting / a client has connected before a creator’s agency unlinking; current permissions, lifecycle, and entitlements determine the result without reconnecting / a client has connected before a creator’s account suspension; current permissions, lifecycle, and entitlements determine the result without reconnecting.
- **EC-013**: the request includes an unknown input field; an invalid-input error is returned and no partial change occurs / the request includes an invalid identifier; an invalid-input error is returned and no partial change occurs / the request includes a wrong field type; an invalid-input error is returned and no partial change occurs / the request includes an out-of-range value; an invalid-input error is returned and no partial change occurs / the request includes an invalid playlist item reference; an invalid-input error is returned and no partial change occurs / the request includes a non-permutation playlist reorder; an invalid-input error is returned and no partial change occurs.
- **EC-014**: a overlay create succeeds but its response is lost; the original result is returned and exactly one resource exists / two identical overlay creates share a retry key; both return the same committed resource without duplicate creation / a playlist create succeeds but its response is lost; the original result is returned and exactly one resource exists / two identical playlist creates share a retry key; both return the same committed resource without duplicate creation.
- **EC-015**: a overlay retry key already has a successful result; a retry-conflict error occurs and the original resource is unchanged / a playlist retry key already has a successful result; a retry-conflict error occurs and the original resource is unchanged.
- **EC-016**: a requested resource is absent or inaccessible; a safe unavailable-resource error reveals no private existence or contents.
- **EC-017**: a persistence failure occurs during a mutation; a service-failure error appears without false success or partial resource changes / a dependent-service timeout occurs during a mutation; a service-failure error appears without false success or partial resource changes.
- **EC-018**: a registration caller exhausts its configured registration budget; registration is throttled with retry guidance and no client record is created.
- **EC-019**: a client exhausts its configured tool-call budget; the call is throttled with retry guidance and no business resource changes.
- **EC-020**: a user cannot access another creator’s activity; access is denied and the activity remains private.

- **EC-021**: A browser or MCP edit supplies a missing or stale revision; reject without changing the resource and require a fresh read. Concurrent edits from the same revision cannot both overwrite each other.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Compatible clients MUST discover Clipify’s protected MCP service and authorization information without a vendor-specific allowlist. First-release acceptance MUST cover ChatGPT, Claude, Codex, and a newly registered custom compatible client.
- **FR-002**: Custom clients MUST be able to register dynamically through OAuth2 without a pre-existing Clipify session or manually issued client credentials. Registration alone MUST grant no account access.
- **FR-003**: Users MUST sign in through their existing Clipify account and explicitly approve the client, requested permissions, and explicitly selected creator set before access is granted; denial MUST grant no access. Consent MUST offer Read and Read & edit presets and show individually selectable permissions below them. Read grants read-only access; Read & edit adds create, update, and playlist-item management, but deletion requires a separate explicit opt-in. Users may customize either preset; only the final approved permissions are granted.
- **FR-004**: Authorization MUST use the authorization-code flow with proof of possession of the authorization request (PKCE), validate registered callback destinations, and issue expiring access bound to Clipify’s MCP service. Refresh MUST preserve or narrow the approved grant.
- **FR-005**: Users MUST be able to list connected clients and revoke their grants. Revocation MUST prevent subsequent tool calls and refreshes, including use of previously issued access.
- **FR-006**: Tools MUST list only creators in both the connection’s explicitly approved creator set and the user’s current accessible creators; adding a creator MUST require new consent. Tools MUST expose the selected creator’s current effective plan, resource usage, limits, and available capabilities.
- **FR-007**: Tools MUST support listing, reading, creating, updating, and deleting overlays, and listing, reading, creating, updating, and deleting playlists plus adding, removing, and reordering playlist items. Successful changes MUST be visible in the dashboard. Overlay and playlist edits, including playlist-item changes, MUST supply the revision last read; a missing or stale revision MUST be rejected without overwriting current state. The client MUST fetch the latest state before retrying. A matching revision permits the edit and advances the revision.
- **FR-008**: Every operation MUST enforce the intersection of approved client permissions, current user permissions, creator/team/agency access, resource ownership, account lifecycle, and current resource-owner entitlements. A caller-supplied creator or resource identifier MUST never establish authority.
- **FR-009**: The backend MUST enforce the same resource quotas and paid-feature restrictions for browser and MCP requests, including alternate supported creation paths. Free creators without an active qualifying entitlement MUST have at most one newly creatable overlay; existing retained resources MUST follow current downgrade policy.
- **FR-010**: Concurrent mutations MUST enforce quotas atomically across browser and MCP requests. Twenty overlay creations for an empty Free creator MUST produce exactly one overlay and nineteen limit denials when no other failures occur.
- **FR-011**: Permissions and entitlements MUST be re-evaluated for every mutation. Upgrade, downgrade, trial/grant expiry, team removal, agency unlinking, and account suspension MUST affect subsequent requests without reconnecting the client.
- **FR-012**: Tool inputs MUST be validated and outputs MUST exclude session cookies, OAuth credentials, Twitch credentials, overlay secrets, and runner credentials. Initial tools MUST NOT expose credential, billing mutation, membership mutation, or account deletion operations.
- **FR-013**: Mutating creates MUST support a caller-provided retry key scoped to the client, approved actor, creator, and operation: repeated identical requests MUST return the same result without duplicate resources; changed inputs with that key MUST be rejected.
- **FR-014**: Denied requests MUST return distinct actionable errors for authentication, missing client permission, denied creator access, unavailable resources, plan limits, paid features, invalid input, retry conflicts, stale-edit conflicts, throttling, and service failures. Errors MUST neither expose inaccessible data nor report a failed mutation as successful.
- **FR-015**: Client registration and tool requests MUST be rate-limited. Registration abuse MUST NOT create unbounded client records; excessive calls MUST be rejected with retry guidance without circumventing quotas.
- **FR-016**: Authorized users MUST be able to inspect connected-client activity showing actor, client, creator context, operation, time, and outcome for successful and denied authenticated tool calls. Activity MUST exclude credentials and private payload contents.

- **FR-017**: Concurrent browser and MCP edits MUST compare the supplied revision and commit atomically. If both edits start from the same revision, at most one succeeds; the other receives a stale-edit conflict with guidance to fetch the latest state. Browser edits MUST participate in the same revision rules.

- **FR-018**: Overlay and playlist deletion MUST require explicit resource-specific delete permission approved during consent in addition to current backend authorization. After that approval, Clipify MUST allow chat deletion without a separate dashboard confirmation. Tool discovery MUST accurately identify read-only operations and potentially destructive operations, including deletion and destructive edits, through standard MCP risk annotations so supporting clients can request confirmation. Client confirmation behavior is controlled by each client and MUST NOT be treated as backend authorization or promised for arbitrary clients.

### Key Entities

- **Client**: A compatible application identity, its declared callback destinations, and registration metadata.
- **Connection grant**: User consent connecting a client to approved permissions and an explicitly selected creator set, with expiration and revocation state.
- **Actor and creator context**: The authenticated user and selected creator, including direct or agency permissions; these are distinct identities.
- **Capability snapshot**: Current effective entitlements, resource usage, limits, and eligible operations for the resource owner.
- **Managed resource**: Existing overlays, playlists, and playlist items with their creator ownership, retained-resource status, and current revision used to detect stale edits; playlist-item changes advance the parent playlist revision.
- **Retry record**: A mutation key, approved context, input identity, and committed result.
- **Client activity entry**: Minimal operation attribution and outcome, readable only through authorized creator access.

- **Consent presets**: Read includes discovery and permitted reads; Read & edit adds creates, updates, and playlist-item management. Neither preset silently grants overlay or playlist deletion. Individual permissions remain editable before approval.
- **Destructive action handling**: Standard MCP annotations include `readOnlyHint` and `destructiveHint`. Destructive hints are advisory; the backend always checks the approved permission and current resource access, including for custom clients that ignore hints. Required-client acceptance records whether each host displays confirmation, without equating this UI behavior to permission enforcement.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For each of ChatGPT, Claude, Codex, and a newly registered custom compatible client, a user can connect, approve access, complete a permitted read and mutation, revoke access, and observe rejection of subsequent access within five minutes in a controlled acceptance run; denying consent grants no access.
- **SC-002**: Every initial overlay and playlist operation completes successfully for an authorized eligible creator, with the resulting state visible in the dashboard and no credential disclosure.
- **SC-003**: For twenty simultaneous overlay creations against an empty Free creator, every all-browser, all-MCP, and mixed ten-browser/ten-MCP run ends with exactly one overlay and nineteen plan-limit errors.
- **SC-004**: All tested unauthorized, expired, revoked, cross-creator, suspended, and plan-restricted requests are rejected without unauthorized data disclosure or state changes.
- **SC-005**: Users can find and revoke each connected client and identify its successful and denied authenticated operations; throttled requests include retry guidance and do not change business resources.

## Assumptions

- Initial scope is creator discovery, capability inspection, overlay CRUD, playlist CRUD, and playlist item management. Gallery, runner, playback control, billing mutations, membership changes, credentials, and account deletion are deferred.
- Existing effective-plan rules, team/agency permission ceilings, Free runtime normalization, and retained-resource policies remain authoritative. This feature does not introduce new plan prices or new paid limits.
- Dynamic OAuth2 client registration is an explicit requirement. Client metadata document identification may additionally be supported; protocol-version and client compatibility decisions belong to planning.
- A connection grants access to an explicitly selected set of creators. Each operation selects one creator from that set and revalidates current access. Adding a creator requires new user consent; newly acquired memberships or agency links never expand an existing grant automatically. Creator discovery exposes only the intersection of the approved set and current user access.
- The first release MUST demonstrate connection, approved reads and mutations, consent denial, and revocation through each of ChatGPT, Claude, Codex, and a newly registered custom standards-compatible client. Vendor account eligibility and product configuration are external prerequisites; unavailable prerequisites must be reported as blocked acceptance evidence rather than silently dropping a required client.
- Retry keys are mandatory for initial create tools and retained for at least 24 hours. After this period a client must use a new key and inspect existing state before retrying an uncertain creation.
- Registration and tool-call budgets use documented deployment settings; tests isolate and exhaust those settings rather than prescribing new commercial quotas.
- No production behavior is implemented during specification. Generated database migrations remain owned by the existing post-merge workflow.

## Test-First Specification Addendum _(mandatory)_

### Test Classification and Applicability Matrix

All sources require TDD, BDD, and ATDD. Each behavior below is also a stakeholder release boundary, so its BDD-owned scenario supplies both BDD and ATDD evidence. This equivalence is recorded per scenario; no separately owned duplicate acceptance test is planned.

| Source ID | Source Type            | TDD      | BDD      | ATDD     | Owning suites and test intent                                                                                |
| --------- | ---------------------- | -------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| US1       | User Story             | Required | Required | Required | TDD inventory and BDD scenarios tagged US1; prove the complete independent journey.                          |
| US2       | User Story             | Required | Required | Required | TDD inventory and BDD scenarios tagged US2; prove the complete independent journey.                          |
| US3       | User Story             | Required | Required | Required | TDD inventory and BDD scenarios tagged US3; prove the complete independent journey.                          |
| US4       | User Story             | Required | Required | Required | TDD inventory and BDD scenarios tagged US4; prove the complete independent journey.                          |
| FR-001    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-001; each listed positive, invalid, boundary, and transition case. |
| FR-002    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-002; each listed positive, invalid, boundary, and transition case. |
| FR-003    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-003; each listed positive, invalid, boundary, and transition case. |
| FR-004    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-004; each listed positive, invalid, boundary, and transition case. |
| FR-005    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-005; each listed positive, invalid, boundary, and transition case. |
| FR-006    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-006; each listed positive, invalid, boundary, and transition case. |
| FR-007    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-007; each listed positive, invalid, boundary, and transition case. |
| FR-008    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-008; each listed positive, invalid, boundary, and transition case. |
| FR-009    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-009; each listed positive, invalid, boundary, and transition case. |
| FR-010    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-010; each listed positive, invalid, boundary, and transition case. |
| FR-011    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-011; each listed positive, invalid, boundary, and transition case. |
| FR-012    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-012; each listed positive, invalid, boundary, and transition case. |
| FR-013    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-013; each listed positive, invalid, boundary, and transition case. |
| FR-014    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-014; each listed positive, invalid, boundary, and transition case. |
| FR-015    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-015; each listed positive, invalid, boundary, and transition case. |
| FR-016    | Functional Requirement | Required | Required | Required | TDD inventory and BDD scenarios tagged FR-016; each listed positive, invalid, boundary, and transition case. |
| SC-001    | Success Criterion      | Required | Required | Required | Scenarios tagged SC-001 and their TDD rows prove the measurable release outcome.                             |
| SC-002    | Success Criterion      | Required | Required | Required | Scenarios tagged SC-002 and their TDD rows prove the measurable release outcome.                             |
| SC-003    | Success Criterion      | Required | Required | Required | Scenarios tagged SC-003 and their TDD rows prove the measurable release outcome.                             |
| SC-004    | Success Criterion      | Required | Required | Required | Scenarios tagged SC-004 and their TDD rows prove the measurable release outcome.                             |
| SC-005    | Success Criterion      | Required | Required | Required | Scenarios tagged SC-005 and their TDD rows prove the measurable release outcome.                             |
| EC-001    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-001 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-002    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-002 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-003    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-003 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-004    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-004 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-005    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-005 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-006    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-006 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-007    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-007 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-008    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-008 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-009    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-009 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-010    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-010 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-011    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-011 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-012    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-012 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-013    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-013 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-014    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-014 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-015    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-015 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-016    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-016 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-017    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-017 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-018    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-018 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-019    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-019 and their TDD rows prove the specific rejection or boundary outcome.                 |
| EC-020    | Edge/Error Condition   | Required | Required | Required | Scenarios tagged EC-020 and their TDD rows prove the specific rejection or boundary outcome.                 |

| FR-017 | Functional Requirement | Required | Required | Required | TDD-US2-038 and BDD-US2-030 examples prove atomic revision enforcement across browser and MCP. |
| EC-021 | Edge/Error Condition | Required | Required | Required | BDD-US2-030, BDD-US2-031 and TDD-US2-038 prove conflicts and recovery. |

| FR-018 | Functional Requirement | Required | Required | Required | BDD-US1-024 and BDD-US2-032 plus TDD-US1-027 and TDD-US2-039 cover consent presets, delete permission and risk discovery. |

### Scenario Granularity Rules

Each scenario is a separately bound executable case. No sampling is assumed. Operation cases enumerate all initial verbs and resource types. Concurrency enumerates all-browser, all-MCP, and mixed calls. Pro entitlement sources and retained-resource actions are enumerated separately. Each mutation must additionally execute the permission and validation examples against its real entry point as required by the TDD inventory; no implementation may exempt a mutation from the shared backend rules. Inventory rows may own multiple explicit examples only when their observable outcomes are equivalent.

### ATDD Acceptance Evidence _(Gherkin, mandatory when ATDD is Required)_

The BDD-owned scenarios in the next section also carry the ATDD evidence role. Each asserts the same concrete user-visible behavior and stakeholder release outcome, so the two intents are equivalent. The five-minute SC-001 connection journey must time connection through revocation using the same scenario bindings and shared fixture, with no duplicated product-test artifact.

### BDD Behavior Evidence _(Gherkin, mandatory when BDD is Required)_

The complete catalogue below remains the specification. Runnable feature files are materialized one slice at a time under `test/bdd/features/mcp-support/`, with one BDD ownership tag and both evidence roles recorded in traceability; only examples whose bindings are ready enter executable features. Every catalogue example is mandatory before release; partial materialization is development staging, not approved sampling. Planned bindings in `test/bdd/steps/mcp-support.steps.ts`. Evidence is planned here; bindings and executions follow in the test-first implementation phase.

```gherkin
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
  @US1 @FR-003 @SC-001
  @BDD-US1-004
  Scenario: The signed-in user approves those permissions and that creator — a registered client requests read access to a creator the user owns
    Given a registered client requests read access to a creator the user owns
    When the signed-in user approves those permissions and that creator
    Then the client reads that creator and cannot access an unapproved creator

  @US1 @FR-003 @EC-002
  @BDD-US1-005
  Scenario: The user denies consent — the user is shown the client and requested permissions
    Given the user is shown the client and requested permissions
    When the user denies consent
    Then no grant is issued and no creator data is accessible

  @US1 @FR-004
  @BDD-US1-006
  Scenario: The client exchanges the code — an approved authorization code and matching proof exist
    Given an approved authorization code and matching proof exist
    When the client exchanges the code
    Then expiring access bound to Clipify MCP is issued

  @US1 @FR-004 @EC-003
  @BDD-US1-007
  Scenario: The client exchanges authorization — missing PKCE proof is presented
    Given missing PKCE proof is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1 @FR-004 @EC-003
  @BDD-US1-008
  Scenario: The client exchanges authorization — incorrect PKCE proof is presented
    Given incorrect PKCE proof is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1 @FR-004 @EC-003
  @BDD-US1-009
  Scenario: The client exchanges authorization — a reused authorization code is presented
    Given a reused authorization code is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1 @FR-004 @EC-003
  @BDD-US1-010
  Scenario: The client exchanges authorization — an expired authorization code is presented
    Given an expired authorization code is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1 @FR-004 @EC-003
  @BDD-US1-011
  Scenario: The client exchanges authorization — an unregistered callback is presented
    Given an unregistered callback is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1 @FR-004 @EC-003
  @BDD-US1-012
  Scenario: The client exchanges authorization — a changed callback is presented
    Given a changed callback is presented
    When the client exchanges authorization
    Then access is rejected without issuing tokens

  @US1 @FR-004 @EC-004 @SC-004
  @BDD-US1-013
  Scenario: It calls a tool — the client presents missing access
    Given the client presents missing access
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1 @FR-004 @EC-004 @SC-004
  @BDD-US1-014
  Scenario: It calls a tool — the client presents expired access
    Given the client presents expired access
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1 @FR-004 @EC-004 @SC-004
  @BDD-US1-015
  Scenario: It calls a tool — the client presents an invalid signature
    Given the client presents an invalid signature
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1 @FR-004 @EC-004 @SC-004
  @BDD-US1-016
  Scenario: It calls a tool — the client presents an incorrect issuer
    Given the client presents an incorrect issuer
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1 @FR-004 @EC-004 @SC-004
  @BDD-US1-017
  Scenario: It calls a tool — the client presents an audience for another service
    Given the client presents an audience for another service
    When it calls a tool
    Then the call is rejected without reading or changing creator data

  @US1 @FR-004
  @BDD-US1-018
  Scenario: The client refreshes access — a valid refresh grant exists
    Given a valid refresh grant exists
    When the client refreshes access
    Then renewed access preserves or narrows the approved permissions

  @US1 @FR-004 @EC-005
  @BDD-US1-019
  Scenario Outline: The client refreshes access — a refresh grant is expired or the client requests wider permissions
    Given the client presents <invalid>
    When the client refreshes access
    Then refresh is rejected without widening access

    Examples:
      | invalid |
      | an expired refresh grant |
      | a request for wider permissions |
  @US1 @FR-005 @EC-006 @SC-001 @SC-004
  @BDD-US1-020
  Scenario: The user lists connections and revokes the first — two connected clients have separate approved grants
    Given two connected clients have separate approved grants
    When the user lists connections and revokes the first
    Then the first client’s old access and refresh are rejected while the second remains usable

  @US2 @FR-006
  @BDD-US2-001
  Scenario: The client lists creators — owned, directly shared, agency-linked, and inaccessible creators exist
    Given owned, directly shared, agency-linked, and inaccessible creators exist
    When the client lists creators
    Then only creators permitted by both the grant and current membership appear

  @US2 @FR-006
  @BDD-US2-002
  Scenario: The client requests capabilities — the user selects an accessible creator with current usage and grants
    Given the user selects an accessible creator with current usage and grants
    When the client requests capabilities
    Then the effective plan, current usage, limits, and eligible operations are reported

  @US2 @FR-007 @SC-002
  @BDD-US2-003
  Scenario: The client performs list overlay — an eligible creator has consent and current permission for list overlay
    Given an eligible creator has consent and current permission for list overlay
    When the client performs list overlay
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-004
  Scenario: The client performs read overlay — an eligible creator has consent and current permission for read overlay
    Given an eligible creator has consent and current permission for read overlay
    When the client performs read overlay
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-005
  Scenario: The client performs create overlay — an eligible creator has consent and current permission for create overlay
    Given an eligible creator has consent and current permission for create overlay
    When the client performs create overlay
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-006
  Scenario: The client performs update overlay — an eligible creator has consent and current permission for update overlay
    Given an eligible creator has consent and current permission for update overlay
    When the client performs update overlay
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-007
  Scenario: The client performs delete overlay — an eligible creator has consent and current permission for delete overlay
    Given an eligible creator has consent and current permission for delete overlay
    When the client performs delete overlay
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-008
  Scenario: The client performs list playlist — an eligible creator has consent and current permission for list playlist
    Given an eligible creator has consent and current permission for list playlist
    When the client performs list playlist
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-009
  Scenario: The client performs read playlist — an eligible creator has consent and current permission for read playlist
    Given an eligible creator has consent and current permission for read playlist
    When the client performs read playlist
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-010
  Scenario: The client performs create playlist — an eligible creator has consent and current permission for create playlist
    Given an eligible creator has consent and current permission for create playlist
    When the client performs create playlist
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-011
  Scenario: The client performs update playlist — an eligible creator has consent and current permission for update playlist
    Given an eligible creator has consent and current permission for update playlist
    When the client performs update playlist
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-012
  Scenario: The client performs delete playlist — an eligible creator has consent and current permission for delete playlist
    Given an eligible creator has consent and current permission for delete playlist
    When the client performs delete playlist
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-013
  Scenario: The client performs add playlist item — an eligible creator has consent and current permission for add playlist item
    Given an eligible creator has consent and current permission for add playlist item
    When the client performs add playlist item
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-014
  Scenario: The client performs remove playlist item — an eligible creator has consent and current permission for remove playlist item
    Given an eligible creator has consent and current permission for remove playlist item
    When the client performs remove playlist item
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US2 @FR-007 @SC-002
  @BDD-US2-015
  Scenario: The client performs reorder playlist item — an eligible creator has consent and current permission for reorder playlist item
    Given an eligible creator has consent and current permission for reorder playlist item
    When the client performs reorder playlist item
    Then the correct result and resulting state are visible to the creator in the dashboard

  @US3 @FR-008 @EC-007 @SC-004
  @BDD-US3-001
  Scenario: The client attempts the affected operation — the client lacks the operation scope
    Given the client lacks the operation scope
    When the client attempts the affected operation
    Then access is denied without revealing resource contents or changing state

  @US3 @FR-008 @EC-007 @SC-004
  @BDD-US3-002
  Scenario: The client attempts the affected operation — the team member lacks the operation permission
    Given the team member lacks the operation permission
    When the client attempts the affected operation
    Then access is denied without revealing resource contents or changing state

  @US3 @FR-008 @EC-007 @SC-004
  @BDD-US3-003
  Scenario: The client attempts the affected operation — the resource belongs to an unapproved creator
    Given the resource belongs to an unapproved creator
    When the client attempts the affected operation
    Then access is denied without revealing resource contents or changing state

  @US3 @FR-008 @EC-007 @SC-004
  @BDD-US3-004
  Scenario: The client attempts the affected operation — the agency role exceeds the creator permission ceiling
    Given the agency role exceeds the creator permission ceiling
    When the client attempts the affected operation
    Then access is denied without revealing resource contents or changing state

  @US3 @FR-008 @EC-007 @SC-004
  @BDD-US3-005
  Scenario: The client attempts the affected operation — the caller supplies a forged creator identity
    Given the caller supplies a forged creator identity
    When the client attempts the affected operation
    Then access is denied without revealing resource contents or changing state

  @US3 @FR-009 @EC-008
  @BDD-US3-006
  Scenario: The browser requests another overlay — a Free creator already has one overlay
    Given a Free creator already has one overlay
    When the browser requests another overlay
    Then a plan-limit error reports usage and limit and no overlay is created

  @US3 @FR-009 @EC-009
  @BDD-US3-007
  Scenario: The browser attempts paid overlay settings — a Free creator lacks paid-feature access
    Given a Free creator lacks paid-feature access
    When the browser attempts paid overlay settings
    Then the paid-feature change is rejected and saved settings are preserved

  @US3 @FR-009
  @BDD-US3-008
  Scenario: The browser creates another overlay — a creator has effective Pro access through a subscription
    Given a creator has effective Pro access through a subscription
    When the browser creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009
  @BDD-US3-009
  Scenario: The browser creates another overlay — a creator has effective Pro access through a trial
    Given a creator has effective Pro access through a trial
    When the browser creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009
  @BDD-US3-010
  Scenario: The browser creates another overlay — a creator has effective Pro access through a grant
    Given a creator has effective Pro access through a grant
    When the browser creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009
  @BDD-US3-011
  Scenario: The browser creates another overlay — a creator has effective Pro access through a agency allocation
    Given a creator has effective Pro access through a agency allocation
    When the browser creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009 @EC-010
  @BDD-US3-012
  Scenario: The browser reads a retained resource — a downgraded creator retains multiple overlay resources
    Given a downgraded creator retains multiple overlay resources
    When the browser reads a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-013
  Scenario: The browser updates a retained resource — a downgraded creator retains multiple overlay resources
    Given a downgraded creator retains multiple overlay resources
    When the browser updates a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-014
  Scenario: The browser runs a retained resource — a downgraded creator retains multiple overlay resources
    Given a downgraded creator retains multiple overlay resources
    When the browser runs a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-015
  Scenario: The browser reads a retained resource — a downgraded creator retains multiple playlist resources
    Given a downgraded creator retains multiple playlist resources
    When the browser reads a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-016
  Scenario: The browser updates a retained resource — a downgraded creator retains multiple playlist resources
    Given a downgraded creator retains multiple playlist resources
    When the browser updates a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-017
  Scenario: The browser runs a retained resource — a downgraded creator retains multiple playlist resources
    Given a downgraded creator retains multiple playlist resources
    When the browser runs a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-008
  @BDD-US3-018
  Scenario: The MCP requests another overlay — a Free creator already has one overlay
    Given a Free creator already has one overlay
    When the MCP requests another overlay
    Then a plan-limit error reports usage and limit and no overlay is created

  @US3 @FR-009 @EC-009
  @BDD-US3-019
  Scenario: The MCP attempts paid overlay settings — a Free creator lacks paid-feature access
    Given a Free creator lacks paid-feature access
    When the MCP attempts paid overlay settings
    Then the paid-feature change is rejected and saved settings are preserved

  @US3 @FR-009
  @BDD-US3-020
  Scenario: The MCP creates another overlay — a creator has effective Pro access through a subscription
    Given a creator has effective Pro access through a subscription
    When the MCP creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009
  @BDD-US3-021
  Scenario: The MCP creates another overlay — a creator has effective Pro access through a trial
    Given a creator has effective Pro access through a trial
    When the MCP creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009
  @BDD-US3-022
  Scenario: The MCP creates another overlay — a creator has effective Pro access through a grant
    Given a creator has effective Pro access through a grant
    When the MCP creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009
  @BDD-US3-023
  Scenario: The MCP creates another overlay — a creator has effective Pro access through a agency allocation
    Given a creator has effective Pro access through a agency allocation
    When the MCP creates another overlay
    Then creation follows the current effective plan rather than the actor’s personal plan

  @US3 @FR-009 @EC-010
  @BDD-US3-024
  Scenario: The MCP reads a retained resource — a downgraded creator retains multiple overlay resources
    Given a downgraded creator retains multiple overlay resources
    When the MCP reads a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-025
  Scenario: The MCP updates a retained resource — a downgraded creator retains multiple overlay resources
    Given a downgraded creator retains multiple overlay resources
    When the MCP updates a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-026
  Scenario: The MCP runs a retained resource — a downgraded creator retains multiple overlay resources
    Given a downgraded creator retains multiple overlay resources
    When the MCP runs a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-027
  Scenario: The MCP reads a retained resource — a downgraded creator retains multiple playlist resources
    Given a downgraded creator retains multiple playlist resources
    When the MCP reads a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-028
  Scenario: The MCP updates a retained resource — a downgraded creator retains multiple playlist resources
    Given a downgraded creator retains multiple playlist resources
    When the MCP updates a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-009 @EC-010
  @BDD-US3-029
  Scenario: The MCP runs a retained resource — a downgraded creator retains multiple playlist resources
    Given a downgraded creator retains multiple playlist resources
    When the MCP runs a retained resource
    Then the operation follows the existing retained-resource policy without deleting saved paid settings

  @US3 @FR-010 @EC-011 @SC-003
  @BDD-US3-030
  Scenario: Twenty all browser creation requests execute concurrently — an empty Free creator has no active qualifying entitlement
    Given an empty Free creator has no active qualifying entitlement
    When twenty all browser creation requests execute concurrently
    Then exactly one overlay exists and nineteen requests receive plan-limit errors

  @US3 @FR-010 @EC-011 @SC-003
  @BDD-US3-031
  Scenario: Twenty all MCP creation requests execute concurrently — an empty Free creator has no active qualifying entitlement
    Given an empty Free creator has no active qualifying entitlement
    When twenty all MCP creation requests execute concurrently
    Then exactly one overlay exists and nineteen requests receive plan-limit errors

  @US3 @FR-010 @EC-011 @SC-003
  @BDD-US3-032
  Scenario: Twenty ten browser and ten MCP creation requests execute concurrently — an empty Free creator has no active qualifying entitlement
    Given an empty Free creator has no active qualifying entitlement
    When twenty ten browser and ten MCP creation requests execute concurrently
    Then exactly one overlay exists and nineteen requests receive plan-limit errors

  @US3 @FR-011 @EC-012 @SC-004
  @BDD-US3-033
  Scenario: The change occurs and the client makes its next mutation — a client has connected before a creator’s upgrade
    Given a client has connected before a creator’s upgrade
    When the change occurs and the client makes its next mutation
    Then current permissions, lifecycle, and entitlements determine the result without reconnecting

  @US3 @FR-011 @EC-012 @SC-004
  @BDD-US3-034
  Scenario: The change occurs and the client makes its next mutation — a client has connected before a creator’s downgrade
    Given a client has connected before a creator’s downgrade
    When the change occurs and the client makes its next mutation
    Then current permissions, lifecycle, and entitlements determine the result without reconnecting

  @US3 @FR-011 @EC-012 @SC-004
  @BDD-US3-035
  Scenario: The change occurs and the client makes its next mutation — a client has connected before a creator’s trial expiry
    Given a client has connected before a creator’s trial expiry
    When the change occurs and the client makes its next mutation
    Then current permissions, lifecycle, and entitlements determine the result without reconnecting

  @US3 @FR-011 @EC-012 @SC-004
  @BDD-US3-036
  Scenario: The change occurs and the client makes its next mutation — a client has connected before a creator’s grant expiry
    Given a client has connected before a creator’s grant expiry
    When the change occurs and the client makes its next mutation
    Then current permissions, lifecycle, and entitlements determine the result without reconnecting

  @US3 @FR-011 @EC-012 @SC-004
  @BDD-US3-037
  Scenario: The change occurs and the client makes its next mutation — a client has connected before a creator’s team removal
    Given a client has connected before a creator’s team removal
    When the change occurs and the client makes its next mutation
    Then current permissions, lifecycle, and entitlements determine the result without reconnecting

  @US3 @FR-011 @EC-012 @SC-004
  @BDD-US3-038
  Scenario: The change occurs and the client makes its next mutation — a client has connected before a creator’s agency unlinking
    Given a client has connected before a creator’s agency unlinking
    When the change occurs and the client makes its next mutation
    Then current permissions, lifecycle, and entitlements determine the result without reconnecting

  @US3 @FR-011 @EC-012 @SC-004
  @BDD-US3-039
  Scenario: The change occurs and the client makes its next mutation — a client has connected before a creator’s account suspension
    Given a client has connected before a creator’s account suspension
    When the change occurs and the client makes its next mutation
    Then current permissions, lifecycle, and entitlements determine the result without reconnecting

  @US2 @FR-012 @EC-013
  @BDD-US2-016
  Scenario Outline: The client submits the mutation — the request includes an unknown input field
    Given a <operation> request includes an unknown input field
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-017
  Scenario Outline: The client submits the mutation — the request includes an invalid identifier
    Given a <operation> request includes an invalid identifier
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-018
  Scenario Outline: The client submits the mutation — the request includes a wrong field type
    Given a <operation> request includes a wrong field type
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-019
  Scenario Outline: The client submits the mutation — the request includes an out-of-range value
    Given a <operation> request includes an out-of-range value
    When the client submits <operation>
    Then an invalid-input error is returned and no partial change occurs

    Examples:
      | operation |
      | create overlay |
      | update overlay |
      | delete overlay |
      | create playlist |
      | update playlist |
      | delete playlist |
      | add playlist items |
      | remove playlist items |
      | reorder playlist items |
  @US2 @FR-012 @EC-013
  @BDD-US2-020
  Scenario: The client submits the mutation — the request includes an invalid playlist item reference
    Given the request includes an invalid playlist item reference
    When the client submits the mutation
    Then an invalid-input error is returned and no partial change occurs

  @US2 @FR-012 @EC-013
  @BDD-US2-021
  Scenario: The client submits the mutation — the request includes a non-permutation playlist reorder
    Given the request includes a non-permutation playlist reorder
    When the client submits the mutation
    Then an invalid-input error is returned and no partial change occurs

  @US2 @FR-012 @SC-002
  @BDD-US2-022
  Scenario: The client reads every supported tool result — a creator has overlays, OAuth connections, and runner credentials
    Given a creator has overlays, OAuth connections, and runner credentials
    When the client reads every supported tool result
    Then no secret or credential appears and excluded operations are unavailable

  @US2 @FR-013 @EC-014
  @BDD-US2-023
  Scenario: The client retries identical inputs with the same retry key — a overlay create succeeds but its response is lost
    Given a overlay create succeeds but its response is lost
    When the client retries identical inputs with the same retry key
    Then the original result is returned and exactly one resource exists

  @US2 @FR-013 @EC-014
  @BDD-US2-024
  Scenario: They arrive concurrently — two identical overlay creates share a retry key
    Given two identical overlay creates share a retry key
    When they arrive concurrently
    Then both return the same committed resource without duplicate creation

  @US2 @FR-013 @EC-015
  @BDD-US2-025
  Scenario: The client reuses the key with changed inputs — a overlay retry key already has a successful result
    Given a overlay retry key already has a successful result
    When the client reuses the key with changed inputs
    Then a retry-conflict error occurs and the original resource is unchanged

  @US2 @FR-013 @EC-014
  @BDD-US2-026
  Scenario: The client retries identical inputs with the same retry key — a playlist create succeeds but its response is lost
    Given a playlist create succeeds but its response is lost
    When the client retries identical inputs with the same retry key
    Then the original result is returned and exactly one resource exists

  @US2 @FR-013 @EC-014
  @BDD-US2-027
  Scenario: They arrive concurrently — two identical playlist creates share a retry key
    Given two identical playlist creates share a retry key
    When they arrive concurrently
    Then both return the same committed resource without duplicate creation

  @US2 @FR-013 @EC-015
  @BDD-US2-028
  Scenario: The client reuses the key with changed inputs — a playlist retry key already has a successful result
    Given a playlist retry key already has a successful result
    When the client reuses the key with changed inputs
    Then a retry-conflict error occurs and the original resource is unchanged

  @US2 @FR-013
  @BDD-US2-029
  Scenario Outline: Each performs an authorized creation — two clients or actors or creators use the same textual retry key
    Given two independent requests differ by <context> but use the same textual retry key
    When each performs an authorized creation
    Then their requests do not reuse another context’s result

    Examples:
      | context |
      | client |
      | actor |
      | creator |
  @US3 @FR-014 @EC-016
  @BDD-US3-040
  Scenario Outline: The client requests it — a requested resource is absent or inaccessible
    Given the target resource is <availability>
    When the client requests it
    Then the same safe unavailable-resource error reveals no private existence or contents

    Examples:
      | availability |
      | absent |
      | inaccessible |
  @US3 @FR-014 @EC-017
  @BDD-US3-041
  Scenario: The client receives the outcome — a persistence failure occurs during a mutation
    Given a persistence failure occurs during a mutation
    When the client receives the outcome
    Then a service-failure error appears without false success or partial resource changes

  @US3 @FR-014 @EC-017
  @BDD-US3-042
  Scenario: The client receives the outcome — a dependent-service timeout occurs during a mutation
    Given a dependent-service timeout occurs during a mutation
    When the client receives the outcome
    Then a service-failure error appears without false success or partial resource changes

  @US4 @FR-015 @EC-018 @SC-005
  @BDD-US4-001
  Scenario: It submits another registration — a registration caller exhausts its configured registration budget
    Given a registration caller exhausts its configured registration budget
    When it submits another registration
    Then registration is throttled with retry guidance and no client record is created

  @US4 @FR-015 @EC-019 @SC-005
  @BDD-US4-002
  Scenario: It attempts another mutation — a client exhausts its configured tool-call budget
    Given a client exhausts its configured tool-call budget
    When it attempts another mutation
    Then the call is throttled with retry guidance and no business resource changes

  @US4 @FR-016 @SC-005
  @BDD-US4-003
  Scenario: An authorized user inspects activity — a connected client has successful and denied authenticated operations
    Given a connected client has successful and denied authenticated operations
    When an authorized user inspects activity
    Then each entry identifies actor, client, creator, operation, time, and outcome without secrets or private payloads

  @US4 @FR-016 @EC-020
  @BDD-US4-004
  Scenario: The user requests that activity — a user cannot access another creator’s activity
    Given a user cannot access another creator’s activity
    When the user requests that activity
    Then access is denied and the activity remains private

  @US1 @FR-001 @FR-003 @FR-005 @FR-007 @SC-001
  @BDD-US1-021
  Scenario Outline: Complete the release connection journey with each required client
    Given <client> is configured with an eligible test account and an isolated Clipify creator
    When the user connects, approves access, performs a read and permitted mutation, and revokes the connection
    Then the resulting state is visible in Clipify and subsequent access is rejected within five minutes
    And a separate connection attempt with consent denied grants no access

    Examples:
      | client |
      | ChatGPT |
      | Claude |
      | Codex |
      | custom compatible client |

  @US1 @FR-003 @FR-006 @FR-008
  @BDD-US1-022
  Scenario: Approve multiple creators without granting access to others
    Given a user can access creators A, B, and C
    When the user approves creators A and B for one client connection
    Then the client can discover and operate on A and B within its approved permissions
    And creator C remains inaccessible through that connection

  @US1 @FR-003 @FR-006 @FR-011
  @BDD-US1-023
  Scenario: Require consent before expanding the approved creator set
    Given a connection approves A and B and the user gains access to creator C
    When the client attempts to discover or operate on C before new consent
    Then C is not listed and the operation is denied
    When the user explicitly approves adding C
    Then the connection can access C within the approved permissions and current user access

  @US2 @FR-007 @FR-014 @FR-017 @EC-021
  @BDD-US2-030
  Scenario Outline: Reject stale edits across supported resources and interfaces
    Given <resource> has been read at revision R by a browser user and an AI client
    When <first> commits an edit and <second> submits an edit with revision R
    Then the second edit receives a stale-edit conflict and cannot overwrite the first
    And fetching the latest state and submitting its current revision permits a valid retry

    Examples:
      | resource | first | second |
      | overlay | browser | MCP |
      | overlay | MCP | browser |
      | overlay | MCP | MCP |
      | overlay | browser | browser |
      | playlist | browser | MCP |
      | playlist | MCP | browser |
      | playlist | MCP | MCP |
      | playlist | browser | browser |
      | playlist items | browser | MCP |
      | playlist items | MCP | browser |
      | playlist items | MCP | MCP |
      | playlist items | browser | browser |

  @US2 @FR-007 @FR-014 @FR-017 @EC-021
  @BDD-US2-031
  Scenario Outline: Reject an edit without its last-read revision
    Given a client has not supplied the last-read revision of <resource>
    When it submits the <resource> edit
    Then an invalid-input error requests the revision and the resource remains unchanged

    Examples:
      | resource |
      | overlay |
      | playlist |
      | playlist items |
  @US1 @FR-003 @FR-018
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

  @US2 @FR-007 @FR-008 @FR-018
  @BDD-US2-032
  Scenario Outline: Enforce explicit deletion permissions independently of host prompts
    Given <resource> belongs to an accessible creator and the client has <permission>
    When <client> calls its accurately annotated destructive deletion tool
    Then <outcome>

    Examples:
      | resource | permission | client | outcome |
      | overlay | explicit overlay delete permission | a client that confirms destructive calls | deletion succeeds without a dashboard confirmation |
      | playlist | explicit playlist delete permission | a client that confirms destructive calls | deletion succeeds without a dashboard confirmation |
      | overlay | read/edit without delete permission | a client that ignores destructive hints | deletion is denied without changing state |
      | playlist | read/edit without delete permission | a client that ignores destructive hints | deletion is denied without changing state |
      | overlay | explicit overlay delete permission | a custom client that ignores destructive hints | deletion succeeds without a dashboard confirmation |
      | playlist | explicit playlist delete permission | a custom client that ignores destructive hints | deletion succeeds without a dashboard confirmation |
```

### TDD Test Inventory _(mandatory)_

Each row is a test-first behavior obligation, not a claim that a test already exists. Owning suite: TDD. Planned paths: `test/mcp/unit/`, `test/mcp/contract/`, and `test/mcp/integration/`; planning selects concrete files and verified commands. Expected initial failure for every row: absent behavior or assertion demonstrating the stated contract is not yet satisfied, recorded before production changes.

| Test ID     | Source IDs                          | Test level / planned path           | Intent                                                                                                                                                                                                                                    | Expected initial failure                          |
| ----------- | ----------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| TDD-US1-001 | US1, FR-001                         | Contract / test/mcp/contract/       | Given a compatible client has no prior Clipify configuration; it discovers the service; assert it receives the service and authorization metadata.                                                                                        | Missing behavior or incorrect contract assertion. |
| TDD-US1-002 | US1, FR-002                         | Contract / test/mcp/contract/       | Given a custom client has no Clipify session or assigned credentials; it registers valid client metadata; assert it receives a client identity but cannot read creator data.                                                              | Missing behavior or incorrect contract assertion. |
| TDD-US1-003 | US1, FR-002, EC-001                 | Contract / test/mcp/contract/       | Given client registration metadata has an invalid callback or unsupported grant; the client registers; assert registration is rejected and no client record is created.                                                                   | Missing behavior or incorrect contract assertion. |
| TDD-US1-004 | US1, FR-003, SC-001                 | Contract / test/mcp/contract/       | Given a registered client requests read access to a creator the user owns; the signed-in user approves those permissions and that creator; assert the client reads that creator and cannot access an unapproved creator.                  | Missing behavior or incorrect contract assertion. |
| TDD-US1-005 | US1, FR-003, EC-002                 | Contract / test/mcp/contract/       | Given the user is shown the client and requested permissions; the user denies consent; assert no grant is issued and no creator data is accessible.                                                                                       | Missing behavior or incorrect contract assertion. |
| TDD-US1-006 | US1, FR-004                         | Contract / test/mcp/contract/       | Given an approved authorization code and matching proof exist; the client exchanges the code; assert expiring access bound to Clipify MCP is issued.                                                                                      | Missing behavior or incorrect contract assertion. |
| TDD-US1-007 | US1, FR-004, EC-003                 | Contract / test/mcp/contract/       | Given missing PKCE proof is presented; the client exchanges authorization; assert access is rejected without issuing tokens.                                                                                                              | Missing behavior or incorrect contract assertion. |
| TDD-US1-008 | US1, FR-004, EC-003                 | Contract / test/mcp/contract/       | Given incorrect PKCE proof is presented; the client exchanges authorization; assert access is rejected without issuing tokens.                                                                                                            | Missing behavior or incorrect contract assertion. |
| TDD-US1-009 | US1, FR-004, EC-003                 | Contract / test/mcp/contract/       | Given a reused authorization code is presented; the client exchanges authorization; assert access is rejected without issuing tokens.                                                                                                     | Missing behavior or incorrect contract assertion. |
| TDD-US1-010 | US1, FR-004, EC-003                 | Contract / test/mcp/contract/       | Given an expired authorization code is presented; the client exchanges authorization; assert access is rejected without issuing tokens.                                                                                                   | Missing behavior or incorrect contract assertion. |
| TDD-US1-011 | US1, FR-004, EC-003                 | Contract / test/mcp/contract/       | Given an unregistered callback is presented; the client exchanges authorization; assert access is rejected without issuing tokens.                                                                                                        | Missing behavior or incorrect contract assertion. |
| TDD-US1-012 | US1, FR-004, EC-003                 | Contract / test/mcp/contract/       | Given a changed callback is presented; the client exchanges authorization; assert access is rejected without issuing tokens.                                                                                                              | Missing behavior or incorrect contract assertion. |
| TDD-US1-013 | US1, FR-004, EC-004, SC-004         | Contract / test/mcp/contract/       | Given the client presents missing access; it calls a tool; assert the call is rejected without reading or changing creator data.                                                                                                          | Missing behavior or incorrect contract assertion. |
| TDD-US1-014 | US1, FR-004, EC-004, SC-004         | Contract / test/mcp/contract/       | Given the client presents expired access; it calls a tool; assert the call is rejected without reading or changing creator data.                                                                                                          | Missing behavior or incorrect contract assertion. |
| TDD-US1-015 | US1, FR-004, EC-004, SC-004         | Contract / test/mcp/contract/       | Given the client presents an invalid signature; it calls a tool; assert the call is rejected without reading or changing creator data.                                                                                                    | Missing behavior or incorrect contract assertion. |
| TDD-US1-016 | US1, FR-004, EC-004, SC-004         | Contract / test/mcp/contract/       | Given the client presents an incorrect issuer; it calls a tool; assert the call is rejected without reading or changing creator data.                                                                                                     | Missing behavior or incorrect contract assertion. |
| TDD-US1-017 | US1, FR-004, EC-004, SC-004         | Contract / test/mcp/contract/       | Given the client presents an audience for another service; it calls a tool; assert the call is rejected without reading or changing creator data.                                                                                         | Missing behavior or incorrect contract assertion. |
| TDD-US1-018 | US1, FR-004                         | Contract / test/mcp/contract/       | Given a valid refresh grant exists; the client refreshes access; assert renewed access preserves or narrows the approved permissions.                                                                                                     | Missing behavior or incorrect contract assertion. |
| TDD-US1-019 | US1, FR-004, EC-005                 | Contract / test/mcp/contract/       | Given a refresh grant is expired or the client requests wider permissions; the client refreshes access; assert the refresh is rejected without widening access.                                                                           | Missing behavior or incorrect contract assertion. |
| TDD-US1-020 | US1, FR-005, EC-006, SC-001, SC-004 | Contract / test/mcp/contract/       | Given two connected clients have separate approved grants; the user lists connections and revokes the first; assert the first client’s old access and refresh are rejected while the second remains usable.                               | Missing behavior or incorrect contract assertion. |
| TDD-US2-001 | US2, FR-006                         | Integration / test/mcp/integration/ | Given owned, directly shared, agency-linked, and inaccessible creators exist; the client lists creators; assert only creators permitted by both the grant and current membership appear.                                                  | Missing behavior or incorrect contract assertion. |
| TDD-US2-002 | US2, FR-006                         | Integration / test/mcp/integration/ | Given the user selects an accessible creator with current usage and grants; the client requests capabilities; assert the effective plan, current usage, limits, and eligible operations are reported.                                     | Missing behavior or incorrect contract assertion. |
| TDD-US2-003 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for list overlay; the client performs list overlay; assert the correct result and resulting state are visible to the creator in the dashboard.                               | Missing behavior or incorrect contract assertion. |
| TDD-US2-004 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for read overlay; the client performs read overlay; assert the correct result and resulting state are visible to the creator in the dashboard.                               | Missing behavior or incorrect contract assertion. |
| TDD-US2-005 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for create overlay; the client performs create overlay; assert the correct result and resulting state are visible to the creator in the dashboard.                           | Missing behavior or incorrect contract assertion. |
| TDD-US2-006 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for update overlay; the client performs update overlay; assert the correct result and resulting state are visible to the creator in the dashboard.                           | Missing behavior or incorrect contract assertion. |
| TDD-US2-007 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for delete overlay; the client performs delete overlay; assert the correct result and resulting state are visible to the creator in the dashboard.                           | Missing behavior or incorrect contract assertion. |
| TDD-US2-008 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for list playlist; the client performs list playlist; assert the correct result and resulting state are visible to the creator in the dashboard.                             | Missing behavior or incorrect contract assertion. |
| TDD-US2-009 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for read playlist; the client performs read playlist; assert the correct result and resulting state are visible to the creator in the dashboard.                             | Missing behavior or incorrect contract assertion. |
| TDD-US2-010 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for create playlist; the client performs create playlist; assert the correct result and resulting state are visible to the creator in the dashboard.                         | Missing behavior or incorrect contract assertion. |
| TDD-US2-011 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for update playlist; the client performs update playlist; assert the correct result and resulting state are visible to the creator in the dashboard.                         | Missing behavior or incorrect contract assertion. |
| TDD-US2-012 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for delete playlist; the client performs delete playlist; assert the correct result and resulting state are visible to the creator in the dashboard.                         | Missing behavior or incorrect contract assertion. |
| TDD-US2-013 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for add playlist item; the client performs add playlist item; assert the correct result and resulting state are visible to the creator in the dashboard.                     | Missing behavior or incorrect contract assertion. |
| TDD-US2-014 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for remove playlist item; the client performs remove playlist item; assert the correct result and resulting state are visible to the creator in the dashboard.               | Missing behavior or incorrect contract assertion. |
| TDD-US2-015 | US2, FR-007, SC-002                 | Integration / test/mcp/integration/ | Given an eligible creator has consent and current permission for reorder playlist item; the client performs reorder playlist item; assert the correct result and resulting state are visible to the creator in the dashboard.             | Missing behavior or incorrect contract assertion. |
| TDD-US3-001 | US3, FR-008, EC-007, SC-004         | Integration / test/mcp/integration/ | Given the client lacks the operation scope; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state.                                                                    | Missing behavior or incorrect contract assertion. |
| TDD-US3-002 | US3, FR-008, EC-007, SC-004         | Integration / test/mcp/integration/ | Given the team member lacks the operation permission; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state.                                                          | Missing behavior or incorrect contract assertion. |
| TDD-US3-003 | US3, FR-008, EC-007, SC-004         | Integration / test/mcp/integration/ | Given the resource belongs to an unapproved creator; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state.                                                           | Missing behavior or incorrect contract assertion. |
| TDD-US3-004 | US3, FR-008, EC-007, SC-004         | Integration / test/mcp/integration/ | Given the agency role exceeds the creator permission ceiling; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state.                                                  | Missing behavior or incorrect contract assertion. |
| TDD-US3-005 | US3, FR-008, EC-007, SC-004         | Integration / test/mcp/integration/ | Given the caller supplies a forged creator identity; the client attempts the affected operation; assert access is denied without revealing resource contents or changing state.                                                           | Missing behavior or incorrect contract assertion. |
| TDD-US3-006 | US3, FR-009, EC-008                 | Integration / test/mcp/integration/ | Given a Free creator already has one overlay; the browser requests another overlay; assert a plan-limit error reports usage and limit and no overlay is created.                                                                          | Missing behavior or incorrect contract assertion. |
| TDD-US3-007 | US3, FR-009, EC-009                 | Integration / test/mcp/integration/ | Given a Free creator lacks paid-feature access; the browser attempts paid overlay settings; assert the paid-feature change is rejected and saved settings are preserved.                                                                  | Missing behavior or incorrect contract assertion. |
| TDD-US3-008 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a subscription; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                           | Missing behavior or incorrect contract assertion. |
| TDD-US3-009 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a trial; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                                  | Missing behavior or incorrect contract assertion. |
| TDD-US3-010 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a grant; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                                  | Missing behavior or incorrect contract assertion. |
| TDD-US3-011 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a agency allocation; the browser creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                      | Missing behavior or incorrect contract assertion. |
| TDD-US3-012 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple overlay resources; the browser reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                            | Missing behavior or incorrect contract assertion. |
| TDD-US3-013 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple overlay resources; the browser updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                          | Missing behavior or incorrect contract assertion. |
| TDD-US3-014 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple overlay resources; the browser runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                             | Missing behavior or incorrect contract assertion. |
| TDD-US3-015 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple playlist resources; the browser reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                           | Missing behavior or incorrect contract assertion. |
| TDD-US3-016 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple playlist resources; the browser updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                         | Missing behavior or incorrect contract assertion. |
| TDD-US3-017 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple playlist resources; the browser runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                            | Missing behavior or incorrect contract assertion. |
| TDD-US3-018 | US3, FR-009, EC-008                 | Integration / test/mcp/integration/ | Given a Free creator already has one overlay; the MCP requests another overlay; assert a plan-limit error reports usage and limit and no overlay is created.                                                                              | Missing behavior or incorrect contract assertion. |
| TDD-US3-019 | US3, FR-009, EC-009                 | Integration / test/mcp/integration/ | Given a Free creator lacks paid-feature access; the MCP attempts paid overlay settings; assert the paid-feature change is rejected and saved settings are preserved.                                                                      | Missing behavior or incorrect contract assertion. |
| TDD-US3-020 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a subscription; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                               | Missing behavior or incorrect contract assertion. |
| TDD-US3-021 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a trial; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                                      | Missing behavior or incorrect contract assertion. |
| TDD-US3-022 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a grant; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                                      | Missing behavior or incorrect contract assertion. |
| TDD-US3-023 | US3, FR-009                         | Integration / test/mcp/integration/ | Given a creator has effective Pro access through a agency allocation; the MCP creates another overlay; assert creation follows the current effective plan rather than the actor’s personal plan.                                          | Missing behavior or incorrect contract assertion. |
| TDD-US3-024 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple overlay resources; the MCP reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                                | Missing behavior or incorrect contract assertion. |
| TDD-US3-025 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple overlay resources; the MCP updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                              | Missing behavior or incorrect contract assertion. |
| TDD-US3-026 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple overlay resources; the MCP runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                                 | Missing behavior or incorrect contract assertion. |
| TDD-US3-027 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple playlist resources; the MCP reads a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                               | Missing behavior or incorrect contract assertion. |
| TDD-US3-028 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple playlist resources; the MCP updates a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                             | Missing behavior or incorrect contract assertion. |
| TDD-US3-029 | US3, FR-009, EC-010                 | Integration / test/mcp/integration/ | Given a downgraded creator retains multiple playlist resources; the MCP runs a retained resource; assert the operation follows the existing retained-resource policy without deleting saved paid settings.                                | Missing behavior or incorrect contract assertion. |
| TDD-US3-030 | US3, FR-010, EC-011, SC-003         | Integration / test/mcp/integration/ | Given an empty Free creator has no active qualifying entitlement; twenty all browser creation requests execute concurrently; assert exactly one overlay exists and nineteen requests receive plan-limit errors.                           | Missing behavior or incorrect contract assertion. |
| TDD-US3-031 | US3, FR-010, EC-011, SC-003         | Integration / test/mcp/integration/ | Given an empty Free creator has no active qualifying entitlement; twenty all MCP creation requests execute concurrently; assert exactly one overlay exists and nineteen requests receive plan-limit errors.                               | Missing behavior or incorrect contract assertion. |
| TDD-US3-032 | US3, FR-010, EC-011, SC-003         | Integration / test/mcp/integration/ | Given an empty Free creator has no active qualifying entitlement; twenty ten browser and ten MCP creation requests execute concurrently; assert exactly one overlay exists and nineteen requests receive plan-limit errors.               | Missing behavior or incorrect contract assertion. |
| TDD-US3-033 | US3, FR-011, EC-012, SC-004         | Integration / test/mcp/integration/ | Given a client has connected before a creator’s upgrade; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting.                     | Missing behavior or incorrect contract assertion. |
| TDD-US3-034 | US3, FR-011, EC-012, SC-004         | Integration / test/mcp/integration/ | Given a client has connected before a creator’s downgrade; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting.                   | Missing behavior or incorrect contract assertion. |
| TDD-US3-035 | US3, FR-011, EC-012, SC-004         | Integration / test/mcp/integration/ | Given a client has connected before a creator’s trial expiry; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting.                | Missing behavior or incorrect contract assertion. |
| TDD-US3-036 | US3, FR-011, EC-012, SC-004         | Integration / test/mcp/integration/ | Given a client has connected before a creator’s grant expiry; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting.                | Missing behavior or incorrect contract assertion. |
| TDD-US3-037 | US3, FR-011, EC-012, SC-004         | Integration / test/mcp/integration/ | Given a client has connected before a creator’s team removal; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting.                | Missing behavior or incorrect contract assertion. |
| TDD-US3-038 | US3, FR-011, EC-012, SC-004         | Integration / test/mcp/integration/ | Given a client has connected before a creator’s agency unlinking; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting.            | Missing behavior or incorrect contract assertion. |
| TDD-US3-039 | US3, FR-011, EC-012, SC-004         | Integration / test/mcp/integration/ | Given a client has connected before a creator’s account suspension; the change occurs and the client makes its next mutation; assert current permissions, lifecycle, and entitlements determine the result without reconnecting.          | Missing behavior or incorrect contract assertion. |
| TDD-US2-016 | US2, FR-012, EC-013                 | Integration / test/mcp/integration/ | Given the request includes an unknown input field; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs.                                                                               | Missing behavior or incorrect contract assertion. |
| TDD-US2-017 | US2, FR-012, EC-013                 | Integration / test/mcp/integration/ | Given the request includes an invalid identifier; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs.                                                                                | Missing behavior or incorrect contract assertion. |
| TDD-US2-018 | US2, FR-012, EC-013                 | Integration / test/mcp/integration/ | Given the request includes a wrong field type; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs.                                                                                   | Missing behavior or incorrect contract assertion. |
| TDD-US2-019 | US2, FR-012, EC-013                 | Integration / test/mcp/integration/ | Given the request includes an out-of-range value; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs.                                                                                | Missing behavior or incorrect contract assertion. |
| TDD-US2-020 | US2, FR-012, EC-013                 | Integration / test/mcp/integration/ | Given the request includes an invalid playlist item reference; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs.                                                                   | Missing behavior or incorrect contract assertion. |
| TDD-US2-021 | US2, FR-012, EC-013                 | Integration / test/mcp/integration/ | Given the request includes a non-permutation playlist reorder; the client submits the mutation; assert an invalid-input error is returned and no partial change occurs.                                                                   | Missing behavior or incorrect contract assertion. |
| TDD-US2-022 | US2, FR-012, SC-002                 | Integration / test/mcp/integration/ | Given a creator has overlays, OAuth connections, and runner credentials; the client reads every supported tool result; assert no secret or credential appears and excluded operations are unavailable.                                    | Missing behavior or incorrect contract assertion. |
| TDD-US2-023 | US2, FR-013, EC-014                 | Integration / test/mcp/integration/ | Given a overlay create succeeds but its response is lost; the client retries identical inputs with the same retry key; assert the original result is returned and exactly one resource exists.                                            | Missing behavior or incorrect contract assertion. |
| TDD-US2-024 | US2, FR-013, EC-014                 | Integration / test/mcp/integration/ | Given two identical overlay creates share a retry key; they arrive concurrently; assert both return the same committed resource without duplicate creation.                                                                               | Missing behavior or incorrect contract assertion. |
| TDD-US2-025 | US2, FR-013, EC-015                 | Integration / test/mcp/integration/ | Given a overlay retry key already has a successful result; the client reuses the key with changed inputs; assert a retry-conflict error occurs and the original resource is unchanged.                                                    | Missing behavior or incorrect contract assertion. |
| TDD-US2-026 | US2, FR-013, EC-014                 | Integration / test/mcp/integration/ | Given a playlist create succeeds but its response is lost; the client retries identical inputs with the same retry key; assert the original result is returned and exactly one resource exists.                                           | Missing behavior or incorrect contract assertion. |
| TDD-US2-027 | US2, FR-013, EC-014                 | Integration / test/mcp/integration/ | Given two identical playlist creates share a retry key; they arrive concurrently; assert both return the same committed resource without duplicate creation.                                                                              | Missing behavior or incorrect contract assertion. |
| TDD-US2-028 | US2, FR-013, EC-015                 | Integration / test/mcp/integration/ | Given a playlist retry key already has a successful result; the client reuses the key with changed inputs; assert a retry-conflict error occurs and the original resource is unchanged.                                                   | Missing behavior or incorrect contract assertion. |
| TDD-US2-029 | US2, FR-013                         | Integration / test/mcp/integration/ | Given two clients or actors or creators use the same textual retry key; each performs an authorized creation; assert their independent requests do not reuse another context’s result.                                                    | Missing behavior or incorrect contract assertion. |
| TDD-US3-040 | US3, FR-014, EC-016                 | Integration / test/mcp/integration/ | Given a requested resource is absent or inaccessible; the client requests it; assert a safe unavailable-resource error reveals no private existence or contents.                                                                          | Missing behavior or incorrect contract assertion. |
| TDD-US3-041 | US3, FR-014, EC-017                 | Integration / test/mcp/integration/ | Given a persistence failure occurs during a mutation; the client receives the outcome; assert a service-failure error appears without false success or partial resource changes.                                                          | Missing behavior or incorrect contract assertion. |
| TDD-US3-042 | US3, FR-014, EC-017                 | Integration / test/mcp/integration/ | Given a dependent-service timeout occurs during a mutation; the client receives the outcome; assert a service-failure error appears without false success or partial resource changes.                                                    | Missing behavior or incorrect contract assertion. |
| TDD-US4-001 | US4, FR-015, EC-018, SC-005         | Integration / test/mcp/integration/ | Given a registration caller exhausts its configured registration budget; it submits another registration; assert registration is throttled with retry guidance and no client record is created.                                           | Missing behavior or incorrect contract assertion. |
| TDD-US4-002 | US4, FR-015, EC-019, SC-005         | Integration / test/mcp/integration/ | Given a client exhausts its configured tool-call budget; it attempts another mutation; assert the call is throttled with retry guidance and no business resource changes.                                                                 | Missing behavior or incorrect contract assertion. |
| TDD-US4-003 | US4, FR-016, SC-005                 | Integration / test/mcp/integration/ | Given a connected client has successful and denied authenticated operations; an authorized user inspects activity; assert each entry identifies actor, client, creator, operation, time, and outcome without secrets or private payloads. | Missing behavior or incorrect contract assertion. |
| TDD-US4-004 | US4, FR-016, EC-020                 | Integration / test/mcp/integration/ | Given a user cannot access another creator’s activity; the user requests that activity; assert access is denied and the activity remains private.                                                                                         | Missing behavior or incorrect contract assertion. |

Additional implementation boundary obligations below complement the scenario-level inventory; they do not replace the real-entry-point scenarios.

| Test ID     | Source IDs                  | Test level / planned path    | Intent                                                                                                                                                                                            | Expected initial failure                           |
| ----------- | --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| TDD-US1-021 | US1, FR-004, EC-003         | Unit/integration / test/mcp/ | Single-use code consumption remains atomic across simultaneous exchanges.                                                                                                                         | Missing invariant or incorrect boundary assertion. |
| TDD-US1-022 | US1, FR-004, EC-004         | Unit/integration / test/mcp/ | Token expiry rejects exactly at expiry; rejects malformed authorization headers and malformed token claims.                                                                                       | Missing invariant or incorrect boundary assertion. |
| TDD-US1-023 | US1, FR-004, EC-005         | Unit/integration / test/mcp/ | Refresh rotation rejects reuse beyond any explicitly documented retry window and never changes resource audience or creator grant.                                                                | Missing invariant or incorrect boundary assertion. |
| TDD-US1-024 | US1, FR-005, EC-006         | Unit/integration / test/mcp/ | Grant revocation is durable; revocation failure reports failure and leaves connection status accurate; concurrent revoke and next call cannot authorize after completed revocation.               | Missing invariant or incorrect boundary assertion. |
| TDD-US2-034 | US2, FR-007, EC-017         | Unit/integration / test/mcp/ | Every overlay, playlist, and playlist-item mutation rolls back partial persistence on injected failure.                                                                                           | Missing invariant or incorrect boundary assertion. |
| TDD-US2-035 | US2, FR-012, EC-013         | Unit/integration / test/mcp/ | Reject empty/oversized names, invalid enums, nullability violations, duplicate item IDs, absent item IDs, and invalid ordering boundaries for every applicable mutation.                          | Missing invariant or incorrect boundary assertion. |
| TDD-US2-036 | US2, FR-013, EC-014, EC-015 | Unit/integration / test/mcp/ | Retry expiry: replay before 24 hours; expiry boundary; missing key; oversized key; failure before commit remains retryable; committed result survives lost response.                              | Missing invariant or incorrect boundary assertion. |
| TDD-US2-037 | US2, FR-013                 | Unit/integration / test/mcp/ | Retry lookup revalidates current authorization and entitlements before disclosing any stored result.                                                                                              | Missing invariant or incorrect boundary assertion. |
| TDD-US3-051 | US3, FR-009, FR-010, EC-011 | Unit/integration / test/mcp/ | Quota boundary at zero, one below, exactly at, and above current limit; lock isolation by creator; failed insert releases reservation; simultaneous delete and create preserve invariant.         | Missing invariant or incorrect boundary assertion. |
| TDD-US3-052 | US3, FR-009, FR-011, EC-012 | Unit/integration / test/mcp/ | Resolve active and expired subscription/trial/grant/allocation boundaries; creator entitlement overrides actor entitlement; Free runtime and retained-resource eligibility match existing policy. | Missing invariant or incorrect boundary assertion. |
| TDD-US3-053 | US3, FR-008, EC-007         | Unit/integration / test/mcp/ | Permission intersection for owner, direct team, and agency roles; resource owner mismatch and inactive link deny access; malformed or missing selected context denies access.                     | Missing invariant or incorrect boundary assertion. |
| TDD-US3-054 | US3, FR-014, EC-016, EC-017 | Unit/integration / test/mcp/ | Map each documented error source to the correct public error; redact identifiers and private exception contents; prevent success replies after rollback.                                          | Missing invariant or incorrect boundary assertion. |
| TDD-US4-017 | US4, FR-015, EC-018, EC-019 | Unit/integration / test/mcp/ | Rate budget at below, exactly at, and above threshold; reset boundary; isolate callers; coordinate across instances; unavailable limiter fails closed without creating records.                   | Missing invariant or incorrect boundary assertion. |
| TDD-US4-018 | US4, FR-016, EC-020         | Unit/integration / test/mcp/ | Activity redaction, chronological listing, pagination, cross-creator isolation, denied-call attribution, and durable recording; storage failure cannot silently lose required audit evidence.     | Missing invariant or incorrect boundary assertion. |

| TDD-US1-025 | US1, FR-001, FR-003, FR-005, FR-007, SC-001 | Contract/integration / test/mcp/ | Validate discovery, consent approval and denial, read, mutation, and revoked access for each required client profile; preserve issuer, audience, and scopes throughout. | Missing interoperability contract or incorrect access outcome. |

| TDD-US1-026 | US1, FR-003, FR-006, FR-008, FR-011 | Contract/integration / test/mcp/ | Approved creator set intersection, per-call creator selection, rejection of missing/unapproved context, new consent for expansion, and membership removal shrinking access without expanding the grant. | Missing grant boundary or incorrect access decision. |

| TDD-US2-038 | US2, FR-007, FR-014, FR-017, EC-021 | Integration / test/mcp/integration/ | Matching, missing, stale and malformed revisions; atomic competing edits; playlist-item revision advancement; rollback preserves revision; fresh-read retry; all twelve resource/interface combinations. | Missing comparison or lost-update assertion. |

| TDD-US1-027 | US1, FR-003, FR-018 | Contract/integration / test/mcp/ | Read, Read & edit, individual scope removal, explicit overlay/playlist/both delete opt-ins, rejected unknown scopes and exact final grant matching. | Missing consent selection or unintended scope grant. |
| TDD-US2-039 | US2, FR-007, FR-008, FR-018 | Contract/integration / test/mcp/ | Accurate read-only/destructive tool metadata, delete permission enforced regardless of host prompts, distinct resource delete scopes, and normal backend access denial despite approved delete scope. | Incorrect risk hint or missing deletion permission guard. |

### Scenario Coverage Matrix _(mandatory for BDD/ATDD Required decisions)_

| Scenario / Example ID   | Owning Suite | Evidence Roles | Primary Source ID | Covered Inputs / Classes                                                                                                                                                             | Positive / Negative / Boundary | Interface                | Rationale                                                                                                                                                                              |
| ----------------------- | ------------ | -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BDD-US1-001             | BDD          | BDD, ATDD      | FR-001            | a compatible client has no prior Clipify configuration                                                                                                                               | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-001. No sampling; materialize when binding is ready.                                 |
| BDD-US1-002             | BDD          | BDD, ATDD      | FR-002            | a custom client has no Clipify session or assigned credentials                                                                                                                       | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-002. No sampling; materialize when binding is ready.                                 |
| BDD-US1-003:example-001 | BDD          | BDD, ATDD      | FR-002            | invalid=an invalid callback                                                                                                                                                          | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-002, EC-001. No sampling; materialize when binding is ready.                         |
| BDD-US1-003:example-002 | BDD          | BDD, ATDD      | FR-002            | invalid=an unsupported grant                                                                                                                                                         | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-002, EC-001. No sampling; materialize when binding is ready.                         |
| BDD-US1-004             | BDD          | BDD, ATDD      | FR-003            | a registered client requests read access to a creator the user owns                                                                                                                  | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, SC-001. No sampling; materialize when binding is ready.                         |
| BDD-US1-005             | BDD          | BDD, ATDD      | FR-003            | the user is shown the client and requested permissions                                                                                                                               | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, EC-002. No sampling; materialize when binding is ready.                         |
| BDD-US1-006             | BDD          | BDD, ATDD      | FR-004            | an approved authorization code and matching proof exist                                                                                                                              | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004. No sampling; materialize when binding is ready.                                 |
| BDD-US1-007             | BDD          | BDD, ATDD      | FR-004            | missing PKCE proof is presented                                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-003. No sampling; materialize when binding is ready.                         |
| BDD-US1-008             | BDD          | BDD, ATDD      | FR-004            | incorrect PKCE proof is presented                                                                                                                                                    | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-003. No sampling; materialize when binding is ready.                         |
| BDD-US1-009             | BDD          | BDD, ATDD      | FR-004            | a reused authorization code is presented                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-003. No sampling; materialize when binding is ready.                         |
| BDD-US1-010             | BDD          | BDD, ATDD      | FR-004            | an expired authorization code is presented                                                                                                                                           | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-003. No sampling; materialize when binding is ready.                         |
| BDD-US1-011             | BDD          | BDD, ATDD      | FR-004            | an unregistered callback is presented                                                                                                                                                | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-003. No sampling; materialize when binding is ready.                         |
| BDD-US1-012             | BDD          | BDD, ATDD      | FR-004            | a changed callback is presented                                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-003. No sampling; materialize when binding is ready.                         |
| BDD-US1-013             | BDD          | BDD, ATDD      | FR-004            | the client presents missing access                                                                                                                                                   | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-004, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US1-014             | BDD          | BDD, ATDD      | FR-004            | the client presents expired access                                                                                                                                                   | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-004, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US1-015             | BDD          | BDD, ATDD      | FR-004            | the client presents an invalid signature                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-004, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US1-016             | BDD          | BDD, ATDD      | FR-004            | the client presents an incorrect issuer                                                                                                                                              | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-004, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US1-017             | BDD          | BDD, ATDD      | FR-004            | the client presents an audience for another service                                                                                                                                  | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-004, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US1-018             | BDD          | BDD, ATDD      | FR-004            | a valid refresh grant exists                                                                                                                                                         | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004. No sampling; materialize when binding is ready.                                 |
| BDD-US1-019:example-001 | BDD          | BDD, ATDD      | FR-004            | invalid=an expired refresh grant                                                                                                                                                     | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-005. No sampling; materialize when binding is ready.                         |
| BDD-US1-019:example-002 | BDD          | BDD, ATDD      | FR-004            | invalid=a request for wider permissions                                                                                                                                              | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-004, EC-005. No sampling; materialize when binding is ready.                         |
| BDD-US1-020             | BDD          | BDD, ATDD      | FR-005            | two connected clients have separate approved grants                                                                                                                                  | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-005, EC-006, SC-001, SC-004. No sampling; materialize when binding is ready.         |
| BDD-US2-001             | BDD          | BDD, ATDD      | FR-006            | owned, directly shared, agency-linked, and inaccessible creators exist                                                                                                               | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-006. No sampling; materialize when binding is ready.                                 |
| BDD-US2-002             | BDD          | BDD, ATDD      | FR-006            | the user selects an accessible creator with current usage and grants                                                                                                                 | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-006. No sampling; materialize when binding is ready.                                 |
| BDD-US2-003             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for list overlay                                                                                                              | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-004             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for read overlay                                                                                                              | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-005             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for create overlay                                                                                                            | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-006             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for update overlay                                                                                                            | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-007             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for delete overlay                                                                                                            | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-008             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for list playlist                                                                                                             | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-009             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for read playlist                                                                                                             | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-010             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for create playlist                                                                                                           | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-011             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for update playlist                                                                                                           | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-012             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for delete playlist                                                                                                           | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-013             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for add playlist item                                                                                                         | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-014             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for remove playlist item                                                                                                      | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-015             | BDD          | BDD, ATDD      | FR-007            | an eligible creator has consent and current permission for reorder playlist item                                                                                                     | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US3-001             | BDD          | BDD, ATDD      | FR-008            | the client lacks the operation scope                                                                                                                                                 | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-008, EC-007, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-002             | BDD          | BDD, ATDD      | FR-008            | the team member lacks the operation permission                                                                                                                                       | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-008, EC-007, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-003             | BDD          | BDD, ATDD      | FR-008            | the resource belongs to an unapproved creator                                                                                                                                        | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-008, EC-007, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-004             | BDD          | BDD, ATDD      | FR-008            | the agency role exceeds the creator permission ceiling                                                                                                                               | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-008, EC-007, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-005             | BDD          | BDD, ATDD      | FR-008            | the caller supplies a forged creator identity                                                                                                                                        | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-008, EC-007, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-006             | BDD          | BDD, ATDD      | FR-009            | a Free creator already has one overlay                                                                                                                                               | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-008. No sampling; materialize when binding is ready.                         |
| BDD-US3-007             | BDD          | BDD, ATDD      | FR-009            | a Free creator lacks paid-feature access                                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-009. No sampling; materialize when binding is ready.                         |
| BDD-US3-008             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a subscription                                                                                                                            | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-009             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a trial                                                                                                                                   | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-010             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a grant                                                                                                                                   | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-011             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a agency allocation                                                                                                                       | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-012             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple overlay resources                                                                                                                              | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-013             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple overlay resources                                                                                                                              | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-014             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple overlay resources                                                                                                                              | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-015             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple playlist resources                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-016             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple playlist resources                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-017             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple playlist resources                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-018             | BDD          | BDD, ATDD      | FR-009            | a Free creator already has one overlay                                                                                                                                               | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-008. No sampling; materialize when binding is ready.                         |
| BDD-US3-019             | BDD          | BDD, ATDD      | FR-009            | a Free creator lacks paid-feature access                                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-009. No sampling; materialize when binding is ready.                         |
| BDD-US3-020             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a subscription                                                                                                                            | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-021             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a trial                                                                                                                                   | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-022             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a grant                                                                                                                                   | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-023             | BDD          | BDD, ATDD      | FR-009            | a creator has effective Pro access through a agency allocation                                                                                                                       | Positive                       | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009. No sampling; materialize when binding is ready.                                 |
| BDD-US3-024             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple overlay resources                                                                                                                              | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-025             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple overlay resources                                                                                                                              | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-026             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple overlay resources                                                                                                                              | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-027             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple playlist resources                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-028             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple playlist resources                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-029             | BDD          | BDD, ATDD      | FR-009            | a downgraded creator retains multiple playlist resources                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-009, EC-010. No sampling; materialize when binding is ready.                         |
| BDD-US3-030             | BDD          | BDD, ATDD      | FR-010            | an empty Free creator has no active qualifying entitlement                                                                                                                           | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-010, EC-011, SC-003. No sampling; materialize when binding is ready.                 |
| BDD-US3-031             | BDD          | BDD, ATDD      | FR-010            | an empty Free creator has no active qualifying entitlement                                                                                                                           | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-010, EC-011, SC-003. No sampling; materialize when binding is ready.                 |
| BDD-US3-032             | BDD          | BDD, ATDD      | FR-010            | an empty Free creator has no active qualifying entitlement                                                                                                                           | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-010, EC-011, SC-003. No sampling; materialize when binding is ready.                 |
| BDD-US3-033             | BDD          | BDD, ATDD      | FR-011            | a client has connected before a creator’s upgrade                                                                                                                                    | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-011, EC-012, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-034             | BDD          | BDD, ATDD      | FR-011            | a client has connected before a creator’s downgrade                                                                                                                                  | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-011, EC-012, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-035             | BDD          | BDD, ATDD      | FR-011            | a client has connected before a creator’s trial expiry                                                                                                                               | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-011, EC-012, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-036             | BDD          | BDD, ATDD      | FR-011            | a client has connected before a creator’s grant expiry                                                                                                                               | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-011, EC-012, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-037             | BDD          | BDD, ATDD      | FR-011            | a client has connected before a creator’s team removal                                                                                                                               | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-011, EC-012, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-038             | BDD          | BDD, ATDD      | FR-011            | a client has connected before a creator’s agency unlinking                                                                                                                           | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-011, EC-012, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US3-039             | BDD          | BDD, ATDD      | FR-011            | a client has connected before a creator’s account suspension                                                                                                                         | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-011, EC-012, SC-004. No sampling; materialize when binding is ready.                 |
| BDD-US2-016:example-001 | BDD          | BDD, ATDD      | FR-012            | operation=create overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-002 | BDD          | BDD, ATDD      | FR-012            | operation=update overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-003 | BDD          | BDD, ATDD      | FR-012            | operation=delete overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-004 | BDD          | BDD, ATDD      | FR-012            | operation=create playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-005 | BDD          | BDD, ATDD      | FR-012            | operation=update playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-006 | BDD          | BDD, ATDD      | FR-012            | operation=delete playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-007 | BDD          | BDD, ATDD      | FR-012            | operation=add playlist items                                                                                                                                                         | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-008 | BDD          | BDD, ATDD      | FR-012            | operation=remove playlist items                                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-016:example-009 | BDD          | BDD, ATDD      | FR-012            | operation=reorder playlist items                                                                                                                                                     | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-001 | BDD          | BDD, ATDD      | FR-012            | operation=create overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-002 | BDD          | BDD, ATDD      | FR-012            | operation=update overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-003 | BDD          | BDD, ATDD      | FR-012            | operation=delete overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-004 | BDD          | BDD, ATDD      | FR-012            | operation=create playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-005 | BDD          | BDD, ATDD      | FR-012            | operation=update playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-006 | BDD          | BDD, ATDD      | FR-012            | operation=delete playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-007 | BDD          | BDD, ATDD      | FR-012            | operation=add playlist items                                                                                                                                                         | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-008 | BDD          | BDD, ATDD      | FR-012            | operation=remove playlist items                                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-017:example-009 | BDD          | BDD, ATDD      | FR-012            | operation=reorder playlist items                                                                                                                                                     | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-001 | BDD          | BDD, ATDD      | FR-012            | operation=create overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-002 | BDD          | BDD, ATDD      | FR-012            | operation=update overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-003 | BDD          | BDD, ATDD      | FR-012            | operation=delete overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-004 | BDD          | BDD, ATDD      | FR-012            | operation=create playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-005 | BDD          | BDD, ATDD      | FR-012            | operation=update playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-006 | BDD          | BDD, ATDD      | FR-012            | operation=delete playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-007 | BDD          | BDD, ATDD      | FR-012            | operation=add playlist items                                                                                                                                                         | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-008 | BDD          | BDD, ATDD      | FR-012            | operation=remove playlist items                                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-018:example-009 | BDD          | BDD, ATDD      | FR-012            | operation=reorder playlist items                                                                                                                                                     | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-001 | BDD          | BDD, ATDD      | FR-012            | operation=create overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-002 | BDD          | BDD, ATDD      | FR-012            | operation=update overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-003 | BDD          | BDD, ATDD      | FR-012            | operation=delete overlay                                                                                                                                                             | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-004 | BDD          | BDD, ATDD      | FR-012            | operation=create playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-005 | BDD          | BDD, ATDD      | FR-012            | operation=update playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-006 | BDD          | BDD, ATDD      | FR-012            | operation=delete playlist                                                                                                                                                            | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-007 | BDD          | BDD, ATDD      | FR-012            | operation=add playlist items                                                                                                                                                         | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-008 | BDD          | BDD, ATDD      | FR-012            | operation=remove playlist items                                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-019:example-009 | BDD          | BDD, ATDD      | FR-012            | operation=reorder playlist items                                                                                                                                                     | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-020             | BDD          | BDD, ATDD      | FR-012            | the request includes an invalid playlist item reference                                                                                                                              | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-021             | BDD          | BDD, ATDD      | FR-012            | the request includes a non-permutation playlist reorder                                                                                                                              | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, EC-013. No sampling; materialize when binding is ready.                         |
| BDD-US2-022             | BDD          | BDD, ATDD      | FR-012            | a creator has overlays, OAuth connections, and runner credentials                                                                                                                    | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-012, SC-002. No sampling; materialize when binding is ready.                         |
| BDD-US2-023             | BDD          | BDD, ATDD      | FR-013            | a overlay create succeeds but its response is lost                                                                                                                                   | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013, EC-014. No sampling; materialize when binding is ready.                         |
| BDD-US2-024             | BDD          | BDD, ATDD      | FR-013            | two identical overlay creates share a retry key                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013, EC-014. No sampling; materialize when binding is ready.                         |
| BDD-US2-025             | BDD          | BDD, ATDD      | FR-013            | a overlay retry key already has a successful result                                                                                                                                  | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013, EC-015. No sampling; materialize when binding is ready.                         |
| BDD-US2-026             | BDD          | BDD, ATDD      | FR-013            | a playlist create succeeds but its response is lost                                                                                                                                  | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013, EC-014. No sampling; materialize when binding is ready.                         |
| BDD-US2-027             | BDD          | BDD, ATDD      | FR-013            | two identical playlist creates share a retry key                                                                                                                                     | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013, EC-014. No sampling; materialize when binding is ready.                         |
| BDD-US2-028             | BDD          | BDD, ATDD      | FR-013            | a playlist retry key already has a successful result                                                                                                                                 | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013, EC-015. No sampling; materialize when binding is ready.                         |
| BDD-US2-029:example-001 | BDD          | BDD, ATDD      | FR-013            | context=client                                                                                                                                                                       | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013. No sampling; materialize when binding is ready.                                 |
| BDD-US2-029:example-002 | BDD          | BDD, ATDD      | FR-013            | context=actor                                                                                                                                                                        | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013. No sampling; materialize when binding is ready.                                 |
| BDD-US2-029:example-003 | BDD          | BDD, ATDD      | FR-013            | context=creator                                                                                                                                                                      | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-013. No sampling; materialize when binding is ready.                                 |
| BDD-US3-040:example-001 | BDD          | BDD, ATDD      | FR-014            | availability=absent                                                                                                                                                                  | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-014, EC-016. No sampling; materialize when binding is ready.                         |
| BDD-US3-040:example-002 | BDD          | BDD, ATDD      | FR-014            | availability=inaccessible                                                                                                                                                            | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-014, EC-016. No sampling; materialize when binding is ready.                         |
| BDD-US3-041             | BDD          | BDD, ATDD      | FR-014            | a persistence failure occurs during a mutation                                                                                                                                       | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-014, EC-017. No sampling; materialize when binding is ready.                         |
| BDD-US3-042             | BDD          | BDD, ATDD      | FR-014            | a dependent-service timeout occurs during a mutation                                                                                                                                 | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US3, FR-014, EC-017. No sampling; materialize when binding is ready.                         |
| BDD-US4-001             | BDD          | BDD, ATDD      | FR-015            | a registration caller exhausts its configured registration budget                                                                                                                    | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US4, FR-015, EC-018, SC-005. No sampling; materialize when binding is ready.                 |
| BDD-US4-002             | BDD          | BDD, ATDD      | FR-015            | a client exhausts its configured tool-call budget                                                                                                                                    | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US4, FR-015, EC-019, SC-005. No sampling; materialize when binding is ready.                 |
| BDD-US4-003             | BDD          | BDD, ATDD      | FR-016            | a connected client has successful and denied authenticated operations                                                                                                                | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US4, FR-016, SC-005. No sampling; materialize when binding is ready.                         |
| BDD-US4-004             | BDD          | BDD, ATDD      | FR-016            | a user cannot access another creator’s activity                                                                                                                                      | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US4, FR-016, EC-020. No sampling; materialize when binding is ready.                         |
| BDD-US1-021:example-001 | BDD          | BDD, ATDD      | FR-001            | client=ChatGPT                                                                                                                                                                       | Positive                       | Real host and Clipify UI | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-001, FR-003, FR-005, FR-007, SC-001. No sampling; materialize when binding is ready. |
| BDD-US1-021:example-002 | BDD          | BDD, ATDD      | FR-001            | client=Claude                                                                                                                                                                        | Positive                       | Real host and Clipify UI | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-001, FR-003, FR-005, FR-007, SC-001. No sampling; materialize when binding is ready. |
| BDD-US1-021:example-003 | BDD          | BDD, ATDD      | FR-001            | client=Codex                                                                                                                                                                         | Positive                       | Real host and Clipify UI | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-001, FR-003, FR-005, FR-007, SC-001. No sampling; materialize when binding is ready. |
| BDD-US1-021:example-004 | BDD          | BDD, ATDD      | FR-001            | client=custom compatible client                                                                                                                                                      | Positive                       | Real host and Clipify UI | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-001, FR-003, FR-005, FR-007, SC-001. No sampling; materialize when binding is ready. |
| BDD-US1-022             | BDD          | BDD, ATDD      | FR-003            | a user can access creators A, B, and C                                                                                                                                               | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-006, FR-008. No sampling; materialize when binding is ready.                 |
| BDD-US1-023             | BDD          | BDD, ATDD      | FR-003            | a connection approves A and B and the user gains access to creator C                                                                                                                 | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-006, FR-011. No sampling; materialize when binding is ready.                 |
| BDD-US2-030:example-001 | BDD          | BDD, ATDD      | FR-007            | resource=overlay; first=browser; second=MCP                                                                                                                                          | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-002 | BDD          | BDD, ATDD      | FR-007            | resource=overlay; first=MCP; second=browser                                                                                                                                          | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-003 | BDD          | BDD, ATDD      | FR-007            | resource=overlay; first=MCP; second=MCP                                                                                                                                              | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-004 | BDD          | BDD, ATDD      | FR-007            | resource=overlay; first=browser; second=browser                                                                                                                                      | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-005 | BDD          | BDD, ATDD      | FR-007            | resource=playlist; first=browser; second=MCP                                                                                                                                         | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-006 | BDD          | BDD, ATDD      | FR-007            | resource=playlist; first=MCP; second=browser                                                                                                                                         | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-007 | BDD          | BDD, ATDD      | FR-007            | resource=playlist; first=MCP; second=MCP                                                                                                                                             | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-008 | BDD          | BDD, ATDD      | FR-007            | resource=playlist; first=browser; second=browser                                                                                                                                     | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-009 | BDD          | BDD, ATDD      | FR-007            | resource=playlist items; first=browser; second=MCP                                                                                                                                   | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-010 | BDD          | BDD, ATDD      | FR-007            | resource=playlist items; first=MCP; second=browser                                                                                                                                   | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-011 | BDD          | BDD, ATDD      | FR-007            | resource=playlist items; first=MCP; second=MCP                                                                                                                                       | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-030:example-012 | BDD          | BDD, ATDD      | FR-007            | resource=playlist items; first=browser; second=browser                                                                                                                               | Negative / boundary            | Browser and MCP          | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-031:example-001 | BDD          | BDD, ATDD      | FR-007            | resource=overlay                                                                                                                                                                     | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-031:example-002 | BDD          | BDD, ATDD      | FR-007            | resource=playlist                                                                                                                                                                    | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US2-031:example-003 | BDD          | BDD, ATDD      | FR-007            | resource=playlist items                                                                                                                                                              | Negative / boundary            | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-014, FR-017, EC-021. No sampling; materialize when binding is ready.         |
| BDD-US1-024:example-001 | BDD          | BDD, ATDD      | FR-003            | selection=Read; permissions=discovery and permitted reads                                                                                                                            | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-018. No sampling; materialize when binding is ready.                         |
| BDD-US1-024:example-002 | BDD          | BDD, ATDD      | FR-003            | selection=Read & edit; permissions=discovery, reads, creates, updates and playlist-item management                                                                                   | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-018. No sampling; materialize when binding is ready.                         |
| BDD-US1-024:example-003 | BDD          | BDD, ATDD      | FR-003            | selection=Read & edit with overlay deletion explicitly selected; permissions=read/edit permissions and overlay deletion only                                                         | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-018. No sampling; materialize when binding is ready.                         |
| BDD-US1-024:example-004 | BDD          | BDD, ATDD      | FR-003            | selection=Read & edit with playlist deletion explicitly selected; permissions=read/edit permissions and playlist deletion only                                                       | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-018. No sampling; materialize when binding is ready.                         |
| BDD-US1-024:example-005 | BDD          | BDD, ATDD      | FR-003            | selection=Read & edit with both delete permissions selected; permissions=read/edit permissions and overlay and playlist deletion                                                     | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-018. No sampling; materialize when binding is ready.                         |
| BDD-US1-024:example-006 | BDD          | BDD, ATDD      | FR-003            | selection=Read & edit with create and update deselected; permissions=discovery, reads and playlist-item management                                                                   | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US1, FR-003, FR-018. No sampling; materialize when binding is ready.                         |
| BDD-US2-032:example-001 | BDD          | BDD, ATDD      | FR-007            | resource=overlay; permission=explicit overlay delete permission; client=a client that confirms destructive calls; outcome=deletion succeeds without a dashboard confirmation         | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-008, FR-018. No sampling; materialize when binding is ready.                 |
| BDD-US2-032:example-002 | BDD          | BDD, ATDD      | FR-007            | resource=playlist; permission=explicit playlist delete permission; client=a client that confirms destructive calls; outcome=deletion succeeds without a dashboard confirmation       | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-008, FR-018. No sampling; materialize when binding is ready.                 |
| BDD-US2-032:example-003 | BDD          | BDD, ATDD      | FR-007            | resource=overlay; permission=read/edit without delete permission; client=a client that ignores destructive hints; outcome=deletion is denied without changing state                  | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-008, FR-018. No sampling; materialize when binding is ready.                 |
| BDD-US2-032:example-004 | BDD          | BDD, ATDD      | FR-007            | resource=playlist; permission=read/edit without delete permission; client=a client that ignores destructive hints; outcome=deletion is denied without changing state                 | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-008, FR-018. No sampling; materialize when binding is ready.                 |
| BDD-US2-032:example-005 | BDD          | BDD, ATDD      | FR-007            | resource=overlay; permission=explicit overlay delete permission; client=a custom client that ignores destructive hints; outcome=deletion succeeds without a dashboard confirmation   | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-008, FR-018. No sampling; materialize when binding is ready.                 |
| BDD-US2-032:example-006 | BDD          | BDD, ATDD      | FR-007            | resource=playlist; permission=explicit playlist delete permission; client=a custom client that ignores destructive hints; outcome=deletion succeeds without a dashboard confirmation | Positive                       | MCP and Clipify UI       | Exact example is both observable behavior and stakeholder acceptance. Additional sources: US2, FR-007, FR-008, FR-018. No sampling; materialize when binding is ready.                 |

### Specification Traceability Inputs

- All scenario IDs above attach to exactly one Scenario; no scenario-specific tag is inherited from Feature.
- Every FR, SC, US, and EC maps through source tags to the inventory and coverage matrix. Every story has both evidence roles required.
- Exactly one suite owns each artifact: BDD owns the feature and bindings; TDD owns the implementation inventory. ATDD is an additional evidence role on the BDD scenarios.
- Planning must materialize the canonical `test-traceability.md`, defect log, and test summary, resolve concrete test paths and commands, and preserve all mandatory cases without renumbering published IDs.
- Production implementation must retain Red → Green → Refactor evidence for each inventory obligation. All executable scenarios must exercise the highest verified real entry point with isolated controlled services and no production credentials.
- Planned evidence is not executed evidence. Specification completion does not imply test or implementation completion.

### Supplemental browser item adapter scenarios

| Scenario ID                       | Primary type | Evidence roles | Acceptance source              | Scenario / example   | Kind                | Level                                      | Rationale                                       |
| --------------------------------- | ------------ | -------------- | ------------------------------ | -------------------- | ------------------- | ------------------------------------------ | ----------------------------------------------- |
| BDD-BROWSER-ITEMS-001:example-001 | BDD          | BDD, ATDD      | FR-007, FR-017                 | reorder              | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-001:example-002 | BDD          | BDD, ATDD      | FR-007, FR-017                 | stale                | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-001:example-003 | BDD          | BDD, ATDD      | FR-007, FR-017                 | missing              | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-001:example-004 | BDD          | BDD, ATDD      | FR-007, FR-017                 | invalid              | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-001:example-005 | BDD          | BDD, ATDD      | FR-007, FR-017                 | removed              | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-001 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items                | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-002 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-clear          | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-003 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-retained       | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-004 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-rename         | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-005 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-pro            | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-006 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-stale          | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-007 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-limit          | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-008 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-provider-error | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-009 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-lost-access    | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |
| BDD-BROWSER-ITEMS-002:example-010 | BDD          | BDD, ATDD      | FR-007, FR-010, FR-014, FR-017 | items-raced          | Positive / boundary | Actual PostgreSQL verified-session backend | Executed adapter evidence; full UI is separate. |

| BDD-BROWSER-ITEMS-003:example-001 | BDD | BDD, ATDD | FR-007, FR-017 | Browser removes clips; parent revision advances | Positive | Actual Next browser + OAuth MCP | Real dashboard and current state through MCP. |
| BDD-BROWSER-ITEMS-003:example-002 | BDD | BDD, ATDD | FR-007, FR-017 | Browser clip save after MCP rename | Negative / boundary | Actual Next browser + OAuth MCP | Safe reload guidance and preserved remote name/clips. |

| BDD-BROWSER-IMPORT-001:example-001 | BDD | BDD, ATDD | FR-011 | Current Pro import commits | Positive | ActualPG verified-session backend | Imported IDs validated with encrypted isolated provider credentials. |
| BDD-BROWSER-IMPORT-001:example-002 | BDD | BDD, ATDD | FR-011 | Pro downgrade during provider lookup | Negative / boundary | ActualPG verified-session backend | Independent entitlement update; final locked check preserves original state. |

| BDD-BROWSER-OVERLAY-DELETE-001:example-001 | BDD | BDD, ATDD | FR-007, FR-017 | Overlay delete | Positive / boundary | ActualPG verified-session backend | Backend adapter only, full browser UI separate. |
| BDD-BROWSER-OVERLAY-DELETE-001:example-002 | BDD | BDD, ATDD | FR-007, FR-017 | Overlay stale | Positive / boundary | ActualPG verified-session backend | Backend adapter only, full browser UI separate. |
| BDD-BROWSER-OVERLAY-DELETE-001:example-003 | BDD | BDD, ATDD | FR-007, FR-017 | Overlay missing-revision | Positive / boundary | ActualPG verified-session backend | Backend adapter only, full browser UI separate. |
| BDD-BROWSER-OVERLAY-DELETE-001:example-004 | BDD | BDD, ATDD | FR-007, FR-017 | Overlay removed | Positive / boundary | ActualPG verified-session backend | Backend adapter only, full browser UI separate. |
| BDD-BROWSER-OVERLAY-DELETE-001:example-005 | BDD | BDD, ATDD | FR-007, FR-017 | Overlay suspended | Positive / boundary | ActualPG verified-session backend | Backend adapter only, full browser UI separate. |

---

## Consolidated workflow expansion

# Feature Specification: MCP product workflows

**Feature Branch**: `feature/mcp-support` (follow-up feature artifacts; original dirty work is preserved)

**Created**: 2026-10-07

**Status**: Accepted for implementation

**Input**: Implement the remaining remote-control, clip discovery/import, gallery/embed, Creator Page and runner tools discussed; marketplace, billing, teams and security mutations are excluded.

## User Scenarios & Testing

### User Story 1 - Remote control (Priority: P1)

Users can manage remote control through an explicitly approved agent.

**BDD**: Required. **ATDD**: Required. **Independent Test**: Execute each advertised operation through the actual MCP handler against isolated state and verify its effect or safe result.

**Why this priority**: Makes existing Clipify workflows usable in conversation while preserving their business limits.

**Acceptance Scenarios**:

- Given current creator authority and required entitlement, when `get_overlay_runtime` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_overlay_queues` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `control_overlay` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `enqueue_overlay_clip` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `clear_overlay_queue` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given missing authority or a disallowed plan, when the operation is attempted, then it fails without disclosing or changing another creator’s resources.

### User Story 2 - Find and import clips (Priority: P1)

Users can manage find and import clips through an explicitly approved agent.

**BDD**: Required. **ATDD**: Required. **Independent Test**: Execute each advertised operation through the actual MCP handler against isolated state and verify its effect or safe result.

**Why this priority**: Makes existing Clipify workflows usable in conversation while preserving their business limits.

**Acceptance Scenarios**:

- Given current creator authority and required entitlement, when `search_clips` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `resolve_clip` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `preview_playlist_import` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `commit_playlist_import` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given missing authority or a disallowed plan, when the operation is attempted, then it fails without disclosing or changing another creator’s resources.

### User Story 3 - Galleries and website embeds (Priority: P2)

Users can manage galleries and website embeds through an explicitly approved agent.

**BDD**: Required. **ATDD**: Required. **Independent Test**: Execute each advertised operation through the actual MCP handler against isolated state and verify its effect or safe result.

**Why this priority**: Makes existing Clipify workflows usable in conversation while preserving their business limits.

**Acceptance Scenarios**:

- Given current creator authority and required entitlement, when `list_galleries` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_gallery` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `create_gallery` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `update_gallery` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `delete_gallery` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `publish_gallery` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_gallery_embed` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_gallery_preview` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_overlay_embed` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given missing authority or a disallowed plan, when the operation is attempted, then it fails without disclosing or changing another creator’s resources.

### User Story 4 - Creator Pages (Priority: P2)

Users can manage creator pages through an explicitly approved agent.

**BDD**: Required. **ATDD**: Required. **Independent Test**: Execute each advertised operation through the actual MCP handler against isolated state and verify its effect or safe result.

**Why this priority**: Makes existing Clipify workflows usable in conversation while preserving their business limits.

**Acceptance Scenarios**:

- Given current creator authority and required entitlement, when `get_creator_page` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `update_creator_page` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `publish_creator_page` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given missing authority or a disallowed plan, when the operation is attempted, then it fails without disclosing or changing another creator’s resources.

### User Story 5 - Runner setup and streaming (Priority: P2)

Users can manage runner setup and streaming through an explicitly approved agent.

**BDD**: Required. **ATDD**: Required. **Independent Test**: Execute each advertised operation through the actual MCP handler against isolated state and verify its effect or safe result.

**Why this priority**: Makes existing Clipify workflows usable in conversation while preserving their business limits.

**Acceptance Scenarios**:

- Given current creator authority and required entitlement, when `get_runner_setup` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `list_runners` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_runner` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `create_runner` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `update_runner` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `delete_runner` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `unlink_runner` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `list_stream_sessions` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_stream_session` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `configure_stream_session` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `control_stream_session` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given current creator authority and required entitlement, when `get_runner_snapshot` is called with valid inputs, then its documented result/effect is returned without unrelated credentials.
- Given missing authority or a disallowed plan, when the operation is attempted, then it fails without disclosing or changing another creator’s resources.

### Edge Cases

- **WF-EC-001**: Wrong creator, missing scope, revoked/expired grant or suspended creator.
- **WF-EC-002**: Free/Pro/runner entitlement loss and retained-resource restrictions.
- **WF-EC-003**: Malformed IDs/links/date bounds/filter options or ambiguous title.
- **WF-EC-004**: Disconnected player, stale live state or command delivery failure.
- **WF-EC-005**: Preview tampering, expiry, wrong grant/creator/playlist, stale revision or duplicate retry.
- **WF-EC-006**: Quota concurrency and foreign playlist/runner/overlay assignment.
- **WF-EC-007**: Unavailable/rate-limited/malformed provider response and partial discovery.
- **WF-EC-008**: Absent/stale/foreign runner snapshot and failed broadcast state.
- **WF-EC-009**: Sensitive credentials or unsupported embed URLs in results/audit.

## Requirements

### Functional Requirements

- **WF-FR-001**: New tools retain creator/scopes/current membership/lifecycle/plan authority and safe auditing.
- **WF-FR-002**: Remote tools expose every existing playback command, queues and fresh/offline runtime state with explicit effect targets.
- **WF-FR-003**: Clip resolution accepts Twitch links or IDs; title search returns candidates instead of assuming unique titles.
- **WF-FR-004**: Discovery supports explicit date/timezone, category, title, view/duration filters and bounded pagination, reporting incomplete results.
- **WF-FR-005**: Import previews list exact proposed clips, duplicates and quota; confirmed commits preserve the expiring selection and revalidate revision/access/limits with replay safety.
- **WF-FR-006**: Gallery CRUD, previews and explicit publication preserve existing Free/Pro and owner-playlist policies.
- **WF-FR-007**: Embed tools return supported Clipify Elements snippets and installation instructions; private browser-source URLs require explicit secret-read authority. Public player embeds MUST provide supported Elements and iframe formats without an OBS secret.
- **WF-FR-008**: Creator Page reads and narrow updates/publication preserve paid social-preview rules and unrelated account settings.
- **WF-FR-009**: Runner setup checks existing runner entitlement and provides official downloads/enrollment instructions without tokens.
- **WF-FR-010**: Runner/session management checks owner assignments and exposes desired versus actual stream state without credentials.
- **WF-FR-011**: Runner snapshots return only assigned fresh preview images, with capture time and unavailable/stale status.
- **WF-FR-012**: Existing approvals do not silently gain authority; new scopes are individually selectable and consequential operations have accurate annotations.

### Key Entities

- Player runtime: authenticated overlay, latest playback/clip/queue reports and freshness.
- Import selection: exact clip IDs, filters, target revision, authorizing grant and expiry.
- Gallery and Creator Page: editable/published configuration with concurrency tokens.
- Runner and stream session: owner assignment, desired/observed state and latest preview.

## Success Criteria

### Measurable Outcomes

- **WF-SC-001**: Every supported remote control operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **WF-SC-002**: Every supported find and import clips operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **WF-SC-003**: Every supported galleries and website embeds operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **WF-SC-004**: Every supported creator pages operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **WF-SC-005**: Every supported runner setup and streaming operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.

## Assumptions

- Existing product capabilities and commercial entitlements remain authoritative. Runner access is a separate existing entitlement, not automatically granted by Pro.
- The host presents import previews and requests confirmation; a tool cannot attest that a human saw or approved a prompt.
- Human runner installation/enrollment and dashboard credential entry remain required.
- One-off clip imports are included; a new scheduled auto-import product is not invented.
- No marketplace submission, account-security mutations, billing or team administration.
- All existing controller commands are included; seek/replay is not invented where absent.

## Test-First Specification Addendum

### Test Classification and Applicability Matrix

| Source ID         | TDD      | BDD      | ATDD     | Intent                                                                                                                                                                                                                                                   |
| ----------------- | -------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WF-FR-001         | Required | Required | Required | New tools retain creator/scopes/current membership/lifecycle/plan authority and safe auditing.                                                                                                                                                           |
| WF-FR-002         | Required | Required | Required | Remote tools expose every existing playback command, queues and fresh/offline runtime state with explicit effect targets.                                                                                                                                |
| WF-FR-003         | Required | Required | Required | Clip resolution accepts Twitch links or IDs; title search returns candidates instead of assuming unique titles.                                                                                                                                          |
| WF-FR-004         | Required | Required | Required | Discovery supports explicit date/timezone, category, title, view/duration filters and bounded pagination, reporting incomplete results.                                                                                                                  |
| WF-FR-005         | Required | Required | Required | Import previews list exact proposed clips, duplicates and quota; confirmed commits preserve the expiring selection and revalidate revision/access/limits with replay safety.                                                                             |
| WF-FR-006         | Required | Required | Required | Gallery CRUD, previews and explicit publication preserve existing Free/Pro and owner-playlist policies.                                                                                                                                                  |
| WF-FR-007         | Required | Required | Required | Embed tools return supported Clipify Elements snippets and installation instructions; private browser-source URLs require explicit secret-read authority. Public player embeds MUST provide supported Elements and iframe formats without an OBS secret. |
| WF-FR-008         | Required | Required | Required | Creator Page reads and narrow updates/publication preserve paid social-preview rules and unrelated account settings.                                                                                                                                     |
| WF-FR-009         | Required | Required | Required | Runner setup checks existing runner entitlement and provides official downloads/enrollment instructions without tokens.                                                                                                                                  |
| WF-FR-010         | Required | Required | Required | Runner/session management checks owner assignments and exposes desired versus actual stream state without credentials.                                                                                                                                   |
| WF-FR-011         | Required | Required | Required | Runner snapshots return only assigned fresh preview images, with capture time and unavailable/stale status.                                                                                                                                              |
| WF-FR-012         | Required | Required | Required | Existing approvals do not silently gain authority; new scopes are individually selectable and consequential operations have accurate annotations.                                                                                                        |
| WF-EC-001         | Required | Required | Required | Wrong creator, missing scope, revoked/expired grant or suspended creator                                                                                                                                                                                 |
| WF-EC-002         | Required | Required | Required | Free/Pro/runner entitlement loss and retained-resource restrictions                                                                                                                                                                                      |
| WF-EC-003         | Required | Required | Required | Malformed IDs/links/date bounds/filter options or ambiguous title                                                                                                                                                                                        |
| WF-EC-004         | Required | Required | Required | Disconnected player, stale live state or command delivery failure                                                                                                                                                                                        |
| WF-EC-005         | Required | Required | Required | Preview tampering, expiry, wrong grant/creator/playlist, stale revision or duplicate retry                                                                                                                                                               |
| WF-EC-006         | Required | Required | Required | Quota concurrency and foreign playlist/runner/overlay assignment                                                                                                                                                                                         |
| WF-EC-007         | Required | Required | Required | Unavailable/rate-limited/malformed provider response and partial discovery                                                                                                                                                                               |
| WF-EC-008         | Required | Required | Required | Absent/stale/foreign runner snapshot and failed broadcast state                                                                                                                                                                                          |
| WF-EC-009         | Required | Required | Required | Sensitive credentials or unsupported embed URLs in results/audit                                                                                                                                                                                         |
| WF-US1, WF-SC-001 | Required | Required | Required | Remote control workflow and denial outcomes                                                                                                                                                                                                              |
| WF-US2, WF-SC-002 | Required | Required | Required | Find and import clips workflow and denial outcomes                                                                                                                                                                                                       |
| WF-US3, WF-SC-003 | Required | Required | Required | Galleries and website embeds workflow and denial outcomes                                                                                                                                                                                                |
| WF-US4, WF-SC-004 | Required | Required | Required | Creator Pages workflow and denial outcomes                                                                                                                                                                                                               |
| WF-US5, WF-SC-005 | Required | Required | Required | Runner setup and streaming workflow and denial outcomes                                                                                                                                                                                                  |

### TDD Test Inventory

Each operation has schema/positive/permission/plan/owner/persistence or external-I/O cases in its story-owned test module. Additional inventories: every remote command (play,pause,skip,hide,show,volume,mute,unmute,toggle_mute), volume 0/100/outside range, all queue scopes; discovery links/IDs/titles/date ordering/pagination/provider failures; preview exact-set/tamper/expiry/binding/revision/quota/replay; gallery layout/source/publication/advanced-field boundaries; Creator Page all five settings and social-field gates; runner platforms/assignment/state/snapshot freshness/credential projection. See test-traceability.md for operation/example rows.

### Scenario Coverage Matrix

Scenario IDs, source relationships and enumerated examples are authoritative in test-traceability.md. Each story has positive operation examples and separate failure outlines covering applicable EC classes. Shared BDD/ATDD roles use one BDD-owned execution because the tool result and persisted effect are the same stakeholder acceptance outcome. No sampling exception or N/A is claimed.

## Feedback submission within MCP support

**FB-FR-001:** Expose `submit_feedback` for authenticated agents with existing `creator:read` access and explicit `feedback:create` OAuth consent for the selected creator, including Free users. The Read preset never authorizes feedback submission. The tool submits feedback about Clipify on explicit user instruction; it does not edit creator resources.

**FB-FR-002:** Accept a strict object containing creatorId, kind (`bug` or `suggestion`), message (trimmed, 1–2000 characters), confirmed (literal true), and retryKey (1–128 characters). Agents must present/obtain the user's requested submission approval; confirmed=true expresses host intent and is not independent evidence of human confirmation. Do not automatically report every tool failure.

**FB-FR-003:** Use the installed Sentry server SDK feedback API so reports enter the same feedback product as the existing browser widget. Mark the source as MCP and category as bug/suggestion. Send no automatic email, transcript, screenshot, replay or token. Audit activity must omit message contents. Return a queued receipt, never claim confirmed delivery. Missing/disabled Sentry must return SERVICE_UNAVAILABLE.

**FB-FR-004:** Limit feedback to five distinct reports per verified user per fixed 24-hour window starting with the first accepted report across creators and connected clients, using RAM only. Equal normalized content for the same creator/category and repeated retry keys deduplicate; conflicting retry-key payloads fail. State is per server process and resets on restart; it is not a distributed global quota. Bound retained users and expire old entries without evicting live budgets. Do not add database tables or change the existing general MCP/auth rate limiter.

**FB-SC-001:** Bug and suggestion submissions, Free/read-only access, exact duplicates/retries, sixth-report denial, expired window, payload validation, missing scopes, revoked grants, foreign creator and unavailable telemetry have executable evidence.

**FB-EC-001:** Backend authorization precedes quota consumption and Sentry submission. Failure at the submission boundary must not be reported as success or expose transport details.

Feedback replay aliases are bounded to five key hashes per receipt. Further fresh-key aliases return RATE_LIMITED; reusing an existing accepted key still deduplicates. Messages and keys are stored only as hashes, alongside receipt IDs/timestamps, for at most 24 hours in RAM.

## Shared limiter refinement

User requested that feedback reuse the existing application rate-limiter infrastructure rather than adding a custom quota implementation. Use the installed rate-limiter-flexible RateLimiterMemory through one shared server core, with a dedicated feedback policy keyed by verified user. The policy uses five points and duration 86400 seconds (a fixed window beginning at first accepted report). Retain only bounded feedback replay/deduplication state; serialize pending submissions per user and refund accepted points if submission fails. App callers retain their wrapper/API. Better Auth and existing distributed MCP transport limits remain unchanged.

## Always-available MCP refinement (2026-10-07)

The user explicitly rejected activation/rollout environment toggles. MCP, its native Better Auth plugins and discovery routes are always installed. Configuration has no enabled property or activation environment flag. Existing credential, canonical identity, origin, schema-readiness, scope and plan checks remain required. Invalid required configuration/schema yields SERVICE_UNAVAILABLE/503, rather than hiding discovery with 404. This decision supersedes historical disabled-rollout acceptance evidence.

### Consent flow refinement (approved October 7, 2026)

Use a reduced Clipify header and small legal/help footer, with English copy throughout. Select one creator, configure Read/Write/Custom permissions, then review. Each creator has independent permissions; review allows editing, removal and adding another creator. Permission areas start collapsed and explain their scope. Custom offers None/Read/Write, disabling unavailable or unrequested access. Write includes requested destructive operations; tool destructive annotations remain in force.

The backend intersects token scopes with each creator's consent and current role/plan access. Legacy grants with NULL creator scopes retain their original global scope ceiling. New consent persists explicit creator scopes. Feedback submission additionally requires feedback:create.

After successful provider authorization, show a four-second redirect countdown, manual return link and cURL/wget/callback-URL recovery tabs with copy actions. Authorization success does not assert that the client connected. Callback credentials stay out of logs and public artifacts.

## Approved refinement: focused editing (2026-10-08)

FR-FE-001: Expose 66 public tools. Replace broad overlay and gallery updates with settings/source/filters/playback-or-layout/theme editing areas. Read tools return only the selected area, creator/resource identity and shared configuration revision. Updates accept only a strict nonempty partial patch for that area; omitted fields remain unchanged. Arrays explicitly replace that field's list. Every change retains the shared backend's current role, per-creator scope, plan, ownership and optimistic revision enforcement.

FR-FE-002: get_overlay_link replaces get_overlay_embed in public discovery and calls. It returns a private browser-source URL for streaming applications, requires overlay-secret:read, and explains credential handling and the public get_player_embed alternative. The legacy broad schemas remain internal backend contracts; they are not callable public aliases.

FR-FE-003: Provide six static, optional MCP prompts and English user-facing examples. Prompts explain creator selection, capability checks, focused editing and revision sequencing, explicit import previews and confirmation, and private-link handling. Retrieving a prompt performs no mutation and grants no permission. Host support determines whether a prompt picker is visible.

AC-FE-001: Theme editing changes the requested visual field while preserving name, filters and playback. Gallery layout edits preserve its name and theme.
AC-FE-002: Cross-area/empty/unknown-field patches and stale revisions do not modify the resource. Missing scope and creator authorization cannot be bypassed by a focused tool.
AC-FE-003: The official SDK discovers 66 described tools and six prompts; the three obsolete public names are absent and cannot execute.
AC-FE-004: Saved player volume and ephemeral live volume remain distinct. Import stays an explicit batch preview/commit workflow, not a new scheduled importer.

## Approved URL-only consent and observability refinement (2026-10-08)

Normal MCP onboarding requires only the Clipify MCP URL. The generic client
learns available resource scopes from protected-resource metadata rather than
an initial read-only challenge. Users choose Read / Write / Custom independently
for each creator on Clipify's consent UI; approval grants only those choices.
Do not silently expand deliberately restricted OAuth requests or signed query
parameters: protocol scope ceilings remain enforced and narrow requests explain
why particular choices are unavailable. Remove manual scope flags from the
normal connection instructions and verify actual SDK discovery-based onboarding.

Add bounded process-local MCP operational counters/gauges/histograms, protected
health snapshot export and an admin-only overview. Export cumulative metrics
for the existing InfluxDB pipeline, with documented reset/replica semantics;
do not export overlapping rolling counts as traffic totals. Provide an importable
Grafana v6 dashboard, ingestion field mapping and executable artifact/schema
validation. No identities, payloads, credentials or arbitrary metric labels.
Historical activity continues to use existing audit records. External monitoring
validation without available access is a separately recorded blocker.

### Client adoption insight (approved 2026-10-08)

Operations should show actual self-reported application names, including Custom
clients. Changing DCR client IDs must not make an application disappear from
name-grouped usage. Distinguish registered clients, clients with current active
grants, and clients with retained MCP tool-call audit activity in the last 30
days. Names are unverified client metadata, not proof of vendor identity. The
admin list is paginated across all groups. Grafana receives a complete
name/count table plus totals, with names as values rather than
unbounded time-series tags. Read existing provider/grant/audit tables; no new
identity maps or schema are required. Audit retention bounds usage history;
deleted client metadata can only be shown as unavailable, not reconstructed.

Client export refinement (2026-10-08): Export every application-name group in each one-minute health scrape, without a Top-X cap. Names remain field values. Influx retention is 30 days. Dashboard files must contain the complete importable dashboard, preserving existing panels.

## Acceptance scope amendment — 2026-10-08

The user explicitly replaced the original four-host release matrix with Codex-driven testing against the PR preview MCP server. ChatGPT web, Claude web and another custom host are deferred to follow-up compatibility work and are no longer merge prerequisites for this PR. Existing independent SDK denial/revocation contracts remain required automated coverage; this amendment does not claim those other products were tested. Historical test-first evidence exceptions and production migration/monitoring rollout requirements remain separate.

The real Codex CLI completed native dynamic registration, user consent and PKCE token exchange against `https://beta-496.clipify.cloud.thedannicraft.de/mcp`. The official SDK then used that grant for preview validation: 66 tools, six prompts, approved-creator reads and unapproved-creator denial; **35/35 disposable mutation checks passed** across overlays, playlists and galleries, including create retry identity, focused editing, stale-revision rejection, invalid input, Free quotas, paid-feature rejection and deletion with persisted absence. Existing development resources were backed up and restored. A subsequent real refresh returned HTTP 200, rotated the refresh token and successfully read the approved creator. No credentials or callback codes are retained in these documents.
