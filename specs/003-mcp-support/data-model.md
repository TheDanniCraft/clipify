# Data Model: MCP Support

> Consolidated MCP server scope: 50 tools on `feature/mcp-support`. The original 15-tool foundation, 34-tool workflow expansion and feedback tool belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

## Provider-managed authorization entities

Use the pinned Better Auth schema generator for JWT signing keys and OAuth client, authorization-code, access/refresh-token, consent and assertion records. Generate only the auth schema source; inspect model/table names against the existing Drizzle adapter. Provider refresh credentials never enter Clipify retry/audit tables or tool DTOs. Preserve the current auth schema and membership relationships.

## Clipify connection grant

`mcp_connection_grants`: UUID ID, provider consent/grant reference, auth user FK, provider client identifier, immutable generation, approved scopes, createdAt, expiresAt, revokedAt. Treat client identifiers as strings capable of storing CIMD URLs, not UUID-only identifiers. Grant generation is issuance-bound; token claims include grant ID and generation plus provider subject/client/audience. Verify each field online on every authenticated protocol request and tool operation. Expired/revoked grants deny calls even while signed tokens are unexpired. A grant cannot be looked up solely by actor/client because that would allow old tokens to adopt new permissions.

`mcp_grant_creators`: grant FK, creator account FK, access-path context (direct or agency), validated agency organization FK when relevant. Unique (grant, creator) with agency context chosen by consent from current membership. Every call re-resolves current roles/link ceiling. Caller cannot choose an arbitrary agency organization; supplied creatorId only selects an approved target. Expanding creators/scopes requires new consent and a new generation. Reject unapproved or inactive contexts.

State: proposed authorization request → authenticated selection → approved/issued active grant → expired/revoked. Denied consent creates no active authority. Provider issuance/extension hooks must durably bind consent and grants; if storage fails, issue no token. Refresh may retain/narrow scope but never expand creator set or scope without consent.

## Resource revisions

Add `configurationRevision` positive integer default 1 on overlays and playlists, represented as `revision` in tool/browser DTOs. Edit input `expectedRevision` is required and positive; update uses compare-and-write atomically then increments. Playlist item changes advance the parent playlist revision. Configuration writers including reference cleanup and secret rotation increment revisions; runtime usage timestamps do not. Read results include revision. Missing/malformed revision is INVALID_INPUT; stale revision is CONFLICT with fetch-latest guidance.

If deleting a playlist detaches overlay references, advance each affected overlay revision in the same transaction; retain gallery unpublish/reference cleanup semantics. Deletes use the current revision in tool contracts to avoid deleting a resource modified after review. Schema-inferred browser types propagate the new field; old browser tabs receive actionable reload errors.

## Mutation retry record

`mcp_mutation_retries`: UUID ID; grant ID/generation, auth user, client identifier, creator, tool; bounded retry key; canonical input digest; committed safe response JSON (no secret fields); resource ID; createdAt/expiresAt. Unique (grant, actor, client, creator, tool, retryKey); retain at least 24 hours. Validate authorization before reading a cached response. Identical key+input returns the original committed response; changed input produces RETRY_CONFLICT. Concurrent identical requests serialize; failed uncommitted work leaves no success record. Creator quota lock is acquired before reservation; no pending row survives transaction rollback.

Creation, retry result and success activity commit together. Revocation/entitlement checks still apply on replay; a replay never re-creates a resource. Expired records are cleaned in bounded scheduled batches. After expiry, a fresh key is needed; inspect state before retrying an uncertain original create.

## Activity

Extend existing `auditEventsTable` action class with MCP actions. Use actorUserId, accountOrganizationId, target type/ID only after accessible-target resolution, outcome, reason, correlationId, occurredAt and allowlisted metadata {clientId, grantId, creatorId, toolName}. Do not put OAuth token, cookie, raw inputs, clip payloads or resource secret in metadata. Never misuse actorSessionId as a grant ID. Success audit is transaction-bound; denied authenticated attempts record minimal known approved context without looking up inaccessible target contents. Storage failure produces a safe service error; mutation does not silently succeed without required durable audit.

Activity listing requires current audit permission and creator access, cursor pagination and existing privacy retention/deletion policies. A user may always view/revoke their own connected apps through authenticated account settings; creator-wide activity still follows audit role permissions. Anonymous malformed tokens contribute sanitized operational metrics rather than user-attributed activity.

## Rate-limit state

Reuse existing database counters and HMAC signal hashing. Separate registration network keys from authenticated actor+client keys. Enforce configured limits atomically across replicas, emit Retry-After, prune expired counters. Provider endpoints must be wrapped with the shared limiter without disabling existing Better Auth CSRF/origin protections. Missing limiter/audit dependencies fail closed.

## Constraints and migration ownership

Foreign keys, uniqueness, indexes, positive revision checks and retry expiry indexes are expressible in Drizzle schema source. No custom migration is required by this design. Generated `drizzle/` files remain untouched; post-merge Generate Migrations owns generation. Local application schema validation uses only authorized disposable development databases; CI browser-tests retains its guarded loopback PostgreSQL exception.

## Durable overlay provider intents

`overlay_effect_jobs`: UUID ID; overlay and creator foreign keys with cascade deletion; reward ID (same255character maximum as browser input); committed configuration revision; pending/claimed/retry/done/obsolete status; attempt count; scheduled/created/updated times; opaque UUID claim owner and lease expiry; fixed nonsecret error code. Unique(overlay,revision). Changed nonempty Pro browser rewards enqueue inside the existing resource/audit transaction; unchanged/cleared/stale/rolled-back edits create no job.

Claims commit before provider I/O. Each queued operation renews only its still-owned unexpired lease; acknowledgements compare claim owner. Expired orphan claims are recoverable. Provider failures schedule exponential retry capped at1hour without recreating the resource. Changed/cleared current rewards make earlier intents obsolete; unrelated name/revision changes do not lose a still-required subscription. The private30second scheduler reads schema readiness before work and remains independent of public request availability. Source-schema migrations remain master-workflow generated.

---

## Consolidated workflow expansion

# Data model

Existing ownership remains creator ID based. Gallery and Creator Page settings receive positive configurationRevision integers maintained by both interfaces. Runner/session writes use stored state concurrency tokens without leaking tokens/keys. Runtime state is bounded, fresh process-local reporting and must identify unavailable state across processes. Import selections are cryptographically authenticated bounded payloads with exact IDs, creator/playlist/revision/grant/generation/actor/client, creation time and expiry; commit results use existing retained mutation-retry storage and shared locked playlist mutation. Foreign-resource assignments are rejected.
