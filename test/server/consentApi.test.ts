/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("c15t consent API", () => {
	it("shares redacted database credentials between the backend and PostgreSQL driver", () => {
		const result = spawnSync(
			process.execPath,
			[
				"-e",
				`
			const { createRequire } = require("node:module");
			const backend = createRequire(require.resolve("@c15t/backend"));
			const driver = createRequire(require.resolve("@effect/sql-pg"));
			const redacted = backend("effect/Redacted").make("disposable-test-credential");
			require("node:assert/strict").equal(driver("effect/Redacted").value(redacted), "disposable-test-credential");
		`,
			],
			{ cwd: process.cwd(), encoding: "utf8", timeout: 30_000 },
		);
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
	});
	it("passes the Bun/SQLite integration contract", () => {
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
