import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("BDD-US1-FR004: manual stop completes the current real clip without starting its successor", () => {
	const specification = readFileSync(join(__dirname, "runner-free-pro.feature"), "utf8");
	expect(specification).toContain("@BDD-US1-FR004");
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000 });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.stoppedDuringClip).toBe(true);
	expect(result.clipCompleted).toBe(true);
	expect(result.finalMarkerCaptured).toBe(true);
	expect(result.nextClipStarted).toBe(false);
	expect(result.encodedFinalFrame).toBe(true);
	expect(result.allOutputsClosed).toBe(true);
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);

// Existing emergency engine cleanup is a baseline characterization, not an invented Red.
test("BDD-US1-FR004: explicit Stop now closes actual outputs during the playing clip", () => {
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_STOP_NOW: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.stoppedDuringClip).toBe(true);
	expect(result.clipCompleted).toBe(false);
	expect(result.nextClipStarted).toBe(false);
	expect(result.allOutputsClosed).toBe(true);
	expect(result.bytes).toBeGreaterThan(4096);
}, 65000);

test("BDD-US1-FR023: real Free encoded playback remains active across a month and 24 connected hours", () => {
	const specification = readFileSync(join(__dirname, "runner-free-pro.feature"), "utf8");
	expect(specification).toContain("@BDD-US1-FR023");
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_FREE_EXECUTION: "1", CLIPIFY_TEST_UNLIMITED_HOURS: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.runtimeAccepted).toBe(true);
	expect(result.connectedHours).toBeGreaterThanOrEqual(24);
	expect(result.connectedRenewals).toBe(360);
	expect(result.monthBoundaryCrossed).toBe(true);
	expect(result.continuedWithFreshLeases).toBe(true);
	expect(result.clipCompleted).toBe(true);
	expect(result.finalMarkerCaptured).toBe(true);
	expect(result.encodedFinalFrame).toBe(true);
	expect(result.allOutputsClosed).toBe(true);
	expect(result.bytes).toBeGreaterThan(4096);
	expect(output).not.toMatch(/quota|upgrade to continue|streaming time limit/i);
}, 65000);
