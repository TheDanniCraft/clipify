/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbDelete = jest.fn();
const updateSetCalls: Array<Record<string, unknown>> = [];

const deleteCalls: Array<{ table: unknown }> = [];

const overlaysTable = {
	id: "overlays.id",
	ownerId: "overlays.owner_id",
	secret: "overlays.secret",
	status: "overlays.status",
	updatedAt: "overlays.updated_at",
	rewardId: "overlays.reward_id",
};
const usersTable = {
	id: "users.id",
	disabled: "users.disabled",
	plan: "users.plan",
	createdAt: "users.created_at",
};
const creatorAccountsTable = {
	creatorId: "creator_accounts.creator_id",
	status: "creator_accounts.status",
};

function queueSelectResult(value: unknown) {
	selectQueue.push(value);
}

function makeSelectChain() {
	const chain: Record<string, unknown> = {};
	chain.from = () => chain;
	chain.where = () => chain;
	chain.limit = () => chain;
	chain.innerJoin = () => chain;
	chain.groupBy = () => chain;
	chain.orderBy = () => chain;
	chain.execute = async () => (selectQueue.length > 0 ? selectQueue.shift() : []);
	return chain;
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

jest.mock("@/db/client", () => ({
	db: {
		select: (..._args: unknown[]) => dbSelect(..._args),
		insert: jest.fn(() => ({
			values: () => ({
				returning: () => ({ execute: async () => [{ id: "new-id" }] }),
				onConflictDoUpdate: () => ({ returning: () => ({ execute: async () => [{ id: "new-id" }] }) }),
				onConflictDoNothing: () => ({ execute: async () => [] }),
			}),
		})),
		update: jest.fn(() => ({
			set: (payload: Record<string, unknown>) => {
				updateSetCalls.push(payload);
				return {
					where: () => ({
						execute: async () => [],
						returning: () => ({ execute: async () => [] }),
					}),
					execute: async () => [],
				};
			},
		})),
		delete: (..._args: unknown[]) => dbDelete(..._args),
		execute: jest.fn(),
		transaction: jest.fn((cb) =>
			cb({
				select: (..._args: unknown[]) => dbSelect(..._args),
				insert: jest.fn(() => ({
					values: () => ({
						returning: () => ({ execute: async () => [{ id: "new-id" }] }),
						execute: async () => [],
					}),
				})),
				update: jest.fn(() => ({
					set: (payload: Record<string, unknown>) => {
						updateSetCalls.push(payload);
						return {
							where: () => ({
								execute: async () => [],
								returning: () => ({ execute: async () => [] }),
							}),
							execute: async () => [],
						};
					},
				})),
				delete: (..._args: unknown[]) => dbDelete(..._args),
				execute: jest.fn(),
			}),
		),
	},
}));

jest.mock("@/db/schema", () => ({
	overlaysTable,
	usersTable,
	creatorAccountsTable,
	playlistsTable: { ownerId: "playlists.owner_id", id: "playlists.id", createdAt: "playlists.created_at" },
	playlistClipsTable: { playlistId: "playlist_clips.playlist_id", clipId: "playlist_clips.clip_id", position: "playlist_clips.position" },
	galleriesTable: { id: "galleries.id", ownerId: "galleries.owner_id", playlistId: "galleries.playlist_id", createdAt: "galleries.created_at" },
	queueTable: {},
	settingsTable: { id: "settings.id" },
	modQueueTable: {},
	twitchCacheTable: {},
}));

jest.mock("drizzle-orm", () => ({
	relations: jest.fn(() => ({})),
	eq: jest.fn(() => "eq"),
	and: jest.fn(() => "and"),
	or: jest.fn(() => "or"),
	isNull: jest.fn(() => "isNull"),
	inArray: jest.fn(() => "inArray"),
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

const validateAuth = jest.fn();
jest.mock("@actions/auth", () => ({
	validateAuth: (...args: any[]) => validateAuth(...args),
}));

const authorizeCreatorOperation = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({
	authorizeCreatorOperation: (...args: unknown[]) => authorizeCreatorOperation(...args),
	listAuthorizedCreatorOperations: jest.fn(),
}));

jest.mock("@lib/entitlements", () => ({
	resolveUserEntitlements: jest.fn(async (user: any) => ({ effectivePlan: user.plan || "free" })),
	resolveUserEntitlementsForUsers: jest.fn(async (users: any[]) => {
		const map = new Map();
		users.forEach((u: any) => map.set(u.id, { effectivePlan: u.plan || "free" }));
		return map;
	}),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: jest.fn(() => ({ allowed: true })),
}));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database overlay logic", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
		deleteCalls.length = 0;
		updateSetCalls.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbDelete.mockImplementation((table: unknown) => makeDeleteChain(table));
		validateAuth.mockResolvedValue({ id: "user-1" });
		authorizeCreatorOperation.mockResolvedValue({ allowed: true, accessPath: "owner", creator: { id: "user-1", plan: "pro" }, creatorOrganizationId: "creator:user-1", authUserId: "auth-user-1", sessionId: "session-1" });
	});

	it("deletes overlay with access", async () => {
		const { deleteOverlay } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1" }]); // requireOverlayAccess select
		const result = await deleteOverlay("overlay-1");
		expect(result).toBe(true);
		expect(deleteCalls.some((call) => call.table === overlaysTable)).toBe(true);
	});

	it("fails to delete overlay without access", async () => {
		const { deleteOverlay } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "other-user" }]); // requireOverlayAccess select
		authorizeCreatorOperation.mockResolvedValueOnce({ allowed: false, code: "PERMISSION_DENIED" });
		const result = await deleteOverlay("overlay-1");
		expect(result).toBe(false);
	});

	it("gets overlay owner plan", async () => {
		const { getOverlayOwnerPlan } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1" }]); // requireOverlayAccess select
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // getUserByIdServer select
		const result = await getOverlayOwnerPlan("overlay-1");
		expect(result).toBe("pro");
	});

	it("gets overlay owner plan public", async () => {
		const { getOverlayOwnerPlanPublic } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1" }]); // overlay select
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner select
		const result = await getOverlayOwnerPlanPublic("overlay-1");
		expect(result).toBe("pro");
	});

	it("gets public overlay info", async () => {
		const { getOverlayPublic } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", secret: "secret" }]);
		queueSelectResult([{ disabled: false }]);
		queueSelectResult([{ status: "active" }]);
		const result = await getOverlayPublic("overlay-1");
		expect(result).toMatchObject({ id: "overlay-1", secret: "" }); // secret should be stripped
	});

	it("gets public overlay info with disabled owner", async () => {
		const { getOverlayPublic } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", secret: "secret" }]);
		queueSelectResult([{ disabled: true, disabledReason: "banned" }]);
		queueSelectResult([{ status: "active" }]);
		const result = await getOverlayPublic("overlay-1");
		expect(result).toMatchObject({ id: "overlay-1", ownerDisabled: true, ownerDisabledReason: "banned" });
	});

	it("gets overlay by secret", async () => {
		const { getOverlayBySecret } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", secret: "secret-1" }]); // overlay select
		queueSelectResult([{ disabled: false }]); // owner select
		queueSelectResult([{ status: "active" }]); // creator account select
		const result = await getOverlayBySecret("overlay-1", "secret-1");
		expect(result).toMatchObject({ id: "overlay-1" });
	});

	it("denies overlay runtime while creator deletion is suspended", async () => {
		const { getOverlayBySecret } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", secret: "secret-1" }]);
		queueSelectResult([{ disabled: false }]);
		queueSelectResult([{ status: "suspended" }]);

		await expect(getOverlayBySecret("overlay-1", "secret-1")).resolves.toBeNull();
	});

	it("gets overlay with access", async () => {
		const { getOverlay } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", secret: "secret-1" }]); // requireOverlayAccess select
		const result = await getOverlay("overlay-1");
		expect(result).toMatchObject({ id: "overlay-1", secret: "secret-1" });
	});

	it("creates overlay", async () => {
		const { createOverlay } = await loadDatabaseActions();
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner select
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // resolveUserEntitlements getUserById select (empty)

		const overlay = await createOverlay("user-1");
		expect(overlay).toBeDefined();
	});

	it("fails to create overlay if not owner and not editor", async () => {
		const { createOverlay } = await loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "user-2" }); // authenticated as user-2
		authorizeCreatorOperation.mockResolvedValueOnce({ allowed: false, code: "PERMISSION_DENIED" });

		const result = await createOverlay("user-1"); // trying to create for user-1
		expect(result).toBeNull();
	});

	it("fails to create overlay if free limit reached", async () => {
		const { createOverlay } = await loadDatabaseActions();
		const { getFeatureAccess } = require("@lib/featureAccess");
		getFeatureAccess.mockReturnValueOnce({ allowed: false }); // multi_overlay not allowed

		queueSelectResult([{ id: "user-1", plan: "free" }]); // owner select
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // resolveUserEntitlements getUserById select (empty)
		queueSelectResult([{ id: "ov-existing" }]); // existing overlays select

		const result = await createOverlay("user-1");
		expect(result).toBeNull();
	});

	it("saves overlay", async () => {
		const { saveOverlay } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1" }]); // requireOverlayAccess select
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner select
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // resolveUserEntitlements getUserById select (empty)

		queueSelectResult([{ id: "overlay-1", ownerId: "user-1" }]); // getOverlay -> requireOverlayAccess select
		queueSelectResult([{ id: "overlay-1", name: "Updated", ownerId: "user-1" }]); // getOverlay return

		const result = await saveOverlay("overlay-1", { name: "Updated" });
		expect(result).toBeDefined();
	});

	it("normalizes order playback mode to random for non-playlist overlays", async () => {
		const { saveOverlay } = await loadDatabaseActions();
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", type: "All", playbackMode: "random" }]); // requireOverlayAccess select
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner select
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // resolveUserEntitlements getUserById select (empty)
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", type: "All", playbackMode: "random" }]); // getOverlay -> requireOverlayAccess select
		queueSelectResult([{ id: "overlay-1", ownerId: "user-1", type: "All", playbackMode: "random" }]); // getOverlay return

		await saveOverlay("overlay-1", { type: "All" as never, playbackMode: "order" as never });

		expect(updateSetCalls.some((payload) => payload.playbackMode === "random")).toBe(true);
	});

	it("downgrades user plan", async () => {
		const { downgradeUserPlan } = await loadDatabaseActions();
		queueSelectResult([{ id: "ov-1" }, { id: "ov-2" }]); // overlays select
		queueSelectResult([{ id: "pl-1" }, { id: "pl-2" }]); // playlists select
		queueSelectResult([]); // galleries select
		queueSelectResult([
			{ id: "clip-1", clipId: "c1" },
			{ id: "clip-2", clipId: "c2" },
		]); // playlist clips select

		await downgradeUserPlan("user-1");
		expect(deleteCalls.length).toBeGreaterThan(0);
		expect(updateSetCalls).toContainEqual(expect.objectContaining({ playlistId: null, published: false }));
		expect(deleteCalls).toContainEqual({ table: expect.objectContaining({ id: "playlists.id" }) });
	});

	describe("error cases", () => {
		it("handles error in createOverlay", async () => {
			const { createOverlay } = await loadDatabaseActions();
			validateAuth.mockRejectedValue(new Error("Auth Error"));
			await expect(createOverlay("user-1")).rejects.toThrow("Failed to create overlay");
		});

		it("handles error in saveOverlay", async () => {
			const { saveOverlay } = await loadDatabaseActions();
			dbSelect.mockImplementationOnce(() => {
				throw new Error("DB Error");
			});
			await expect(saveOverlay("overlay-1", { name: "X" })).rejects.toThrow("Failed to save overlay");
		});

		it("handles error in deleteOverlay", async () => {
			const { deleteOverlay } = await loadDatabaseActions();
			dbSelect.mockImplementationOnce(() => {
				throw new Error("DB Error");
			});
			await expect(deleteOverlay("overlay-1")).rejects.toThrow("Failed to delete overlay");
		});
	});

	it("requireOverlaySecretAccess returns null if overlay not found", async () => {
		// requireOverlaySecretAccess is internal, but we can test it via getOverlayBySecret
		const { getOverlayBySecret } = await loadDatabaseActions();
		queueSelectResult([]); // overlay select returns empty
		const result = await getOverlayBySecret("ov-1", "secret");
		expect(result).toBeNull();
	});

	it("requireOverlaySecretAccess returns null if owner is disabled", async () => {
		const { getOverlayBySecret } = await loadDatabaseActions();
		queueSelectResult([{ id: "ov-1", secret: "secret", ownerId: "user-1" }]); // overlay select
		queueSelectResult([{ disabled: true }]); // owner select
		queueSelectResult([{ status: "active" }]); // creator account select
		const result = await getOverlayBySecret("ov-1", "secret");
		expect(result).toBeNull();
	});
});
