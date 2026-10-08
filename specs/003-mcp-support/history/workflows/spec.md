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

- **EC-001**: Wrong creator, missing scope, revoked/expired grant or suspended creator.
- **EC-002**: Free/Pro/runner entitlement loss and retained-resource restrictions.
- **EC-003**: Malformed IDs/links/date bounds/filter options or ambiguous title.
- **EC-004**: Disconnected player, stale live state or command delivery failure.
- **EC-005**: Preview tampering, expiry, wrong grant/creator/playlist, stale revision or duplicate retry.
- **EC-006**: Quota concurrency and foreign playlist/runner/overlay assignment.
- **EC-007**: Unavailable/rate-limited/malformed provider response and partial discovery.
- **EC-008**: Absent/stale/foreign runner snapshot and failed broadcast state.
- **EC-009**: Sensitive credentials or unsupported embed URLs in results/audit.

## Requirements

### Functional Requirements

- **FR-001**: New tools retain creator/scopes/current membership/lifecycle/plan authority and safe auditing.
- **FR-002**: Remote tools expose every existing playback command, queues and fresh/offline runtime state with explicit effect targets.
- **FR-003**: Clip resolution accepts Twitch links or IDs; title search returns candidates instead of assuming unique titles.
- **FR-004**: Discovery supports explicit date/timezone, category, title, view/duration filters and bounded pagination, reporting incomplete results.
- **FR-005**: Import previews list exact proposed clips, duplicates and quota; confirmed commits preserve the expiring selection and revalidate revision/access/limits with replay safety.
- **FR-006**: Gallery CRUD, previews and explicit publication preserve existing Free/Pro and owner-playlist policies.
- **FR-007**: Embed tools return supported Clipify Elements snippets and installation instructions; private browser-source URLs require explicit secret-read authority. Public player embeds MUST provide supported Elements and iframe formats without an OBS secret.
- **FR-008**: Creator Page reads and narrow updates/publication preserve paid social-preview rules and unrelated account settings.
- **FR-009**: Runner setup checks existing runner entitlement and provides official downloads/enrollment instructions without tokens.
- **FR-010**: Runner/session management checks owner assignments and exposes desired versus actual stream state without credentials.
- **FR-011**: Runner snapshots return only assigned fresh preview images, with capture time and unavailable/stale status.
- **FR-012**: Existing approvals do not silently gain authority; new scopes are individually selectable and consequential operations have accurate annotations.

### Key Entities

- Player runtime: authenticated overlay, latest playback/clip/queue reports and freshness.
- Import selection: exact clip IDs, filters, target revision, authorizing grant and expiry.
- Gallery and Creator Page: editable/published configuration with concurrency tokens.
- Runner and stream session: owner assignment, desired/observed state and latest preview.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every supported remote control operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **SC-002**: Every supported find and import clips operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **SC-003**: Every supported galleries and website embeds operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **SC-004**: Every supported creator pages operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.
- **SC-005**: Every supported runner setup and streaming operation completes the stated workflow in isolated acceptance tests, with all unauthorized and disallowed cases denied.

## Assumptions

- Existing product capabilities and commercial entitlements remain authoritative. Runner access is a separate existing entitlement, not automatically granted by Pro.
- The host presents import previews and requests confirmation; a tool cannot attest that a human saw or approved a prompt.
- Human runner installation/enrollment and dashboard credential entry remain required.
- One-off clip imports are included; a new scheduled auto-import product is not invented.
- No marketplace submission, account-security mutations, billing or team administration.
- All existing controller commands are included; seek/replay is not invented where absent.

## Test-First Specification Addendum

### Test Classification and Applicability Matrix

| Source ID   | TDD      | BDD      | ATDD     | Intent                                                                                                                                                                                                                                                   |
| ----------- | -------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | Required | Required | Required | New tools retain creator/scopes/current membership/lifecycle/plan authority and safe auditing.                                                                                                                                                           |
| FR-002      | Required | Required | Required | Remote tools expose every existing playback command, queues and fresh/offline runtime state with explicit effect targets.                                                                                                                                |
| FR-003      | Required | Required | Required | Clip resolution accepts Twitch links or IDs; title search returns candidates instead of assuming unique titles.                                                                                                                                          |
| FR-004      | Required | Required | Required | Discovery supports explicit date/timezone, category, title, view/duration filters and bounded pagination, reporting incomplete results.                                                                                                                  |
| FR-005      | Required | Required | Required | Import previews list exact proposed clips, duplicates and quota; confirmed commits preserve the expiring selection and revalidate revision/access/limits with replay safety.                                                                             |
| FR-006      | Required | Required | Required | Gallery CRUD, previews and explicit publication preserve existing Free/Pro and owner-playlist policies.                                                                                                                                                  |
| FR-007      | Required | Required | Required | Embed tools return supported Clipify Elements snippets and installation instructions; private browser-source URLs require explicit secret-read authority. Public player embeds MUST provide supported Elements and iframe formats without an OBS secret. |
| FR-008      | Required | Required | Required | Creator Page reads and narrow updates/publication preserve paid social-preview rules and unrelated account settings.                                                                                                                                     |
| FR-009      | Required | Required | Required | Runner setup checks existing runner entitlement and provides official downloads/enrollment instructions without tokens.                                                                                                                                  |
| FR-010      | Required | Required | Required | Runner/session management checks owner assignments and exposes desired versus actual stream state without credentials.                                                                                                                                   |
| FR-011      | Required | Required | Required | Runner snapshots return only assigned fresh preview images, with capture time and unavailable/stale status.                                                                                                                                              |
| FR-012      | Required | Required | Required | Existing approvals do not silently gain authority; new scopes are individually selectable and consequential operations have accurate annotations.                                                                                                        |
| EC-001      | Required | Required | Required | Wrong creator, missing scope, revoked/expired grant or suspended creator                                                                                                                                                                                 |
| EC-002      | Required | Required | Required | Free/Pro/runner entitlement loss and retained-resource restrictions                                                                                                                                                                                      |
| EC-003      | Required | Required | Required | Malformed IDs/links/date bounds/filter options or ambiguous title                                                                                                                                                                                        |
| EC-004      | Required | Required | Required | Disconnected player, stale live state or command delivery failure                                                                                                                                                                                        |
| EC-005      | Required | Required | Required | Preview tampering, expiry, wrong grant/creator/playlist, stale revision or duplicate retry                                                                                                                                                               |
| EC-006      | Required | Required | Required | Quota concurrency and foreign playlist/runner/overlay assignment                                                                                                                                                                                         |
| EC-007      | Required | Required | Required | Unavailable/rate-limited/malformed provider response and partial discovery                                                                                                                                                                               |
| EC-008      | Required | Required | Required | Absent/stale/foreign runner snapshot and failed broadcast state                                                                                                                                                                                          |
| EC-009      | Required | Required | Required | Sensitive credentials or unsupported embed URLs in results/audit                                                                                                                                                                                         |
| US1, SC-001 | Required | Required | Required | Remote control workflow and denial outcomes                                                                                                                                                                                                              |
| US2, SC-002 | Required | Required | Required | Find and import clips workflow and denial outcomes                                                                                                                                                                                                       |
| US3, SC-003 | Required | Required | Required | Galleries and website embeds workflow and denial outcomes                                                                                                                                                                                                |
| US4, SC-004 | Required | Required | Required | Creator Pages workflow and denial outcomes                                                                                                                                                                                                               |
| US5, SC-005 | Required | Required | Required | Runner setup and streaming workflow and denial outcomes                                                                                                                                                                                                  |

### TDD Test Inventory

Each operation has schema/positive/permission/plan/owner/persistence or external-I/O cases in its story-owned test module. Additional inventories: every remote command (play,pause,skip,hide,show,volume,mute,unmute,toggle_mute), volume 0/100/outside range, all queue scopes; discovery links/IDs/titles/date ordering/pagination/provider failures; preview exact-set/tamper/expiry/binding/revision/quota/replay; gallery layout/source/publication/advanced-field boundaries; Creator Page all five settings and social-field gates; runner platforms/assignment/state/snapshot freshness/credential projection. See test-traceability.md for operation/example rows.

### Scenario Coverage Matrix

Scenario IDs, source relationships and enumerated examples are authoritative in test-traceability.md. Each story has positive operation examples and separate failure outlines covering applicable EC classes. Shared BDD/ATDD roles use one BDD-owned execution because the tool result and persisted effect are the same stakeholder acceptance outcome. No sampling exception or N/A is claimed.
