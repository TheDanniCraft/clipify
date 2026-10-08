/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-BROWSER-ITEMS-001 verified browser reorder", () => {
	test("matching revision advances parent and attributes the verified browser session", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["reorder"]);
		expect(result.deleted).toMatchObject({ playlist: { configurationRevision: 2 }, items: [{ id: "ClipFirst", position: 0 }] });
		expect(result.revision).toBe(2);
		expect(result.activity).toHaveLength(1);
		expect(result.activity[0]).toMatchObject({ action: "playlist.items.reorder", actor_user_id: "owner", actor_session_id: result.sessionId });
		expect(result.activity[0].metadata.grantId).toBeUndefined();
	});
	test.each(["stale", "missing", "invalid", "removed", "suspended"])("%s leaves items/revision/audit unchanged", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["reorder-" + mode]);
		expect(result.deleted).toBeNull();
		expect(result.revision).toBe(1);
		expect(result.state.items).toBe(1);
		expect(result.activity).toEqual([]);
	});
});
