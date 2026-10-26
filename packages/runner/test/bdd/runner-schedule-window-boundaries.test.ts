import { execFileSync } from "node:child_process";
import { join } from "node:path";

test.each(["at_end", "after_end"])(
	"BDD-US3-OPT043 %s: a cold return skips the ended signed occurrence without creating output",
	(boundary) => {
		const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 65000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_EXPIRED_RETURN: boundary } });
		const result = JSON.parse(
			output
				.trim()
				.split("\n")
				.findLast((line) => line.startsWith("{"))!,
		);
		expect(result).toMatchObject({ refreshedBeforeOffline: true, priorStopped: true, priorSuppressed: true, nextOccurrence: { coldProcess: true, cacheRestored: true, outputStarts: 0, activePipelines: 0, state: "stopped", allOutputsClosed: true, skipped: true, boundaryReached: true } });
		expect(result.nextOccurrence.originalEnd).toBe(result.nextOccurrence.expectedEnd);
	},
	70000,
);
