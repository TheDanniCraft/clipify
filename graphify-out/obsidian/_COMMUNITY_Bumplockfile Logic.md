---
type: community
cohesion: 1.00
members: 2
---

# Bumplockfile Logic

**Cohesion:** 1.00 - tightly connected
**Members:** 2 nodes

## Members
- [[Bump Bun Lockfile Workflow]] - code - .github/workflows/bumpLockfile.yaml
- [[Generate Migrations Workflow]] - code - .github/workflows/migrations.yaml

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Bumplockfile_Logic
SORT file.name ASC
```
