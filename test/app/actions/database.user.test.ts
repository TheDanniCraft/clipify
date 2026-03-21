/** @jest-environment node */
export {};
import type { TwitchUserResponse } from "@types";

const selectQueue: unknown[] = [];
const insertCalls: any[] = [];
const updateCalls: any[] = [];
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const dbDelete = jest.fn();

const usersTable = {
    id: "users.id",
    username: "users.username",
    email: "users.email",
    avatar: "users.avatar",
    role: "users.role",
    plan: "users.plan",
    twitchCreatedAt: "users.twitch_created_at",
    stripeCustomerId: "users.stripe_customer_id",
    disabled: "users.disabled",
    disableType: "users.disable_type",
    disabledAt: "users.disabled_at",
    disabledReason: "users.disabled_reason",
    updatedAt: "users.updated_at",
    lastLogin: "users.last_login",
    createdAt: "users.created_at",
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
		values: (values: any) => {
            insertCalls.push(values);
            const result = {
                onConflictDoUpdate: () => ({
                    returning: () => ({
                        execute: async () => (Array.isArray(values) ? values : [values]),
                    }),
                    execute: async () => undefined,
                }),
                onConflictDoNothing: () => ({
                    returning: () => ({
                        execute: async () => (Array.isArray(values) ? values : [values]),
                    }),
                    execute: async () => undefined,
                }),
                returning: () => ({
                    execute: async () => (Array.isArray(values) ? values : [values]),
                }),
                execute: async () => undefined,
            };
            return result;
        },
	};
}

function makeUpdateChain() {
	return {
		set: (set: any) => {
            updateCalls.push(set);
            return {
                where: () => ({
                    returning: () => ({
                        execute: async () => [set],
                    }),
                    execute: async () => undefined,
                }),
                execute: async () => undefined,
            };
        },
	};
}

function makeDeleteChain() {
	return {
		where: () => ({
            returning: () => ({
                execute: async () => [{ id: "deleted-user" }],
            }),
			execute: async () => ({ rowCount: 1 }),
		}),
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
    usersTable,
    twitchCacheTable: { id: "twitch_cache.id" },
    overlaysTable: { id: "overlays.id" },
    playlistsTable: { id: "playlists.id" },
    playlistClipsTable: { id: "playlist_clips.id" },
    queueTable: { id: "queue.id" },
    settingsTable: { id: "settings.id" },
    modQueueTable: { id: "mod_queue.id" },
    tokenTable: { id: "token.id" },
    editorsTable: { id: "editors.id" },
}));

jest.mock("drizzle-orm", () => ({
	eq: jest.fn(() => "eq"),
	and: jest.fn(() => "and"),
    inArray: jest.fn(() => "inArray"),
    sql: Object.assign(jest.fn(() => "sql"), {
		join: jest.fn((parts: unknown[], separator = " ") => parts.join(String(separator))),
		raw: jest.fn((value: unknown) => String(value)),
	}),
    desc: jest.fn(() => "desc"),
}));

const validateAuth = jest.fn();
const validateAdminAuth = jest.fn();
jest.mock("@actions/auth", () => ({
    validateAuth,
    validateAdminAuth,
}));

const twitch = {
    getUserDetails: jest.fn(),
    getUsersDetailsBulk: jest.fn(),
    refreshAccessTokenWithContext: jest.fn(),
    subscribeToReward: jest.fn(),
    syncOwnerClipCache: jest.fn(),
};
jest.mock("@actions/twitch", () => twitch);

const tokenCrypto = {
    encryptToken: jest.fn((val: string) => val),
    decryptToken: jest.fn((val: string) => val),
};
jest.mock("@lib/tokenCrypto", () => tokenCrypto);

jest.mock("@lib/entitlements", () => ({
    resolveUserEntitlements: jest.fn((user) => ({ effectivePlan: user.plan || "free" })),
    ensureReverseTrialGrantForUser: jest.fn(),
}));

jest.mock("@actions/newsletter", () => ({
    syncProductUpdatesContact: jest.fn(),
}));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

function makeTwitchUser(overrides: Partial<TwitchUserResponse> = {}): TwitchUserResponse {
    return {
        id: "u-1",
        login: "u1",
        display_name: "u1",
        type: "",
        broadcaster_type: "",
        description: "",
        profile_image_url: "a",
        offline_image_url: "",
        view_count: 0,
        created_at: "2020-01-01",
        email: "e",
        ...overrides,
    };
}

describe("actions/database user logic", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
        insertCalls.length = 0;
        updateCalls.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbInsert.mockImplementation(() => makeInsertChain());
		dbUpdate.mockImplementation(() => makeUpdateChain());
		dbDelete.mockImplementation(() => makeDeleteChain());
        validateAuth.mockResolvedValue({ id: "user-1" });
        tokenCrypto.decryptToken.mockImplementation((val: string) => val);
        tokenCrypto.encryptToken.mockImplementation((val: string) => val);
	});

	it("gets user correctly", async () => {
		const { getUser } = await loadDatabaseActions();
        queueSelectResult([{ id: "user-1", username: "user1" }]);
		const result = await getUser("user-1");
		expect(result).toEqual({ id: "user-1", username: "user1" });
	});

    it("gets user plan correctly", async () => {
        const { getUserPlan } = await loadDatabaseActions();
        queueSelectResult([{ plan: "pro" }]);
        const result = await getUserPlan("user-1");
        expect(result).toBe("pro");
    });

    it("deletes user correctly", async () => {
        const { deleteUser } = await loadDatabaseActions();
        const result = await deleteUser("user-1");
        expect(result).toEqual({ id: "deleted-user" });
        expect(dbDelete).toHaveBeenCalled();
    });

    it("updates user subscription", async () => {
        const { updateUserSubscription } = await loadDatabaseActions();
        const result = await updateUserSubscription("user-1", "cus-1", "pro" as any);
        expect(result).toBeDefined();
        expect(dbUpdate).toHaveBeenCalled();
    });

    it("gets user by customer id", async () => {
        const { getUserByCustomerId } = await loadDatabaseActions();
        queueSelectResult([{ id: "user-1" }]);
        const result = await getUserByCustomerId("cus-1");
        expect(result).toEqual({ id: "user-1" });
    });

    it("checks if user is disabled", async () => {
        const { isUserDisabledByIdServer } = await loadDatabaseActions();
        queueSelectResult([{ disabled: true }]);
        const result = await isUserDisabledByIdServer("user-1");
        expect(result).toBe(true);
    });

    it("gets user by id server correctly", async () => {
        const { getUserByIdServer } = await loadDatabaseActions();
        const createdAt = new Date();
        queueSelectResult([{ id: "user-1", plan: "pro", createdAt }]);
        const result = await getUserByIdServer("user-1");
        expect(result).toEqual({ id: "user-1", plan: "pro", createdAt, entitlements: { effectivePlan: "pro" } });
    });

    it("returns null for non-existent user in getUserByIdServer", async () => {
        const { getUserByIdServer } = await loadDatabaseActions();
        queueSelectResult([]);
        const result = await getUserByIdServer("none");
        expect(result).toBeNull();
    });

    it("handles error in getUserByIdServer", async () => {
        const { getUserByIdServer } = await loadDatabaseActions();
        dbSelect.mockImplementationOnce(() => { throw new Error("db error"); });
        const result = await getUserByIdServer("user-1");
        expect(result).toBeNull();
    });

    it("sets access token correctly", async () => {
        const { setAccessToken } = await loadDatabaseActions();
        twitch.getUserDetails.mockResolvedValue({ id: "user-1", login: "user1" });
        
        const result = await setAccessToken({
            access_token: "at",
            refresh_token: "rt",
            expires_in: 3600,
            scope: ["user:read:email"],
            token_type: "bearer"
        });

        expect(result).toBeDefined();
        expect(dbInsert).toHaveBeenCalled();
        expect(insertCalls.some(c => c.accessToken === "at" && c.refreshToken === "rt")).toBe(true);
    });

    it("handles failure to get user details in setAccessToken", async () => {
        const { setAccessToken } = await loadDatabaseActions();
        twitch.getUserDetails.mockResolvedValue(null);
        await expect(setAccessToken({} as any)).rejects.toThrow("Failed to set access token");
    });

    it("getAccessTokenResult returns user_disabled when user is disabled", async () => {
        const { getAccessTokenResult } = await loadDatabaseActions();
        queueSelectResult([{ disabled: true }]);
        const result = await getAccessTokenResult("user-1");
        expect(result).toEqual({ token: null, reason: "user_disabled" });
    });

    it("getAccessTokenResult returns token_row_missing when no token in DB", async () => {
        const { getAccessTokenResult } = await loadDatabaseActions();
        queueSelectResult([{ disabled: false }]); // userRow
        queueSelectResult([]); // token rows
        const result = await getAccessTokenResult("user-1");
        expect(result).toEqual({ token: null, reason: "token_row_missing" });
    });

    it("getAccessTokenResult returns token_decrypt_failed when decryption fails", async () => {
        const { getAccessTokenResult } = await loadDatabaseActions();
        queueSelectResult([{ disabled: false }]);
        queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 10000) }]);
        tokenCrypto.decryptToken.mockImplementation(() => { throw new Error("decrypt error"); });
        
        const result = await getAccessTokenResult("user-1");
        expect(result).toEqual({ token: null, reason: "token_decrypt_failed" });
    });

    it("getAccessTokenResult refreshes token when expired", async () => {
        const { getAccessTokenResult } = await loadDatabaseActions();
        const now = Date.now();
        queueSelectResult([{ disabled: false }]);
        queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(now - 1000), scope: [], tokenType: "bearer" }]);
        
        twitch.refreshAccessTokenWithContext.mockResolvedValue({
            token: { access_token: "new-at", refresh_token: "new-rt", expires_in: 3600, scope: [], token_type: "bearer" }
        });
        twitch.getUserDetails.mockResolvedValue({ id: "user-1", login: "user1" }); // for setAccessToken

        const result = await getAccessTokenResult("user-1");
        expect(result.token?.accessToken).toBe("new-at");
        expect(twitch.refreshAccessTokenWithContext).toHaveBeenCalledWith("rt", "user-1");
    });

    it("getAccessTokenResult handles refresh failure", async () => {
        const { getAccessTokenResult } = await loadDatabaseActions();
        queueSelectResult([{ disabled: false }]);
        queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() - 1000) }]);
        
        twitch.refreshAccessTokenWithContext.mockResolvedValue({ token: null });

        const result = await getAccessTokenResult("user-1");
        expect(result).toEqual({ token: null, reason: "refresh_failed" });
    });

    it("getAccessTokenResult handles invalid refresh token and disables user", async () => {
        const { getAccessTokenResult } = await loadDatabaseActions();
        queueSelectResult([{ disabled: false }]);
        queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() - 1000) }]);
        
        twitch.refreshAccessTokenWithContext.mockResolvedValue({ token: null, invalidRefreshToken: true });

        const result = await getAccessTokenResult("user-1");
        expect(result).toEqual({ token: null, reason: "refresh_invalid_token" });
        expect(dbUpdate).toHaveBeenCalled(); // disableUserAccess
    });

    it("inserts new user correctly", async () => {
        const { insertUser } = await loadDatabaseActions();
        queueSelectResult([]); // existing select (none)
        
        const user = makeTwitchUser();
        const result = await insertUser(user);
        expect(result).toBeDefined();
        expect(insertCalls.length).toBeGreaterThan(0);
    });

    it("inserts existing user and re-enables if automatic", async () => {
        const { insertUser } = await loadDatabaseActions();
        queueSelectResult([{ id: "u-1", disabled: true, disableType: "automatic" }]); // existing select
        
        const user = makeTwitchUser();
        await insertUser(user);
        expect(updateCalls.some(u => u.disabled === false)).toBe(true);
    });

    it("inserts existing user and does NOT re-enable if manual", async () => {
        const { insertUser } = await loadDatabaseActions();
        queueSelectResult([{ id: "u-1", disabled: true, disableType: "manual" }]); // existing select
        
        const user = makeTwitchUser();
        await insertUser(user);
        expect(updateCalls.some(u => u.disabled === false)).toBe(false);
    });

    it("getUserPlan returns null if unauthorized", async () => {
        const { getUserPlan } = await loadDatabaseActions();
        validateAuth.mockResolvedValue({ id: "other" });
        const result = await getUserPlan("user-1");
        expect(result).toBeNull();
    });

    it("getUserPlan returns plan if authorized", async () => {
        const { getUserPlan } = await loadDatabaseActions();
        validateAuth.mockResolvedValue({ id: "user-1" });
        queueSelectResult([{ plan: "pro" }]);
        const result = await getUserPlan("user-1");
        expect(result).toBe("pro");
    });

    it("getUserPlanById returns plan if authorized", async () => {
        const { getUserPlanById } = await loadDatabaseActions();
        validateAuth.mockResolvedValue({ id: "user-1" });
        queueSelectResult([{ plan: "pro" }]);
        const result = await getUserPlanById("user-1");
        expect(result).toBe("pro");
    });

    describe("user error cases", () => {
        it("handles error in insertUser", async () => {
            const { insertUser } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(insertUser({ id: "1" } as any)).rejects.toThrow("Failed to insert user");
        });

        it("handles error in getUser", async () => {
            const { getUser } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getUser("user-1")).rejects.toThrow("Failed to fetch user");
        });

        it("handles error in getUserPlanByIdInternal", async () => {
            const { getUserPlanByIdServer } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getUserPlanByIdServer("user-1")).rejects.toThrow("Failed to fetch user plan");
        });

        it("handles error in deleteUser", async () => {
            const { deleteUser } = await loadDatabaseActions();
            dbDelete.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(deleteUser("user-1")).rejects.toThrow("Failed to delete user");
        });

        it("handles error in updateUserSubscription", async () => {
            const { updateUserSubscription } = await loadDatabaseActions();
            dbUpdate.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(updateUserSubscription("user-1", "cus-1", "pro" as any)).rejects.toThrow("Failed to update user subscription");
        });

        it("handles error in getUserByCustomerId", async () => {
            const { getUserByCustomerId } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            const result = await getUserByCustomerId("cus-1");
            expect(result).toBeNull();
        });
    });

    it("disableUserAccess and enableUserAccess", async () => {
		const { validateAdminAuth } = require("@actions/auth");
		validateAdminAuth.mockResolvedValueOnce({ id: "admin-1", role: "admin" });

        const { disableUserAccess, enableUserAccess } = await loadDatabaseActions();
        await disableUserAccess("user-1", "reason", "automatic");
        expect(updateCalls.some(u => u.disabled === true && u.disabledReason === "reason")).toBe(true);
        updateCalls.length = 0;
        await enableUserAccess("user-1");
        expect(updateCalls.some(u => u.disabled === false)).toBe(true);
    });
});
