/** @jest-environment node */
jest.mock("@/server/resources/overlays", () => ({ getOverlay: jest.fn(), updateOverlay: jest.fn() }));
jest.mock("@/server/resources/galleries", () => ({ getGalleryForPrincipal: jest.fn(), updateGalleryForPrincipal: jest.fn(), getOverlayEmbed: jest.fn() }));
import { getOverlay, updateOverlay } from "@/server/resources/overlays";
import { getGalleryForPrincipal, updateGalleryForPrincipal, getOverlayEmbed } from "@/server/resources/galleries";
import { focusedTools } from "@/server/mcp/focused-tools";
const principal = { kind: "oauth" } as any;
const target = { creatorId: "creator", overlayId: "11111111-1111-4111-8111-111111111111" };
beforeEach(() => jest.resetAllMocks());
test("theme reads return only theme fields and identity/revision", async () => {
	(getOverlay as jest.Mock).mockResolvedValue({ overlay: { id: target.overlayId, creatorId: "creator", configurationRevision: 2, name: "Keep", playerVolume: 80, secret: "private", themeTextColor: "#fff" } });
	const tool = focusedTools(principal).find((t) => t.name === "get_overlay_theme")!;
	expect(await tool.run(target)).toEqual({ overlayId: target.overlayId, creatorId: "creator", configurationRevision: 2, theme: { themeTextColor: "#fff" } });
	expect(getOverlay).toHaveBeenCalledWith(principal, target);
});
test("theme updates forward only a validated patch and project the result", async () => {
	(updateOverlay as jest.Mock).mockResolvedValue({ overlay: { id: target.overlayId, creatorId: "creator", configurationRevision: 3, name: "Keep", themeTextColor: "#abc" } });
	const tool = focusedTools(principal).find((t) => t.name === "update_overlay_theme")!;
	const input = { ...target, expectedRevision: 2, patch: { themeTextColor: "#abc" } };
	expect(await tool.run(input)).toMatchObject({ configurationRevision: 3, theme: { themeTextColor: "#abc" } });
	expect(updateOverlay).toHaveBeenCalledWith(principal, input, undefined, "update_overlay_theme");
	await expect(tool.run({ ...input, patch: { name: "Overwrite" } })).rejects.toThrow();
	expect(updateOverlay).toHaveBeenCalledTimes(1);
});
test("gallery layout read/update use shared resources and exclude theme fields", async () => {
	(getGalleryForPrincipal as jest.Mock).mockResolvedValue({ gallery: { id: target.overlayId, creatorId: "creator", configurationRevision: 1, layout: "grid", accentColor: "secretish" }, capabilities: { advanced: true } });
	(updateGalleryForPrincipal as jest.Mock).mockResolvedValue({ id: target.overlayId, creatorId: "creator", configurationRevision: 2, layout: "list", accentColor: "unchanged" });
	const input = { creatorId: "creator", galleryId: target.overlayId };
	expect(
		await focusedTools(principal)
			.find((t) => t.name === "get_gallery_layout")!
			.run(input),
	).toEqual({ ...input, configurationRevision: 1, layout: { layout: "grid" }, capabilities: { advanced: true } });
	expect(
		await focusedTools(principal)
			.find((t) => t.name === "update_gallery_layout")!
			.run({ ...input, expectedRevision: 1, patch: { layout: "list" } }),
	).toEqual({ ...input, configurationRevision: 2, layout: { layout: "list" } });
});
test("private browser-source link reuses the explicit secret authorization path", async () => {
	(getOverlayEmbed as jest.Mock).mockResolvedValue({ url: "https://example.test/private", containsCredential: true });
	const tool = focusedTools(principal).find((t) => t.name === "get_overlay_link")!;
	await tool.run(target);
	expect(getOverlayEmbed).toHaveBeenCalledWith(principal, { ...target, purpose: "obs_browser_source" });
	expect(tool.description).toMatch(/private/i);
	expect(tool.description).toContain("overlay-secret:read");
});

test.each([null, undefined, [], "invalid"])("invalid resource read result %p cannot escape the projection", async (value) => {
	(getOverlay as jest.Mock).mockResolvedValue({ overlay: value });
	const tool = focusedTools(principal).find((t) => t.name === "get_overlay_theme")!;
	await expect(tool.run(target)).rejects.toThrow("SERVICE_UNAVAILABLE");
});
