import { execFileSync } from "node:child_process";
import { join } from "node:path";
test("BDD-US3-OPT046: adjacent events for the same broadcast session retain one real capture and both logical receipts", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 70000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_SAME_SESSION: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, cacheRestored: true, sameSession: true, logicalMembers: 2, originalEngineContinued: true, sameEncoder: true, outputStarts: 1, advancedOriginalPlayback: true, originalOccurrenceStillOpen: true });
}, 75000);
