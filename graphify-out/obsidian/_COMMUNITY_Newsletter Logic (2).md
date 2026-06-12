---
type: community
cohesion: 1.00
members: 2
---

# Newsletter Logic (2)

**Cohesion:** 1.00 - tightly connected
**Members:** 2 nodes

## Members
- [[Newsletter Actions]] - code - app/actions/newsletter.ts
- [[Newsletter Test]] - code - test/app/actions/newsletter.test.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Newsletter_Logic_2
SORT file.name ASC
```
