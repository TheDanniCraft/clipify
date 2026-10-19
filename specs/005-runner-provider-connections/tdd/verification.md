# Provider connection verification

The approved mockup is implemented using the real Runner editor, account-wide destination storage and installed HeroUI controls. Test traceability is in test-list.md. No generated Drizzle migration is included.

## Completed scoped evidence

- Provider contracts, provider HTTP behavior, callbacks and isolated PostgreSQL service tests passed 88 cases before the final category-label regression tests were added. The scoped critical coverage check passed: callback 100% lines/branches; other new server modules at least 97% lines and 90% branches. This partial lane is development evidence, not the complete gate.
- Category contract and database save/reopen regression checks passed 63 cases; the category-clear and manual-destination UI whole file passed two cases.
- The authenticated browser journey passed with actual installed components: combined Twitch consent URL, cancelled-consent draft preservation, manual-key save/delete, keyboard tabs/toggle, local title validation, inherited title, per-destination metadata, thumbnail upload/save/reopen, and inline destination-management return with an unsaved draft. Desktop/mobile and both themes were visually inspected. External consent is controlled; no real platform broadcast is claimed.
- Existing affected Runner schedule, admission, continuity, account, destination and heartbeat suites passed; the heartbeat file passed 35 cases and destinations file passed 18 cases after their fixture/mocking corrections.

## Final completion gates

Final source was frozen after the category-label corrections. Complete application coverage, native Runner coverage, production/browser builds and final lint are recorded below when their commands finish. Interrupted earlier runs are not completion evidence.

Pending.

## Operational verification

Configure exact OAuth callbacks and provider credentials described in docs/runner-provider-connections.md. YouTube additionally requires its API/consent configuration and applicable Google verification. Verify real consent, live eligibility, metadata delivery and private Twitch output with authorized test accounts before enabling those integrations publicly. Local fixtures do not establish these external conditions.

Offline cached broadcasts retain the provider's previous details until a connected Runner heartbeat can apply the occurrence's captured settings. Optional metadata failure remains visible and retryable without terminating the broadcast.
