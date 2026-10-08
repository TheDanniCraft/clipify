/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-CANCELLATION-002 durable provider rotation", () => {
	test("request abort preserves serialized encrypted Better Auth provider refresh", () => {
		const result = runMcpProbe("provider-abort-probe", []);
		expect(result.status).toBe(400);
		expect(result.lockHeldAfterAbort).toBe(true);
		expect(result.completed).toBe(true);
		expect(result.refreshes).toBe(1);
		expect(result.storedAccess).toBe(true);
		expect(result.storedRefresh).toBe(true);
	});
});
