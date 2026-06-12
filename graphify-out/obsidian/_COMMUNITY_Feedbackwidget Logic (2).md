---
type: community
cohesion: 0.25
members: 9
---

# Feedbackwidget Logic (2)

**Cohesion:** 0.25 - loosely connected
**Members:** 9 nodes

## Members
- [[Auth Route Test]] - code - test/app/auth/route.test.ts
- [[Authentication Redirect Route]] - code - src/app/auth/route.ts
- [[Bot Authentication Redirect Route]] - code - src/app/auth/bot/route.ts
- [[Bot Route]] - code - app/auth/bot/route.ts
- [[Bot Route Test]] - code - test/app/auth/bot.route.test.ts
- [[Feedback Widget Actions]] - code - src/app/actions/feedbackWidget.ts
- [[Newsletter Sync Actions]] - code - src/app/actions/newsletter.ts
- [[Rate Limiting Actions]] - code - src/app/actions/rateLimit.ts
- [[Utility Server Actions]] - code - src/app/actions/utils.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Feedbackwidget_Logic_2
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Commands Logic]]
- 2 edges to [[_COMMUNITY_Auth Logic]]
- 1 edge to [[_COMMUNITY_Adminview Logic]]

## Top bridge nodes
- [[Utility Server Actions]] - degree 8, connects to 3 communities
- [[Feedback Widget Actions]] - degree 2, connects to 1 community
- [[Newsletter Sync Actions]] - degree 2, connects to 1 community