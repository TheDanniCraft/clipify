/** @jest-environment node */
export {};

const getTwitchCacheByPrefixEntries = jest.fn();
jest.mock("@actions/database", () => ({ getTwitchCacheByPrefixEntries: (...args: unknown[]) => getTwitchCacheByPrefixEntries(...args) }));

describe("internal clip cache reader", () => {
	beforeEach(() => {
		getTwitchCacheByPrefixEntries.mockReset();
	});

	it.each([{ id: "Broken" }, { id: "Foreign", broadcaster_id: "other-owner" }])("rejects invalid stored clips for strict discovery while ordinary reads hide them", async (value) => {
		getTwitchCacheByPrefixEntries.mockResolvedValue([{ key: `clip:owner-1:${value.id}`, value }]);
		const { readCachedClipsByOwner } = await import("@/server/clip-cache-read");
		await expect(readCachedClipsByOwner("owner-1")).resolves.toEqual([]);
		await expect(readCachedClipsByOwner("owner-1", undefined, { rejectInvalid: true })).rejects.toThrow("INVALID_CACHED_CLIP");
	});

	it("returns valid owner clips in strict mode", async () => {
		const clip = { id: "Owned", broadcaster_id: "owner-1" };
		getTwitchCacheByPrefixEntries.mockResolvedValue([{ key: "clip:owner-1:Owned", value: clip }]);
		const { readCachedClipsByOwner } = await import("@/server/clip-cache-read");
		await expect(readCachedClipsByOwner("owner-1", undefined, { rejectInvalid: true })).resolves.toEqual([clip]);
	});
});
