import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";

test("BDD-US1-DEC001: a valid fresh lease opens actual admitted native output", () => {
	expect(readFileSync(join(__dirname, "runner-free-leases.feature"), "utf8")).toContain("@BDD-US1-DEC001");
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_FREE_EXECUTION: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	if (!result.encodedFinalFrame) console.error("Native final-frame diagnostic", result);
	expect(result.runtimeAccepted).toBe(true);
	expect(result.stoppedDuringClip).toBe(true);
	expect(result.clipCompleted).toBe(true);
	expect(result.finalMarkerCaptured).toBe(true);
	expect(result.encodedFinalFrame).toBe(true);
	expect(result.nextClipStarted).toBe(false);
	expect(result.allOutputsClosed).toBe(true);
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);
