/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-DEPENDENCY-006 validate provider refresh response before persistence", () => {
	test.each(["missing-access", "blank-access", "object-access", "bad-expiry", "negative-expiry", "bad-refresh", "oversized", "success"])("%s refresh preserves valid stored credentials", (mode) => {
		const result = runMcpProbe("provider-response-probe", [mode], 20000);
		expect(result.status).toBe(503);
		expect(result.body).toEqual({ error: "service_unavailable" });
		expect(result.completed).toBe(mode === "success");
		expect(result.refreshes).toBe(1);
		expect(result.lockReleased).toBe(true);
		expect(result.storedAccess).toBe(true);
		expect(result.storedRefresh).toBe(true);
	});
});
