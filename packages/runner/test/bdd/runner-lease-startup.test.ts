import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";
test("BDD-US1-DEC001: real capture finishing after lease expiry cannot open FFmpeg output", () => {
	expect(readFileSync(join(__dirname, "runner-lease-startup.feature"), "utf8")).toContain("@BDD-US1-DEC001");
	const output = execFileSync(process.execPath, [join(__dirname, "../support/drain-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, CLIPIFY_TEST_FREE_EXECUTION: "1", CLIPIFY_TEST_EXPIRE_DURING_CAPTURE: "1" } });
	const result = JSON.parse(output.trim().split("\n").at(-1)!);
	expect(result.runtimeAccepted).toBe(false);
	expect(result.encoderOpened).toBe(false);
	expect(result.allOutputsClosed).toBe(true);
	expect(result.persistedClosed).toBe(true);
}, 65000);
