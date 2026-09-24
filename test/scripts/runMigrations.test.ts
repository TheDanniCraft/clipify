/** @jest-environment node */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("container database migrations", () => {
	it("fails clearly when DATABASE_URL is missing", () => {
		const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/run-migrations.mjs")], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: { ...process.env, DATABASE_URL: "" },
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("DATABASE_URL is required to run database migrations");
	});

	it.each(["Dockerfile", "Dockerfile-preview"])("uses the non-interactive-safe migrator in %s", (dockerfile) => {
		const contents = readFileSync(join(process.cwd(), dockerfile), "utf8");

		expect(contents).toContain("node scripts/run-migrations.mjs && node server.js");
		expect(contents).not.toContain("drizzle-kit/bin.cjs migrate");
		expect(contents).not.toContain("sleep infinity");
	});
});
