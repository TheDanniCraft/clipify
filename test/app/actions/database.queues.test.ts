/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbDelete = jest.fn();

const insertCalls: Array<{ table: unknown; values: unknown }> = [];
const deleteCalls: Array<{ table: unknown }> = [];

const queueTable = {
	id: "queue.id",
	overlayId: "queue.overlay_id",
	clipId: "queue.clip_id",
	queuedAt: "queue.queued_at",
};
const modQueueTable = {
	id: "mod_queue.id",
	broadcasterId: "mod_queue.broadcaster_id",
	clipId: "mod_queue.clip_id",
	queuedAt: "mod_queue.queued_at",
};
const overlaysTable = {
    id: "overlays.id",
    ownerId: "overlays.owner_id",
    secret: "overlays.secret",
};
const usersTable = {
    id: "users.id",
    disabled: "users.disabled",
};

function queueSelectResult(value: unknown) {
	selectQueue.push(value);
}

function makeSelectChain() {
	const chain: Record<string, unknown> = {};
	chain.from = () => chain;
	chain.where = () => chain;
	chain.orderBy = () => chain;
	chain.limit = () => chain;
	chain.execute = async () => (selectQueue.length > 0 ? selectQueue.shift() : []);
	return chain;
}

function makeInsertChain(table: unknown) {
	return {
		values: (values: unknown) => {
			insertCalls.push({ table, values });
			return {
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

const editorsTable = {
    userId: "editors.user_id",
    editorId: "editors.editor_id",
};

jest.mock("@/db/client", () => ({
	db: {
		select: (..._args: unknown[]) => dbSelect(..._args),
		insert: (..._args: unknown[]) => dbInsert(..._args),
		delete: (..._args: unknown[]) => dbDelete(..._args),
		execute: jest.fn(),
	},
}));

jest.mock("@/db/schema", () => ({
	queueTable,
	modQueueTable,
    overlaysTable,
    usersTable,
    editorsTable,
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
	asc: jest.fn(() => "asc"),
	max: jest.fn(() => "max"),
}));

const validateAuth = jest.fn();
const validateAdminAuth = jest.fn();
jest.mock("@actions/auth", () => ({
	validateAuth,
	validateAdminAuth,
}));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database queue logic", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
		insertCalls.length = 0;
		deleteCalls.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbInsert.mockImplementation((table: unknown) => makeInsertChain(table));
		dbDelete.mockImplementation((table: unknown) => makeDeleteChain(table));
	});

	it("adds to clip queue", async () => {
		const { addToClipQueue } = await loadDatabaseActions();
		await addToClipQueue("overlay-1", "clip-1");
		expect(insertCalls.some(call => call.table === queueTable)).toBe(true);
	});

	it("gets clip queue by overlay id", async () => {
		const { getClipQueueByOverlayId } = await loadDatabaseActions();
		queueSelectResult([{ id: 1, clipId: "clip-1" }]);
		const result = await getClipQueueByOverlayId("overlay-1");
		expect(result).toEqual([{ id: 1, clipId: "clip-1" }]);
	});

    it("gets clip queue with secret access", async () => {
        const { getClipQueue } = await loadDatabaseActions();
        // requireOverlaySecretAccess mocks
        queueSelectResult([{ id: "overlay-1", secret: "secret-1" }]); // overlay select
        queueSelectResult([{ disabled: false }]); // owner select
        // getClipQueueByOverlayId mock
        queueSelectResult([{ id: 1, clipId: "clip-1" }]);

        const result = await getClipQueue("overlay-1", "secret-1");
        expect(result).toEqual([{ id: 1, clipId: "clip-1" }]);
    });

    it("returns empty clip queue if secret is invalid", async () => {
        const { getClipQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: "overlay-1", secret: "secret-1" }]); // overlay select
        // owner select not reached because secret mismatch happens first? 
        // Wait, requireOverlaySecretAccess checks secret after select.
        
        const result = await getClipQueue("overlay-1", "wrong-secret");
        expect(result).toEqual([]);
    });

	it("gets first from clip queue", async () => {
		const { getFirstFromClipQueueByOverlayId } = await loadDatabaseActions();
		queueSelectResult([{ id: 1, clipId: "clip-1" }]);
		const result = await getFirstFromClipQueueByOverlayId("overlay-1");
		expect(result).toEqual({ id: 1, clipId: "clip-1" });
	});

	it("removes from clip queue by id", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValueOnce({ id: "user-1" });
		queueSelectResult([{ overlayId: "overlay-1" }]); // queue select
		queueSelectResult([{ ownerId: "user-1" }]); // overlay select

		const { removeFromClipQueueById } = await loadDatabaseActions();
		await removeFromClipQueueById("1");
		expect(deleteCalls.some(call => call.table === queueTable)).toBe(true);
	});

    it("removes from clip queue with secret access", async () => {
        const { removeFromClipQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: "overlay-1", secret: "secret-1" }]); // overlay select
        queueSelectResult([{ disabled: false }]); // owner select

        await removeFromClipQueue("1", "overlay-1", "secret-1");
        expect(deleteCalls.some(call => call.table === queueTable)).toBe(true);
    });

    it("clears clip queue", async () => {
        const { clearClipQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: "overlay-1", secret: "secret-1" }]); // overlay select
        queueSelectResult([{ disabled: false }]); // owner select

        await clearClipQueue("overlay-1", "secret-1");
        expect(deleteCalls.some(call => call.table === queueTable)).toBe(true);
    });

    // Mod Queue
	it("adds to mod queue", async () => {
		const { addToModQueue } = await loadDatabaseActions();
		await addToModQueue("broadcaster-1", "clip-1");
		expect(insertCalls.some(call => call.table === modQueueTable)).toBe(true);
	});

	it("gets mod queue by broadcaster id", async () => {
		const { getModQueueByBroadcasterId } = await loadDatabaseActions();
		queueSelectResult([{ id: 1, clipId: "clip-1" }]);
		const result = await getModQueueByBroadcasterId("broadcaster-1");
		expect(result).toEqual([{ id: 1, clipId: "clip-1" }]);
	});

    it("gets first from mod queue", async () => {
        const { getFirstFromModQueueByBroadcasterId } = await loadDatabaseActions();
        queueSelectResult([{ id: 1, clipId: "clip-1" }]);
        const result = await getFirstFromModQueueByBroadcasterId("broadcaster-1");
        expect(result).toEqual({ id: 1, clipId: "clip-1" });
    });

    it("removes from mod queue by id", async () => {
		const { validateAuth } = require("@actions/auth");
		validateAuth.mockResolvedValueOnce({ id: "user-1" });
		queueSelectResult([{ broadcasterId: "user-1" }]); // mod queue select

        const { removeFromModQueueById } = await loadDatabaseActions();
        await removeFromModQueueById("1");
        expect(deleteCalls.some(call => call.table === modQueueTable)).toBe(true);
    });

    it("gets mod queue", async () => {
        const { getModQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: 1, clipId: "clip-1" }]);
        const result = await getModQueue("broadcaster-1");
        expect(result).toEqual([{ id: 1, clipId: "clip-1" }]);
    });

    it("gets first from mod queue with secret access", async () => {
        const { getFirstFromModQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: "overlay-1", secret: "secret-1", ownerId: "owner-1" }]); // overlay select
        queueSelectResult([{ disabled: false }]); // owner select
        queueSelectResult([{ id: 1, clipId: "clip-1" }]); // mod queue select

        const result = await getFirstFromModQueue("overlay-1", "secret-1");
        expect(result).toEqual({ id: 1, clipId: "clip-1" });
    });

    it("removes from mod queue with secret access", async () => {
        const { removeFromModQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: "overlay-1", secret: "secret-1", ownerId: "owner-1" }]); // overlay select
        queueSelectResult([{ disabled: false }]); // owner select

        await removeFromModQueue("1", "overlay-1", "secret-1");
        expect(deleteCalls.some(call => call.table === modQueueTable)).toBe(true);
    });

    it("returns null from getFirstFromModQueue if secret is invalid", async () => {
        const { getFirstFromModQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: "overlay-1", secret: "secret-1" }]); // overlay select
        const result = await getFirstFromModQueue("overlay-1", "wrong-secret");
        expect(result).toBeNull();
    });

    it("returns from clearModQueue if secret is invalid", async () => {
        const { clearModQueue } = await loadDatabaseActions();
        queueSelectResult([{ id: "overlay-1", secret: "secret-1" }]); // overlay select
        await clearModQueue("overlay-1", "wrong-secret");
        expect(deleteCalls.some(call => call.table === modQueueTable)).toBe(false);
    });

    describe("error cases", () => {
        it("handles error in addToClipQueue", async () => {
            const { addToClipQueue } = await loadDatabaseActions();
            dbInsert.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(addToClipQueue("ov-1", "clip-1")).rejects.toThrow("Failed to add clip to queue");
        });

        it("handles error in getClipQueueByOverlayId", async () => {
            const { getClipQueueByOverlayId } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getClipQueueByOverlayId("ov-1")).rejects.toThrow("Failed to fetch clip queue");
        });

        it("handles error in getClipQueue", async () => {
            const { getClipQueue } = await loadDatabaseActions();
            // Error inside requireOverlaySecretAccess
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getClipQueue("ov-1", "secret")).rejects.toThrow("Failed to fetch clip queue");
        });

        it("handles error in getFirstFromClipQueueByOverlayId", async () => {
            const { getFirstFromClipQueueByOverlayId } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getFirstFromClipQueueByOverlayId("ov-1")).rejects.toThrow("Failed to fetch first clip from queue");
        });

        it("handles error in getFirstFromClipQueue", async () => {
            const { getFirstFromClipQueue } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getFirstFromClipQueue("ov-1", "secret")).rejects.toThrow("Failed to fetch first clip from queue");
        });

        it("handles error in removeFromClipQueueById", async () => {
            const { removeFromClipQueueById } = await loadDatabaseActions();
            dbDelete.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(removeFromClipQueueById("1")).rejects.toThrow("Failed to remove clip from queue");
        });

        it("handles error in removeFromClipQueue", async () => {
            const { removeFromClipQueue } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(removeFromClipQueue("1", "ov-1", "secret")).rejects.toThrow("Failed to remove clip from queue");
        });

        it("handles error in clearClipQueueByOverlayIdServer", async () => {
            const { clearClipQueueByOverlayIdServer } = await loadDatabaseActions();
            dbDelete.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(clearClipQueueByOverlayIdServer("ov-1")).rejects.toThrow("Failed to clear clip queue");
        });

        it("handles error in clearClipQueue", async () => {
            const { clearClipQueue } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(clearClipQueue("ov-1", "secret")).rejects.toThrow("Failed to clear clip queue");
        });

        it("handles error in addToModQueue", async () => {
            const { addToModQueue } = await loadDatabaseActions();
            dbInsert.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(addToModQueue("b-1", "clip-1")).rejects.toThrow("Failed to add clip to mod queue");
        });

        it("handles error in getModQueueByBroadcasterId", async () => {
            const { getModQueueByBroadcasterId } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getModQueueByBroadcasterId("b-1")).rejects.toThrow("Failed to fetch mod queue");
        });

        it("handles error in getFirstFromModQueueByBroadcasterId", async () => {
            const { getFirstFromModQueueByBroadcasterId } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getFirstFromModQueueByBroadcasterId("b-1")).rejects.toThrow("Failed to fetch first clip from mod queue");
        });

        it("handles error in getFirstFromModQueue", async () => {
            const { getFirstFromModQueue } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(getFirstFromModQueue("ov-1", "secret")).rejects.toThrow("Failed to fetch first clip from mod queue");
        });

        it("handles error in removeFromModQueueById", async () => {
            const { removeFromModQueueById } = await loadDatabaseActions();
            dbDelete.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(removeFromModQueueById("1")).rejects.toThrow("Failed to remove clip from mod queue");
        });

        it("handles error in removeFromModQueue", async () => {
            const { removeFromModQueue } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(removeFromModQueue("1", "ov-1", "secret")).rejects.toThrow("Failed to remove clip from mod queue");
        });

        it("handles error in clearModQueueByBroadcasterId", async () => {
            const { clearModQueueByBroadcasterId } = await loadDatabaseActions();
            dbDelete.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(clearModQueueByBroadcasterId("b-1")).rejects.toThrow("Failed to clear mod queue");
        });

        it("handles error in clearModQueue", async () => {
            const { clearModQueue } = await loadDatabaseActions();
            dbSelect.mockImplementationOnce(() => { throw new Error("DB Error"); });
            await expect(clearModQueue("ov-1", "secret")).rejects.toThrow("Failed to clear mod queue");
        });
    });
});
