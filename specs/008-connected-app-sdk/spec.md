# Feature Specification: Connected application SDK milestone

Branch: `feature/awards-sdk-milestone`. Status: specified. Input: implement the first separate Awards container and SDK; preserve the existing show and private databases.

## User Scenarios & Testing

### US1 — Administrator provisions a limited application (P1)

BDD: Required. ATDD: Required. An authenticated platform administrator creates a machine client for one creator and the `search_clips` operation. The creator need not log in. A non-admin or context-switched creator cannot provision access. Provisioning returns credentials once; revoking or expiring its grant prevents subsequent reads even with an unexpired token.

### US2 — Awards searches through the SDK (P1)

BDD: Required. ATDD: Required. An independently runnable headless Awards container authenticates as its application, searches the permitted creator’s cached clips by title and prints structured results. A different creator, unsupported operation, wrong token audience, invalid credentials and disabled creator produce typed failures. No business logic or database module is imported from Clipify into the SDK.

### US3 — Operators keep deployments isolated (P1)

BDD: Required. ATDD: Required. Awards runs alongside its own private PostgreSQL in a separate Compose project. Both database services publish no host ports, stacks share no database network/credentials, and the Awards application contacts Clipify only over HTTPS (loopback/internal HTTP is explicitly allowed only in disposable tests). Existing Awards source, show data, media and provider connections remain untouched.

## Requirements

- FR-001: Only an authenticated administrator with their own verified identity may provision/revoke a connection; target creator exists and is enabled.
- FR-002: Machine authentication uses installed Better Auth client credentials, explicit scope/resource restrictions, and independent creator/operation grants. User/MCP authentication keeps its current semantics.
- FR-003: Each request checks grant activity/expiry, exact creator/operation, creator lifecycle and bounded shared rate limits; application activity has auditable identity without creator impersonation.
- FR-004: One reusable operation gateway invokes shared cached clip search with title filters, pagination and honest collection completeness. Only `search_clips` is enabled in this milestone.
- FR-005: A separately consumable, versioned SDK owns bounded HTTP/token handling and typed errors, caches short-lived tokens safely and keeps credentials out of returned errors/output.
- FR-006: Independent Awards package/image/Compose connects only to its private database and the authorised Clipify gateway. No UI or existing show migration is included.
- FR-007: Production Compose publishes neither PostgreSQL port; no automatic preview/schema mutation or generated migration files. Provisioning credentials are written to an operator-owned file with restrictive permissions rather than printed to ordinary logs.
- FR-008: Existing show source/data remain intact; core changes are additive and covered by existing OAuth/clip-search regression tests.

## Edge cases

EC-001 missing/malformed token, wrong issuer/audience/client/scope, forbidden token grant type; EC-002 non-admin/sessionless provisioning and confused creator identity; EC-003 foreign/missing/disabled/deleted creator; EC-004 expired/revoked connection at request and response boundary; EC-005 malformed operation/input, overlong/oversize payload, invalid page cursor and cache completeness; EC-006 provider/network/timeout/429/non-JSON/unexpected shape and SDK abort; EC-007 database outage, missing credentials and cross-stack database isolation.

## Success criteria

SC-001: An operator provisions a connection and the standalone container retrieves only matching cached clips for its authorised creator without a creator session.
SC-002: All listed denial/revocation/expiry boundaries pass deterministic executable checks.
SC-003: Real disposable containers demonstrate private PostgreSQL services and SDK-to-gateway search; no live/show database is touched.
SC-004: Existing owning OAuth/search tests and all required CI gates pass before merge.

## Entities

Application client (provider-owned credentials); connection grant (client ID, creator ID, permitted operations, expiry, revocation, provisioning admin); audit event (client/grant/action/outcome); independent Awards database (connectivity only in this milestone).

## Scope and assumptions

Headless means CLI connection/search, not a new public web interface. Administration uses a session-authenticated operator command, avoiding an unfinished admin UI. Independent application scaffold remains self-contained and can be exported to its own repository. No public deployment, production provisioning, database sync or show migration is performed without a later explicit instruction. BDD/ATDD roles share native integration scenarios because their observable boundaries are identical; real Docker is the runtime acceptance owner. No browser journey is added because no visible UI changes.

## Classification matrix

FR-001..008 and EC-001..007: TDD required; BDD and ATDD required with shared native integration ownership. SC-001..004 map to native gateway/SDK/container and regression/CI gates. No duplicated browser version of the same headless behavior.
