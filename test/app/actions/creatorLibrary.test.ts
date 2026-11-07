/** @jest-environment node */
import { getCreatorClipSelection, refreshCreatorLibrary, getCreatorClipInventory, getCreatorClipPreview, getCreatorClipOverview, getCreatorBroadcasts, getCreatorBroadcast, searchCreatorLibrary, getCreatorClipDetail } from "@actions/creatorLibrary";
const authorize = jest.fn();
const refresh = jest.fn();
const token = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@/server/clip-cache", () => ({ refreshCreatorClips: (...args: unknown[]) => refresh(...args) }));
jest.mock("@/server/tokens", () => ({ getAccessTokenResultInternal: (...args: unknown[]) => token(...args) }));
jest.mock("@/server/creator-library", () => ({ readCreatorClipSelection: (...args: unknown[]) => selection(...args), readCreatorInventory: (...args: unknown[]) => inventory(...args), readCreatorClipDetail: (...args: unknown[]) => detail(...args) }));
jest.mock("@actions/twitch", () => ({ getTwitchClipPlaybackUrl: (...args: unknown[]) => playback(...args) }));
it("denies a foreign creator refresh before starting work", async () => {
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	expect(await refreshCreatorLibrary({ creatorId: "foreign" })).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	expect(refresh).not.toHaveBeenCalled();
});

it("starts the existing clip sync for an authorized account without requiring an overlay", async () => {
	authorize.mockResolvedValue({ allowed: true });
	token.mockResolvedValue({ token: { accessToken: "private" } });
	refresh.mockResolvedValue({ ok: true, accepted: true, nextAllowedAt: "2026-11-04T00:00:00Z" });
	expect(await refreshCreatorLibrary({ creatorId: "owner" })).toMatchObject({ ok: true, accepted: true });
	expect(refresh).toHaveBeenCalledWith("owner");
});

const selection = jest.fn();
const inventory = jest.fn();
const detail = jest.fn();
const playback = jest.fn();
const overview = jest.fn();
const broadcasts = jest.fn();
jest.mock("@/server/creator-overview", () => ({ readCreatorOverview: (...args: unknown[]) => overview(...args) }));
jest.mock("@/server/creator-broadcasts", () => ({ readCreatorBroadcasts: (...args: unknown[]) => broadcasts(...args) }));
describe("creator library action boundaries", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});
	it.each([undefined, {}, { creatorId: 3 }, { creatorId: "" }, { creatorId: "x".repeat(201) }])("rejects invalid inventory input %#", async (input) => {
		expect(await getCreatorClipInventory(input as never)).toEqual({ ok: false, code: "INVALID_INPUT" });
		expect(inventory).not.toHaveBeenCalled();
	});
	it("passes a validated inventory request to its authorizing service", async () => {
		inventory.mockResolvedValue({ ok: true, items: [] });
		expect(await getCreatorClipInventory({ creatorId: "owner", query: { page: 2 } })).toEqual({ ok: true, items: [] });
		expect(inventory).toHaveBeenCalledWith("owner", { page: 2 });
	});
	it.each([undefined, {}, { creatorId: 3, clipId: "A" }, { creatorId: "owner", clipId: 3 }, { creatorId: "x".repeat(201), clipId: "A" }, { creatorId: "owner", clipId: "x".repeat(201) }])("rejects invalid preview input %#", async (input) => {
		expect(await getCreatorClipPreview(input as never)).toBeNull();
		expect(playback).not.toHaveBeenCalled();
	});
	it("uses the private inventory preview authorization context", async () => {
		playback.mockResolvedValue("https://media.test/clip.mp4");
		expect(await getCreatorClipPreview({ creatorId: "owner", clipId: "A" })).toEqual({ playbackUrl: "https://media.test/clip.mp4" });
		expect(playback).toHaveBeenCalledWith("A", "owner", { kind: "inventory", creatorId: "owner" });
		playback.mockResolvedValue(null);
		expect(await getCreatorClipPreview({ creatorId: "owner", clipId: "A" })).toBeNull();
	});
	it("passes explicit preview retries through the inventory authorization context", async () => {
		playback.mockResolvedValue("https://media.test/new.mp4");
		await getCreatorClipPreview({ creatorId: "owner", clipId: "A", refresh: true } as never);
		expect(playback).toHaveBeenCalledWith("A", "owner", { kind: "inventory", creatorId: "owner", refresh: true });
		playback.mockClear();
		expect(await getCreatorClipPreview({ creatorId: "owner", clipId: "A", refresh: "yes" } as never)).toBeNull();
		expect(playback).not.toHaveBeenCalled();
	});
	it("rejects invalid overview and broadcast requests", async () => {
		for (const input of [undefined, {}, { creatorId: 3 }, { creatorId: "owner", timeZone: 3 }]) expect(await getCreatorClipOverview(input as never)).toMatchObject({ ok: false });
		for (const input of [undefined, {}, { creatorId: 3 }, { creatorId: "owner", after: 3 }]) expect(await getCreatorBroadcasts(input as never)).toMatchObject({ ok: false });
		for (const input of [undefined, {}, { creatorId: 3, videoId: "1" }, { creatorId: "owner", videoId: 3 }]) expect(await getCreatorBroadcast(input as never)).toMatchObject({ ok: false });
	});
	it("reads the requested overview and broadcast page", async () => {
		overview.mockResolvedValue({ ok: true, count: 4 });
		broadcasts.mockResolvedValue({ ok: true, items: [] });
		expect(await getCreatorClipOverview({ creatorId: "owner", timeZone: "UTC" })).toEqual({ ok: true, count: 4 });
		expect(overview).toHaveBeenCalledWith("owner", "UTC");
		expect(await getCreatorBroadcasts({ creatorId: "owner", after: "opaque" })).toMatchObject({ ok: true });
		expect(broadcasts).toHaveBeenCalledWith("owner", "opaque");
	});
	it("distinguishes a found broadcast, a missing one and an authorization failure", async () => {
		broadcasts
			.mockResolvedValueOnce({ ok: true, items: [{ id: "1" }], fetchedAt: "now", stale: false })
			.mockResolvedValueOnce({ ok: true, items: [] })
			.mockResolvedValueOnce({ ok: false, code: "PERMISSION_DENIED" });
		expect(await getCreatorBroadcast({ creatorId: "owner", videoId: "1" })).toMatchObject({ ok: true, broadcast: { id: "1" } });
		expect(await getCreatorBroadcast({ creatorId: "owner", videoId: "2" })).toEqual({ ok: false, code: "NOT_FOUND" });
		expect(await getCreatorBroadcast({ creatorId: "owner", videoId: "3" })).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	});
	it.each([undefined, {}, { creatorId: "owner", title: 3 }, { creatorId: "owner", title: "a" }, { creatorId: "owner", title: "x".repeat(1001) }])("rejects invalid search input %#", async (input) => expect(await searchCreatorLibrary(input as never)).toMatchObject({ ok: false }));
	it("trims clip search and bounds its result count", async () => {
		inventory.mockResolvedValue({ ok: true, items: [] });
		await searchCreatorLibrary({ creatorId: "owner", title: "  clutch  " });
		expect(inventory).toHaveBeenCalledWith("owner", { title: "clutch", pageSize: 10 });
	});
	it.each([undefined, {}, { creatorId: 3 }, { creatorId: "" }, { creatorId: "x".repeat(201) }])("rejects invalid refresh input %#", async (input) => expect(await refreshCreatorLibrary(input as never)).toMatchObject({ ok: false, code: "INVALID_INPUT" }));
	it("returns reconnection, cooldown and controlled transport failures", async () => {
		authorize.mockResolvedValue({ allowed: true });
		token.mockResolvedValueOnce({ token: null }).mockResolvedValue({ token: { accessToken: "private" } });
		expect(await refreshCreatorLibrary({ creatorId: "owner" })).toEqual({ ok: false, code: "RECONNECT_REQUIRED" });
		refresh.mockResolvedValueOnce({ ok: false, nextAllowedAt: "later" }).mockRejectedValueOnce(new Error("private"));
		expect(await refreshCreatorLibrary({ creatorId: "owner" })).toEqual({ ok: false, code: "SYNC_COOLDOWN", nextAllowedAt: "later" });
		expect(await refreshCreatorLibrary({ creatorId: "owner" })).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
	});
});

it.each([undefined, {}, { creatorId: "", clipId: "A" }, { creatorId: "owner", clipId: "" }, { creatorId: 3, clipId: "A" }, { creatorId: "owner", clipId: 3 }, { creatorId: "x".repeat(201), clipId: "A" }, { creatorId: "owner", clipId: "x".repeat(201) }])("rejects invalid detail input %#", async (input) => {
	expect(await getCreatorClipDetail(input as never)).toEqual({ ok: false, code: "INVALID_INPUT" });
	expect(detail).not.toHaveBeenCalled();
});
it("delegates validated detail requests to the authorizing reader", async () => {
	detail.mockResolvedValue({ ok: false, code: "PERMISSION_DENIED" });
	expect(await getCreatorClipDetail({ creatorId: "owner", clipId: "A" })).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	expect(detail).toHaveBeenCalledWith("owner", "A");
});

it("passes cache-only layout requests to readers without changing ordinary detail requests", async () => {
	inventory.mockResolvedValue({ ok: true, items: [] });
	detail.mockResolvedValue({ ok: true });
	await getCreatorClipInventory({ creatorId: "owner", cachedOnly: true });
	expect(inventory).toHaveBeenCalledWith("owner", undefined, true);
	await searchCreatorLibrary({ creatorId: "owner", title: "clutch", cachedOnly: true });
	expect(inventory).toHaveBeenCalledWith("owner", { title: "clutch", pageSize: 10 }, true);
	await getCreatorClipDetail({ creatorId: "owner", clipId: "A", cachedOnly: true });
	expect(detail).toHaveBeenCalledWith("owner", "A", true);
});

it("rejects malformed cache-only flags before reader access", async () => {
	detail.mockClear();
	inventory.mockClear();
	expect(await getCreatorClipDetail({ creatorId: "owner", clipId: "A", cachedOnly: "yes" } as never)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await getCreatorClipInventory({ creatorId: "owner", cachedOnly: "yes" } as never)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await searchCreatorLibrary({ creatorId: "owner", title: "clutch", cachedOnly: "yes" } as never)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(detail).not.toHaveBeenCalled();
	expect(inventory).not.toHaveBeenCalled();
});

describe("all-filtered selection action", () => {
	beforeEach(() => jest.clearAllMocks());
	it.each([undefined, {}, { creatorId: 3 }, { creatorId: "" }, { creatorId: "x".repeat(201) }])("rejects invalid input %#", async (input) => {
		expect(await getCreatorClipSelection(input as never)).toEqual({ ok: false, code: "INVALID_INPUT" });
		expect(selection).not.toHaveBeenCalled();
	});
	it("forwards filters to the authorizing service", async () => {
		const result = { ok: true, items: [{ id: "clip", title: "Clip" }], complete: true };
		selection.mockResolvedValue(result);
		expect(await getCreatorClipSelection({ creatorId: "owner", query: { videoId: "123", minViews: 10 } })).toEqual(result);
		expect(selection).toHaveBeenCalledWith("owner", { videoId: "123", minViews: 10 });
	});
});
