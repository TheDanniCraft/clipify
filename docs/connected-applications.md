# Connected application milestone

This milestone connects a separately built, headless Awards container to Clipify's
cached clip search. It does not move or replace the existing Awards show, add an
Awards dashboard, or provision a production connection automatically.

The Awards image uses its own PostgreSQL and an application credential. It never
receives Clipify's database URL, session cookies, signing secrets or Twitch tokens.
Clipify rechecks its explicit creator/operation grant on every operation and before
returning data. The gateway supports `search_clips`, `resolve_clip` and
`get_clip_playback`, each checked against the application grant. The provision
command grants only search by default. User/MCP grants are unchanged.

## Provision a connection

An operator needs an existing authenticated Clipify platform-admin session, with
the admin's own linked identity. Save the session's Cookie header in a private
mode-0600 file outside the checkout. This file is used only by the operator command,
not mounted into Awards. Browser-session expiry still applies.

After the normal schema migration has been generated on master and applied by
the release process (or an explicitly authorised development schema sync), run:

```sh
CLIPIFY_BASE_URL=https://clipify.us \
CLIPIFY_ADMIN_COOKIE_FILE=/private/clipify-admin-cookie \
node scripts/connected-apps.mjs provision \
  --creator 92541879 --name 'Babbler Awards' --out /private/babbler-connection
```

Use the real selected creator ID; the example does not contact any account itself.
The default grant expires in 30 days. `--expires` accepts an absolute ISO timestamp
in the future, no more than 90 days away. No creator login or membership is created.
Only `creator:read` and the clip-search operation are provisioned.

The command creates a new mode-0700 directory with mode-0600 files: `client-id`,
`client-secret`, `creator-id`, and `connection.json`. It refuses to overwrite an
existing directory. Its output contains the grant ID and destination, not the
client secret. Keep the connection directory out of Git, logs and browser code.
If file delivery fails after provisioning, use the recorded connection information
where available to revoke the grant; do not assume an interrupted setup succeeded.

## Build and run Awards independently

See [the standalone application README](../examples/babbler-awards/README.md).
Build the versioned SDK artifact first, then copy the Awards folder and that
artifact into its own repository or build context. Its Docker build does not read
Clipify source or application configuration.

The production Compose example publishes no ports. Its PostgreSQL is attached
only to an internal network. Awards has a separate outbound network for HTTPS.
Keep Clipify PostgreSQL private in its existing Compose stack; do not add a shared
database network or publish PostgreSQL ports to make this integration work.

The CLI checks `SELECT 1` against its own database, then prints authorised search
results as JSON. No tables, votes or show data are created in this milestone.

```sh
bun packages/sdk/prepare-awards.mjs
bun install --cwd examples/babbler-awards --frozen-lockfile --ignore-scripts
# Configure the standalone Compose secrets as described in its README.
docker compose -f examples/babbler-awards/compose.yaml run --rm awards search --title Minecraft
```

The deployed app needs only its own database password and the Clipify base URL,
creator ID, client ID and client secret. The SDK requests five-minute machine
tokens and renews them without an interactive administrator/creator session.
Grant expiry, revocation, disabled clients and disabled creators still deny reads.

## Revoke

```sh
CLIPIFY_BASE_URL=https://clipify.us \
CLIPIFY_ADMIN_COOKIE_FILE=/private/clipify-admin-cookie \
node scripts/connected-apps.mjs revoke --grant CONNECTION_GRANT_UUID
```

Revocation takes effect for subsequently authorised calls even if an access token
has not expired. The application must not receive another app's credentials, and
registering an OAuth client alone does not grant access to creator resources.

## Validation

```sh
bun run test --runInBand --coverage=false test/server/connected-apps
bun packages/sdk/prepare-awards.mjs
bun install --cwd examples/babbler-awards --frozen-lockfile --ignore-scripts
node --test packages/sdk/test/pack.test.mjs examples/babbler-awards/test/cli.test.mjs
node scripts/test-connected-app-containers.mjs
```

The Docker smoke owns disposable private PostgreSQL services, an ephemeral trusted
TLS certificate, real Better Auth token issuance and actual gateway handlers. Its
native runtime adapter replaces only the `server-only` import marker; domain,
provider and database operations are real. It is not a substitute for the required
Next.js build. No production/shared-development credentials or database are used.
Both stacks are removed after the run, including owned test volumes. Do not run
schema generation or application schema sync as part of container startup.

## Standalone Awards application and release boundary

The independently deployed Awards website now lives in the private
`TheDanniCraft/babbler-awards` repository. The example in this repository remains
a minimal headless SDK consumer and isolation test fixture; it is not the deployed
Awards website. Awards editors, submissions, votes, presentation and uploaded
media belong to the separate application and its own private database/storage.
This change does not install Awards into Clipify's dashboard or move/delete source
show data.

Application access and participant sign-in use separate OAuth clients. Awards
sign-in uses Clipify's authorization-code/PKCE OIDC flow; application credentials
cannot impersonate participants. Twitch polls and predictions are not supported by
this gateway and are not part of this release.

The Test deployment currently uses PR569's preview gateway. Merging this PR does
not change that URL or provision production clients. After the normal generated
migration/release, configure the intended target and explicitly provision its
application/identity clients and grants before switching the consumer. Keep both
databases private; no shared database credentials or published database ports are
needed.
