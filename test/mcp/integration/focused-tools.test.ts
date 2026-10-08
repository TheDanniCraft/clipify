/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test("theme editing through native OAuth preserves name, filters and playback", () => {
	const row = flowProbe("catalogue:workflow:update_overlay_theme:success");
	expect(row.result?.structuredContent).toMatchObject({ overlayId: row.ids.overlayId, configurationRevision: 2, theme: { themeTextColor: "#abcdef" } });
	expect(row.storedOverlay).toMatchObject({ name: "Workflow overlay", player_volume: 50, min_clip_views: 0, theme_text_color: "#abcdef", configuration_revision: 2 });
	expect(row.safe).toBe(true);
});
test("gallery layout editing preserves name and theme", () => {
	const row = flowProbe("catalogue:workflow:update_gallery_layout:success");
	expect(row.result?.structuredContent).toMatchObject({ galleryId: row.ids.galleryId, configurationRevision: 2, layout: { layout: "list" } });
	expect(row.storedGallery).toMatchObject({ name: "Workflow gallery", layout: "list", accent_color: "#7C3AED", configuration_revision: 2 });
	expect(row.result?.structuredContent).not.toHaveProperty("accentColor");
});
test.each(["update_overlay_theme", "update_overlay_filters", "update_overlay_playback", "update_gallery_theme", "update_gallery_layout"])("%s rejects cross-area patches before writes", (name) => {
	const row = flowProbe(`catalogue:workflow:${name}:cross_area`);
	expect(row.result?.structuredContent?.error?.code).toBe("INVALID_INPUT");
	expect(row.storedOverlay.configuration_revision).toBe(1);
	expect(row.storedGallery.configuration_revision).toBe(1);
});
test.each(["update_overlay_theme", "update_gallery_layout"])("%s enforces revisions and approved scope", (name) => {
	const stale = flowProbe(`catalogue:workflow:${name}:stale_revision`);
	expect(stale.result?.structuredContent?.error?.code).toBe("CONFLICT");
	const denied = flowProbe(`catalogue:workflow:${name}:missing_scope`);
	expect(denied.status).toBe(403);
	expect(denied.storedOverlay.configuration_revision).toBe(1);
	expect(denied.storedGallery.configuration_revision).toBe(1);
});
test("private link is available only with explicit secret scope", () => {
	const row = flowProbe("catalogue:workflow:get_overlay_link:success");
	expect(row.result?.structuredContent).toMatchObject({ containsCredential: true, public: false });
	expect(row.result?.structuredContent.url).toContain("secret=");
	const denied = flowProbe("catalogue:workflow:get_overlay_link:missing_scope");
	expect(denied.status).toBe(403);
	expect(denied.safe).toBe(true);
});
