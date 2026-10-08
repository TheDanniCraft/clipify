jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: async () => ({ kind: "session", authUserId: "auth-user-1", sessionId: "session-1", authenticatedAt: new Date() }) }));
/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const discoveredCreatorIds = new Set<string>();
const insertQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const dbDelete = jest.fn();
const dbTransaction = jest.fn();

const validateAuth = jest.fn();
const createBrowserOverlay = jest.fn();
const saveBrowserOverlay = jest.fn();
const createBrowserPlaylist = jest.fn();
const saveBrowserPlaylist = jest.fn();
const deleteBrowserPlaylist = jest.fn();
const saveBrowserPlaylistItems = jest.fn();
const reorderBrowserPlaylist = jest.fn();
jest.mock("@/server/resources/browser-playlists", () => ({ saveBrowserPlaylistItems: (...args: unknown[]) => saveBrowserPlaylistItems(...args), reorderBrowserPlaylist: (...args: unknown[]) => reorderBrowserPlaylist(...args), createBrowserPlaylist: (...args: unknown[]) => createBrowserPlaylist(...args), saveBrowserPlaylist: (...args: unknown[]) => saveBrowserPlaylist(...args), deleteBrowserPlaylist: (...args: unknown[]) => deleteBrowserPlaylist(...args) }));
jest.mock("@/server/resources/browser-overlays", () => ({ saveBrowserOverlay: (...args: unknown[]) => saveBrowserOverlay(...args), createBrowserOverlay: (...args: unknown[]) => createBrowserOverlay(...args) }));
const resolveUserEntitlements = jest.fn();
const getFeatureAccess = jest.fn(() => ({ allowed: true }));
const subscribeToReward = jest.fn();
type RetainedAccess = { effectivePlan: "free" | "pro"; read: true; delete: true; update: boolean; runtime: boolean; withinFreeAllowance: boolean };
const resolveRetainedResourceAccess = jest.fn<Promise<RetainedAccess>, [unknown]>(async () => ({ effectivePlan: "pro", read: true, delete: true, update: true, runtime: true, withinFreeAllowance: true }));
const authorizeCreatorOperation = jest.fn(async ({ creatorId }: { creatorId: string }) => {
	const actor = await validateAuth();
	if (!actor) return { allowed: false, code: "AUTHENTICATION_REQUIRED" };
	const allowed = actor.id === creatorId || Boolean(((selectQueue.shift() as unknown[]) ?? []).length);
	return allowed ? { allowed: true, accessPath: actor.id === creatorId ? "owner" : "direct", creator: { ...actor, id: creatorId }, authUserId: actor.id, sessionId: "test", creatorOrganizationId: `org:${creatorId}` } : { allowed: false, code: "ACCESS_PATH_REQUIRED" };
});
const listAuthorizedCreatorOperations = jest.fn(async () => {
	const actor = await validateAuth();
	if (!actor) return [];
	const managed = ((selectQueue.shift() as Array<{ userId: string }>) ?? []).map((row) => row.userId);
	for (const id of [actor.id, ...managed]) discoveredCreatorIds.add(id);
	return [actor.id, ...managed.filter((id) => id !== actor.id)].map((id) => ({ allowed: true, accessPath: id === actor.id ? "owner" : "direct", creator: { ...actor, id }, authUserId: actor.id, sessionId: "test", creatorOrganizationId: `org:${id}` }));
});

const insertCalls: Array<{ table: unknown; values: unknown }> = [];
const updateCalls: Array<{ table: unknown; set: unknown }> = [];
const deleteCalls: Array<{ table: unknown }> = [];

const usersTable = {
	id: "users.id",
	plan: "users.plan",
	createdAt: "users.created_at",
};
const overlaysTable = {
	id: "overlays.id",
	ownerId: "overlays.owner_id",
	playlistId: "overlays.playlist_id",
	updatedAt: "overlays.updated_at",
};
const playlistsTable = {
	id: "playlists.id",
	ownerId: "playlists.owner_id",
	name: "playlists.name",
	createdAt: "playlists.created_at",
};
const playlistClipsTable = {
	playlistId: "playlist_clips.playlist_id",
	clipId: "playlist_clips.clip_id",
	position: "playlist_clips.position",
};
const galleriesTable = {
	id: "galleries.id",
	ownerId: "galleries.owner_id",
	playlistId: "galleries.playlist_id",
	createdAt: "galleries.created_at",
};

function queueSelectResult(value: unknown) {
	selectQueue.push(value);
}

function makeSelectChain() {
	const chain: Record<string, unknown> = {};
	chain.from = () => chain;
	chain.where = () => chain;
	chain.limit = () => chain;
	chain.orderBy = () => chain;
	chain.groupBy = () => chain;
	chain.offset = () => chain;
	chain.innerJoin = () => chain;
	chain.execute = async () => (selectQueue.length > 0 ? selectQueue.shift() : []);
	return chain;
}

function makeInsertChain(table: unknown) {
	return {
		values: (values: unknown) => {
			insertCalls.push({ table, values });
			const getResult = async () => (insertQueue.length > 0 ? (insertQueue.shift() as unknown) : []);
			const returningResult = {
				execute: getResult,
			};
			return {
				returning: () => returningResult,
				execute: async () => undefined,
				onConflictDoUpdate: () => ({
					execute: async () => undefined,
					returning: () => returningResult,
				}),
			};
		},
	};
}

function makeUpdateChain(table: unknown) {
	return {
		set: (set: unknown) => {
			updateCalls.push({ table, set });
			const getResult = async () => [];
			return {
				where: () => {
					const whereChain = {
						execute: async () => undefined,
						returning: () => ({
							execute: getResult,
						}),
					};
					return whereChain;
				},
				execute: async () => undefined,
			};
		},
	};
}

function makeDeleteChain(table: unknown) {
	deleteCalls.push({ table });
	return {
		where: () => ({
			execute: async () => ({ rowCount: 1 }),
		}),
		execute: async () => ({ rowCount: 1 }),
	};
}

function makeTx(): any {
	return {
		select: (..._args: unknown[]) => makeSelectChain(),
		insert: (table: unknown) => makeInsertChain(table),
		update: (table: unknown) => makeUpdateChain(table),
		delete: (table: unknown) => makeDeleteChain(table),
		execute: async () => undefined,
	};
}

jest.mock("@/db/client", () => ({
	db: {
		select: (..._args: unknown[]) => dbSelect(..._args),
		insert: (..._args: unknown[]) => dbInsert(..._args),
		update: (..._args: unknown[]) => dbUpdate(..._args),
		delete: (..._args: unknown[]) => dbDelete(..._args),
		transaction: (..._args: unknown[]) => dbTransaction(..._args),
		execute: jest.fn(),
	},
}));

jest.mock("@/db/schema", () => ({
	usersTable,
	overlaysTable,
	playlistsTable,
	playlistClipsTable,
	galleriesTable,
	queueTable: {},
	settingsTable: {},
	modQueueTable: {},
	twitchCacheTable: {},
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/twitch", () => ({
	getUserDetails: jest.fn(),
	getUsersDetailsBulk: jest.fn(),
	refreshAccessTokenWithContext: jest.fn(),
	subscribeToReward,
	syncOwnerClipCache: jest.fn(),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess,
}));

jest.mock("@lib/entitlements", () => ({
	ensureReverseTrialGrantForUser: jest.fn(),
	resolveUserEntitlements: (...args: unknown[]) => resolveUserEntitlements(...args),
	resolveUserEntitlementsForUsers: jest.fn(),
	reconcileUserEntitlements: jest.fn(async () => ({ runners: 0, sessions: 0 })),
}));
jest.mock("@/auth/authorize-operation", () => ({
	authorizeCreatorOperation: (input: { creatorId: string }) => authorizeCreatorOperation(input),
	authorizeTrustedCreatorOperation: async ({ creatorId, resourceOwnerId, permission }: { creatorId: string; resourceOwnerId: string; permission: string }) => {
		if (discoveredCreatorIds.has(creatorId)) {
			const actor = await validateAuth();
			return { allowed: true, creator: { ...actor, id: creatorId }, accessPath: actor.id === creatorId ? "owner" : "direct" };
		}
		return authorizeCreatorOperation({ creatorId, resourceOwnerId, permission } as { creatorId: string });
	},
	listAuthorizedCreatorOperations: () => listAuthorizedCreatorOperations(),
}));
jest.mock("@/server/entitlements/resource-access", () => ({ resolveRetainedResourceAccess: (input: unknown) => resolveRetainedResourceAccess(input) }));

jest.mock("drizzle-orm", () => ({
	asc: jest.fn((value: unknown) => value),
	relations: jest.fn(() => ({})),
	eq: jest.fn(() => "eq"),
	inArray: jest.fn(() => "inArray"),
	and: jest.fn(() => "and"),
	or: jest.fn(() => "or"),
	isNull: jest.fn(() => "isNull"),
	lt: jest.fn(() => "lt"),
	gt: jest.fn(() => "gt"),
	sql: Object.assign(
		jest.fn(() => "sql"),
		{
			join: jest.fn((parts: unknown[], separator = " ") => parts.join(String(separator))),
			raw: jest.fn((value: unknown) => String(value)),
		},
	),
	desc: jest.fn(() => "desc"),
	max: jest.fn(() => "max"),
}));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database playlist logic", () => {
	beforeEach(() => {
		createBrowserOverlay.mockReset().mockResolvedValue(null);
		createBrowserPlaylist.mockReset().mockResolvedValue(null);
		saveBrowserPlaylist.mockReset().mockResolvedValue(null);
		deleteBrowserPlaylist.mockReset().mockResolvedValue(false);
		jest.clearAllMocks();
		selectQueue.length = 0;
		discoveredCreatorIds.clear();
		insertQueue.length = 0;
		insertCalls.length = 0;
		updateCalls.length = 0;
		deleteCalls.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbInsert.mockImplementation((table: unknown) => makeInsertChain(table));
		dbUpdate.mockImplementation((table: unknown) => makeUpdateChain(table));
		dbDelete.mockImplementation((table: unknown) => makeDeleteChain(table));
		dbTransaction.mockImplementation(async (callback: (tx: ReturnType<typeof makeTx>) => unknown) => callback(makeTx()));
		validateAuth.mockResolvedValue({
			id: "owner-1",
			username: "owner",
			email: "owner@example.com",
			avatar: "",
			role: "user",
			plan: "free",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		resolveUserEntitlements.mockResolvedValue({
			effectivePlan: "free",
			isBillingPro: false,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: false,
			source: "reverse_trial",
		});
	});

	it("returns owner/editor playlists with clip counts and access types", async () => {
		queueSelectResult([{ userId: "owner-2" }]);
		queueSelectResult([
			{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() },
			{ id: "playlist-2", ownerId: "owner-2", name: "Shared", createdAt: new Date(), updatedAt: new Date() },
		]);
		queueSelectResult([{ playlistId: "playlist-1", count: 3 }]);

		const { getAllPlaylists } = await loadDatabaseActions();
		const result = await getAllPlaylists("owner-1");

		expect(result).toEqual([expect.objectContaining({ id: "playlist-1", clipCount: 3, accessType: "owner" }), expect.objectContaining({ id: "playlist-2", clipCount: 0, accessType: "editor" })]);
	});

	it("returns null for getAllPlaylists when user is not authorized", async () => {
		validateAuth.mockResolvedValueOnce(null);
		const { getAllPlaylists } = await loadDatabaseActions();
		await expect(getAllPlaylists("owner-1")).resolves.toBeNull();
	});

	it("returns owner playlists for editor access via getPlaylistsForOwner", async () => {
		validateAuth.mockResolvedValue({
			id: "editor-1",
			plan: "pro",
		});
		queueSelectResult([{ userId: "owner-1", editorId: "editor-1" }]);
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ playlistId: "playlist-1", count: 4 }]);

		const { getPlaylistsForOwner } = await loadDatabaseActions();
		const rows = await getPlaylistsForOwner("owner-1");
		expect(rows).toEqual([expect.objectContaining({ id: "playlist-1", clipCount: 4 })]);
	});

	it("returns null for getPlaylistsForOwner when access is denied", async () => {
		validateAuth.mockResolvedValue({ id: "viewer-1", plan: "free" });
		queueSelectResult([]);
		const { getPlaylistsForOwner } = await loadDatabaseActions();
		await expect(getPlaylistsForOwner("owner-1")).resolves.toBeNull();
	});

	it("delegates playlist creation to the verified shared backend adapter", async () => {
		const result = { id: "playlist-new", ownerId: "owner-1", name: "My Playlist" };
		createBrowserPlaylist.mockResolvedValueOnce(result);
		const { createPlaylist } = await loadDatabaseActions();
		expect(await createPlaylist("owner-1", "  My Playlist  ")).toBe(result);
		expect(createBrowserPlaylist).toHaveBeenCalledWith("owner-1", "  My Playlist  ");
		expect(dbTransaction).not.toHaveBeenCalled();
	});
	it.each(["Free plan allows only one playlist", "Playlist name is required"])("preserves verified adapter error: %s", async (message) => {
		createBrowserPlaylist.mockRejectedValueOnce(new Error(message));
		const { createPlaylist } = await loadDatabaseActions();
		await expect(createPlaylist("owner-1", "name")).rejects.toThrow(message);
	});
	it("preserves current access denial from the verified adapter", async () => {
		createBrowserPlaylist.mockResolvedValueOnce(null);
		const { createPlaylist } = await loadDatabaseActions();
		expect(await createPlaylist("owner-1", "name")).toBeNull();
		expect(createBrowserPlaylist).toHaveBeenCalled();
	});

	it("TDD-US2-038 browser rename forwards its last-read revision to the verified shared service", async () => {
		const current = { id: "playlist-1", ownerId: "owner-1", name: "Old", configurationRevision: 1 };
		const updated = { ...current, name: "Browser name", configurationRevision: 2 };
		queueSelectResult([current]);
		queueSelectResult([updated]);
		saveBrowserPlaylist.mockResolvedValueOnce(updated);
		const { savePlaylist } = await loadDatabaseActions();
		const result = await (savePlaylist as any)("playlist-1", { name: "  Browser name  " }, 1);
		expect(saveBrowserPlaylist).toHaveBeenCalledWith("playlist-1", { name: "  Browser name  " }, 1);
		expect(result).toBe(updated);
	});

	it("preserves the shared browser writer unavailable result without direct persistence", async () => {
		const { savePlaylist } = await loadDatabaseActions();
		expect(await savePlaylist("playlist-1", { name: "New name" }, 1)).toBeNull();
		expect(saveBrowserPlaylist).toHaveBeenCalledWith("playlist-1", { name: "New name" }, 1);
		expect(dbUpdate).not.toHaveBeenCalled();
	});

	it("delegates deletion with the last-read revision without direct persistence", async () => {
		const { deletePlaylist } = await loadDatabaseActions();
		deleteBrowserPlaylist.mockResolvedValueOnce(true);
		expect(await (deletePlaylist as any)("playlist-1", 7)).toBe(true);
		expect(deleteBrowserPlaylist).toHaveBeenCalledWith("playlist-1", 7);
		expect(dbTransaction).not.toHaveBeenCalled();
		expect(dbDelete).not.toHaveBeenCalled();
	});
	it("preserves a shared deletion denial without bypassing its policy", async () => {
		const { deletePlaylist } = await loadDatabaseActions();
		expect(await (deletePlaylist as any)("playlist-1", 7)).toBe(false);
		expect(deleteBrowserPlaylist).toHaveBeenCalledWith("playlist-1", 7);
		expect(dbDelete).not.toHaveBeenCalled();
	});

	it("parses playlist clips from mixed stored shapes and skips invalid payloads", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]);
		queueSelectResult([
			{ playlistId: "playlist-1", clipId: "a", position: 0, clipData: JSON.stringify({ id: "a", title: "A" }) },
			{ playlistId: "playlist-1", clipId: "b", position: 1, clipData: JSON.stringify({ clip: { id: "b", title: "B" } }) },
			{ playlistId: "playlist-1", clipId: "bad", position: 2, clipData: "{not-json" },
		]);
		const { getPlaylistClipsForOwnerServer } = await loadDatabaseActions();
		const clips = await getPlaylistClipsForOwnerServer("owner-1", "playlist-1");
		expect(clips.map((clip) => clip.id)).toEqual(["a", "b"]);
	});

	it("limits a retained Free playlist at runtime without deleting saved clips", async () => {
		resolveRetainedResourceAccess.mockResolvedValueOnce({ effectivePlan: "free", read: true, delete: true, update: true, runtime: true, withinFreeAllowance: true });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]);
		queueSelectResult(
			Array.from({ length: 55 }, (_unused, index) => ({
				playlistId: "playlist-1",
				clipId: `clip-${index}`,
				position: index,
				clipData: JSON.stringify({ id: `clip-${index}` }),
			})),
		);

		const { getPlaylistRuntimeClipsForOwnerServer } = await loadDatabaseActions();
		const clips = await getPlaylistRuntimeClipsForOwnerServer("owner-1", "playlist-1");

		expect(clips).toHaveLength(50);
		expect(clips.at(-1)?.id).toBe("clip-49");
	});

	it("blocks retained playlists outside the Free allowance from runtime use", async () => {
		resolveRetainedResourceAccess.mockResolvedValueOnce({ effectivePlan: "free", read: true, delete: true, update: false, runtime: false, withinFreeAllowance: false });
		const { getPlaylistRuntimeClipsForOwnerServer } = await loadDatabaseActions();

		await expect(getPlaylistRuntimeClipsForOwnerServer("owner-1", "playlist-2")).resolves.toEqual([]);
		expect(dbSelect).not.toHaveBeenCalled();
	});

	it("returns empty playlist clips when caller has no access", async () => {
		validateAuth.mockResolvedValueOnce({ id: "editor-2", plan: "free" });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([]);
		const { getPlaylistClips } = await loadDatabaseActions();
		await expect(getPlaylistClips("playlist-1")).resolves.toEqual([]);
	});

	it("TDD-BROWSER-ITEMS-003 forwards only IDs, exact revision and optional name to the shared save", async () => {
		const { upsertPlaylistClips } = await loadDatabaseActions();
		const saved = { clips: [{ id: "ClipFirst", title: "Trusted" }], configurationRevision: 2, name: "New" };
		saveBrowserPlaylistItems.mockResolvedValueOnce(saved);
		expect(await upsertPlaylistClips("playlist-1", [{ id: "ClipFirst", title: "Forged", secret: "private" }] as never, "replace", 1, "New")).toEqual(saved);
		expect(saveBrowserPlaylistItems).toHaveBeenCalledWith("playlist-1", ["ClipFirst"], "replace", 1, "New");
		expect(dbTransaction).not.toHaveBeenCalled();
	});
	it("TDD-BROWSER-ITEMS-003 failed shared save is not a successful empty playlist", async () => {
		const { upsertPlaylistClips } = await loadDatabaseActions();
		saveBrowserPlaylistItems.mockResolvedValueOnce(null);
		expect(await upsertPlaylistClips("playlist-1", [] as never, "replace", 1)).toBeNull();
	});
	it("TDD-BROWSER-ITEMS-003 exact browser reorder delegates to shared revision transaction", async () => {
		const { reorderPlaylistClips } = await loadDatabaseActions();
		const result = {
			playlist: { configurationRevision: 2 },
			items: [
				{ id: "clip-b", position: 0 },
				{ id: "clip-a", position: 1 },
			],
		};
		reorderBrowserPlaylist.mockResolvedValueOnce(result);
		expect(await reorderPlaylistClips("playlist-1", ["clip-b", "clip-a"], 1)).toEqual(result);
		expect(reorderBrowserPlaylist).toHaveBeenCalledWith("playlist-1", ["clip-b", "clip-a"], 1);
		expect(dbTransaction).not.toHaveBeenCalled();
	});
	it("blocks auto import for non-pro users", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);

		const { importPlaylistClips } = await loadDatabaseActions();
		await expect(importPlaylistClips("playlist-1", { overlayType: "All" as never }, "append", 1)).rejects.toThrow("Auto import is a Pro feature");
	});

	it("imports playlist clips for pro users with filters and mod queue inclusion", async () => {
		resolveUserEntitlements.mockResolvedValue({
			effectivePlan: "pro",
			isBillingPro: false,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: true,
			source: "grant",
		});
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]); // requirePlaylistAccess
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]); // owner plan
		queueSelectResult([
			{
				key: "clip:owner-1:featured-keep",
				value: JSON.stringify({
					id: "featured-keep",
					game_id: "game-a",
					creator_id: "creator-a",
					creator_name: "CreatorA",
					view_count: 100,
					created_at: "2026-03-10T00:00:00.000Z",
					title: "keep",
					url: "https://clips.twitch.tv/featured-keep",
					embed_url: "",
					broadcaster_id: "owner-1",
					broadcaster_name: "owner",
					video_id: "video",
					language: "en",
					thumbnail_url: "https://thumb",
					duration: 20,
					is_featured: true,
				}),
			},
			{
				key: "clip:owner-1:drop-category",
				value: JSON.stringify({
					id: "drop-category",
					game_id: "game-b",
					creator_id: "creator-b",
					creator_name: "CreatorB",
					view_count: 120,
					created_at: "2026-03-10T00:00:00.000Z",
					title: "drop",
					url: "https://clips.twitch.tv/drop-category",
					embed_url: "",
					broadcaster_id: "owner-1",
					broadcaster_name: "owner",
					video_id: "video",
					language: "en",
					thumbnail_url: "https://thumb",
					duration: 20,
					is_featured: true,
				}),
			},
		]); // twitch cache prefix entries
		queueSelectResult([{ broadcasterId: "owner-1", clipId: "mod-extra" }]); // mod queue
		queueSelectResult([
			{
				value: JSON.stringify({
					id: "mod-extra",
					game_id: "game-a",
					creator_id: "creator-mod",
					creator_name: "CreatorMod",
					view_count: 90,
					created_at: "2026-03-09T00:00:00.000Z",
					title: "mod",
					url: "https://clips.twitch.tv/mod-extra",
					embed_url: "",
					broadcaster_id: "owner-1",
					broadcaster_name: "owner",
					video_id: "video",
					language: "en",
					thumbnail_url: "https://thumb",
					duration: 18,
					is_featured: true,
				}),
			},
		]); // getTwitchCache for mod clip
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]); // upsert access
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]); // upsert owner plan
		queueSelectResult([]); // existing playlist clips
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]); // getPlaylistClipsForOwnerServer check
		queueSelectResult([
			{ playlistId: "playlist-1", clipId: "featured-keep", position: 0, clipData: JSON.stringify({ id: "featured-keep", title: "keep" }) },
			{ playlistId: "playlist-1", clipId: "mod-extra", position: 1, clipData: JSON.stringify({ id: "mod-extra", title: "mod" }) },
		]); // returned playlist rows

		const { importPlaylistClips } = await loadDatabaseActions();
		saveBrowserPlaylistItems.mockResolvedValueOnce({ clips: [{ id: "featured-keep" }, { id: "mod-extra" }], configurationRevision: 5, name: "Main" });
		const imported = await importPlaylistClips(
			"playlist-1",
			{
				overlayType: "Featured" as never,
				categoryId: "game-a",
				minViews: 80,
				clipCreatorsBlocked: ["creator-b"],
				includeModQueue: true,
			},
			"append",
			4,
		);

		expect(imported?.clips.map((clip) => clip.id)).toEqual(["featured-keep", "mod-extra"]);
		expect(saveBrowserPlaylistItems).toHaveBeenCalledWith("playlist-1", ["featured-keep", "mod-extra"], "append", 4, undefined, undefined, true);
		expect(dbTransaction).not.toHaveBeenCalled();
	});

	it("filters by categoryId in importPlaylistClips", async () => {
		resolveUserEntitlements.mockResolvedValue({
			effectivePlan: "pro",
			isBillingPro: true,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: true,
		});
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		// getTwitchCacheByPrefixEntries select
		queueSelectResult([
			{ key: "clip:owner-1:cat-match", value: JSON.stringify({ id: "cat-match", game_id: "game-123", view_count: 100, created_at: new Date().toISOString() }) },
			{ key: "clip:owner-1:cat-miss", value: JSON.stringify({ id: "cat-miss", game_id: "game-456", view_count: 100, created_at: new Date().toISOString() }) },
		]);
		queueSelectResult([]); // existing playlist clips
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]); // getPlaylistClipsForOwnerServer check
		queueSelectResult([{ playlistId: "playlist-1", clipId: "cat-match", position: 0, clipData: JSON.stringify({ id: "cat-match" }) }]); // final return select

		const { importPlaylistClips } = await loadDatabaseActions();
		saveBrowserPlaylistItems.mockResolvedValueOnce({ clips: [{ id: "cat-match" }], configurationRevision: 5, name: "Main" });
		const imported = await importPlaylistClips("playlist-1", { overlayType: "All" as never, categoryId: "game-123" }, "replace", 4);

		expect(imported?.clips.every((clip) => clip.id !== "cat-miss")).toBe(true);
		expect(saveBrowserPlaylistItems).toHaveBeenCalledWith("playlist-1", ["cat-match"], "replace", 4, undefined, undefined, true);
	});

	it("returns empty import result when playlist access fails", async () => {
		validateAuth.mockResolvedValue({ id: "viewer-1", plan: "free" });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([]);
		const { importPlaylistClips, previewImportPlaylistClips } = await loadDatabaseActions();
		await expect(importPlaylistClips("playlist-1", { overlayType: "All" as never }, "append", 1)).resolves.toBeNull();
		await expect(previewImportPlaylistClips("playlist-1", { overlayType: "All" as never })).resolves.toEqual([]);
	});

	it("previews playlist clips for pro users with various filters", async () => {
		resolveUserEntitlements.mockResolvedValue({
			effectivePlan: "pro",
			isBillingPro: true,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: true,
		});
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]); // playlist
		queueSelectResult([{ id: "owner-1", plan: "pro" }]); // owner plan

		// getTwitchCacheByPrefixEntries select for getPlaylistImportSourceClips
		queueSelectResult([
			{ key: "c:1", value: JSON.stringify({ id: "c1", title: "Good Clip", game_id: "G1", creator_name: "A", creator_id: "1", view_count: 100, created_at: "2020-01-01T00:00:00Z" }) },
			{ key: "c:2", value: JSON.stringify({ id: "c2", title: "Bad Word", game_id: "G1", creator_name: "A", creator_id: "1", view_count: 50, created_at: "2020-01-02T00:00:00Z" }) },
			{ key: "c:3", value: JSON.stringify({ id: "c3", title: "Other Game", game_id: "G2", creator_name: "B", creator_id: "2", view_count: 200, created_at: "2020-01-03T00:00:00Z" }) },
		]);

		const { previewImportPlaylistClips } = await loadDatabaseActions();
		const result = await previewImportPlaylistClips("playlist-1", {
			overlayType: "All" as never,
			categoryId: "G1",
			blacklistWords: ["bad"],
			minViews: 60,
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("c1");
	});

	it("filters clips by creators in import", async () => {
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro", hasActiveGrant: true });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]); // access
		queueSelectResult([{ id: "owner-1", plan: "pro" }]); // plan

		queueSelectResult([
			{ key: "c:1", value: JSON.stringify({ id: "c1", creator_name: "Allowed", creator_id: "10", view_count: 10, game_id: "G", created_at: "2020-01-01T00:00:00Z" }) },
			{ key: "c:2", value: JSON.stringify({ id: "c2", creator_name: "Blocked", creator_id: "20", view_count: 10, game_id: "G", created_at: "2020-01-01T00:00:00Z" }) },
		]);

		const { previewImportPlaylistClips } = await loadDatabaseActions();
		const result = await previewImportPlaylistClips("playlist-1", {
			overlayType: "All" as never,
			clipCreatorsOnly: ["Allowed"],
			clipCreatorsBlocked: ["20"],
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("c1");
	});

	it("shared overlay configuration clears playlistId when type is not Playlist", async () => {
		const { buildOverlayUpdatePayload } = await import("@/server/resources/overlay-configuration");
		expect(buildOverlayUpdatePayload({ name: "Overlay", status: "active", type: "Featured", playlistId: "playlist-2" } as any, true)).toMatchObject({ type: "Featured", playlistId: null });
	});
	it("saveOverlay preserves playlist mode and leaves reward delivery to the durable worker", async () => {
		const { buildOverlayUpdatePayload } = await import("@/server/resources/overlay-configuration");
		expect(buildOverlayUpdatePayload({ type: "Playlist", playlistId: "playlist-2", rewardId: "reward-1" } as any, true)).toMatchObject({ type: "Playlist", playlistId: "playlist-2", rewardId: "reward-1" });
		const { saveOverlay } = await loadDatabaseActions();
		saveBrowserOverlay.mockResolvedValueOnce({ id: "overlay-1", ownerId: "owner-1", type: "Playlist", playlistId: "playlist-2", rewardId: "reward-1", configurationRevision: 2 });
		subscribeToReward.mockResolvedValueOnce(undefined);
		await saveOverlay("overlay-1", { type: "Playlist" as never, playlistId: "playlist-2", rewardId: "reward-1" }, 1);
		expect(subscribeToReward).not.toHaveBeenCalled();
		expect(updateCalls).toEqual([]);
	});
	it("shared Free configuration payload leaves retained advanced fields untouched", async () => {
		const { buildOverlayUpdatePayload } = await import("@/server/resources/overlay-configuration");
		const payload = buildOverlayUpdatePayload({ name: "Overlay", type: "Featured", minClipViews: 999, blacklistWords: ["bad"], clipPackSize: 500, rewardId: "reward-new" } as any, false);
		expect(payload).toMatchObject({ name: "Overlay", type: "Featured" });
		for (const key of ["minClipViews", "blacklistWords", "clipPackSize", "rewardId"]) expect(payload).not.toHaveProperty(key);
	});
	it("createOverlay respects free-plan single-overlay limit", async () => {
		// Policy and races execute against real PG in creation-quotas.test.ts.
		createBrowserOverlay.mockResolvedValueOnce(null);
		const { createOverlay } = await loadDatabaseActions();
		expect(await createOverlay("owner-1")).toBeNull();
		expect(createBrowserOverlay).toHaveBeenCalledWith("owner-1");
	});
	it("createOverlay inserts default overlay when owner can create", async () => {
		const overlay = { id: "overlay-new", ownerId: "owner-1", type: "Featured", playlistId: null, configurationRevision: 1 };
		createBrowserOverlay.mockResolvedValueOnce(overlay);
		const { createOverlay } = await loadDatabaseActions();
		expect(await createOverlay("owner-1")).toBe(overlay);
		expect(createBrowserOverlay).toHaveBeenCalledWith("owner-1");
	});

	it("downgradeUserPlan retains every creator resource", async () => {
		const { downgradeUserPlan } = await loadDatabaseActions();
		await downgradeUserPlan("owner-1");

		const { reconcileUserEntitlements } = jest.requireMock("@lib/entitlements");
		expect(reconcileUserEntitlements).toHaveBeenCalledWith("owner-1");
		expect(deleteCalls).toHaveLength(0);
		expect(updateCalls).toHaveLength(0);
	});
	it("routes browser overlay creation through the shared locked backend adapter", async () => {
		const overlay = { id: "backend-created", ownerId: "owner-1", configurationRevision: 1, secret: "browser-secret" };
		createBrowserOverlay.mockResolvedValueOnce(overlay);
		const { createOverlay } = await loadDatabaseActions();
		expect(await createOverlay("owner-1")).toBe(overlay);
		expect(createBrowserOverlay).toHaveBeenCalledWith("owner-1");
	});
	it("TDD-BROWSER-ITEMS-003 import without last-read revision fails before authorization or source lookup", async () => {
		const { importPlaylistClips } = await loadDatabaseActions();
		expect(await importPlaylistClips("playlist-1", {}, "append")).toBeNull();
		expect(dbSelect).not.toHaveBeenCalled();
	});
});
