---
type: community
cohesion: 0.10
members: 22
---

# Check Server Action Manifest Logic

**Cohesion:** 0.10 - loosely connected
**Members:** 22 nodes

## Members
- [[0016_snapshot.json]] - code - drizzle/meta/0016_snapshot.json
- [[0017_snapshot.json]] - code - drizzle/meta/0017_snapshot.json
- [[Drizzle Meta Journal]] - document - drizzle/meta/_journal.json
- [[candidateFiles]] - code - scripts/check-server-action-manifest.mjs
- [[check-server-action-manifest.mjs]] - code - scripts/check-server-action-manifest.mjs
- [[collectFiles()]] - code - scripts/check-server-action-manifest.mjs
- [[dialect_16]] - code - drizzle/meta/0016_snapshot.json
- [[dialect_17]] - code - drizzle/meta/0017_snapshot.json
- [[forbiddenPatterns]] - code - scripts/check-server-action-manifest.mjs
- [[id_32]] - code - drizzle/meta/0016_snapshot.json
- [[id_34]] - code - drizzle/meta/0017_snapshot.json
- [[isActionManifest()]] - code - scripts/check-server-action-manifest.mjs
- [[prevId_16]] - code - drizzle/meta/0016_snapshot.json
- [[prevId_17]] - code - drizzle/meta/0017_snapshot.json
- [[root_1]] - code - scripts/check-server-action-manifest.mjs
- [[scriptsmigrateTokens.ts]] - code - scripts/migrateTokens.ts
- [[serverDir]] - code - scripts/check-server-action-manifest.mjs
- [[srcappactionsadminView.ts]] - code - src/app/actions/adminView.ts
- [[srcapplibtokenCrypto.ts]] - code - src/app/lib/tokenCrypto.ts
- [[version_17]] - code - drizzle/meta/0016_snapshot.json
- [[version_18]] - code - drizzle/meta/0017_snapshot.json
- [[violations]] - code - scripts/check-server-action-manifest.mjs

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Check_Server_Action_Manifest_Logic
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_User Authentication & Database Client]]
- 1 edge to [[_COMMUNITY_Drizzle Schema Snapshot 0016 (9)]]
- 1 edge to [[_COMMUNITY_Drizzle Schema Snapshot 0017 (10)]]
- 1 edge to [[_COMMUNITY_Admin Impersonation View]]

## Top bridge nodes
- [[srcappactionsadminView.ts]] - degree 5, connects to 2 communities
- [[0017_snapshot.json]] - degree 9, connects to 1 community
- [[0016_snapshot.json]] - degree 7, connects to 1 community