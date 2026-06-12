---
type: community
cohesion: 0.18
members: 16
---

# Campaignoffers Logic

**Cohesion:** 0.18 - loosely connected
**Members:** 16 nodes

## Members
- [[FetchCampaignRecordsResult]] - code - src/app/lib/campaignOffers.ts
- [[PocketBaseCampaignOfferRecord]] - code - src/app/lib/campaignOffers.ts
- [[PocketBaseListResponse]] - code - src/app/lib/campaignOffers.ts
- [[buildCampaignOffersRequestUrl()]] - code - src/app/lib/campaignOffers.ts
- [[campaignOffers.ts_1]] - code - src/app/lib/campaignOffers.ts
- [[fetchCampaignOfferRecords()]] - code - src/app/lib/campaignOffers.ts
- [[fetchCampaignOfferRecordsWithFallback()]] - code - src/app/lib/campaignOffers.ts
- [[getActiveCampaignOffer()]] - code - src/app/lib/campaignOffers.ts
- [[getCachedActiveCampaignOffer]] - code - src/app/lib/campaignOffers.ts
- [[isRecordActive()]] - code - src/app/lib/campaignOffers.ts
- [[mapRecordToOffer()]] - code - src/app/lib/campaignOffers.ts
- [[selectActiveCampaignOffer()]] - code - src/app/lib/campaignOffers.ts
- [[selectMappableCampaignOffer()]] - code - src/app/lib/campaignOffers.ts
- [[sortCampaignOffers()]] - code - src/app/lib/campaignOffers.ts
- [[toOptionalInt()]] - code - src/app/lib/campaignOffers.ts
- [[toTime()]] - code - src/app/lib/campaignOffers.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Campaignoffers_Logic
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_Pocketbaseauth Logic]]
- 4 edges to [[_COMMUNITY_Stripe Subscriptions & Campaigns]]
- 3 edges to [[_COMMUNITY_Campaignoffers Test Suite]]
- 2 edges to [[_COMMUNITY_Page Logic (3)]]
- 1 edge to [[_COMMUNITY_Homepageclient Logic]]
- 1 edge to [[_COMMUNITY_User Authentication & Database Client]]

## Top bridge nodes
- [[campaignOffers.ts_1]] - degree 27, connects to 6 communities
- [[getActiveCampaignOffer()]] - degree 5, connects to 2 communities
- [[fetchCampaignOfferRecordsWithFallback()]] - degree 4, connects to 1 community
- [[selectMappableCampaignOffer()]] - degree 4, connects to 1 community
- [[selectActiveCampaignOffer()]] - degree 3, connects to 1 community