/** @jest-environment node */
import { getMcpConfiguration } from "@/server/mcp/config";
import { runMcpProbe } from "../../support/mcp/probe";
const environment = { NODE_ENV: "test" as const, NEXT_PUBLIC_BASE_URL: "https://clipify.example", BETTER_AUTH_SECRET: "isolated-rollout-provider-secret-32chars", RATE_LIMIT_HASH_SECRET: "isolated-rollout-ratelimit-secret-32chars" };
describe("TDD-US3-057 typed enabled MCP configuration", () => {
	test.each([{ BETTER_AUTH_SECRET: undefined, JWT_SECRET: undefined }, { BETTER_AUTH_SECRET: "short" }, { RATE_LIMIT_HASH_SECRET: undefined }, { RATE_LIMIT_HASH_SECRET: "short" }, { NEXT_PUBLIC_BASE_URL: "http://public.example" }, { NEXT_PUBLIC_BASE_URL: "https://clipify.example/unsafe-path" }])("unsafe/unavailable settings %j fail closed", (patch) => {
		expect(getMcpConfiguration({ ...environment, ...patch }).valid).toBe(false);
	});
	test("canonical HTTPS settings enable MCP", () => {
		expect(getMcpConfiguration(environment).valid).toBe(true);
	});
	test("legacy auth secret fallback remains supported", () => {
		expect(getMcpConfiguration({ ...environment, BETTER_AUTH_SECRET: undefined, JWT_SECRET: environment.BETTER_AUTH_SECRET }).valid).toBe(true);
	});
	test("exact approved origins are normalized", () => {
		expect(getMcpConfiguration(environment).allowedOrigins).toEqual(["https://clipify.example"]);
	});
});
describe("TDD-US3-057 actual route rollout/schema readiness", () => {
	test.each(["missing-auth", "missing-rate", "bad-origin", "missing-revision", "missing-default", "nullable-revision", "missing-provider", "missing-grants", "unavailable"])("%s stays safely unavailable", (mode) => {
		const r = runMcpProbe("rollout-probe", [mode]);
		expect(r.status).toBe(503);
		expect(r.body).toEqual({ error: "service_unavailable" });
	});
	test("ready schema still requires OAuth", () => {
		expect(runMcpProbe("rollout-probe", ["ready"]).status).toBe(401);
	});
});
