/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-001/002 creator discovery through MCP", () => {
	test("owned, directly shared and ceiling-approved agency creators appear while inaccessible creators do not", () => {
		const result = flowProbe("resources:creators");
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult.items.map((creator: any) => creator.id)).toEqual(["agency-creator", "direct-creator", "fixture-creator"]);
	});
	test("current team removal shrinks visible creators without expanding consent", () => {
		const result = flowProbe("resources:creators:removed");
		expect(result.resourceResult.items.map((creator: any) => creator.id)).toEqual(["agency-creator", "fixture-creator"]);
		expect(result.approvedCreators).toContain("direct-creator");
	});
	test("free owner capabilities report usage, limits and blocked additional resources", () => {
		const result = flowProbe("resources:capabilities:free");
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult).toMatchObject({ creatorId: "fixture-creator", effectivePlan: "free", usage: { overlays: 1, playlists: 1 }, limits: { overlays: 1, playlists: 1, playlistItems: 50 }, operations: { create_overlay: { allowed: false, reason: "PLAN_LIMIT_REACHED" }, create_playlist: { allowed: false, reason: "PLAN_LIMIT_REACHED" } } });
		expect(JSON.stringify(result.resourceResult)).not.toContain("private-overlay-secret");
	});
	test("current Pro owner capabilities report unlimited creation", () => {
		const result = flowProbe("resources:capabilities:pro");
		expect(result.resourceResult).toMatchObject({ effectivePlan: "pro", limits: { overlays: null, playlists: null, playlistItems: null }, operations: { create_overlay: { allowed: true }, create_playlist: { allowed: true } } });
	});
});
