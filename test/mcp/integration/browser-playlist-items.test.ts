/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-BROWSER-ITEMS-002 shared browser replacement and append", () => {
	test.each(["malformed", "null", "array", "primitive", "mismatch"])("stored %s metadata cannot commit a browser selection", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [`items-stored-${mode}`]);
		expect(result.deleted).toBeNull();
		expect(result.revision).toBe(1);
		expect(result.state.items).toBe(1);
		expect(result.activity).toEqual([]);
		expect(result.providerCalls).toBe(0);
	});
	test("a retained legacy clip wrapper is returned without refetching or replacing server metadata", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["items-stored-wrapped"]);
		expect(result.deleted).toMatchObject({ configurationRevision: 2, clips: [{ id: "ClipFirst", title: "Legacy clip", duration: 10 }] });
		expect(result.providerCalls).toBe(0);
		expect(JSON.parse(result.storedItems[0].clip_data)).toEqual({ clip: { id: "ClipFirst", title: "Legacy clip", duration: 10 } });
	});

	test.each(["items", "items-clear", "items-retained", "items-rename", "items-pro"])("%s commits one parent revision and verified session audit", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [mode]);
		expect(result.deleted).toMatchObject({ configurationRevision: 2 });
		expect(result.revision).toBe(2);
		expect(result.activity).toHaveLength(1);
		expect(result.activity[0]).toMatchObject({ action: "playlist.items.save", actor_session_id: result.sessionId });
		expect(result.activity[0].metadata.grantId).toBeUndefined();
		expect(result.state.items).toBe(mode === "items-clear" ? 0 : mode === "items-pro" ? 51 : 1);
		expect(result.providerCalls).toBe(mode === "items-clear" || mode === "items-retained" ? 0 : 1);
		if (mode === "items-rename") expect(result.playlistName).toBe("New playlist name");
		if (mode === "items") expect(JSON.parse(result.storedItems[0].clip_data).title).toBe("Trusted NewClip");
	});
	test.each(["items-stale", "items-missing", "items-limit", "items-provider-error", "items-lost-access", "items-raced"])("%s leaves no partial mutation or successful audit", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [mode]);
		expect(result.deleted).toBeNull();
		expect(result.revision).toBe(mode === "items-raced" ? 2 : 1);
		expect(result.state.items).toBe(mode === "items-limit" ? 50 : 1);
		expect(result.storedItems[0].clip_id).toBe("ClipFirst");
		expect(result.activity).toEqual([]);
	});
});
