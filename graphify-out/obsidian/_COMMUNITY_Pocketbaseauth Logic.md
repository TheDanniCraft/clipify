---
type: community
cohesion: 0.33
members: 12
---

# Pocketbaseauth Logic

**Cohesion:** 0.33 - loosely connected
**Members:** 12 nodes

## Members
- [[AuthResponse]] - code - src/app/lib/pocketbaseAuth.ts
- [[fetchCampaignOffersFromPocketBase()]] - code - src/app/lib/campaignOffers.ts
- [[fetchRoadmapItemsFromPocketBase()]] - code - src/app/lib/roadmap.ts
- [[getCachedTokenIfValid()]] - code - src/app/lib/pocketbaseAuth.ts
- [[getPocketBaseAuthToken()]] - code - src/app/lib/pocketbaseAuth.ts
- [[getPocketBaseUrl()]] - code - src/app/lib/pocketbaseAuth.ts
- [[invalidatePocketBaseAuthToken()]] - code - src/app/lib/pocketbaseAuth.ts
- [[loginWithPassword()]] - code - src/app/lib/pocketbaseAuth.ts
- [[parseJwtExp()]] - code - src/app/lib/pocketbaseAuth.ts
- [[pocketbaseAuth.ts]] - code - src/app/lib/pocketbaseAuth.ts
- [[setCachedToken()]] - code - src/app/lib/pocketbaseAuth.ts
- [[sortRoadmapRecords()]] - code - src/app/lib/roadmap.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Pocketbaseauth_Logic
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_Campaignoffers Logic]]
- 7 edges to [[_COMMUNITY_Roadmap Logic]]

## Top bridge nodes
- [[pocketbaseAuth.ts]] - degree 10, connects to 2 communities
- [[getPocketBaseAuthToken()]] - degree 9, connects to 2 communities
- [[invalidatePocketBaseAuthToken()]] - degree 7, connects to 2 communities
- [[getPocketBaseUrl()]] - degree 6, connects to 2 communities
- [[fetchCampaignOffersFromPocketBase()]] - degree 6, connects to 1 community