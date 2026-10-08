/** @jest-environment node */
jest.mock("@/app/lib/baseUrl", () => ({
	...jest.requireActual("@/app/lib/baseUrl"),
	resolveBaseUrl: jest.fn((...args: unknown[]) => jest.requireActual("@/app/lib/baseUrl").resolveBaseUrl(...args)),
}));
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
	const result = config.getMcpConfiguration({ ...trustedEnvironment, NEXT_PUBLIC_BASE_URL: origin });
	expect(result.valid).toBe(false);
	expect(result.valid).toBe(false);
});

test.each(["https://clipify.example/", "http://localhost:3107", "http://127.0.0.1:3107", "http://[::1]:3107"])("canonical origin %s determines all MCP identities", (origin) => {
	const result = config.getMcpConfiguration({ ...trustedEnvironment, NEXT_PUBLIC_BASE_URL: origin });
	expect(result).toMatchObject({ valid: true, origin: new URL(origin).origin, allowedOrigins: [new URL(origin).origin], issuer: `${new URL(origin).origin}/api/auth`, resource: `${new URL(origin).origin}/mcp` });
});

test.each([{ BETTER_AUTH_SECRET: "short" }, { BETTER_AUTH_SECRET: " ".repeat(40) }, { RATE_LIMIT_HASH_SECRET: "short" }, { RATE_LIMIT_HASH_SECRET: undefined }])("MCP fails closed for invalid identity or secrets %p", (overrides) => {
	expect(config.getMcpConfiguration({ ...trustedEnvironment, ...overrides })).toMatchObject({ valid: false });
});

test("canonical identity and legacy auth secret remain supported", () => {
	expect(
		config.getMcpConfiguration({
			...trustedEnvironment,
			BETTER_AUTH_SECRET: undefined,
			JWT_SECRET: trustedEnvironment.BETTER_AUTH_SECRET,
		}),
	).toMatchObject({ valid: true });
});

test("MCP is available without an activation variable", () => {
	const result = config.getMcpConfiguration({ NEXT_PUBLIC_BASE_URL: "https://clipify.example", BETTER_AUTH_SECRET: "isolated-config-provider-secret-32chars", RATE_LIMIT_HASH_SECRET: "isolated-config-ratelimit-secret-32chars" });
	expect(result.valid).toBe(true);
	expect(result).not.toHaveProperty("enabled");
});

test.each(["throws", "malformed"])("origin resolution %s fails closed without exposing a broken identity", (mode) => {
	const resolver = require("@/app/lib/baseUrl").resolveBaseUrl as jest.Mock;
	if (mode === "throws")
		resolver.mockImplementationOnce(() => {
			throw new Error("unavailable origin");
		});
	else resolver.mockReturnValueOnce({ href: "not-a-url" });
	expect(config.getMcpConfiguration(trustedEnvironment)).toMatchObject({ valid: false, origin: "https://clipify.us" });
});
