/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("browser settings save advances the Creator Page revision and returns it to the UI", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["settings-save"]);
	expect(row.settingsError).toBeUndefined();
	expect(row.settingsState).toEqual({ configuration_revision: 2, creator_page_visibility: "unlisted" });
	expect(row.savedSettings).toEqual({ configurationRevision: 2 });
});

test("stale browser settings cannot overwrite a newer Creator Page revision", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["settings-save-stale"]);
	expect(row.settingsError).toBe("Failed to save settings");
	expect(row.settingsState).toEqual({ configuration_revision: 2, creator_page_visibility: null });
	expect(row.savedSettings).toBeUndefined();
});
