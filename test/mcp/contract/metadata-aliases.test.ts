/** @jest-environment node */
import { providerProbe } from "../../support/mcp/probe";
describe("FR-001 actual Next discovery aliases", () => {
	test.each(["authorization", "resource", "root"])("disabled %s alias exposes no provider metadata", (alias) => {
		expect(providerProbe(`disabled-alias:${alias}`)).toEqual({ status: 404, body: null });
	});
	test("authorization alias delegates to the real configured provider with the correct issuer", () => {
		expect(providerProbe("alias:authorization")).toMatchObject({ status: 200, body: { issuer: "http://127.0.0.1:3107/api/auth", registration_endpoint: "http://127.0.0.1:3107/api/auth/oauth2/register" } });
	});
	test.each(["resource", "root"])("%s resource alias identifies the exact MCP resource and issuer", (alias) => {
		expect(providerProbe(`alias:${alias}`)).toMatchObject({ status: 200, body: { resource: "http://127.0.0.1:3107/mcp", authorization_servers: ["http://127.0.0.1:3107/api/auth"] } });
	});
});
