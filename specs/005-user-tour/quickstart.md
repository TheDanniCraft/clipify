# Verification quickstart

Use a disposable PostgreSQL instance on loopback, never production or shared development data. Set `MCP_TEST_DATABASE_URL` to its fixture-admin database (`clipify_mcp_fixture` or guarded CI `clipify_e2e`). Each database integration case and browser example creates/drops its own database; browser examples also own an application server.

1. `bun run test:affected 9da61135`
2. `bun run test:e2e:build`
3. `bunx bddgen`
4. `bunx playwright test --project=bdd-chromium .features-gen/bdd/user-tour --workers=2`
5. Run lint, feature-owned formatting, types, standalone build and the complete merge coverage/Test/security gates.

Verify ring placement without moving native feedback/chat; one expanded section; portal skip confirmation and cancellation; no status clutter; actual app navigation and creation replay; account persistence after browser clearing; existing-user suppression; real selects, expected dialogs, copy denial and failed saves. Review desktop and 360×640 screenshots. Raw browser artifacts belong under ignored test-results/browser and playwright-report.

The shared database lane owns `test/mcp/integration/user-tour-progress.test.ts`, including concurrent updates, fresh reads, isolation and account-deletion cascade. Existing fixture-template optimization preserves case-owned databases and cleans job-owned templates. No application migration generation or shared-data fixtures.
