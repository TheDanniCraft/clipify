/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-RUNTIME-001 independently changed policy", () => {
	test.each(["paused", "deleted", "disabled", "suspended", "rotated", "restricted"])("%s denies existing source frame", (mode) => {
		const r = runMcpProbe("websocket-runtime-probe", [mode]);
		expect(r.closes).toEqual([4002]);
		expect(r.messages).toEqual([]);
		expect(r.sourceActive).toBe(false);
		expect(r.registered).toBe(false);
		expect(r.activeOwners).toEqual([]);
	});
	test("active source preserves normal state broadcast", () => {
		const r = runMcpProbe("websocket-runtime-probe", ["active"]);
		expect(r.closes).toEqual([]);
		expect(r.messages).toHaveLength(1);
		expect(r.registered).toBe(true);
	});
});
