# Cached clip discovery and crawler workflows

The dashboard and overlay player use Clipify's persisted crawler collection. MCP discovery must use that same collection instead of independently paging Twitch's clip API. This avoids repeating provider traffic and the five-page discovery limit, and preserves access to clips collected through the crawler's historical windows.

## Authorized scope

- `search_clips` and filter-based `preview_playlist_import` filter and sort the entire stored creator collection. Search does not start synchronization or make Twitch requests.
- Clip resolution and playlist additions reuse validated entries in the creator cache. Explicit clip IDs absent from the cache can still be validated through Twitch; this does not start a paginated discovery scan.
- Category IDs match exactly. Category names resolve from cached metadata for the collection's game IDs. Missing metadata must not be represented as a complete empty result.
- Pagination supports collections exceeding 500 and 1,000 clips. Signed cursors remain tied to the creator, authorization generation and filters; a collection fingerprint rejects changed collections with `CONFLICT` so the agent can restart without silently skipping or duplicating clips.
- `complete` describes historical crawler completeness, rather than claiming that an exhausted page proves all Twitch clips have been collected. Incomplete filtered imports do not issue commit tokens.
- `get_clip_crawler_status` uses `creator:read` and returns cached clip count, existing backfill progress, synchronization timestamps, rate-limit deadline and refresh cooldown. It does not imply an actively running worker when that cannot be established.
- `refresh_clips` uses `creator:update` and requests the existing background crawler. Accepted background work runs outside the finished MCP request's cancellation scope using the existing database lifecycle helper. Reset and cooldown persistence commit atomically before acceptance. Dashboard and MCP share a PostgreSQL advisory lock and the same persisted cooldown. Refresh resets crawler state while retaining stored clips for playback. An active crawler returns `in_progress` without resetting its state. Acceptance is not completion.
- Existing creator-page tools control Twitch bio visibility, publication and social preview settings. Clipify does not currently have an independent editable creator bio.
- Email, credentials, MFA and other account security settings remain outside MCP. This change does not implement a demo data source or change ownership boundaries.

## Verification

Focused tests cover a 1,200-clip collection without network requests, actual MCP pagination across the full collection, invalid foreign cached data, incomplete backfills, category resolution, new tool schemas and permissions, unapproved creator access, refresh cooldown and existing dashboard refresh behavior. Existing playlist import confirmation, plan limits and revision checks remain required.

## Local verification results — 2026-10-11

- Focused final run: 12 suites / 109 tests passed, including database-backed MCP calls and official SDK discovery. The refresh test uses a controlled Twitch adapter, waits for the independent background crawl, verifies its synchronization timestamp, and confirms existing clips remain stored.
- Dashboard/external Twitch regression run: 4 suites / 143 tests passed before the final background lifecycle refinement; the affected synchronization suite is included in the final 109-test run.
- `bun run app:typecheck`: passed.
- ESLint on changed runtime modules and focused tests: passed without warnings.
- Formatting and `git diff --check`: passed.

Implementation is on `fix/mcp-clip-cache`, based on current master. No live-host acceptance, push, CI run, deployment or production data change is claimed by this local checkpoint.
