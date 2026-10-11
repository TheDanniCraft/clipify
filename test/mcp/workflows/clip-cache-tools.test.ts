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
