# Red–Green–Refactor Evidence

The entries below record preparation, intended failures and subsequent implementation checks.

## State slice

Red: `bun run test --runInBand test/app/lib/userTour.test.ts` failed because `src/app/lib/userTour` did not exist (1 suite failed). Initial sandbox execution could not initialize TypeScript; rerun with execution permissions reached the intended missing-module red. Green candidate: 16/17 passed; corrected resume fixture to include the existing overlay required for pointer index 1 (without an overlay only the create pointer exists).

State green: 17/17. UI red: missing provider/spotlight module. UI green: 5/5 provider, 3/3 spotlight tests. Editor integration red: 3 intended assertions failed, 229 existing tests passed, before wiring successful save reports. First integration green attempt exposed a JSX ternary syntax mistake; corrected before rerunning.

Recovery red: state/provider suites failed on missing playlist prerequisite, missing guide_paused event and missing navigation after delayed existing-resource discovery (24/25 planned assertions exercised). Added scoped prerequisite routing, safe pause metadata and discovery navigation without mutations.

Playlist replay red: new Keep saved playlist test failed while 44 existing tests passed. Added explicit acknowledgement of saved state without mutation, and moved the order spotlight to the real draggable list rather than its instructional caption. Recovery suite green: 25/25 state/provider assertions.

Browser verification: BDD-TOUR-US1-001 and BDD-TOUR-US1-002 passed (launcher unobstructed; actual first overlay created/named/saved). BDD-TOUR-US1-014 exposed native Escape closing the spotlight without pausing state. Adapter red reproduced this (1 failed, 3 passed), then added explicit Escape capture and close-button pause ownership. Playlist replay green: 45/45 tests.

State selection red: explicit owned resource retained stale ID; implemented explicit page selection, clearing copy confirmation when selection changes. Missing-resource red: reducer and provider lacked replacement/reset; implemented explicit Choose another resource controls, retaining completed tasks and never creating resources. Delayed-anchor/modal red: 2 adapter assertions failed (4 passed); added targeted attribute observation and application-dialog detection excluding Driver.

Appearance completion red: the existing volume-boundary cases showed audio-only saves incorrectly reporting a visible customization (2 failed, 89 passed). The report now checks a changed appearance field in both the draft and persisted result, excluding audio-only and revision-only changes.

Final green: 16 affected suites / 430 tests. Browser sweep 24/26; the remaining playlist cases passed 2/2 after waiting for real spotlight readiness and persisted completion rather than an earlier success toast. Final keyboard, customized-theme and unchanged-theme follow-up 3/3 passed. E2E and standalone builds pass. Full merge coverage/Test remains pending; dependency audit reproduces three existing baseline advisories.
