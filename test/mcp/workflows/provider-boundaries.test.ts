/** @jest-environment node */
import { fetchClipDiscovery } from "@/server/resources/clip-discovery";
import { getCreatorSyncProgress } from "@/app/actions/twitch";
import { readCachedClipsByOwner } from "@/server/clip-cache-read";
import { getTwitchCacheBatch } from "@/app/actions/database";
jest.mock("@/server/tokens", () => ({ getAccessTokenInternal: jest.fn(async () => null) }));
jest.mock("@/app/actions/twitch", () => ({ getCreatorSyncProgress: jest.fn() }));
jest.mock("@/server/clip-cache-read", () => ({ readCachedClipsByOwner: jest.fn() }));
jest.mock("@/app/actions/database", () => ({ getTwitchCacheBatch: jest.fn() }));
const clip = { id: "Clip", title: "Minecraft", broadcaster_id: "creator", duration: 12, created_at: "2026-10-06T12:00:00Z", game_id: "27471", view_count: 1 };
beforeEach(() => {
	jest.mocked(readCachedClipsByOwner).mockResolvedValue([clip] as any);
	jest.mocked(getCreatorSyncProgress).mockResolvedValue({ isSyncComplete: true, syncProgress: 1, backfillWindowEnd: null });
	jest.mocked(getTwitchCacheBatch).mockResolvedValue([{ id: "27471", name: "Minecraft" }] as any);
});
test("search filters the entire stored collection beyond Twitch page limits without network traffic", async () => {
	const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No external requests allowed"));
	jest.mocked(readCachedClipsByOwner).mockResolvedValue(Array.from({ length: 1200 }, (_, n) => ({ ...clip, id: `Clip${n}`, view_count: n })) as any);
	try {
		const result = await fetchClipDiscovery("creator", { minViews: 1100, category: "Minecraft" });
		expect(result.clips).toHaveLength(100);
		expect(result.scanned).toBe(1200);
		expect(result.complete).toBe(true);
		expect(fetch).not.toHaveBeenCalled();
	} finally {
		fetch.mockRestore();
	}
});
test("an unfinished crawler is never described as a complete collection", async () => {
	jest.mocked(getCreatorSyncProgress).mockResolvedValue({ isSyncComplete: false, syncProgress: 0.4, backfillWindowEnd: null });
	expect(await fetchClipDiscovery("creator", {})).toMatchObject({ complete: false, clips: [clip] });
});
test("unknown categories return no matches", async () => {
	expect((await fetchClipDiscovery("creator", { category: "Unknown" })).clips).toEqual([]);
});
test("foreign cached clips cannot be exposed", async () => {
	jest.mocked(readCachedClipsByOwner).mockResolvedValue([{ ...clip, broadcaster_id: "foreign" }] as any);
	await expect(fetchClipDiscovery("creator", {})).rejects.toThrow("SERVICE_UNAVAILABLE");
});

test("missing game metadata is not reported as a complete empty search", async () => {
	jest.mocked(getTwitchCacheBatch).mockResolvedValue([]);
	expect(await fetchClipDiscovery("creator", { category: "Minecraft" })).toMatchObject({ clips: [], complete: false });
});
