/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-HTTP-002 unknown tool permission lookup", () => {
	test.each(["unknown_tool", "constructor", "__proto__", "toString"])("%s reaches the normal unavailable-tool response", (name) => {
		const result = flowProbe(`protocol:unknown-tool:${name}`);
		expect(result.protocolErrorCode).toBe(-32602);
		expect(result.protocolStatus).toBe(200);
		expect(result.toolRead).not.toBe(true);
	});
});
