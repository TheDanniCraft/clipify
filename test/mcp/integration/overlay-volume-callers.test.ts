/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-OVERLAY-VOLUME-002 actual legacy entry conversion", () => {
	test.each(["session", "controller", "chat", "high", "low"])("%s entry advances every affected revision", (kind) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["volume-public-" + kind]);
		const volume = kind === "high" ? 100 : kind === "low" ? 0 : 73;
		expect(r.volumeRows).toEqual([
			{ player_volume: volume, configuration_revision: 2 },
			{ player_volume: volume, configuration_revision: 2 },
		]);
		expect(r.volumeActivity).toHaveLength(2);
		if (kind === "chat") expect(r.chatMessages).toEqual([expect.stringContaining("player volume set to 73%")]);
	});
	test.each(["session-free", "chat-downgrade"])("%s actual entry cannot bypass current plan", (kind) => {
		const r = runMcpProbe("browser-playlist-delete-probe", ["volume-public-" + kind]);
		expect(r.volumeRows).toEqual([
			{ player_volume: 50, configuration_revision: 1 },
			{ player_volume: 50, configuration_revision: 1 },
		]);
		expect(r.volumeActivity).toEqual([]);
		expect(r.chatMessages.every((message: string) => !message.includes("player volume set to"))).toBe(true);
		if (kind === "chat-downgrade") expect(r.chatMessages).toEqual([expect.stringContaining("volume could not be changed")]);
	});
});
