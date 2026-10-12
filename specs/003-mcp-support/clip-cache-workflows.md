# Cached clip discovery and crawler workflows

The dashboard and overlay player use Clipify's persisted crawler collection. MCP discovery must use that same collection instead of independently paging Twitch's clip API. This avoids repeating provider traffic and the five-page discovery limit, and preserves access to clips collected through the crawler's historical windows.

## Authorized scope

- `search_clips` and filter-based `preview_playlist_import` filter and sort the entire stored creator collection. Search does not start synchronization or make Twitch requests.
- Clip resolution and playlist additions reuse validated entries in the creator cache. Explicit clip IDs absent from the cache can still be validated through Twitch; this does not start a paginated discovery scan.
- Category IDs match exactly. Category names resolve from cached metadata for the collection's game IDs. Missing metadata must not be represented as a complete empty result.
- Pagination supports collections exceeding 500 and 1,000 clips. Signed cursors remain tied to the creator, authorization generation and filters; a collection fingerprint rejects changed collections with `CONFLICT` so the agent can restart without silently skipping or duplicating clips.
- `complete` describes historical crawler completeness, rather than claiming that an exhausted page proves all Twitch clips have been collected. Incomplete filtered imports do not issue commit tokens.
- `get_clip_crawler_status` uses `creator:read` and returns cached clip count, existing backfill progress, synchronization timestamps, rate-limit deadline and refresh cooldown. It does not imply an actively running worker when that cannot be established.
- `refresh_clips` uses `creator:update` and requests the existing background crawler. Accepted background work runs outside the finished MCP request's cancellation scope using the existing database lifecycle helper. Queue acceptance and cooldown persistence commit atomically before acceptance. Dashboard and MCP share a PostgreSQL advisory lock and the same persisted cooldown. Refresh preserves historical checkpoints and cached clips. A busy creator receives a queued priority recent scan; bounded continuations retain priority without restarting their cursor. MCP queue writes join the existing authorization transaction, and workers wake only after commit. Acceptance is not completion.
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

## Fair crawler amendment — 2026-10-12

- PostgreSQL owns one recent job and one historical job per creator. The table, constraints, foreign key and indexes are defined in src/db/schema.ts; the master Generate Migrations workflow owns migration generation.
- Each application process uses up to four workers and claims at most 50 jobs per scheduler batch. It stops taking new jobs after one minute and drains the current jobs before ending the batch. CLIP_CRAWL_BATCH_SIZE can lower this or increase it up to 200; CLIP_CRAWL_CONCURRENCY can lower concurrency. Each queued job has five provider requests by default, adjustable with CLIP_CRAWL_REQUEST_BUDGET up to 50.
- Workers claim one job only when free using FOR UPDATE SKIP LOCKED. Two-minute leases renew every 30 seconds. Expired leases can be reclaimed, and completion/retry/renewal writes require the current unexpired lease. The existing per-creator advisory lock also prevents recent/history and foreground cache scans from crawling the same creator concurrently.
- Manual-priority and ordinary oldest-due claims alternate, so refresh demand does not monopolize worker capacity. Newly eligible creators are seeded incrementally by excluding creators already in the queue, rather than selecting the same most-recently-used owners forever.
- Recently created/used active overlays get minute-scale recent scans; idle creators get 15-minute recent scans. Incomplete history continues in bounded chunks, every minute for active creators or every five minutes for idle creators. Completed historical jobs pause. Registered-user count alone does not determine Twitch request demand; no million-user throughput claim is made without load measurements.
- Queued recent scans persist fixed date bounds, cursor and page count between jobs. Dense date windows subdivide when the provider's 1,000-result boundary is reached. Historical page counts persist too; old cursors without page counts restart only their current window. Queued historical jobs never mark a capped minimum window complete.
- Queued cache writes and checkpoints reject storage failures rather than advancing past missing data. Provider timeouts, rate limits, missing credentials and busy owner locks reschedule jobs. Crashes leave recoverable leases. Worker capacity is shared by scheduled batches and immediate manual wakeups.
- MCP status reports each job's queued/running/scheduled/complete state, scheduling/completion timestamps and failure count without exposing lease tokens or provider credentials. Existing clip discovery remains cache-only.

The release must include the migration generated on master and successful final-head CI before publishing v4.1.5. No production schema push is permitted.

### Focused verification

Seven affected suites passed (141 tests across the final focused runs): recent/history continuations, busy-owner priority acceptance, authorization-transaction rollback, database claims and lease recovery, scheduler lifecycle and existing Twitch regressions. Lint, type checking and whitespace checks passed. The disposable 200,000-job query-plan probe used both due and manual-priority indexes; measured claim times were approximately 0.22 ms and 0.11 ms locally. These timings are not a production capacity estimate.

Full pre-push tests, combined-head PR CI, master migration generation and final master CI remain release gates. No live production crawl or schema change is claimed by the local results.
