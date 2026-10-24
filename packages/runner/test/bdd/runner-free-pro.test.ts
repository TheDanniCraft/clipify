import { execFileSync } from "node:child_process";
import { join } from "node:path";

test("BDD-US2-EC005: unavailable destinations exhaust bounded retries and report failure", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/output-recovery-probe.mjs"), "--all-fail"], { encoding: "utf8", timeout: 40000 });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect({ exhausted: result.exhausted, finalStates: result.finalStates, outputStarts: result.outputStarts }).toEqual({
		exhausted: true,
		finalStates: [
			{ id: "0", state: "failed" },
			{ id: "1", state: "failed" },
		],
		outputStarts: 12,
	});
}, 45000);

test("BDD-US2-OPT092: a recovered real receiver rejoins without restarting the healthy output", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/output-recovery-probe.mjs"), "--recover"], { encoding: "utf8", timeout: 30000 });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.recovered).toBe(true);
	expect(result.healthyContinued).toBe(true);
	expect(result.healthyOutputStarts).toBe(1);
}, 35000);

test("BDD-US2-FR008: a disconnected receiver reports retrying while the healthy destination continues", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/output-recovery-probe.mjs")], { encoding: "utf8", timeout: 30000 });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.healthyContinued).toBe(true);
	expect(result.failedState).toBe("retrying");
	expect(result.healthyState).toBe("streaming");
}, 35000);

function calendarProbe(repeated = false) {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/schedule-calendar-probe.mjs"), ...(repeated ? ["--repeated"] : [])], { encoding: "utf8", timeout: 15000 });
	return JSON.parse(output.trim().split("\n").at(-1)!);
}
test("BDD-US3-EC007: native calendar planner explains a skipped spring gap and retains the following local occurrence", () => {
	const result = calendarProbe();
	expect(result.skipped).toHaveLength(1);
	expect(result.skipped[0].reason).toBe("DST_GAP");
	expect(result.skipped[0].message).toMatch(/does not exist|clock change/i);
	expect(result.occurrences.map((row: { startUtc: string }) => row.startUtc)).toEqual(["2026-04-05T00:30:00.000Z"]);
});
test("BDD-US3-EC008: native calendar planner emits only the first repeated local instant", () => {
	const result = calendarProbe(true);
	expect(result.skipped).toHaveLength(0);
	expect(result.occurrences).toHaveLength(1);
	expect(result.occurrences[0].startUtc).toBe("2026-10-25T00:30:00.000Z");
});

test("BDD-US3-EC009 / BDD-US3-OPT076: stalled real playback closes capture, encoder and browser with playback timeout", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_PLAYBACK_TIMEOUT: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ stoppedDuringClip: true, clipCompleted: false, nextClipStarted: false, allOutputsClosed: true, playbackOutcome: "playback_timeout" });
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);

test("BDD-US3-OPT077: progressing real media closes at the maximum finishing overrun", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_MAXIMUM_OVERRUN: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ clipCompleted: false, nextClipStarted: false, allOutputsClosed: true, playbackOutcome: "playback_timeout" });
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);

test("BDD-US3-OPT038: an in-window next clip starts normally before the signed end requests drain", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_CACHED_SCHEDULE: "1", CLIPIFY_TEST_BEFORE_END_ADVANCE: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.indexAtStop).toBeGreaterThanOrEqual(1);
	expect(result).toMatchObject({ cacheStored: true, runtimeAccepted: true, runtimeExpired: true, clipCompleted: true, encodedFinalFrame: true, nextClipStarted: false, allOutputsClosed: true, playbackOutcome: "clip_completed" });
}, 65000);

test("BDD-US3-OPT039: exact-end real clip completion blocks the next clip before the next native tick", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_EXACT_END: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ clipCompleted: true, encodedFinalFrame: true, nextClipStarted: false, allOutputsClosed: true, playbackOutcome: "clip_completed" });
}, 65000);

test("BDD-US3-OPT041: scheduled standby closes without waiting for an absent clip", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_STANDBY_AT_END: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ standbyAtEnd: true, runtimeAccepted: true, runtimeExpired: true, clipCompleted: false, nextClipStarted: false, allOutputsClosed: true, playbackOutcome: "clip_completed" });
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);
