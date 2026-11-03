# Implementation Validation Guide

Preparation is complete; the user subsequently authorized implementation, commit, push and a draft PR. The pinned reference and v1 defaults are recorded in `spec.md`. Initial inventory test execution is in progress; current evidence and any sequencing deviations are recorded in tdd/cycle-log.md and defect-log.md.

## Setup

1. Read `docs/local-testing.md` in full. Use its disposable PostgreSQL and job-owned `MCP_TEST_TEMPLATE_ID`; reapply its exact environment for each shell invocation. Match owning CI job inputs and versions. Install Chromium and OS dependencies as documented; do not substitute shared credentials.
2. Read installed Next guides for layouts, navigation and route handlers in `node_modules/next/dist/docs/` before code. Read installed HeroUI Pro Sidebar/Command APIs and official examples.
3. Resolve the feature with `python3 .specify/scripts/python/check_prerequisites.py --json --paths-only`; it must resolve `specs/006-clip-library-export`. `.specify/feature.json` is the locator, independent of the delivery branch name `features/clip-export`.
4. Reuse existing session/database fixtures and real deterministic MP4 fixtures. Fixtures cover multiple creators/access paths, zero/partial caches, VOD mappings, DST dates, all export limits and failure classes.

## Inner loop

```sh
bun run test --runInBand --runTestsByPath test/server/creator-clips.test.ts --coverage=false
bun run test --runInBand --runTestsByPath test/server/clip-export.test.ts --coverage=false
bun run test:e2e:build
bunx bddgen
bunx playwright test --project=bdd-chromium .features-gen/bdd/clip-library/us4.feature.spec.js --grep BDD-US4-001 --workers=1
```

Only the initial inventory files/bindings currently exist; materialize each remaining slice before changing its corresponding product behavior. Whole-file Jest commands must be run for the actual touched file, not just a selected passing assertion. Generated Gherkin tests must preserve stable IDs in test titles for grep; always scope the generated clip-library story file before grep; otherwise run that whole story file and record its real command in the registry. Do not pass off missing bindings or absent services as the intended Red.

## Required completion gates

```sh
bun run test:coverage
bun run app:lint
bun run app:prettier:check
bun run app:typecheck
bun run audit:high
bun run test:migration-policy
bun run app:build
bun run test:e2e:build
bunx bddgen
bunx playwright test --project=bdd-chromium --workers=1
```

The complete CI gate also runs all affected existing browser owners, build/package checks and merged coverage owners. Use the browser-tests job build/runtime environment exactly; do not run guarded CI-only schema push locally. Check CI ownership before changing any manifest. Do not repeat successful unchanged checks without a reason.

## Demonstration and assertions

- At390px and1440px in both light/dark themes, open Home/sidebar/search, navigate all permitted resources, use an existing editor bookmark and verify unsaved-change/tour/account flows. Inspect screenshots against established Clipify editor gutters and controls.
- Verify last30 local-day creation window totals/top-five from known fixture IDs; distinguish current lifetime clip views from VOD views or view gains. Open available broadcasts including zero-clip, late-created VOD clip and unavailable VOD cases.
- Apply each filter and both sorts, restore URL, page/select/remove/change scope, preview with and without metadata. No stale creator responses or hidden all-results selection.
- Export1/25/50 small clips and inspect ZIP entry bytes and manifest. Exercise landscape preference and portrait fallback; deny foreign IDs before provider calls; revoke grants during preparation.
- Test partial/all-failed/429/reconnect/oversize/malformed media/timeout/cancel/save-initiation failure. Verify no leaked signed URLs, exact failed-only retry, bounded actual bytes and released Blob/server buffers. Record peak memory on maximum-size fixtures; final archive<=130MiB.
- Record intended Red/Green, coverage source identity, browser evidence and complete gate outcomes in the registry/cycle log; triage unexpected failures in defect log and leave summary No-Go until required evidence is Green.

## Verified local Docker alternative

This workspace used the already-present postgres:18 image rather than host PostgreSQL binaries. After cleanup, recreate an isolated fixture before another test run:

```sh
docker run --detach --rm --name clipify-spec006-pg --label clipify.task=spec006-tdd --publish 127.0.0.1:54419:5432 --env POSTGRES_USER=clipify_mcp --env POSTGRES_DB=clipify_mcp_fixture --env POSTGRES_HOST_AUTH_METHOD=trust postgres:18
docker exec clipify-spec006-pg pg_isready -U clipify_mcp -d clipify_mcp_fixture
```

Use Node24.21.0 on PATH and a fresh job-owned template ID. The documented native/Jest environment and a separately initialized browser database are still required. Do not run multiple browser commands at once on3107. Cleanup your own templates and stop only this task-owned disposable container. System Chromium/FFmpeg prerequisites remain installed; no JavaScript dependency change is needed.
