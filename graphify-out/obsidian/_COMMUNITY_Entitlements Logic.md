---
type: community
cohesion: 0.40
members: 6
---

# Entitlements Logic

**Cohesion:** 0.40 - moderately connected
**Members:** 6 nodes

## Members
- [[Entitlements Library Test]] - code - test/app/lib/entitlements.test.ts
- [[Feature Access Library Test]] - code - test/app/lib/featureAccess.test.ts
- [[Feature Access Rules]] - code - app/lib/featureAccess.ts
- [[Payment Webhook Route Test]] - code - test/app/payment/webhook/route.test.ts
- [[Stripe Webhook Route]] - code - app/payment/webhook/route.ts
- [[User Entitlements Manager]] - code - app/lib/entitlements.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Entitlements_Logic
SORT file.name ASC
```
