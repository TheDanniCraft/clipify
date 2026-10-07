# MCP preview handoff

Use the PR preview HTTPS origin, never the production origin, and a dedicated Clipify test account/creator. Verify the deployed revision matches the PR head before executing mutations.

## Deployment prerequisites

- Set MCP_ENABLED=true and NEXT_PUBLIC_BASE_URL to the exact preview HTTPS origin.
- Provide BETTER_AUTH_SECRET and an independent RATE_LIMIT_HASH_SECRET (at least 32 characters) through the deployment secret store.
- Verify DATABASE_URL points to the disposable development/test database. An HTTPS preview alone does not prove database isolation.
- Apply the final schema only to that disposable development database through the permitted Infisical db:push workflow if the preview lacks the new tables. Feature branches must not generate Drizzle migrations; master migration generation remains workflow-owned.
- Use direct PostgreSQL/session pooling for provider credential coordination.
- Keep production runner targets, Twitch broadcasts and real feedback submissions outside automatic smoke tests. Preview feedback calls still use the deployed Sentry transport; the local test transport does not carry into a deployed app.

## Public readiness checks

Check GET /.well-known/oauth-protected-resource, GET /.well-known/oauth-authorization-server and an unauthenticated POST /mcp. Metadata must describe this preview origin; the protected endpoint must return an OAuth challenge, not a login HTML page. A disabled MCP endpoint returns 404 and requires deployment configuration, not client authorization.

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
