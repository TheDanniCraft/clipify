# Provider connection verification

The approved real-code Runner mockup is implemented with account-wide destinations and installed HeroUI controls. Criteria traceability is in test-list.md. No generated Drizzle migration is included.

## Final completion evidence

Validated implementation commit: `b8cd3671fd22390824633a7bbac98e3d72c56f46`.

Execution source fingerprint: `16f906faf24cc274e4c36713bb31ef1614c944dc87d3d630b28cde3a314d1108`.

- All six canonical application lanes completed with identical source fingerprints and the same Git tree. The five Jest lanes passed 530 suites and 5,914 tests; the two inherited skipped suites and 11 skipped cases remain unchanged. The workflow owner passed all 434 scenarios.
- The canonical `scripts/merge-test-coverage.mjs` gate passed, including complete inventories, unchanged execution inputs, global/per-file floors, strict Runner critical floors, MCP source coverage and the legacy player gate. Overall coverage: statements 85.52%, branches 80.10%, functions 81.86%, lines 87.88%. `coverage/runner-feature/gate.json` reports `ok: true` for the fingerprint above. These overall percentages do not replace the stricter per-source gates.
- Complete native Runner coverage passed: 52 suites, 451 passing tests and the single inherited updater TODO. Coverage: statements 94.78%, branches 90.41%, functions 95.61%, lines 97.53%. Its complete-inventory execution metadata is valid and matches the same fingerprint.
- Production webpack build, TypeScript and standalone patched-dependency verification passed. Server-action manifest verification passed. Full-project lint passed with zero errors and five existing warnings. Formatting, migration-policy and TypeScript commit hooks passed.
- Seven distinct real installed-component browser journeys passed: connected provider/details, Free editor, Pro editor, missing-source recovery, account-wide cross-computer reuse, first-connection/master setup parity and schedule-history protection. Desktop/mobile and light/dark screenshots were visually inspected. The connection journey covers consent cancellation and draft preservation, manual keys, keyboard navigation, local title validation, inherited metadata, thumbnail persistence and inline destination management without losing a draft.
- Normal commit/push hooks passed on the implementation. GitHub draft build, typecheck, lint, formatting, scoped tests and Runner checks passed. The aggregate Test job deliberately rejects draft-only validation; marking the PR ready triggers the mandatory full CI gate. No merge or deployment is performed by this work.

## Corrections and reruns

Earlier failing or interrupted reports are diagnostic evidence, not completion passes. The cycle log records the optional-import regression, category display/clear regressions, media-fixture compatibility corrections and coverage gaps that were corrected before the final runs.

An initial database-2 run sharing PostgreSQL with other lanes exceeded a default test teardown deadline; its unchanged whole-lane rerun with its own service passed. Final database/workflow lanes used separate disposable loopback services. One OAuth discovery case in the first final database-1 run hit its existing child-process timeout during concurrent startup/build load. After all other heavy jobs completed, its entire 53-file lane passed unchanged with one worker. No assertions, deadlines or coverage thresholds were relaxed, and the failing report was not merged. The final serial timing/race lane also passed all 26 suites / 193 cases.

An earlier browser setup-parity observation timeout and native cold-capture timeout passed on unchanged owning reruns; subsequent complete native coverage passed as recorded above. Mocked component tests and partial diagnostic coverage are not used as browser acceptance or final merged coverage.

## Operational verification

Configure exact callbacks and credentials in docs/runner-provider-connections.md. YouTube additionally requires its API/consent setup and applicable Google verification. Verify real consent, live eligibility, metadata delivery and private Twitch output with authorized test accounts before public enablement. Local controlled provider responses and browser consent interception do not establish those external conditions.

Offline cached broadcasts retain the provider's previous details until a connected Runner heartbeat can apply the occurrence's captured settings. Optional metadata failures remain visible and retryable without terminating the broadcast.

## Download dialog follow-up

Replace the large retry button with an installed HeroUI download link in the fallback sentence. Show a green confirmation icon, “Your download is starting” and the selected platform. The copy acknowledges the requested download without claiming the browser completed it. Preserve the five-second cooldown and installation instructions.

The production browser build/typecheck, scoped lint and formatting passed. The complete existing runner-master-parity browser file passed, including all five platform downloads, disabled countdown, keyboard retry, cooldown reset and four reviewed light/dark desktop/mobile dialog screenshots. This narrow UI follow-up uses its affected browser owner; the complete six-lane evidence above belongs to the explicitly identified implementation commit.

## Scheduled control and editor actions follow-up

Selecting Scheduled opens the agenda immediately for Pro. Free retains the crown and contextual upgrade flow without changing Manual. The Schedule action remains available while configuration is unsaved; activating Scheduled control still requires the explicit configuration save. Appearance and Schedule use transparent installed HeroUI buttons with pencil/calendar icons. Compare Free and Pro is a text link rather than a button.

The complete four-case Runner editor browser file passed with installed components: Free/Pro flows, source recovery and account-wide destination reuse. It verifies the crown, upgrade comparison link, immediate agenda opening, reopening before save, responsive alignment and icons. Light/dark desktop/mobile screenshots were reviewed. The control-selection whole file passed four cases; production browser build/typecheck, scoped lint and formatting passed. An intermediate build had captured the prior tertiary style before its final ghost-style edit; the browser assertion caught that stale build, then the frozen final source was rebuilt and all four journeys passed unchanged.

## Failed heartbeat connection status

The real preview reported PostgreSQL 42703: stream_sessions.test_expires_at does not exist. This is a deployed schema mismatch; applying the branch schema to the isolated preview database is required. No generated migration or remote database mutation is included in this correction.

Independently, the native terminal pinned Connection: Online unconditionally. The existing retry case was changed to require Offline, observed failing on that literal, then passed after the display followed the latest heartbeat result. Initial connection shows Connecting, revoked credentials show Reconnecting, successful heartbeats show Online and failed heartbeats show Offline. Both whole CLI/main and heartbeat-protocol files passed all 19 cases without coverage; native typecheck, scoped lint and formatting passed. This diagnostic correction does not claim to apply the missing preview schema or resolve the deployed 500.
