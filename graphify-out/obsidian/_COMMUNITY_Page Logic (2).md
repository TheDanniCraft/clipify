---
type: community
cohesion: 0.15
members: 18
---

# Page Logic (2)

**Cohesion:** 0.15 - loosely connected
**Members:** 18 nodes

## Members
- [[Application Constants]] - code - src/app/lib/constants.ts
- [[Campaign Offers Utility]] - code - src/app/lib/campaignOffers.ts
- [[Central TypeScript Types]] - code - src/app/lib/types.ts
- [[Clip Cache Scheduler]] - code - src/app/lib/clipCacheScheduler.ts
- [[Demo Player Page]] - code - src/app/demoPlayer/page.tsx
- [[Embed Overlay Page]] - code - src/app/embed/[overlayId]/page.tsx
- [[Entitlements Manager]] - code - src/app/lib/entitlements.ts
- [[Entitlements Scheduler]] - code - src/app/lib/entitlementsScheduler.ts
- [[Feature Access Policy]] - code - src/app/lib/featureAccess.ts
- [[Instance Health Metrics Collector]] - code - src/app/lib/instanceHealth.ts
- [[Internal Instance Health API Route]] - code - src/app/internal/health/instance/route.ts
- [[Paywall Event Tracker]] - code - src/app/lib/paywallTracking.ts
- [[Playlist Management Page]] - code - src/app/dashboard/playlist/[playlistId]/page.tsx
- [[PocketBase Auth Manager]] - code - src/app/lib/pocketbaseAuth.ts
- [[Roadmap Data Fetcher]] - code - src/app/lib/roadmap.ts
- [[Token Encryption Utility]] - code - src/app/lib/tokenCrypto.ts
- [[Twitch EventSub Webhook Route]] - code - src/app/eventsub/route.ts
- [[UserSettings Page]] - code - src/app/dashboard/settings/page.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Page_Logic_2
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Index Logic]]

## Top bridge nodes
- [[Paywall Event Tracker]] - degree 2, connects to 1 community