---
type: community
cohesion: 0.17
members: 19
---

# Roadmap Logic

**Cohesion:** 0.17 - loosely connected
**Members:** 19 nodes

## Members
- [[FetchRoadmapRecordsResult]] - code - src/app/lib/roadmap.ts
- [[PocketBaseListResponse_1]] - code - src/app/lib/roadmap.ts
- [[PocketBaseRoadmapRecord]] - code - src/app/lib/roadmap.ts
- [[RoadmapItemData]] - code - src/app/components/roadmap/roadmapData.ts
- [[RoadmapPage()]] - code - src/app/roadmap/page.tsx
- [[buildRoadmapRequestUrl()]] - code - src/app/lib/roadmap.ts
- [[fetchRoadmapRecords()]] - code - src/app/lib/roadmap.ts
- [[fetchRoadmapRecordsWithFallback()]] - code - src/app/lib/roadmap.ts
- [[getCachedRoadmapItems]] - code - src/app/lib/roadmap.ts
- [[getRoadmapItems()]] - code - src/app/lib/roadmap.ts
- [[mapRecord()]] - code - src/app/lib/roadmap.ts
- [[normalizeIcon()]] - code - src/app/lib/roadmap.ts
- [[normalizeRoadmapColor()]] - code - src/app/components/roadmap/roadmapData.ts
- [[normalizeRoadmapStatus()]] - code - src/app/components/roadmap/roadmapData.ts
- [[page.tsx_16]] - code - src/app/roadmap/page.tsx
- [[roadmap.ts]] - code - src/app/lib/roadmap.ts
- [[roadmapColorOptions]] - code - src/app/components/roadmap/roadmapData.ts
- [[roadmapData.ts]] - code - src/app/components/roadmap/roadmapData.ts
- [[toTime()_1]] - code - src/app/lib/roadmap.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Roadmap_Logic
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_Roadmapitem Logic]]
- 7 edges to [[_COMMUNITY_Pocketbaseauth Logic]]
- 1 edge to [[_COMMUNITY_Newsletter Logic]]
- 1 edge to [[_COMMUNITY_Page Logic (4)]]

## Top bridge nodes
- [[page.tsx_16]] - degree 7, connects to 3 communities
- [[roadmap.ts]] - degree 22, connects to 1 community
- [[roadmapData.ts]] - degree 9, connects to 1 community
- [[fetchRoadmapRecordsWithFallback()]] - degree 4, connects to 1 community
- [[RoadmapItemData]] - degree 3, connects to 1 community