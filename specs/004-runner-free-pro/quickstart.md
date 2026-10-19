# Quickstart Validation: Free Runner and Pro Broadcasting

Use this guide against the implemented feature and disposable local fixtures. Current affected checkpoints are recorded in [test-summary.md](test-summary.md); they do not replace the integrated release gates. A command or expected outcome below is not itself evidence that it passed.

## Prerequisites

- Bun and existing application/package dependencies installed, native prerequisites per `packages/runner/check-native.mjs`.
- Current supported Runner binary with protocol-v2 capabilities and configured public execution-verification keys. Keep signing private keys on the control service; never bake them into a client binary.
- Disposable loopback PostgreSQL fixture runner and existing Playwright isolated app, not Infisical/production state.
- Deterministic fixtures for Free, Pro, scoped Runner grant and expired/revoked access; generated short clips and three local RTMP receivers. YouTube/Twitch provider metadata points to these local receivers in tests.
- Read [control contract](contracts/runner-control.md), [UI/presentation contract](contracts/schedules-and-presentation.md) and [commercial policy](contracts/commercial-access.md).

## Fast behavioral validation

From repo root, execute changed whole files without coverage:

```sh
bun run test --runInBand --runTestsByPath test/app/actions/runner.test.ts test/app/lib/entitlements.test.ts --coverage=false
bun run test --runInBand --runTestsByPath test/server/runner/admission.test.ts --coverage=false
```

From `packages/runner`:

```sh
bun run test --runTestsByPath src/__tests__/schedule.test.ts src/__tests__/output.test.ts --coverage=false
bun run test --runTestsByPath test/bdd/runner-free-pro.test.ts test/atdd/runner-free-pro.test.ts --coverage=false
bun run test --runTestsByPath test/output.integration.test.ts --coverage=false
```

Do not name-filter missing tests into false-green results. Each file must execute its complete expected inventory. Record intended Red before changing production behavior, then Green/refactor in `tdd/cycle-log.md`.

## User journeys and expected outcomes

1. Free registers two devices, manually starts a single-destination clip broadcast. Generated content carries readable attribution, live forwarding and ordinary overlays do not. Second owner-wide start is rejected; month rollover/time spent never stops the first broadcast.
2. Race dashboard/MCP starts from two devices against isolated PostgreSQL. Exactly one Free admission is created. Drop heartbeat while the first still transmits: UI reports uncertain/offline; slot remains occupied. Reconnect and acknowledge actual stop, including via the terminal-only revoked-device credential, before another device starts; alternatively wait for final Free lease expiry, bounded drain and safety margin. Delete/unlink cannot release occupancy immediately.
3. Pro saves YouTube/Twitch/custom RTMP targets and selects all three. All local receivers get the same media. Stop one receiver, observe only its retry status, restart it and verify recovery while others continue. Verify credentials absent from projections/logs.
4. Pro uses Agenda to create/move/resize a weekly event and performs equivalent form/keyboard edits. Reload and verify source, targets, timezone and recurrence. Invalid/overlapping saves preserve old event. Test both DST boundaries and midnight crossing.
5. Run a cached event with temporary control-service outage. It starts within30seconds on awake hardware. At end, playing clip completes with no next clip or checkbox; no-clip ends immediately; stalled media hits watchdog. Adjacent same-target/source events continue; other events wait or skip if expired.
6. Restart during an event and after it ends. First resumes once, second never replays. Manual stop suppresses only that occurrence; pause prevents new scheduled starts while current window finishes.
7. Preview four corners and Pro logo/background/message/next-time standby. Upload invalid assets and verify old appearance persists. Standby does not output outside scheduled windows.
8. Expire Pro/legacy access with several active sessions: saved settings remain, future paid starts stop, generated watermark/baseline standby returns, ongoing sessions finish under the contract. Legacy grants never grant unrelated Pro. New standalone Runner checkout and agency seat increases are rejected while historical records remain readable.
9. Attempt new-policy start with unsupported old binary; expect explicit update-required, not silent missing policy. Existing storage modes/scalar configuration remain readable.

## Browser probe prerequisite

After applying the disposable browser environment from the local testing guide, use a fresh disposable database for each owning browser project/shard, matching the separate PostgreSQL service in each CI matrix job. Never reuse a failed or previous full browser job's database for qualification. Match the owning CI probe setup before running its projects:

```sh
node --input-type=module -e "import { buildMcpCoverageProbes } from './scripts/build-mcp-coverage-probes.mjs'; await buildMcpCoverageProbes({ outputDirectory: 'test-results/mcp/browser-native-probes' });"
export MCP_COVERAGE_PROBE_DIRECTORY="$PWD/test-results/mcp/browser-native-probes"
```

This normal, uninstrumented build matches the CI `Compile native application probes once` step. Missing this setting falls back to on-demand TypeScript loading, which is a different execution input for timing-sensitive probes. Clear browser and probe exports before independent Jest/native runs as documented; reapply them for each browser invocation. Do not increase observation deadlines to compensate for omitted setup.

## Owning scenario and full validation commands

```sh
node scripts/run-coverage-lane.mjs workflows
bun run test:bdd
bun run test:atdd
bun run test:acceptance
bun run test:coverage
bun run test:e2e
bun run app:lint
bun run app:prettier:check
bun run app:typecheck
bun run audit:high
bun run app:build
bun run app:check-action-manifest
bun run test:migration-policy
```

Use complete affected suites and owning browser/native scenarios at completed slices, full gates before merge. CI lane merge remains authoritative for complete evidence; do not duplicate native MCP workflows in browser suites. Runner package also requires `bun run patches:validate`, `node check-native.mjs`, `bun run typecheck`, `bun run test` and complete `bun run test:coverage` from the Runner package (all13 declared sources and complete native inventory), as specified in the plan.

Native executable smoke after building the intended platform artifact:

```sh
bun run runner:build
node scripts/run-runner-self-test.mjs <built-binary-path>
```

Run build matrix/manifest checks through existing Runner native workflow; no generated migration commands. Schema push is only permitted by existing disposable-development or guarded browser-job policy.

## Evidence

Link output to [test-traceability.md](test-traceability.md), [defect-log.md](defect-log.md) and [test-summary.md](test-summary.md). CI coverage/browser raw artifacts retain30days, native matrix7days. An expected Red is TDD evidence; unexpected failure is triaged. Only complete current Green evidence permits a Go recommendation. Keep No-Go while required integrated or platform evidence is missing, even when all primary behaviors pass.

Before release, prepare and execute the authorized [read-only commercial preflight](contracts/commercial-access.md#read-only-release-preflight). Preparing its instructions does not authorize billing changes or mean live history was reviewed.

## Confirmed launch decisions after pricing discussion

Ship Free + Pro at current names and current prices. No Plus/Lite tier, price increase, annual-only product, subscriber price-transition policy or release email is part of this feature. Pro includes all existing paid benefits and the planned advanced Runner benefits. Free hours remain unlimited, with one active broadcast and one destination across multiple registered devices. Local execution still runs on the user's PC.

Update src/app/components/Pricing/pricing-catalog.ts, comparison.tsx and existing pricing cards/setup copy; group Runner and broadcasting alongside existing feature categories rather than adding a tier or an oversized undifferentiated list. Produce a reviewable responsive UI using existing HeroUI styling; a gated HeroUI v2 example is design inspiration, not unavailable source assumed installed. Add feature copy and onboarding/billing consistency, remove new Runner add-on offers, preserve historical IDs/grants. Update src/app/llms.txt/llms.txt and src/app/llms-full.txt/llms-full.txt, verifying served routes/src/app/lib/llmsContent.ts reflect the same plan limits, unlimited hours, local scheduling/connectivity and legacy scope. No email is sent by these tasks.

I1: stable identity, captured active occurrence and server-enforced edit/delete locks; Stop/Resume retains Scheduled mode and original end. U1: renewable Free lease with bounded local drain and terminal-only tombstone ACK. I2: focused native workflow Red/Green without coverage; full workflows coverage only at completion gates under the same owner. A1: measurable fixed translucent watermark and overlay collision handling. A2: multi-day/week schedules, DST-local boundaries and mobile day/editor support. These approved decisions are implemented; consult the registry for each actual owning result and the summary for remaining release gates.

## Calendar review follow-up

Open Schedule from a saved Pro broadcast. Check the grouped Add schedule and Pause/Resume actions, calendar navigation, displayed date, timezone and Day/Week/Month controls on desktop and mobile in both themes. Add a future event, enable All day, and choose the first and last included dates. It should appear as a bar in the all-day strip and span the appropriate month columns. Reopen it with the keyboard and confirm the same inclusive dates. The saved interval ends at midnight after the last included date; daylight-saving days retain their real23/25-hour length.

Repeat with browser locales en-US and de-DE. HeroUI date input order and UI dates should follow that locale, including legal/profile/gallery/settings dates. Watch for hydration errors. Machine/API values stay ISO; no new allDay field is added to the scheduling API.

Schedule history review: open a completed broadcast and a currently active calendar occurrence. Both open Broadcast details; no date/time/source/destination editing or Delete action is offered. Rename and verify that the title changes without any streaming configuration revision change. For a future weekly occurrence, exercise both This occurrence and This and following on edits and deletion; cancellation keeps the draft. Earlier and active occurrences retain their original dates/times/identity. Reopen after an exception and ensure the next future occurrence remains selectable. Review details and scope modals in both themes and at mobile width.

### Runner master-parity check

Use a never-connected disposable Runner: confirm configuration is hidden, all five download/install choices work, advanced token starts masked, reveal/hide/copy are keyboard accessible and clipboard failure can recover. Send a real authenticated heartbeat and confirm configuration appears without a reload. In connected details verify matching architecture update status and video quality. While running, test no frame, failed preview/read retry, actual uploaded frame and offline recovery; raw diagnostic secrets must remain absent. Compare Manual/Scheduled selector widths, equal Schedule/Appearance buttons on desktop and stacked mobile actions. Run `runner-master-parity.spec.ts` with the existing Runner editor, calendar localization and schedule-history browser owners after the documented isolated test setup.
