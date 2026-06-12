---
type: community
cohesion: 0.22
members: 11
---

# Ratelimit Test Suite

**Cohesion:** 0.22 - loosely connected
**Members:** 11 nodes

## Members
- [[RateLimiterMemory]] - code - test/app/actions/rateLimit.test.ts
- [[consume]] - code - test/app/actions/rateLimit.test.ts
- [[getUserIP()]] - code - src/app/actions/rateLimit.ts
- [[headerValues]] - code - test/app/actions/rateLimit.test.ts
- [[headers]] - code - test/app/actions/rateLimit.test.ts
- [[isCoolifyMock]] - code - test/app/actions/rateLimit.test.ts
- [[loadRateLimit()]] - code - test/app/actions/rateLimit.test.ts
- [[rateLimit.test.ts]] - code - test/app/actions/rateLimit.test.ts
- [[rateLimit.ts]] - code - src/app/actions/rateLimit.ts
- [[rateLimiterMap]] - code - src/app/actions/rateLimit.ts
- [[tryRateLimit()]] - code - src/app/actions/rateLimit.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Ratelimit_Test_Suite
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_Newsletter Logic]]
- 3 edges to [[_COMMUNITY_Feedbackwidget Logic]]
- 3 edges to [[_COMMUNITY_Utils Logic]]
- 1 edge to [[_COMMUNITY_Route Logic]]

## Top bridge nodes
- [[rateLimit.ts]] - degree 12, connects to 3 communities
- [[tryRateLimit()]] - degree 4, connects to 2 communities
- [[getUserIP()]] - degree 4, connects to 1 community
- [[headers]] - degree 3, connects to 1 community