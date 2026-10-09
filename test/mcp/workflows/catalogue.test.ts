/** @jest-environment node */
import { toolInputSchemas } from "@/server/mcp/schemas";
import { toolPermissions } from "@/server/mcp/permissions";
import { toolAnnotations } from "@/server/mcp/risk";
import { MCP_SCOPES, validateSelectedScopes, consentPreset } from "@/server/mcp/scopes";
const permissions = {
	get_overlay_runtime: "overlay:read",
	get_overlay_queues: "overlay:read",
	control_overlay: "overlay:control",
	enqueue_overlay_clip: "overlay:control",
	clear_overlay_queue: "overlay:control",
	search_clips: "creator:read",
	resolve_clip: "creator:read",
	preview_playlist_import: "playlist:read",
	commit_playlist_import: "playlist-items:manage",
	list_galleries: "gallery:read",
	get_gallery: "gallery:read",
	create_gallery: "gallery:create",
	update_gallery_settings: "gallery:update",
	delete_gallery: "gallery:delete",
	publish_gallery: "gallery:publish",
	get_gallery_embed: "gallery:read",
	get_gallery_preview: "gallery:read",
	get_overlay_link: "overlay-secret:read",
	get_player_embed: "overlay:read",
	get_creator_page: "creator:read",
	update_creator_page: "creator:update",
	publish_creator_page: "creator:update",
	get_runner_setup: "runner:read",
	list_runners: "runner:read",
	get_runner: "runner:read",
	create_runner: "runner:create",
	update_runner: "runner:update",
	delete_runner: "runner:delete",
	unlink_runner: "runner-credential:rotate",
	list_stream_sessions: "runner:read",
	get_stream_session: "runner:read",
	configure_stream_session: "runner:update",
	control_stream_session: "runner:control",
	get_runner_snapshot: "runner:read",
	submit_feedback: "creator:read",
} as const;
describe("TDD-FOUNDATION-001 workflow tool contracts", () => {
	test.each(Object.entries(permissions))("%s has explicit scope and strict owner-bound input", (name, permission) => {
		const schema = (toolInputSchemas as Record<string, any>)[name];
		expect(schema).toBeDefined();
		expect((toolPermissions as Record<string, string>)[name]).toBe(permission);
		expect(schema.safeParse({ creatorId: "creator", unexpected: "credential" }).success).toBe(false);
		expect(schema.safeParse({}).success).toBe(false);
		expect(MCP_SCOPES).toContain(permission);
	});
	test("new consequential permissions are opt-in and cannot broaden old requests", () => {
		expect(MCP_SCOPES).toContain("runner:control");
		expect(() => validateSelectedScopes(["runner:control"], ["creator:read"])).toThrow("INVALID_INPUT");
		expect(consentPreset("edit")).not.toContain("runner:control");
		expect(consentPreset("edit")).not.toContain("overlay-secret:read");
	});
	test.each(["control_overlay", "enqueue_overlay_clip", "clear_overlay_queue", "control_stream_session", "unlink_runner"])("%s exposes consequential non-replay-safe semantics", (name) => {
		const hints = toolAnnotations(name as keyof typeof toolInputSchemas);
		expect(hints.readOnlyHint).toBe(false);
		expect(hints.destructiveHint).toBe(true);
		expect(hints.idempotentHint).toBe(false);
		if (name === "control_stream_session") expect(hints.openWorldHint).toBe(true);
	});
	test("discovery and preview are read-only but inspect the external world", () => {
		for (const name of ["search_clips", "resolve_clip", "preview_playlist_import"]) {
			const hints = toolAnnotations(name as keyof typeof toolInputSchemas);
			expect(hints).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: true });
		}
	});
});
