import { execFileSync } from "node:child_process";
import { join } from "node:path";

test("BDD-US3-EC010 owner Resume: a deliberate signed restart clears the old occurrence Stop durably without extending its original end", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 90000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_OWNER_RESUME: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ originalStopped: true, ownerResumeAccepted: true, resumeCacheAccepted: true, ownerOutputStarts: 2, resumeRecord: { state: "active", revision: 4, occurrence: { explicitResume: true } }, coldRestart: { coldProcess: true, cacheRestored: true, resumeControlRecorded: true, outputStarts: 1, activePipelines: 1, remainingWindow: true, state: "active", suppressed: false, encodedOutput: true, realEncoder: true, realCapture: true } });
	expect(result.resumedEnd).toBe(result.originalEnd);
	expect(result.coldRestart.originalEnd).toBe(result.originalEnd);
	expect(result.coldRestart.recordGeneration).toBe(result.coldRestart.expectedGeneration);
}, 95000);
