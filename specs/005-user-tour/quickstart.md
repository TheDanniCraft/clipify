# Validation quickstart

Use an ephemeral PostgreSQL instance on loopback with a dedicated fixture-admin database matching the existing harness (`clipify_mcp_fixture` or guarded CI `clipify_e2e`). Never use production/shared development data. Set `MCP_TEST_DATABASE_URL` to that disposable loopback admin URL. Each user-tour scenario creates and drops its own database and starts/stops its own application server.

1. `bun run test:affected f6efa1c6`
2. `bun run test:e2e:build`
3. `bunx bddgen`
4. `bunx playwright test --project=bdd-chromium .features-gen/bdd/user-tour --workers=1`
5. Run the required lint, formatting, types, standalone build, security and complete merge coverage/Test gates in plan.md.

The guide browser fixture uses local controlled provider credentials, blocks unrelated external browser requests and never calls a real streaming platform. Inspect the floating panel on desktop and 360×640, actual selects/modals, Escape, late clip loading, resource replacement, clipboard denial and failed saves. Snapshot evidence belongs to test-results/browser and playwright-report, not versioned fixture secrets. Verify existing progress is restored paused and replay does not automatically create resources.
