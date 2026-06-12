---
type: community
cohesion: 0.33
members: 6
---

# HeroUI Snippet Migration

**Cohesion:** 0.33 - loosely connected
**Members:** 6 nodes

## Members
- [[Snippet Component Removal]] - rationale - .heroui-docs/migration/(components)/snippet.mdx
- [[Snippet Migration Guide]] - document - .heroui-docs/migration/(components)/snippet.mdx
- [[Spacer Component Removal]] - rationale - .heroui-docs/migration/(components)/spacer.mdx
- [[Spacer Migration Guide]] - document - .heroui-docs/migration/(components)/spacer.mdx
- [[User Component Removal]] - rationale - .heroui-docs/migration/(components)/user.mdx
- [[User Migration Guide]] - document - .heroui-docs/migration/(components)/user.mdx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/HeroUI_Snippet_Migration
SORT file.name ASC
```
