/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-RUNTIME-002 existing idle source", () => {
	test.each(["paused", "deleted", "disabled", "suspended", "rotated", "restricted"])("%s ends presence on existing heartbeat", (mode) => {
		const r = runMcpProbe("websocket-runtime-probe", ["idle-" + mode]);
		expect(r.closes).toEqual([4002]);
		expect(r.messages).toEqual([]);
		expect(r.registered).toBe(false);
		expect(r.sourceActive).toBe(false);
		expect(r.activeOwners).toEqual([]);
	});
	test("active idle source stays connected", () => {
		const r = runMcpProbe("websocket-runtime-probe", ["idle-active"]);
		expect(r.closes).toEqual([]);
		expect(r.registered).toBe(true);
		expect(r.sourceActive).toBe(true);
	});
});
