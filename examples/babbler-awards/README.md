# Babbler Awards connection milestone

This is a separate, headless application scaffold. It proves that an independently
built Awards container can search the clips an administrator granted it without
access to Clipify's PostgreSQL or an interactive creator session. It is not a
replacement for the existing show UI and does not migrate any existing show data.

The application owns its PostgreSQL connection and only uses `SELECT 1` in this
milestone. Its Compose project publishes no database or application ports. The
PostgreSQL service is attached only to an internal network; the CLI also has an
outbound network for HTTPS requests to Clipify. No Clipify database URL, session,
JWT signing secret or provider token belongs in this application.

## Prepare the pinned SDK

From the Clipify checkout, using its installed build tools:

```sh
bun packages/sdk/prepare-awards.mjs
bun install --cwd examples/babbler-awards --frozen-lockfile
```

`vendor/clipify-sdk-0.1.0.tgz` is a generated release artifact, not a runtime source
import. Keep that artifact with this application when copying the folder into an
independent repository/build context, or replace the pinned file dependency with
the same version from an authorised package registry. The Docker build requires
only this folder and that tarball, not the Clipify source tree.

## Run

First provision a Clipify connected-application credential for the selected
creator and `search_clips`; see the milestone quickstart in the Clipify repository.
Store the returned client ID and client secret in separate owner-readable files.
Create an unrelated password file for the Awards PostgreSQL service. Do not use a
Clipify database password. Protect the containing directory and files (for example,
mode 0700 for the directory and 0400 for files); keep them outside the source tree.
The application runs as container UID 1000. File-backed Compose secrets preserve
host ownership, so make the mounted copies readable by UID 1000 (for example,
`chown 1000:1000` when provisioning as root). Do not make secrets world-readable
or run the application as root to work around file permissions.

Set the following operator environment variables to the paths of those files:

```sh
export CLIPIFY_BASE_URL=https://clipify.us
export CLIPIFY_CREATOR_ID=the-granted-numeric-creator-id
export CLIPIFY_CLIENT_ID_FILE=/absolute/private/path/client-id
export CLIPIFY_CLIENT_SECRET_FILE=/absolute/private/path/client-secret
export AWARDS_DATABASE_PASSWORD_FILE=/absolute/private/path/awards-db-password
```

Then, from this directory:

```sh
docker compose build awards
docker compose up -d awards-db
docker compose run --rm awards search --title Minecraft --limit 25
```

A successful invocation prints one JSON clip-search result to stdout, including
`complete` and `nextCursor`. An incomplete cached collection is not an all-time
ranking. A failure exits nonzero and prints only a typed error code to stderr.
Revoke the application grant in Clipify to stop subsequent searches.

The CLI always verifies its own database before contacting Clipify. Its secrets
are read from Docker-mounted files; ordinary logs do not print them. No source or
output video is downloaded in this milestone.

Production Compose requires HTTPS and does not enable insecure transport. The
separate disposable integration fixture explicitly opts into private Docker HTTP;
that setting is never needed for an externally hosted production Clipify origin.

## Verify

```sh
bun install --frozen-lockfile
bun run test
```

From the Clipify repository root, the scoped SDK/package/CLI checks are:

```sh
bun run test --runInBand --runTestsByPath test/server/connected-apps/sdk.test.ts --coverage=false
node --test packages/sdk/test/pack.test.mjs examples/babbler-awards/test/cli.test.mjs
```

The package check verifies stable archive bytes despite source timestamp/mode
changes and excludes non-release files. CLI checks keep file-backed secrets out
of failures and preserve the operator's private file permissions. Use the Node
version pinned by the Dockerfile/owning CI job.

The owning integration fixture in the Clipify repository builds this Docker image
and exercises actual machine authentication/search against disposable services.
Never point that fixture at an application or shared development database.

This folder can be released independently. Changes here do not require copying
Clipify's auth, billing, agency, Runner or database modules.
