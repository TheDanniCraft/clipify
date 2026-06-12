---
type: community
cohesion: 0.29
members: 7
---

# Adminview Logic

**Cohesion:** 0.29 - loosely connected
**Members:** 7 nodes

## Members
- [[Admin View Actions]] - code - app/actions/adminView.ts
- [[Campaign Offers Server Actions]] - code - src/app/actions/campaignOffers.ts
- [[Dashboard Navbar Component]] - code - app/components/dashboardNavbar.tsx
- [[Dashboard Navbar Test]] - code - test/app/components/dashboardNavbar.test.tsx
- [[Logo Component]] - code - app/components/logo.tsx
- [[Logo Test]] - code - test/app/components/logo.test.tsx
- [[Stripe Subscription Actions]] - code - src/app/actions/subscription.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Adminview_Logic
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_Auth Logic]]
- 1 edge to [[_COMMUNITY_Index Logic]]
- 1 edge to [[_COMMUNITY_Feedbackwidget Logic (2)]]

## Top bridge nodes
- [[Stripe Subscription Actions]] - degree 3, connects to 2 communities
- [[Campaign Offers Server Actions]] - degree 3, connects to 1 community
- [[Admin View Actions]] - degree 2, connects to 1 community