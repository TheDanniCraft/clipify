/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-RUNTIME-003 existing source presence frames", () => {
	test.each(["paused", "deleted", "disabled", "suspended", "rotated", "restricted"])("%s prevents restoring presence", (mode) => {
		const r = runMcpProbe("websocket-runtime-probe", ["activity-" + mode]);
		expect(r.closes).toEqual([4002]);
		expect(r.messages).toEqual([]);
		expect(r.registered).toBe(false);
		expect(r.sourceActive).toBe(false);
		expect(r.activeOwners).toEqual([]);
	});
	test("active source can publish presence", () => {
		const r = runMcpProbe("websocket-runtime-probe", ["activity-active"]);
		expect(r.closes).toEqual([]);
		expect(r.registered).toBe(true);
		expect(r.sourceActive).toBe(true);
		expect(r.messages).toEqual([]);
	});
});
