---
type: community
cohesion: 0.05
members: 88
---

# Twitch Integration & Cache API

**Cohesion:** 0.05 - loosely connected
**Members:** 88 nodes

## Members
- [[ALL_CATEGORIES_OPTION]] - code - src/app/dashboard/overlay/[overlayId]/page.tsx
- [[ALL_CATEGORIES_OPTION_1]] - code - src/app/dashboard/playlist/[playlistId]/page.tsx
- [[CLIP_CACHE_PREFIX()]] - code - src/app/actions/twitch.ts
- [[CLIP_FORCE_REFRESH_COOLDOWN_MS]] - code - src/app/actions/twitch.ts
- [[CLIP_FORCE_REFRESH_KEY()]] - code - src/app/actions/twitch.ts
- [[CLIP_SYNC_RECENT_MAX_PAGES_PER_RUN]] - code - src/app/actions/twitch.ts
- [[CLIP_SYNC_REQUEST_BUDGET_PER_RUN]] - code - src/app/actions/twitch.ts
- [[CLIP_SYNC_STATE_KEY()]] - code - src/app/actions/twitch.ts
- [[CLIP_VALIDATION_STALE_MS]] - code - src/app/actions/twitch.ts
- [[CachedClipValue_1]] - code - src/app/actions/twitch.ts
- [[ClipForceRefreshState]] - code - src/app/actions/twitch.ts
- [[ClipSyncState_1]] - code - src/app/actions/twitch.ts
- [[EventSubSubscription]] - code - src/app/actions/twitch.ts
- [[Game]] - code - src/app/lib/types.ts
- [[PlaylistPage()]] - code - src/app/dashboard/playlist/[playlistId]/page.tsx
- [[RefreshAccessTokenResult]] - code - src/app/actions/twitch.ts
- [[RefreshAccessTokenResult_1]] - code - src/server/twitch-auth.ts
- [[TwitchApiResponse]] - code - src/app/lib/types.ts
- [[TwitchClip]] - code - src/app/lib/types.ts
- [[TwitchReward]] - code - src/app/lib/types.ts
- [[TwitchTokenApiResponse]] - code - src/app/lib/types.ts
- [[buildGameSearchQueries()]] - code - src/app/actions/twitch.ts
- [[cleanupTwitchCacheIfNeeded()]] - code - src/app/actions/database.ts
- [[clearEventSubSubscriptionsByTypeAndCondition()]] - code - src/app/actions/twitch.ts
- [[compileEntry()]] - code - src/app/utils/regexFilter.ts
- [[createChannelReward()]] - code - src/app/actions/twitch.ts
- [[dbPool]] - code - src/db/client.ts
- [[deleteEventSubSubscription()]] - code - src/app/actions/twitch.ts
- [[fetchClipPage()]] - code - src/app/actions/twitch.ts
- [[forceRefreshOwnClipCache()]] - code - src/app/actions/twitch.ts
- [[getAccessTokenServer()]] - code - src/app/actions/database.ts
- [[getAppAccessToken()]] - code - src/app/actions/twitch.ts
- [[getAvatar()]] - code - src/app/actions/twitch.ts
- [[getCachedClipsByOwner()]] - code - src/app/actions/twitch.ts
- [[getClipForceRefreshState()]] - code - src/app/actions/twitch.ts
- [[getClipSyncState()]] - code - src/app/actions/twitch.ts
- [[getCreatorSyncProgress()]] - code - src/app/actions/twitch.ts
- [[getCurrentCategoryGameId()]] - code - src/app/actions/twitch.ts
- [[getDemoClip()]] - code - src/app/actions/twitch.ts
- [[getGameDetails()]] - code - src/app/actions/twitch.ts
- [[getGamesDetailsBulk()]] - code - src/app/actions/twitch.ts
- [[getOwnClipForceRefreshStatus()]] - code - src/app/actions/twitch.ts
- [[getRateLimitResumeAt()]] - code - src/app/actions/twitch.ts
- [[getReward()]] - code - src/app/actions/twitch.ts
- [[getTwitchClipBatch()]] - code - src/app/actions/twitch.ts
- [[getTwitchClips()]] - code - src/app/actions/twitch.ts
- [[getTwitchGames()]] - code - src/app/actions/twitch.ts
- [[getUserDetails()]] - code - src/app/actions/twitch.ts
- [[internalSearchTwitchGames()]] - code - src/app/actions/twitch.ts
- [[isTitleBlocked()]] - code - src/app/utils/regexFilter.ts
- [[levenshteinDistance()]] - code - src/app/actions/twitch.ts
- [[listEventSubSubscriptions()]] - code - src/app/actions/twitch.ts
- [[logTwitchError()]] - code - src/app/actions/twitch.ts
- [[normalizeCategorySearch()]] - code - src/app/dashboard/overlay/[overlayId]/page.tsx
- [[normalizeCategorySearch()_1]] - code - src/app/dashboard/playlist/[playlistId]/page.tsx
- [[normalizeGameSearchText()]] - code - src/app/actions/twitch.ts
- [[overlayTypes]] - code - src/app/dashboard/overlay/[overlayId]/page.tsx
- [[page.tsx_6]] - code - src/app/dashboard/overlay/[overlayId]/page.tsx
- [[page.tsx_8]] - code - src/app/dashboard/playlist/[playlistId]/page.tsx
- [[parseCachedClipValue()]] - code - src/app/actions/twitch.ts
- [[parsePositiveInt()]] - code - src/app/actions/twitch.ts
- [[playbackModeHelpText]] - code - src/app/dashboard/overlay/[overlayId]/page.tsx
- [[playbackModes]] - code - src/app/dashboard/overlay/[overlayId]/page.tsx
- [[refreshAccessToken()]] - code - src/app/actions/twitch.ts
- [[refreshAccessTokenWithContext()]] - code - src/app/actions/twitch.ts
- [[refreshAccessTokenWithContextInternal()]] - code - src/server/twitch-auth.ts
- [[regexFilter.test.ts]] - code - test/app/utils/regexFilter.test.ts
- [[regexFilter.ts]] - code - src/app/utils/regexFilter.ts
- [[removeChannelReward()]] - code - src/app/actions/twitch.ts
- [[resolvePlayableClip()]] - code - src/app/actions/twitch.ts
- [[runBackfillSync()]] - code - src/app/actions/twitch.ts
- [[runIncrementalSync()]] - code - src/app/actions/twitch.ts
- [[scoreGameSearchResult()]] - code - src/app/actions/twitch.ts
- [[setClipForceRefreshState()]] - code - src/app/actions/twitch.ts
- [[setClipSyncState()]] - code - src/app/actions/twitch.ts
- [[setTwitchCache()]] - code - src/app/actions/database.ts
- [[setTwitchCacheBatch()]] - code - src/app/actions/database.ts
- [[subscribeToChat()]] - code - src/app/actions/twitch.ts
- [[subscribeToReward()]] - code - src/app/actions/twitch.ts
- [[summarizeError()]] - code - src/app/actions/database.ts
- [[syncOwnerClipCache()]] - code - src/app/actions/twitch.ts
- [[toClipCacheKey()]] - code - src/app/actions/twitch.ts
- [[twitch-auth.ts]] - code - src/server/twitch-auth.ts
- [[twitch.games.test.ts]] - code - test/app/actions/twitch.games.test.ts
- [[twitch.ts]] - code - src/app/actions/twitch.ts
- [[twitchErrors.ts]] - code - src/app/lib/twitchErrors.ts
- [[upsertClipsByOwner()]] - code - src/app/actions/twitch.ts
- [[verifyToken()]] - code - src/app/actions/twitch.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Twitch_Integration__Cache_API
SORT file.name ASC
```

## Connections to other communities
- 50 edges to [[_COMMUNITY_Premium Gating & Chat Commands]]
- 22 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 16 edges to [[_COMMUNITY_Overlay Player & Media Components]]
- 15 edges to [[_COMMUNITY_Stripe Subscriptions & Campaigns]]
- 12 edges to [[_COMMUNITY_Admin Impersonation View]]
- 12 edges to [[_COMMUNITY_Twitch Moderator Commands & Controller Queue]]
- 4 edges to [[_COMMUNITY_Data Logic]]
- 3 edges to [[_COMMUNITY_Utils Logic]]
- 2 edges to [[_COMMUNITY_Twitch External Test Suite]]
- 2 edges to [[_COMMUNITY_Tagsinput Logic]]
- 1 edge to [[_COMMUNITY_Twitch Playback Test Suite]]
- 1 edge to [[_COMMUNITY_Feedbackwidget Logic]]
- 1 edge to [[_COMMUNITY_Newsletter Logic]]

## Top bridge nodes
- [[twitch.ts]] - degree 124, connects to 10 communities
- [[page.tsx_6]] - degree 50, connects to 9 communities
- [[page.tsx_8]] - degree 24, connects to 5 communities
- [[logTwitchError()]] - degree 23, connects to 4 communities
- [[TwitchClip]] - degree 7, connects to 4 communities