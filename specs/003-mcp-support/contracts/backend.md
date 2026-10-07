# Shared Backend Contract

## Verified principal

Discriminated session/OAuth identity carries trusted authUserId, authenticatedAt, validated organization/access-path context and, for OAuth, clientId, grantId/generation and scopes/creator set. Browser session adapter and token adapter both call the same authorization evaluator. Authorization accepts explicit transaction clients where consistency requires them; no implicit next/headers inside shared services. Target identifiers are selectors, never credentials.

## Mutation linearization

Lock order: grant (OAuth only) → creator account → playlist → overlays ordered by ID. Resource mutations and revocation use grant locking to deny calls that begin after completed revocation. Creator quota locks serialize count/insert across all callers. Parent playlist locks serialize item quota/order changes. Permission/entitlement reads take place at the defined mutation authorization point inside the resource transaction; related entitlement/reconciliation writers participate in creator locking. Check expiry using transaction-operation time, not stale connection claims.

Atomic operations commit resource change, revision, create retry outcome and required success audit. Rollback exposes no committed success or partial resource state. Independent creators do not share a global application lock. Asynchronously applied policy changes become authoritative when their creator transaction commits; reads display the currently committed effective plan.

## Browser adaptation

Keep action signatures/return shapes where practical, adding required expected revision for edits and structured conflict feedback. Update all affected browser callers and pending autosave snapshots. Do not catch failures and return an indistinguishable null/false result to MCP. Policy evaluator is backend-owned; browser UI can show limits but cannot grant exemptions. All supported copy/import/creation paths must route through quota enforcement, including gallery interactions with shared playlists.

## Existing effects

Preserve pause/disconnect and Twitch reward subscription behavior. Move effects requiring remote I/O after transaction commit through the existing outbox where available or a durable retryable job adapter. Do not call external services while holding quota/grant locks. Failure before resource commit returns failure; failure of a post-commit effect is recorded accurately and retried without re-creating the resource. Advance configuration revision for direct and indirect config writes, while lastUsedAt does not invalidate user edits.

## CI database and rollout

PostgreSQL race scenarios run in the existing browser-tests job after guarded db:push:e2e on loopback clipify_e2e. No local invocation bypasses that guard. Code rollout must wait for post-merge generated migration deployment before enabling MCP and revision-required browser calls against persistent databases; use a feature flag to keep MCP unavailable until schema-ready. Browser revision changes and schema deployment must be coordinated to avoid breaking old tabs or rolling instances. New schema columns have defaults; old tabs missing revision receive a reload instruction after enablement, never an unconditional write exemption.

## Implementation writer inventory (T004)

Browser resource writers in database.ts: createOverlay, createPlaylist, saveOverlay, savePlaylist, deleteOverlay, deletePlaylist, upsertPlaylistClips (append/replace), reorderPlaylistClips, importPlaylistClips, setPlayerVolumeForOwner, secret/config writers. Runtime touchOverlay only advances lastUsedAt. Callers: OverlayTable status/single/bulk delete; dashboard overlay autosave/reward reset/theme; playlist rename/replace/import; gallery playlist references. Destinations: shared resource services for all creation/edit/delete/items; creator-account lock for count/insert and entitlement reconciliation; playlist lock for item position and parent revisions; overlay revision increment for playlist reference detach, volume and secret changes. External pause/reward effects must occur after commit. No MCP adapter will call browser actions.
