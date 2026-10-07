/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-014 remove_playlist_items through authenticated MCP", () => {
	test("removes selected items and normalizes remaining order with a new revision", () => {
		const result = flowProbe("resources:playlist-remove");
		expect(result.resourceResult?.playlist?.configurationRevision).toBe(2);
		expect(result.resourceResult?.items).toEqual([{ id: "ClipSecond", position: 0, title: "Second clip", duration: 12 }]);
		expect(result.persistedItems).toEqual([{ clip_id: "ClipSecond", position: 0 }]);
		expect(result.persistedPlaylist.configuration_revision).toBe(2);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-|secret|token|ownerId/);
	});
	test.each([
		["stale", "CONFLICT"],
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
		["unknown-item", "INVALID_INPUT"],
		["mixed-items", "INVALID_INPUT"],
	])("%s removal is atomic", (variant, code) => {
		const result = flowProbe(`resources:playlist-remove:${variant}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(result.persistedPlaylist.configuration_revision).toBe(1);
		expect(result.persistedItems).toEqual([
			{ clip_id: "ClipFirst", position: 0 },
			{ clip_id: "ClipSecond", position: 1 },
		]);
	});
	test("requires explicitly approved item-management scope", () => {
		const result = flowProbe("resources:playlist-remove:no-scope");
		expect(result.protocolStatus).toBe(403);
		expect(result.challenge).toContain("insufficient_scope");
		expect(result.persistedPlaylist.configuration_revision).toBe(1);
	});
});
