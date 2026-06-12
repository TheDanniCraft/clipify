---
type: community
cohesion: 0.20
members: 14
---

# HeroUI Incremental Migration Migration

**Cohesion:** 0.20 - loosely connected
**Members:** 14 nodes

## Members
- [[AGENTS.md Migration Guide]] - document - .heroui-docs/migration/(migration-for-agents)/agents-md.mdx
- [[AGENTS.md and CLAUDE.md Indexing]] - rationale - .heroui-docs/migration/(migration-for-agents)/agents-md.mdx
- [[Agent Migration Guide - Full Migration]] - document - .heroui-docs/migration/(workflows)/agent-guide-full.mdx
- [[Agent Migration Guide - Incremental Migration]] - document - .heroui-docs/migration/(workflows)/agent-guide-incremental.mdx
- [[Agent Skills Migration Guide]] - document - .heroui-docs/migration/(migration-for-agents)/agent-skills.mdx
- [[Component Packages Strategy (Strategy B)]] - rationale - .heroui-docs/migration/(workflows)/incremental-migration.mdx
- [[Full Migration Workflow]] - rationale - .heroui-docs/migration/(workflows)/full-migration.mdx
- [[Full Migration Workflow Guide]] - document - .heroui-docs/migration/(workflows)/full-migration.mdx
- [[Incremental Coexistence Migration]] - rationale - .heroui-docs/migration/(workflows)/incremental-migration.mdx
- [[Incremental Migration Workflow Guide]] - document - .heroui-docs/migration/(workflows)/incremental-migration.mdx
- [[MCP Server Migration Guide]] - document - .heroui-docs/migration/(migration-for-agents)/mcp-server.mdx
- [[Migration Agent Skills]] - rationale - .heroui-docs/migration/(migration-for-agents)/agent-skills.mdx
- [[Migration Model Context Protocol Server]] - rationale - .heroui-docs/migration/(migration-for-agents)/mcp-server.mdx
- [[pnpm Aliases Strategy (Strategy A)]] - rationale - .heroui-docs/migration/(workflows)/incremental-migration.mdx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/HeroUI_Incremental_Migration_Migration
SORT file.name ASC
```
