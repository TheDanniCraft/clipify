/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-BROWSER-IMPORT-001 auto import rechecks paid entitlement under lock", () => {
	test("current Pro import commits one revision and distinct session activity", () => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["items-import"]);
		expect(r.deleted).toMatchObject({ configurationRevision: 2 });
		expect(r.activity).toHaveLength(1);
		expect(r.activity[0]).toMatchObject({ action: "playlist.items.import", actor_session_id: r.sessionId });
	});
	test("downgrade during provider lookup prevents the entire import", () => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["items-import-downgrade"]);
		expect(r.providerCalls).toBe(1);
		expect(r.deleted).toBeNull();
		expect(r.revision).toBe(1);
		expect(r.storedItems.map((item: any) => item.clip_id)).toEqual(["ClipFirst"]);
		expect(r.activity).toEqual([]);
	});
});
