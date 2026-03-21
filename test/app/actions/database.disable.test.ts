/** @jest-environment node */
export {};

const dbSelect = jest.fn();
const dbUpdate = jest.fn();
const dbInsert = jest.fn();
const refreshAccessTokenWithContext = jest.fn();
const getUserDetails = jest.fn();
const decryptToken = jest.fn();
const eq = jest.fn();
const and = jest.fn();

const usersTable = {
	id: "users.id",
	disabled: "users.disabled",
	disableType: "users.disable_type",
	disabledReason: "users.disabled_reason",
};

const tokenTable = {
	id: "tokens.id",
};

const overlaysTable = {
	id: "overlays.id",
	ownerId: "overlays.owner_id",
	lastUsedAt: "overlays.last_used_at",
	createdAt: "overlays.created_at",
	status: "overlays.status",
};

jest.mock("@/db/client", () => ({
	db: {
		select: (...args: unknown[]) => dbSelect(...args),
		update: (...args: unknown[]) => dbUpdate(...args),
		insert: (...args: unknown[]) => dbInsert(...args),
	},
}));

jest.mock("@/db/schema", () => ({
	usersTable,
	tokenTable,
	overlaysTable,
	queueTable: {},
	settingsTable: {},
	modQueueTable: {},
	editorsTable: {},
	twitchCacheTable: {
		expiresAt: "twitch_cache.expires_at",
	},
}));

jest.mock("@actions/twitch", () => ({
	getUserDetails: (...args: unknown[]) => getUserDetails(...args),
	getUsersDetailsBulk: jest.fn(),
	refreshAccessTokenWithContext: (...args: unknown[]) => refreshAccessTokenWithContext(...args),
	subscribeToReward: jest.fn(),
}));

const validateAuth = jest.fn();
const validateAdminAuth = jest.fn();
jest.mock("@actions/auth", () => ({
	validateAuth,
	validateAdminAuth,
}));

jest.mock("@lib/tokenCrypto", () => ({
	encryptToken: jest.fn((value: string) => value),
	decryptToken: (...args: unknown[]) => decryptToken(...args),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: jest.fn(() => ({ allowed: true })),
}));

jest.mock("@lib/entitlements", () => ({
	ensureReverseTrialGrantForUser: jest.fn(),
	resolveUserEntitlements: jest.fn(),
	resolveUserEntitlementsForUsers: jest.fn(),
}));

jest.mock("drizzle-orm", () => ({
	eq: (...args: unknown[]) => eq(...args),
	inArray: jest.fn(),
	and: (...args: unknown[]) => and(...args),
	or: jest.fn(),
	isNull: jest.fn(),
	lt: jest.fn(),
	gt: jest.fn(),
	sql: Object.assign(jest.fn((strings: TemplateStringsArray) => strings.join("")), {
		join: jest.fn((parts: unknown[], separator = " ") => parts.join(String(separator))),
		raw: jest.fn((value: unknown) => String(value)),
	}),
	desc: jest.fn((value: unknown) => ({ desc: value })),
	count: jest.fn(),
	countDistinct: jest.fn(),
	max: jest.fn(),
}));

const selectQueue: unknown[] = [];
const updateCalls: Array<{ table: unknown; set: Record<string, unknown> | null; where: unknown }> = [];

function queueSelectResult(result: unknown) {
	selectQueue.push(result);
}

function mockSelectChain() {
	const chain: {
		from: (table: unknown) => typeof chain;
		innerJoin: (table: unknown, condition: unknown) => typeof chain;
		where: (condition: unknown) => typeof chain;
		groupBy: (value: unknown) => typeof chain;
		orderBy: (value: unknown) => typeof chain;
		limit: (value: number) => typeof chain;
		execute: () => Promise<unknown>;
	} = {
		from: () => chain,
		innerJoin: () => chain,
		where: () => chain,
		groupBy: () => chain,
		orderBy: () => chain,
		limit: () => chain,
		execute: async () => (selectQueue.length > 0 ? selectQueue.shift() : []),
	};
	return chain;
}

function mockUpdateChain(table: unknown) {
	const call = { table, set: null as Record<string, unknown> | null, where: null as unknown };
	updateCalls.push(call);
	return {
		set: (values: Record<string, unknown>) => {
			call.set = values;
			return {
				where: (condition: unknown) => {
					call.where = condition;
					return {
						execute: async () => [],
					};
				},
			};
		},
	};
}

function mockInsertChain(table: unknown) {
	if (table === usersTable) {
		return {
			values: () => ({
				onConflictDoUpdate: () => ({
					returning: () => ({
						execute: async () => [
							{
								id: "owner-1",
								username: "owner",
								email: "owner@example.com",
								avatar: "https://avatar",
								role: "user",
								plan: "free",
							},
						],
					}),
				}),
			}),
		};
	}
	return {
		values: () => ({
			onConflictDoUpdate: () => ({
				execute: async () => undefined,
			}),
		}),
	};
}

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database disabled user handling", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
		updateCalls.length = 0;
		dbSelect.mockImplementation(() => mockSelectChain());
		dbUpdate.mockImplementation((table: unknown) => mockUpdateChain(table));
		dbInsert.mockImplementation((table: unknown) => mockInsertChain(table));
		decryptToken.mockImplementation((value: string) => value);
		validateAuth.mockResolvedValue({ id: "owner-1" });
		getUserDetails.mockResolvedValue({
			id: "owner-1",
			login: "owner",
			email: "owner@example.com",
			profile_image_url: "https://avatar",
		});
	});

	it("disables user and pauses overlays when refresh token is invalid", async () => {
		queueSelectResult([{ disabled: false }]);
		queueSelectResult([
			{
				accessToken: "enc-access",
				refreshToken: "enc-refresh",
				expiresAt: new Date(Date.now() - 60_000),
				scope: [],
				tokenType: "bearer",
			},
		]);
		refreshAccessTokenWithContext.mockResolvedValue({
			token: null,
			invalidRefreshToken: true,
			status: 400,
			message: "Invalid refresh token",
		});

		const { getAccessToken } = await loadDatabaseActions();
		await expect(getAccessToken("owner-1")).resolves.toBeNull();

		expect(refreshAccessTokenWithContext).toHaveBeenCalledWith("enc-refresh", "owner-1");
		expect(updateCalls).toHaveLength(2);
		expect(updateCalls[0]?.table).toBe(usersTable);
		expect(updateCalls[0]?.set).toEqual(
			expect.objectContaining({
				disabled: true,
				disableType: "automatic",
				disabledReason: "invalid_refresh_token",
			}),
		);
		expect(updateCalls[1]?.table).toBe(overlaysTable);
		expect(updateCalls[1]?.set).toEqual(
			expect.objectContaining({
				status: "paused",
			}),
		);
	});

	it("does not disable user for non-invalid refresh failures", async () => {
		queueSelectResult([{ disabled: false }]);
		queueSelectResult([
			{
				accessToken: "enc-access",
				refreshToken: "enc-refresh",
				expiresAt: new Date(Date.now() - 60_000),
				scope: [],
				tokenType: "bearer",
			},
		]);
		refreshAccessTokenWithContext.mockResolvedValue({
			token: null,
			invalidRefreshToken: false,
			status: 503,
			message: "Service unavailable",
		});

		const { getAccessToken } = await loadDatabaseActions();
		await expect(getAccessToken("owner-1")).resolves.toBeNull();
		expect(updateCalls).toHaveLength(0);
	});

	it("returns null immediately for disabled users without refreshing tokens", async () => {
		queueSelectResult([{ disabled: true }]);

		const { getAccessToken } = await loadDatabaseActions();
		await expect(getAccessToken("owner-1")).resolves.toBeNull();
		expect(refreshAccessTokenWithContext).not.toHaveBeenCalled();
	});

	it("filters clip sync owners to enabled accounts only", async () => {
		queueSelectResult([{ ownerId: "owner-1" }]);

		const { getActiveOverlayOwnerIdsForClipSync } = await loadDatabaseActions();
		await expect(getActiveOverlayOwnerIdsForClipSync(25)).resolves.toEqual(["owner-1"]);
		expect(eq).toHaveBeenCalledWith(usersTable.disabled, false);
		expect(and).toHaveBeenCalled();
	});

	it("marks public overlays as disabled when owner account is disabled", async () => {
		queueSelectResult([
			{
				id: "overlay-1",
				ownerId: "owner-1",
				status: "active",
				secret: "secret",
				rewardId: "reward",
			},
		]);
		queueSelectResult([{ disabled: true, disabledReason: "invalid_refresh_token" }]);

		const { getOverlayPublic } = await loadDatabaseActions();
		await expect(getOverlayPublic("overlay-1")).resolves.toEqual(
			expect.objectContaining({
				ownerDisabled: true,
				ownerDisabledReason: "invalid_refresh_token",
				secret: "",
				rewardId: null,
			}),
		);
	});

	it("returns normal public overlay when owner is enabled", async () => {
		queueSelectResult([
			{
				id: "overlay-2",
				ownerId: "owner-2",
				status: "active",
				secret: "secret",
				rewardId: "reward",
			},
		]);
		queueSelectResult([{ disabled: false, disabledReason: null }]);

		const { getOverlayPublic } = await loadDatabaseActions();
		await expect(getOverlayPublic("overlay-2")).resolves.toEqual(
			expect.objectContaining({
				id: "overlay-2",
				secret: "",
				rewardId: null,
			}),
		);
	});

	it("automatically unlocks automatic-disabled users after successful reauth", async () => {
		queueSelectResult([{ id: "owner-1", disabled: true, disableType: "automatic" }]);

		const { setAccessToken } = await loadDatabaseActions();
		await setAccessToken({
			access_token: "new-access",
			refresh_token: "new-refresh",
			expires_in: 3600,
			scope: [],
			token_type: "bearer",
		});

		expect(updateCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					table: usersTable,
					set: expect.objectContaining({
						disabled: false,
						disableType: null,
						disabledReason: null,
					}),
				}),
			]),
		);
	});

	it("keeps manual-disabled users locked after successful reauth", async () => {
		queueSelectResult([{ id: "owner-1", disabled: true, disableType: "manual" }]);

		const { setAccessToken } = await loadDatabaseActions();
		await setAccessToken({
			access_token: "new-access",
			refresh_token: "new-refresh",
			expires_in: 3600,
			scope: [],
			token_type: "bearer",
		});

		expect(updateCalls).toHaveLength(0);
	});

	it("automatically unlocks legacy-disabled users with null disableType after successful reauth", async () => {
		queueSelectResult([{ id: "owner-1", disabled: true, disableType: null }]);

		const { setAccessToken } = await loadDatabaseActions();
		await setAccessToken({
			access_token: "new-access",
			refresh_token: "new-refresh",
			expires_in: 3600,
			scope: [],
			token_type: "bearer",
		});

		expect(updateCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					table: usersTable,
					set: expect.objectContaining({
						disabled: false,
						disableType: null,
						disabledReason: null,
					}),
				}),
			]),
		);
	});
});
