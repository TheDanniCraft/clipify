jest.mock("@actions/twitch", () => ({ getGamesDetailsBulk: jest.fn(async () => []), getGameDetails: jest.fn(async () => null) }));
/** @jest-environment node */
import { inventoryQuerySchema, queryInventoryClips, readCreatorInventory } from "@/server/creator-library";

const authorizeCreatorOperation = jest.fn();
const cacheRows: unknown[][] = [];
const readRows = jest.fn(async () => cacheRows.shift() ?? []);
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorizeCreatorOperation(...args) }));
jest.mock("@/db/client", () => ({
	db: {
		select: () => {
			const query = { from: () => query, where: () => query, orderBy: () => query, execute: () => readRows() };
			return query;
		},
	},
}));
beforeEach(() => {
	authorizeCreatorOperation.mockReset();
	readRows.mockClear();
	cacheRows.length = 0;
});

describe("creator inventory query", () => {
	it("U56: defaults to newest clips with twenty-five results", () => {
		expect(inventoryQuerySchema.parse({})).toMatchObject({ sort: "newest", page: 1, pageSize: 25 });
	});
	it("U57: rejects a negative view threshold", () => {
		for (const query of [{ minViews: -1 }]) expect(inventoryQuerySchema.safeParse(query).success).toBe(false);
	});
	it("U58: rejects negative and nonfinite durations", () => {
		for (const query of [{ minDuration: -1 }, { maxDuration: -1 }, { minDuration: Infinity }, { maxDuration: NaN }]) expect(inventoryQuerySchema.safeParse(query).success).toBe(false);
	});
	it("U59: rejects reversed duration bounds", () => {
		for (const query of [{ minDuration: 20, maxDuration: 10 }]) expect(inventoryQuerySchema.safeParse(query).success).toBe(false);
	});
	it("U60: rejects malformed and reversed dates", () => {
		for (const query of [{ startedAt: "yesterday" }, { endedAt: "bad" }, { startedAt: "2026-11-03T00:00:00Z", endedAt: "2026-11-02T00:00:00Z" }]) expect(inventoryQuerySchema.safeParse(query).success).toBe(false);
	});
	it("U61: rejects invalid IANA timezones", () => {
		for (const query of [{ timeZone: "Mars/Crater" }]) expect(inventoryQuerySchema.safeParse(query).success).toBe(false);
	});
	it("U63: rejects page sizes over fifty and invalid page numbers", () => {
		for (const query of [{ pageSize: 51 }, { pageSize: 0 }, { page: 0 }, { page: 1.5 }]) expect(inventoryQuerySchema.safeParse(query).success).toBe(false);
	});
	it("U62: accepts the fifty-clip page boundary", () => {
		expect(inventoryQuerySchema.parse({ pageSize: 50 }).pageSize).toBe(50);
	});
});

const clip = (id: string, overrides: Partial<import("@types").TwitchClip> = {}): import("@types").TwitchClip => ({
	id,
	title: "Minecraft caves",
	created_at: "2026-11-01T12:00:00Z",
	game_id: "123",
	view_count: 10,
	duration: 12,
	broadcaster_id: "owner",
	broadcaster_name: "Creator",
	creator_id: "maker",
	creator_name: "Maker",
	video_id: "vod",
	language: "en",
	url: `https://clips.twitch.tv/${id}`,
	embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
	thumbnail_url: "https://static-cdn.jtvnw.net/owned.jpg",
	...overrides,
});

describe("inventory filtering", () => {
	it("U64: matches a case-insensitive title substring", () => {
		const result = queryInventoryClips([clip("Match"), clip("Other", { title: "Different" })], { title: "cAvEs" });
		expect(result.items.map((item) => item.id)).toEqual(["Match"]);
	});
});

it("U65: filters the requested category", () => {
	const result = queryInventoryClips([clip("Match"), clip("Other", { game_id: "999" })], { category: "123" });
	expect(result.items.map((item) => item.id)).toEqual(["Match"]);
});

it("U66: includes the start timestamp", () => {
	expect(queryInventoryClips([clip("Before", { created_at: "2026-11-01T11:59:59Z" }), clip("Boundary")], { startedAt: "2026-11-01T12:00:00Z" }).items.map((item) => item.id)).toEqual(["Boundary"]);
});

it("U67: excludes the end timestamp", () => {
	expect(queryInventoryClips([clip("Before", { created_at: "2026-11-01T11:59:59Z" }), clip("Boundary")], { endedAt: "2026-11-01T12:00:00Z" }).items.map((item) => item.id)).toEqual(["Before"]);
});

it("U68: includes the minimum view threshold", () => {
	expect(queryInventoryClips([clip("Low", { view_count: 9 }), clip("Boundary")], { minViews: 10 }).items.map((item) => item.id)).toEqual(["Boundary"]);
});

it("U69: includes the minimum duration threshold", () => {
	expect(queryInventoryClips([clip("Low", { duration: 11 }), clip("Boundary")], { minDuration: 12 }).items.map((item) => item.id)).toEqual(["Boundary"]);
});

it("U70: includes the maximum duration threshold", () => {
	expect(queryInventoryClips([clip("High", { duration: 13 }), clip("Boundary")], { maxDuration: 12 }).items.map((item) => item.id)).toEqual(["Boundary"]);
});

it("U71: uses the intersection of filters", () => {
	expect(queryInventoryClips([clip("Match"), clip("OtherTitle", { title: "Other" }), clip("OtherCategory", { game_id: "999" }), clip("TooShort", { duration: 11 })], { title: "CAVES", category: "123", minDuration: 12 }).items.map((item) => item.id)).toEqual(["Match"]);
});

it("U72: breaks equal dates by ID", () => {
	expect(queryInventoryClips([clip("Z"), clip("A")], {}).items.map((item) => item.id)).toEqual(["A", "Z"]);
});

it("U73: breaks equal view counts by ID", () => {
	expect(queryInventoryClips([clip("Z"), clip("A"), clip("Higher", { view_count: 20 })], { sort: "most_viewed" }).items.map((item) => item.id)).toEqual(["Higher", "A", "Z"]);
});

it("U74: paginates the filtered identities and counts with the same predicates", () => {
	const clips = [...Array.from({ length: 30 }, (_, index) => clip(`Match${String(index).padStart(2, "0")}`)), ...Array.from({ length: 10 }, (_, index) => clip(`Other${index}`, { title: "Other" }))];
	const result = queryInventoryClips(clips, { title: "caves", page: 2 });
	expect(result.total).toBe(30);
	expect(result.items.map((item) => item.id)).toEqual(["Match25", "Match26", "Match27", "Match28", "Match29"]);
});

it("U92: denies foreign creator access before reading protected cache", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	expect(await readCreatorInventory("foreign")).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	expect(readRows).not.toHaveBeenCalled();
});

it("U87: returns the owner inventory with public metadata", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	cacheRows.push([{ key: "clip:owner:Owned", value: JSON.stringify({ clip: clip("Owned") }), fetchedAt: new Date("2026-11-03T00:00:00Z") }], []);
	expect(await readCreatorInventory("owner")).toMatchObject({ ok: true, total: 1, items: [{ id: "Owned", title: "Minecraft caves", views: 10 }], complete: false });
});

it("U179: reports unavailable when the cache database fails", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	readRows.mockRejectedValueOnce(new Error("database unavailable"));
	expect(await readCreatorInventory("owner")).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
});

it("U45-U47: assigns clips by their VOD ID rather than their creation date", () => {
	const result = queryInventoryClips([clip("Later", { video_id: "12345", created_at: "2026-11-03T00:00:00Z" }), clip("Other", { video_id: "67890" }), clip("Unassigned", { video_id: "" })], { videoId: "12345" });
	expect(result.items.map((clip) => clip.id)).toEqual(["Later"]);
});

it("does not claim completeness when an owned cached clip cannot be validated", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	cacheRows.push([
		{ key: "clip-sync:owner", value: JSON.stringify({ backfillComplete: true }), fetchedAt: new Date() },
		{ key: "clip:owner:Invalid", value: JSON.stringify({ clip: { id: "Invalid" } }), fetchedAt: new Date() },
	]);
	expect(await readCreatorInventory("owner")).toMatchObject({ ok: true, total: 0, complete: false });
});
it("rejects malformed filters before reading cached clips", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	expect(await readCreatorInventory("owner", { page: -1 })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(readRows).not.toHaveBeenCalled();
});
it("returns a correctly ordered page from ten thousand warm clips within two seconds", () => {
	const clips = Array.from({ length: 10000 }, (_, i) => clip(String(i).padStart(5, "0"), { view_count: i }));
	const started = performance.now();
	const result = queryInventoryClips(clips, { sort: "most_viewed", page: 2 });
	expect(result.total).toBe(10000);
	expect(result.items).toHaveLength(25);
	expect(result.items[0].id).toBe("09974");
	expect(performance.now() - started).toBeLessThan(2000);
});
it("deduplicates raw cached clips, excludes unavailable entries and exposes current freshness", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	cacheRows.push([
		{ key: "clip:owner:A", value: JSON.stringify(clip("A", { game_id: undefined })), fetchedAt: new Date("2026-11-01T00:00:00Z") },
		{ key: "clip:owner:Removed", value: JSON.stringify({ unavailable: true }), fetchedAt: new Date() },
		{ key: "clip:owner:A", value: JSON.stringify({ clip: clip("A", { game_id: undefined }) }), fetchedAt: new Date("2026-11-02T00:00:00Z") },
		{ key: "clip-sync:owner", value: JSON.stringify({ backfillComplete: true }), fetchedAt: new Date() },
	]);
	expect(await readCreatorInventory("owner")).toMatchObject({ ok: true, total: 1, complete: true, categories: [], fetchedAt: "2026-11-02T00:00:00.000Z" });
});
it("never projects foreign broadcaster cache metadata even after a valid read grant", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	cacheRows.push([{ key: "clip:owner:Foreign", value: JSON.stringify(clip("Foreign", { broadcaster_id: "foreign" })), fetchedAt: new Date() }]);
	expect(await readCreatorInventory("owner")).toMatchObject({ ok: true, items: [], complete: false });
});
it("returns cached category labels and does not regress freshness for older rows", async () => {
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	cacheRows.push(
		[
			{ key: "clip:owner:A", value: JSON.stringify({ clip: clip("A") }), fetchedAt: new Date("2026-11-02T00:00:00Z") },
			{ key: "clip:owner:B", value: JSON.stringify({ clip: clip("B") }), fetchedAt: new Date("2026-11-01T00:00:00Z") },
		],
		[{ value: JSON.stringify({ id: "123", name: "Game" }) }],
	);
	expect(await readCreatorInventory("owner")).toMatchObject({ ok: true, total: 2, categories: [{ id: "123", name: "Game" }], fetchedAt: "2026-11-02T00:00:00.000Z" });
});
describe("private inventory preview authority", () => {
	it("authorizes the current creator before invoking its existing cache reader", async () => {
		authorizeCreatorOperation.mockResolvedValue({ allowed: true });
		const read = jest.fn().mockResolvedValue(clip("A"));
		const { canPreviewInventoryClip } = await import("@/server/creator-library");
		expect(await canPreviewInventoryClip({ creatorId: "owner", contextCreatorId: "owner", clipId: "A" }, read)).toBe(true);
		expect(authorizeCreatorOperation).toHaveBeenCalledWith({ creatorId: "owner", resourceOwnerId: "owner", permission: "creator:read" });
		expect(read).toHaveBeenCalledTimes(1);
	});
	it("denies a mismatched creator before authority or cache reads", async () => {
		const read = jest.fn();
		const { canPreviewInventoryClip } = await import("@/server/creator-library");
		expect(await canPreviewInventoryClip({ creatorId: "owner", contextCreatorId: "foreign", clipId: "A" }, read)).toBe(false);
		expect(authorizeCreatorOperation).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
	});
	it.each(["AUTHENTICATION_REQUIRED", "PERMISSION_DENIED", "ACCOUNT_SUSPENDED"])("denies %s before reading cached playback metadata", async (code) => {
		authorizeCreatorOperation.mockResolvedValue({ allowed: false, code });
		const read = jest.fn();
		const { canPreviewInventoryClip } = await import("@/server/creator-library");
		expect(await canPreviewInventoryClip({ creatorId: "owner", contextCreatorId: "owner", clipId: "A" }, read)).toBe(false);
		expect(read).not.toHaveBeenCalled();
	});
	it.each([null, clip("Wrong"), clip("A", { broadcaster_id: "foreign" })])("rejects missing, mismatched or foreign cached clip %#", async (cached) => {
		authorizeCreatorOperation.mockResolvedValue({ allowed: true });
		const { canPreviewInventoryClip } = await import("@/server/creator-library");
		expect(await canPreviewInventoryClip({ creatorId: "owner", contextCreatorId: "owner", clipId: "A" }, async () => cached)).toBe(false);
	});
});

it("resolves cold category metadata without exposing provider-only fields", async () => {
	const { getGamesDetailsBulk } = await import("@actions/twitch");
	jest.mocked(getGamesDetailsBulk).mockResolvedValueOnce([{ id: "123", name: "Just Chatting", box_art_url: "https://static-cdn.jtvnw.net/boxart/{width}x{height}.jpg", igdb_id: "private" }]);
	authorizeCreatorOperation.mockResolvedValue({ allowed: true });
	cacheRows.push([{ key: "clip:owner:A", value: JSON.stringify(clip("A")), fetchedAt: new Date() }], []);
	const result = await readCreatorInventory("owner");
	expect(result).toMatchObject({ ok: true, categories: [{ id: "123", name: "Just Chatting", artworkUrl: "https://static-cdn.jtvnw.net/boxart/40x56.jpg" }] });
	expect(getGamesDetailsBulk).toHaveBeenCalledWith(["123"], "owner");
	expect(JSON.stringify(result)).not.toContain("private");
});
