# MCP Tool Contracts

> Consolidated MCP server scope: 66 tools on `feature/mcp-support`. The original foundation, workflow expansion, feedback and focused editing tools belong to this one feature/PR. Marketplace submission remains out of scope. Expansion task IDs are T406–T541; original IDs and blockers are preserved. Historical workflow records are in [history/workflows/README.md](../history/workflows/README.md). Workflow requirement/scenario identities use the `WF-` documentation namespace to distinguish them from the original IDs; executable Gherkin IDs and retained logs are unchanged.

## Common request and result rules

Every resource operation selects required `creatorId` from the token-bound approved set. IDs are validated against their domain schema; overlay/playlist IDs are UUIDs, creator IDs follow existing creator identity types. Strict schemas reject unknown fields. Results use allowlisted public fields; do not serialize ORM records containing overlay secrets. Paginated lists use `limit` default 25, max 100 and opaque validated cursor; stable ID ordering, empty `items` and nullable nextCursor. The current public index is [tool-index.md](tool-index.md). Legacy broad schemas are retained only for shared backend/browser services; they are not public MCP aliases.

| Tool                    | Required permission   | Input / result                                                                              |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| list_creators           | creator:read          | cursor/limit; approved currently accessible creators and safe labels                        |
| get_capabilities        | creator:read          | creatorId; effective plan, counts/limits, allowed operations and restrictions               |
| list_overlays           | overlay:read          | creatorId,cursor,limit; safe overlay summaries with revision                                |
| get_overlay             | overlay:read          | creatorId,overlayId; safe editable config plus revision                                     |
| create_overlay          | overlay:create        | creatorId,retryKey,name optional; created safe resource and revision                        |
| update_overlay_settings | overlay:update        | creatorId,overlayId,expectedRevision,patch (name/status only); settings and revision        |
| delete_overlay          | overlay:delete        | creatorId,overlayId,expectedRevision; deleted ID                                            |
| list_playlists          | playlist:read         | creatorId,cursor,limit; safe summaries/revisions                                            |
| get_playlist            | playlist:read         | creatorId,playlistId; metadata, ordered safe items and revision                             |
| create_playlist         | playlist:create       | creatorId,retryKey,name; created safe resource and revision                                 |
| update_playlist         | playlist:update       | creatorId,playlistId,expectedRevision,name; updated safe resource/revision                  |
| delete_playlist         | playlist:delete       | creatorId,playlistId,expectedRevision; deleted ID                                           |
| add_playlist_items      | playlist-items:manage | creatorId,playlistId,expectedRevision,validated clip references; new ordered items/revision |
| remove_playlist_items   | playlist-items:manage | creatorId,playlistId,expectedRevision,itemIds; new ordered items/revision                   |
| reorder_playlist_items  | playlist-items:manage | creatorId,playlistId,expectedRevision,itemIds exact permutation; new order/revision         |

All applicable limits, paid fields and item/reference validation come from shared backend services. `expectedRevision` compares configuration revision; a stale request does not automatically fetch-and-replay stale intent. Creates require bounded 1–128 character retryKey. Names trim whitespace; reject empty and >120 character values rather than silently truncating tool inputs. Bound patch arrays by existing backend configuration rules and validated JSON request limit.

## Risk annotations

Every tool declares accurate `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` based on its actual implementation. Reads are readOnly. Deletions, replacement updates, item removal and reorder are potentially destructive. Creates are additive and have an explicit retry key; do not promise unlimited replay safety past retention. Twitch clip validation reaches an external domain, so do not label such operations closed-world. Metadata does not grant authority and a caller-provided confirmed:true value grants nothing.

## Errors

Authenticate transport with 401/WWW-Authenticate and insufficient OAuth scope with 403/insufficient_scope. Tool business failures use MCP error results (`isError: true`) and a stable safe structured envelope with code, message, correlationId and optional retryAfterSeconds/usage/limit. Missing/inaccessible resource uses the same safe RESOURCE_UNAVAILABLE result. Current membership denial is ACCESS_DENIED. PLAN_LIMIT_REACHED includes owner usage/limit; FEATURE_RESTRICTED names the paid capability; INVALID_INPUT names safe field validation; CONFLICT requires fresh read; RETRY_CONFLICT rejects key/input mismatch; RATE_LIMITED supplies Retry-After; SERVICE_UNAVAILABLE never masquerades as success. Do not expose raw SQL/stack traces or private target details.

Failure outcomes are distinct and stable for clients. OAuth reconsent may solve missing scopes but cannot solve plan limits or inaccessible creator resources. Audit authenticated outcomes without private payloads. Any post-commit external notification failure must distinguish persisted mutation success from notification failure; do not return a rollback claim if the resource was committed.

---

## Consolidated workflow expansion

The following 34 tools extend the original 15 definitions above, for 49 total.

# Tools

## Remote control

- `get_overlay_runtime`
- `get_overlay_queues`
- `control_overlay`
- `enqueue_overlay_clip`
- `clear_overlay_queue`

## Find and import clips

- `search_clips`
- `resolve_clip`
- `preview_playlist_import`
- `commit_playlist_import`

## Galleries and website embeds

- `list_galleries`
- `get_gallery`
- `create_gallery`
- `update_gallery_settings`
- `delete_gallery`
- `publish_gallery`
- `get_gallery_embed`
- `get_gallery_preview`
- `get_overlay_link` (private streaming browser source)
- `get_player_embed` (public Elements/iframe)

## Creator Pages

- `get_creator_page`
- `update_creator_page`
- `publish_creator_page`

## Runner setup and streaming

- `get_runner_setup`
- `list_runners`
- `get_runner`
- `create_runner`
- `update_runner`
- `delete_runner`
- `unlink_runner`
- `list_stream_sessions`
- `get_stream_session`
- `configure_stream_session`
- `control_stream_session`
- `get_runner_snapshot`

Every input is strict and creator-bound. Mutations use current revision or expected state, retry keys for non-idempotent effects, and explicit scopes. Snapshot responses include MCP image content plus safe metadata. Private source URL retrieval is a separate credential-read tool.

## Consent permissions

The following are required by the server, alongside current creator membership and resource ownership. Scope consent never overrides a plan or Runner entitlement.

| Tool                       | Permission                 | Additional permission                     |
| -------------------------- | -------------------------- | ----------------------------------------- |
| `get_overlay_runtime`      | `overlay:read`             | —                                         |
| `get_overlay_queues`       | `overlay:read`             | —                                         |
| `control_overlay`          | `overlay:control`          | —                                         |
| `enqueue_overlay_clip`     | `overlay:control`          | —                                         |
| `clear_overlay_queue`      | `overlay:control`          | —                                         |
| `search_clips`             | `creator:read`             | —                                         |
| `resolve_clip`             | `creator:read`             | —                                         |
| `preview_playlist_import`  | `playlist:read`            | creator:read when using discovery filters |
| `commit_playlist_import`   | `playlist-items:manage`    | —                                         |
| `list_galleries`           | `gallery:read`             | —                                         |
| `get_gallery`              | `gallery:read`             | —                                         |
| `create_gallery`           | `gallery:create`           | —                                         |
| `update_gallery_settings`  | `gallery:update`           | —                                         |
| `delete_gallery`           | `gallery:delete`           | —                                         |
| `publish_gallery`          | `gallery:publish`          | gallery:update                            |
| `get_gallery_embed`        | `gallery:read`             | —                                         |
| `get_gallery_preview`      | `gallery:read`             | —                                         |
| `get_overlay_link`         | `overlay-secret:read`      | —                                         |
| `get_player_embed`         | `overlay:read`             | —                                         |
| `get_creator_page`         | `creator:read`             | —                                         |
| `update_creator_page`      | `creator:update`           | —                                         |
| `publish_creator_page`     | `creator:update`           | —                                         |
| `get_runner_setup`         | `runner:read`              | —                                         |
| `list_runners`             | `runner:read`              | —                                         |
| `get_runner`               | `runner:read`              | —                                         |
| `create_runner`            | `runner:create`            | —                                         |
| `update_runner`            | `runner:update`            | —                                         |
| `delete_runner`            | `runner:delete`            | —                                         |
| `unlink_runner`            | `runner-credential:rotate` | —                                         |
| `list_stream_sessions`     | `runner:read`              | —                                         |
| `get_stream_session`       | `runner:read`              | —                                         |
| `configure_stream_session` | `runner:update`            | runner:create when creating a session     |
| `control_stream_session`   | `runner:control`           | —                                         |
| `get_runner_snapshot`      | `runner:read`              | —                                         |

## Workflow constraints

Remote commands target one connected overlay. Supported commands are play, pause, skip, hide, show, volume (integer 0–100), mute, unmute and toggle_mute. Viewer queues belong to an overlay; moderator queues belong to the creator. Queue reads preserve arrival order across both queues. Command delivery is reported separately from observed playback; volume commands change live playback only.

Resolve clips by Twitch ID or a supported HTTPS Twitch clip URL. Resolve a title by searching and presenting candidates. Discovery accepts absolute timestamps, category name/ID, title, minimum views/duration and maximum duration, with newest/most-viewed sorting. The timezone is explicit interpretation metadata; timestamps remain absolute. Bounded incomplete searches cannot be committed as a complete import. Filtered preview requires Pro, while exact clip references remain available within the existing playlist quota. The ten-minute preview binds the actor, client, connection generation, creator, playlist, revision and exact selected IDs. Commit requires `confirmed: true` and a retry key; hosts must present the proposed selection and obtain user confirmation.

Gallery edits support curated/live sources, grid/list/carousel layout, display fields, filtering and styling. Advanced changes retain existing Pro restrictions; downgrades preserve stored values. Publication has its own explicit permission. Gallery integration uses Clipify Elements so modals can open on the host page. Public player integration supports Elements and iframe plus autoplay/muted/banner/overlay options. Streaming browser-source URLs contain credentials and require separate approval; never publish those URLs on a website.

Creator Page operations cover enabled state, discoverable/unlisted visibility, bio display and social title/description. Social preview customization requires Pro. These operations do not modify billing, organization membership, account security or broader account settings.

Runner setup accepts Windows, Linux, Linux ARM64, macOS and macOS ARM64. Official download availability is reported honestly. Device installation and normal human enrollment remain required. Configure streams with an owned runner and overlay, 24/7 or failsafe mode, 720p/1080p, 30/60 FPS and supported Twitch/YouTube destinations. Existing session edits require the latest revision; new sessions require a retry key and creation permission. Destination changes discard obsolete keys. Enter missing credentials in the dashboard; tokens and stream keys never appear in MCP results. Start/stop requests update desired state; the device reports actual state asynchronously. Snapshots return actual recently uploaded assigned JPEG data as MCP image content; missing, offline or mismatched assignment returns an explicit unavailable result.

MCP access is included with Free. Remote control requires the existing Pro capability. Runner setup, creation, configuration and streaming require the separate Runner product entitlement; read and cleanup operations remain available after expiry. Marketplace listings and public-host submissions are outside this PR.

## submit_feedback

Permission: existing creator:read. Plans: Free and paid. Input: creatorId, kind=bug|suggestion, message (trimmed 1–2000 characters), confirmed=true, retryKey (1–128 characters), no unknown fields. Result: status=queued, receiptId, duplicate, limit=5, windowSeconds=86400, limiterScope=server_process. Writes external Sentry feedback; readOnlyHint=false, destructiveHint=false, idempotentHint=true only within the RAM retention window, openWorldHint=true. User must request submission. Retry after uncertain results with the same key. No automatic transcript/replay/screenshots/email; audit omits contents. RAM quota covers verified user across clients/creators, resets on server restart and is independent on replicas. Existing general MCP rate limits still apply.

Feedback replay aliases are bounded to five key hashes per receipt. Further fresh-key aliases return RATE_LIMITED; reusing an existing accepted key still deduplicates. Messages and keys are stored only as hashes, alongside receipt IDs/timestamps, for at most 24 hours in RAM.

## Focused editing tools

The public catalogue replaces each broad overlay/gallery update with nine focused tools. get_overlay_link is a streaming-neutral replacement for get_overlay_embed. No new OAuth scopes are introduced. Focused reads return `{creatorId, overlayId|galleryId, configurationRevision, <area>: {...}}`, with capabilities for gallery reads. Updates accept `{creatorId, overlayId|galleryId, expectedRevision, patch}` and return the same area/revision envelope. Every patch is strict and nonempty; omitted fields stay unchanged and supplied arrays replace their corresponding list. All areas share one resource revision: use each successful mutation's returned revision for the next area, and reread on conflict.

| Resource | Area     | Read                 | Update                  | Fields                                                                                          |
| -------- | -------- | -------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| Overlay  | Settings | get_overlay          | update_overlay_settings | name, status                                                                                    |
| Overlay  | Source   | get_overlay_source   | update_overlay_source   | type, playlistId                                                                                |
| Overlay  | Filters  | get_overlay_filters  | update_overlay_filters  | duration and max-duration behavior, views, categories, clip creators, blocked words             |
| Overlay  | Playback | get_overlay_playback | update_overlay_playback | playbackMode, preferCurrentCategory, clipPackSize, saved playerVolume                           |
| Overlay  | Theme    | get_overlay_theme    | update_overlay_theme    | information visibility/fade-out, fonts/colors, progress bar, borders, effects, positions/scales |
| Gallery  | Settings | get_gallery          | update_gallery_settings | name                                                                                            |
| Gallery  | Source   | get_gallery_source   | update_gallery_source   | source, playlistId                                                                              |
| Gallery  | Filters  | get_gallery_filters  | update_gallery_filters  | live sort/window/dates/result limit, categories, views/duration, title and creator filters      |
| Gallery  | Layout   | get_gallery_layout   | update_gallery_layout   | layout, responsive sizes, density, navigation/indicators, visible metadata                      |
| Gallery  | Theme    | get_gallery_theme    | update_gallery_theme    | theme/colors/surfaces, radius/gap, thumbnail treatment, modal appearance                        |

Reads require overlay:read or gallery:read; updates require overlay:update or gallery:update. get_overlay_link requires overlay-secret:read and returns a private credential-bearing URL for a streaming browser source. Public website integration uses get_player_embed or get_gallery_embed. Live volume is ephemeral control_overlay state; it is not a saved playerVolume change.

## Optional MCP prompts

prompts/list and prompts/get expose style-overlay, filter-overlay, import-clips, style-gallery, streaming-link and control-live-overlay. Templates are static, English, read-only suggestions with no account data or embedded credentials. They describe capability/creator selection, revisions, preview confirmation and private-link handling. They never invoke a tool or grant permission. Hosts may expose a picker; server instructions and tool descriptions remain available where prompt UI is unsupported. The same example text appears in connected-app settings.
