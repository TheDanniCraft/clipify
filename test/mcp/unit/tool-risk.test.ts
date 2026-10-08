/** @jest-environment node */
import { toolInputSchemas } from "@/server/mcp/schemas";
let risk: any;
try {
	risk = require("@/server/mcp/risk");
} catch {}
const workflowRisk = {
	get_overlay_runtime: "read",
	get_overlay_queues: "read",
	control_overlay: "control",
	enqueue_overlay_clip: "externalControl",
	clear_overlay_queue: "control",
	search_clips: "externalRead",
	resolve_clip: "externalRead",
	preview_playlist_import: "externalRead",
	commit_playlist_import: "externalMutation",
	list_galleries: "read",
	get_gallery: "read",
	create_gallery: "create",
	update_gallery: "mutation",
	delete_gallery: "mutation",
	publish_gallery: "mutation",
	get_gallery_embed: "read",
	get_gallery_preview: "read",
	get_overlay_embed: "read",
	get_player_embed: "read",
	get_creator_page: "read",
	update_creator_page: "mutation",
	publish_creator_page: "mutation",
	get_runner_setup: "read",
	list_runners: "read",
	get_runner: "read",
	create_runner: "create",
	update_runner: "mutation",
	delete_runner: "mutation",
	unlink_runner: "control",
	list_stream_sessions: "read",
	get_stream_session: "read",
	configure_stream_session: "mutation",
	control_stream_session: "control",
	get_runner_snapshot: "read",
	submit_feedback: "externalFeedback",
} as const;
const expectedHints = {
	externalFeedback: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
	read: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
	externalRead: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
	create: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
	mutation: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
	externalMutation: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
	control: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
	externalControl: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
};
describe("TDD-US2-039 truthful tool risk annotations", () => {
	test.each(Object.keys(toolInputSchemas).filter((name) => !(name in workflowRisk)))("%s has accurate permissions-independent risk metadata", (name) => {
		expect(risk?.toolAnnotations).toEqual(expect.any(Function));
		const read = name.startsWith("list_") || name.startsWith("get_");
		const destructive = name.startsWith("delete_") || name.startsWith("update_") || name === "remove_playlist_items" || name === "reorder_playlist_items";
		expect(risk.toolAnnotations(name)).toEqual({ readOnlyHint: read, destructiveHint: destructive, idempotentHint: true, openWorldHint: name === "add_playlist_items" });
	});
	test.each(Object.entries(workflowRisk))("%s has explicit workflow risk metadata", (name, profile) => {
		expect(risk.toolAnnotations(name)).toEqual(expectedHints[profile]);
	});
	test("risk table covers workflows, focused tools and internal compatibility schemas", () => {
		expect(Object.keys(workflowRisk)).toHaveLength(35);
		expect(Object.keys(toolInputSchemas).filter((name) => !(name in workflowRisk))).toHaveLength(34);
		for (const name of Object.keys(workflowRisk)) expect(toolInputSchemas).toHaveProperty(name);
	});
	test("unknown tools cannot acquire safe-looking defaults", () => {
		expect(risk?.toolAnnotations).toEqual(expect.any(Function));
		expect(() => risk.toolAnnotations("rotate_secret")).toThrow("INVALID_INPUT");
	});
});
