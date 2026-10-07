jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: async () => ({ kind: "session", authUserId: "auth-user-1", sessionId: "session-1", authenticatedAt: new Date() }) }));
/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbDelete = jest.fn();
const deleteBrowserOverlay = jest.fn();
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
const createBrowserOverlay = jest.fn();
const createBrowserOverlayWithFeedback = jest.fn();
const saveBrowserOverlay = jest.fn();
jest.mock("@/server/resources/browser-overlays", () => ({ createBrowserOverlayWithFeedback: (...args: unknown[]) => createBrowserOverlayWithFeedback(...args), saveBrowserOverlay: (...args: unknown[]) => saveBrowserOverlay(...args), deleteBrowserOverlay: (...args: unknown[]) => deleteBrowserOverlay(...args), createBrowserOverlay: (...args: unknown[]) => createBrowserOverlay(...args) }));
jest.mock("@actions/auth", () => ({
	validateAuth: (...args: any[]) => validateAuth(...args),
}));

const authorizeCreatorOperation = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({
	authorizeCreatorOperation: (...args: unknown[]) => authorizeCreatorOperation(...args),
	authorizeTrustedCreatorOperation: ({ principal: _principal, client: _client, ...input }: Record<string, unknown>) => authorizeCreatorOperation(input),
	listAuthorizedCreatorOperations: jest.fn(),
}));

jest.mock("@lib/entitlements", () => ({
	resolveUserEntitlements: jest.fn(async (user: any) => ({ effectivePlan: user.plan || "free" })),
	resolveUserEntitlementsForUsers: jest.fn(async (users: any[]) => {
		const map = new Map();
		users.forEach((u: any) => map.set(u.id, { effectivePlan: u.plan || "free" }));
		return map;
	}),
	reconcileUserEntitlements: jest.fn(async () => ({ runners: 0, sessions: 0 })),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: jest.fn(() => ({ allowed: true })),
}));
jest.mock("@/server/entitlements/resource-access", () => ({ resolveRetainedResourceAccess: jest.fn(async () => ({ read: true, delete: true, update: true, runtime: true, withinFreeAllowance: true })) }));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database overlay logic", () => {
	beforeEach(() => {
		createBrowserOverlay.mockReset().mockResolvedValue(null);
		saveBrowserOverlay.mockReset().mockResolvedValue(null);
		jest.clearAllMocks();
		selectQueue.length = 0;
		deleteCalls.length = 0;
		updateSetCalls.length = 0;
		dbSelect.mockReset().mockImplementation(() => makeSelectChain());
		dbDelete.mockImplementation((table: unknown) => makeDeleteChain(table));
		validateAuth.mockResolvedValue({ id: "user-1" });
		authorizeCreatorOperation.mockResolvedValue({ allowed: true, accessPath: "owner", creator: { id: "user-1", plan: "pro" }, creatorOrganizationId: "creator:user-1", authUserId: "auth-user-1", sessionId: "session-1" });
	});

	it("TDD-BROWSER-OVERLAY-DELETE-002 public action forwards cached revision without direct DB deletion", async () => {
		const { deleteOverlay } = await loadDatabaseActions();
		deleteBrowserOverlay.mockResolvedValueOnce(true);
		expect(await deleteOverlay("overlay-1", 4)).toBe(true);
		expect(deleteBrowserOverlay).toHaveBeenCalledWith("overlay-1", 4);
		expect(dbDelete).not.toHaveBeenCalled();
	});
	it("TDD-BROWSER-OVERLAY-DELETE-002 rejected shared deletion stays false", async () => {
		const { deleteOverlay } = await loadDatabaseActions();
		deleteBrowserOverlay.mockResolvedValueOnce(false);
		expect(await deleteOverlay("overlay-1", 4)).toBe(false);
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
		const overlay = { id: "overlay-new", ownerId: "user-1", configurationRevision: 1 };
		createBrowserOverlay.mockResolvedValueOnce(overlay);
		const { createOverlay } = await loadDatabaseActions();
		expect(await createOverlay("user-1")).toBe(overlay);
		expect(createBrowserOverlay).toHaveBeenCalledWith("user-1");
	});
	it("structured overlay creation action forwards authoritative usage and limit unchanged", async () => {
		const feedback = { overlay: null, error: { code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 } };
		createBrowserOverlayWithFeedback.mockResolvedValueOnce(feedback);
		const { createOverlayWithFeedback } = await loadDatabaseActions();
		expect(await createOverlayWithFeedback("user-1")).toBe(feedback);
		expect(createBrowserOverlayWithFeedback).toHaveBeenCalledWith("user-1");
	});

	it("fails to create overlay if not owner and not editor", async () => {
		const { createOverlay } = await loadDatabaseActions();
		expect(await createOverlay("user-1")).toBeNull();
		expect(createBrowserOverlay).toHaveBeenCalledWith("user-1");
	});
	it("fails to create overlay if free limit reached", async () => {
		const { createOverlay } = await loadDatabaseActions();
		expect(await createOverlay("user-1")).toBeNull();
		expect(createBrowserOverlay).toHaveBeenCalledWith("user-1");
	});

	it("TDD-BROWSER-OVERLAY-SAVE-002 public save delegates revision without a direct write", async () => {
		const { saveOverlay } = await loadDatabaseActions();
		const result = { id: "overlay-1", configurationRevision: 5 };
		saveBrowserOverlay.mockResolvedValueOnce(result);
		expect(await (saveOverlay as any)("overlay-1", { name: "Saved" }, 4)).toBe(result);
		expect(saveBrowserOverlay).toHaveBeenCalledWith("overlay-1", { name: "Saved" }, 4);
		expect(updateSetCalls).toEqual([]);
	});
	it("saves overlay using the committed adapter response", async () => {
		const { saveOverlay } = await loadDatabaseActions();
		const committed = { id: "overlay-1", name: "Updated", ownerId: "user-1", configurationRevision: 2 };
		saveBrowserOverlay.mockResolvedValueOnce(committed);
		expect(await saveOverlay("overlay-1", { name: "Updated" }, 1)).toBe(committed);
		expect(updateSetCalls).toEqual([]);
	});
	it("normalizes order playback mode in the shared configuration helper", async () => {
		const { buildOverlayUpdatePayload } = await import("@/server/resources/overlay-configuration");
		const result = buildOverlayUpdatePayload({ type: "All", playbackMode: "order" } as any, true);
		expect(result).toHaveProperty("playbackMode", "random");
	});

	it("reconciles a downgraded user without deleting or resetting resources", async () => {
		const { downgradeUserPlan } = await loadDatabaseActions();

		await downgradeUserPlan("user-1");
		const { reconcileUserEntitlements } = jest.requireMock("@lib/entitlements");
		expect(reconcileUserEntitlements).toHaveBeenCalledWith("user-1");
		expect(deleteCalls).toHaveLength(0);
		expect(updateSetCalls).toHaveLength(0);
	});

	describe("error cases", () => {
		it("handles error in createOverlay", async () => {
			createBrowserOverlay.mockRejectedValueOnce(new Error("Failed to create overlay"));
			const { createOverlay } = await loadDatabaseActions();
			await expect(createOverlay("user-1")).rejects.toThrow("Failed to create overlay");
		});

		it("handles shared save rejection without a direct fallback write", async () => {
			const { saveOverlay } = await loadDatabaseActions();
			saveBrowserOverlay.mockResolvedValueOnce(null);
			expect(await saveOverlay("overlay-1", { name: "X" }, 1)).toBeNull();
			expect(updateSetCalls).toEqual([]);
		});

		it("handles missing-revision deletion safely at shared boundary", async () => {
			const { deleteOverlay } = await loadDatabaseActions();
			deleteBrowserOverlay.mockResolvedValueOnce(false);
			expect(await deleteOverlay("overlay-1")).toBe(false);
			expect(deleteBrowserOverlay).toHaveBeenCalledWith("overlay-1", undefined);
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

describe("pause clears connected overlay presence", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		saveBrowserOverlay.mockReset().mockResolvedValue(null);
		selectQueue.length = 0;
		updateSetCalls.length = 0;
		dbSelect.mockReset().mockImplementation(() => makeSelectChain());
		authorizeCreatorOperation.mockImplementation(async (input: { creatorId: string }) => ({ allowed: true, creator: { id: input.creatorId, plan: "pro" } }));
	});

	afterEach(async () => {
		const { ownerSubscribers, overlaySubscribers } = await import("@store/overlaySubscribers");
		ownerSubscribers.clear();
		overlaySubscribers.clear();
	});

	it("removes already-active source connections after saving a pause", async () => {
		const { saveOverlay } = await loadDatabaseActions();
		const { addSubscriber, getActiveOverlayOwnerIds, ownerSubscribers, overlaySubscribers } = await import("@store/overlaySubscribers");
		ownerSubscribers.clear();
		overlaySubscribers.clear();
		const source = { ownerId: "user-1", overlayId: "overlay-1", role: "overlay", readyState: 1, sourceActive: true, close: jest.fn() };
		addSubscriber("user-1", "overlay-1", source as never);
		expect(getActiveOverlayOwnerIds()).toEqual(new Set(["user-1"]));
		saveBrowserOverlay.mockResolvedValueOnce({ id: "overlay-1", ownerId: "user-1", status: "paused", configurationRevision: 2 });
		await saveOverlay("overlay-1", { status: "paused" as never }, 1);
		expect(source.close).toHaveBeenCalledWith(4002);
		expect(source.sourceActive).toBe(false);
		expect(getActiveOverlayOwnerIds()).toEqual(new Set());
		expect(overlaySubscribers.has("overlay-1")).toBe(false);
		ownerSubscribers.clear();
		overlaySubscribers.clear();
	});
	it.each([false, true])("keeps current presence if a pause is not saved (failed write: %s)", async (failedWrite) => {
		const { saveOverlay } = await loadDatabaseActions();
		const { addSubscriber, getActiveOverlayOwnerIds, ownerSubscribers, overlaySubscribers } = await import("@store/overlaySubscribers");
		ownerSubscribers.clear();
		overlaySubscribers.clear();
		const source = { ownerId: "user-1", overlayId: "overlay-1", role: "overlay", readyState: 1, sourceActive: true, close: jest.fn() };
		addSubscriber("user-1", "overlay-1", source as never);
		if (failedWrite) {
			saveBrowserOverlay.mockResolvedValueOnce(null);
			expect(await saveOverlay("overlay-1", { status: "paused" as never }, 1)).toBeNull();
		} else {
			saveBrowserOverlay.mockResolvedValueOnce({ id: "overlay-1", ownerId: "user-1", status: "active", configurationRevision: 2 });
			await saveOverlay("overlay-1", { name: "Updated" }, 1);
		}
		expect(source.close).not.toHaveBeenCalled();
		expect(source.sourceActive).toBe(true);
		expect(getActiveOverlayOwnerIds()).toEqual(new Set(["user-1"]));
	});
});
