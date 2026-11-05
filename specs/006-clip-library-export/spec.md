# Feature Specification: Creator Dashboard, Clip Inventory and Bulk Export

**Feature Branch**: `features/clip-export`, based on clean master `b6c8e591`.
**Created**: 2026-11-03
**Status**: Specified for implementation preparation; product defaults recorded below
**Input**: Creator-focused sidebar dashboard, recent streams and clip performance, searchable clip inventory, manual bulk video export; automated publishing explicitly later.

## User Scenarios & Testing

### User Story 1 - Find creator tools in a sidebar (Priority: P1)

Creators navigate through Home, Streams, Clip Inventory, Overlays, Playlists, Galleries, Runner, Tools and Settings without treating an overlay table as the whole dashboard. An integrated search opens permitted destinations and searches clips in the active creator context.

**Why this priority**: Gives each existing and new workflow a stable destination.
**Independent Test**: Navigate every permitted destination, search with keyboard, and open an existing bookmarked editor.
**BDD**: Required. **ATDD**: Required. Browser scenarios own both roles because the actual navigation outcome is also the acceptance boundary.

**Acceptance Scenarios**:

1. **US1-AC1**: Given an authenticated creator, when opening Dashboard, then Home is selected and the sidebar exposes permitted destinations.
2. **US1-AC2**: Given an existing editor bookmark, when opening it, then its URL, resource, save behavior and contextual actions remain usable.
3. **US1-AC3**: Given a narrow viewport or collapsed sidebar, when using navigation and search by keyboard, then focus, accessible names and selected location remain clear.
4. **US1-AC4**: Given account switching, when changing creator context, then previous search results, selections and export feedback are cleared before new data appears.

### User Story 2 - Understand recent streams and clip performance (Priority: P2)

Home shows recent available Twitch broadcasts, the count of known clips created in the last 30 days, their summed current views, and the five highest-viewed clips from that creation window. When that window has no clips, show one actionable empty state linking to inventory rather than zero-valued stat cards and an empty ranking. Streams shows available broadcasts and opens a stream's clips and aggregate clip views.

**Why this priority**: Restores a clip-focused landing page while avoiding unsupported historical analytics claims.
**Independent Test**: Use known streams and clips to verify totals, ordering, zero-clip streams and stream detail membership.
**BDD**: Required. **ATDD**: Required; shared browser evidence.

**Acceptance Scenarios**:

1. **US2-AC1**: Given clips both inside and outside the selected creation window, when viewing Home, then only the inside clips affect totals and rankings, with freshness and incomplete-sync information.
2. **US2-AC2**: Given an available past broadcast, when opening its row, then only clips with the matching VOD identifier appear; clip creation time alone does not assign a stream.
3. **US2-AC3**: Given no broadcasts, unavailable VOD metadata, an incomplete cache or a provider failure, when opening the page, then distinct empty, partial or retry states appear and cached clips remain accessible where authorized.

### User Story 3 - Browse and select the clip inventory (Priority: P1)

Creators search their own known Twitch clips, filter by creation date, category, minimum views and duration, sort by newest or most viewed, preview clips, and select a bounded set for export. The same inventory controls work on stream detail with a fixed stream scope.

**Why this priority**: Independently useful discovery and selection is the foundation for export.
**Independent Test**: Filter a seeded inventory, traverse pages, select clips and verify the selected identities.
**BDD**: Required. **ATDD**: Required; shared browser evidence.

**Acceptance Scenarios**:

1. **US3-AC1**: Given clips with different titles, categories, dates, views and durations, when applying filters, then results and counts use the same predicates and deterministic ordering.
2. **US3-AC2**: Given multiple result pages, when selecting rows and changing pages, then selected IDs remain explicit; Select page never silently selects unseen results.
3. **US3-AC3**: Given changed filters or stream scope, when applying that change, then selection is cleared with local feedback; retrying an unchanged failed request preserves valid selections.
4. **US3-AC4**: Given a clip without a VOD or thumbnail, when browsing or previewing it, then available metadata and links remain usable without invented imagery or stream attribution.

### User Story 4 - Download a manual clip package (Priority: P1)

Creators export selected clips into a ZIP of original provider MP4 files and a metadata/results manifest. Export reports skipped clips, preserves selection after failures, and supports retrying failed IDs without redownloading successful ones.

**Why this priority**: Delivers the requested first export capability without automation infrastructure.
**Independent Test**: Export known video fixtures, inspect ZIP contents and manifest, then force a missing clip and retry.
**BDD**: Required. **ATDD**: Required; shared browser evidence.

**Acceptance Scenarios**:

1. **US4-AC1**: Given permitted selected clips and Twitch download authorization, when exporting, then a single ZIP contains distinct playable MP4 entries and a manifest identifying every requested clip.
2. **US4-AC2**: Given missing scope, stale authorization, a deleted clip or throttling, when exporting, then local actionable feedback distinguishes reconnect, retry later and unavailable content.
3. **US4-AC3**: Given mixed available and unavailable clips, when exporting, then only complete media files enter the archive, skipped items have reasons, and the UI says partial rather than complete success.
4. **US4-AC4**: Given cancellation, a connection failure, or all items failing, when the export ends, then no successful archive is claimed and the user can retry without rebuilding the selection.

### Edge Cases

- **EC-001**: Expired session, foreign creator/clip IDs, revoked team/agency access, suspended account, or creator switching during a request must not leak data or bytes.
- **EC-002**: Empty/incomplete cache, no streams, zero clips, stale metrics and provider outage must remain distinguishable.
- **EC-003**: Empty VOD IDs, expired/deleted VODs and clips made later from a VOD must not be assigned by clip creation date.
- **EC-004**: Invalid filters, reversed ranges, DST and local date boundaries must produce consistent results and actionable validation.
- **EC-005**: Duplicate IDs, select-page across pagination, changed filters and stale inventory responses must not silently change export membership.
- **EC-006**: Missing Twitch scope, revoked provider access, 429 and provider 5xx must preserve selection and indicate recovery.
- **EC-007**: Empty selection, over-limit count/bytes, oversized individual files, unknown content lengths and timeout must enforce published limits while bytes arrive.
- **EC-008**: Untrusted download hosts or redirects, non-MP4/error bodies and unsafe/colliding filenames must not enter the archive or expose credentials.
- **EC-009**: One/many/all failed clips, cancellation, browser save failure and request disconnect must not imply complete success; retry excludes known successes.
- **EC-010**: Existing bookmarks, user-tour anchors, upgrade flows, agency/admin contexts and unsaved editor guards must survive navigation changes.

## Requirements

### Functional Requirements

- **FR-001**: Provide responsive collapsible sidebar navigation, default-open contextual groups, ancestor breadcrumbs and independent search using the pinned Payload Bay PR #13 interaction reference in research.md; preserve existing theme, account, help, upgrade, admin and agency behavior.
- **FR-002**: Preserve all existing editor URLs and resource operations; move the current dashboard resource table to an Overlays destination and provide direct permitted destinations for its resource types.
- **FR-003**: Search permitted destinations and cached clip titles in the active creator, with loading, empty, error/retry and keyboard/focus behavior. Search never executes mutations.
- **FR-004**: Home MUST show recent streams, known clip count, current aggregate clip views and top five clips for clips created in the last 30 local calendar days; label the measurement and freshness honestly. For a zero-clip window, show the actionable inventory empty state instead of redundant zero-valued cards.
- **FR-005**: Streams MUST show available Twitch archive broadcasts newest first, including zero-clip broadcasts, and open scoped clip details with count and summed current clip views.
- **FR-006**: Match clips to streams by provider VOD ID only; retain unassigned clips in the inventory, and never present available VODs as a complete permanent stream history.
- **FR-007**: Inventory MUST expose title, provider thumbnail when present, category, created date, duration, current views, stream association when known, and preview/provider link.
- **FR-008**: Support title substring, category, date range, minimum views and duration bounds; newest/most-viewed sorting with ID tie-break, pagination and URL-restorable filters. Default page size 25, maximum 50.
- **FR-009**: Select individual clips or the visible page across pagination, show selected count, clear on filter/creator/stream changes, and cap selection at 50 unique clips. No implicit all-history selection.
- **FR-010**: Export original provider MP4 content in one ZIP with stable unique filenames and a manifest containing selected IDs, public metadata, included/skipped status and reasons. Prefer landscape; use portrait only when landscape is unavailable, recording the actual variant. No transcoding.
- **FR-011**: Limit one export to 50 clips, 32 MiB per media file and 128 MiB total media bytes; expose limits before export, reject invalid requests before provider calls, and enforce caps on actual bytes. Larger selections must be split manually.
- **FR-012**: Recover locally from authorization, unavailable clips, throttling, timeout, partial failures, cancellation and save errors; retain valid selection and offer Retry failed for retryable unsuccessful IDs.
- **FR-013**: Authorize every read/export at the server for the active creator; recheck membership and clip ownership before media fetch and current authority before emitting the finished archive; reject foreign IDs as a whole request. Export requires explicit clip-export permission and valid Twitch download authorization.
- **FR-014**: Fetch only trusted provider media endpoints, validate every redirect, omit API credentials on media requests, bound time and memory, sanitize filenames and never expose signed source URLs/tokens in logs or manifests.
- **FR-015**: Every new surface MUST provide accessible keyboard/focus behavior, local loading/empty/error/retry states, localized dates and usable 390px mobile and 1440px desktop layouts in light/dark themes.
- **FR-016**: Reuse existing crawler refresh rules and display its completion/freshness; opening a page must not trigger a full historical crawl or imply live view accuracy.

### Key Entities

- **Creator context**: authorized creator identity, organization/access path and effective permissions.
- **Known clip**: provider ID, broadcaster, title, category, creation instant, current views, duration, thumbnail, optional VOD ID/offset and refresh information.
- **Available broadcast**: provider VOD ID, optional stream ID, title, broadcast start, duration and availability; distinct from a Clipify Runner session.
- **Inventory query/selection**: validated filters, stable order/page and explicit unique clip IDs bound to one creator.
- **Export result**: requested IDs, successful media entries, skipped entries/reasons, actual byte counts and metadata capture time; temporary and request-local.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every permitted top-level tool is reachable from the sidebar; search is keyboard-operable and existing editor bookmarks still open the same resources.
- **SC-002**: Seeded Home and stream-detail counts, totals and rankings exactly match the declared creation-window/VOD rules, including zero and partial-data fixtures.
- **SC-003**: Every filter, both sorts and page selection produce the expected clip identities without duplicate or cross-creator exports.
- **SC-004**: For 1, 25 and 50 eligible fixture clips within byte limits, one ZIP contains exactly the selected complete media files and accurate manifest results; mixed failures remain recoverable.
- **SC-005**: Denied identities receive zero clip metadata/media bytes; all declared limits, error and cancellation cases have passing acceptance evidence.
- **SC-006**: First-run, success, failure recovery and keyboard journeys pass with actual installed components at mobile/desktop sizes in both themes. Warm-cache fixture reads of 10,000 clips display a 25-row page within 2 seconds on CI-class hardware, excluding simulated provider refresh.

## Assumptions

- Manual export is available on Free and Pro, subject to identical safety caps; this is the documented v1 default, not a new approval prerequisite. Automation monetization is later.
- V1 stream history means provider-available past archive broadcasts and known clip associations, not recovery of every historical/live broadcast. This is the documented v1 scope.
- Last 30 days means today and the previous 29 calendar days in saved timezone, falling back to browser timezone, with exclusive next-day end; custom date ranges use the same convention.
- Inventory reflects the current crawler's known clips; no unbounded live scan or historical view-delta analytics is promised.
- Native browser save is initiated after bounded package preparation; the UI reports package readiness/download initiation, not proof that the user saved to disk.
- The sidebar reference is payloadbay/payloadbay#13 pinned in research.md; reproduce its navigation/search interactions with Clipify tokens and installed components, preserving existing editor widths.
- No dashboard-wide content redesign beyond the shell, Home and the necessary dedicated resource destinations.

## Release Boundary and Later Work

V1 includes sidebar/search, clip-focused Home, available Streams/detail, inventory/preview/selection, manual ZIP export and required regression/acceptance evidence. Implement in small dependency-ordered slices, not one UI rewrite.

Later, separately specified: permanent broadcast lifecycle tracking, historical view snapshots, after-stream 24-hour threshold rules, every-new-clip events, Discord bot/posts/reactions, YouTube/TikTok publishing, credentials/consent for destinations, queues/deduplication/retries and Pro automation entitlements. No placeholder automation pages, integrations, scheduler scaffolding or new publishing promises in v1.

## Test Classification Matrix

All four stories require TDD, BDD and ATDD. Browser-owned scenarios supply both BDD and ATDD where the same observable outcome proves acceptance. No practice is N/A for a user story. Implementation-level inventory, source map and individual scenario/example rows are maintained in [test-traceability.md](test-traceability.md); scenario definitions are in [scenarios/](scenarios/). The atomic outside-in plan is [tdd/test-list.md](tdd/test-list.md). These are canonical planning inputs, not executed tests. Bindings are mandatory before each production slice.

## Acceptance Criterion Identifiers

Each existing numbered acceptance scenario has a stable anchor `US<n>-AC<m>` in its listed order (US1:1–4, US2:1–3, US3:1–4, US4:1–4;15 total). These anchors do not replace US/FR/SC/EC IDs. The outer TDD loop maps one A behavior to each anchor.

### Follow-up acceptance: navigation and clip downloads

- Settings categories and Clip Player/Clip Gallery use the existing sidebar, with URL/back navigation and unsaved section drafts preserved. Leaving an edited resource still requires its existing unsaved-change confirmation.
- Search uses neutral text, the visible label Search and a platform-appropriate HeroUI keyboard hint. Desktop uses a sidebar collapse affordance; mobile uses its menu affordance.
- An owned inventory/search clip opens an authorized detail route containing preview, metadata and MP4 download. Foreign or unavailable cache entries expose no metadata.
- ZIP, individual MP4 and official playback download-URL calls share persistent account budgets. Existing trust, permission, timeout and byte limits remain enforced.
- Operational errors use toast feedback; export per-clip details use a bounded, scrollable dialog without moving the underlying inventory. Filter validation stays inline. Report feedback must not shift the dashboard horizontally.
- The signed-in avatar is green; only confirmed own-channel Twitch live data makes it red. Delegated account context must not change whose presence is displayed.

## Approved extension: C dashboard and manual portrait exports (2026-11-05)

The creator keeps the approved sidebar and uses aligned Home summary cards, a stream table and a dense25/50-row clip inventory with compact numbered pagination. Stream detail provides a chronological selection of owned moments; it does not claim to import, synchronize or publish Twitch Stream Recaps.

- C-01: A creator can paginate a populated inventory and open clip details from its thumbnail, title or details action. Missing cached category names resolve from Twitch when possible; artwork accompanies names when available. Unavailable metadata never fabricates a category.
- C-02: Home keeps clip metrics and latest stream independent during loading/failure. Top clips occupy a full-width list. Existing onboarding links remain available.
- V-01: From one clip or a selected batch, the creator opens a portrait workspace, adjusts gameplay/camera source crops using pointer or keyboard controls, switches Full/Stacked and adjusts the camera share between20% and50%. Full mode always edits the visible gameplay crop.
- V-02: Optional channel, title and clipper layers use each clip's own metadata, with bounded positions/sizes and consistent preview/render text wrapping.
- V-03: An authorized creator saves one reusable channel layout and can reload it across sessions. Failed or overlapping saves preserve newer edits. Unsaved navigation requires a decision. Exports cannot start while a saved layout is still loading.
- V-04: Manual exports produce a portrait MP4 for one clip or a ZIP for a batch. Original downloads remain unchanged. The same creator permissions, provider request budgets, job budgets, ownership validation and byte limits apply. A landscape source is required for custom crops.
- V-05: Rendering uses bounded local files, process concurrency, threads, runtime and output size, with temporary-file cleanup after success/failure/cancellation. Operational failures use existing export dialogs/toasts and retain the layout.
- V-06: Installed HeroUI controls work in390px/1440px light/dark browsers. A real downloaded video has720×1280 dimensions and preserves source audio.

No automatic social publishing, Twitch Recap publishing, pricing change, watermark policy, custom logo uploads or general-purpose timeline editor is included in this extension.
