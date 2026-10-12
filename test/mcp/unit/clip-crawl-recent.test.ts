/** @jest-environment node */
import { crawlRecentClips, type RecentCrawlState } from "@/server/clip-crawler/recent";
import type { TwitchClip } from "@/app/lib/types";
const now = Date.parse("2026-10-12T00:00:00Z");
const clip = (id: string, createdAt: number) => ({ id, created_at: new Date(createdAt).toISOString() }) as TwitchClip;
test("bounded jobs resume the same query cursor instead of starting over", async () => {
	const state: RecentCrawlState = {};
	const ranges: Array<string[]> = [];
	const fetch = jest.fn(async (start: string, end: string, cursor?: string) => {
		ranges.push([start, end]);
		return { clips: [clip("one", now - 1000)], cursor: cursor ? undefined : "next" };
	});
	const store = jest.fn(async () => {});
	expect(await crawlRecentClips(state, { now, budget: 1, force: false, fetch, store })).toMatchObject({ pending: true, requestsUsed: 1 });
	expect(state.lastIncrementalSyncAt).toBeUndefined();
	expect(await crawlRecentClips(state, { now: now + 10000, budget: 1, force: false, fetch, store })).toMatchObject({ pending: false, requestsUsed: 1 });
	expect(fetch.mock.calls[1][2]).toBe("next");
	expect(ranges[1]).toEqual(ranges[0]);
	expect(state.lastIncrementalSyncAt).toBe(new Date(now).toISOString());
});
test("a failed cache write cannot advance the provider cursor", async () => {
	const state: RecentCrawlState = {};
	await expect(
		crawlRecentClips(state, {
			now,
			budget: 1,
			force: false,
			fetch: async () => ({ clips: [clip("one", now)], cursor: "next" }),
			store: async () => {
				throw new Error("Database unavailable");
			},
		}),
	).rejects.toThrow("Database unavailable");
	expect(state.recentCursor).toBeUndefined();
	expect(state.lastIncrementalSyncAt).toBeUndefined();
});
test("adaptive windows collect beyond Twitch's 1000-result cap across bounded jobs", async () => {
	const source = Array.from({ length: 1500 }, (_, i) => clip(String(i), now - (i + 1) * 300000));
	const stored = new Set<string>();
	const state: RecentCrawlState = {};
	let maximumRequests = 0;
	const fetch = async (start: string, end: string, cursor?: string) => {
		const range = source.filter((c) => Date.parse(c.created_at) >= Date.parse(start) && Date.parse(c.created_at) <= Date.parse(end)).slice(0, 1000);
		const offset = Number(cursor ?? 0),
			clips = range.slice(offset, offset + 100);
		return { clips, cursor: offset + 100 < range.length ? String(offset + 100) : undefined };
	};
	let completed = false;
	for (let i = 0; i < 100 && !completed; i++) {
		const result = await crawlRecentClips(state, {
			now,
			budget: 5,
			force: false,
			fetch,
			store: async (clips) => {
				clips.forEach((c) => stored.add(c.id));
			},
		});
		maximumRequests = Math.max(maximumRequests, result.requestsUsed);
		completed = !result.pending;
	}
	expect(completed).toBe(true);
	expect(maximumRequests).toBeLessThanOrEqual(5);
	expect(stored.size).toBe(1500);
});
test("manual refresh restarts only recent scanning, not historical progress", async () => {
	const state: RecentCrawlState & { backfillWindowEnd: string } = { recentScanEnd: new Date(now - 10000).toISOString(), recentCursor: "old", backfillWindowEnd: "2020-01-01T00:00:00Z" };
	const fetch = jest.fn(async () => ({ clips: [], cursor: undefined }));
	await crawlRecentClips(state, { now, budget: 1, force: true, fetch, store: async () => {} });
	expect(fetch.mock.calls[0]).toHaveLength(3);
	expect(state.backfillWindowEnd).toBe("2020-01-01T00:00:00Z");
	expect(state.lastIncrementalSyncAt).toBe(new Date(now).toISOString());
});
