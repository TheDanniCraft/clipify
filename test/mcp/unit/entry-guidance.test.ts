/** @jest-environment node */
import { collectionState, clipGuidance, emptyResourceGuidance } from "@/server/mcp/entry-guidance";
const base = { isSyncComplete: false, cachedClipCount: 0, jobs: [], rateLimitedUntil: null };
test.each([
	[base, "not_started"],
	[{ ...base, jobs: [{ status: "queued", failures: 0 }] }, "queued"],
	[{ ...base, jobs: [{ status: "running", failures: 0 }] }, "running"],
	[{ ...base, jobs: [{ status: "scheduled", failures: 1 }] }, "retrying"],
	[{ ...base, cachedClipCount: 3 }, "partial"],
	[{ ...base, isSyncComplete: true }, "ready"],
	[{ ...base, rateLimitedUntil: "2099-01-01T00:00:00Z" }, "rate_limited"],
])("classifies collection state %# from persisted facts", (state, expected) => expect(collectionState(state)).toBe(expected));
test("unstarted and running collections never claim the channel has no clips", () => {
	for (const state of ["not_started", "queued", "running", "retrying", "rate_limited", "partial"] as const) {
		const guidance = clipGuidance(state, false, 0);
		expect(guidance.nextStep.tool).toBe("get_clip_crawler_status");
		expect(guidance.message).not.toContain("No Twitch clips");
	}
});
test("completed empty inventories differ from filters with no matches", () => {
	expect(clipGuidance("ready", false, 0)).toMatchObject({ reason: "empty_collection", nextStep: { tool: null, action: "clarify_goal" } });
	expect(clipGuidance("ready", false, 2).reason).toBe("no_matching_clips");
});
test("refresh is offered only when authorized and not cooling down", () => {
	expect(clipGuidance("not_started", true, 0).nextStep.tool).toBe("refresh_clips");
	expect(clipGuidance("queued", true, 0).nextStep.tool).toBe("get_clip_crawler_status");
});
test("empty resource guidance reuses capabilities and the existing dashboard", () => {
	expect(emptyResourceGuidance("list_overlays")).toMatchObject({ reason: "no_overlays", nextStep: { tool: "get_capabilities" }, dashboardPath: "/dashboard" });
	expect(emptyResourceGuidance("list_playlists").reason).toBe("no_playlists");
});

test("finished history does not hide an unprocessed recent-clips job", () => {
	expect(collectionState({ ...base, isSyncComplete: true, jobs: [{ kind: "recent", status: "queued", failures: 0, lastCompletedAt: null }] })).toBe("queued");
});

test("finished history alone cannot prove a complete current inventory", () => {
	expect(collectionState({ ...base, isSyncComplete: true, cachedClipCount: 2, lastIncrementalSyncAt: null })).toBe("partial");
});
