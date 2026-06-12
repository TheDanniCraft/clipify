---
type: community
cohesion: 0.38
members: 7
---

# Auth Logic

**Cohesion:** 0.38 - loosely connected
**Members:** 7 nodes

## Members
- [[Admin Dashboard Page]] - code - src/app/admin/page.tsx
- [[Admin Health Charts Component]] - code - src/app/components/adminHealthCharts.tsx
- [[Admin Impersonation Route]] - code - src/app/admin/view-as/[targetUserId]/route.ts
- [[Admin User Explorer Behavior Test]] - code - test/app/components/adminUserExplorer.behavior.test.tsx
- [[Admin User Explorer Component]] - code - src/app/components/adminUserExplorer.tsx
- [[Admin User Explorer Test]] - code - test/app/components/adminUserExplorer.test.tsx
- [[Authentication Server Actions]] - code - src/app/actions/auth.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Auth_Logic
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Commands Logic]]
- 2 edges to [[_COMMUNITY_Feedbackwidget Logic (2)]]
- 2 edges to [[_COMMUNITY_Adminview Logic]]
- 2 edges to [[_COMMUNITY_Index Logic]]

## Top bridge nodes
- [[Authentication Server Actions]] - degree 11, connects to 4 communities
- [[Admin User Explorer Component]] - degree 7, connects to 2 communities