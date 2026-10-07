/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-DEPENDENCY-002 serialized provider refresh deadline", () => {
	test.each(["headers", "body", "success"])("%s refresh is bounded and preserves credential state", (mode) => {
		const result = runMcpProbe("provider-deadline-probe", [mode], 30000);
		expect(result.status).toBe(503);
		expect(result.body).toEqual({ error: "service_unavailable" });
		expect(result.elapsed).toBeLessThan(11000);
		expect(result.lockReleased).toBe(true);
		expect(result.completed).toBe(mode === "success");
		expect(result.refreshes).toBe(1);
		expect(result.storedAccess).toBe(true);
		expect(result.storedRefresh).toBe(true);
	});
});
