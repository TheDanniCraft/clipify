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
codex mcp login clipify-preview --oauth-client-registration dcr --scopes creator:read,overlay:read,playlist:read,gallery:read,runner:read,offline_access
```

For this remote development environment, add --no-browser to login: it prints a fresh authorization URL and accepts the resulting callback URL. Authenticate with the preview test account and approve only its test creator. The login command owns OAuth state/PKCE and credential storage; do not construct a static authorization link or paste tokens into the repository. Callback codes are credentials and must not enter retained logs or public PR comments.

The first login is read-only. After verified read tests, a second login can request the required write/delete/remote-control scopes for disposable test resources. Consent offers read/read-and-edit presets and individual scopes; deletion permissions require explicit selection. Reconnect/reload Codex if needed so the authenticated server is available in the agent tool list.

Official connection instructions: https://learn.chatgpt.com/docs/extend/mcp?surface=cli

## Acceptance sequence

1. Discover tools and list only the approved creator's overlays/playlists/galleries/runners. Verify an unapproved creator is denied.
2. Reauthorize the required mutation scopes; create/update/delete uniquely prefixed disposable resources, respecting current-plan limits and revision/retry contracts. Preserve existing creator resources.
3. Check that Free cannot bypass overlay/playlist limits or use Pro-only runner operations.
4. Verify consent denial and revoke the connection in Settings > Connected apps; the existing token must stop working.
5. Record host/version/date, deployment revision, registration method and actual confirmation UI in the feature client matrix. One Codex journey does not close ChatGPT, Claude or custom-host acceptance.

Physical runner control and live-overlay playback require a dedicated online test player/runner. Feedback acceptance remains covered locally with an actual SDK and captured local envelopes; deployed Sentry submissions are opt-in.

## PR 496 preview observation

Preview: https://beta-496.clipify.cloud.thedannicraft.de

On 2026-10-07, both public discovery URLs returned 404 and an unauthenticated POST /mcp returned 503 with service_unavailable. This observation preceded removal of the former activation flag; no OAuth challenge or authorization link was available at that checkpoint. Coolify deployment credentials are unavailable in this workspace. With the current code there is no activation flag. Check the exact preview NEXT_PUBLIC_BASE_URL, the auth/rate-hash secrets and any MCP_ISSUER/MCP_RESOURCE overrides; redeploy, then repeat readiness checks. Database identity and final schema must also be verified before mutations.

The final pre-push regression passed 416 suites / 4495 tests, with 2 suites / 11 existing tests skipped (2484 seconds). GitHub CI was still running when the preview readiness check was recorded. CodeFactor reports 34 annotations, predominantly method complexity, plus a pre-existing SpecKit Python exception-handling finding; those remain review findings rather than a claimed Green quality gate.

With deployment configuration fixed, use the configured clipify-preview server and run:

```sh
codex mcp login clipify-preview --no-browser --oauth-client-registration dcr --scopes creator:read,overlay:read,playlist:read,gallery:read,runner:read,offline_access
```

This produces the fresh authorization URL. It cannot be generated while discovery is unavailable.

Latest preview checkpoint: commit 36cea8a deployed successfully with both public metadata endpoints returning 200. GET/DELETE MCP returned the correct 401 challenge, but POST returned 500. This was reproduced locally on deployment Node 24 as a private-state copy of Next's proxied Request; the correction has passing Node-24 unit and actual production-Next HTTP checks. The following pushed preview must be rechecked before claiming authenticated client readiness.
