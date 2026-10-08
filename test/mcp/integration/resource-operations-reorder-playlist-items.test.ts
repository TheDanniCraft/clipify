/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-015 reorder_playlist_items through authenticated MCP", () => {
	test("accepts an exact permutation and persists order with a new revision", () => {
		const result = flowProbe("resources:playlist-reorder");
		expect(result.resourceResult?.playlist?.configurationRevision).toBe(2);
		expect(result.resourceResult?.items?.map((item: any) => [item.id, item.position])).toEqual([
			["ClipSecond", 0],
			["ClipFirst", 1],
		]);
		expect(result.persistedItems).toEqual([
			{ clip_id: "ClipSecond", position: 0 },
			{ clip_id: "ClipFirst", position: 1 },
		]);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-|secret|token|ownerId/);
	});
	test.each([
		["stale", "CONFLICT"],
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
		["omit", "INVALID_INPUT"],
		["extra", "INVALID_INPUT"],
		["duplicate", "INVALID_INPUT"],
		["empty", "INVALID_INPUT"],
	])("%s permutation preserves all rows", (variant, code) => {
		const result = flowProbe(`resources:playlist-reorder:${variant}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(result.persistedPlaylist.configuration_revision).toBe(1);
		expect(result.persistedItems).toEqual([
			{ clip_id: "ClipFirst", position: 0 },
			{ clip_id: "ClipSecond", position: 1 },
		]);
	});
	test("empty permutation is valid for an empty playlist", () => {
		const result = flowProbe("resources:playlist-reorder:empty-playlist");
		expect(result.resourceResult?.playlist?.configurationRevision).toBe(2);
		expect(result.resourceResult?.items).toEqual([]);
	});
	test("requires approved item-management scope", () => {
		const result = flowProbe("resources:playlist-reorder:no-scope");
		expect(result.protocolStatus).toBe(403);
		expect(result.challenge).toContain("insufficient_scope");
		expect(result.persistedPlaylist.configuration_revision).toBe(1);
	});
});
