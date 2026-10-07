/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-BROWSER-AUDIT-001 distinguish session changes from AI app activity", () => {
	test.each([
		["normal", "playlist.delete"],
		["rename", "playlist.update"],
	])("%s attributes only the verified browser actor and session", (mode, action) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [mode]);
		expect(result.deleted).toBe(true);
		expect(result.activity).toHaveLength(1);
		expect(result.activity[0]).toMatchObject({ action, actor_user_id: "owner", actor_session_id: result.sessionId });
		expect(result.activity[0].action).not.toMatch(/^sensitive-integration:mcp\./);
		expect(result.activity[0].metadata.clientId).toBeUndefined();
		expect(result.activity[0].metadata.grantId).toBeUndefined();
	});
	test("stale browser denial never leaves a successful audit record", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["stale"]);
		expect(result.deleted).toBe(false);
		expect(result.activity).toEqual([]);
	});
});
