import type { Gallery, TwitchClip } from "@types";

const validateAuth = jest.fn();
const getPlaylistClipsForOwnerServer = jest.fn();
const getCachedClipsByOwner = jest.fn();
const getTwitchClipPlaybackUrl = jest.fn();
const resolveUserEntitlements = jest.fn();
const getFeatureAccess = jest.fn();
const canResolvePublicClipPlayback = jest.fn();
const revalidatePath = jest.fn();

const selectResults: unknown[] = [];
const insertedRows: unknown[][] = [];
const updatedRows: unknown[][] = [];
const dbSelect = jest.fn(() => {
	const result = selectResults.shift() ?? [];
	const chain: Record<string, jest.Mock> = {};
	for (const method of ["from", "innerJoin", "where", "orderBy", "limit"]) chain[method] = jest.fn(() => chain);
	chain.execute = jest.fn().mockResolvedValue(result);
	return chain;
});
const dbInsert = jest.fn(() => {
	const result = insertedRows.shift() ?? [];
	const chain: Record<string, jest.Mock> = {};
	for (const method of ["values", "returning"]) chain[method] = jest.fn(() => chain);
	chain.execute = jest.fn().mockResolvedValue(result);
	return chain;
});
const dbUpdate = jest.fn(() => {
	const result = updatedRows.shift() ?? [];
	const chain: Record<string, jest.Mock> = {};
	for (const method of ["set", "where", "returning"]) chain[method] = jest.fn(() => chain);
	chain.execute = jest.fn().mockResolvedValue(result);
	return chain;
});
const dbDeleteExecute = jest.fn().mockResolvedValue(undefined);
const dbDelete = jest.fn(() => {
	const chain: Record<string, jest.Mock> = {};
	chain.where = jest.fn(() => chain);
	chain.execute = dbDeleteExecute;
	return chain;
});
type DbMock = { select: typeof dbSelect; insert: typeof dbInsert; update: typeof dbUpdate; delete: typeof dbDelete; transaction: jest.Mock };
const db: DbMock = { select: dbSelect, insert: dbInsert, update: dbUpdate, delete: dbDelete, transaction: jest.fn() };
const dbTransaction = db.transaction;
dbTransaction.mockImplementation(async (callback: (tx: DbMock) => unknown) => callback(db));

jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@actions/database", () => ({ getPlaylistClipsForOwnerServer: (...args: unknown[]) => getPlaylistClipsForOwnerServer(...args) }));
jest.mock("@actions/twitch", () => ({ getCachedClipsByOwner: (...args: unknown[]) => getCachedClipsByOwner(...args), getTwitchClipPlaybackUrl: (...args: unknown[]) => getTwitchClipPlaybackUrl(...args) }));
jest.mock("@/db/client", () => ({ db }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: (...args: unknown[]) => resolveUserEntitlements(...args) }));
jest.mock("@lib/featureAccess", () => ({ getFeatureAccess: (...args: unknown[]) => getFeatureAccess(...args) }));
jest.mock("@actions/rateLimit", () => ({ canResolvePublicClipPlayback: (...args: unknown[]) => canResolvePublicClipPlayback(...args) }));
jest.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const gallery = (patch: Partial<Gallery> = {}): Gallery => ({
	id: "gallery-1",
	ownerId: "owner",
	name: "Highlights",
	published: true,
	source: "live",
	playlistId: null,
	layout: "grid",
	gridAuto: true,
	gridMobileColumns: 1,
	gridTabletColumns: 3,
	gridDesktopColumns: 4,
	listDensity: "comfortable",
	carouselMobileCards: 1,
	carouselTabletCards: 2,
	carouselDesktopCards: 3,
	carouselShowNavigation: true,
	carouselShowIndicators: true,
	showTitle: true,
	showCreator: true,
	showViews: true,
	showDuration: true,
	showCreatedAt: false,
	liveSort: "newest",
	liveTimeWindow: "all",
	liveCustomStart: null,
	liveCustomEnd: null,
	liveResultLimit: 12,
	includeCategories: [],
	excludeCategories: [],
	minimumViews: 0,
	minimumDuration: 0,
	maximumDuration: 0,
	titleBlacklist: [],
	creatorAllowlist: [],
	creatorBlocklist: [],
	theme: "system",
	accentColor: "#7C3AED",
	backgroundMode: "transparent",
	backgroundColor: "#000000",
	cardSurfaceColor: "#18181B",
	textColor: "#FFFFFF",
	cardRadius: 16,
	gap: 16,
	thumbnailTreatment: "cover",
	modalBackdrop: "rgba(0,0,0,0.72)",
	desktopModalWidth: 960,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	...patch,
});

const clip = (id: string): TwitchClip => ({ id, url: `https://clips.twitch.tv/${id}`, embed_url: "", broadcaster_id: "owner", broadcaster_name: "Owner", creator_id: "creator", creator_name: "Creator", video_id: "", game_id: "game", language: "en", title: `Clip ${id}`, view_count: 10, created_at: "2026-08-01T00:00:00Z", thumbnail_url: `${id}.jpg`, duration: 20 });

const queueSelect = (...results: unknown[]) => selectResults.push(...results);
const loadActions = async () => import("@actions/gallery");

describe("gallery actions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		for (const mock of [validateAuth, getPlaylistClipsForOwnerServer, getCachedClipsByOwner, getTwitchClipPlaybackUrl, resolveUserEntitlements, getFeatureAccess, canResolvePublicClipPlayback, revalidatePath]) mock.mockReset();
		selectResults.length = 0;
		insertedRows.length = 0;
		updatedRows.length = 0;
		validateAuth.mockResolvedValue({ id: "owner", plan: "free" });
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "free" });
		getFeatureAccess.mockReturnValue({ allowed: false });
		canResolvePublicClipPlayback.mockResolvedValue(true);
		getCachedClipsByOwner.mockResolvedValue([clip("a"), clip("b")]);
		getPlaylistClipsForOwnerServer.mockResolvedValue([clip("playlist")]);
		getTwitchClipPlaybackUrl.mockResolvedValue("https://video.example/clip.mp4");
	});

	it("returns no galleries for an unauthenticated or mismatched account", async () => {
		const { getAllGalleries } = await loadActions();
		validateAuth.mockResolvedValueOnce(null);
		await expect(getAllGalleries("owner")).resolves.toBeNull();
		validateAuth.mockResolvedValueOnce({ id: "other" });
		await expect(getAllGalleries("owner")).resolves.toBeNull();
		expect(dbSelect).not.toHaveBeenCalled();
	});

	it("loads galleries for the owner and deduplicated managed creators", async () => {
		const { getAllGalleries } = await loadActions();
		const rows = [gallery(), gallery({ id: "gallery-2", ownerId: "managed" })];
		queueSelect([{ ownerId: "managed" }, { ownerId: "managed" }, { ownerId: "owner" }], rows);
		await expect(getAllGalleries("owner")).resolves.toEqual(rows);
		expect(dbSelect).toHaveBeenCalledTimes(2);
	});

	it("requires owner or editor access and resolves owner entitlements", async () => {
		const { getGallery } = await loadActions();
		validateAuth.mockResolvedValueOnce(null);
		await expect(getGallery("gallery-1")).resolves.toBeNull();

		validateAuth.mockResolvedValue({ id: "intruder", plan: "free" });
		queueSelect([gallery()], []);
		await expect(getGallery("gallery-1")).resolves.toBeNull();

		validateAuth.mockResolvedValue({ id: "editor", plan: "free" });
		queueSelect([gallery()], [{ userId: "owner" }], [{ plan: "pro" }]);
		resolveUserEntitlements.mockResolvedValueOnce({ effectivePlan: "pro" });
		await expect(getGallery("gallery-1")).resolves.toEqual(gallery());
		expect(resolveUserEntitlements).toHaveBeenCalledWith({ id: "owner", plan: "pro" });
	});

	it("builds owner previews for live Free galleries with downgrade and attribution", async () => {
		const { getGalleryPreview } = await loadActions();
		queueSelect([gallery({ liveResultLimit: 99, liveSort: "stable_random", accentColor: "#123456" })], [{ username: "Alice" }]);
		const result = await getGalleryPreview("gallery-1");
		expect(result).toMatchObject({ ownerName: "Alice", showAttribution: true, canUseAdvanced: false });
		expect(result?.gallery).toMatchObject({ liveResultLimit: 50, liveSort: "newest", accentColor: "#7C3AED" });
		expect(result?.clips.map((item) => item.id)).toEqual(["a", "b"]);
		expect(getCachedClipsByOwner).toHaveBeenCalledWith("owner");
	});

	it("builds Pro curated previews and falls back to a creator label", async () => {
		const { getGalleryPreview } = await loadActions();
		const curated = gallery({ source: "curated", playlistId: "playlist", accentColor: "#123456" });
		queueSelect([curated], []);
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		const result = await getGalleryPreview("gallery-1");
		expect(result).toMatchObject({ ownerName: "Clipify creator", showAttribution: false, canUseAdvanced: true, gallery: curated });
		expect(getPlaylistClipsForOwnerServer).toHaveBeenCalledWith("owner", "playlist");
	});

	it("returns null for inaccessible previews and clips outside the resolved sequence", async () => {
		const { getGalleryPreview, getGalleryPreviewPlayer } = await loadActions();
		validateAuth.mockResolvedValue(null);
		await expect(getGalleryPreview("gallery-1")).resolves.toBeNull();
		await expect(getGalleryPreviewPlayer("gallery-1", "missing")).resolves.toBeNull();
	});

	it("loads preview playback and tolerates playback resolution failures", async () => {
		const { getGalleryPreviewPlayer } = await loadActions();
		queueSelect([gallery()], [{ username: "Alice" }]);
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		await expect(getGalleryPreviewPlayer("gallery-1", "a")).resolves.toMatchObject({ selectedIndex: 0, playbackUrl: "https://video.example/clip.mp4" });

		queueSelect([gallery()], [{ username: "Alice" }]);
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		getTwitchClipPlaybackUrl.mockRejectedValueOnce(new Error("Twitch failed"));
		await expect(getGalleryPreviewPlayer("gallery-1", "a")).resolves.toMatchObject({ playbackUrl: null });
	});

	it("rejects unauthorized gallery creation", async () => {
		const { createGallery } = await loadActions();
		validateAuth.mockResolvedValueOnce(null);
		await expect(createGallery("owner")).resolves.toBeNull();
		validateAuth.mockResolvedValue({ id: "intruder", plan: "free" });
		queueSelect([]);
		await expect(createGallery("owner")).resolves.toBeNull();
		expect(dbTransaction).not.toHaveBeenCalled();
	});

	it("enforces the Free creation limit and creates a normalized default gallery", async () => {
		const { createGallery } = await loadActions();
		queueSelect([{ id: "existing" }]);
		await expect(createGallery("owner")).rejects.toThrow("Free plan allows one gallery");

		queueSelect([]);
		insertedRows.push([gallery({ name: "My clip gallery" })]);
		await expect(createGallery("owner", "   ")).resolves.toMatchObject({ name: "My clip gallery" });
		expect(dbInsert).toHaveBeenCalled();
	});

	it("lets direct and managed Pro owners create multiple galleries", async () => {
		const { createGallery } = await loadActions();
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		insertedRows.push([gallery({ name: "Direct Pro" })]);
		await expect(createGallery("owner", " Direct Pro ")).resolves.toMatchObject({ name: "Direct Pro" });

		validateAuth.mockResolvedValue({ id: "editor", plan: "free" });
		queueSelect([{ userId: "owner" }], [{ plan: "partner" }]);
		resolveUserEntitlements.mockResolvedValueOnce({ effectivePlan: "pro" });
		insertedRows.push([gallery({ name: "Managed" })]);
		await expect(createGallery("owner", "Managed")).resolves.toMatchObject({ name: "Managed" });
	});

	it("returns null when an insert does not return a row", async () => {
		const { createGallery } = await loadActions();
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		insertedRows.push([]);
		await expect(createGallery("owner")).resolves.toBeNull();
	});

	it("validates curated playlist ownership and publication requirements", async () => {
		const { saveGallery } = await loadActions();
		queueSelect([gallery()], []);
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		await expect(saveGallery("gallery-1", { source: "curated", playlistId: "foreign", published: true })).rejects.toThrow("selected playlist must belong");

		queueSelect([gallery()]);
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		await expect(saveGallery("gallery-1", { source: "curated", playlistId: null, published: true })).rejects.toThrow("Choose a playlist");
	});

	it("saves authorized live and curated galleries and revalidates both surfaces", async () => {
		const { saveGallery } = await loadActions();
		const saved = gallery({ name: "Saved" });
		queueSelect([gallery()]);
		updatedRows.push([saved]);
		await expect(saveGallery("gallery-1", { name: " Saved ", source: "live", liveResultLimit: 100 })).resolves.toEqual(saved);
		expect(revalidatePath).toHaveBeenCalledWith("/dashboard/galleries/gallery-1");
		expect(revalidatePath).toHaveBeenCalledWith("/gallery/gallery-1");

		queueSelect([gallery()], [{ id: "playlist" }]);
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		updatedRows.push([]);
		await expect(saveGallery("gallery-1", { source: "curated", playlistId: "playlist", published: true })).resolves.toBeNull();
	});

	it("returns null when saving without access", async () => {
		const { saveGallery } = await loadActions();
		validateAuth.mockResolvedValue(null);
		await expect(saveGallery("gallery-1", { name: "Nope" })).resolves.toBeNull();
		expect(dbUpdate).not.toHaveBeenCalled();
	});

	it("deletes only accessible galleries and revalidates the dashboard", async () => {
		const { deleteGallery } = await loadActions();
		validateAuth.mockResolvedValue(null);
		await expect(deleteGallery("gallery-1")).resolves.toBe(false);

		validateAuth.mockResolvedValue({ id: "owner", plan: "free" });
		queueSelect([gallery()]);
		await expect(deleteGallery("gallery-1")).resolves.toBe(true);
		expect(dbDeleteExecute).toHaveBeenCalled();
		expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
	});

	it.each([
		[[], null],
		[[{ gallery: gallery({ published: false }), owner: { id: "owner", username: "Alice", avatar: null, disabled: false, plan: "free" } }], null],
		[[{ gallery: gallery(), owner: { id: "owner", username: "Alice", avatar: null, disabled: true, plan: "free" } }], null],
	])("rejects unavailable public galleries", async (rows, expected) => {
		const { getPublicGallery } = await loadActions();
		queueSelect(rows);
		await expect(getPublicGallery("gallery-1")).resolves.toBe(expected);
	});

	it("serves public Free and Pro gallery bundles with correct attribution", async () => {
		const { getPublicGallery } = await loadActions();
		const owner = { id: "owner", username: "Alice", avatar: null, disabled: false, plan: "free" };
		queueSelect([{ gallery: gallery({ liveResultLimit: 99 }), owner }]);
		await expect(getPublicGallery("gallery-1")).resolves.toMatchObject({ showAttribution: true, gallery: { liveResultLimit: 50 } });

		queueSelect([{ gallery: gallery({ source: "curated", playlistId: "playlist" }), owner: { ...owner, plan: "partner" } }]);
		resolveUserEntitlements.mockResolvedValueOnce({ effectivePlan: "pro" });
		await expect(getPublicGallery("gallery-1")).resolves.toMatchObject({ showAttribution: false, clips: [{ id: "playlist" }] });
	});

	it("returns only public member clips and handles playback URL failures", async () => {
		const { getPublicGalleryPlayer } = await loadActions();
		const owner = { id: "owner", username: "Alice", avatar: null, disabled: false, plan: "pro" };
		queueSelect([{ gallery: gallery(), owner }]);
		resolveUserEntitlements.mockResolvedValueOnce({ effectivePlan: "pro" });
		await expect(getPublicGalleryPlayer("gallery-1", "missing")).resolves.toBeNull();

		queueSelect([{ gallery: gallery(), owner }]);
		resolveUserEntitlements.mockResolvedValueOnce({ effectivePlan: "pro" });
		getTwitchClipPlaybackUrl.mockResolvedValueOnce(null);
		await expect(getPublicGalleryPlayer("gallery-1", "b")).resolves.toMatchObject({ selectedIndex: 1, playbackUrl: null });

		queueSelect([{ gallery: gallery(), owner }]);
		resolveUserEntitlements.mockResolvedValueOnce({ effectivePlan: "pro" });
		getTwitchClipPlaybackUrl.mockRejectedValueOnce(new Error("failed"));
		await expect(getPublicGalleryPlayer("gallery-1", "a")).resolves.toMatchObject({ playbackUrl: null });
	});

	it("authorizes uncached public playback against the gallery owner's budget", async () => {
		const { getPublicGalleryPlayer } = await loadActions();
		const owner = { id: "owner", username: "Alice", avatar: null, disabled: false, plan: "pro" };
		queueSelect([{ gallery: gallery(), owner }]);
		resolveUserEntitlements.mockResolvedValueOnce({ effectivePlan: "pro" });
		getTwitchClipPlaybackUrl.mockImplementationOnce(async (_clipId: string, _broadcasterId: string, options: { authorizeFetch: () => Promise<boolean> }) => {
			await options.authorizeFetch();
			return "https://video.example/clip.mp4";
		});

		await expect(getPublicGalleryPlayer("gallery-1", "a")).resolves.toMatchObject({ playbackUrl: "https://video.example/clip.mp4" });
		expect(canResolvePublicClipPlayback).toHaveBeenCalledWith("owner");
	});
});
