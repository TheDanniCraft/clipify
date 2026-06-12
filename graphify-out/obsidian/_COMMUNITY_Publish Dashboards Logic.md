---
type: community
cohesion: 1.00
members: 1
---

# Publish Dashboards Logic

**Cohesion:** 1.00 - tightly connected
**Members:** 1 nodes

## Members
- [[Publish Dashboards Workflow]] - code - .github/workflows/publish-dashboards.yml

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Publish_Dashboards_Logic
SORT file.name ASC
```
