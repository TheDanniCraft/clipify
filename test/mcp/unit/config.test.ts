/** @jest-environment node */
let config: any;
try {
	config = require("@/server/mcp/config");
} catch {}
test.each([undefined, "false", "1", "TRUE", "true"])("TDD-US1-001 MCP rollout flag %s is explicit", (value) => {
	expect(config?.getMcpConfiguration).toEqual(expect.any(Function));
	const result = config.getMcpConfiguration({ MCP_ENABLED: value, NEXT_PUBLIC_BASE_URL: "https://clipify.example", BETTER_AUTH_SECRET: "isolated-config-provider-secret-32chars", RATE_LIMIT_HASH_SECRET: "isolated-config-ratelimit-secret-32chars" });
	expect(result.enabled).toBe(value === "true");
	expect(result.resource).toBe("https://clipify.example/mcp");
	expect(result.issuer).toBe("https://clipify.example/api/auth");
});

const enabledEnvironment = {
	MCP_ENABLED: "true",
	NEXT_PUBLIC_BASE_URL: "https://clipify.example",
	BETTER_AUTH_SECRET: "isolated-config-provider-secret-32chars",
	RATE_LIMIT_HASH_SECRET: "isolated-config-ratelimit-secret-32chars",
};

test.each(["not-a-url", "http://remote.example", "https://user:password@client.example", "https://*.client.example", "https://client.example/path", "https://client.example?origin=other", "https://client.example#fragment"])("invalid browser origin %s disables MCP", (origin) => {
	const result = config.getMcpConfiguration({ ...enabledEnvironment, MCP_ALLOWED_ORIGINS: origin });
	expect(result.valid).toBe(false);
	expect(result.enabled).toBe(false);
});

test("browser origins accept HTTPS and loopback HTTP, normalize and deduplicate", () => {
	const result = config.getMcpConfiguration({
		...enabledEnvironment,
		MCP_ALLOWED_ORIGINS: " https://clipify.example/, https://client.example:443/, http://localhost:3107, http://127.0.0.1:3107, http://[::1]:3107, https://client.example, ,",
	});
	expect(result.enabled).toBe(true);
	expect(result.allowedOrigins).toEqual(["https://clipify.example", "https://client.example", "http://localhost:3107", "http://127.0.0.1:3107", "http://[::1]:3107"]);
});

test.each([{ BETTER_AUTH_SECRET: "short" }, { BETTER_AUTH_SECRET: " ".repeat(40) }, { RATE_LIMIT_HASH_SECRET: "short" }, { RATE_LIMIT_HASH_SECRET: undefined }, { MCP_ISSUER: "https://other.example/api/auth" }, { MCP_RESOURCE: "https://other.example/mcp" }])("enabled MCP fails closed for invalid identity or secrets %p", (overrides) => {
	expect(config.getMcpConfiguration({ ...enabledEnvironment, ...overrides })).toMatchObject({ valid: false, enabled: false });
});

test("canonical identity and legacy auth secret remain supported", () => {
	expect(
		config.getMcpConfiguration({
			...enabledEnvironment,
			BETTER_AUTH_SECRET: undefined,
			JWT_SECRET: enabledEnvironment.BETTER_AUTH_SECRET,
			MCP_ISSUER: "https://clipify.example/api/auth",
			MCP_RESOURCE: "https://clipify.example/mcp",
		}),
	).toMatchObject({ valid: true, enabled: true });
});
