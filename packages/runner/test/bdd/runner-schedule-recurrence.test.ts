import { execFileSync } from "node:child_process";
import { join } from "node:path";

test("BDD-US3-OPT042 / BDD-US3-OPT089: returning offline inside the next weekly occurrence starts its remaining window once without replaying the stopped occurrence", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_WEEKLY_RETURN: "1" } });
	const result = JSON.parse(
		output
			.trim()
			.split("\n")
			.findLast((line) => line.startsWith("{"))!,
	);
	expect(result).toMatchObject({ refreshedBeforeOffline: true, priorStopped: true, priorSuppressed: true, nextOccurrence: { coldProcess: true, priorStopped: true, priorSuppressed: true, cacheRestored: true, outputStarts: 1, activePipelines: 1, remainingWindow: true, state: "active", suppressed: false, encodedOutput: true, realEncoder: true, realCapture: true } });
	expect(result.nextOccurrence.recordGeneration).toBe(result.nextOccurrence.expectedGeneration);
	expect(result.nextOccurrence.reconciliations).toBeGreaterThanOrEqual(3);
}, 70000);
