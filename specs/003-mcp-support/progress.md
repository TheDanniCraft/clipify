# MCP implementation progress

Updated: 2026-10-08. Branch: `feature/mcp-support`.

- Canonical feature: `003-mcp-support`; workflow expansion consolidated into this scope.
- Tasks: **554/569 complete (97.4%, unweighted)**; all 136 workflow expansion, 8 feedback and 4 shared-limiter refinement tasks complete.
- Tools: **66 implemented**, with six optional MCP prompt templates.
- Earlier local quality gates passed; the focused-editing final coverage and exact regression repairs pass; normal publication hook is pending. External/historical release obligations remain **14 blocked tasks**.
- Physical runner validation also requires real hardware/credentials.

Use [test-summary.md](test-summary.md) and [blockers.md](blockers.md) for authoritative status. Earlier progress is preserved in [history/core/progress.md](history/core/progress.md).

## Focused editing refinement — local verification complete, publication pending

66 public tools; 18 focused overlay/gallery editing definitions replace two broad updates, and get_overlay_link replaces the old private embed name. Six static MCP prompts and English HeroUI examples are implemented. All configuration fields are assigned exactly once. Native field-isolation/scope/revision tests, capability reporting, SDK prompt discovery, six focused BDD/ATDD scenarios and three real-browser consent/SDK/example journeys pass. Scoped lint/types, production/E2E builds, action manifest and staged migration guard pass. Graphify updated.

Final verification retains the complete run and exact repair evidence. Jest: 4,536 passed and two stale response assertions failed; both targeted repairs pass. Workflow BDD/ATDD: 335 passed and eight stale gallery option assertions failed; the full 37-option rerun passes. Additional coverage checks pass: 40 component/configuration/connection tests and one native missing-playlist check. Current-source counters from all 343 native workflow executions plus the targeted checks pass all 96 strict files and unchanged global/gallery thresholds. Evidence is under test-results/mcp-workflows/focused-*, with coverage/mcp-focused-complete/strict-gate.json and global-gallery-gate.json.

Production source hashes remain unchanged from the successful build. Canonical tasks T563–T568 are complete; T569 awaits publication to the existing draft PR. Earlier consent tasks now use unique T558–T562 IDs; historical IDs remain unchanged. Development schema access still requires Infisical login; real preview/host OAuth acceptance still requires user authorization. No generated migrations, new scopes, dependencies or production feature toggles were added by this refinement. The normal pre-push full regression will verify the final committed tests; its actual result belongs in the PR publication checkpoint.
