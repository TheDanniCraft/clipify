# OAuth startup and deployment diagnostics

Investigation of the production deployment on 2026-10-09. These findings
distinguish the dashboard outage from the other messages in the deployment log.

## OAuth resource initialization

The production event [CLIPIFY-R](https://thedannicraft.sentry.io/issues/CLIPIFY-R)
contains PostgreSQL error `23505` on `oauth_resource_identifier_unique` inside
Drizzle's failed-query error. This is a concurrent resource insertion, not a
migration failure or a database lock.

Better Auth 1.7.7 already intends to tolerate another initializer creating the
same resource. Its resource seeder checks the outer error message for a duplicate
error, but Drizzle keeps that information in `error.cause`. The adapter wrapper
normalizes only this exact model, PostgreSQL code, and constraint. Better Auth's
existing handler can then finish initialization. Other errors propagate, and no
existing resource or user data is updated or deleted.

A single production-build Next process created separate auth objects when
dashboard navigation loaded the dashboard bundle and `/api/auth/get-session`
loaded the auth route bundle. Both bundles include `src/auth/config.ts`, whose
module-level construction runs in each bundle context. This does not require two
Next servers or an old container. The production event identifies the failing
bundle but does not identify the winning initializer, so the exact historical
request pair cannot be established retrospectively.

The PostgreSQL regression forces both initializers to observe an absent resource.
Without normalization, one initializer rejects. With normalization, both finish,
both discovery endpoints return 200, and exactly one resource row exists. Unit
tests also exercise unrelated constraints, other models, permission errors, and
cyclic error causes. The same database uniqueness boundary applies across
containers; an in-process singleton alone would not solve that race.

## Response listener warning

With Sentry server instrumentation enabled in the production build, requests to
the Plausible script proxy reach 11 `close` listeners on each `ServerResponse`:

- Two Sentry request session/span hooks.
- Two Next router/request-abort hooks.
- Two httpxy request/proxy hooks.
- Three Next proxy cancellation/cleanup hooks.
- One httpxy response hook and one Node `Readable.pipe` hook.

The allocation stack at the threshold points to Next's compiled httpxy response
handler. It is not an MCP listener or an OAuth initialization listener.

The retention experiment used a local analytics upstream, a no-op Sentry
transport, weak references to responses, and explicit garbage collection. All
60 proxy requests succeeded. Each reached 11 listeners; subsequently none of
the 60 response objects remained alive. Heap usage settled around 83.4 MB.
This establishes bounded retention for the reproduced path, not the absence of
every possible application memory leak.

The cancellation hooks protect against disconnected clients leaving upstream
requests running. They have not been removed. No global listener limit has been
raised, and warnings have not been filtered out. The threshold warning can still
occur on this upstream proxy path; eliminating it requires a separately validated
change to proxy/instrumentation lifecycle behavior, not hiding errors.

## Grafana Cloud editor

The old acceptance check imported Classic JSON through `/api/dashboards/db`.
Grafana Cloud's dashboard JSON editor instead expects a V2 dashboard resource.
That missing boundary test allowed the invalid editor document to pass.

The complete v6 file now contains `apiVersion`, `kind`, `metadata.name`, and the
full V2 `spec`. Grafana 13.2.3's converter preserved all 69 panels, their titles
and Flux queries, and 12 rows. The resource passed API create/update and an actual
browser paste followed by **Apply changes** in the JSON editor. The existing
dashboard UID is preserved. No live Cloud dashboard was modified during testing.

See [monitoring instructions](../grafana/mcp-monitoring.md) for the full file and
the editor API-version compatibility requirement.

## Other deployment messages

The Twitch chat subscription 403 also appears in Sentry before this deployment.
`subscribeToChat` uses an app access token and the configured bot user ID. Twitch
requires the bot's `user:read:chat` and `user:bot` grants, plus the broadcaster's
`channel:bot` grant or moderator status. Normal creator sign-in requests
`channel:bot`; it does not grant the separate bot identity's permissions.
The 403 does not specify which grant is missing. Verify both identities authorized
the same Twitch client and reauthorize the missing grant before retesting.
Do not add bot permissions to every creator's login or treat a client-credentials
token refresh as a replacement for user consent.

A read-only check using production's configured Twitch application on 2026-10-09
confirmed that the bot currently has `user:read:chat` and `user:bot`. The two
checked owner accounts also currently grant `channel:bot`. These results rule out
missing grants for those checked identities at inspection time, but the sanitized
historical log does not identify the broadcaster that failed. They do not justify
claiming that every creator's grants are valid or that this historical 403 is
fixed. The check used Twitch's `/helix/authorization/users` endpoint; it did not
create a subscription or change permissions.

Reference: [Twitch chat subscription authorization](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage).

The missing Server Action message means the requested ID is absent from the
current build. It appeared immediately after deployment and is consistent with
an older browser using the new server; the original request's browser build was
not captured, so that cause is not conclusively established. Production image
builds already supply a commit-based deployment ID, and long-lived overlay pages
already check for deployment changes and reload. A single local diagnostic build
without release environment values does not prove the production ID was absent.
Test an old browser against a newly deployed image to verify rollout recovery;
rebuilding a single image and unit-testing its actions does not cover that case.

Reference: [Next's Server Action diagnostic](https://nextjs.org/docs/messages/failed-to-find-server-action).

## Remaining acceptance limits

The OAuth PostgreSQL race and Grafana editor failures are repaired and reproduced.
The proxy warning's source and response retention are established, but its noise
is not removed. Twitch authorization is valid for the checked production
identities; the historical failing broadcaster remains unidentified.
Deployment-skew attribution remains provisional. These
limits must remain visible in the PR rather than being described as all errors
fixed.
