/** @jest-environment node */
export {};

const selectQueue: unknown[] = [];
const insertQueue: unknown[] = [];
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const dbDelete = jest.fn();
const dbTransaction = jest.fn();

const insertCalls: Array<{ table: unknown; values: unknown }> = [];
const updateCalls: Array<{ table: unknown; set: unknown }> = [];

const settingsTable = {
	id: "settings.id",
	prefix: "settings.prefix",
	marketingOptIn: "settings.marketing_opt_in",
	marketingOptInAt: "settings.marketing_opt_in_at",
	marketingOptInSource: "settings.marketing_opt_in_source",
	useSendProductUpdatesContactId: "settings.use_send_product_updates_contact_id",
};
const editorsTable = {
	userId: "editors.user_id",
	editorId: "editors.editor_id",
};
const usersTable = {
	id: "users.id",
	email: "users.email",
	username: "users.username",
};
const tokenTable = {
	id: "token.id",
	accessToken: "token.access_token",
	refreshToken: "token.refresh_token",
	expiresAt: "token.expires_at",
	scope: "token.scope",
	tokenType: "token.token_type",
};

function queueSelectResult(value: unknown) {
	selectQueue.push(value);
}

function makeSelectChain() {
	const chain: Record<string, unknown> = {};
	chain.from = () => chain;
	chain.where = () => chain;
	chain.limit = () => chain;
	chain.execute = async () => {
		const result = selectQueue.length > 0 ? selectQueue.shift() : [];
		// console.log("SELECT EXECUTE", { result });
		return result;
	};
	return chain;
}

function makeInsertChain(table: unknown) {
	return {
		values: (values: unknown) => {
			insertCalls.push({ table, values });
			return {
				onConflictDoUpdate: () => ({
					execute: async () => undefined,
				}),
				onConflictDoNothing: () => ({
					execute: async () => undefined,
				}),
				execute: async () => undefined,
			};
		},
	};
}

function makeUpdateChain(table: unknown) {
	return {
		set: (set: unknown) => {
			updateCalls.push({ table, set });
			return {
				where: () => ({
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
			execute: async () => undefined,
		}),
		execute: async () => undefined,
	};
}

function makeTx() {
	return {
		select: (..._args: unknown[]) => {
			// console.log("TX SELECT", _args);
			return makeSelectChain();
		},
		insert: (table: unknown) => makeInsertChain(table),
		update: (table: unknown) => makeUpdateChain(table),
		delete: () => makeDeleteChain(),
		execute: async () => undefined,
	};
}

jest.mock("@/db/client", () => ({
	db: {
		select: (..._args: unknown[]) => {
			// console.log("DB SELECT", _args);
			return dbSelect(..._args);
		},
		insert: (..._args: unknown[]) => dbInsert(..._args),
		update: (..._args: unknown[]) => dbUpdate(..._args),
		delete: (..._args: unknown[]) => dbDelete(..._args),
		transaction: (..._args: unknown[]) => dbTransaction(..._args),
		execute: jest.fn(),
	},
}));

jest.mock("@/db/schema", () => ({
	settingsTable,
	editorsTable,
	usersTable,
	tokenTable,
}));

jest.mock("@lib/tokenCrypto", () => ({
	encryptToken: jest.fn((val: string) => val),
	decryptToken: jest.fn((val: string) => val),
}));

jest.mock("drizzle-orm", () => ({
	eq: jest.fn(() => "eq"),
	inArray: jest.fn(() => "inArray"),
	and: jest.fn(() => "and"),
	or: jest.fn(() => "or"),
	isNull: jest.fn(() => "isNull"),
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
	max: jest.fn(() => "max"),
}));

const validateAuth = jest.fn();
jest.mock("@actions/auth", () => ({
	validateAuth: (...args: any[]) => validateAuth(...args),
}));

const getUsersDetailsBulk = jest.fn();
const getUserDetails = jest.fn();
jest.mock("@actions/twitch", () => ({
	getUsersDetailsBulk: (...args: any[]) => getUsersDetailsBulk(...args),
	getUserDetails: (...args: any[]) => getUserDetails(...args),
}));

const syncProductUpdatesContact = jest.fn();
const getProductUpdatesSubscriptionStatus = jest.fn();
jest.mock("@actions/newsletter", () => ({
	syncProductUpdatesContact: (...args: any[]) => syncProductUpdatesContact(...args),
	getProductUpdatesSubscriptionStatus: (...args: any[]) => getProductUpdatesSubscriptionStatus(...args),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: jest.fn(() => ({ allowed: true })),
}));

async function loadDatabaseActions() {
	jest.resetModules();
	return import("@/app/actions/database");
}

describe("actions/database settings logic", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectQueue.length = 0;
		insertQueue.length = 0;
		insertCalls.length = 0;
		updateCalls.length = 0;
		dbSelect.mockImplementation(() => makeSelectChain());
		dbInsert.mockImplementation((table: unknown) => makeInsertChain(table));
		dbUpdate.mockImplementation((table: unknown) => makeUpdateChain(table));
		dbDelete.mockImplementation(() => makeDeleteChain());
		dbTransaction.mockImplementation(async (callback: any) => callback(makeTx()));

		validateAuth.mockResolvedValue({ id: "user-1", email: "user@test.com", username: "user1" });
		getUsersDetailsBulk.mockResolvedValue([]);
		getUserDetails.mockResolvedValue({ id: "user-1", login: "user1" });
	});

	it("gets settings correctly", async () => {
		const { getSettings } = await loadDatabaseActions();
		queueSelectResult([{ id: "user-1", prefix: "!" }]); // settings select
		queueSelectResult([{ editorId: "editor-1" }]); // editors select
		queueSelectResult([{ disabled: false }]); // usersTable select (getAccessToken)
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 3600000) }]); // tokenTable select (getAccessToken)
		getUsersDetailsBulk.mockResolvedValue([{ id: "editor-1", login: "editor1" }]);

		const result = await getSettings("user-1");
		expect(result).toMatchObject({ id: "user-1", prefix: "!", editors: ["editor1"] });
	});

	it("creates default settings if none exist", async () => {
		const { getSettings } = await loadDatabaseActions();
		const createdAt = new Date("2026-01-01T12:00:00.000Z");
		queueSelectResult([]); // settings select
		queueSelectResult([{ createdAt }]); // user createdAt select for soft opt-in timestamp

		const result = await getSettings("user-1");
		expect(result).toMatchObject({
			id: "user-1",
			prefix: "!",
			marketingOptIn: true,
			marketingOptInAt: createdAt,
			marketingOptInSource: "soft_opt_in_default",
		});
		expect(insertCalls.some((call) => call.table === settingsTable)).toBe(true);
	});

	it("saves settings correctly", async () => {
		const { saveSettings } = await loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 3600000) }]); // getAccessToken tokenRow
		queueSelectResult([{ id: "user-1", marketingOptIn: false }]); // existing settings select
		getUsersDetailsBulk.mockResolvedValue([{ id: "editor-1", login: "editor1" }]);

		await saveSettings({
			id: "user-1",
			prefix: "?",
			marketingOptIn: true,
			editors: ["editor1"],
		} as any);

		expect(updateCalls.length > 0 || insertCalls.length > 0).toBe(true);
		expect(insertCalls.some((call) => call.table === settingsTable)).toBe(true);
		const call = insertCalls.find((call) => call.table === settingsTable);
		expect(call?.values).toMatchObject({ prefix: "?" });
	});

	it("syncs external marketing status if forced (opt-in)", async () => {
		const { getSettings } = await loadDatabaseActions();
		queueSelectResult([{ id: "user-1", marketingOptIn: false, useSendProductUpdatesContactId: "contact-1" }]); // settings select
		queueSelectResult([]); // editors select
		queueSelectResult([{ disabled: false }]); // usersTable select (getAccessToken)
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 3600000) }]); // tokenTable select (getAccessToken)
		queueSelectResult([{ email: "user@test.com" }]); // user email select

		getProductUpdatesSubscriptionStatus.mockResolvedValue(true); // remote is opted-in

		const result = await getSettings("user-1", true);
		expect(result.marketingOptIn).toBe(true);
		expect(result.marketingOptInSource).toBe("external_usesend_sync_optin");
		expect(updateCalls.some((call) => call.table === settingsTable)).toBe(true);
	});

	it("syncs external marketing status if forced (opt-out)", async () => {
		const { getSettings } = await loadDatabaseActions();
		queueSelectResult([{ id: "user-1", marketingOptIn: true, useSendProductUpdatesContactId: "contact-1" }]); // settings select
		queueSelectResult([]); // editors select
		queueSelectResult([{ disabled: false }]); // usersTable select (getAccessToken)
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 3600000) }]); // tokenTable select (getAccessToken)
		queueSelectResult([{ email: "user@test.com" }]); // user email select

		getProductUpdatesSubscriptionStatus.mockResolvedValue(false); // remote is opted-out

		const result = await getSettings("user-1", true);
		expect(result.marketingOptIn).toBe(false);
		expect(result.marketingOptInSource).toBe("external_usesend_sync_optout");
	});

	it("handles error in saveSettings", async () => {
		const { saveSettings } = await loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // usersTable in getAccessToken
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 3600000) }]); // tokenTable in getAccessToken

		dbSelect.mockImplementationOnce(() => makeSelectChain()); // usersTable
		dbSelect.mockImplementationOnce(() => makeSelectChain()); // tokenTable
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		}); // settingsTable

		await expect(saveSettings({ id: "user-1" } as any)).rejects.toThrow("Failed to save settings");
	});

	it("handles error in getSettings", async () => {
		const { getSettings } = await loadDatabaseActions();
		dbSelect.mockImplementationOnce(() => {
			throw new Error("DB Error");
		});
		await expect(getSettings("user-1")).rejects.toThrow("Failed to fetch settings");
	});

	it("saves settings with explicit opt-in source", async () => {
		const { saveSettings } = await loadDatabaseActions();
		queueSelectResult([{ disabled: false }]); // getAccessToken userRow
		queueSelectResult([{ accessToken: "at", refreshToken: "rt", expiresAt: new Date(Date.now() + 3600000) }]); // getAccessToken tokenRow
		queueSelectResult([{ id: "user-1", marketingOptIn: false }]); // existing settings select

		await saveSettings({
			id: "user-1",
			marketingOptIn: true,
			marketingOptInSource: "settings_page_explicit_optin",
		} as any);

		expect(insertCalls.some((call) => call.table === settingsTable)).toBe(true);
	});
});
