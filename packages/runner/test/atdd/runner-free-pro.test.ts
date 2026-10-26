import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";

test("ATDD-US3-SC003 / BDD-US3-FR013 / BDD-US3-OPT040: the actual CLI watchdog starts cached real media within thirty seconds and drains its final frame", () => {
	expect(readFileSync(join(__dirname, "runner-free-pro.feature"), "utf8")).toContain("@ATDD-US3-SC003");
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_SCHEDULE_WATCHDOG: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ realWatchdog: true, cacheStored: true, cacheRestored: true, rejectedBeforeStart: true, runtimeAccepted: true, runtimeExpired: true, stoppedDuringClip: true, clipCompleted: true, finalMarkerCaptured: true, encodedFinalFrame: true, nextClipStarted: false, allOutputsClosed: true, playbackOutcome: "clip_completed" });
	expect(result.startDelayMs).toBeGreaterThanOrEqual(0);
	expect(result.startDelayMs).toBeLessThanOrEqual(30000);
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);
