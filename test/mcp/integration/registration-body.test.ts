/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-REGISTRATION-001 bounded OAuth registration input", () => {
	test.each(["oversized-declared", "oversized-chunked", "deadline", "cancel", "valid"])("%s registration has a bounded safe outcome", (mode) => {
		const result = runMcpProbe("registration-body-probe", [mode], 25000);
		expect(result.elapsed).toBeLessThan(mode === "deadline" ? 11000 : 1500);
		if (mode === "valid") {
			expect(result.status).toBeGreaterThanOrEqual(200);
			expect(result.status).toBeLessThan(300);
			expect(result.clients).toBe(1);
		} else {
			expect(result.status).toBe(400);
			expect(result.body).toEqual({ error: "invalid_client_metadata" });
			expect(result.clients).toBe(0);
		}
	});
});
