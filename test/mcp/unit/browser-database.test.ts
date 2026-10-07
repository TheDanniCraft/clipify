/** @jest-environment node */
const { browserDatabaseUrl, browserProviderEnvironment } = require("../../support/mcp/browser-database.cjs");
const disposable = "postgresql://fixture:fixture@127.0.0.1:54419/mcp_0123456789abcdef0123456789abcdef";
const environment = { APP_ENV: "test", E2E_TEST_MODE: "true", DATABASE_URL: disposable };

test("accepts an explicitly configured isolated local database", () => {
	expect(browserDatabaseUrl(environment)).toBe(disposable);
});
test("prefers the explicit browser database over another database setting", () => {
	expect(browserDatabaseUrl({ ...environment, DATABASE_URL: "postgresql://production.invalid/production", MCP_BROWSER_DATABASE_URL: disposable })).toBe(disposable);
});
test.each([{ APP_ENV: "production" }, { E2E_TEST_MODE: "false" }, { DATABASE_URL: "postgresql://fixture:fixture@production.invalid/mcp_0123456789abcdef0123456789abcdef" }, { DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1/clipify" }, { DATABASE_URL: "postgresql://clipify_e2e:fixture@127.0.0.1/clipify_e2e" }, { DATABASE_URL: "https://127.0.0.1/mcp_0123456789abcdef0123456789abcdef" }, { DATABASE_URL: `${disposable}?host=production.invalid` }, { DATABASE_URL: "invalid" }])(
	"rejects an unsafe fixture context %j",
	(patch) => {
		expect(() => browserDatabaseUrl({ ...environment, ...patch })).toThrow();
	},
);
test("accepts the guarded CI database with its dedicated user", () => {
	expect(browserDatabaseUrl({ ...environment, CI: "true", CLIPIFY_E2E_SCHEMA_PUSH: "1", DATABASE_URL: "postgresql://clipify_e2e:fixture@127.0.0.1/clipify_e2e" })).toContain("/clipify_e2e");
});
test("rejects a CI database with another user", () => {
	expect(() => browserDatabaseUrl({ ...environment, CI: "true", CLIPIFY_E2E_SCHEMA_PUSH: "1", DATABASE_URL: "postgresql://admin:fixture@127.0.0.1/clipify_e2e" })).toThrow();
});

test("ordinary browser runs do not opt into controlled provider behavior", () => {
	expect(browserProviderEnvironment(environment, "--max-old-space-size=2048")).toEqual({});
});
test("opted-in isolated browser runs keep their compiler budget and load the guarded fixture", () => {
	const result = browserProviderEnvironment({ ...environment, MCP_BROWSER_PROVIDER_FIXTURE: "true" }, "--max-old-space-size=2048");
	expect(result.DATABASE_URL).toBe(disposable);
	expect(result.MCP_ENABLED).toBe("true");
	expect(result.NODE_OPTIONS).toMatch(/^--max-old-space-size=2048 --import=file:.*browser-provider-preload\.mjs$/);
});
test("opting into provider fixtures never accepts a persistent database", () => {
	expect(() => browserProviderEnvironment({ ...environment, DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1/clipify", MCP_BROWSER_PROVIDER_FIXTURE: "true" })).toThrow();
});
