/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const dbDelete = jest.fn();
const dbExecute = jest.fn();

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
	chain.execute = async () => {
		if (selectQueue.length > 0) {
			const next = selectQueue.shift();
			if (next instanceof Error) throw next;
			return next;
		}
		return [];
	};
	return chain;
}

function makeInsertChain() {
	return {
		values: (values: any) => ({
			returning: () => ({
				execute: async () => (Array.isArray(values) ? values : [values]),
			}),
			onConflictDoUpdate: () => ({
				returning: () => ({
					execute: async () => (Array.isArray(values) ? values : [values]),
				}),
				execute: async () => undefined,
			}),
			onConflictDoNothing: () => ({
				execute: async () => [],
			}),
			execute: async () => undefined,
		}),
	};
}

function makeUpdateChain() {
	return {
		set: (set: any) => ({
			where: () => ({
				returning: () => ({
					execute: async () => (selectQueue.length > 0 ? selectQueue.shift() : [set]),
				}),
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
		execute: (..._args: unknown[]) => dbExecute(..._args),
		transaction: jest.fn((cb) =>
			cb({
				select: (..._args: unknown[]) => dbSelect(..._args),
				insert: (..._args: unknown[]) => dbInsert(..._args),
				update: (..._args: unknown[]) => dbUpdate(..._args),
				delete: (..._args: unknown[]) => dbDelete(..._args),
				execute: (..._args: unknown[]) => dbExecute(..._args),
			}),
		),
	},
}));

jest.mock("@/db/schema", () => ({
	usersTable: { id: "users.id", disabled: "users.disabled", plan: "users.plan", createdAt: "users.created_at", stripeCustomerId: "users.stripe_customer_id" },
	overlaysTable: { id: "overlays.id", ownerId: "overlays.owner_id", secret: "overlays.secret", status: "overlays.status", updatedAt: "overlays.updated_at" },
	playlistsTable: { id: "playlists.id", ownerId: "playlists.owner_id", createdAt: "playlists.created_at" },
	playlistClipsTable: { playlistId: "playlist_clips.playlist_id", clipId: "playlist_clips.clip_id", position: "playlist_clips.position" },
	queueTable: { id: "queue.id", overlayId: "queue.overlay_id", queuedAt: "queue.queued_at" },
	settingsTable: { id: "settings.id" },
	modQueueTable: { id: "mod_queue.id", broadcasterId: "mod_queue.broadcaster_id", queuedAt: "mod_queue.queued_at" },
	tokenTable: { id: "token.id" },
	editorsTable: { id: "editors.id", editorId: "editors.editor_id", userId: "editors.user_id" },
	twitchCacheTable: { type: "twitch_cache.type", key: "twitch_cache.key", value: "twitch_cache.value", expiresAt: "twitch_cache.expires_at", fetchedAt: "twitch_cache.fetched_at" },
}));

jest.mock("drizzle-orm", () => ({
	eq: jest.fn(() => "eq"),
	and: jest.fn(() => "and"),
	or: jest.fn(() => "or"),
	isNull: jest.fn(() => "isNull"),
	inArray: jest.fn(() => "inArray"),
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
	asc: jest.fn(() => "asc"),
	max: jest.fn(() => "max"),
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

const newsletter = {
	syncProductUpdatesContact: jest.fn(),
	getProductUpdatesSubscriptionStatus: jest.fn(),
};
jest.mock("@actions/newsletter", () => newsletter);

jest.mock("@lib/entitlements", () => ({
	resolveUserEntitlements: jest.fn(async (user: any) => ({ effectivePlan: user.plan || "free", hasActiveGrant: user.id !== "no-grant-user" })),
	resolveUserEntitlementsForUsers: jest.fn(async (users: any[]) => {
		const map = new Map();
		users.forEach((u: any) => map.set(u.id, { effectivePlan: u.plan || "free", hasActiveGrant: u.id !== "no-grant-user" }));
		return map;
	}),
	ensureReverseTrialGrantForUser: jest.fn(),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: jest.fn(() => ({ allowed: true })),
}));

jest.mock("@lib/tokenCrypto", () => ({
	encryptToken: jest.fn((val) => val),
	decryptToken: jest.fn((val) => val),
}));

Object.defineProperty(global, "crypto", {
	value: {
		randomUUID: jest.fn(() => "new-secret"),
	},
	writable: true,
});

function loadDatabaseActions() {
	jest.resetModules();
	return require("@/app/actions/database");
}

describe("database.ts coverage tests", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbInsert.mockImplementation(() => makeInsertChain());
		dbUpdate.mockImplementation(() => makeUpdateChain());
		dbDelete.mockImplementation(() => makeDeleteChain());
		validateAuth.mockResolvedValue({ id: "user-1", email: "e", username: "u" });
		twitch.getUserDetails.mockReset();
		twitch.getUsersDetailsBulk.mockReset();
	});

	it("covers importPlaylistClips pro check", async () => {
		const { importPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // playlist access
		queueSelectResult([{ id: "user-1", plan: "free" }]); // owner plan (Free)

		await expect(importPlaylistClips("pl1", {} as any, "append")).rejects.toThrow("Auto import is a Pro feature");
	});

	it("covers createOverlay unauthenticated", async () => {
		const { createOverlay } = await loadDatabaseActions();
		validateAuth.mockResolvedValue(null);
		const result = await createOverlay("user-1");
		expect(result).toBeNull();
	});

	it("covers createOverlay unauthorized", async () => {
		const { createOverlay } = await loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "user-2" });
		queueSelectResult([]); // canEditOwner editors select
		const result = await createOverlay("user-1");
		expect(result).toBeNull();
	});

	it("covers createOverlay owner not found", async () => {
		const { createOverlay } = await loadDatabaseActions();
		queueSelectResult([]); // owner select
		const result = await createOverlay("user-1");
		expect(result).toBeNull();
	});

	it("covers createOverlay free limit reached", async () => {
		const { createOverlay } = await loadDatabaseActions();
		const { getFeatureAccess } = require("@lib/featureAccess");
		getFeatureAccess.mockReturnValue({ allowed: false });
		queueSelectResult([{ id: "user-1" }]); // owner select
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // resolveUserEntitlements
		queueSelectResult([{ id: "ov1" }]); // existing overlays
		const result = await createOverlay("user-1");
		expect(result).toBeNull();
	});

	it("covers downgradeUserPlan with no overlays or playlists", async () => {
		const { downgradeUserPlan } = await loadDatabaseActions();
		queueSelectResult([]); // overlays
		queueSelectResult([]); // playlists
		await downgradeUserPlan("user-1");
		expect(dbDelete).not.toHaveBeenCalled();
	});

	it("covers downgradeUserPlan with multiple playlists", async () => {
		const { downgradeUserPlan } = await loadDatabaseActions();
		queueSelectResult([{ id: "ov1" }]); // overlays
		queueSelectResult([{ id: "pl1" }, { id: "pl2" }]); // playlists
		queueSelectResult([{ clipId: "c1" }]); // playlist clips
		await downgradeUserPlan("user-1");
		expect(dbDelete).toHaveBeenCalled();
	});

	it("covers getOverlayOwnerPlanPublic error case", async () => {
		const { getOverlayOwnerPlanPublic } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getOverlayOwnerPlanPublic("ov1")).rejects.toThrow("Failed to fetch overlay owner plan");
	});

	it("covers getOverlayByRewardId error case", async () => {
		const { getOverlayByRewardId } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getOverlayByRewardId("r1")).rejects.toThrow("Failed to validate reward ID");
	});

	it("covers addToClipQueue error case", async () => {
		const { addToClipQueue } = await loadDatabaseActions();
		dbInsert.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(addToClipQueue("ov1", "c1")).rejects.toThrow("Failed to add clip to queue");
	});

	it("covers getClipQueueByOverlayId error case", async () => {
		const { getClipQueueByOverlayId } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getClipQueueByOverlayId("ov1")).rejects.toThrow("Failed to fetch clip queue");
	});

	it("covers getClipQueue error case", async () => {
		const { getClipQueue } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getClipQueue("ov1", "s1")).rejects.toThrow("Failed to fetch clip queue");
	});

	it("covers getFirstFromClipQueueByOverlayId error case", async () => {
		const { getFirstFromClipQueueByOverlayId } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getFirstFromClipQueueByOverlayId("ov1")).rejects.toThrow("Failed to fetch first clip from queue");
	});

	it("covers getFirstFromClipQueue error case", async () => {
		const { getFirstFromClipQueue } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getFirstFromClipQueue("ov1", "s1")).rejects.toThrow("Failed to fetch first clip from queue");
	});

	it("covers removeFromClipQueueById error case", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValueOnce({ id: "u1" });
		queueSelectResult([{ overlayId: "ov1" }]);
		queueSelectResult([{ ownerId: "u1" }]);

		const { removeFromClipQueueById } = await loadDatabaseActions();
		dbDelete.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(removeFromClipQueueById("id1")).rejects.toThrow("Failed to remove clip from queue");
	});

	it("covers removeFromClipQueue error case", async () => {
		const { removeFromClipQueue } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // requireOverlaySecretAccess
		queueSelectResult([{ id: "ov1", secret: "s1", ownerId: "u1" }]);
		queueSelectResult([{ disabled: false }]);
		dbDelete.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(removeFromClipQueue("id1", "ov1", "s1")).rejects.toThrow("Failed to remove clip from queue");
	});

	it("covers clearClipQueue error case", async () => {
		const { clearClipQueue } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // requireOverlaySecretAccess
		queueSelectResult([{ id: "ov1", secret: "s1", ownerId: "u1" }]);
		queueSelectResult([{ disabled: false }]);
		dbDelete.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(clearClipQueue("ov1", "s1")).rejects.toThrow("Failed to clear clip queue");
	});

	it("covers addToModQueue error case", async () => {
		const { addToModQueue } = await loadDatabaseActions();
		dbInsert.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(addToModQueue("u1", "c1")).rejects.toThrow("Failed to add clip to mod queue");
	});

	it("covers getModQueueByBroadcasterId error case", async () => {
		const { getModQueueByBroadcasterId } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getModQueueByBroadcasterId("u1")).rejects.toThrow("Failed to fetch mod queue");
	});

	it("covers getFirstFromModQueueByBroadcasterId error case", async () => {
		const { getFirstFromModQueueByBroadcasterId } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getFirstFromModQueueByBroadcasterId("u1")).rejects.toThrow("Failed to fetch first clip from mod queue");
	});

	it("covers getFirstFromModQueue error case", async () => {
		const { getFirstFromModQueue } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // requireOverlaySecretAccess
		queueSelectResult([{ id: "ov1", secret: "s1", ownerId: "u1" }]);
		queueSelectResult([{ disabled: false }]);
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getFirstFromModQueue("ov1", "s1")).rejects.toThrow("Failed to fetch first clip from mod queue");
	});

	it("covers removeFromModQueueById error case", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValueOnce({ id: "u1" });
		queueSelectResult([{ broadcasterId: "u1" }]);

		const { removeFromModQueueById } = await loadDatabaseActions();
		dbDelete.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(removeFromModQueueById("id1")).rejects.toThrow("Failed to remove clip from mod queue");
	});

	it("covers removeFromModQueue error case", async () => {
		const { removeFromModQueue } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // requireOverlaySecretAccess
		queueSelectResult([{ id: "ov1", secret: "s1", ownerId: "u1" }]);
		queueSelectResult([{ disabled: false }]);
		dbDelete.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(removeFromModQueue("id1", "ov1", "s1")).rejects.toThrow("Failed to remove clip from mod queue");
	});

	it("covers clearModQueueByBroadcasterId error case", async () => {
		const { clearModQueueByBroadcasterId } = await loadDatabaseActions();
		dbDelete.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(clearModQueueByBroadcasterId("u1")).rejects.toThrow("Failed to clear mod queue");
	});

	it("covers clearModQueue error case", async () => {
		const { clearModQueue } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // requireOverlaySecretAccess
		queueSelectResult([{ id: "ov1", secret: "s1", ownerId: "u1" }]);
		queueSelectResult([{ disabled: false }]);
		dbDelete.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(clearModQueue("ov1", "s1")).rejects.toThrow("Failed to clear mod queue");
	});

	it("covers getSettings save default branch", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValue({ id: "user-1" });
		const { getSettings } = await loadDatabaseActions();
		queueSelectResult([]); // 1. getSettings initial settings select (empty)

		// saveSettings calls:
		queueSelectResult([{ disabled: false }]); // 2. getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 1000000) }]); // 3. getAccessToken tokenRow
		twitch.getUserDetails.mockResolvedValue({ id: "user-1", login: "u1" });
		queueSelectResult([]); // 4. saveSettings existing settings select

		// getSettings (called again) calls:
		queueSelectResult([{ id: "user-1", prefix: "!" }]); // 5. getSettings second settings select
		queueSelectResult([]); // 6. getSettings editors select
		// getAccessToken call inside getSettings second call
		queueSelectResult([{ disabled: false }]); // 7. getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 1000000) }]); // 8. getAccessToken tokenRow

		twitch.getUsersDetailsBulk.mockResolvedValue([]);
		const result = await getSettings("user-1");
		expect(result.prefix).toBe("!");
	});

	it("covers getSettings forceSyncExternal branch", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValue({ id: "user-1" });
		const { getSettings } = await loadDatabaseActions();
		queueSelectResult([{ id: "user-1", marketingOptIn: false, useSendProductUpdatesContactId: "c1" }]); // settings
		queueSelectResult([]); // editors
		twitch.getUsersDetailsBulk.mockResolvedValue([]);
		queueSelectResult([{ email: "e" }]); // user email select
		newsletter.getProductUpdatesSubscriptionStatus.mockResolvedValue(true); // remote is opted in

		const result = await getSettings("user-1", true);
		expect(result.marketingOptIn).toBe(true);
		expect(dbUpdate).toHaveBeenCalled();
	});

	it("covers getSettings error case", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValue({ id: "user-1" });
		const { getSettings } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getSettings("user-1")).rejects.toThrow("Failed to fetch settings");
	});

	it("covers saveSettings unauthorized", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValue({ id: "user-2" });
		const { saveSettings } = await loadDatabaseActions();
		await expect(saveSettings({ id: "user-1" } as any)).rejects.toThrow("Unauthorized");
	});

	it("covers saveSettings soft_opt_in_default branch", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValue({ id: "user-1" });
		const { saveSettings } = await loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // 1. getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 1000000) }]); // 2. getAccessToken tokenRow
		twitch.getUserDetails.mockResolvedValue({ id: "user-1", login: "u1" });
		queueSelectResult([{ marketingOptIn: false }]); // 3. existing settings select

		await saveSettings({ id: "user-1", marketingOptIn: true, marketingOptInSource: "soft_opt_in_default" } as any);
		expect(dbInsert).toHaveBeenCalled();
	});

	it("covers getOverlayOwnerPlans", async () => {
		const { getOverlayOwnerPlans } = await loadDatabaseActions();
		queueSelectResult([{ userId: "user-1" }]); // editors select
		queueSelectResult([{ id: "ov1", ownerId: "user-1" }]); // overlays select
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owners select

		const result = await getOverlayOwnerPlans(["ov1"]);
		expect(result).toEqual({ ov1: "pro" });
	});

	it("covers getOverlayOwnerPlans unauthenticated", async () => {
		const { getOverlayOwnerPlans } = await loadDatabaseActions();
		validateAuth.mockResolvedValue(null);
		const result = await getOverlayOwnerPlans(["ov1"]);
		expect(result).toEqual({});
	});

	it("covers getOverlayOwnerPlans empty ids", async () => {
		const { getOverlayOwnerPlans } = await loadDatabaseActions();
		const result = await getOverlayOwnerPlans([]);
		expect(result).toEqual({});
	});

	it("covers getOverlayOwnerPlans no overlays found", async () => {
		const { getOverlayOwnerPlans } = await loadDatabaseActions();
		queueSelectResult([]); // editors
		queueSelectResult([]); // overlays
		const result = await getOverlayOwnerPlans(["ov1"]);
		expect(result).toEqual({});
	});

	it("covers getOverlayOwnerPlans error case", async () => {
		const { getOverlayOwnerPlans } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getOverlayOwnerPlans(["ov1"])).rejects.toThrow("Failed to fetch overlay owner plans");
	});

	it("covers importPlaylistClips unauthorized plan", async () => {
		const { importPlaylistClips } = await loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // playlist
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // owner plan
		queueSelectResult([{ id: "user-1", plan: "free" }]);

		await expect(importPlaylistClips("pl1", {} as any, "append")).rejects.toThrow("Auto import is a Pro feature");
	});

	it("covers getOverlayOwnerPlans with editor role", async () => {
		const { getOverlayOwnerPlans } = await loadDatabaseActions();
		queueSelectResult([{ userId: "user-owner" }]); // editors select
		queueSelectResult([{ id: "ov1", ownerId: "user-owner" }]); // overlays select
		queueSelectResult([{ id: "user-owner", plan: "pro" }]); // owners select

		const result = await getOverlayOwnerPlans(["ov1"]);
		expect(result).toEqual({ ov1: "pro" });
	});

	it("covers getOverlayPublic owner disabled", async () => {
		const { getOverlayPublic } = await loadDatabaseActions();
		queueSelectResult([{ id: "ov1", ownerId: "u1" }]); // overlay select
		queueSelectResult([{ disabled: true, disabledReason: "banned" }]); // owner select
		const result = await getOverlayPublic("ov1");
		expect(result.ownerDisabled).toBe(true);
		expect(result.ownerDisabledReason).toBe("banned");
	});

	it("covers getOverlay missing secret", async () => {
		const { getOverlay } = await loadDatabaseActions();
		queueSelectResult([{ id: "ov1", secret: "", ownerId: "u1" }]); // requireOverlayAccess select
		queueSelectResult([{ disabled: false }]); // requireOverlayAccess owner select
		// db.update returning
		queueSelectResult([{ id: "ov1", secret: "new-secret" }]);

		const result = await getOverlay("ov1");
		expect(result.secret).toBe("new-secret");
	});

	it("covers previewImportPlaylistClips unauthorized plan", async () => {
		const { previewImportPlaylistClips } = await loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // requirePlaylistAccess select
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // resolveUserEntitlements getUserById select
		queueSelectResult([{ id: "user-1", plan: "free" }]); // owner plan

		await expect(previewImportPlaylistClips("pl1", {} as any)).rejects.toThrow("Auto import is a Pro feature");
	});

	it("covers getOverlayPublic no overlay found", async () => {
		const { getOverlayPublic } = await loadDatabaseActions();
		queueSelectResult([]); // overlay select empty
		const result = await getOverlayPublic("ov1");
		expect(result).toBeNull();
	});

	it("covers getOverlay no context", async () => {
		const { getOverlay } = await loadDatabaseActions();
		queueSelectResult([]); // requireOverlayAccess select empty
		const result = await getOverlay("ov1");
		expect(result).toBeNull();
	});

	it("covers getSettings save error branch", async () => {
		const { getSettings } = await loadDatabaseActions();
		queueSelectResult([]); // settings select empty
		// saveSettings calls:
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		}); // getAccessToken error
		await expect(getSettings("user-1")).rejects.toThrow("Failed to fetch settings");
	});

	it("covers saveSettings unauthorized user id mismatch", async () => {
		const { saveSettings } = await loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "user-2" });
		await expect(saveSettings({ id: "user-1" } as any)).rejects.toThrow("Unauthorized");
	});

	it("covers applyPlaylistImportFilters creator and blacklist logic", async () => {
		const { previewImportPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // access
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // plan

		queueSelectResult([
			{ key: "c:1", value: JSON.stringify({ id: "c1", creator_name: "Allowed", creator_id: "10", view_count: 10, game_id: "G", created_at: "2020-01-01T00:00:00Z", title: "Good" }) },
			{ key: "c:2", value: JSON.stringify({ id: "c2", creator_name: "Blocked", creator_id: "20", view_count: 10, game_id: "G", created_at: "2020-01-01T00:00:00Z", title: "Bad" }) },
		]);

		const result = await previewImportPlaylistClips("pl1", {
			overlayType: "All" as never,
			clipCreatorsOnly: ["Allowed"],
			clipCreatorsBlocked: ["20"],
			blacklistWords: ["Bad"],
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("c1");
	});

	it("covers getOverlayOwnerPlanPublic owner not found", async () => {
		const { getOverlayOwnerPlanPublic } = loadDatabaseActions();
		queueSelectResult([{ id: "ov1", ownerId: "u1" }]); // overlay
		queueSelectResult([]); // owner empty
		const result = await getOverlayOwnerPlanPublic("ov1");
		expect(result).toBe("free");
	});

	it("covers getOverlay update returning empty", async () => {
		const { getOverlay } = loadDatabaseActions();
		queueSelectResult([{ id: "ov1", secret: "", ownerId: "u1" }]); // access
		queueSelectResult([{ disabled: false }]); // owner
		queueSelectResult([]); // update returning empty
		queueSelectResult([{ id: "ov1", secret: "fallback-secret" }]); // select fallback

		const result = await getOverlay("ov1");
		expect(result.secret).toBe("fallback-secret");
	});

	it("covers getFirstFromClipQueue catch block", async () => {
		const { getFirstFromClipQueue } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // requireOverlaySecretAccess
		queueSelectResult([{ id: "ov1", secret: "s1", ownerId: "u1" }]);
		queueSelectResult([{ disabled: false }]);
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getFirstFromClipQueue("ov1", "s1")).rejects.toThrow("Failed to fetch first clip from queue");
	});

	it("covers applyPlaylistImportFilters startTs and endTs logic", async () => {
		const { previewImportPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // access
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner plan

		queueSelectResult([
			{ key: "c:1", value: JSON.stringify({ id: "c1", created_at: "2026-03-10T00:00:00Z", view_count: 10, game_id: "G", duration: 10 }) },
			{ key: "c:2", value: JSON.stringify({ id: "c2", created_at: "2026-03-20T00:00:00Z", view_count: 10, game_id: "G", duration: 30 }) },
			{ key: "c:3", value: JSON.stringify({ id: "c3", created_at: "invalid", view_count: 10, game_id: "G", duration: 20 }) },
			{ key: "c:4", value: JSON.stringify({ id: "c4", created_at: "2026-03-25T12:00:00Z", view_count: 10, game_id: "G", duration: 15 }) },
			{ key: "c:5", value: JSON.stringify({ id: "c5", created_at: "2026-03-16T00:00:00Z", view_count: 10, game_id: "G", duration: 5 }) },
		]);

		const result = await previewImportPlaylistClips("pl1", {
			overlayType: "7" as never, // tests days branch
			startDate: "2026-03-15",
			endDate: "invalid", // tests !Number.isFinite(raw)
			minDuration: 10,
			maxDuration: 25,
		});

		expect(result.some((c: { id: string }) => c.id === "c5")).toBe(false); // filtered by minDuration
	});

	it("covers getOverlayBySecret missing cases", async () => {
		const { getOverlayBySecret } = loadDatabaseActions();
		// missing secret (no DB calls)
		let result = await getOverlayBySecret("ov1");
		expect(result).toBeNull();

		// invalid secret (1 DB call)
		queueSelectResult([{ id: "ov1", secret: "secret1" }]);
		result = await getOverlayBySecret("ov1", "secret2");
		expect(result).toBeNull();

		// disabled owner (2 DB calls)
		queueSelectResult([{ id: "ov1", secret: "secret1", ownerId: "u1" }]); // 1. overlay
		queueSelectResult([{ disabled: true }]); // 2. owner
		result = await getOverlayBySecret("ov1", "secret1");
		expect(result).toBeNull();
	});

	it("covers createOverlay free owner without active grant still allowed", async () => {
		const { createOverlay } = loadDatabaseActions();
		const { getFeatureAccess } = require("@lib/featureAccess");
		getFeatureAccess.mockReturnValue({ allowed: true });

		validateAuth.mockResolvedValueOnce({ id: "no-grant-user", email: "e", username: "u" });
		queueSelectResult([{ id: "no-grant-user", plan: "free" }]); // owner
		queueSelectResult([{ id: "existing-ov" }]); // existing overlays

		const result = await createOverlay("no-grant-user");
		expect(result).toMatchObject({
			ownerId: "no-grant-user",
			name: "New Overlay",
		});
	});

	it("covers getOverlayByRewardId empty result", async () => {
		const { getOverlayByRewardId } = loadDatabaseActions();
		queueSelectResult([]);
		const result = await getOverlayByRewardId("r1");
		expect(result).toBeUndefined();
	});

	it("covers getFirstFromClipQueue empty queue", async () => {
		const { getFirstFromClipQueue } = loadDatabaseActions();
		queueSelectResult([{ id: "ov1", secret: "s1", ownerId: "u1" }]); // secret
		queueSelectResult([{ disabled: false }]); // owner
		queueSelectResult([]); // queue
		const result = await getFirstFromClipQueue("ov1", "s1");
		expect(result).toBeNull();
	});

	it("covers getAccessToken disabled user", async () => {
		// We can test this by triggering saveSettings
		const { saveSettings } = loadDatabaseActions();
		queueSelectResult([{ disabled: true }]); // getAccessToken userRow
		await expect(saveSettings({ id: "user-1" } as any)).rejects.toThrow("Could not retrieve access token.");
	});

	it("covers getAccessToken invalid token rows", async () => {
		const { saveSettings } = loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // userRow
		queueSelectResult([]); // no token
		await expect(saveSettings({ id: "user-1" } as any)).rejects.toThrow("Could not retrieve access token.");
	});

	it("covers saveSettings catch block", async () => {
		const { saveSettings } = loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 1000000) }]); // tokenRow (valid)
		twitch.getUserDetails.mockResolvedValue({ login: "u1" });
		queueSelectResult(new Error("DB Error")); // existingSettingsRows select error

		await expect(saveSettings({ id: "user-1" } as any)).rejects.toThrow("Failed to save settings");
	});

	it("covers getTwitchCacheEntry parse error", async () => {
		const { getTwitchCacheEntry } = loadDatabaseActions();
		queueSelectResult([{ value: "invalid-json" }]);
		const result = await getTwitchCacheEntry(0 as any, "k");
		expect(result.hit).toBe(false);
	});

	it("covers getTwitchCacheStale parse error", async () => {
		const { getTwitchCacheStale } = loadDatabaseActions();
		queueSelectResult([{ value: "invalid-json" }]);
		const result = await getTwitchCacheStale(0 as any, "k");
		expect(result).toBeNull();
	});

	it("covers getTwitchCacheBatch parse error", async () => {
		const { getTwitchCacheBatch } = loadDatabaseActions();
		queueSelectResult([{ value: "invalid-json", key: "k" }]);
		const result = await getTwitchCacheBatch(0 as any, ["k"]);
		expect(result).toEqual([]);
	});

	it("covers getTwitchCacheByPrefixEntries parse error", async () => {
		const { getTwitchCacheByPrefixEntries } = loadDatabaseActions();
		queueSelectResult([{ value: "invalid-json", key: "k" }]);
		const result = await getTwitchCacheByPrefixEntries(0 as any, "p");
		expect(result).toEqual([]);
	});

	it("covers getTwitchCacheStaleBatch parse error", async () => {
		const { getTwitchCacheStaleBatch } = loadDatabaseActions();
		queueSelectResult([{ value: "invalid-json", key: "k" }]);
		const result = await getTwitchCacheStaleBatch(0 as any, ["k"]);
		expect(result).toEqual([]);
	});

	it("covers setTwitchCacheBatch catch block", async () => {
		const { setTwitchCacheBatch } = loadDatabaseActions();
		dbInsert.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await setTwitchCacheBatch(0 as any, [{ key: "k", value: "v" }]);
		expect(dbInsert).toHaveBeenCalled();
	});

	it("covers disableUserAccess catch block", async () => {
		const { disableUserAccess } = loadDatabaseActions();
		dbUpdate.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await disableUserAccess("user-1", "reason");
		expect(dbUpdate).toHaveBeenCalled();
	});

	it("covers enableUserAccess catch block", async () => {
		const { validateAdminAuth } = require("@actions/auth");
		validateAdminAuth.mockResolvedValueOnce({ id: "admin", role: "admin" });

		const { enableUserAccess } = await loadDatabaseActions();
		dbUpdate.mockImplementationOnce(() => {
			throw new Error("DB error");
		});
		await enableUserAccess("u1");
		expect(dbUpdate).toHaveBeenCalled();
	});

	it("covers getUser unauthorized branch", async () => {
		const { getUser } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "another-user" });
		const result = await getUser("user-1");
		expect(result).toBeNull();
	});

	it("covers getUserPlanById unauthorized branch", async () => {
		const { getUserPlanById } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "another-user" });
		const result = await getUserPlanById("user-1");
		expect(result).toBeNull();
	});

	it("covers deleteUser unauthorized branch", async () => {
		const { deleteUser } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "another-user" });
		const result = await deleteUser("user-1");
		expect(result).toBeNull();
	});

	it("covers isUserDisabledByIdServer catch branch", async () => {
		const { isUserDisabledByIdServer } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		const result = await isUserDisabledByIdServer("user-1");
		expect(result).toBe(false);
	});

	it("covers getAllOverlayIds unauthorized branch", async () => {
		const { getAllOverlayIds } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "another-user" });
		const result = await getAllOverlayIds("user-1");
		expect(result).toBeNull();
	});

	it("covers getAllOverlayIdsByOwner unauthorized branch", async () => {
		const { getAllOverlayIdsByOwner } = loadDatabaseActions();
		validateAuth.mockResolvedValue({ id: "another-user" });
		const result = await getAllOverlayIdsByOwner("user-1");
		expect(result).toBeNull();
	});

	it("covers getActiveOverlayOwnerIdsForClipSync catch branch", async () => {
		const { getActiveOverlayOwnerIdsForClipSync } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		const result = await getActiveOverlayOwnerIdsForClipSync();
		expect(result).toEqual([]);
	});

	it("covers getClipCacheStatus unauthorized branch", async () => {
		const { getClipCacheStatus } = loadDatabaseActions();
		validateAuth.mockResolvedValue(null);
		const result = await getClipCacheStatus("user-1");
		expect(result).toBeNull();
	});

	it("covers getOverlayPublic catch branch", async () => {
		const { getOverlayPublic } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getOverlayPublic("ov1")).rejects.toThrow("Failed to fetch overlay");
	});

	it("covers getOverlayBySecret catch branch", async () => {
		const { getOverlayBySecret } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getOverlayBySecret("ov1", "secret")).rejects.toThrow("Failed to fetch overlay");
	});

	it("covers getOverlay catch branch", async () => {
		const { getOverlay } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getOverlay("ov1")).rejects.toThrow("Failed to fetch overlay");
	});

	it("covers saveSettings opt-out source branch", async () => {
		const { saveSettings } = loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 1000000) }]); // tokenRow
		twitch.getUserDetails.mockResolvedValue({ id: "user-1", login: "u1" });
		queueSelectResult([{ marketingOptIn: true, marketingOptInAt: new Date(), marketingOptInSource: "settings_page_explicit_optin" }]); // existing settings

		await saveSettings({ id: "user-1", marketingOptIn: false, editors: [] } as any);
		expect(dbInsert).toHaveBeenCalled();
	});

	it("covers saveSettings contact id update branch", async () => {
		const { saveSettings } = loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 1000000) }]); // tokenRow
		twitch.getUserDetails.mockResolvedValue({ id: "user-1", login: "u1" });
		queueSelectResult([{ marketingOptIn: false, marketingOptInAt: null, marketingOptInSource: null, useSendProductUpdatesContactId: null }]); // existing settings
		newsletter.syncProductUpdatesContact.mockResolvedValue("new-contact");

		await saveSettings({ id: "user-1", marketingOptIn: true, editors: [] } as any);
		expect(dbUpdate).toHaveBeenCalled();
	});

	it("covers getTwitchCacheEntry miss branch", async () => {
		const { getTwitchCacheEntry } = loadDatabaseActions();
		queueSelectResult([]);
		const result = await getTwitchCacheEntry(0 as any, "missing");
		expect(result).toEqual({ hit: false, value: null });
	});

	it("covers getTwitchCacheStale miss branch", async () => {
		const { getTwitchCacheStale } = loadDatabaseActions();
		queueSelectResult([]);
		const result = await getTwitchCacheStale(0 as any, "missing");
		expect(result).toBeNull();
	});

	it("covers insertUser new-user contact id persistence branch", async () => {
		const { insertUser } = loadDatabaseActions();
		queueSelectResult([]); // existing user rows
		newsletter.syncProductUpdatesContact.mockResolvedValue("contact-123");

		const result = await insertUser({
			id: "u1",
			login: "login1",
			email: "u1@example.com",
			profile_image_url: "avatar",
			created_at: "invalid-date",
		} as any);

		expect(result.id).toBe("u1");
		expect(dbUpdate).toHaveBeenCalled();
	});

	it("covers getUserPlanByIdServer when user missing", async () => {
		const { getUserPlanByIdServer } = loadDatabaseActions();
		queueSelectResult([]);
		const result = await getUserPlanByIdServer("missing-user");
		expect(result).toBeNull();
	});

	it("covers getAccessToken catch branch", async () => {
		const { getAccessToken } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getAccessToken("user-1")).rejects.toThrow("Failed to fetch access token");
	});

	it("covers getAllOverlays catch branch", async () => {
		const { getAllOverlays } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getAllOverlays("user-1")).rejects.toThrow("Failed to fetch overlays");
	});

	it("covers getAllOverlayIds catch branch", async () => {
		const { getAllOverlayIds } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getAllOverlayIds("user-1")).rejects.toThrow("Failed to fetch overlays");
	});

	it("covers getAllOverlayIdsByOwner catch branch", async () => {
		const { getAllOverlayIdsByOwner } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getAllOverlayIdsByOwner("user-1")).rejects.toThrow("Failed to fetch overlays");
	});

	it("covers getAllOverlayIdsByOwnerServer catch branch", async () => {
		const { getAllOverlayIdsByOwnerServer } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getAllOverlayIdsByOwnerServer("user-1")).rejects.toThrow("Failed to fetch overlays");
	});

	it("covers getAllOverlaysByOwnerServer catch branch", async () => {
		const { getAllOverlaysByOwnerServer } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getAllOverlaysByOwnerServer("user-1")).rejects.toThrow("Failed to fetch overlays");
	});

	it("covers getClipCacheStatusForOwnerServer backfill window progress branch", async () => {
		const { getClipCacheStatusForOwnerServer } = loadDatabaseActions();
		const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
		queueSelectResult([{ key: "clip:u1:c1", value: JSON.stringify({ clip: { id: "c1", created_at: "2025-01-01T00:00:00Z" } }) }]); // cache entries
		queueSelectResult([{ value: JSON.stringify({ backfillComplete: false, backfillWindowEnd: "2024-01-01T00:00:00Z" }) }]); // cache state

		const result = await getClipCacheStatusForOwnerServer("u1");
		expect(result.estimatedCoveragePercent).toBeGreaterThanOrEqual(0);
		expect(result.estimatedCoveragePercent).toBeLessThanOrEqual(100);
		nowSpy.mockRestore();
	});

	it("covers getEditorOverlays catch branch", async () => {
		const { getEditorOverlays } = loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getEditorOverlays("user-1")).rejects.toThrow("Failed to fetch editor overlays");
	});

	it("covers playlist import sync warning and parseStoredClip null branch", async () => {
		const { previewImportPlaylistClips } = loadDatabaseActions();
		twitch.syncOwnerClipCache.mockRejectedValue(new Error("sync failed"));
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // access
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner plan
		queueSelectResult([
			{ key: "clip:user-1:bad", value: "not-json" }, // parseCacheJson -> null path
			{ key: "clip:user-1:ok", value: JSON.stringify({ id: "ok", created_at: "2026-03-15T10:00:00Z", view_count: 5, duration: 10, game_id: "g1", title: "ok" }) },
		]);

		const result = await previewImportPlaylistClips("pl1", { overlayType: "All" as never });
		expect(result.map((clip: { id: string }) => clip.id)).toContain("ok");
	});

	it("covers getAllPlaylists clip count path", async () => {
		const { getAllPlaylists } = loadDatabaseActions();
		queueSelectResult([]); // editor rows
		queueSelectResult([{ id: "pl1", ownerId: "user-1", name: "playlist-1" }]); // playlists query
		queueSelectResult([{ playlistId: "pl1", count: 2 }]); // grouped counts
		const result = await getAllPlaylists("user-1");
		expect(result?.[0]?.clipCount).toBe(2);
	});

	it("covers createPlaylist unauthenticated branch", async () => {
		const { createPlaylist } = loadDatabaseActions();
		validateAuth.mockResolvedValue(null);
		const result = await createPlaylist("user-1", "x");
		expect(result).toBeNull();
	});

	it("covers getPlaylistClips happy path through owner server call", async () => {
		const { getPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // requirePlaylistAccess playlist
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // getPlaylistClipsForOwnerServer playlist ownership
		queueSelectResult([{ clipId: "c1", position: 0, clipData: JSON.stringify({ id: "c1", created_at: "2025-01-01T00:00:00Z" }) }]); // playlist clips
		const result = await getPlaylistClips("pl1");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("c1");
	});

	it("covers getPlaylistClips parseStoredClip null branch", async () => {
		const { getPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // requirePlaylistAccess playlist
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // getPlaylistClipsForOwnerServer playlist ownership
		queueSelectResult([{ clipId: "c1", position: 0, clipData: JSON.stringify({ foo: "bar" }) }]); // no id => parseStoredClip null
		const result = await getPlaylistClips("pl1");
		expect(result).toEqual([]);
	});

	it("covers previewImportPlaylistClips inclusive date-only endDate branch", async () => {
		const { previewImportPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // access
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner plan
		queueSelectResult([
			{ key: "c:1", value: JSON.stringify({ id: "in", created_at: "2026-03-20T23:59:59Z", view_count: 1, duration: 10, game_id: "g" }) },
			{ key: "c:2", value: JSON.stringify({ id: "out", created_at: "2026-03-21T00:00:00Z", view_count: 1, duration: 10, game_id: "g" }) },
		]);

		const result = await previewImportPlaylistClips("pl1", {
			overlayType: "All" as never,
			startDate: "2026-03-20",
			endDate: "2026-03-20",
		});
		expect(result.map((c: { id: string }) => c.id)).toContain("in");
		expect(result.map((c: { id: string }) => c.id)).not.toContain("out");
	});

	it("covers saveOverlay sanitizers and payload branch combinations", async () => {
		const { saveOverlay } = loadDatabaseActions();
		let capturedPayload: any = null;
		dbUpdate.mockImplementationOnce(() => ({
			set: (payload: any) => {
				capturedPayload = payload;
				return { where: () => ({ execute: async () => undefined }) };
			},
		}));

		queueSelectResult([{ id: "ov1", ownerId: "user-1", secret: "secret", type: "Featured", name: "old", status: "active" }]); // access overlay
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner
		queueSelectResult([{ id: "ov1", ownerId: "user-1", secret: "secret", type: "Featured", name: "new", status: "active" }]); // getOverlay return

		await saveOverlay("ov1", {
			name: "new",
			themeFontFamily: "My Font||url||https://fonts.googleapis.com/css2?family=Inter",
			themeTextColor: "transparent",
			themeAccentColor: "invalid",
			themeBackgroundColor: "rgba(1, 2, 3, 0.5)",
			progressBarStartColor: "hsl(20, 50%, 50%)",
			progressBarEndColor: "",
		} as any);

		expect(capturedPayload.themeFontFamily).toContain("||url||");
		expect(capturedPayload.themeTextColor).toBe("transparent");
		expect(capturedPayload.themeAccentColor).toBe("#7C3AED");
		expect(capturedPayload.themeBackgroundColor).toBe("rgba(1, 2, 3, 0.5)");
		expect(capturedPayload.progressBarStartColor).toBe("hsl(20, 50%, 50%)");
		expect(capturedPayload.progressBarEndColor).toBe("#8D42F9");
	});

	it("covers saveOverlay font sanitizer no-delimiter and URL parse catch branches", async () => {
		const { saveOverlay } = loadDatabaseActions();
		let capturedPayload: any = null;
		dbUpdate.mockImplementationOnce(() => ({
			set: (payload: any) => {
				capturedPayload = payload;
				return { where: () => ({ execute: async () => undefined }) };
			},
		}));

		queueSelectResult([{ id: "ov1", ownerId: "user-1", secret: "secret", type: "Featured", name: "old", status: "active" }]); // access overlay
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner
		queueSelectResult([{ id: "ov1", ownerId: "user-1", secret: "secret", type: "Featured", name: "new", status: "active" }]); // getOverlay return

		await saveOverlay("ov1", {
			name: "new",
			themeFontFamily: "FamilyOne||url||://not-a-valid-url",
		} as any);

		expect(capturedPayload.themeFontFamily).toBe("FamilyOne");
	});

	it("covers saveOverlay font sanitizer without URL delimiter", async () => {
		const { saveOverlay } = loadDatabaseActions();
		let capturedPayload: any = null;
		dbUpdate.mockImplementationOnce(() => ({
			set: (payload: any) => {
				capturedPayload = payload;
				return { where: () => ({ execute: async () => undefined }) };
			},
		}));

		queueSelectResult([{ id: "ov1", ownerId: "user-1", secret: "secret", type: "Featured", name: "old", status: "active" }]); // access overlay
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner
		queueSelectResult([{ id: "ov1", ownerId: "user-1", secret: "secret", type: "Featured", name: "new", status: "active" }]); // getOverlay return

		await saveOverlay("ov1", {
			name: "new",
			themeFontFamily: "Simple Family",
		} as any);

		expect(capturedPayload.themeFontFamily).toBe("Simple Family");
	});

	it("covers setTwitchCacheBatch summarizeError non-Error branch", async () => {
		const { setTwitchCacheBatch } = loadDatabaseActions();
		dbInsert.mockImplementationOnce(() => {
			throw "plain-string-error";
		});
		await setTwitchCacheBatch(0 as any, [{ key: "k", value: "v" }]);
		expect(dbInsert).toHaveBeenCalled();
	});

	it("covers createPlaylist success path", async () => {
		const { createPlaylist } = loadDatabaseActions();
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // owner in getOwnerPlanContext
		const result = await createPlaylist("user-1", "  My Playlist  ");
		expect(result).toMatchObject({ ownerId: "user-1" });
	});

	it("covers upsertPlaylistClips append path", async () => {
		const { upsertPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // requirePlaylistAccess
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // getOwnerPlanContext
		queueSelectResult([]); // existing playlist rows
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // getPlaylistClipsForOwnerServer ownership check
		queueSelectResult([{ clipId: "c1", position: 0, clipData: JSON.stringify({ id: "c1", created_at: "2025-01-01T00:00:00Z" }) }]); // read back clips

		const result = await upsertPlaylistClips("pl1", [{ id: "c1", created_at: "2025-01-01T00:00:00Z" } as any], "append");
		expect(result).toHaveLength(1);
	});

	it("covers upsertPlaylistClips default mode branch", async () => {
		const { upsertPlaylistClips } = loadDatabaseActions();
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // requirePlaylistAccess
		queueSelectResult([{ id: "user-1", plan: "pro" }]); // getOwnerPlanContext
		queueSelectResult([]); // existing playlist rows
		queueSelectResult([{ id: "pl1", ownerId: "user-1" }]); // getPlaylistClipsForOwnerServer ownership check
		queueSelectResult([]); // playlist rows after write

		const result = await upsertPlaylistClips("pl1", [{ id: "c1" } as any]);
		expect(result).toEqual([]);
	});

	it("covers getOverlayPublic disabled owner default reason fallback", async () => {
		const { getOverlayPublic } = loadDatabaseActions();
		queueSelectResult([{ id: "ov1", ownerId: "u1" }]); // overlay
		queueSelectResult([{ disabled: true, disabledReason: null }]); // owner
		const result = await getOverlayPublic("ov1");
		expect(result?.ownerDisabledReason).toBe("account_disabled");
	});

	describe("getAccessToken actions", () => {
		it("getAccessTokenResult returns unauthorized if not owner or admin", async () => {
			const { getAccessTokenResult } = loadDatabaseActions();
			validateAuth.mockResolvedValueOnce({ id: "other-user", role: "user" });
			const result = await getAccessTokenResult("target-user");
			expect(result).toEqual({ token: null, reason: "unauthorized" });
		});

		it("getAccessTokenResultServer returns user_disabled if user is disabled", async () => {
			const { getAccessTokenResultServer } = loadDatabaseActions();
			queueSelectResult([{ disabled: true }]); // user check
			const result = await getAccessTokenResultServer("user-1");
			expect(result).toEqual({ token: null, reason: "user_disabled" });
		});

		it("getAccessTokenResultServer returns token_row_missing if no token row", async () => {
			const { getAccessTokenResultServer } = loadDatabaseActions();
			queueSelectResult([{ disabled: false }]); // user check
			queueSelectResult([]); // token check
			const result = await getAccessTokenResultServer("user-1");
			expect(result).toEqual({ token: null, reason: "token_row_missing" });
		});

		it("getAccessTokenResultServer returns token_decrypt_failed on decryption error", async () => {
			const { getAccessTokenResultServer } = loadDatabaseActions();
			const { decryptToken } = require("@lib/tokenCrypto");
			decryptToken.mockImplementationOnce(() => {
				throw new Error("fail");
			});
			queueSelectResult([{ disabled: false }]); // user check
			queueSelectResult([{ accessToken: "at", refreshToken: "rt" }]); // token check
			const result = await getAccessTokenResultServer("user-1");
			expect(result).toEqual({ token: null, reason: "token_decrypt_failed" });
		});

		it("getAccessTokenResultServer refreshes token if expired", async () => {
			const { getAccessTokenResultServer } = loadDatabaseActions();
			const now = new Date();
			const expiredAt = new Date(now.getTime() - 1000);
			queueSelectResult([{ disabled: false }]); // user check
			queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: expiredAt, scope: ["s"], tokenType: "Bearer" }]); // token check

			twitch.refreshAccessTokenWithContext.mockResolvedValueOnce({
				token: { access_token: "new-at", refresh_token: "new-rt", expires_in: 3600, scope: ["s"], token_type: "Bearer" },
			});
			twitch.getUserDetails.mockResolvedValueOnce({ id: "user-1", login: "u1" });
			queueSelectResult([{ id: "user-1" }]); // insertUser select

			const result = await getAccessTokenResultServer("user-1");
			expect(result.token?.accessToken).toBe("new-at");
			expect(twitch.refreshAccessTokenWithContext).toHaveBeenCalledWith("rt", "user-1");
		});

		it("getAccessTokenResultServer handles refresh failure", async () => {
			const { getAccessTokenResultServer } = loadDatabaseActions();
			const expiredAt = new Date(Date.now() - 1000);
			queueSelectResult([{ disabled: false }]); // user check
			queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: expiredAt }]); // token check

			twitch.refreshAccessTokenWithContext.mockResolvedValueOnce({ token: null, invalidRefreshToken: false });

			const result = await getAccessTokenResultServer("user-1");
			expect(result).toEqual({ token: null, reason: "refresh_failed" });
		});

		it("getAccessTokenResultServer handles invalid refresh token and disables user", async () => {
			const { getAccessTokenResultServer } = loadDatabaseActions();
			const expiredAt = new Date(Date.now() - 1000);
			queueSelectResult([{ disabled: false }]); // user check
			queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: expiredAt }]); // token check

			twitch.refreshAccessTokenWithContext.mockResolvedValueOnce({ token: null, invalidRefreshToken: true });

			const result = await getAccessTokenResultServer("user-1");
			expect(result).toEqual({ token: null, reason: "refresh_invalid_token" });
			expect(dbUpdate).toHaveBeenCalled(); // disableUserAccess call
		});

		it("getAccessTokenResultServer throws error on database failure", async () => {
			const { getAccessTokenResultServer } = loadDatabaseActions();
			dbSelect.mockImplementationOnce(() => {
				throw new Error("db-fail");
			});
			await expect(getAccessTokenResultServer("user-1")).rejects.toThrow("Failed to fetch access token");
		});

		it("getAccessToken and getAccessTokenServer wrappers", async () => {
			const { getAccessToken, getAccessTokenServer } = loadDatabaseActions();
			// Mocking result of the internal result function to be success
			validateAuth.mockResolvedValueOnce({ id: "user-1", role: "user" });
			queueSelectResult([{ disabled: false }]); // getAccessTokenResult -> getAccessTokenResultServer -> user check
			queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 1000000) }]); // token check

			const token1 = await getAccessToken("user-1");
			expect(token1?.accessToken).toBe("at");

			queueSelectResult([{ disabled: false }]); // getAccessTokenServer -> getAccessTokenResultServer -> user check
			queueSelectResult([{ accessToken: "at2", refreshToken: "rt2", expiresAt: new Date(Date.now() + 1000000) }]); // token check
			const token2 = await getAccessTokenServer("user-1");
			expect(token2?.accessToken).toBe("at2");
		});
	});
});
