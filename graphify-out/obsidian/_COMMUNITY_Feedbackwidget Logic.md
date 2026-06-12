---
type: community
cohesion: 0.11
members: 24
---

# Feedbackwidget Logic

**Cohesion:** 0.11 - loosely connected
**Members:** 24 nodes

## Members
- [[.constructor()]] - code - src/app/lib/types.ts
- [[Feedback]] - code - src/app/lib/types.ts
- [[FeedbackRatingItem]] - code - src/app/components/feedbackWidget/itemRating.tsx
- [[FeedbackRatingItemProps]] - code - src/app/components/feedbackWidget/itemRating.tsx
- [[FeedbackWidget()]] - code - src/app/components/feedbackWidget/index.tsx
- [[FiderPost]] - code - src/app/actions/feedbackWidget.ts
- [[FiderUser]] - code - src/app/actions/feedbackWidget.ts
- [[RateLimitError]] - code - src/app/lib/types.ts
- [[RatingValueEnum]] - code - src/app/lib/types.ts
- [[axiosIsAxiosError]] - code - test/app/actions/feedbackWidget.test.ts
- [[axiosPost]] - code - test/app/actions/feedbackWidget.test.ts
- [[createFeedback()]] - code - src/app/actions/feedbackWidget.ts
- [[createUser()]] - code - src/app/actions/feedbackWidget.ts
- [[emojis]] - code - src/app/components/feedbackWidget/itemRating.tsx
- [[feedbackTypeTagMap]] - code - src/app/actions/feedbackWidget.ts
- [[feedbackWidget.test.ts]] - code - test/app/actions/feedbackWidget.test.ts
- [[feedbackWidget.ts]] - code - src/app/actions/feedbackWidget.ts
- [[index.tsx_1]] - code - src/app/components/feedbackWidget/index.tsx
- [[itemRating.tsx]] - code - src/app/components/feedbackWidget/itemRating.tsx
- [[loadFeedbackWidget()]] - code - test/app/actions/feedbackWidget.test.ts
- [[submitFeedback()]] - code - src/app/actions/feedbackWidget.ts
- [[tagPost()]] - code - src/app/actions/feedbackWidget.ts
- [[tryRateLimit]] - code - test/app/actions/feedbackWidget.test.ts
- [[validateAuth_8]] - code - test/app/actions/feedbackWidget.test.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Feedbackwidget_Logic
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 3 edges to [[_COMMUNITY_Admin Impersonation View]]
- 3 edges to [[_COMMUNITY_Ratelimit Test Suite]]
- 2 edges to [[_COMMUNITY_Newsletter Logic]]
- 1 edge to [[_COMMUNITY_Twitch Integration & Cache API]]

## Top bridge nodes
- [[index.tsx_1]] - degree 12, connects to 5 communities
- [[feedbackWidget.ts]] - degree 16, connects to 3 communities
- [[RateLimitError]] - degree 5, connects to 2 communities
- [[itemRating.tsx]] - degree 6, connects to 1 community
- [[RatingValueEnum]] - degree 3, connects to 1 community