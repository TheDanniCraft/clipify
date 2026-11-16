# Clipify SDK

A server-side client for explicitly provisioned Clipify connected applications.
It has no runtime dependencies and imports no Clipify database or application code.
Only cached clip search is supported in this milestone.

```ts
import { createClipifyClient } from "@clipify/sdk";
const clipify = createClipifyClient({ baseUrl, clientId, clientSecret });
const clips = await clipify.clips.search({ creatorId, filters: { title: "Minecraft" } });
```

Supply credentials only in your backend. Never ship them to a browser or print
configuration objects. The client obtains a short-lived machine token, uses the
creator-scoped operation gateway, preserves typed failures, and bounds each search
(including token exchange) to ten seconds by default. It does not retry a denied
operation. After a 401, the next call obtains a new token.

`allowInsecureHttp: true` is only for an explicitly trusted private Docker/loopback
test network. Production URLs require HTTPS. Responses are bounded to 4 MiB.

Build and package from the repository root:

```sh
bun packages/sdk/prepare-awards.mjs
bun install --cwd examples/babbler-awards --frozen-lockfile
```

Consumers install a pinned package tarball or registry release. Application code
uses `@clipify/sdk`, never source-file paths into the Clipify repository.

## Resolve and play a clip

Applications must be granted `resolve_clip` and `get_clip_playback` separately
from search. Every request stays restricted to its granted creator.

```ts
const { clip } = await client.clips.resolve({ creatorId, reference: clipUrl });
const { playbackUrl } = await client.clips.playback({ creatorId, clipId: clip.id });
```

Playback URLs expire. A public application must authorize access to its own event
or resource before requesting playback, then proxy the media through its backend.
Keep SDK credentials server-side. Application credentials do not sign people in;
use a separately registered authorization-code/PKCE identity client for login.
