---
type: community
cohesion: 0.56
members: 9
---

# Route Logic

**Cohesion:** 0.56 - moderately connected
**Members:** 9 nodes

## Members
- [[POST()_1]] - code - src/app/payment/webhook/route.ts
- [[downgradeUserPlan()]] - code - src/app/actions/database.ts
- [[getSubscriptionCustomerId()]] - code - src/app/payment/webhook/route.ts
- [[getUserByCustomerId()]] - code - src/app/actions/database.ts
- [[handleCheckoutSessionCompleted()]] - code - src/app/payment/webhook/route.ts
- [[handleCustomerSubscriptionDeleted()]] - code - src/app/payment/webhook/route.ts
- [[handleCustomerSubscriptionUpdated()]] - code - src/app/payment/webhook/route.ts
- [[route.ts_8]] - code - src/app/payment/webhook/route.ts
- [[updateUserSubscriptionFromStripeWebhookInternal()]] - code - src/server/subscriptions.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Route_Logic
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_Premium Gating & Chat Commands]]
- 4 edges to [[_COMMUNITY_Stripe Subscriptions & Campaigns]]
- 4 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 1 edge to [[_COMMUNITY_Database Overlays Test Suite]]
- 1 edge to [[_COMMUNITY_Ratelimit Test Suite]]

## Top bridge nodes
- [[route.ts_8]] - degree 16, connects to 4 communities
- [[updateUserSubscriptionFromStripeWebhookInternal()]] - degree 6, connects to 2 communities
- [[getUserByCustomerId()]] - degree 5, connects to 1 community
- [[POST()_1]] - degree 5, connects to 1 community
- [[downgradeUserPlan()]] - degree 4, connects to 1 community