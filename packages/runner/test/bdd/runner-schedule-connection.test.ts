import { execFileSync } from "node:child_process";
import { join } from "node:path";

test("BDD-US3-OPT044: a real heartbeat 503 during active cached playback preserves local media and original-end closure", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_CONTROL_FAILURE: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, cacheRestored: true, controlFailureStatus: "retry", controlFailureCalls: 1, liveAfterControlFailure: true, runtimeExpired: true, clipCompleted: true, nextClipStarted: false, encodedFinalFrame: true, allOutputsClosed: true });
}, 70000);
