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

	it("uses the migration journal for production", () => {
		const contents = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");

		expect(contents).toContain("node scripts/run-migrations.mjs && node server.js");
		expect(contents).not.toContain("drizzle-kit/bin.cjs migrate");
		expect(contents).not.toContain("drizzle-kit/bin.cjs push");
		expect(contents).not.toContain("sleep infinity");
	});

	it("reconciles the schema directly for preview deployments", () => {
		const contents = readFileSync(join(process.cwd(), "Dockerfile-preview"), "utf8");

		expect(contents).toContain("ENV NODE_ENV=production");
		expect(contents).not.toContain("ENV NODE_ENV=development");
		expect(contents).toContain("node node_modules/drizzle-kit/bin.cjs push && node server.js");
		expect(contents).toContain("/app/drizzle.config.ts ./drizzle.config.ts");
		expect(contents).toContain("/app/tsconfig.json ./tsconfig.json");
		expect(contents).toContain("/app/src ./src");
		expect(contents).not.toContain("node scripts/run-migrations.mjs");
		expect(contents).not.toContain("drizzle-kit/bin.cjs migrate");
		expect(contents).not.toContain("sleep infinity");
	});
});
