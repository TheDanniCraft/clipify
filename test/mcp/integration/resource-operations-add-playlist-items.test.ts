/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-013 add_playlist_items through authenticated MCP", () => {
	test("uses creator provider credentials and appends only validated safe references", () => {
		const result = flowProbe("resources:playlist-add");
		expect(result.resourceResult?.playlist?.configurationRevision).toBe(2);
		expect(result.persistedItems).toEqual([
			{ clip_id: "ClipFirst", position: 0 },
			{ clip_id: "ClipSecond", position: 1 },
			{ clip_id: "NewFirst", position: 2 },
			{ clip_id: "NewSecond", position: 3 },
		]);
		expect(result.externalClipRequests).toBe(1);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-|secret|token|ownerId/);
	});
	test.each([
		["stale", "CONFLICT"],
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
		["no-credentials", "SERVICE_UNAVAILABLE"],
		["provider-error", "SERVICE_UNAVAILABLE"],
		["not-found", "INVALID_INPUT"],
		["invalid-provider", "INVALID_INPUT"],
		["revoked-during-fetch", "ACCESS_DENIED"],
		["revision-during-fetch", "CONFLICT"],
	])("%s append preserves items", (variant, code) => {
		const result = flowProbe(`resources:playlist-add:${variant}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(result.persistedPlaylist.configuration_revision).toBe(variant === "revision-during-fetch" ? 2 : 1);
		expect(result.persistedItems).toEqual([
			{ clip_id: "ClipFirst", position: 0 },
			{ clip_id: "ClipSecond", position: 1 },
		]);
		if (["stale", "missing", "denied", "no-credentials"].includes(variant)) expect(result.externalClipRequests).toBe(0);
	});
	test("Free clip allowance is enforced atomically", () => {
		const result = flowProbe("resources:playlist-add:limit");
		expect(result.resourceResult?.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 50, limit: 50 });
		expect(result.persistedItems).toHaveLength(50);
		expect(result.persistedPlaylist.configuration_revision).toBe(1);
	});
	test("current Pro owner may append beyond the Free allowance", () => {
		const result = flowProbe("resources:playlist-add:pro-limit");
		expect(result.resourceResult?.playlist?.configurationRevision).toBe(2);
		expect(result.persistedItems).toHaveLength(52);
	});
	test("requires explicitly approved item-management scope", () => {
		const result = flowProbe("resources:playlist-add:no-scope");
		expect(result.protocolStatus).toBe(403);
		expect(result.externalClipRequests).toBe(0);
	});
});

test("unsafe stored result projection rolls back append and its success audit", () => {
	const result = flowProbe("resources:playlist-add:invalid-result");
	expect(result.resourceResult.error.code).toBe("SERVICE_UNAVAILABLE");
	expect(result.persistedPlaylist.configuration_revision).toBe(1);
	expect(result.persistedItems).toEqual([
		{ clip_id: "ClipFirst", position: 0 },
		{ clip_id: "ClipSecond", position: 1 },
	]);
	expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
	expect(result.externalClipRequests).toBe(1);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-result|secret|token/);
});
