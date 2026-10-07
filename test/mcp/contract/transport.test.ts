/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-US1-013–017 authenticated MCP route", () => {
	test.each([
		["missing-access", "013"],
		["expired-access", "014"],
		["bad-signature", "015"],
		["bad-issuer", "016"],
		["bad-audience", "017"],
		["missing-grant", "022"],
		["wrong-generation", "029"],
		["wrong-subject", "029"],
		["expiry-boundary", "022"],
	])("%s is rejected with OAuth discovery challenge (%s)", (mode) => {
		const result = flowProbe(`protocol:${mode}`);
		expect(result.protocolStatus).toBe(401);
		expect(result.challenge).toContain("resource_metadata=");
		expect(result.toolRead).not.toBe(true);
	});
	test("TDD-US1-025 verified custom client reads approved creators through legacy stateless transport", () => {
		const result = flowProbe("protocol:valid");
		expect(result.protocolStatus).toBe(200);
		expect(result.toolRead).toBe(true);
	});
	test("TDD-US1-025 modern discover responds without transport sessions", () => {
		const result = flowProbe("protocol:modern");
		expect(result.protocolStatus).toBe(200);
		expect(result.discovery).toBe(true);
	});
	test("TDD-US1-025 disallowed browser origin is rejected", () => {
		expect(flowProbe("protocol:origin").protocolStatus).toBe(403);
	});
});
