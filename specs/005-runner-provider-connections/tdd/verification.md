# Provider connection verification

The approved mockup is implemented using the real Runner editor, account-wide destination storage and installed HeroUI controls. Test traceability is in test-list.md. No generated Drizzle migration is included.

## Completed scoped evidence

- Provider contracts, provider HTTP behavior, callbacks and isolated PostgreSQL service tests passed 88 cases before the final category-label regression tests were added. The scoped critical coverage check passed: callback 100% lines/branches; other new server modules at least 97% lines and 90% branches. This partial lane is development evidence, not the complete gate.
- Category contract and database save/reopen regression checks passed 63 cases; the category-clear and manual-destination UI whole file passed two cases.
- The authenticated browser journey passed with actual installed components: combined Twitch consent URL, cancelled-consent draft preservation, manual-key save/delete, keyboard tabs/toggle, local title validation, inherited title, per-destination metadata, thumbnail upload/save/reopen, and inline destination-management return with an unsaved draft. Desktop/mobile and both themes were visually inspected. External consent is controlled; no real platform broadcast is claimed.
- Existing affected Runner schedule, admission, continuity, account, destination and heartbeat suites passed; the heartbeat file passed 35 cases and destinations file passed 18 cases after their fixture/mocking corrections.

## Final completion gates

Final runtime and test source was frozen after the optional-import regression correction and compatibility-test updates. Complete application coverage, native Runner coverage, production/browser builds and final lint are recorded below when their commands finish. Interrupted earlier runs are not completion evidence.

- Production webpack build, TypeScript and standalone dependency verification passed on the corrected source. Server-action manifest check passed. Formatting and the staged migration-policy check passed. Final lint passed with zero errors and five existing warnings.
- Complete native Runner coverage passed: 52 suites, 451 passing tests and the single inherited updater TODO. Coverage was 97.53% lines, 90.41% branches, 95.61% functions and 94.78% statements; configured per-file gates passed. Its execution-input metadata validates the complete inventory and unchanged source fingerprint `586aebc0be1e86210a9a447be995cd7c255ea4991ceec8f4843decff7a024b96`.
- The complete application Jest phase passed 529 suites and 5,907 tests, with two pre-existing skipped suites and 11 skipped cases. The canonical workflow stage passed 430 scenarios and failed four stale media fixtures; its counters were correctly withheld. After correcting their transport boundary and account-wide names, the complete five-scenario media owner passed. Fresh six-lane merged coverage remains pending.
- Seven distinct installed browser journeys passed: the new connection/details journey and six existing Runner editor, cross-computer reuse, setup parity and schedule-history journeys. The unchanged parity scenario needed a rerun after a five-second preview-poll observation timeout. Native cold-resume likewise passed unchanged after the concurrent-build capture timeout; the later complete native gate passed without relaxing assertions or timeouts.
- Normal commit and push hooks passed, including 170 related suites / 2,741 cases (one skipped suite, three skipped cases), five automation/fixture suites / eight cases, and script automation checks. CodeFactor passed on implementation commit `3428f37e`; remaining GitHub checks were queued at that checkpoint. The PR remains draft until the full local gate finishes.

## Operational verification

Configure exact OAuth callbacks and provider credentials described in docs/runner-provider-connections.md. YouTube additionally requires its API/consent configuration and applicable Google verification. Verify real consent, live eligibility, metadata delivery and private Twitch output with authorized test accounts before enabling those integrations publicly. Local fixtures do not establish these external conditions.

Offline cached broadcasts retain the provider's previous details until a connected Runner heartbeat can apply the occurrence's captured settings. Optional metadata failure remains visible and retryable without terminating the broadcast.
