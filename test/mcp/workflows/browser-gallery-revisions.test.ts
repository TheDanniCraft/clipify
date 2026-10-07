/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("a verified browser edit advances the same gallery revision read by MCP", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["gallery-save"]);
	expect(row.deleted).toMatchObject({ name: "Browser edited gallery", configurationRevision: 2 });
	expect(row.galleryRevision).toBe(2);
});
test("a stale browser edit cannot overwrite a newer configuration", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["gallery-save-stale"]);
	expect(row.deleted).toBeNull();
	expect(row.galleryRevision).toBe(1);
});

test("browser and trusted-principal creation share the Free gallery quota", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["gallery-create-race"]);
	expect(row.galleryCount).toBe(1);
	expect(row.creationAttempts.filter((item: any) => item.status === "fulfilled" && item.created)).toHaveLength(1);
	const failed = row.creationAttempts.find((item: any) => item.status === "rejected");
	expect(failed.reason).toMatch(/PLAN_LIMIT_REACHED|Free plan allows one gallery/);
});

test("playlist deletion advances the revision of its detached gallery", () => {
	const row = runMcpProbe("browser-playlist-delete-probe", ["normal"]);
	expect(row.deleted).toBe(true);
	expect(row.linkedGalleryRevision).toBe(2);
});
