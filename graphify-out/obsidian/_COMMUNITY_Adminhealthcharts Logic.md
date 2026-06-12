---
type: community
cohesion: 0.32
members: 8
---

# Adminhealthcharts Logic

**Cohesion:** 0.32 - loosely connected
**Members:** 8 nodes

## Members
- [[AdminHealthCharts()]] - code - src/app/components/adminHealthCharts.tsx
- [[InstanceHealthSnapshot]] - code - src/app/lib/instanceHealth.ts
- [[MeasuredChart()]] - code - src/app/components/adminHealthCharts.tsx
- [[MockResizeObserver]] - code - test/app/components/adminHealthCharts.test.tsx
- [[adminHealthCharts.test.tsx]] - code - test/app/components/adminHealthCharts.test.tsx
- [[adminHealthCharts.tsx]] - code - src/app/components/adminHealthCharts.tsx
- [[formatPercent()_1]] - code - src/app/components/adminHealthCharts.tsx
- [[healthSnapshot]] - code - test/app/components/adminHealthCharts.test.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Adminhealthcharts_Logic
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 1 edge to [[_COMMUNITY_Page Logic (5)]]

## Top bridge nodes
- [[adminHealthCharts.tsx]] - degree 7, connects to 2 communities
- [[adminHealthCharts.test.tsx]] - degree 5, connects to 1 community
- [[InstanceHealthSnapshot]] - degree 3, connects to 1 community