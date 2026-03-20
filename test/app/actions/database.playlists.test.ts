/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const insertQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const dbDelete = jest.fn();
const dbTransaction = jest.fn();

const validateAuth = jest.fn();
const resolveUserEntitlements = jest.fn();
const getFeatureAccess = jest.fn(() => ({ allowed: true }));
const getTwitchCacheByPrefixEntries = jest.fn();
const subscribeToReward = jest.fn();

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
};
const editorsTable = {
	editorId: "editors.editor_id",
	userId: "editors.user_id",
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

function queueSelectResult(value: unknown) {
	selectQueue.push(value);
}

function queueInsertResult(value: unknown) {
	insertQueue.push(value);
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

function makeTx() {
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
	tokenTable: {},
	usersTable,
	overlaysTable,
	playlistsTable,
	playlistClipsTable,
	queueTable: {},
	settingsTable: {},
	modQueueTable: {},
	editorsTable,
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

jest.mock("@lib/tokenCrypto", () => ({
	encryptToken: jest.fn((value: string) => value),
	decryptToken: jest.fn((value: string) => value),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess,
}));

jest.mock("@lib/entitlements", () => ({
	ensureReverseTrialGrantForUser: jest.fn(),
	resolveUserEntitlements: (...args: unknown[]) => resolveUserEntitlements(...args),
	resolveUserEntitlementsForUsers: jest.fn(),
}));

jest.mock("drizzle-orm", () => ({
	eq: jest.fn(() => "eq"),
	inArray: jest.fn(() => "inArray"),
	and: jest.fn(() => "and"),
	or: jest.fn(() => "or"),
	isNull: jest.fn(() => "isNull"),
	lt: jest.fn(() => "lt"),
	gt: jest.fn(() => "gt"),
	sql: Object.assign(jest.fn(() => "sql"), {
		join: jest.fn((parts: unknown[], separator = " ") => parts.join(String(separator))),
		raw: jest.fn((value: unknown) => String(value)),
	}),
	desc: jest.fn(() => "desc"),
	max: jest.fn(() => "max"),
}));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database playlist logic", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
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

		expect(result).toEqual([
			expect.objectContaining({ id: "playlist-1", clipCount: 3, accessType: "owner" }),
			expect.objectContaining({ id: "playlist-2", clipCount: 0, accessType: "editor" }),
		]);
	});

	it("returns null for getAllPlaylists when user is not authorized", async () => {
		validateAuth.mockResolvedValueOnce(null);
		const { getAllPlaylists } = await loadDatabaseActions();
		await expect(getAllPlaylists("owner-1")).resolves.toBeNull();
	});

	it("returns owner playlists for editor access via getPlaylistsForOwner", async () => {
		validateAuth.mockResolvedValueOnce({
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
		validateAuth.mockResolvedValueOnce({ id: "viewer-1", plan: "free" });
		queueSelectResult([]);
		const { getPlaylistsForOwner } = await loadDatabaseActions();
		await expect(getPlaylistsForOwner("owner-1")).resolves.toBeNull();
	});

	it("blocks createPlaylist for free users at the 1-playlist limit", async () => {
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([{ id: "existing-playlist" }]);

		const { createPlaylist } = await loadDatabaseActions();
		await expect(createPlaylist("owner-1", "Roadmap Picks")).rejects.toThrow("Free plan allows only one playlist");
	});

	it("creates playlist for pro users with trimmed name", async () => {
		resolveUserEntitlements.mockResolvedValueOnce({
			effectivePlan: "pro",
			isBillingPro: false,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: true,
			source: "grant",
		});
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueInsertResult([{ id: "playlist-new", ownerId: "owner-1", name: "My Playlist", createdAt: new Date(), updatedAt: new Date() }]);

		const { createPlaylist } = await loadDatabaseActions();
		const created = await createPlaylist("owner-1", "  My Playlist  ");

		expect(created).toEqual(expect.objectContaining({ id: "playlist-new", name: "My Playlist" }));
		expect(insertCalls.some((call) => call.table === playlistsTable)).toBe(true);
	});

	it("returns null from createPlaylist for unauthorized editor", async () => {
		validateAuth.mockResolvedValueOnce({
			id: "viewer-1",
			plan: "free",
		});
		queueSelectResult([]);
		const { createPlaylist } = await loadDatabaseActions();
		await expect(createPlaylist("owner-1", "Nope")).resolves.toBeNull();
	});

	it("throws for empty playlist names", async () => {
		const { createPlaylist } = await loadDatabaseActions();
		await expect(createPlaylist("owner-1", "   ")).rejects.toThrow("Playlist name is required");
	});

	it("saves playlist name with trimming and validates non-empty", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Old", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "New Name", createdAt: new Date(), updatedAt: new Date() }]);
		const { savePlaylist } = await loadDatabaseActions();
		const saved = await savePlaylist("playlist-1", { name: "  New Name  " });
		expect(saved).toEqual(expect.objectContaining({ name: "New Name" }));
		expect(updateCalls.some((call) => call.table === playlistsTable)).toBe(true);

		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Old", createdAt: new Date(), updatedAt: new Date() }]);
		await expect(savePlaylist("playlist-1", { name: "   " })).rejects.toThrow("Playlist name is required");
	});

	it("deletes playlist with access and blocks unauthorized deletion", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		const { deletePlaylist } = await loadDatabaseActions();
		await expect(deletePlaylist("playlist-1")).resolves.toBe(true);
		expect(deleteCalls.some((call) => call.table === playlistsTable)).toBe(true);

		validateAuth.mockResolvedValueOnce({ id: "editor-2", plan: "free" });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([]);
		await expect(deletePlaylist("playlist-1")).resolves.toBe(false);
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

	it("returns empty playlist clips when caller has no access", async () => {
		validateAuth.mockResolvedValueOnce({ id: "editor-2", plan: "free" });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([]);
		const { getPlaylistClips } = await loadDatabaseActions();
		await expect(getPlaylistClips("playlist-1")).resolves.toEqual([]);
	});

	it("enforces free playlist clip limit when appending", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult(
			Array.from({ length: 50 }, (_unused, index) => ({
				playlistId: "playlist-1",
				clipId: `clip-${index}`,
				position: index,
				clipData: JSON.stringify({ id: `clip-${index}` }),
			})),
		);

		const { upsertPlaylistClips } = await loadDatabaseActions();
		await expect(
			upsertPlaylistClips(
				"playlist-1",
				[
					{
						id: "clip-over-limit",
						url: "https://clips.twitch.tv/clip-over-limit",
						embed_url: "",
						broadcaster_id: "owner-1",
						broadcaster_name: "owner",
						creator_id: "creator-1",
						creator_name: "creator",
						video_id: "video",
						game_id: "game",
						language: "en",
						title: "clip",
						view_count: 10,
						created_at: "2026-03-10T00:00:00.000Z",
						thumbnail_url: "https://thumb",
						duration: 20,
					},
				],
				"append",
			),
		).rejects.toThrow("Free plan playlists are limited to 50 clips");
	});

	it("replaces playlist clips in replace mode and refreshes updatedAt", async () => {
		resolveUserEntitlements.mockResolvedValueOnce({
			effectivePlan: "pro",
			isBillingPro: false,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: true,
			source: "grant",
		});
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([{ playlistId: "playlist-1", clipId: "old", position: 0, clipData: JSON.stringify({ id: "old" }) }]);
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]);
		queueSelectResult([
			{ playlistId: "playlist-1", clipId: "new-1", position: 0, clipData: JSON.stringify({ id: "new-1", title: "New 1" }) },
			{ playlistId: "playlist-1", clipId: "new-2", position: 1, clipData: JSON.stringify({ id: "new-2", title: "New 2" }) },
		]);

		const { upsertPlaylistClips } = await loadDatabaseActions();
		const result = await upsertPlaylistClips(
			"playlist-1",
			[
				{
					id: "new-1",
					url: "https://clips.twitch.tv/new-1",
					embed_url: "",
					broadcaster_id: "owner-1",
					broadcaster_name: "owner",
					creator_id: "creator-1",
					creator_name: "creator-1",
					video_id: "video",
					game_id: "game",
					language: "en",
					title: "New 1",
					view_count: 10,
					created_at: "2026-03-10T00:00:00.000Z",
					thumbnail_url: "https://thumb",
					duration: 12,
				},
				{
					id: "new-2",
					url: "https://clips.twitch.tv/new-2",
					embed_url: "",
					broadcaster_id: "owner-1",
					broadcaster_name: "owner",
					creator_id: "creator-2",
					creator_name: "creator-2",
					video_id: "video",
					game_id: "game",
					language: "en",
					title: "New 2",
					view_count: 8,
					created_at: "2026-03-09T00:00:00.000Z",
					thumbnail_url: "https://thumb",
					duration: 14,
				},
			],
			"replace",
		);
		expect(result.map((clip) => clip.id)).toEqual(["new-1", "new-2"]);
		expect(updateCalls.some((call) => call.table === playlistsTable)).toBe(true);
	});

	it("rejects replace mode for free users when replacing with >50 clips", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([]);
		const clips = Array.from({ length: 51 }, (_unused, index) => ({
			id: `clip-${index}`,
			url: `https://clips.twitch.tv/clip-${index}`,
			embed_url: "",
			broadcaster_id: "owner-1",
			broadcaster_name: "owner",
			creator_id: `creator-${index}`,
			creator_name: `creator-${index}`,
			video_id: "video",
			game_id: "game",
			language: "en",
			title: `Clip ${index}`,
			view_count: index + 1,
			created_at: "2026-03-10T00:00:00.000Z",
			thumbnail_url: "https://thumb",
			duration: 10,
		}));
		const { upsertPlaylistClips } = await loadDatabaseActions();
		await expect(upsertPlaylistClips("playlist-1", clips as never, "replace")).rejects.toThrow("Free plan playlists are limited to 50 clips");
	});

	it("append mode inserts new clips and returns updated snapshot", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		resolveUserEntitlements.mockResolvedValueOnce({
			effectivePlan: "pro",
			isBillingPro: false,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: true,
			source: "grant",
		});
		queueSelectResult([]);
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]);
		queueSelectResult([{ playlistId: "playlist-1", clipId: "clip-a", position: 0, clipData: JSON.stringify({ id: "clip-a" }) }]);

		const { upsertPlaylistClips } = await loadDatabaseActions();
		const result = await upsertPlaylistClips(
			"playlist-1",
			[
				{
					id: "clip-a",
					url: "https://clips.twitch.tv/clip-a",
					embed_url: "",
					broadcaster_id: "owner-1",
					broadcaster_name: "owner",
					creator_id: "creator",
					creator_name: "creator",
					video_id: "video",
					game_id: "game",
					language: "en",
					title: "Clip A",
					view_count: 30,
					created_at: "2026-03-10T00:00:00.000Z",
					thumbnail_url: "https://thumb",
					duration: 18,
				},
			],
			"append",
		);
		expect(result.map((clip) => clip.id)).toEqual(["clip-a"]);
		expect(insertCalls.some((call) => call.table === playlistClipsTable)).toBe(true);
	});

	it("append mode dedupes existing clips and avoids inserts when nothing new arrives", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([{ playlistId: "playlist-1", clipId: "clip-1", position: 0, clipData: JSON.stringify({ id: "clip-1", title: "Clip 1" }) }]);
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]);
		queueSelectResult([{ playlistId: "playlist-1", clipId: "clip-1", position: 0, clipData: JSON.stringify({ id: "clip-1", title: "Clip 1" }) }]);

		const { upsertPlaylistClips } = await loadDatabaseActions();
		const result = await upsertPlaylistClips(
			"playlist-1",
			[
				{
					id: "clip-1",
					url: "https://clips.twitch.tv/clip-1",
					embed_url: "",
					broadcaster_id: "owner-1",
					broadcaster_name: "owner",
					creator_id: "creator",
					creator_name: "creator",
					video_id: "video",
					game_id: "game",
					language: "en",
					title: "Clip 1",
					view_count: 1,
					created_at: "2026-03-10T00:00:00.000Z",
					thumbnail_url: "https://thumb",
					duration: 20,
				},
			],
			"append",
		);
		expect(result.map((clip) => clip.id)).toEqual(["clip-1"]);
		const clipInserts = insertCalls.filter((call) => call.table === playlistClipsTable);
		expect(clipInserts).toHaveLength(0);
	});

	it("reorders playlist clips and keeps unspecified clips at the end", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([
			{ playlistId: "playlist-1", clipId: "clip-a", position: 0, clipData: JSON.stringify({ id: "clip-a", title: "A" }) },
			{ playlistId: "playlist-1", clipId: "clip-b", position: 1, clipData: JSON.stringify({ id: "clip-b", title: "B" }) },
			{ playlistId: "playlist-1", clipId: "clip-c", position: 2, clipData: JSON.stringify({ id: "clip-c", title: "C" }) },
		]);
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1" }]);
		queueSelectResult([
			{ playlistId: "playlist-1", clipId: "clip-b", position: 0, clipData: JSON.stringify({ id: "clip-b", title: "B" }) },
			{ playlistId: "playlist-1", clipId: "clip-a", position: 1, clipData: JSON.stringify({ id: "clip-a", title: "A" }) },
			{ playlistId: "playlist-1", clipId: "clip-c", position: 2, clipData: JSON.stringify({ id: "clip-c", title: "C" }) },
		]);

		const { reorderPlaylistClips } = await loadDatabaseActions();
		const ordered = await reorderPlaylistClips("playlist-1", ["clip-b", "clip-a"]);

		expect(ordered.map((clip) => clip.id)).toEqual(["clip-b", "clip-a", "clip-c"]);
		expect(updateCalls.filter((call) => call.table === playlistClipsTable)).toHaveLength(1);
		expect(deleteCalls.filter((call) => call.table === playlistClipsTable)).toHaveLength(0);
		expect(insertCalls.filter((call) => call.table === playlistClipsTable)).toHaveLength(0);
	});

	it("returns empty list for reorder when playlist access is denied", async () => {
		validateAuth.mockResolvedValueOnce({ id: "editor-2", plan: "free" });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([]);
		const { reorderPlaylistClips } = await loadDatabaseActions();
		await expect(reorderPlaylistClips("playlist-1", ["clip-a"])).resolves.toEqual([]);
	});

	it("blocks auto import for non-pro users", async () => {
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);

		const { importPlaylistClips } = await loadDatabaseActions();
		await expect(
			importPlaylistClips("playlist-1", { overlayType: "All" as never }, "append"),
		).rejects.toThrow("Auto import is a Pro feature");
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
		);

		expect(imported.map((clip) => clip.id)).toEqual(["featured-keep", "mod-extra"]);
		const insertedPlaylistClips = insertCalls.find((call) => call.table === playlistClipsTable);
		expect(insertedPlaylistClips).toBeTruthy();
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
		const imported = await importPlaylistClips("playlist-1", { overlayType: "All" as never, categoryId: "game-123" }, "replace");

		expect(imported.every((clip) => clip.id !== "cat-miss")).toBe(true);
	});

	it("returns empty import result when playlist access fails", async () => {
		validateAuth.mockResolvedValueOnce({ id: "viewer-1", plan: "free" });
		queueSelectResult([{ id: "playlist-1", ownerId: "owner-1", name: "Main", createdAt: new Date(), updatedAt: new Date() }]);
		queueSelectResult([]);
		const { importPlaylistClips, previewImportPlaylistClips } = await loadDatabaseActions();
		await expect(importPlaylistClips("playlist-1", { overlayType: "All" as never }, "append")).resolves.toEqual([]);
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

	it("saveOverlay clears playlistId when type is not Playlist", async () => {
		const currentOverlay = {
			id: "overlay-1",
			ownerId: "owner-1",
			name: "Overlay",
			status: "active",
			type: "Playlist",
			playlistId: "playlist-1",
			rewardId: null,
			secret: "secret-1",
		};
		queueSelectResult([currentOverlay]);
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([{ ...currentOverlay, type: "Featured", playlistId: null }]);

		const { saveOverlay } = await loadDatabaseActions();
		const saved = await saveOverlay("overlay-1", { type: "Featured" as never, playlistId: "playlist-2" });
		expect(saved).toEqual(expect.objectContaining({ id: "overlay-1" }));
		const overlayUpdate = updateCalls.find((call) => call.table === overlaysTable);
		expect(overlayUpdate).toBeTruthy();
		expect(overlayUpdate?.set).toEqual(expect.objectContaining({ type: "Featured", playlistId: null }));
	});

	it("saveOverlay preserves playlistId in playlist mode and subscribes reward changes", async () => {
		const currentOverlay = {
			id: "overlay-1",
			ownerId: "owner-1",
			name: "Overlay",
			status: "active",
			type: "Featured",
			playlistId: null,
			rewardId: null,
			secret: "secret-1",
		};
		queueSelectResult([currentOverlay]);
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([{ ...currentOverlay, type: "Playlist", playlistId: "playlist-2", rewardId: "reward-1" }]);

		const { saveOverlay } = await loadDatabaseActions();
		await saveOverlay("overlay-1", { type: "Playlist" as never, playlistId: "playlist-2", rewardId: "reward-1" });
		const overlayUpdate = updateCalls.find((call) => call.table === overlaysTable);
		expect(overlayUpdate?.set).toEqual(expect.objectContaining({ type: "Playlist", playlistId: "playlist-2", rewardId: "reward-1" }));
		expect(subscribeToReward).toHaveBeenCalledWith("owner-1", "reward-1");
	});

	it("saveOverlay strips advanced fields when owner has no advanced access", async () => {
		getFeatureAccess.mockReturnValueOnce({ allowed: false });
		const currentOverlay = {
			id: "overlay-1",
			ownerId: "owner-1",
			name: "Overlay",
			status: "active",
			type: "Featured",
			playlistId: null,
			rewardId: "reward-old",
			secret: "secret-1",
			minClipViews: 0,
			minClipDuration: 0,
			maxClipDuration: 60,
			blacklistWords: [],
			clipPackSize: 100,
		};
		queueSelectResult([currentOverlay]);
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([currentOverlay]);

		const { saveOverlay } = await loadDatabaseActions();
		await saveOverlay("overlay-1", {
			minClipViews: 999,
			blacklistWords: ["bad"],
			clipPackSize: 500,
			rewardId: "reward-new",
		});
		const overlayUpdate = updateCalls.find((call) => call.table === overlaysTable);
		expect(overlayUpdate?.set).toEqual(expect.objectContaining({ minClipViews: 0, blacklistWords: [], clipPackSize: 100, rewardId: null }));
	});

	it("createOverlay respects free-plan single-overlay limit", async () => {
		getFeatureAccess.mockReturnValueOnce({ allowed: false });
		queueSelectResult([{ id: "owner-1", plan: "free", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueSelectResult([{ id: "existing-overlay", ownerId: "owner-1" }]);

		const { createOverlay } = await loadDatabaseActions();
		await expect(createOverlay("owner-1")).resolves.toBeNull();
	});

	it("createOverlay inserts default overlay when owner can create", async () => {
		getFeatureAccess.mockReturnValueOnce({ allowed: true });
		queueSelectResult([{ id: "owner-1", plan: "pro", createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
		queueInsertResult([{ id: "overlay-new", ownerId: "owner-1", type: "Featured", playlistId: null }]);

		const { createOverlay } = await loadDatabaseActions();
		const created = await createOverlay("owner-1");
		expect(created).toEqual(expect.objectContaining({ id: "overlay-new", type: "Featured", playlistId: null }));
		expect(insertCalls.some((call) => call.table === overlaysTable)).toBe(true);
	});

	it("downgradeUserPlan trims overlays/playlists and caps kept playlist to 50 clips", async () => {
		queueSelectResult([
			{ id: "overlay-1", ownerId: "owner-1" },
			{ id: "overlay-2", ownerId: "owner-1" },
		]);
		queueSelectResult([
			{ id: "playlist-1", ownerId: "owner-1" },
			{ id: "playlist-2", ownerId: "owner-1" },
		]);
		queueSelectResult(
			Array.from({ length: 52 }, (_unused, index) => ({
				playlistId: "playlist-1",
				clipId: `clip-${index + 1}`,
				position: index,
			})),
		);

		const { downgradeUserPlan } = await loadDatabaseActions();
		await downgradeUserPlan("owner-1");

		expect(deleteCalls.filter((call) => call.table === overlaysTable).length).toBeGreaterThan(0);
		expect(deleteCalls.filter((call) => call.table === playlistsTable).length).toBeGreaterThan(0);
		expect(deleteCalls.filter((call) => call.table === playlistClipsTable).length).toBeGreaterThan(0);
		const overlayReset = updateCalls.find((call) => call.table === overlaysTable);
		expect(overlayReset?.set).toEqual(expect.objectContaining({ playlistId: null, rewardId: null, minClipViews: 0 }));
	});
});
