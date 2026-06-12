---
type: community
cohesion: 0.22
members: 9
---

# Index Logic

**Cohesion:** 0.22 - loosely connected
**Members:** 9 nodes

## Members
- [[Overlay Table Component]] - code - app/components/OverlayTable/index.tsx
- [[Overlay Table Copy Text Component]] - code - app/components/OverlayTable/copy-text.tsx
- [[Overlay Table Copy Text Test]] - code - test/app/components/OverlayTable/copy-text.test.tsx
- [[Overlay Table Index Test]] - code - test/app/components/OverlayTable/index.test.tsx
- [[Overlay Table Memoized Callback Hook Test]] - code - test/app/components/OverlayTable/use-memoized-callback.test.tsx
- [[Overlay Table Status Component]] - code - app/components/OverlayTable/Status.tsx
- [[Overlay Table Status Test]] - code - test/app/components/OverlayTable/Status.test.tsx
- [[Overlay Table Test]] - code - test/app/components/OverlayTable.test.tsx
- [[Overlay Table useMemoizedCallback Hook]] - code - app/components/OverlayTable/use-memoized-callback.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Index_Logic
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_Auth Logic]]
- 2 edges to [[_COMMUNITY_Commands Logic]]
- 1 edge to [[_COMMUNITY_Adminview Logic]]
- 1 edge to [[_COMMUNITY_Page Logic (2)]]

## Top bridge nodes
- [[Overlay Table Component]] - degree 11, connects to 4 communities