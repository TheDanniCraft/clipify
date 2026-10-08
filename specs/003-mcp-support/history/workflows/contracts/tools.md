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
- `update_gallery`
- `delete_gallery`
- `publish_gallery`
- `get_gallery_embed`
- `get_gallery_preview`
- `get_overlay_embed` (private OBS source)
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
| `update_gallery`           | `gallery:update`           | —                                         |
| `delete_gallery`           | `gallery:delete`           | —                                         |
| `publish_gallery`          | `gallery:publish`          | gallery:update                            |
| `get_gallery_embed`        | `gallery:read`             | —                                         |
| `get_gallery_preview`      | `gallery:read`             | —                                         |
| `get_overlay_embed`        | `overlay-secret:read`      | —                                         |
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

Gallery edits support curated/live sources, grid/list/carousel layout, display fields, filtering and styling. Advanced changes retain existing Pro restrictions; downgrades preserve stored values. Publication has its own explicit permission. Gallery integration uses Clipify Elements so modals can open on the host page. Public player integration supports Elements and iframe plus autoplay/muted/banner/overlay options. OBS browser-source URLs contain credentials and require separate approval; never publish those URLs on a website.

Creator Page operations cover enabled state, discoverable/unlisted visibility, bio display and social title/description. Social preview customization requires Pro. These operations do not modify billing, organization membership, account security or broader account settings.

Runner setup accepts Windows, Linux, Linux ARM64, macOS and macOS ARM64. Official download availability is reported honestly. Device installation and normal human enrollment remain required. Configure streams with an owned runner and overlay, 24/7 or failsafe mode, 720p/1080p, 30/60 FPS and supported Twitch/YouTube destinations. Existing session edits require the latest revision; new sessions require a retry key and creation permission. Destination changes discard obsolete keys. Enter missing credentials in the dashboard; tokens and stream keys never appear in MCP results. Start/stop requests update desired state; the device reports actual state asynchronously. Snapshots return actual recently uploaded assigned JPEG data as MCP image content; missing, offline or mismatched assignment returns an explicit unavailable result.

MCP access is included with Free. Remote control requires the existing Pro capability. Runner setup, creation, configuration and streaming require the separate Runner product entitlement; read and cleanup operations remain available after expiry. Marketplace listings and public-host submissions are outside this PR.
