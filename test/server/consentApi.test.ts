/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("c15t consent API", () => {
	it("passes the Bun/PGlite integration contract", () => {
		const result = spawnSync("bun", [join(process.cwd(), "scripts/verify-consent-api.ts")], {
			cwd: process.cwd(),
			encoding: "utf8",
			timeout: 30_000,
		});
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("c15t consent API verified");
	});
});
