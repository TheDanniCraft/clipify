/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-VOLUME-001 indirect configuration writers", () => {
	test.each(["session", "chat"])("%s Pro volume updates all overlays and revisions atomically", (kind) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["volume-" + kind + "-pro"]);
		expect(r.deleted).toBe(73);
		expect(r.volumeRows).toEqual([
			{ player_volume: 73, configuration_revision: 2 },
			{ player_volume: 73, configuration_revision: 2 },
		]);
		expect(r.volumeActivity).toHaveLength(2);
		for (const entry of r.volumeActivity) {
			expect(entry.action).toBe(kind === "session" ? "overlay.volume.update" : "overlay.volume.chat");
			if (kind === "session") expect(entry).toMatchObject({ actor_user_id: "owner", actor_session_id: r.sessionId });
			else expect(entry.metadata.actorTwitchUserId).toBe("verified-twitch-moderator");
		}
	});
	test.each(["session-free", "chat-free", "session-removed", "session-suspended", "chat-suspended", "chat-disabled", "session-overflow", "chat-overflow"])("%s cannot change any overlay", (mode) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["volume-" + mode]);
		expect(r.deleted).toBeNull();
		expect(r.volumeRows.every((row: any) => row.player_volume === 50)).toBe(true);
		expect(r.volumeRows.map((row: any) => row.configuration_revision).sort((a: number, b: number) => a - b)).toEqual(mode.endsWith("overflow") ? [1, 2147483647] : [1, 1]);
		expect(r.volumeActivity).toEqual([]);
	});
});
