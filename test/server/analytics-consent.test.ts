/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

it("checks verified lookup, current grant, rejection, expiry, changed purpose and unavailable authority with the real c15t evaluator", () => {
	const result = spawnSync("bun", [join(process.cwd(), "scripts/verify-analytics-consent.mjs")], { cwd: process.cwd(), encoding: "utf8", timeout: 30000 });
	expect(result.error).toBeUndefined();
	expect(result.stderr).toBe("");
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("Native analytics consent boundaries verified");
});
