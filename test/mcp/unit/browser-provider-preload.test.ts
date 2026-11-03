/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
describe("TDD-SDK-PROVIDER-FIXTURE-001 test provider isolation", () => {
	test("the loopback clip proxy refuses foreign request origins", () => {
		const script = `
			import assert from 'node:assert/strict';
			import http from 'node:http';
			import { syncBuiltinESMExports } from 'node:module';
			let server;
			const createServer = http.createServer;
			http.createServer = (...args) => (server = createServer(...args));
			syncBuiltinESMExports();
			await import('./test/support/mcp/clip-library-provider-preload.mjs');
			const destinations = [];
			globalThis.fetch = async (url) => { destinations.push(String(url)); return new Response('fixture'); };
			const path = '/helix/clips?broadcaster_id=e2e-creator-00000000-0000-4000-8000-000000000001';
			const request = (path) => new Promise((resolve, reject) => {
				http.get({ hostname: '127.0.0.1', port: server.address().port, path, agent: false }, response => {
					response.resume(); response.on('end', () => resolve(response.statusCode));
				}).on('error', reject);
			});
			try {
				assert.equal(await request(path), 200);
				for (const origin of ['https://foreign.example.invalid', '//foreign.example.invalid', 'http://api.twitch.tv', 'https://api.twitch.tv.foreign.example.invalid', 'http://127.0.0.1:1']) {
					assert.equal(await request(origin + path), 404, origin);
				}
				assert.deepEqual(destinations, ['https://api.twitch.tv' + path]);
			} finally { await new Promise(resolve => server.close(resolve)); }
		`;
		const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, APP_ENV: "test", E2E_TEST_MODE: "true", MCP_BROWSER_DATABASE_URL: "postgresql://fixture@127.0.0.1:1/mcp_00000000000000000000000000000000" }, encoding: "utf8", timeout: 10000 });
		if (child.status !== 0) throw new Error(child.stderr || child.error?.message || "Fixture proxy check failed");
	});
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
