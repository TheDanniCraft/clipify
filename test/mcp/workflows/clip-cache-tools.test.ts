/** @jest-environment node */
import { toolInputSchemas } from "@/server/mcp/schemas";
import { toolPermissions } from "@/server/mcp/permissions";
import { workflowDescriptions as toolDescriptions } from "@/server/mcp/workflows/catalogue";
import { workflowAnnotations } from "@/server/mcp/workflows/catalogue";
test.each([
	["get_clip_crawler_status", "creator:read"],
	["refresh_clips", "creator:update"],
])("%s has owner-bound input and explicit permission", (name, permission) => {
	const schema = (toolInputSchemas as any)[name];
	expect(schema).toBeDefined();
	expect(schema.safeParse({ creatorId: "creator" }).success).toBe(true);
	expect(schema.safeParse({ creatorId: "creator", email: "changed@example.org" }).success).toBe(false);
	expect((toolPermissions as any)[name]).toBe(permission);
	expect((toolDescriptions as any)[name]).toMatch(/cache|crawl/i);
});
test("refresh is a mutation and status is read-only", () => {
	expect(workflowAnnotations("get_clip_crawler_status" as any).readOnlyHint).toBe(true);
	expect(workflowAnnotations("refresh_clips" as any).readOnlyHint).toBe(false);
});

import { flowProbe } from "../../support/mcp/probe";
test("crawler status reads the real persisted collection without Twitch requests", () => {
	const row = flowProbe("catalogue:workflow:get_clip_crawler_status:success");
	expect(row.result?.structuredContent).toMatchObject({ creatorId: "fixture-creator", cachedClipCount: 2, isSyncComplete: true, canRefresh: true });
	expect(row.providerCalls).toBe(0);
});
test("MCP refresh honors the dashboard cooldown without external requests", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:cooldown");
	expect(row.result?.structuredContent).toMatchObject({ ok: false, reason: "cooldown" });
	expect(row.providerCalls).toBe(0);
});
test.each(["get_clip_crawler_status", "refresh_clips"])("%s rejects an unapproved creator", (tool) => {
	const row = flowProbe(`catalogue:workflow:${tool}:wrong_creator`);
	expect(row.result?.structuredContent.error.code).toMatch(/ACCESS_DENIED|RESOURCE_UNAVAILABLE/);
	expect(row.providerCalls).toBe(0);
});
test("pagination exposes all 1200 cached clips, including pages beyond offset 500", () => {
	const row = flowProbe("catalogue:workflow:search_clips:cached_large");
	expect(row.allClipIds).toHaveLength(1200);
	expect(new Set(row.allClipIds).size).toBe(1200);
	expect(row.providerCalls).toBe(0);
});

test("refresh is unavailable to a read-only connection", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:read_only");
	expect(row.result?.structuredContent.error.code).toMatch(/ACCESS_DENIED|MISSING_SCOPE/);
	expect(row.providerCalls).toBe(0);
});
test("a changed collection rejects a stale search continuation", () => {
	const row = flowProbe("catalogue:workflow:search_clips:cache_changed");
	expect(row.nextPage?.structuredContent.error.code).toBe("CONFLICT");
	expect(row.providerCalls).toBe(0);
});

test("an accepted MCP refresh preserves existing clips and records its cooldown", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:success");
	expect(row.result?.structuredContent).toMatchObject({ ok: true, accepted: true });
	expect(row.cachedClipCount).toBe(2);
	expect(row.crawlerState.lastIncrementalSyncAt).toEqual(expect.any(String));
	expect(row.providerCalls).toBeGreaterThan(0);
	expect(row.result?.structuredContent.nextAllowedAt).toEqual(expect.any(String));
});

test("a priority MCP refresh keeps the existing historical checkpoint intact", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:history_incomplete");
	expect(row.result?.structuredContent).toMatchObject({ ok: true, accepted: true });
	expect(row.crawlerState).toMatchObject({ backfillWindowEnd: "2020-01-01T00:00:00.000Z", backfillCursor: "history-cursor", backfillWindowPages: 2, lastIncrementalSyncAt: expect.any(String) });
	expect(row.crawlJobs).toEqual([
		{ kind: "backfill", requested: false, leased: false, scheduled: true },
		{ kind: "recent", requested: false, leased: false, scheduled: true },
	]);
});

test("a busy creator accepts a durable priority refresh without duplicate Twitch work", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:busy");
	expect(row.result?.structuredContent).toMatchObject({ ok: true, accepted: true });
	expect(row.providerCalls).toBe(0);
	expect(row.crawlJobs).toContainEqual({ kind: "recent", requested: true, leased: false, scheduled: true });
});

test("a bounded priority refresh resumes its persisted cursor without restarting the scan", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:bounded_recent");
	expect(row.result?.structuredContent).toMatchObject({ ok: true, accepted: true });
	expect(row.firstRefreshCalls).toBe(5);
	expect(row.providerCalls).toBe(7);
	expect(row.crawlRequests[5]).toMatchObject({ start: row.crawlRequests[0].start, end: row.crawlRequests[0].end, cursor: "page-5" });
	expect(row.crawlerState.lastIncrementalSyncAt).toEqual(expect.any(String));
	expect(row.crawlJobs).toContainEqual({ kind: "recent", requested: false, leased: false, scheduled: true });
});

test("an authorization transaction rollback leaves neither a queued refresh nor a cooldown", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:authorization_rollback");
	expect(row.result?.structuredContent?.error.code).toBe("SERVICE_UNAVAILABLE");
	expect(row.crawlJobs).toEqual([]);
	expect(row.forcedRefreshRecorded).toBe(false);
	expect(row.providerCalls).toBe(0);
});

test("bounded historical jobs persist their cursor and resume the same date window", () => {
	const row = flowProbe("catalogue:workflow:refresh_clips:backfill_resume");
	expect(row.result?.structuredContent).toMatchObject({ ok: true, accepted: true });
	expect(row.firstRefreshCalls).toBe(1);
	expect(row.firstBackfillCalls).toBe(5);
	expect(row.firstBackfillState).toMatchObject({ backfillComplete: false, backfillWindowEnd: "2020-01-01T00:00:00.000Z", backfillCursor: "page-6" });
	expect(row.crawlRequests[1].cursor).toBe("history-cursor");
	expect(row.crawlRequests[6]).toMatchObject({ start: row.crawlRequests[1].start, end: row.crawlRequests[1].end, cursor: "page-6" });
	expect(row.providerCalls).toBeLessThanOrEqual(11);
	expect(row.cachedClipCount).toBe(2);
});
