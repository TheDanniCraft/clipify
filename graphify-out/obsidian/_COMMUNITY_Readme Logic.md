---
type: community
cohesion: 0.40
members: 5
---

# Readme Logic

**Cohesion:** 0.40 - moderately connected
**Members:** 5 nodes

## Members
- [[Clipify Application]] - rationale - README.md
- [[Clipify Pricing Structure]] - rationale - README.md
- [[Clipify Project Documentation]] - document - README.md
- [[Docker Image Build and Push CICD Workflow]] - code - .github/workflows/build.yaml
- [[Docker Multi-architecture Builds]] - rationale - .github/workflows/build.yaml

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Readme_Logic
SORT file.name ASC
```
