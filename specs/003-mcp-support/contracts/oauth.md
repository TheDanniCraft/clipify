# OAuth and Connection Contract

## Native provider and application ownership

The installed `@better-auth/mcp`1.7.7 plugin is the Better Auth OAuth provider configured for MCP; do not compose a second OAuth provider. `jwt()` supplies native signing/JWKS and `cimd()` supplies metadata-document client identity. Runtime bearer verification uses native `requireMcpAuth()`. Better Auth owns registration, signed OAuth request/state, PKCE/code validation, token issuance and refresh. The consent page calls the official `verifyOAuthQueryParams` helper before displaying consent or redirecting to login. Clipify adds bounded request/metadata transport and application-specific allowed scopes/callbacks/rate policy through supported plugin hooks.

The `auth.oauth_*` and `auth.jwks` schema sources mirror provider storage. Application tables have separate responsibilities: `mcp_connection_grants` is the durable approved connection/revocation record; `mcp_grant_creators` is its exact selected creator/agency-context set; `mcp_mutation_retries` stores resource-operation idempotency; `overlay_effect_jobs` stores committed Twitch side-effect intent. Their persistence is an application architecture choice. They do not implement an authorization-code server or token-signature engine.

The native `consentReferenceId` hook binds provider consent to the Clipify grant UUID; native `customAccessTokenClaims` includes that UUID/generation. After native token verification, `resolveMcpGrant` checks the durable connection and shared authorization checks current membership, lifecycle, scope and creator plan. The custom consent page/bridge owns creator selection while delegating actual provider consent/code issuance to `auth.handler`.

Better Auth 1.7.7 includes the upstream Drizzle `incrementOne` fix (PR #11331), which repeats the update predicate outside the selected-ID subquery after a PostgreSQL row-lock wait. The local 1.7.6 adapter patch has been removed. Historical defect/cycle logs retain the reproduced refresh-rotation race; the 1.7.7 regression checks exercise the unpatched native adapter.

## External boundaries

- MCP resource: production `https://clipify.us/mcp`; local test resource uses the exact loopback application origin plus `/mcp`.
- Authorization issuer: resolved Better Auth URL including its actual `/api/auth` base path. Signing key issuer, discovery issuer and token verification issuer must match exactly.
- Provider owns authorization/token/register/revocation/JWKS endpoints beneath its auth base. Route aliases publish protected-resource and authorization-server well-known metadata at the RFC-correct root/path-inserted locations. Do not independently fabricate conflicting metadata. Verify links with real HTTP contracts.
- `/mcp` verifies every request; unauthenticated probe/initialize/discover/tool traffic receives 401 with the provider protected-resource challenge. OAuth missing scopes returns 403 insufficient_scope; absent creator access remains a domain denial, not an invitation to reconsent.
- Stateless HTTP supports SDK-documented modern and legacy traffic with the same registry. Export POST and explicitly delegate GET/DELETE handling to SDK-supported transport behavior (normally 405 in stateless mode); OPTIONS/preflight and browser origin validation must be tested. No authless tool discovery to trick clients into skipping OAuth.

## Client registration

Enable both dynamic and unauthenticated registration flags. A custom client registers public PKCE callbacks without an account/session/secret; registration is not consent. Validate callbacks/scopes/grants through the provider and bound registration records with distributed throttling and expiry cleanup. CIMD is additional supported identity discovery using its safe Node transport; private hosts, special-use IPs, DNS rebinding and redirects are rejected. Do not add third-party callback origins to Better Auth trustedOrigins merely to allow registration.

## Consent and permissions

Use authenticated Clipify page `/auth/mcp/consent` tied to the validated OAuth request. Show client identity, multiple accessible creator choices, Read / Read & edit selection and editable individual permissions. Read: creator and capability discovery, overlay:read, playlist:read. Read & edit adds overlay:create/update and playlist:create/update plus playlist-items:manage. Delete overlay and delete playlist are independent unchecked opt-ins. Distinguish granted permissions from capabilities denied by the creator’s plan. Unknown scopes and selections outside current membership deny issuance.

Persist the exact final scopes/creator set/access contexts in a server-issued grant before token issuance; bind grantId/generation through provider-supported token/consent extension hooks. Verify this bridge in a failing contract test before production implementation. Tokens cannot derive grant identity from clientInfo, arguments or unrelated active organization state. Authorization code and refresh hooks cannot replace the approved creator set from caller metadata. State/callback/PKCE and consent CSRF checks remain provider-owned with Clipify authorization on the selected creator list.

## Revocation and connected clients

Account settings lists user-owned connections with client, approved creators/scopes, creation/expiry and active/revoked state. Revoke is an authenticated CSRF-protected mutation bound to the owner. Commit local grant revocation before reporting removal, then invalidate provider consent/refresh authority; clean up retriably if provider revocation fails while local authority remains revoked. A completed revoke denies the next call and refresh using old access; do not wait for JWT expiry. Requests already committed before the revoke linearization point remain successful. Require grant locks for mutations so completed revocation cannot race a later successful mutation.

## Release interoperability

Each of ChatGPT web, Claude web, Codex CLI and an independent custom client must discover, authorize, deny consent, read, mutate, refresh where supported, and reject access after revoke against isolated Clipify accounts. Record actual product/date/protocol/registration path. Read/create/edit/delete metadata must accurately indicate risk; client confirmation UI is measured but never trusted as backend enforcement. An unavailable vendor prerequisite blocks that profile’s evidence rather than reducing the release scope.
