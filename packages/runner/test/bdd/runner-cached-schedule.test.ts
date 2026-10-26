import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";

test("BDD-US3-FR012: protected cached authority starts real local media offline and drains the complete clip at its original end", () => {
	expect(readFileSync(join(__dirname, "runner-free-pro.feature"), "utf8")).toContain("@BDD-US3-FR012");
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_CACHED_SCHEDULE: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result).toMatchObject({ cacheStored: true, cacheRestored: true, rejectedBeforeStart: true, runtimeAccepted: true, runtimeExpired: true, stoppedDuringClip: true, clipCompleted: true, finalMarkerCaptured: true, encodedFinalFrame: true, nextClipStarted: false, allOutputsClosed: true });
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);
