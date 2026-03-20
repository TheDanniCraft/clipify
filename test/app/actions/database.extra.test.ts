/** @jest-environment node */
export {};

const updateCalls: any[] = [];
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const dbDelete = jest.fn();
const dbSelect = jest.fn();

const tableResults = new Map<string, unknown[]>();

function queueTableResult(tableName: string, value: unknown) {
	if (!tableResults.has(tableName)) tableResults.set(tableName, []);
	tableResults.get(tableName)!.push(value);
}

function makeSelectChain(tableName?: string) {
	const chain: Record<string, any> = {};
	chain.from = (table: any) => {
        chain._tableName = typeof table === "string" ? table : (table && typeof table === "object" ? Object.values(table)[0] : undefined);
        return chain;
    };
	chain.where = () => chain;
	chain.limit = () => chain;
	chain.inArray = () => chain;
	chain.orderBy = () => chain;
	chain.execute = async () => {
        const name = tableName || chain._tableName;
        if (name && tableResults.has(name) && tableResults.get(name)!.length > 0) {
            return tableResults.get(name)!.shift();
        }
        return [];
    };
	return chain;
}

function makeUpdateChain() {
	return {
		set: (set: any) => {
			updateCalls.push(set);
			return {
				where: () => ({
					execute: async () => ({ rowCount: 1 }),
				}),
				execute: async () => ({ rowCount: 1 }),
			};
		},
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
	usersTable: "users",
	overlaysTable: "overlays",
	editorsTable: "editors",
	twitchCacheTable: "twitch_cache",
}));

jest.mock("drizzle-orm", () => {
    const original = jest.requireActual("drizzle-orm");
    return {
        ...original,
        eq: jest.fn(() => "eq"),
        and: jest.fn(() => "and"),
        or: jest.fn(() => "or"),
        isNull: jest.fn(() => "isNull"),
        inArray: jest.fn(() => "inArray"),
        lt: jest.fn(() => "lt"),
        gt: jest.fn(() => "gt"),
        desc: jest.fn(() => "desc"),
        max: jest.fn(() => "max"),
        sql: Object.assign(jest.fn(() => "sql"), {
            join: jest.fn((parts) => parts.join(" ")),
            raw: jest.fn((val) => String(val)),
        }),
    };
});

const validateAuth = jest.fn();
jest.mock("@actions/auth", () => ({
	validateAuth: (...args: any[]) => validateAuth(...args),
}));

function loadDatabaseActions() {
	jest.resetModules();
	return require("@/app/actions/database");
}

describe("database.extra.test.ts", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		tableResults.clear();
		updateCalls.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbUpdate.mockImplementation(() => makeUpdateChain());
	});

	it("touchUser updates lastLogin", async () => {
		const { touchUser } = loadDatabaseActions();
		await touchUser("user-1");
		expect(dbUpdate).toHaveBeenCalled();
		expect(updateCalls[0]).toHaveProperty("lastLogin");
	});

	it("touchOverlay updates lastUsedAt", async () => {
		const { touchOverlay } = loadDatabaseActions();
		await touchOverlay("overlay-1");
		expect(dbUpdate).toHaveBeenCalled();
		expect(updateCalls[0]).toHaveProperty("lastUsedAt");
	});

	it("getEditorAccess returns editor rows", async () => {
		const { getEditorAccess } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "user-1" });
		queueTableResult("editors", [{ id: "ed-1", editorId: "user-1", userId: "owner-1" }]);
		const result = await getEditorAccess("user-1");
		expect(result).toHaveLength(1);
		expect(result[0].userId).toBe("owner-1");
	});

	it("getEditorAccess handles unauthenticated", async () => {
		const { getEditorAccess } = loadDatabaseActions();
		validateAuth.mockResolvedValue(null);
		const result = await getEditorAccess("user-1");
		expect(result).toBeNull();
	});

	it("getEditorAccess handles error", async () => {
		const { getEditorAccess } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "user-1" });
        dbSelect.mockImplementationOnce(() => ({
            from: () => ({
                where: () => ({
                    execute: async () => { throw new Error("DB error"); }
                })
            })
        }));
		await expect(getEditorAccess("user-1")).rejects.toThrow("Failed to check editor access");
	});

	it("setPlayerVolumeForOwner updates volume", async () => {
		const { setPlayerVolumeForOwner } = loadDatabaseActions();
		const result = await setPlayerVolumeForOwner("owner-1", 50);
		expect(result).toBe(50);
		expect(dbUpdate).toHaveBeenCalled();
		expect(updateCalls[0].playerVolume).toBe(50);
	});

	it("setPlayerVolumeForOwner clamps volume", async () => {
		const { setPlayerVolumeForOwner } = loadDatabaseActions();
		await setPlayerVolumeForOwner("owner-1", 150);
		expect(updateCalls[0].playerVolume).toBe(100);
		updateCalls.length = 0;
		await setPlayerVolumeForOwner("owner-1", -10);
		expect(updateCalls[0].playerVolume).toBe(0);
	});

	it("setPlayerVolumeForOwner handles error", async () => {
		const { setPlayerVolumeForOwner } = loadDatabaseActions();
		dbUpdate.mockImplementationOnce(() => {
			throw new Error("DB error");
		});
		await expect(setPlayerVolumeForOwner("owner-1", 50)).rejects.toThrow("Failed to update player volume");
	});

	it("getEditorOverlays returns overlays for editor", async () => {
		const { getEditorOverlays } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "editor-1" });
		queueTableResult("editors", [{ userId: "owner-1" }]); // owners
		queueTableResult("overlays", [{ id: "ov-1", ownerId: "owner-1" }]); // overlays
		const result = await getEditorOverlays("editor-1");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("ov-1");
	});

	it("getEditorOverlays returns empty array if no editorships", async () => {
		const { getEditorOverlays } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "editor-1" });
		queueTableResult("editors", []); // no owners
		const result = await getEditorOverlays("editor-1");
		expect(result).toEqual([]);
	});

	it("getEditorOverlays handles unauthorized", async () => {
		const { getEditorOverlays } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "other-user" });
		const result = await getEditorOverlays("editor-1");
		expect(result).toBeNull();
	});

	it("getClipCacheStatus returns status", async () => {
		const { getClipCacheStatus } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "owner-1" });
		
		// canEditOwner check (requireUser + editor check)
		queueTableResult("editors", []); // editorRows empty

		// getClipCacheStatusForOwnerServer calls:
		// 1. getTwitchCacheByPrefixEntries (from twitch_cache table)
		queueTableResult("twitch_cache", [
			{ key: "clip:owner-1:1", value: JSON.stringify({ id: "1", created_at: "2020-01-01T00:00:00Z" }) },
			{ key: "clip:owner-1:2", value: JSON.stringify({ unavailable: true }) },
		]);
		// 2. getTwitchCache (state) (from twitch_cache table)
		queueTableResult("twitch_cache", [{ value: JSON.stringify({ backfillComplete: true, lastIncrementalSyncAt: "2020-01-02T00:00:00Z" }) }]);

		const result = await getClipCacheStatus("owner-1");
		expect(result.cachedClipCount).toBe(1);
		expect(result.unavailableClipCount).toBe(1);
		expect(result.backfillComplete).toBe(true);
	});

	it("getClipCacheStatusForOwnerServer handles empty cache", async () => {
		const { getClipCacheStatusForOwnerServer } = loadDatabaseActions();
		queueTableResult("twitch_cache", []); // entries
		queueTableResult("twitch_cache", []); // state
		const result = await getClipCacheStatusForOwnerServer("owner-1");
		expect(result.cachedClipCount).toBe(0);
		expect(result.estimatedCoveragePercent).toBe(0);
	});

	it("getAllOverlays returns all overlays for user", async () => {
		const { getAllOverlays } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "user-1" });
		queueTableResult("overlays", [{ id: "ov-1", ownerId: "user-1" }]);
		const result = await getAllOverlays("user-1");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("ov-1");
	});

	it("getAllOverlays handles unauthorized", async () => {
		const { getAllOverlays } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "other-user" });
		const result = await getAllOverlays("user-1");
		expect(result).toBeNull();
	});

	it("getAllOverlayIds returns all overlay ids for user", async () => {
		const { getAllOverlayIds } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "user-1" });
		queueTableResult("overlays", [{ id: "ov-1" }, { id: "ov-2" }]);
		const result = await getAllOverlayIds("user-1");
		expect(result).toEqual(["ov-1", "ov-2"]);
	});

	it("getAllOverlayIdsByOwner returns all overlay ids for owner", async () => {
		const { getAllOverlayIdsByOwner } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "owner-1" });
		queueTableResult("overlays", [{ id: "ov-1" }]);
		const result = await getAllOverlayIdsByOwner("owner-1");
		expect(result).toEqual(["ov-1"]);
	});

	it("getAllOverlayIdsByOwnerServer returns all overlay ids", async () => {
		const { getAllOverlayIdsByOwnerServer } = loadDatabaseActions();
		queueTableResult("overlays", [{ id: "ov-1" }]);
		const result = await getAllOverlayIdsByOwnerServer("owner-1");
		expect(result).toEqual(["ov-1"]);
	});

	it("getAllOverlaysByOwnerServer returns all overlays", async () => {
		const { getAllOverlaysByOwnerServer } = loadDatabaseActions();
		queueTableResult("overlays", [{ id: "ov-1" }]);
		const result = await getAllOverlaysByOwnerServer("owner-1");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("ov-1");
	});
});
