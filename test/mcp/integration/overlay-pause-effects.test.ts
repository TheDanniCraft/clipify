/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-PAUSE-001 committed MCP pause", () => {
	test("disconnects the existing local source after committed pause", () => {
		const r = flowProbe("resources:overlay-update:pause");
		expect(r.resourceResult.overlay).toMatchObject({ status: "paused", configurationRevision: 2 });
		expect(r.sourceCloses).toEqual([4002]);
		expect(r.sourceActive).toBe(false);
	});
	test("stale pause preserves active source", () => {
		const r = flowProbe("resources:overlay-update:pause:stale");
		expect(r.resourceResult.error.code).toBe("CONFLICT");
		expect(r.sourceCloses).toEqual([]);
		expect(r.sourceActive).toBe(true);
	});
});
