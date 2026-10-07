/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
const names = ["list_creators", "get_capabilities", "list_overlays", "get_overlay", "create_overlay", "update_overlay", "delete_overlay", "list_playlists", "get_playlist", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"];
const workflowNames = [
	"get_overlay_runtime",
	"get_overlay_queues",
	"control_overlay",
	"enqueue_overlay_clip",
	"clear_overlay_queue",
	"search_clips",
	"resolve_clip",
	"preview_playlist_import",
	"commit_playlist_import",
	"list_galleries",
	"get_gallery",
	"create_gallery",
	"update_gallery",
	"delete_gallery",
	"publish_gallery",
	"get_gallery_embed",
	"get_gallery_preview",
	"get_overlay_embed",
	"get_player_embed",
	"get_creator_page",
	"update_creator_page",
	"publish_creator_page",
	"get_runner_setup",
	"list_runners",
	"get_runner",
	"create_runner",
	"update_runner",
	"delete_runner",
	"unlink_runner",
	"list_stream_sessions",
	"get_stream_session",
	"configure_stream_session",
	"control_stream_session",
	"get_runner_snapshot",
	"submit_feedback",
];
describe("TDD-US2-022 every public tool result excludes seeded credentials", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:tool-results");
	});
	test("actual discovery exposes exactly the 50 supported tool definitions without seeded credentials", () => {
		expect(result.discovery.status).toBe(200);
		expect(result.discovery.secretFree).toBe(true);
		expect([...result.discovery.names].sort()).toEqual([...names, ...workflowNames].sort());
	});
	test.each(names)("%s exposes truthful risk hints on native discovery", (name) => {
		const read = name.startsWith("list_") || name.startsWith("get_");
		const destructive = ["update_overlay", "delete_overlay", "update_playlist", "delete_playlist", "remove_playlist_items", "reorder_playlist_items"].includes(name);
		expect(result.discovery.annotations.find((row: any) => row.name === name).annotations).toEqual({ readOnlyHint: read, destructiveHint: destructive, idempotentHint: true, openWorldHint: name === "add_playlist_items" });
	});
	test.each(names)("%s succeeds without provider, OAuth, clip or overlay credentials", (name) => {
		expect(result.outcomes.find((row: any) => row.name === name)).toEqual({ name, status: 200, success: true, secretFree: true });
	});
	test.each(["rotate_overlay_secret", "get_runner_credentials", "create_api_token", "configure_twitch_reward"])("excluded %s is denied without credentials", (name) => {
		expect(result.excluded.find((row: any) => row.name === name)).toEqual({ name, denied: true, secretFree: true });
	});
	test("clip append uses the actual decrypted provider credential exactly once", () => {
		expect(result.providerCalls).toBe(1);
	});
});
