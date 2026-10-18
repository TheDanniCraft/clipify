import { execFileSync } from "node:child_process";
import { join } from "node:path";

test("BDD-US3-EC010: manual Stop closes the current clip and the real cached watchdog does not restart its occurrence", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_MANUAL_STOP: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, cacheRestored: true, manualStopAccepted: true, manualSuppressed: true, manualClosed: true, stoppedInsideWindow: true, restartedAfterStop: false, outputStarts: 1, clipCompleted: true, encodedFinalFrame: true, allOutputsClosed: true });
}, 70000);

test("BDD-US3-EC010: a signed empty Pause snapshot preserves the current window but removes a cached adjacent continuation", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_PAUSE: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, cacheRestored: true, pauseAccepted: true, pausedCacheEmpty: true, currentRemainedLiveBeforeEnd: true, futureMemberActivated: false, runtimeExpired: true, clipCompleted: true, nextClipStarted: false, encodedFinalFrame: true, allOutputsClosed: true });
}, 70000);

test("BDD-US3-EC010 exact boundary: the renderer cannot queue a new clip after Pause removes future authority while the native timer is held", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_PAUSE_EXACT: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ pauseAccepted: true, pausedCacheEmpty: true, currentRemainedLiveBeforeEnd: true, futureMemberActivated: false, nextClipStarted: false, clipCompleted: true, encodedFinalFrame: true, allOutputsClosed: true });
}, 70000);

test("BDD-US3-EC010 stalled control: an unresponsive deadline RPC cannot block current-clip closure at the original end", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_PAUSE_STALLED: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ pauseAccepted: true, pausedCacheEmpty: true, deadlineUpdateHeld: true, currentRemainedLiveBeforeEnd: true, futureMemberActivated: false, runtimeExpired: true, clipCompleted: true, nextClipStarted: false, encodedFinalFrame: true, allOutputsClosed: true });
}, 70000);

test("BDD-US3-EC010 unseen admission: a newer signed cache cannot bypass manual Stop by changing admission and generation", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_STOP_ALIAS: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ aliasCacheAccepted: true, manualStopAccepted: true, manualSuppressed: true, manualClosed: true, stoppedInsideWindow: true, restartedAfterStop: false, outputStarts: 1, clipCompleted: true, encodedFinalFrame: true, allOutputsClosed: true });
}, 70000);

test("BDD-US3-FR015 / BDD-US3-OPT045: a cold Runner process restores its active signed window once without extending its captured end", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_COLD_RESTART: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ initialCapture: true, realWatchdog: true, cacheStored: true, coldRestart: { coldProcess: true, cacheRestored: true, outputStarts: 1, activePipelines: 1, remainingWindow: true, state: "active", suppressed: false, encodedOutput: true, realEncoder: true, realCapture: true } });
	expect(result.coldRestart.recordGeneration).toBe(result.coldRestart.expectedGeneration);
	expect(result.coldRestart.reconciliations).toBeGreaterThanOrEqual(3);
}, 70000);
