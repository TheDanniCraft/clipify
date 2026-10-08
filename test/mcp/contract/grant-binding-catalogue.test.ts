/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
let result: any;
beforeAll(() => {
	result = runMcpProbe("flow-probe", ["protocol:binding-catalogue"], 45000);
});
describe("TDD-US1-029 actual signed token binding and online grant state", () => {
	test.each(["valid", "wrong-subject", "wrong-client", "wrong-generation", "unknown-grant", "wrong-audience", "revoked-grant", "expired-grant", "restored-grant"])("checks %s at the public MCP route", (name) => {
		const item = result.outcomes.find((outcome: any) => outcome.name === name);
		const valid = ["valid", "restored-grant"].includes(name);
		expect(item).toMatchObject({ name, status: valid ? 200 : 401, read: valid });
		if (!valid) expect(item.challenge).toBe(true);
	});
});
