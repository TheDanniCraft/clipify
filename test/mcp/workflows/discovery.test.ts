/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-US2-001 bounded creator clip search", () => {
	test("discovers yesterday's Minecraft clips without clip IDs and returns safe titles/links", () => {
		const row = flowProbe("catalogue:workflow:search_clips:success");
		expect(row.result?.structuredContent).toMatchObject({ creatorId: "fixture-creator", complete: true, items: [{ id: "MinecraftClip", title: "Minecraft adventure", url: "https://clips.twitch.tv/MinecraftClip" }] });
		expect(row.safe).toBe(true);
		expect(row.providerCalls).toBe(2);
	});
});
describe("TDD-US2-002 Twitch clip link resolution", () => {
	test("resolves an authorized creator clip link without provider secrets", () => {
		const row = flowProbe("catalogue:workflow:resolve_clip:success");
		expect(row.result?.structuredContent).toMatchObject({ creatorId: "fixture-creator", clip: { id: "MinecraftClip", title: "Minecraft adventure", url: "https://clips.twitch.tv/MinecraftClip" } });
		expect(row.safe).toBe(true);
		expect(row.providerCalls).toBe(1);
	});
});
describe("TDD-US2-003 preview before import", () => {
	test("shows exact clips and confirmation intent without modifying the playlist", () => {
		const row = flowProbe("catalogue:workflow:preview_playlist_import:success");
		expect(row.result?.structuredContent).toMatchObject({ playlistId: row.ids.playlistId, expectedRevision: 1, requiresConfirmation: true, proposed: [{ id: "MinecraftClip", title: "Minecraft adventure" }], duplicates: [], canCommit: true });
		expect(row.result?.structuredContent.previewToken).toEqual(expect.any(String));
		expect(row.playlistItemCount).toBe(0);
		expect(row.safe).toBe(true);
	});
});
describe("TDD-US2-004 confirmed exact import", () => {
	test("commits only the previewed clip and advances the shared playlist revision", () => {
		const row = flowProbe("catalogue:workflow:commit_playlist_import:success");
		expect(row.result?.structuredContent).toMatchObject({ id: row.ids.playlistId, configurationRevision: 2, addedClipIds: ["MinecraftClip"], addedCount: 1 });
		expect(row.playlistItemCount).toBe(1);
		expect(row.safe).toBe(true);
	});
});

describe("TDD-US2-005 preview commit invariants", () => {
	test("retries retain the original result without duplicate clips", () => {
		const row = flowProbe("catalogue:workflow:commit_playlist_import:replay");
		expect(row.replay?.structuredContent).toEqual(row.result?.structuredContent);
		expect(row.playlistItemCount).toBe(1);
	});
	test.each([
		["tampered_preview", "INVALID_INPUT"],
		["stale_revision", "CONFLICT"],
	])("rejects %s without a playlist write", (variant, code) => {
		const row = flowProbe(`catalogue:workflow:commit_playlist_import:${variant}`);
		expect(row.result?.structuredContent?.error?.code).toBe(code);
		expect(row.playlistItemCount).toBe(0);
		expect(row.writes).toBe(0);
	});
});
