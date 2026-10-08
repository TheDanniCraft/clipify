/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
describe("TDD-SDK-PROVIDER-FIXTURE-001 test provider isolation", () => {
	test.each([
		{ APP_ENV: "production", E2E_TEST_MODE: "true", DATABASE_URL: "postgresql://fixture@127.0.0.1:54419/mcp_abcdef" },
		{ APP_ENV: "test", E2E_TEST_MODE: "false", DATABASE_URL: "postgresql://fixture@127.0.0.1:54419/mcp_abcdef" },
		{ APP_ENV: "test", E2E_TEST_MODE: "true", DATABASE_URL: "postgresql://fixture@external.example.invalid:5432/mcp_abcdef" },
		{ APP_ENV: "test", E2E_TEST_MODE: "true", DATABASE_URL: "postgresql://fixture@127.0.0.1:54419/persistent" },
	])("refuses metadata substitution outside isolated test environment %#", (environment) => {
		const child = spawnSync(process.execPath, ["--import", resolve("test/support/mcp/browser-provider-preload.mjs"), "-e", "process.exit(0)"], { env: { ...process.env, ...environment }, encoding: "utf8", timeout: 10000 });
		expect(child.status).toBe(1);
		expect(child.stderr).toMatch(/Error: MCP browser fixtures (?:require|reject)/);
	});
});
