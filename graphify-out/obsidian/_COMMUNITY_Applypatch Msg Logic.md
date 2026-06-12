---
type: community
cohesion: 0.29
members: 7
---

# Applypatch Msg Logic

**Cohesion:** 0.29 - loosely connected
**Members:** 7 nodes

## Members
- [[Husky Deprecated Script]] - code - .husky/_/husky.sh
- [[Husky Hook Invocation Helper]] - code - .husky/_/h
- [[Husky applypatch-msg Hook Wrapper]] - code - .husky/_/applypatch-msg
- [[Husky commit-msg Hook Wrapper]] - code - .husky/_/commit-msg
- [[Husky post-applypatch Hook Wrapper]] - code - .husky/_/post-applypatch
- [[Husky post-checkout Hook Wrapper]] - code - .husky/_/post-checkout
- [[Husky post-commit Hook Wrapper]] - code - .husky/_/post-commit

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Applypatch_Msg_Logic
SORT file.name ASC
```
