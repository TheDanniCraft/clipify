/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-009 get_playlist through authenticated MCP", () => {
	test("preserves item identity and order across malformed and legacy stored metadata", () => {
		const result = flowProbe("resources:playlist-get:legacy-metadata");
		expect(result.resourceResult?.items).toEqual([
			{ id: "Legacy0", position: 0 },
			{ id: "Legacy1", position: 1 },
			{ id: "Legacy2", position: 2 },
			{ id: "Legacy3", position: 3 },
			{ id: "Legacy4", position: 4, title: "Wrapped clip", duration: 8 },
			{ id: "Legacy5", position: 5 },
			{ id: "Legacy6", position: 6, title: "Plain clip", duration: 9 },
		]);
		expect(JSON.stringify(result.resourceResult)).not.toContain("private-metadata-token");
	});

	test("returns stored clip attribution and thumbnails without losing playlist identity", () => {
		const result = flowProbe("resources:playlist-get:clip-metadata");
		expect(result.resourceResult?.items[0]).toMatchObject({ id: "ClipFirst", position: 0, title: "First clip", duration: 10, url: "https://clips.twitch.tv/ClipFirst", thumbnailUrl: "https://static-cdn.jtvnw.net/first.jpg", broadcasterId: "fixture-creator", broadcasterName: "Fixture creator", clipCreatorId: "clipper-id", clipCreatorName: "Fixture clipper", categoryId: "27471", views: 100, createdAt: "2026-10-06T12:00:00Z" });
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/WrongStoredId|private-clip-token/);
	});

	test("parent revision and item metadata belong to one snapshot during an atomic writer", () => {
		const result = flowProbe("resources:playlist-get:snapshot");
		expect(result.snapshotInterleaved).toBe(true);
		expect(result.resourceResult?.playlist).toMatchObject({ name: "Existing playlist", configurationRevision: 1 });
		expect(result.resourceResult?.items[0]).toMatchObject({ id: "ClipFirst", title: "First clip", duration: 10 });
	});

	test("returns safe metadata, ordered items and revision", () => {
		const result = flowProbe("resources:playlist-get");
		expect(result.resourceResult?.playlist).toMatchObject({ creatorId: "fixture-creator", name: "Existing playlist", configurationRevision: 1 });
		expect(result.resourceResult?.items).toEqual([
			{ id: "ClipFirst", position: 0, title: "First clip", duration: 10 },
			{ id: "ClipSecond", position: 1, title: "Second clip", duration: 12 },
		]);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/secret|token|ownerId/);
	});
	test.each([
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
	])("%s playlist read returns a safe failure", (mode, code) => {
		const result = flowProbe(`resources:playlist-get:${mode}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/Existing playlist|First clip|secret|token/);
	});
});
