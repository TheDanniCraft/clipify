---
type: community
cohesion: 0.22
members: 15
---

# Commands Logic

**Cohesion:** 0.22 - loosely connected
**Members:** 15 nodes

## Members
- [[Callback Route Test]] - code - test/app/callback/route.test.ts
- [[Controller Client Component]] - code - app/controller/[overlayId]/controllerClient.tsx
- [[Controller Client Test]] - code - test/app/controller/controllerClient.test.tsx
- [[Controller Page Component]] - code - app/controller/[overlayId]/page.tsx
- [[Controller Page Test]] - code - test/app/controller/page.test.tsx
- [[Database Operations Actions]] - code - src/app/actions/database.ts
- [[OAuth Callback Route]] - code - src/app/callback/route.ts
- [[Overlay Player Component]] - code - app/components/overlayPlayer.tsx
- [[Overlay Player Helpers Test]] - code - test/app/components/overlayPlayer.helpers.test.ts
- [[Overlay Player Test]] - code - test/app/components/overlayPlayer.test.tsx
- [[Overlay Player Utilities_1]] - code - app/components/overlayPlayer.utils.ts
- [[Remote Controller Actions]] - code - src/app/actions/controller.ts
- [[Twitch API Actions]] - code - src/app/actions/twitch.ts
- [[Twitch Commands Handler]] - code - src/app/actions/commands.ts
- [[WebSocket Server Actions]] - code - src/app/actions/websocket.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Commands_Logic
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Auth Logic]]
- 4 edges to [[_COMMUNITY_Feedbackwidget Logic (2)]]
- 2 edges to [[_COMMUNITY_Index Logic]]

## Top bridge nodes
- [[Database Operations Actions]] - degree 10, connects to 3 communities
- [[Twitch API Actions]] - degree 8, connects to 3 communities
- [[OAuth Callback Route]] - degree 5, connects to 2 communities
- [[Twitch Commands Handler]] - degree 5, connects to 1 community
- [[Controller Page Component]] - degree 4, connects to 1 community