import { execFileSync } from "node:child_process";
import { join } from "node:path";

test("BDD-US3-FR014 / BDD-US3-OPT048: an adjacent different target waits for the first real clip before opening its output", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_HANDOFF: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, cacheRestored: true, runtimeExpired: true, clipCompleted: true, encodedFinalFrame: true, nextExecutionBeforeClipEnd: false, nextOutputOpened: true, nextOutputBeforeClipEnd: false, allOutputsClosed: true });
}, 70000);

test("BDD-US3-OPT049: an adjacent event whose window expires during clip completion is never activated", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_HANDOFF_EXPIRED: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, runtimeExpired: true, clipCompleted: true, encodedFinalFrame: true, nextExecutionBeforeClipEnd: false, nextOutputOpened: false, nextOccurrenceClosedUnused: true, allOutputsClosed: true });
}, 70000);

test("BDD-US3-OPT046 / BDD-US3-DEC010: matching cached windows cross Sunday midnight without replacing capture or encoder", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 70000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_CONTINUITY: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ realWatchdog: true, boundaryUtc: "2027-01-04T00:00:00.000Z", cacheStored: true, cacheRestored: true, originalEngineContinued: true, sameEncoder: true, outputStarts: 1, advancedOriginalPlayback: true, originalOccurrenceStillOpen: true });
}, 75000);

test("BDD-US3-OPT047: a different-source successor loads its own overlay only after the previous clip and outputs close", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_SOURCE_HANDOFF: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, cacheRestored: true, runtimeExpired: true, clipCompleted: true, encodedFinalFrame: true, nextExecutionBeforeClipEnd: false, nextOutputOpened: true, nextOutputBeforeClipEnd: false, nextSourceLoaded: true, allOutputsClosed: true });
}, 70000);
