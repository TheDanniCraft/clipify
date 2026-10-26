import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";

test("BDD-US1-DEC003 fresh offline processes reject saved permits and generations despite wall-clock rollback", () => {
	expect(readFileSync(join(__dirname, "runner-free-lease-replay.feature"), "utf8")).toContain("@BDD-US1-DEC003");
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_FREE_EXECUTION: "1", CLIPIFY_TEST_FREE_EXPIRE: "1", CLIPIFY_TEST_FREE_REPLAY: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.runtimeAccepted).toBe(true);
	expect(result.finalMarkerCaptured).toBe(true);
	expect(result.bytes).toBeGreaterThan(4096);
	expect(result.allOutputsClosed).toBe(true);
	expect(result.replay).toEqual({
		attempts: [
			{ variant: "offline_replay", accepted: false },
			{ variant: "changed_generation", accepted: false },
			{ variant: "terminal_replay", accepted: false },
		],
		encoderOpened: 0,
		engineCreated: 0,
		wallClockRolledBack: true,
	});
}, 65000);
