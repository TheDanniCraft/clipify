---
type: community
cohesion: 0.08
members: 48
---

# Admin Impersonation View

**Cohesion:** 0.08 - loosely connected
**Members:** 48 nodes

## Members
- [[AdminExplorerPage]] - code - src/app/actions/adminView.ts
- [[AdminExplorerRow]] - code - src/app/actions/adminView.ts
- [[AdminViewCandidate]] - code - src/app/actions/adminView.ts
- [[AdminViewPayload]] - code - src/app/actions/auth.ts
- [[Dashboard()]] - code - src/app/dashboard/page.tsx
- [[DashboardNavbar()]] - code - src/app/components/dashboardNavbar.tsx
- [[GET()_3]] - code - src/app/callback/route.ts
- [[GET()_6]] - code - src/app/logout/route.ts
- [[GET()]] - code - src/app/admin/view-as/[targetUserId]/route.ts
- [[Login()]] - code - src/app/login/page.tsx
- [[OAuthStatePayload]] - code - src/app/callback/route.ts
- [[Role]] - code - src/app/lib/types.ts
- [[adminImpersonationSessionsTable]] - code - src/db/schema.ts
- [[adminView.ts]] - code - src/app/actions/adminView.ts
- [[auth.ts]] - code - src/app/actions/auth.ts
- [[authUser()]] - code - src/app/actions/auth.ts
- [[clearAdminView()]] - code - src/app/actions/auth.ts
- [[clearAdminViewCookie()]] - code - src/app/actions/auth.ts
- [[clearAdminViewCookieForAuthFlow()]] - code - src/app/actions/auth.ts
- [[closeAdminViewSession()]] - code - src/app/actions/auth.ts
- [[closeAdminViewSessionReadOnly()]] - code - src/app/actions/auth.ts
- [[config_1]] - code - src/proxy.ts
- [[dashboardNavbar.tsx]] - code - src/app/components/dashboardNavbar.tsx
- [[exchangeAccesToken()]] - code - src/app/actions/twitch.ts
- [[getAdminViewCandidates()]] - code - src/app/actions/adminView.ts
- [[getAdminViewPayload()]] - code - src/app/actions/auth.ts
- [[getAdminViewSessionExpiryCutoffDate()]] - code - src/app/actions/auth.ts
- [[getAdminViewStatus()]] - code - src/app/actions/auth.ts
- [[getCookie()]] - code - src/app/actions/auth.ts
- [[getSafeReturnUrl()]] - code - src/app/callback/route.ts
- [[getUserById()]] - code - src/app/actions/auth.ts
- [[getUserFromCookie()]] - code - src/app/actions/auth.ts
- [[isOAuthStatePayload()]] - code - src/app/callback/route.ts
- [[page.tsx_4]] - code - src/app/dashboard/page.tsx
- [[page.tsx_13]] - code - src/app/login/page.tsx
- [[proxy()]] - code - src/proxy.ts
- [[proxy.ts]] - code - src/proxy.ts
- [[resolveEffectiveUser()]] - code - src/app/actions/auth.ts
- [[route.ts]] - code - src/app/admin/view-as/[targetUserId]/route.ts
- [[route.ts_3]] - code - src/app/callback/route.ts
- [[route.ts_7]] - code - src/app/logout/route.ts
- [[startAdminView()]] - code - src/app/actions/auth.ts
- [[startAdminViewSession()]] - code - src/app/actions/auth.ts
- [[stopAdminView()]] - code - src/app/actions/adminView.ts
- [[switchAdminView()]] - code - src/app/actions/adminView.ts
- [[touchUser()]] - code - src/app/actions/database.ts
- [[validateAdminAuth()]] - code - src/app/actions/auth.ts
- [[validateAuth()]] - code - src/app/actions/auth.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Admin_Impersonation_View
SORT file.name ASC
```

## Connections to other communities
- 21 edges to [[_COMMUNITY_Premium Gating & Chat Commands]]
- 14 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 12 edges to [[_COMMUNITY_Twitch Integration & Cache API]]
- 10 edges to [[_COMMUNITY_Stripe Subscriptions & Campaigns]]
- 5 edges to [[_COMMUNITY_Adminuserexplorer Logic]]
- 5 edges to [[_COMMUNITY_Overlay Player & Media Components]]
- 4 edges to [[_COMMUNITY_Page Logic (5)]]
- 4 edges to [[_COMMUNITY_Utils Logic]]
- 3 edges to [[_COMMUNITY_Feedbackwidget Logic]]
- 3 edges to [[_COMMUNITY_Data Logic]]
- 3 edges to [[_COMMUNITY_Page Logic]]
- 3 edges to [[_COMMUNITY_Database Coverage Test Suite]]
- 2 edges to [[_COMMUNITY_Twitch Moderator Commands & Controller Queue]]
- 2 edges to [[_COMMUNITY_Database Queues Test Suite]]
- 2 edges to [[_COMMUNITY_Database User Test Suite]]
- 2 edges to [[_COMMUNITY_Homepageclient Logic]]
- 1 edge to [[_COMMUNITY_Auth Test Suite]]
- 1 edge to [[_COMMUNITY_Check Server Action Manifest Logic]]
- 1 edge to [[_COMMUNITY_Dashboardnavbar Test Suite]]
- 1 edge to [[_COMMUNITY_Errortoast Logic]]

## Top bridge nodes
- [[auth.ts]] - degree 56, connects to 17 communities
- [[validateAuth()]] - degree 23, connects to 10 communities
- [[dashboardNavbar.tsx]] - degree 22, connects to 8 communities
- [[validateAdminAuth()]] - degree 10, connects to 5 communities
- [[page.tsx_4]] - degree 9, connects to 4 communities