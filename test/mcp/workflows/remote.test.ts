/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-US1-001 player runtime through actual OAuth/MCP HTTP", () => {
	test("returns authenticated current clip and safe live playback state", () => {
		const outcome = flowProbe("catalogue:workflow:get_overlay_runtime:success");
		expect(outcome.schemaValid).toBe(true);
		expect(outcome.status).toBe(200);
		expect(outcome.result?.isError).not.toBe(true);
		expect(outcome.result?.structuredContent).toMatchObject({ status: "connected", playback: { volume: 35, paused: false }, nowPlaying: { clipId: "MinecraftClip", currentTime: 3 } });
		expect(outcome.safe).toBe(true);
	});
});
describe("TDD-US1-002 persisted remote queues", () => {
	test("returns separate overlay viewer and creator-wide moderator queue semantics", () => {
		const row = flowProbe("catalogue:workflow:get_overlay_queues:success");
		expect(row.result?.structuredContent).toMatchObject({ items: [], targets: { viewer: "overlay", moderator: "creator" } });
		expect(row.safe).toBe(true);
	});
});
describe("TDD-US1-003 live playback commands", () => {
	test.each(["play", "pause", "skip", "hide", "show", "volume", "mute", "unmute", "toggle_mute"])("dispatches %s to the selected overlay and reports acceptance, not application", (command) => {
		const row = flowProbe(`catalogue:workflow:control_overlay:command_${command}`);
		expect(row.result?.structuredContent).toMatchObject({ overlayId: row.ids.overlayId, command, status: "sent", applied: false, target: "overlay" });
		expect(row.commands).toContainEqual({ type: "command", data: { name: command, data: command === "volume" ? "70" : null } });
		expect(row.safe).toBe(true);
	});
	test("does not claim a disconnected player received the command", () => {
		const row = flowProbe("catalogue:workflow:control_overlay:offline");
		expect(row.result?.structuredContent).toMatchObject({ status: "player_unavailable", applied: false });
		expect(row.commands.filter((v: any) => v.type === "command")).toHaveLength(0);
	});
});
describe("TDD-US1-004 enqueue creator clips", () => {
	test("accepts a Twitch link and enqueues its clip in the creator-wide moderator queue", () => {
		const row = flowProbe("catalogue:workflow:enqueue_overlay_clip:success");
		expect(row.result?.structuredContent).toMatchObject({ creatorId: "fixture-creator", clipId: "MinecraftClip", target: "creator", queue: "moderator" });
		expect(row.result?.structuredContent.id).toEqual(expect.any(String));
		expect(row.safe).toBe(true);
	});
});
describe("TDD-US1-005 targeted queue clearing", () => {
	test.each(["moderator", "viewer", "all"])("clears only the requested %s queue", (queue) => {
		const row = flowProbe(`catalogue:workflow:clear_overlay_queue:queue_${queue}`);
		expect(row.result?.structuredContent).toMatchObject({ removed: { moderator: queue === "viewer" ? 0 : 1, viewer: queue === "moderator" ? 0 : 1 }, targets: { viewer: "overlay", moderator: "creator" } });
		expect(row.safe).toBe(true);
	});
});

test("queue pagination preserves FIFO across queues and sub-millisecond timestamps", () => {
	const row = flowProbe("catalogue:workflow:get_overlay_queues:fifo");
	expect(row.result?.structuredContent.items.map((item: any) => item.clipId)).toEqual(["FirstClip"]);
	expect(row.nextPage?.structuredContent.items.map((item: any) => item.clipId)).toEqual(["SecondClip"]);
	expect(row.nextPage?.structuredContent.nextCursor).toBeNull();
});
