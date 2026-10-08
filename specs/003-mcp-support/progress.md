# MCP implementation progress

Updated: 2026-10-08. Branch: `feature/mcp-support`.

- Canonical feature: `003-mcp-support`; workflow expansion consolidated into this scope.
- Tasks: **555/569 complete (97.5%, unweighted)**; all 136 workflow expansion, 8 feedback and 4 shared-limiter refinement tasks complete.
- Tools: **66 implemented**, with six optional MCP prompt templates.
- Earlier local quality gates passed; the focused-editing final local coverage and normal publication regression pass. External/historical release obligations remain **14 blocked tasks**.
- Physical runner validation also requires real hardware/credentials.

Use [test-summary.md](test-summary.md) and [blockers.md](blockers.md) for authoritative status. Earlier progress is preserved in [history/core/progress.md](history/core/progress.md).

## Focused editing refinement — local verification complete and published

66 public tools; 18 focused overlay/gallery editing definitions replace two broad updates, and get_overlay_link replaces the old private embed name. Six static MCP prompts and English HeroUI examples are implemented. All configuration fields are assigned exactly once. Native field-isolation/scope/revision tests, capability reporting, SDK prompt discovery, six focused BDD/ATDD scenarios and three real-browser consent/SDK/example journeys pass. Scoped lint/types, production/E2E builds, action manifest and staged migration guard pass. Graphify updated.

Final verification retains the complete run and exact repair evidence. Jest: 4,536 passed and two stale response assertions failed; both targeted repairs pass. Workflow BDD/ATDD: 335 passed and eight stale gallery option assertions failed; the full 37-option rerun passes. Additional coverage checks pass: 40 component/configuration/connection tests and one native missing-playlist check. Current-source counters from all 343 native workflow executions plus the targeted checks pass all 96 strict files and unchanged global/gallery thresholds. Evidence is under test-results/mcp-workflows/focused-*, with coverage/mcp-focused-complete/strict-gate.json and global-gallery-gate.json.

Production source hashes remain unchanged from the successful build. Canonical tasks T563–T569 are complete. The normal hook passed 426 suites / 4,553 tests with 11 existing skips, and the refinement was pushed to draft PR #496 at 609b57c. Earlier consent tasks now use unique T558–T562 IDs; historical IDs remain unchanged. Development schema access still requires Infisical login; real preview/host OAuth acceptance still requires user authorization. No generated migrations, new scopes, dependencies or production feature toggles were added by this refinement. The completed normal publication hook is retained in focused-push-verified.log: 2 skipped suites, 426 passed suites; 11 skipped tests, 4,553 passed tests; 2,436.71 seconds. GitHub CI and actual preview/host authorization are separate evidence.

## Current checkpoint — preview mutation acceptance complete

The user-approved acceptance scope is now Codex-driven preview testing. Native Codex login, 66-tool/six-prompt discovery, approved/unapproved creator access, all 35 disposable overlay/playlist/gallery mutation checks and actual refresh rotation passed. Existing resources were restored. CodeFactor refactoring and its final publication checks are in progress; earlier task counts above describe their historical checkpoint.
