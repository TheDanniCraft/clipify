/** @jest-environment node */
import { collectionState, clipGuidance, emptyResourceGuidance, firstOverlayGuidance } from "@/server/mcp/entry-guidance";
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

test("first overlay guidance distinguishes a running import from a completed empty channel", () => {
	const running = firstOverlayGuidance({ ...base, jobs: [{ status: "running", failures: 0 }] }, { allowed: true });
	expect(running).toMatchObject({ reason: "running", tool: "get_clip_crawler_status", message: expect.stringContaining("still running") });
	const empty = firstOverlayGuidance({ ...base, isSyncComplete: true }, { allowed: true });
	expect(empty).toMatchObject({ reason: "empty_collection", tool: null, message: expect.stringContaining("check the connected channel") });
});

test("cached clips lead to first overlay setup even while more history imports", () => {
	const partial = { ...base, cachedClipCount: 10, jobs: [{ status: "running", failures: 0 }] };
	expect(firstOverlayGuidance(partial, { allowed: true })).toMatchObject({ tool: "create_overlay", message: expect.stringContaining("10 Twitch clips are available so far") });
	const ready = { ...partial, isSyncComplete: true };
	expect(firstOverlayGuidance(ready, { allowed: false, reason: "ACCESS_DENIED" })).toMatchObject({ tool: null, message: expect.stringContaining("Get your first overlay running") });
});

test("unavailable status does not send an empty account to create an overlay blindly", () => {
	expect(firstOverlayGuidance(null, { allowed: true })).toMatchObject({ tool: "get_clip_crawler_status", reason: "status_unavailable" });
});
