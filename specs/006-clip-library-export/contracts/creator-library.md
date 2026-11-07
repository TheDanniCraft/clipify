# Creator Library Contracts

These are planned authenticated dashboard interfaces, not public MCP capabilities. Use verified session principal and the existing creator-operation authorizer for every call. Authorize before cache/provider access. No client-provided access token, arbitrary URL or trusted owner flag.

## Routes and navigation

- `/dashboard`: Home.
- `/dashboard/streams`: available broadcasts; opaque provider cursor, page size 20.
- `/dashboard/streams/[videoId]`: verify provider broadcaster, fixed VOD scope; reuse inventory query/selection UI.
- `/dashboard/clips`: clip inventory; URL query mirrors validated InventoryQuery.
- `/dashboard/overlays`, `/dashboard/playlists`, `/dashboard/galleries`, `/dashboard/runners`: dedicated lists extracted from the existing table. Existing singular editor routes remain unchanged.
- Existing Tools, Settings, agency/admin destinations retain URLs and authorization.
- One shared shell preserves theme, upgrade, organization switch, tours, support/help/logout and unsaved-change guards. Active item follows path; submenu expansion follows selected child; mobile navigation closes its sheet and restores logical focus. Collapsed mode has named icon controls/tooltips. Ctrl/Cmd+K opens search; Escape dismisses and returns focus. Shortcut does not hijack text editing.
- Search groups permitted destinations and up to 10 matching clip titles for the active creator, debounce 200ms, minimum two characters for clips; destination filtering works immediately. Result selection navigates only. Abort stale requests; no previous-creator data flashes.

## Server actions

`getCreatorClipInventory({ creatorId, query, videoId? })` requires `creator:read`. Success: InventoryPage. Same predicates drive items/counts; stable sort tie-break ID; unknown/deleted VOD never becomes an arbitrary date filter. Validate full query and return field errors without resetting controls.

`getCreatorClipOverview({ creatorId, timezone })` requires `creator:read`. Returns creation-window boundaries, known clip count, aggregate current views, top five and recent broadcasts, plus independent clip and broadcast freshness/completeness. One failed section must not erase successful cached sections.

`getCreatorBroadcasts({ creatorId, after? })` / `getCreatorBroadcast({ creatorId, videoId })` require `creator:read`. Cursor <=2048 characters, validate and bind it to creator/query rather than trusting a foreign token. List includes only archive broadcasts. A removed VOD returns unavailable; clips remain in inventory. Do not infer original broadcast end or 24-hour eligibility from VOD duration for future automation.

`searchCreatorLibrary({ creatorId, title })` requires `creator:read` and returns only publicClip fields required for suggestions, plus freshness. Permission-filter destinations locally using server-derived permissions, and reauthorize every target route.

Expected action errors are discriminated `{ ok:false, code, fieldErrors?, retryAt? }`: `AUTHENTICATION_REQUIRED`, `PERMISSION_DENIED`, `ACCESS_PATH_REQUIRED`, `ACCOUNT_SUSPENDED`, `INVALID_INPUT`, `NOT_FOUND`, `SERVICE_UNAVAILABLE`, plus existing entitlement-denial codes. Preserve established result conventions. Expected denials do not go to Sentry.

## POST `/api/clips/export`

Node runtime. Same-origin authenticated JSON request `{ creatorId: string, clipIds: string[] }`; reject cross-origin requests and validate request size before parsing (64KiB maximum). Require `clips:export` and `creator:read`; preserve authorizer's current team/agency entitlement checks. IDs 1..50 unique after dedupe; reject >50 distinct, empty, malformed or foreign IDs before any media call. Revalidate every clip belongs to the creator. If one ID is foreign, fail the entire request rather than package a subset.

Success 200: `application/zip`, `Content-Disposition: attachment` with sanitized ASCII archive name plus UTF-8 filename when needed, `Cache-Control: private, no-store`, `X-Clipify-Export-Result: <base64url JSON summary>`. Same-origin UI decodes summary, reports included/skipped counts and actionable retry. The summary identifies zero-based positions in the deduplicated first-occurrence request order, never full clip IDs; failed entries may include a readable title bounded to 80 UTF-8 bytes, with an ordinal fallback. The UI maps indices back through its frozen submitted selection. Unknown/duplicate/out-of-range result indices are rejected as an invalid response. This keeps the summary below16KiB even for maximum-length allowed IDs. Use safe browser Blob creation/revocation; ignore stale context responses. No durable export or shared cache.

ZIP files: `<safe-title-up-to-80-chars>--<clip-id>.mp4`, with ID sanitized independently and collision resolution deterministic. `manifest.json` maps every requested ID to public metadata, actual variant and included filename/byte count or skipped reason. Strip separators, traversal, controls and platform-reserved names; normalize Unicode and test long/colliding titles. ZIP entry paths cannot escape root. No signed URLs, credentials, user-account export contents or unrelated metadata.

Caps: 50 clips, 32MiB each, 128MiB aggregate media, 1MiB manifest, 130MiB final/client response. Enforce actual body bytes, including absent/misleading Content-Length, and at most two media fetches. Input selection order decides inclusion. Deadline: 30 seconds per file, 120 seconds overall. Abort/disconnect cancels outstanding work and releases memory. MP4 completeness/content is checked before entry inclusion; an HTML error with status 200 is not a video.

Partial: still 200 ZIP if at least one complete clip succeeds; summary and manifest explicitly identify failures. Skip codes: `clip_unavailable`, `download_unavailable`, `file_size_limit`, `package_size_limit`, `invalid_media`, `provider_error`, `download_timeout`, `rate_limited`, `reconnect_required`. A partial result may carry a global retryAt and Retry-After for throttled remaining items. Retry only provider_error/download_timeout/rate_limited when its reset permits after appropriate backoff; unavailable requires explicit refresh/new selection, size requires a smaller package, invalid media requires support/retry after provider recovery. Rate-limit or authorization errors before preparation produce JSON; if encountered after successful items, finish a partial package and identify affected remaining items.

JSON failures: 400 INVALID_INPUT; 401 AUTHENTICATION_REQUIRED; 403 PERMISSION_DENIED / ACCOUNT_SUSPENDED / RECONNECT_REQUIRED (distinguish provider reconnect locally); 409 EXPORT_UNAVAILABLE when every clip is unavailable; 413 EXPORT_LIMIT; 429 RATE_LIMITED with Retry-After/retryAt; 502 PROVIDER_UNAVAILABLE; 504 EXPORT_TIMEOUT. Body `{ ok:false, code, retryAt?, failures? }`, no raw upstream body. No successful ZIP if all items fail. Map existing authorization denial codes without broadening access.

A final current-grant check is required before response emission. A revoked Clipify grant discovered during preparation aborts the entire result and sends no ZIP, even if some media was already buffered. A missing Twitch download scope offers the existing linked-account reconnect flow and preserves selection. Do not borrow playback GraphQL fallback or request additional consent silently.

## Reference interaction details

Pinned Payload Bay PR#13 details are in research.md. Expanded desktop sidebar256px, collapsed rail48px, drawer at<=768px; preserve Clipify resource gutters rather than widening editors. Main document scrolls, drawer uses visual viewport with its own scroll. Context groups start open, active location remains highlighted, opaque brand/account header stays coordinated with notices. Search lives inside the sidebar with a muted label and HeroUI keyboard hint. Mobile opens navigation to reach its launcher; the keyboard shortcut can open search directly. Drawer must finish closing before palette opens. Ctrl/Cmd+K search and Ctrl/Cmd+B sidebar shortcuts respect editable fields. Resource-context Back changes scope only when explicitly browsing a submenu; normal page links navigate with existing dirty-form protection. Breadcrumbs expose existing ancestors. No foreign tenancy hierarchy, placeholder destinations or new editor modes.

## Authenticated preview and provider batching

`getCreatorClipPreview({creatorId, clipId})` requires current `creator:read` and verified clip broadcaster ownership, through the shared resolver's explicit inventory context. Authorization occurs before shared URL-cache hits. Return the existing preview result shape with a temporary playback URL only to that authorized caller; do not put it in inventory metadata, exports or logs. Public-page enablement is irrelevant to authorized private preview. Legacy overlay/gallery/demo/public creator contexts keep their authority and rate-limit behavior.

The official download URL endpoint accepts up to10 requested IDs; batch requests accordingly, match every returned ID exactly and fetch at most two media bodies concurrently. Trusted media hosts are exact production.assets.clips.twitchcdn.net and the verified legacy Twitch CDN d1ndex63qxojbr.cloudfront.net over HTTPS, with three validated redirects maximum. No general cloudfront/wildcard allowlist. Broadcast cache uses the existing User enum value and namespaced keys; five-minute freshness is distinct from24-hour expiresAt retention. No schema/enum migration is needed.

An inventory database/cache read failure returns SERVICE_UNAVAILABLE, never a successful empty InventoryPage. Existing helpers that intentionally swallow errors are not authoritative evidence of an empty account; preserve their legacy callers and use a strict result/error-aware path for these new actions.

Reconnect recovery opens the existing `/dashboard/settings` linked-account flow in a separate tab through a user-activated, clearly named link. The original inventory tab keeps its selection and offers an explicit Retry after reconnect; it does not automatically submit or navigate away. This avoids introducing persistent draft storage solely for OAuth recovery. The provider scope is rechecked on Retry. Handle blocked/new-tab initiation locally rather than discard the selection.

After reconnect, an explicit recovery Retry uses only the unsuccessful reconnect-required IDs from the frozen result, rechecking scope first; previously included IDs are never automatically submitted again. Generic Retry failed continues to exclude currently nonretryable scope/size/unavailable failures. Test throttling and provider-auth loss both before any success and after some clips have completed.

## Individual clip details and downloads

`getCreatorClipDetail({ creatorId, clipId })` validates bounded identifiers, authorizes creator read access before cache lookup, and returns normalized owned clip metadata, optional category name and freshness. Missing/tombstoned/mismatched records return `NOT_FOUND`; foreign access returns its typed authorization denial. Tokens, signed media URLs and internal cache fields are excluded.

`POST /api/clips/export?format=mp4` accepts the same JSON request and same-origin requirement as ZIP, with exactly one clip ID. Success returns `video/mp4`, a safe attachment filename, private/no-store caching and the existing bounded result header. Typed errors and Retry-After retain the ZIP contract. Both formats reserve from the same persistent creator-account manual job budget; every official download-URL request also reserves from the shared Twitch request budget before its maximum-ten-ID batch.

`GET /api/dashboard/presence` returns `{ live: boolean | null }` for the signed-in identity's own channel, independent of delegated account context. Its response is private/no-store. It is a plain fetch, so presence reads cannot trigger a server-action RSC rerender that discards an expired-session inventory selection.

Home overview adds allTimeTopClips: up to five public clip records ranked by current lifetime views across the known authorized library. Existing count/views/topClips remain scoped to the local30-day creation window. The new Creator Page tile calls the existing getCreatorAnalytics(ownerId, range) action with date-only range transport; its existing Pro/analytics:read authorization and aggregate cache remain authoritative.

## Destination preset clarification 2026-11-07

The existing browser export preset `{id:"discord"}` remains valid and uses the Free allowance. It may include `tier:"free"|"basic"|"nitro"`; unknown tiers are rejected. Custom byte targets retain the existing `{id:"custom",maxSizeMB}` 1–32 MB contract. No server rendering path is added. Raw General Original recipes omit encoding and therefore do not require browser encoder support. UI stages do not change ownership, quotas, authoritative templates, per-file metadata or cancellation contracts.
