/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("schema template is reused without sharing any test data", () => {
	const result = runMcpProbe("fixture-template-probe", []);
	expect(result.templates).toBe(1);
	expect(result.leakedRows).toBe(0);
	expect(result.distinct).toBe(true);
	expect(result.tables).toBeGreaterThan(40);
});
