# MCP preview handoff

Use the PR preview HTTPS origin, never the production origin, and a dedicated Clipify test account/creator. Verify the deployed revision matches the PR head before executing mutations.

## Deployment prerequisites

- Set NEXT_PUBLIC_BASE_URL to the exact preview HTTPS origin.
- Provide BETTER_AUTH_SECRET and an independent RATE_LIMIT_HASH_SECRET (at least 32 characters) through the deployment secret store.
- Verify DATABASE_URL points to the disposable development/test database. An HTTPS preview alone does not prove database isolation.
- Apply the final schema only to that disposable development database through the permitted Infisical db:push workflow if the preview lacks the new tables. Feature branches must not generate Drizzle migrations; master migration generation remains workflow-owned.
- Use direct PostgreSQL/session pooling for provider credential coordination.
- Keep production runner targets, Twitch broadcasts and real feedback submissions outside automatic smoke tests. Preview feedback calls still use the deployed Sentry transport; the local test transport does not carry into a deployed app.

## Public readiness checks

Check GET /.well-known/oauth-protected-resource, GET /.well-known/oauth-authorization-server/api/auth and an unauthenticated POST /mcp. Metadata must describe this preview origin; the protected endpoint must return an OAuth challenge, not a login HTML page. Invalid credentials/configuration or an unavailable required schema return 503; MCP has no feature toggle and discovery is not hidden behind a 404.

## Connect Codex

Replace PREVIEW_ORIGIN with the verified HTTPS origin:

```sh
codex mcp add clipify-preview --url "PREVIEW_ORIGIN/mcp"
codex mcp login clipify-preview --oauth-client-registration dcr
```

For this remote development environment, add --no-browser to login: it prints a fresh authorization URL and accepts the resulting callback URL. Authenticate with the preview test account and approve only its test creator. The login command owns OAuth state/PKCE and credential storage; do not construct a static authorization link or paste tokens into the repository. Callback codes are credentials and must not enter retained logs or public PR comments.

The normal connection needs only the MCP URL. The client discovers supported scopes automatically; choose Read, Write or Custom separately for each creator in Clipify consent. Write includes available destructive permissions; dedicated credential/secret permissions remain explicit Custom choices. A deliberately scope-limited client cannot exceed its signed OAuth request. Reconnect/reload Codex if needed so the authenticated server is available in the agent tool list.

Official connection instructions: https://learn.chatgpt.com/docs/extend/mcp?surface=cli

## Acceptance sequence

1. Discover tools and list only the approved creator's overlays/playlists/galleries/runners. Verify an unapproved creator is denied.
2. Select the required mutation permissions in consent; create/update/delete uniquely prefixed disposable resources, respecting current-plan limits and revision/retry contracts. Preserve existing creator resources.
3. Check that Free cannot bypass overlay/playlist limits or use Pro-only runner operations.
4. Verify consent denial and revoke the connection in Settings > Connected apps; the existing token must stop working.
5. Record host/version/date, deployment revision, registration method and actual confirmation UI in the feature client matrix. One Codex journey does not close ChatGPT, Claude or custom-host acceptance.

Physical runner control and live-overlay playback require a dedicated online test player/runner. Feedback acceptance remains covered locally with an actual SDK and captured local envelopes; deployed Sentry submissions are opt-in.

## PR 496 preview observation

Preview: https://beta-496.clipify.cloud.thedannicraft.de

On 2026-10-07, both public discovery URLs returned 404 and an unauthenticated POST /mcp returned 503 with service_unavailable. This observation preceded removal of the former activation flag; no OAuth challenge or authorization link was available at that checkpoint. Coolify deployment credentials are unavailable in this workspace. With the current code there is no activation flag. Check the exact preview NEXT_PUBLIC_BASE_URL, the auth/rate-hash secrets; redeploy, then repeat readiness checks. Database identity and final schema must also be verified before mutations.

The final pre-push regression passed 416 suites / 4495 tests, with 2 suites / 11 existing tests skipped (2484 seconds). GitHub CI was still running when the preview readiness check was recorded. CodeFactor reports 34 annotations, predominantly method complexity, plus a pre-existing SpecKit Python exception-handling finding; those remain review findings rather than a claimed Green quality gate.

With deployment configuration fixed, use the configured clipify-preview server and run:

```sh
codex mcp login clipify-preview --no-browser --oauth-client-registration dcr
```

This produces the fresh authorization URL. It cannot be generated while discovery is unavailable.

Latest preview checkpoint: commit 36cea8a deployed successfully with both public metadata endpoints returning 200. GET/DELETE MCP returned the correct 401 challenge, but POST returned 500. This was reproduced locally on deployment Node 24 as a private-state copy of Next's proxied Request; the correction has passing Node-24 unit and actual production-Next HTTP checks. The following pushed preview must be rechecked before claiming authenticated client readiness.

## Current live preview checkpoint — 2026-10-08

Coolify reported the f5cace5 preview deployment ready. Codex CLI registered a
client with DCR, completed user consent with PKCE/state and stored OAuth
credentials. The preview grant is also present in the Infisical development
database, confirming the live request path uses that database. No production
origin was used. Callback codes and credentials are omitted from evidence.

Verified with installed official MCP client SDK 2.3.0:

- Both correctly located metadata endpoints return 200 and advertise the
  preview resource/issuer. Unauthenticated POST /mcp returns 401 with challenge.
- Discovery returns 66 tools and six prompts. list_creators returns exactly the
  one approved creator; an unapproved creator returns ACCESS_DENIED.
- Capabilities and overlay/playlist/gallery/runner/creator-page lists read
  successfully. Free usage equals its one-overlay/playlist/gallery limits.
- Twenty-four focused live checks all pass: overlay and source/filter/playback/
  theme reads; gallery and source/filter/layout/theme reads; gallery embed and
  preview; playlist/player embed; runner details and Linux setup; stream-session
  listing; all three create calls denied with PLAN_LIMIT_REACHED; ungranted
  overlay-secret read rejected at the protocol boundary; missing resource,
  invalid UUID and unknown-tool rejection.
- Refresh returns 200 with rotated refresh token. Reusing the old refresh token
  returns 400. A subsequent read with the new access token succeeds. Updated
  credentials remain in Codex's credential store, never repository evidence.

The initial ad-hoc probe mistakenly requested a nonexistent get_overlay_settings
read tool and omitted the runner setup platform. Both probe errors were
corrected using actual discovered schemas; the current 24-check batch is Green.
No production repair was required for these two probe mistakes.

Existing resources were read, not edited/deleted. Successful disposable writes
are blocked by the approved Free creator's full capacity; another disposable
creator with capacity and OAuth approval is requested. Physical runner/playback
requires an online test target; delete/control/secret scopes are ungranted;
revocation remains pending. Named-host acceptance beyond Codex remains open.
These results establish deployed discovery/read/limit enforcement/refresh,
not complete live acceptance or release readiness.

Additional auto-negotiation SDK check: all six published prompts retrieve
nonempty messages, and the Free creator's remote overlay runtime read returns
FEATURE_RESTRICTED. Both legacy-mode and auto-negotiation clients have thus
completed deployed read/discovery traffic; this is still distinct from actual
ChatGPT/Claude-host acceptance.

The earlier CI BDD playlist quick-editor failure was a strict selector matching
both an exiting Select dialog and the editor modal. The selector now targets
the named Manage Playlist dialog. All four affected actual browser scenarios
pass against disposable fixtures in 23.4 seconds; no assertions or production
behavior were removed. Full CI verification of the new commit remains pending.

### Live disposable mutations — subsequent 2026-10-08 checkpoint

The user explicitly authorized disposable development-data changes and backup.
The live grant was verified in the Infisical development DB. All three original
resource rows were backed up privately. A temporary fixture creator held the
original rows while the approved creator's ordinary Free counts had room for
test resources. Plan limits, entitlements and OAuth scopes were not changed.

Create overlay/playlist/gallery and identical-key retry pass with the same IDs.
Overlay rename/pause, playlist rename and gallery rename succeed. Stale
revisions return CONFLICT; invalid patch returns INVALID_INPUT; Free theme edit
returns FEATURE_RESTRICTED. A second resource of each kind returns
PLAN_LIMIT_REACHED. All 20 SDK calls and three retry-ID assertions pass.
Cleanup removes disposable rows and the fixture creator. Subsequent DB checks
confirm every original row exactly matches its JSON-serialized backup and each
original resource count is one. Cleanup uses explicit development fixture DB
cleanup, not MCP delete; positive MCP deletion requires a newly approved grant.

## Acceptance scope amendment — 2026-10-08

The user explicitly replaced the original four-host release matrix with Codex-driven testing against the PR preview MCP server. ChatGPT web, Claude web and another custom host are deferred to follow-up compatibility work and are no longer merge prerequisites for this PR. Existing independent SDK denial/revocation contracts remain required automated coverage; this amendment does not claim those other products were tested. Historical test-first evidence exceptions and production migration/monitoring rollout requirements remain separate.

The real Codex CLI completed native dynamic registration, user consent and PKCE token exchange against `https://beta-496.clipify.cloud.thedannicraft.de/mcp`. The official SDK then used that grant for preview validation: 66 tools, six prompts, approved-creator reads and unapproved-creator denial; **35/35 disposable mutation checks passed** across overlays, playlists and galleries, including create retry identity, focused editing, stale-revision rejection, invalid input, Free quotas, paid-feature rejection and deletion with persisted absence. Existing development resources were backed up and restored. A subsequent real refresh returned HTTP 200, rotated the refresh token and successfully read the approved creator. No credentials or callback codes are retained in these documents.
