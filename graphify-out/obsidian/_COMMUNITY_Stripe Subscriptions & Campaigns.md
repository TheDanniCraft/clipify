---
type: community
cohesion: 0.08
members: 47
---

# Stripe Subscriptions & Campaigns

**Cohesion:** 0.08 - loosely connected
**Members:** 47 nodes

## Members
- [[AccessContext]] - code - src/app/lib/featureAccess.ts
- [[AuthenticatedUser]] - code - src/app/lib/types.ts
- [[BillingCycle]] - code - src/app/actions/subscription.ts
- [[ClipCacheStatusState]] - code - src/app/dashboard/settings/page.tsx
- [[ClipForceRefreshStatusState]] - code - src/app/dashboard/settings/page.tsx
- [[ConfirmModal()]] - code - src/app/components/confirmModal.tsx
- [[FeatureKey]] - code - src/app/lib/featureAccess.ts
- [[NumokStripeMetadata]] - code - src/app/lib/types.ts
- [[OverlaySettings()]] - code - src/app/dashboard/overlay/[overlayId]/page.tsx
- [[PRODUCTS]] - code - src/app/actions/subscription.ts
- [[PaywallEvent]] - code - src/app/lib/paywallTracking.ts
- [[PaywallSource]] - code - src/app/actions/subscription.ts
- [[PlausibleFn]] - code - src/app/lib/paywallTracking.ts
- [[SettingsPage()]] - code - src/app/dashboard/settings/page.tsx
- [[TestUser]] - code - test/app/lib/featureAccess.test.ts
- [[UpgradeModal()]] - code - src/app/components/upgradeModal.tsx
- [[UpgradeModalProps]] - code - src/app/components/upgradeModal.tsx
- [[UserEntitlements]] - code - src/app/lib/types.ts
- [[UserSettings]] - code - src/app/lib/types.ts
- [[buildEntitlements()]] - code - test/app/lib/featureAccess.test.ts
- [[buildUser()]] - code - test/app/lib/featureAccess.test.ts
- [[campaignOffers.ts]] - code - src/app/actions/campaignOffers.ts
- [[checkIfSubscriptionExists()]] - code - src/app/actions/subscription.ts
- [[confirmModal.test.tsx]] - code - test/app/components/confirmModal.test.tsx
- [[confirmModal.tsx]] - code - src/app/components/confirmModal.tsx
- [[deleteUser()]] - code - src/app/actions/database.ts
- [[featureAccess.test.ts]] - code - test/app/lib/featureAccess.test.ts
- [[featureAccess.ts]] - code - src/app/lib/featureAccess.ts
- [[formatOriginalPrice()]] - code - src/app/components/upgradeModal.tsx
- [[formatPromoPrice()]] - code - src/app/components/upgradeModal.tsx
- [[generatePaymentLink()]] - code - src/app/actions/subscription.ts
- [[getActiveCampaignOfferAction()]] - code - src/app/actions/campaignOffers.ts
- [[getAuthorizedUser()]] - code - src/app/actions/subscription.ts
- [[getFeatureAccess()]] - code - src/app/lib/featureAccess.ts
- [[getPlans()]] - code - src/app/actions/subscription.ts
- [[getPortalLink()]] - code - src/app/actions/subscription.ts
- [[getSettings()]] - code - src/app/actions/database.ts
- [[getStripe()]] - code - src/app/actions/subscription.ts
- [[getTrialDaysLeft()]] - code - src/app/lib/featureAccess.ts
- [[isReverseTrialActive()]] - code - src/app/lib/featureAccess.ts
- [[page.tsx_9]] - code - src/app/dashboard/settings/page.tsx
- [[paywallTracking.test.ts]] - code - test/app/lib/paywallTracking.test.ts
- [[paywallTracking.ts]] - code - src/app/lib/paywallTracking.ts
- [[persistStripeCustomerId()]] - code - src/app/actions/subscription.ts
- [[subscription.ts]] - code - src/app/actions/subscription.ts
- [[trackPaywallEvent()]] - code - src/app/lib/paywallTracking.ts
- [[upgradeModal.tsx]] - code - src/app/components/upgradeModal.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Stripe_Subscriptions__Campaigns
SORT file.name ASC
```

## Connections to other communities
- 18 edges to [[_COMMUNITY_Premium Gating & Chat Commands]]
- 16 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 15 edges to [[_COMMUNITY_Twitch Integration & Cache API]]
- 10 edges to [[_COMMUNITY_Admin Impersonation View]]
- 8 edges to [[_COMMUNITY_Data Logic]]
- 8 edges to [[_COMMUNITY_Pricing Types Logic]]
- 8 edges to [[_COMMUNITY_Page Logic]]
- 4 edges to [[_COMMUNITY_Campaignoffers Logic]]
- 4 edges to [[_COMMUNITY_Route Logic]]
- 4 edges to [[_COMMUNITY_Overlay Player & Media Components]]
- 2 edges to [[_COMMUNITY_Utils Logic]]
- 2 edges to [[_COMMUNITY_Newsletter Logic]]
- 2 edges to [[_COMMUNITY_Database Coverage Test Suite]]
- 2 edges to [[_COMMUNITY_Database Overlays Test Suite]]
- 1 edge to [[_COMMUNITY_Subscription Test Suite]]
- 1 edge to [[_COMMUNITY_Tagsinput Logic]]
- 1 edge to [[_COMMUNITY_Homepageclient Logic]]

## Top bridge nodes
- [[upgradeModal.tsx]] - degree 30, connects to 8 communities
- [[page.tsx_9]] - degree 35, connects to 7 communities
- [[featureAccess.ts]] - degree 19, connects to 7 communities
- [[AuthenticatedUser]] - degree 17, connects to 7 communities
- [[subscription.ts]] - degree 26, connects to 6 communities