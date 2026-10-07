/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("equal queue timestamps and row IDs remain distinct across cursor pages", () => {
	const row = flowProbe("catalogue:workflow:get_overlay_queues:fifo_ties");
	expect(row.result?.structuredContent.items).toMatchObject([{ clipId: "ModeratorClip", queue: "moderator" }]);
	expect(row.nextPage?.structuredContent.items).toMatchObject([{ clipId: "ViewerClip", queue: "viewer" }]);
	expect(row.nextPage?.structuredContent.nextCursor).toBeNull();
});

test("a runtime read reports disconnection after its authenticated subscriber leaves", () => {
	const row = flowProbe("catalogue:workflow:get_overlay_runtime:offline");
	expect(row.result?.structuredContent).toMatchObject({ status: "disconnected", nowPlaying: { clipId: "MinecraftClip" } });
	expect(row.safe).toBe(true);
});

test("an expired creation retry no longer replays its old resource", () => {
	const row = flowProbe("catalogue:workflow:create_gallery:retry_expired");
	expect(row.result?.isError).not.toBe(true);
	expect(row.replay?.isError).not.toBe(true);
	expect(row.replay?.structuredContent.id).not.toBe(row.result?.structuredContent.id);
	expect(row.writes).toBe(2);
	expect(row.safe).toBe(true);
});
