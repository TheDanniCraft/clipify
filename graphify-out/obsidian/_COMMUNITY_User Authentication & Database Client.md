---
type: community
cohesion: 0.04
members: 81
---

# User Authentication & Database Client

**Cohesion:** 0.04 - loosely connected
**Members:** 81 nodes

## Members
- [[AccessType]] - code - src/app/lib/types.ts
- [[AdminViewContext]] - code - src/app/lib/types.ts
- [[DatabaseClient]] - code - src/db/client.ts
- [[DbUser]] - code - src/app/lib/types.ts
- [[EffectivePlan]] - code - src/app/lib/types.ts
- [[Entitlement]] - code - src/app/lib/types.ts
- [[EntitlementGrant]] - code - src/app/lib/types.ts
- [[EntitlementGrantSource]] - code - src/app/lib/types.ts
- [[EntitlementSource]] - code - src/app/lib/types.ts
- [[EventSubSubscription_1]] - code - src/app/lib/types.ts
- [[FeedbackType]] - code - src/app/lib/types.ts
- [[GET()_4]] - code - src/app/internal/health/instance/route.ts
- [[GithubAsset]] - code - src/app/lib/types.ts
- [[GithubUser]] - code - src/app/lib/types.ts
- [[HealthStatus]] - code - src/app/lib/instanceHealth.ts
- [[OverlayType]] - code - src/app/lib/types.ts
- [[Pagination]] - code - src/app/lib/types.ts
- [[PartialUser]] - code - test/app/lib/entitlements.test.ts
- [[Plan]] - code - src/app/lib/types.ts
- [[PlaybackMode]] - code - src/app/lib/types.ts
- [[Playlist]] - code - src/app/lib/types.ts
- [[PlaylistClip]] - code - src/app/lib/types.ts
- [[QueryClient]] - code - src/db/client.ts
- [[TransactionClient]] - code - src/db/client.ts
- [[TwitchAppAccessTokenResponse]] - code - src/app/lib/types.ts
- [[TwitchBadge]] - code - src/app/lib/types.ts
- [[TwitchCache]] - code - src/app/lib/types.ts
- [[TwitchCacheType]] - code - src/app/lib/types.ts
- [[TwitchCheer]] - code - src/app/lib/types.ts
- [[TwitchClipBody]] - code - src/app/lib/types.ts
- [[TwitchClipPlaybackAccessToken]] - code - src/app/lib/types.ts
- [[TwitchClipResponse]] - code - src/app/lib/types.ts
- [[TwitchMessageFragment]] - code - src/app/lib/types.ts
- [[TwitchReply]] - code - src/app/lib/types.ts
- [[TwitchRewardResponse]] - code - src/app/lib/types.ts
- [[UserToken]] - code - src/app/lib/types.ts
- [[Window]] - code - src/app/lib/types.ts
- [[accountDisableTypeEnum]] - code - src/db/schema.ts
- [[client.ts]] - code - src/db/client.ts
- [[countRows()]] - code - src/app/lib/instanceHealth.ts
- [[countWhereOverlays()]] - code - src/app/lib/instanceHealth.ts
- [[db]] - code - src/db/client.ts
- [[db_2]] - code - test/app/lib/entitlements.test.ts
- [[entitlementEnum]] - code - src/db/schema.ts
- [[entitlementGrantSourceEnum]] - code - src/db/schema.ts
- [[entitlementGrantsTable]] - code - src/db/schema.ts
- [[entitlements.test.ts]] - code - test/app/lib/entitlements.test.ts
- [[enumToPgEnum()]] - code - src/db/schema.ts
- [[getInstanceHealthSnapshot()]] - code - src/app/lib/instanceHealth.ts
- [[getOverlayOwnerPlanPublic_2]] - code - test/app/controller/page.test.tsx
- [[getOverlayWithEditAccess_1]] - code - test/app/controller/page.test.tsx
- [[instanceHealth.ts]] - code - src/app/lib/instanceHealth.ts
- [[isAuthorized()]] - code - src/app/internal/health/instance/route.ts
- [[jwtSign_1]] - code - test/app/controller/page.test.tsx
- [[loadEntitlements()]] - code - test/app/lib/entitlements.test.ts
- [[maxDurationModeEnum]] - code - src/db/schema.ts
- [[modQueueTable]] - code - src/db/schema.ts
- [[overlayTypeEnum]] - code - src/db/schema.ts
- [[overlaysTable]] - code - src/db/schema.ts
- [[page.test.tsx]] - code - test/app/controller/page.test.tsx
- [[planEnum]] - code - src/db/schema.ts
- [[playbackModeEnum]] - code - src/db/schema.ts
- [[playlistClipsTable]] - code - src/db/schema.ts
- [[playlistsTable]] - code - src/db/schema.ts
- [[queryBuilder]] - code - test/app/lib/entitlements.test.ts
- [[queueTable]] - code - src/db/schema.ts
- [[redirect]] - code - test/app/controller/page.test.tsx
- [[roleEnum]] - code - src/db/schema.ts
- [[route.ts_5]] - code - src/app/internal/health/instance/route.ts
- [[schema.ts]] - code - src/db/schema.ts
- [[secureEqual()]] - code - src/app/internal/health/instance/route.ts
- [[selectExecute]] - code - test/app/lib/entitlements.test.ts
- [[settingsTable]] - code - src/db/schema.ts
- [[statusOptionsEnum]] - code - src/db/schema.ts
- [[subscriptions.ts]] - code - src/server/subscriptions.ts
- [[tokenTable]] - code - src/db/schema.ts
- [[twitchCacheTable]] - code - src/db/schema.ts
- [[twitchCacheTypeEnum]] - code - src/db/schema.ts
- [[types.ts]] - code - src/app/lib/types.ts
- [[usersTable]] - code - src/db/schema.ts
- [[validateAuth_14]] - code - test/app/controller/page.test.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/User_Authentication__Database_Client
SORT file.name ASC
```

## Connections to other communities
- 50 edges to [[_COMMUNITY_Premium Gating & Chat Commands]]
- 22 edges to [[_COMMUNITY_Twitch Integration & Cache API]]
- 17 edges to [[_COMMUNITY_Overlay Player & Media Components]]
- 16 edges to [[_COMMUNITY_Stripe Subscriptions & Campaigns]]
- 14 edges to [[_COMMUNITY_Admin Impersonation View]]
- 12 edges to [[_COMMUNITY_Twitch Moderator Commands & Controller Queue]]
- 8 edges to [[_COMMUNITY_Data Logic]]
- 6 edges to [[_COMMUNITY_Feedbackwidget Logic]]
- 5 edges to [[_COMMUNITY_Homepageclient Logic]]
- 4 edges to [[_COMMUNITY_Newsletter Logic]]
- 4 edges to [[_COMMUNITY_Route Logic]]
- 3 edges to [[_COMMUNITY_Page Logic (5)]]
- 3 edges to [[_COMMUNITY_Adminhealthcharts Logic]]
- 2 edges to [[_COMMUNITY_Page Logic (4)]]
- 2 edges to [[_COMMUNITY_Page Logic]]
- 2 edges to [[_COMMUNITY_Clipcachescheduler Test Suite]]
- 2 edges to [[_COMMUNITY_Controller Test Suite]]
- 2 edges to [[_COMMUNITY_Twitch Sync Test Suite]]
- 2 edges to [[_COMMUNITY_Websocket Test Suite]]
- 2 edges to [[_COMMUNITY_Overlaytable Test Suite]]
- 2 edges to [[_COMMUNITY_Check Server Action Manifest Logic]]
- 1 edge to [[_COMMUNITY_Pricing Types Logic]]
- 1 edge to [[_COMMUNITY_Campaignoffers Logic]]
- 1 edge to [[_COMMUNITY_Database User Test Suite]]

## Top bridge nodes
- [[types.ts]] - degree 129, connects to 20 communities
- [[Plan]] - degree 21, connects to 10 communities
- [[schema.ts]] - degree 42, connects to 5 communities
- [[instanceHealth.ts]] - degree 34, connects to 5 communities
- [[client.ts]] - degree 14, connects to 5 communities