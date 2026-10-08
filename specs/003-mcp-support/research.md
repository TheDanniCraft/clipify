# Research: MCP Support

> Consolidated MCP server scope: 66 tools on `feature/mcp-support`. The original foundation, workflow expansion, feedback and focused editing tools belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

Created 2026-10-04. Decisions are based on repository inspection and current primary documentation; implementation must verify registry availability and APIs against the pinned packages before coding.

## OAuth and libraries

**Decision**: Keep Better Auth 1.7.6; add aligned MCP/CIMD packages plus the official SDK v2 server and test client. Use JWT signing and the MCP plugin, which already composes the OAuth provider; explicitly enable open dynamic registration.

**Rationale**: Existing auth has organization roles, sessions, Twitch, passkeys and Drizzle integration. The MCP plugin supplies authorization discovery, PKCE, resource binding and token handling while the SDK supplies tools and transport. CIMD broadens self-registration options; DCR remains explicitly required by the product.

**Alternatives considered**: Bespoke OAuth server adds unnecessary sensitive code. API keys cannot satisfy the requested authorization flow. Registering both provider plugins duplicates their routes.

Sources: [Better Auth MCP](https://better-auth.com/docs/plugins/mcp), [1.7 upgrade](https://better-auth.com/docs/guides/1-7-upgrade-guide), installed `package.json` and `src/auth/config.ts`.

## Protocol and named-host compatibility

**Decision**: SDK v2 Web handler with `legacy: 'stateless'` supports modern and 2025-era requests at `/mcp`; select the exact published stable v2 release using registry/peer checks. Test actual ChatGPT web, Claude web, Codex CLI, custom client; no claim of success until those runs exist.

**Rationale**: The SDK explicitly documents a dual-era stateless handler. Strict modern rejection would create unnecessary host incompatibility. No host requires Clipify to issue tools using protocol session state.

**Alternatives considered**: Legacy-only SDK v1 delays modern support; strict modern-only is narrower than the approved release matrix; separate endpoints/services add duplication.

Sources: [SDK migration](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/migration/support-2026-07-28.md), [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [Claude Code MCP](https://code.claude.com/docs/en/mcp). ChatGPT/Codex host setup must be verified against official product docs during the host fixture step; protocol era is measured, not assumed.

## Immediate revocation and selected creators

**Decision**: Persist a Clipify grant ID/generation, approved creator set and scopes. Bind issued tokens to that exact grant through supported provider issuance hooks; check it online before every call and refresh expansion. Revoke locally plus provider grant/refresh state.

**Rationale**: A signed JWT can remain valid after provider refresh revocation. Per-request database authorization is necessary for the approved immediate revocation and membership/entitlement behavior. Immutable grant binding prevents lookup of a newer grant giving an older token broader creator access.

**Alternatives considered**: Waiting for JWT expiry violates acceptance. Subject/client-only grant lookup can silently upgrade an old grant. Reusing cookie sessions conflates transport identity and creator context.

Source: [OAuth provider revocation and extension options](https://better-auth.com/docs/plugins/oauth-provider); `src/auth/authorize-operation.ts`, `src/auth/session.ts`.

## Quotas, retries and conflicts

**Decision**: Shared resource services lock the creator account row for quota-relevant transactions; conditional integer resource revisions stop lost updates; retry outcome and audit commit in the same transaction. Use real PostgreSQL connections for race proofs.

**Rationale**: Overlay count/insert is currently outside a transaction. Playlist creation has a transaction but no creator-level lock; concurrent counts can both pass. updatedAt lacks reliable revision semantics. PostgreSQL serialization protects replicas; PGlite-only tests do not establish multi-connection safety.

**Alternatives considered**: MCP-specific checks leave browser bypasses. Local mutexes fail across instances. Timestamp checks are fragile. Automatic merge was explicitly rejected by the user.

Sources: `src/app/actions/database.ts` createOverlay/createPlaylist/item mutation and playlist deletion; `src/db/schema.ts`; `src/server/entitlements/overlay-policy.ts`.

## Risk annotations and consent

**Decision**: Read and Read & edit are customizable presets; neither auto-grants deletion. Map individual scopes to existing permissions. Accurately emit readOnly/destructive/idempotent hints; deletion requires explicit approved delete scope, not a trusted confirmation boolean.

**Rationale**: Client host approval UI is advisory and varies. Clipify can report tool risk and enforce scopes but cannot guarantee prompts in arbitrary clients.

Source: [MCP tool annotations](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/).

## Runtime, metadata fetching and tests

**Decision**: Node runtime routes use Web Request/Response APIs and provider-owned discovery. CIMD uses its Node safe fetch transport (DNS pinning, private/special-address rejection, no redirects). Reuse Jest/PGlite, playwright-bdd and existing CI PostgreSQL instead of adding a test framework.

**Rationale**: Ordinary fetch after validation can re-resolve to private addresses; Node helper owns this boundary. Existing Next.js docs support Web routes. Current coverage globs omit server/auth areas and must be extended for changed files. Existing TDD profile includes stale statements about the constitution; the actual current constitution takes precedence.

Sources: [CIMD](https://better-auth.com/docs/plugins/cimd), `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, `jest.config.js`, `playwright.config.ts`, `.github/workflows/ci.yml`.

## Package metadata verification limitation

Direct npm registry metadata requests through the browsing tool were inaccessible during planning. Exact installation versions remain constrained to the current Better Auth 1.7.6 line and a published compatible stable SDK v2 pair; implementation must verify publication/peer metadata before adding dependencies. This is an installation gate, not proof that any uninstalled package is available.

## Implementation API verification

Verified installed Next.js 16.3.6 route-handlers and use-server guides. Routes use Web Request/Response; server functions authenticate internally and serialize only safe DTOs. Actual Jest configuration is jest.config.cjs (planning references to .js were stale). Published MCP/CIMD 1.7.6 and SDK server/client 2.3.0 installed. OAuth provider explicitly pinned to 1.7.6: its caret transitive dependency initially selected 1.7.7 and caused auth/core peer warnings; explicit pin preserves the existing auth version. No generated migrations.

Coverage collection: Node integration probes execute native ESM compilations of the actual TypeScript sources, with inline source maps and real V8 counters; c8 12 supports the installed Node 22.23.3 runtime. Jest’s custom reporter precedes its built-in coverage reporter (verified installed Jest source), so child coverage can merge before unchanged global/gallery checks. [Official c8 source-map/report documentation](https://github.com/bcoe/c8#sourcemap-support) supports source remapping; no fixture-only or fabricated counters substitute for backend execution.

Remaining policy-writer research (2026-10-05): the installed Better Auth MCP documentation server is present but returns no indexed results for version1.7.6 organization-hook searches. Official [organization documentation](https://better-auth.com/docs/plugins/organization) describes before/after member hooks; [adapter documentation](https://better-auth.com/docs/guides/create-a-db-adapter) describes transaction adapters. Installed 1.7.6 crud-members.mjs invokes beforeRemoveMember before deleteMember; the Drizzle adapter defaults transaction support off, and organization hooks alone do not demonstrate a held creator lock across the actual write. Any policy serialization change must be proven through real transactions and installed adapter APIs, preserving transaction contexts; no concurrency guarantee is inferred merely from a hook name.

## Runtime budget scope

The accepted plan performance goal sets a ten-second dependency timeout, and T211/T243 require ten-second external failure handling. It does not require one cumulative deadline spanning all successful authentication, SQL and vendor calls. Keep each dependency bounded and cancellation-safe; full real-wire and degraded-control acceptance remain open. Do not add a global request timeout as an inferred requirement.

Provider response validation reference: [Twitch refresh tokens](https://dev.twitch.tv/docs/authentication/refresh-tokens/) documents new access/refresh tokens and numeric expiry seconds, storage of rotation and serialized multi-thread refresh. Clipify validation is before BA public token conversion/encrypted persistence;64KiB response cap is an application resource bound, not a documented Twitch provider cap.

OAuth refresh denial classification: [RFC6749 section5.2](https://www.rfc-editor.org/rfc/rfc6749.html#section-5.2) specifies token endpoint invalid_grant for expired/revoked grant and400 status. Native refresh catalogue checks explicit400/error instead of accepting an opaque500 while ensuring no broadened actor/client/resource/creator authority.

Refresh compare-and-swap correction: actual Drizzle1.7.6 incrementOne selected matching IDs in a subquery but outer UPDATE filtered only ID membership; deterministic independent native row lock made two old-token rotations return200. Pinned Bun patch repeats original conditions in outer UPDATE while retaining bounded target selection; fresh native/BDD gives exactly one200/one400. Application auth/core stay1.7.6. Registered patch is patches/@better-auth%2Fdrizzle-adapter@1.7.6.patch and installed-patch validator checks both Next and Drizzle patches.

## Upstream adapter resolution (2026-10-06)

All direct Better Auth packages and the OAuth-provider override now use 1.7.7. The published native Drizzle adapter includes the guarded outer UPDATE from upstream PR #11331, replacing our local 1.7.6 patch. Historical entries above describe the earlier implementation and remain as evidence. The auth schema generation command is aligned to 1.7.7; no schema regeneration or generated migration was performed. Official release: https://github.com/better-auth/better-auth/releases/tag/v1.7.7.

---

## Consolidated workflow expansion

# Research decisions

- Existing browser actions cannot be called under OAuth and must share trusted-principal services instead. Reuse authorizeLockedMutation and owner-bound queries.
- Websocket playback reports already exist; retain authenticated known fields in bounded shared state and report freshness.
- Galleries use Clipify Elements; unsupported raw iframe and /gallery/:id links must not be advertised.
- Runner access is independent of Pro. Preserve RunnerAccess/allocation entitlement and existing device-enrollment flow. Never project tokens/stream keys.
- New gallery/settings concurrency must also cover browser writers. Use schema-owned revision columns where absent; no generated migration files.
- Exact import preview must bind principal/grant and target revision, expire, and commit only its original IDs. Provider resolution occurs before resource locks; final commit revalidates authority and quota.
- Marketplace work is a later PR/release task.

Runner access is required for setup/creation/configuration/control, matching existing product policy. Existing record reads/deletion/unlink do not require an active add-on. Unlink retains the existing runner-credential:rotate permission; it never returns a credential.
