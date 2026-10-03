/** @jest-environment node */

jest.mock("@/db/client", () => {
	const state = { selects: [] as unknown[][], updates: [] as unknown[][], inserts: [] as unknown[][] };
	const makeChain = (result: unknown) => {
		const chain: Record<string, any> = {};
		for (const method of ["from", "where", "limit", "innerJoin", "set", "values", "onConflictDoNothing", "onConflictDoUpdate", "orderBy", "groupBy"]) chain[method] = jest.fn(() => chain);
		chain.returning = jest.fn(async () => result ?? []);
		chain.execute = jest.fn(async () => result ?? []);
		chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result ?? []).then(resolve, reject);
		return chain;
	};
	const db: Record<string, any> = {
		select: jest.fn(() => makeChain(state.selects.shift() ?? [])),
		update: jest.fn(() => makeChain(state.updates.shift() ?? [])),
		insert: jest.fn(() => makeChain(state.inserts.shift() ?? [])),
		delete: jest.fn(() => makeChain([])),
	};
	db.transaction = jest.fn(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db));
	return { db, __lifecycleDbState: state };
});

jest.mock("@/db/schema", () => {
	const table = (name: string) => new Proxy({ _name: name }, { get: (target, property) => (property in target ? target[property as keyof typeof target] : `${name}.${String(property)}`) });
	return {
		accountDeletionRequestsTable: table("account_deletion_requests"),
		agencyLicenseAllocationsTable: table("agency_license_allocations"),
		auditEventsTable: table("audit_events"),
		billingSubscriptionsTable: table("billing_subscriptions"),
		creatorAccountsTable: table("creator_accounts"),
		entitlementGrantsTable: table("entitlement_grants"),
		galleriesTable: table("galleries"),
		notificationOutboxTable: table("notification_outbox"),
		overlaysTable: table("overlays"),
		playlistsTable: table("playlists"),
		runnersTable: table("runners"),
		usersTable: table("users"),
	};
});

jest.mock("@/db/auth-schema", () => {
	const table = (name: string) => new Proxy({ _name: name }, { get: (target, property) => (property in target ? target[property as keyof typeof target] : `${name}.${String(property)}`) });
	return { member: table("member"), session: table("session"), user: table("auth_user") };
});
jest.mock("drizzle-orm", () => ({ and: jest.fn(() => "and"), eq: jest.fn(() => "eq"), inArray: jest.fn(() => "inArray"), lte: jest.fn(() => "lte") }));

const getAuthActorContext = jest.fn();
jest.mock("@/auth/session", () => ({ getAuthActorContext: (...args: unknown[]) => getAuthActorContext(...args) }));
const collectComprehensiveAccountData = jest.fn();
jest.mock("@/server/account-lifecycle/account-data-export", () => ({ collectComprehensiveAccountData: (...args: unknown[]) => collectComprehensiveAccountData(...args) }));

import { downloadDatabaseAccountDataExport, exportDatabaseAccountData, getDatabaseAccountDeletionOverview, prepareDatabaseAccountDataExport, recoverDatabaseAccountDeletion, requestDatabaseAccountDeletion, suspendDueDatabaseAccountDeletions } from "@/server/account-lifecycle/database";

const { db, __lifecycleDbState: state } = jest.requireMock("@/db/client") as {
	db: Record<string, jest.Mock>;
	__lifecycleDbState: { selects: unknown[][]; updates: unknown[][]; inserts: unknown[][] };
};

const now = new Date("2026-09-29T00:00:00.000Z");
const recent = new Date(now.getTime() - 60_000);
const actor = {
	authUserId: "auth-user-1",
	sessionId: "session-1",
	authenticatedAt: recent,
	creatorId: "creator-1",
	activeOrganizationId: "creator-org-1",
	accountStatus: "active",
	user: { id: "creator-1", disabled: false },
};

function queueOwner(email = "creator@example.test", role = "owner") {
	state.selects.push([{ role }], email ? [{ email }] : []);
}

describe("TDD-US5-004 account lifecycle database adapter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		state.selects.length = 0;
		state.updates.length = 0;
		state.inserts.length = 0;
		getAuthActorContext.mockResolvedValue(actor);
		collectComprehensiveAccountData.mockResolvedValue({ exportFormat: "clipify-account-data-v2" });
	});

	it("fails closed for missing identity, creator account, owner role, stale authentication, and email", async () => {
		getAuthActorContext.mockResolvedValueOnce(null);
		await expect(requestDatabaseAccountDeletion({ choice: "immediate", now })).rejects.toThrow("AUTHENTICATION_REQUIRED");

		getAuthActorContext.mockResolvedValueOnce({ ...actor, activeOrganizationId: null });
		state.selects.push([]);
		await expect(requestDatabaseAccountDeletion({ choice: "immediate", now })).rejects.toThrow("ACCOUNT_NOT_FOUND");

		queueOwner("creator@example.test", "member");
		await expect(requestDatabaseAccountDeletion({ choice: "immediate", now })).rejects.toThrow("OWNER_REQUIRED");

		getAuthActorContext.mockResolvedValueOnce({ ...actor, authenticatedAt: new Date(now.getTime() - 6 * 60_000) });
		queueOwner();
		await expect(requestDatabaseAccountDeletion({ choice: "immediate", now })).rejects.toThrow("RECENT_AUTH_REQUIRED");

		queueOwner("");
		await expect(requestDatabaseAccountDeletion({ choice: "immediate", now })).rejects.toThrow("VERIFIED_EMAIL_REQUIRED");
	});

	it("requests immediate deletion without billing and revokes runtime access atomically", async () => {
		queueOwner();
		state.selects.push([], []);
		await expect(requestDatabaseAccountDeletion({ choice: "immediate", now })).resolves.toMatchObject({ choice: "immediate", status: "suspended", purgeEligibleAt: expect.any(String) });
		expect(db.delete).toHaveBeenCalledTimes(1);
	});

	it("schedules paid-through deletion at the Stripe period end", async () => {
		queueOwner();
		const currentPeriodEnd = new Date(now.getTime() + 86_400_000);
		const billing = { id: "subscription-1", status: "active", currentPeriodEnd, cancelAtPeriodEnd: false };
		state.selects.push([], [billing]);
		const mutateBilling = jest.fn();
		await expect(requestDatabaseAccountDeletion({ choice: "paid_through", now, mutateBilling })).resolves.toMatchObject({ status: "scheduled", suspensionAt: currentPeriodEnd.toISOString(), purgeEligibleAt: null });
		expect(mutateBilling).toHaveBeenCalledWith(billing, "paid_through");
	});

	it("rejects a second nonterminal deletion request", async () => {
		queueOwner();
		state.selects.push([{ id: "request-existing" }], []);
		await expect(requestDatabaseAccountDeletion({ choice: "immediate", now })).rejects.toThrow("DELETION_ALREADY_REQUESTED");
	});

	it("recovers an eligible suspended request and keeps retries idempotent", async () => {
		queueOwner();
		state.selects.push([{ id: "request-1", status: "suspended", purgeEligibleAt: new Date(now.getTime() + 60_000), version: 1 }]);
		state.updates.push([{ id: "request-1" }], []);
		await expect(recoverDatabaseAccountDeletion({ requestId: "request-1", now })).resolves.toEqual({ recovered: true, alreadyRecovered: false });

		getAuthActorContext.mockResolvedValueOnce({ ...actor, authenticatedAt: new Date() });
		queueOwner();
		state.selects.push([{ id: "request-1", status: "recovered", purgeEligibleAt: new Date(now.getTime() + 60_000), version: 2 }]);
		await expect(recoverDatabaseAccountDeletion({ requestId: "request-1" })).resolves.toEqual({ recovered: true, alreadyRecovered: true });
	});

	it.each([
		{ request: undefined, update: undefined, error: "DELETION_REQUEST_NOT_FOUND" },
		{ request: { id: "request-1", status: "scheduled", purgeEligibleAt: null, version: 1 }, update: undefined, error: "RECOVERY_PERIOD_ENDED" },
		{ request: { id: "request-1", status: "suspended", purgeEligibleAt: new Date(now.getTime() + 60_000), version: 1 }, update: [], error: "LIFECYCLE_CONFLICT" },
	])("rejects invalid recovery with $error", async ({ request, update, error }) => {
		queueOwner();
		state.selects.push(request ? [request] : []);
		if (update) state.updates.push(update);
		await expect(recoverDatabaseAccountDeletion({ requestId: "request-1", now })).rejects.toThrow(error);
	});

	it("returns deletion overview states and null when none exists", async () => {
		state.selects.push([]);
		await expect(getDatabaseAccountDeletionOverview()).resolves.toBeNull();
		state.selects.push([{ id: "request-1", choice: "immediate", status: "purge_eligible", suspensionAt: now, purgeEligibleAt: new Date(now.getTime() - 1) }]);
		await expect(getDatabaseAccountDeletionOverview()).resolves.toMatchObject({ id: "request-1", recoveryPeriodEnded: true, purgeEligibleAt: expect.any(String) });
		getAuthActorContext.mockResolvedValueOnce(null);
		await expect(getDatabaseAccountDeletionOverview()).rejects.toThrow("AUTHENTICATION_REQUIRED");
		getAuthActorContext.mockResolvedValueOnce({ ...actor, activeOrganizationId: null });
		state.selects.push([]);
		await expect(getDatabaseAccountDeletionOverview()).rejects.toThrow("ACCOUNT_NOT_FOUND");
	});

	it("suspends due requests, skips lost races, releases allocations, and reschedules notices", async () => {
		const request = { id: "request-1", status: "scheduled", version: 1, organizationId: "creator-org-1", requestedBy: "auth-user-1", requestedAt: new Date(now.getTime() - 86_400_000) };
		state.selects.push([{ id: "missing" }, { id: "conflict" }, { id: "request-1" }], [], [request], [request], [{ creatorId: "creator-1" }], [{ email: "creator@example.test" }]);
		state.updates.push([], [{ id: "request-1" }], [], [], [], [], [], [], []);
		await expect(suspendDueDatabaseAccountDeletions({ now, limit: 999 })).resolves.toEqual({ scanned: 3, suspended: 1 });
	});

	it("handles a due request without an actor, creator, or recipient and supports default input", async () => {
		const request = { id: "request-2", status: "scheduled", version: 1, organizationId: "creator-org-2", requestedBy: null, requestedAt: now };
		state.selects.push([{ id: "request-2" }], [request], []);
		state.updates.push([{ id: "request-2" }], []);
		await expect(suspendDueDatabaseAccountDeletions()).resolves.toEqual({ scanned: 1, suspended: 1 });
	});

	it("exports all account-owned data with stable identifiers", async () => {
		queueOwner();
		state.selects.push([{ id: "creator-1", email: "creator@example.test" }], [{ id: "overlay-1" }], [{ id: "playlist-1" }], [{ id: "gallery-1" }], [{ id: "runner-1" }], [{ id: "subscription-1" }], [{ entitlement: "pro" }], [{ id: "request-1" }]);
		await expect(exportDatabaseAccountData({ now })).resolves.toEqual(expect.objectContaining({ exportedAt: now.toISOString(), organizationId: "creator-org-1", profile: expect.objectContaining({ id: "creator-1" }), overlays: [{ id: "overlay-1" }], deletionRequests: [{ id: "request-1" }] }));

		getAuthActorContext.mockResolvedValueOnce({ ...actor, authenticatedAt: new Date() });
		queueOwner();
		state.selects.push([], [], [], [], [], [], [], []);
		await expect(exportDatabaseAccountData()).resolves.toMatchObject({ profile: null });
	});

	it("prepares and downloads a comprehensive export only for the bound owner", async () => {
		queueOwner();
		await expect(prepareDatabaseAccountDataExport({ now })).resolves.toEqual({ authUserId: "auth-user-1", creatorId: "creator-1", organizationId: "creator-org-1", email: "creator@example.test" });

		getAuthActorContext.mockResolvedValueOnce(null);
		await expect(downloadDatabaseAccountDataExport({ authUserId: "auth-user-1", creatorId: "creator-1", organizationId: "creator-org-1", now })).rejects.toThrow("AUTHENTICATION_REQUIRED");
		await expect(downloadDatabaseAccountDataExport({ authUserId: "other", creatorId: "creator-1", organizationId: "creator-org-1", now })).rejects.toThrow("EXPORT_IDENTITY_MISMATCH");
		state.selects.push([]);
		await expect(downloadDatabaseAccountDataExport({ authUserId: "auth-user-1", creatorId: "creator-1", organizationId: "creator-org-1", now })).rejects.toThrow("EXPORT_IDENTITY_MISMATCH");
		state.selects.push([{ id: "membership-1" }]);
		await expect(downloadDatabaseAccountDataExport({ authUserId: "auth-user-1", creatorId: "creator-1", organizationId: "creator-org-1", now })).resolves.toEqual({ exportFormat: "clipify-account-data-v2" });
		expect(collectComprehensiveAccountData).toHaveBeenCalledWith(expect.objectContaining({ authUserId: "auth-user-1", creatorId: "creator-1", organizationId: "creator-org-1" }));
	});
});
