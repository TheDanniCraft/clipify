---
type: community
cohesion: 0.20
members: 10
---

# Websocket Test Suite

**Cohesion:** 0.20 - loosely connected
**Members:** 10 nodes

## Members
- [[addSubscriber]] - code - test/app/actions/websocket.test.ts
- [[createClient()]] - code - test/app/actions/websocket.test.ts
- [[getOverlayBySecret_1]] - code - test/app/actions/websocket.test.ts
- [[getOverlayOwnerPlanPublic_1]] - code - test/app/actions/websocket.test.ts
- [[getOverlayPublic_1]] - code - test/app/actions/websocket.test.ts
- [[jwtVerify]] - code - test/app/actions/websocket.test.ts
- [[loadWebsocketActions()]] - code - test/app/actions/websocket.test.ts
- [[overlaySubscribers]] - code - test/app/actions/websocket.test.ts
- [[ownerSubscribers]] - code - test/app/actions/websocket.test.ts
- [[websocket.test.ts]] - code - test/app/actions/websocket.test.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Websocket_Test_Suite
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 1 edge to [[_COMMUNITY_Twitch Moderator Commands & Controller Queue]]

## Top bridge nodes
- [[websocket.test.ts]] - degree 11, connects to 1 community
- [[loadWebsocketActions()]] - degree 2, connects to 1 community