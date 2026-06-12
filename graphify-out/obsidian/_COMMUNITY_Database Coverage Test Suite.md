---
type: community
cohesion: 0.09
members: 30
---

# Database Coverage Test Suite

**Cohesion:** 0.09 - loosely connected
**Members:** 30 nodes

## Members
- [[b64urlDecode()]] - code - src/app/lib/tokenCrypto.ts
- [[b64urlEncode()]] - code - src/app/lib/tokenCrypto.ts
- [[database.coverage.test.ts]] - code - test/app/actions/database.coverage.test.ts
- [[dbDelete_1]] - code - test/app/actions/database.coverage.test.ts
- [[dbExecute]] - code - test/app/actions/database.coverage.test.ts
- [[dbInsert_2]] - code - test/app/actions/database.coverage.test.ts
- [[dbSelect_3]] - code - test/app/actions/database.coverage.test.ts
- [[dbUpdate_2]] - code - test/app/actions/database.coverage.test.ts
- [[decryptToken()]] - code - src/app/lib/tokenCrypto.ts
- [[encryptToken()]] - code - src/app/lib/tokenCrypto.ts
- [[getKey()]] - code - src/app/lib/tokenCrypto.ts
- [[loadCrypto()]] - code - test/app/lib/tokenCrypto.test.ts
- [[loadDatabaseActions()_1]] - code - test/app/actions/database.coverage.test.ts
- [[looksEncrypted()]] - code - scripts/migrateTokens.ts
- [[main()]] - code - scripts/migrateTokens.ts
- [[makeDeleteChain()_1]] - code - test/app/actions/database.coverage.test.ts
- [[makeInsertChain()_1]] - code - test/app/actions/database.coverage.test.ts
- [[makeSelectChain()_1]] - code - test/app/actions/database.coverage.test.ts
- [[makeUpdateChain()]] - code - test/app/actions/database.coverage.test.ts
- [[migrateTokens.ts]] - code - scripts/migrateTokens.ts
- [[newsletter]] - code - test/app/actions/database.coverage.test.ts
- [[queueSelectResult()_1]] - code - test/app/actions/database.coverage.test.ts
- [[selectQueue_1]] - code - test/app/actions/database.coverage.test.ts
- [[setValidKey()]] - code - test/app/lib/tokenCrypto.test.ts
- [[tokenCrypto.test.ts]] - code - test/app/lib/tokenCrypto.test.ts
- [[tokenCrypto.ts]] - code - src/app/lib/tokenCrypto.ts
- [[twitch]] - code - test/app/actions/database.coverage.test.ts
- [[twitchAuth]] - code - test/app/actions/database.coverage.test.ts
- [[validateAdminAuth_1]] - code - test/app/actions/database.coverage.test.ts
- [[validateAuth]] - code - test/app/actions/database.coverage.test.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Database_Coverage_Test_Suite
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Admin Impersonation View]]
- 3 edges to [[_COMMUNITY_Premium Gating & Chat Commands]]
- 2 edges to [[_COMMUNITY_Stripe Subscriptions & Campaigns]]

## Top bridge nodes
- [[database.coverage.test.ts]] - degree 24, connects to 2 communities
- [[tokenCrypto.ts]] - degree 9, connects to 1 community
- [[encryptToken()]] - degree 7, connects to 1 community