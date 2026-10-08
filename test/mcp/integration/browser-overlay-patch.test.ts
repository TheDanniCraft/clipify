/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
import { toolInputSchemas } from "@/server/mcp/schemas";
describe("TDD-BROWSER-OVERLAY-PATCH-001 compatible browser patch", () => {
	test("Pro browser retains reward editing without exposing it to MCP", () => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-reward"]);
		expect(r.deleted).toMatchObject({ configurationRevision: 2, rewardId: "RewardOne" });
		expect(r.storedOverlay).toMatchObject({ reward_id: "RewardOne", configuration_revision: 2 });
		expect(r.activity).toHaveLength(1);
	});
	test("Free editor unchanged advanced snapshot values do not prevent name edit", () => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["overlay-save-free-snapshot"]);
		expect(r.deleted).toMatchObject({ configurationRevision: 2, name: "Browser renamed overlay", playerVolume: 50 });
		expect(r.activity).toHaveLength(1);
	});
	test("MCP protocol continues rejecting reward IDs", () => {
		expect(toolInputSchemas.update_overlay.safeParse({ creatorId: "creator", overlayId: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", expectedRevision: 1, patch: { rewardId: "RewardOne" } }).success).toBe(false);
	});
});
