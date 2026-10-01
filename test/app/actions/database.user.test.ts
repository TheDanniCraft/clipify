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
const allocateMemberNumber = jest.fn(async () => 101);
const getAccessTokenResultInternal = jest.fn();
const getAccessTokenInternal = jest.fn();
jest.mock("@/server/memberNumbers", () => ({ allocateMemberNumber: () => allocateMemberNumber() }));
jest.mock("@/server/tokens", () => ({
	getAccessTokenResultInternal: (...args: unknown[]) => getAccessTokenResultInternal(...args),
	getAccessTokenInternal: (...args: unknown[]) => getAccessTokenInternal(...args),
}));

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
	memberNumber: "users.member_number",
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
}));

jest.mock("drizzle-orm", () => ({
	relations: jest.fn(() => ({})),
	eq: jest.fn(() => "eq"),
	and: jest.fn(() => "and"),
	inArray: jest.fn(() => "inArray"),
	sql: Object.assign(
		jest.fn(() => "sql"),
		{
			join: jest.fn((parts: unknown[], separator = " ") => parts.join(String(separator))),
			raw: jest.fn((value: unknown) => String(value)),
		},
	),
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
	subscribeToReward: jest.fn(),
	syncOwnerClipCache: jest.fn(),
};
jest.mock("@actions/twitch", () => twitch);

const twitchAuth = {
	refreshAccessTokenWithContextInternal: jest.fn(),
};
jest.mock("@/server/twitch-auth", () => twitchAuth);

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
		dbSelect.mockImplementationOnce(() => {
			throw new Error("db error");
		});
		const result = await getUserByIdServer("user-1");
		expect(result).toBeNull();
	});

	it("delegates token resolution to the Better Auth-backed server boundary", async () => {
		const { getAccessTokenResult } = await loadDatabaseActions();
		getAccessTokenResultInternal.mockResolvedValue({ token: null, reason: "user_disabled" });
		const result = await getAccessTokenResult("user-1");
		expect(result).toEqual({ token: null, reason: "user_disabled" });
		expect(getAccessTokenResultInternal).toHaveBeenCalledWith("user-1");
	});

	it("preserves a successful Better Auth token result", async () => {
		const { getAccessTokenResult } = await loadDatabaseActions();
		getAccessTokenResultInternal.mockResolvedValue({ token: { id: "user-1", accessToken: "better-auth-token" } });
		const result = await getAccessTokenResult("user-1");
		expect(result.token?.accessToken).toBe("better-auth-token");
	});

	it("inserts new user correctly", async () => {
		const { insertUser } = await loadDatabaseActions();
		queueSelectResult([]); // existing select (none)

		const user = makeTwitchUser();
		const result = await insertUser(user);
		expect(result).toBeDefined();
		expect(insertCalls.length).toBeGreaterThan(0);
		expect(insertCalls[0].memberNumber).toBe(101);
		expect(allocateMemberNumber).toHaveBeenCalledTimes(1);
	});

	it("inserts existing user and re-enables if automatic", async () => {
		const { insertUser } = await loadDatabaseActions();
		queueSelectResult([{ id: "u-1", disabled: true, disableType: "automatic", memberNumber: 42 }]); // existing select

		const user = makeTwitchUser();
		await insertUser(user);
		expect(updateCalls.some((u) => u.disabled === false)).toBe(true);
		expect(insertCalls[0].memberNumber).toBe(42);
		expect(allocateMemberNumber).not.toHaveBeenCalled();
	});

	it.each([null, 0])("preserves legacy member number %s on login without allocating", async (memberNumber) => {
		const { insertUser } = await loadDatabaseActions();
		queueSelectResult([{ id: "u-1", memberNumber }]);
		await insertUser(makeTwitchUser());
		expect(insertCalls[0].memberNumber).toBe(memberNumber);
		expect(allocateMemberNumber).not.toHaveBeenCalled();
	});

	it("inserts existing user and does NOT re-enable if manual", async () => {
		const { insertUser } = await loadDatabaseActions();
		queueSelectResult([{ id: "u-1", disabled: true, disableType: "manual" }]); // existing select

		const user = makeTwitchUser();
		await insertUser(user);
		expect(updateCalls.some((u) => u.disabled === false)).toBe(false);
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
			dbSelect.mockImplementationOnce(() => {
				throw new Error("DB Error");
			});
			await expect(insertUser({ id: "1" } as any)).rejects.toThrow("Failed to insert user");
		});

		it("handles error in getUser", async () => {
			const { getUser } = await loadDatabaseActions();
			dbSelect.mockImplementationOnce(() => {
				throw new Error("DB Error");
			});
			await expect(getUser("user-1")).rejects.toThrow("Failed to fetch user");
		});

		it("handles error in getUserPlanByIdInternal", async () => {
			const { getUserPlanByIdServer } = await loadDatabaseActions();
			dbSelect.mockImplementationOnce(() => {
				throw new Error("DB Error");
			});
			await expect(getUserPlanByIdServer("user-1")).rejects.toThrow("Failed to fetch user plan");
		});

		it("handles error in deleteUser", async () => {
			const { deleteUser } = await loadDatabaseActions();
			dbDelete.mockImplementationOnce(() => {
				throw new Error("DB Error");
			});
			await expect(deleteUser("user-1")).rejects.toThrow("Failed to delete user");
		});

		it("handles error in getUserByCustomerId", async () => {
			const { getUserByCustomerId } = await loadDatabaseActions();
			dbSelect.mockImplementationOnce(() => {
				throw new Error("DB Error");
			});
			const result = await getUserByCustomerId("cus-1");
			expect(result).toBeNull();
		});
	});

	it("disableUserAccess and enableUserAccess", async () => {
		const { validateAdminAuth } = require("@actions/auth");
		validateAdminAuth.mockResolvedValueOnce({ id: "admin-1", role: "admin" });

		const { disableUserAccess, enableUserAccess } = await loadDatabaseActions();
		await disableUserAccess("user-1", "reason", "automatic");
		expect(updateCalls.some((u) => u.disabled === true && u.disabledReason === "reason")).toBe(true);
		updateCalls.length = 0;
		await enableUserAccess("user-1");
		expect(updateCalls.some((u) => u.disabled === false)).toBe(true);
	});
});
