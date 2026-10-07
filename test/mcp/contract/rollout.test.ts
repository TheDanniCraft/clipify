/** @jest-environment node */
import { getMcpConfiguration } from "@/server/mcp/config";
import { runMcpProbe } from "../../support/mcp/probe";
const environment = { NODE_ENV: "test" as const, MCP_ENABLED: "true", NEXT_PUBLIC_BASE_URL: "https://clipify.example", BETTER_AUTH_SECRET: "isolated-rollout-provider-secret-32chars", RATE_LIMIT_HASH_SECRET: "isolated-rollout-ratelimit-secret-32chars" };
describe("TDD-US3-057 typed enabled MCP configuration", () => {
	test.each([
		{ BETTER_AUTH_SECRET: undefined, JWT_SECRET: undefined },
		{ BETTER_AUTH_SECRET: "short" },
		{ RATE_LIMIT_HASH_SECRET: undefined },
		{ RATE_LIMIT_HASH_SECRET: "short" },
		{ MCP_ISSUER: "https://other.example/api/auth" },
		{ MCP_RESOURCE: "https://other.example/mcp" },
		{ NEXT_PUBLIC_BASE_URL: "http://public.example" },
		{ NEXT_PUBLIC_BASE_URL: "https://clipify.example/unsafe-path" },
		{ MCP_ALLOWED_ORIGINS: "https://partner.example/unsafe-path" },
		{ MCP_ALLOWED_ORIGINS: "https://*.partner.example" },
	])("unsafe/unavailable settings %j fail closed", (patch) => {
		expect(getMcpConfiguration({ ...environment, ...patch }).enabled).toBe(false);
	});
	test("canonical HTTPS settings enable MCP", () => {
		expect(getMcpConfiguration(environment).enabled).toBe(true);
	});
	test("legacy auth secret fallback remains supported", () => {
		expect(getMcpConfiguration({ ...environment, BETTER_AUTH_SECRET: undefined, JWT_SECRET: environment.BETTER_AUTH_SECRET }).enabled).toBe(true);
	});
	test("exact approved origins are normalized", () => {
		expect(getMcpConfiguration({ ...environment, MCP_ALLOWED_ORIGINS: "https://partner.example/" }).allowedOrigins).toContain("https://partner.example");
	});
});
describe("TDD-US3-057 actual route rollout/schema readiness", () => {
	test.each(["disabled", "missing-auth", "missing-rate", "bad-origins", "missing-revision", "missing-default", "nullable-revision", "missing-provider", "missing-grants", "unavailable"])("%s stays safely unavailable", (mode) => {
		const r = runMcpProbe("rollout-probe", [mode]);
		expect(r.status).toBe(503);
		expect(r.body).toEqual({ error: "service_unavailable" });
	});
	test("ready schema still requires OAuth", () => {
		expect(runMcpProbe("rollout-probe", ["ready"]).status).toBe(401);
	});
});
