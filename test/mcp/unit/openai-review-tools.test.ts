/** @jest-environment node */
import { publicToolNames, toolInputSchemas } from "@/server/mcp/schemas";
import { toolAnnotations } from "@/server/mcp/risk";
const controls = ["play_overlay", "pause_overlay", "skip_overlay", "hide_overlay", "show_overlay", "set_overlay_volume", "mute_overlay", "unmute_overlay", "toggle_overlay_mute"] as const;
const target = { creatorId: "owner", overlayId: "79e6c5a3-5368-4813-9780-49d22d99175f" };
test("each overlay command is discoverable without exposing a command dispatcher", () => {
	expect(publicToolNames).not.toContain("control_overlay");
	for (const name of controls) expect(publicToolNames).toContain(name);
});
test.each(controls)("%s has a strict action-specific schema and external effects", (name) => {
	const schema = (toolInputSchemas as Record<string, any>)[name];
	expect(schema).toBeDefined();
	const input = name === "set_overlay_volume" ? { ...target, volume: 50 } : target;
	expect(schema.safeParse(input).success).toBe(true);
	expect(schema.safeParse({ ...input, command: "skip" }).success).toBe(false);
	expect(toolAnnotations(name as any).openWorldHint).toBe(true);
});
test.each(["control_stream_session", "configure_stream_session", "publish_gallery", "publish_creator_page"] as const)("%s acknowledges effects outside the tool process", (name) => {
	expect(toolAnnotations(name).openWorldHint).toBe(true);
});
