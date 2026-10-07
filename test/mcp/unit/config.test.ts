/** @jest-environment node */
let config: any;
try {
	config = require("@/server/mcp/config");
} catch {}
const trustedEnvironment = {
	NEXT_PUBLIC_BASE_URL: "https://clipify.example",
	BETTER_AUTH_SECRET: "isolated-config-provider-secret-32chars",
	RATE_LIMIT_HASH_SECRET: "isolated-config-ratelimit-secret-32chars",
};

test.each(["not-a-url", "http://remote.example", "https://user:password@client.example", "https://*.client.example", "https://client.example/path", "https://client.example?origin=other", "https://client.example#fragment"])("invalid browser origin %s is invalid", (origin) => {
	const result = config.getMcpConfiguration({ ...trustedEnvironment, MCP_ALLOWED_ORIGINS: origin });
	expect(result.valid).toBe(false);
	expect(result.valid).toBe(false);
});

test("browser origins accept HTTPS and loopback HTTP, normalize and deduplicate", () => {
	const result = config.getMcpConfiguration({
		...trustedEnvironment,
		MCP_ALLOWED_ORIGINS: " https://clipify.example/, https://client.example:443/, http://localhost:3107, http://127.0.0.1:3107, http://[::1]:3107, https://client.example, ,",
	});
	expect(result.valid).toBe(true);
	expect(result.allowedOrigins).toEqual(["https://clipify.example", "https://client.example", "http://localhost:3107", "http://127.0.0.1:3107", "http://[::1]:3107"]);
});

test.each([{ BETTER_AUTH_SECRET: "short" }, { BETTER_AUTH_SECRET: " ".repeat(40) }, { RATE_LIMIT_HASH_SECRET: "short" }, { RATE_LIMIT_HASH_SECRET: undefined }, { MCP_ISSUER: "https://other.example/api/auth" }, { MCP_RESOURCE: "https://other.example/mcp" }])("MCP fails closed for invalid identity or secrets %p", (overrides) => {
	expect(config.getMcpConfiguration({ ...trustedEnvironment, ...overrides })).toMatchObject({ valid: false });
});

test("canonical identity and legacy auth secret remain supported", () => {
	expect(
		config.getMcpConfiguration({
			...trustedEnvironment,
			BETTER_AUTH_SECRET: undefined,
			JWT_SECRET: trustedEnvironment.BETTER_AUTH_SECRET,
			MCP_ISSUER: "https://clipify.example/api/auth",
			MCP_RESOURCE: "https://clipify.example/mcp",
		}),
	).toMatchObject({ valid: true });
});

test("MCP is available without an activation variable", () => {
	const result = config.getMcpConfiguration({ NEXT_PUBLIC_BASE_URL: "https://clipify.example", BETTER_AUTH_SECRET: "isolated-config-provider-secret-32chars", RATE_LIMIT_HASH_SECRET: "isolated-config-ratelimit-secret-32chars" });
	expect(result.valid).toBe(true);
	expect(result).not.toHaveProperty("enabled");
});
