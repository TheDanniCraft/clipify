---
type: community
cohesion: 0.09
members: 38
---

# Twitch Moderator Commands & Controller Queue

**Cohesion:** 0.09 - loosely connected
**Members:** 38 nodes

## Members
- [[AccessSurface()]] - code - src/app/controller/[overlayId]/page.tsx
- [[ControllerActionResult]] - code - src/app/actions/controller.ts
- [[ControllerPage()]] - code - src/app/controller/[overlayId]/page.tsx
- [[ControllerTokenPayload]] - code - src/app/actions/websocket.ts
- [[EventSubNotification]] - code - src/app/lib/types.ts
- [[POST()]] - code - src/app/eventsub/route.ts
- [[QueueItem]] - code - src/app/actions/controller.ts
- [[RewardRedemptionEvent]] - code - src/app/lib/types.ts
- [[RewardStatus]] - code - src/app/lib/types.ts
- [[TwitchMessage]] - code - src/app/lib/types.ts
- [[addToClipQueue()]] - code - src/app/actions/database.ts
- [[addToModQueue()]] - code - src/app/actions/database.ts
- [[broadcastToClients()]] - code - src/app/actions/websocket.ts
- [[controller.ts]] - code - src/app/actions/controller.ts
- [[getControllerQueuesAction()]] - code - src/app/actions/controller.ts
- [[getOverlayByRewardId()]] - code - src/app/actions/database.ts
- [[getOverlayOwnerPlanPublic()]] - code - src/app/actions/database.ts
- [[getOverlayWithEditAccess()]] - code - src/app/actions/database.ts
- [[getQueueClip()]] - code - src/app/actions/controller.ts
- [[getRequiredHeaders()]] - code - src/app/eventsub/route.ts
- [[getTwitchClip()]] - code - src/app/actions/twitch.ts
- [[handleClip()]] - code - src/app/actions/twitch.ts
- [[handleMessage()]] - code - src/app/actions/websocket.ts
- [[handleNotification()]] - code - src/app/eventsub/route.ts
- [[handleRewardRedemption()]] - code - src/app/eventsub/route.ts
- [[isMod()]] - code - src/app/actions/commands.ts
- [[isValidSignature()]] - code - src/app/eventsub/route.ts
- [[page.tsx_3]] - code - src/app/controller/[overlayId]/page.tsx
- [[parseEventSub()]] - code - src/app/eventsub/route.ts
- [[parseStoredClip()]] - code - src/app/actions/controller.ts
- [[requireProOverlay()]] - code - src/app/actions/controller.ts
- [[resolveQueueItems()]] - code - src/app/actions/controller.ts
- [[route.ts_4]] - code - src/app/eventsub/route.ts
- [[runControllerAction()]] - code - src/app/actions/controller.ts
- [[sendChatMessage()]] - code - src/app/actions/twitch.ts
- [[sendMessage()]] - code - src/app/actions/websocket.ts
- [[updateRedemptionStatus()]] - code - src/app/actions/twitch.ts
- [[websocket.ts]] - code - src/app/actions/websocket.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Twitch_Moderator_Commands__Controller_Queue
SORT file.name ASC
```

## Connections to other communities
- 32 edges to [[_COMMUNITY_Premium Gating & Chat Commands]]
- 12 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 12 edges to [[_COMMUNITY_Twitch Integration & Cache API]]
- 5 edges to [[_COMMUNITY_Controllerclient Test Suite]]
- 4 edges to [[_COMMUNITY_Overlaysubscribers Logic]]
- 3 edges to [[_COMMUNITY_Overlay Player & Media Components]]
- 2 edges to [[_COMMUNITY_Admin Impersonation View]]
- 1 edge to [[_COMMUNITY_Websocket Test Suite]]
- 1 edge to [[_COMMUNITY_Route Test Suite]]

## Top bridge nodes
- [[websocket.ts]] - degree 17, connects to 5 communities
- [[controller.ts]] - degree 29, connects to 4 communities
- [[route.ts_4]] - degree 25, connects to 4 communities
- [[page.tsx_3]] - degree 10, connects to 4 communities
- [[getOverlayOwnerPlanPublic()]] - degree 7, connects to 2 communities