/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const dbDelete = jest.fn();

const twitchCacheTable = {
    type: "twitch_cache.type",
    key: "twitch_cache.key",
    value: "twitch_cache.value",
    fetchedAt: "twitch_cache.fetched_at",
    expiresAt: "twitch_cache.expires_at",
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
	chain.execute = async () => (selectQueue.length > 0 ? selectQueue.shift() : []);
	return chain;
}

function makeInsertChain() {
	return {
		values: () => ({
			onConflictDoUpdate: () => ({
				execute: async () => undefined,
			}),
			execute: async () => undefined,
		}),
	};
}

function makeDeleteChain() {
	return {
		where: () => ({
			execute: async () => ({ rowCount: 1 }),
		}),
		execute: async () => ({ rowCount: 1 }),
	};
}

jest.mock("@/db/client", () => ({
	db: {
		select: (..._args: unknown[]) => dbSelect(..._args),
		insert: (..._args: unknown[]) => dbInsert(..._args),
		update: (..._args: unknown[]) => dbUpdate(..._args),
		delete: (..._args: unknown[]) => dbDelete(..._args),
	},
}));

jest.mock("@/db/schema", () => ({
	twitchCacheTable,
    usersTable: { id: "users.id" },
    overlaysTable: { id: "overlays.id" },
    playlistsTable: { id: "playlists.id" },
    playlistClipsTable: { id: "playlist_clips.id" },
    queueTable: { id: "queue.id" },
    settingsTable: { id: "settings.id" },
    modQueueTable: { id: "mod_queue.id" },
    editorsTable: { id: "editors.id" },
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
}));

jest.mock("@actions/auth", () => ({
    validateAuth: jest.fn(),
}));

jest.mock("@actions/twitch", () => ({
    getUserDetails: jest.fn(),
    getUsersDetailsBulk: jest.fn(),
    refreshAccessTokenWithContext: jest.fn(),
    subscribeToReward: jest.fn(),
    syncOwnerClipCache: jest.fn(),
}));

jest.mock("@actions/newsletter", () => ({
    syncProductUpdatesContact: jest.fn(),
    getProductUpdatesSubscriptionStatus: jest.fn(),
}));

jest.mock("@lib/tokenCrypto", () => ({
    encryptToken: jest.fn((val: string) => val),
    decryptToken: jest.fn((val: string) => val),
}));

jest.mock("@lib/featureAccess", () => ({
    getFeatureAccess: jest.fn(),
}));

jest.mock("@lib/entitlements", () => ({
    ensureReverseTrialGrantForUser: jest.fn(),
    resolveUserEntitlements: jest.fn(),
    resolveUserEntitlementsForUsers: jest.fn(),
}));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database cache logic", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbInsert.mockImplementation(() => makeInsertChain());
		dbDelete.mockImplementation(() => makeDeleteChain());
	});

	it("gets twitch cache correctly", async () => {
		const { getTwitchCache } = await loadDatabaseActions();
		queueSelectResult([{ value: JSON.stringify({ foo: "bar" }) }]);
		const result = await getTwitchCache(1 as any, "key");
		expect(result).toEqual({ foo: "bar" });
	});

    it("returns null if twitch cache is missing", async () => {
        const { getTwitchCache } = await loadDatabaseActions();
        queueSelectResult([]);
        const result = await getTwitchCache(1 as any, "key");
        expect(result).toBeNull();
    });

    it("returns null if twitch cache parsing fails", async () => {
        const { getTwitchCache } = await loadDatabaseActions();
        queueSelectResult([{ value: "invalid-json" }]);
        const result = await getTwitchCache(1 as any, "key");
        expect(result).toBeNull();
    });

    it("gets twitch cache entry correctly", async () => {
        const { getTwitchCacheEntry } = await loadDatabaseActions();
        const fetchedAt = new Date();
        queueSelectResult([{ value: JSON.stringify({ foo: "bar" }), fetchedAt }]);
        const result = await getTwitchCacheEntry(1 as any, "key");
        expect(result).toEqual({ hit: true, value: { foo: "bar" }, fetchedAt });
    });

    it("gets twitch cache stale correctly", async () => {
        const { getTwitchCacheStale } = await loadDatabaseActions();
        queueSelectResult([{ value: JSON.stringify({ foo: "bar" }) }]);
        const result = await getTwitchCacheStale(1 as any, "key");
        expect(result).toEqual({ foo: "bar" });
    });

    it("sets twitch cache correctly", async () => {
        const { setTwitchCache } = await loadDatabaseActions();
        await setTwitchCache(1 as any, "key", { foo: "bar" });
        expect(dbInsert).toHaveBeenCalled();
    });

    it("gets twitch cache batch correctly", async () => {
        const { getTwitchCacheBatch } = await loadDatabaseActions();
        queueSelectResult([
            { key: "key1", value: JSON.stringify({ id: 1 }) },
            { key: "key2", value: JSON.stringify({ id: 2 }) },
        ]);
        const result = await getTwitchCacheBatch(1 as any, ["key1", "key2"]);
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("gets twitch cache by prefix correctly", async () => {
        const { getTwitchCacheByPrefixEntries } = await loadDatabaseActions();
        queueSelectResult([
            { key: "prefix:1", value: JSON.stringify({ id: 1 }) },
            { key: "prefix:2", value: JSON.stringify({ id: 2 }) },
        ]);
        const result = await getTwitchCacheByPrefixEntries(1 as any, "prefix:");
        expect(result).toEqual([
            { key: "prefix:1", value: { id: 1 } },
            { key: "prefix:2", value: { id: 2 } },
        ]);
    });

    it("gets twitch cache stale batch correctly", async () => {
        const { getTwitchCacheStaleBatch } = await loadDatabaseActions();
        queueSelectResult([
            { key: "key1", value: JSON.stringify({ id: 1 }) },
        ]);
        const result = await getTwitchCacheStaleBatch(1 as any, ["key1"]);
        expect(result).toEqual([{ id: 1 }]);
    });

    it("sets twitch cache batch correctly", async () => {
        const { setTwitchCacheBatch } = await loadDatabaseActions();
        await setTwitchCacheBatch(1 as any, [{ key: "key1", value: { id: 1 } }]);
        expect(dbInsert).toHaveBeenCalled();
    });

    it("deletes twitch cache keys correctly", async () => {
        const { deleteTwitchCacheKeys } = await loadDatabaseActions();
        const result = await deleteTwitchCacheKeys(1 as any, ["key1"]);
        expect(result).toBe(1);
    });

    it("deletes twitch cache by prefix correctly", async () => {
        const { deleteTwitchCacheByPrefix } = await loadDatabaseActions();
        const result = await deleteTwitchCacheByPrefix(1 as any, "prefix:");
        expect(result).toBe(1);
    });

    it("gets cache read metrics snapshot", async () => {
        const { getTwitchCacheReadMetricsSnapshot } = await loadDatabaseActions();
        const result = await getTwitchCacheReadMetricsSnapshot();
        expect(result).toHaveProperty("hits");
        expect(result).toHaveProperty("misses");
    });

    it("handles error in getTwitchCache", async () => {
        const { getTwitchCache } = await loadDatabaseActions();
        dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await getTwitchCache(1 as any, "key");
        expect(result).toBeNull();
    });

    it("handles error in getTwitchCacheEntry", async () => {
        const { getTwitchCacheEntry } = await loadDatabaseActions();
        dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await getTwitchCacheEntry(1 as any, "key");
        expect(result).toEqual({ hit: false, value: null });
    });

    it("handles error in getTwitchCacheStale", async () => {
        const { getTwitchCacheStale } = await loadDatabaseActions();
        dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await getTwitchCacheStale(1 as any, "key");
        expect(result).toBeNull();
    });

    it("handles empty keys in getTwitchCacheBatch", async () => {
        const { getTwitchCacheBatch } = await loadDatabaseActions();
        const result = await getTwitchCacheBatch(1 as any, []);
        expect(result).toEqual([]);
    });

    it("handles error in getTwitchCacheBatch", async () => {
        const { getTwitchCacheBatch } = await loadDatabaseActions();
        dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await getTwitchCacheBatch(1 as any, ["key"]);
        expect(result).toEqual([]);
    });

    it("handles empty prefix in getTwitchCacheByPrefixEntries", async () => {
        const { getTwitchCacheByPrefixEntries } = await loadDatabaseActions();
        const result = await getTwitchCacheByPrefixEntries(1 as any, "");
        expect(result).toEqual([]);
    });

    it("handles error in getTwitchCacheByPrefixEntries", async () => {
        const { getTwitchCacheByPrefixEntries } = await loadDatabaseActions();
        dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await getTwitchCacheByPrefixEntries(1 as any, "prefix:");
        expect(result).toEqual([]);
    });

    it("handles empty keys in getTwitchCacheStaleBatch", async () => {
        const { getTwitchCacheStaleBatch } = await loadDatabaseActions();
        const result = await getTwitchCacheStaleBatch(1 as any, []);
        expect(result).toEqual([]);
    });

    it("handles error in getTwitchCacheStaleBatch", async () => {
        const { getTwitchCacheStaleBatch } = await loadDatabaseActions();
        dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await getTwitchCacheStaleBatch(1 as any, ["key"]);
        expect(result).toEqual([]);
    });

    it("handles error in setTwitchCache", async () => {
        const { setTwitchCache } = await loadDatabaseActions();
        dbInsert.mockImplementationOnce(() => { throw new Error("DB Error"); });
        // console.error is expected
        await expect(setTwitchCache(1 as any, "key", {})).resolves.not.toThrow();
    });

    it("handles empty entries in setTwitchCacheBatch", async () => {
        const { setTwitchCacheBatch } = await loadDatabaseActions();
        await expect(setTwitchCacheBatch(1 as any, [])).resolves.not.toThrow();
    });

    it("handles error in setTwitchCacheBatch", async () => {
        const { setTwitchCacheBatch } = await loadDatabaseActions();
        dbInsert.mockImplementationOnce(() => { throw new Error("DB Error"); });
        await expect(setTwitchCacheBatch(1 as any, [{ key: "k", value: {} }])).resolves.not.toThrow();
    });

    it("handles empty keys in deleteTwitchCacheKeys", async () => {
        const { deleteTwitchCacheKeys } = await loadDatabaseActions();
        const result = await deleteTwitchCacheKeys(1 as any, []);
        expect(result).toBe(0);
    });

    it("handles error in deleteTwitchCacheKeys", async () => {
        const { deleteTwitchCacheKeys } = await loadDatabaseActions();
        dbDelete.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await deleteTwitchCacheKeys(1 as any, ["key"]);
        expect(result).toBe(0);
    });

    it("handles empty prefix in deleteTwitchCacheByPrefix", async () => {
        const { deleteTwitchCacheByPrefix } = await loadDatabaseActions();
        const result = await deleteTwitchCacheByPrefix(1 as any, "");
        expect(result).toBe(0);
    });

    it("handles error in deleteTwitchCacheByPrefix", async () => {
        const { deleteTwitchCacheByPrefix } = await loadDatabaseActions();
        dbDelete.mockImplementationOnce(() => { throw new Error("DB Error"); });
        const result = await deleteTwitchCacheByPrefix(1 as any, "prefix:");
        expect(result).toBe(0);
    });

    it("handles cleanup in setTwitchCache", async () => {
        const { setTwitchCache } = await loadDatabaseActions();
        // Trigger cleanup (more than 10 mins since start)
        // lastTwitchCacheCleanupAt is 0 by default
        await setTwitchCache(1 as any, "key", { foo: "bar" });
        expect(dbDelete).toHaveBeenCalled();
    });
});
