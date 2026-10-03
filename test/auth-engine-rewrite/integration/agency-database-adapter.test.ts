/** @jest-environment node */

jest.mock("@/db/client", () => {
	const state = { selects: [] as unknown[][], updates: [] as unknown[][], inserts: [] as unknown[][], executes: [] as unknown[] };
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
		execute: jest.fn(async () => state.executes.shift() ?? { rows: [] }),
	};
	db.transaction = jest.fn(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db));
	return { db, __agencyDbState: state };
});

jest.mock("@/db/schema", () => {
	const table = (name: string) => new Proxy({ _name: name }, { get: (target, property) => (property in target ? target[property as keyof typeof target] : `${name}.${String(property)}`) });
	return {
		agencyAccountsTable: table("agency_accounts"),
		agencyBillingAccountsTable: table("agency_billing_accounts"),
		agencyCreatorLinksTable: table("agency_creator_links"),
		agencyLicenseAllocationsTable: table("agency_license_allocations"),
		auditEventsTable: table("audit_events"),
		creatorAccountsTable: table("creator_accounts"),
		creatorIdentityLinksTable: table("creator_identity_links"),
		notificationOutboxTable: table("notification_outbox"),
		usersTable: table("users"),
	};
});

jest.mock("@/db/auth-schema", () => {
	const table = (name: string) => new Proxy({ _name: name }, { get: (target, property) => (property in target ? target[property as keyof typeof target] : `${name}.${String(property)}`) });
	return { invitation: table("invitation"), member: table("member"), organization: table("organization"), organizationRole: table("organization_role") };
});

jest.mock("drizzle-orm", () => ({
	and: jest.fn(() => "and"),
	eq: jest.fn(() => "eq"),
	inArray: jest.fn(() => "inArray"),
	sql: (strings: TemplateStringsArray, ...parameters: unknown[]) => ({ strings: [...strings], parameters }),
}));

const getAuthSession = jest.fn();
const validateAuth = jest.fn();
jest.mock("@/auth/session", () => ({ getAuthSession: (...args: unknown[]) => getAuthSession(...args) }));
jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));

import { acceptDatabaseAgencyLink, activateCurrentInvitedAgency, activateDatabaseAgencyOwner, allocateDatabaseAgencyLicense, endDueDatabaseAgencyAllocations, listDatabaseAdminAgencies, listDatabaseAgencyOverview, listDatabaseCreatorAgencyLinks, proposeDatabaseAgencyLink, provisionDatabaseAgency, reduceDatabaseAgencyLinkCeiling, resolveDatabaseAgencyPermissions, revokeDatabaseAgencyLink, scheduleDatabaseAgencyLicenseRemoval } from "@/server/agencies/database";
import { PERMISSIONS } from "@/auth/permissions";

const { db, __agencyDbState: state } = jest.requireMock("@/db/client") as {
	db: Record<string, jest.Mock>;
	__agencyDbState: { selects: unknown[][]; updates: unknown[][]; inserts: unknown[][]; executes: unknown[] };
};

const now = new Date("2026-09-29T00:00:00.000Z");
const agency = { organizationId: "agency-org-1", status: "active", creatorSeatLimit: 2 };
const ownerSession = { session: { id: "session-1", userId: "auth-user-1", activeOrganizationId: "agency-org-1" } };

function queueAgencyActor(role = "owner", account = agency, serializedRole?: string) {
	state.selects.push([account], [{ role }], serializedRole ? [{ permission: serializedRole }] : []);
}

function queueCreatorOwner(creatorOrganizationId = "creator-org-1") {
	state.selects.push([{ role: "owner" }], [{ organizationId: creatorOrganizationId, creatorId: "creator-1", status: "active" }]);
}

describe("TDD-US4-004 agency database adapter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		state.selects.length = 0;
		state.updates.length = 0;
		state.inserts.length = 0;
		state.executes.length = 0;
		getAuthSession.mockResolvedValue(ownerSession);
		validateAuth.mockResolvedValue({ id: "admin-creator" });
	});

	it("provisions an agency, owner invitation, notification, and audit atomically", async () => {
		state.selects.push([{ authUserId: "admin-auth-user" }]);
		await expect(provisionDatabaseAgency({ name: " Example Agency ", ownerEmail: " OWNER@Example.Test ", commercialReference: " contract-1 ", creatorSeatLimit: 3, now })).resolves.toMatchObject({ status: "owner_invited" });
		expect(db.transaction).toHaveBeenCalledTimes(1);
		expect(db.insert).toHaveBeenCalledTimes(5);

		state.selects.push([{ authUserId: "admin-auth-user" }]);
		await expect(provisionDatabaseAgency({ name: "!!!", ownerEmail: "owner@example.test", creatorSeatLimit: 0 })).resolves.toMatchObject({ status: "owner_invited" });
	});

	it("persists validated negotiated card and invoice billing terms", async () => {
		for (const billing of [
			{ billingEmail: "billing@example.test", collectionMethod: "charge_automatically" as const, creatorSeatPriceId: "price_creator", creatorSeatMinimum: 5, creatorSeatQuantity: 10, runnerSeatPriceId: "price_runner", runnerSeatMinimum: 1, runnerSeatQuantity: 2 },
			{ billingEmail: "invoice@example.test", collectionMethod: "send_invoice" as const, daysUntilDue: 30, creatorSeatPriceId: "price_creator", creatorSeatMinimum: 5, creatorSeatQuantity: 5, runnerSeatMinimum: 0, runnerSeatQuantity: 0 },
		]) {
			state.selects.push([{ authUserId: "admin-auth-user" }]);
			await expect(provisionDatabaseAgency({ name: "Billed Agency", ownerEmail: "owner@example.test", creatorSeatLimit: 10, billing, now })).resolves.toMatchObject({ status: "owner_invited" });
		}
		expect(db.insert).toHaveBeenCalledTimes(12);
	});

	it.each([
		{ billingEmail: "invalid", creatorSeatPriceId: "price_creator", creatorSeatMinimum: 1, creatorSeatQuantity: 1, runnerSeatMinimum: 0, runnerSeatQuantity: 0, collectionMethod: "charge_automatically" as const },
		{ billingEmail: "billing@example.test", creatorSeatPriceId: "invalid", creatorSeatMinimum: 1, creatorSeatQuantity: 1, runnerSeatMinimum: 0, runnerSeatQuantity: 0, collectionMethod: "charge_automatically" as const },
		{ billingEmail: "billing@example.test", creatorSeatPriceId: "price_creator", creatorSeatMinimum: -1, creatorSeatQuantity: 1, runnerSeatMinimum: 0, runnerSeatQuantity: 0, collectionMethod: "charge_automatically" as const },
		{ billingEmail: "billing@example.test", creatorSeatPriceId: "price_creator", creatorSeatMinimum: 5, creatorSeatQuantity: 4, runnerSeatMinimum: 0, runnerSeatQuantity: 0, collectionMethod: "charge_automatically" as const },
		{ billingEmail: "billing@example.test", creatorSeatPriceId: "price_creator", creatorSeatMinimum: 1, creatorSeatQuantity: 1, runnerSeatMinimum: 2, runnerSeatQuantity: 1, collectionMethod: "charge_automatically" as const },
		{ billingEmail: "billing@example.test", creatorSeatPriceId: "price_creator", creatorSeatMinimum: 1, creatorSeatQuantity: 1, runnerSeatMinimum: 0, runnerSeatQuantity: 1, collectionMethod: "charge_automatically" as const },
		{ billingEmail: "billing@example.test", creatorSeatPriceId: "price_creator", creatorSeatMinimum: 1, creatorSeatQuantity: 1, runnerSeatMinimum: 0, runnerSeatQuantity: 0, collectionMethod: "send_invoice" as const, daysUntilDue: 0 },
	])("rejects an invalid negotiated billing boundary", async (billing) => {
		state.selects.push([{ authUserId: "admin-auth-user" }]);
		await expect(provisionDatabaseAgency({ name: "Agency", ownerEmail: "owner@example.test", creatorSeatLimit: 1, billing, now })).rejects.toThrow("INVALID_AGENCY_BILLING_TERMS");
	});

	it.each([
		{ admin: null, identity: undefined, input: { name: "Agency", ownerEmail: "owner@example.test", creatorSeatLimit: 1 }, error: "ADMIN_REQUIRED" },
		{ admin: { id: "admin" }, identity: [], input: { name: "Agency", ownerEmail: "owner@example.test", creatorSeatLimit: 1 }, error: "ADMIN_IDENTITY_REQUIRED" },
		{ admin: { id: "admin" }, identity: [{ authUserId: "auth-admin" }], input: { name: " ", ownerEmail: "invalid", creatorSeatLimit: -1 }, error: "INVALID_AGENCY_PROVISIONING_INPUT" },
	])("rejects invalid provisioning with $error", async ({ admin, identity, input, error }) => {
		validateAuth.mockResolvedValueOnce(admin);
		if (identity) state.selects.push(identity);
		await expect(provisionDatabaseAgency({ ...input, now })).rejects.toThrow(error);
	});

	it("activates an invited owner and falls back to the current account on a retry", async () => {
		state.selects.push([{ role: "owner" }]);
		state.updates.push([{ ...agency, status: "active" }]);
		await expect(activateDatabaseAgencyOwner({ organizationId: "agency-org-1" })).resolves.toMatchObject({ status: "active" });

		state.selects.push([{ role: "owner" }], [{ ...agency, status: "active" }]);
		state.updates.push([]);
		await expect(activateDatabaseAgencyOwner({ organizationId: "agency-org-1", now })).resolves.toMatchObject({ status: "active" });
		state.selects.push([{ role: "member" }]);
		await expect(activateDatabaseAgencyOwner({ organizationId: "agency-org-1", now })).rejects.toThrow("AGENCY_OWNER_REQUIRED");
	});

	it("finishes first-owner agency activation after invitation acceptance", async () => {
		state.selects.push([{ ...agency, status: "owner_invited" }], [{ role: "owner" }]);
		state.updates.push([{ organizationId: "agency-org-1" }]);
		await expect(activateCurrentInvitedAgency({ organizationId: "agency-org-1", now })).resolves.toEqual({ agency: true, activated: true });

		state.selects.push([]);
		await expect(activateCurrentInvitedAgency({ organizationId: "creator-org-1", now })).resolves.toEqual({ agency: false, activated: false });
		state.selects.push([{ ...agency, status: "active" }], [{ role: "owner" }]);
		await expect(activateCurrentInvitedAgency({ organizationId: "agency-org-1", now })).resolves.toEqual({ agency: true, activated: false });
		state.selects.push([{ ...agency, status: "suspended" }], [{ role: "owner" }]);
		await expect(activateCurrentInvitedAgency({ organizationId: "agency-org-1", now })).rejects.toThrow("AGENCY_ACTIVATION_STATE_INVALID");
	});

	it("requires authentication, agency context, active membership, and permission", async () => {
		getAuthSession.mockResolvedValueOnce(null);
		await expect(proposeDatabaseAgencyLink({ creatorOrganizationId: "creator-org-1", permissionCeiling: [], now })).rejects.toThrow("AUTHENTICATION_REQUIRED");
		getAuthSession.mockResolvedValueOnce({ session: { id: "s", userId: "u" } });
		await expect(proposeDatabaseAgencyLink({ creatorOrganizationId: "creator-org-1", permissionCeiling: [], now })).rejects.toThrow("AGENCY_CONTEXT_REQUIRED");
		state.selects.push([{ ...agency, status: "suspended" }], [{ role: "owner" }]);
		await expect(proposeDatabaseAgencyLink({ creatorOrganizationId: "creator-org-1", permissionCeiling: [], now })).rejects.toThrow("ACTIVE_AGENCY_MEMBERSHIP_REQUIRED");
		queueAgencyActor("analyst", agency, JSON.stringify({ analytics: ["read"] }));
		await expect(proposeDatabaseAgencyLink({ creatorOrganizationId: "creator-org-1", permissionCeiling: [], now })).rejects.toThrow("PERMISSION_DENIED");
	});

	it("activates an invited owner and resolves an agency from creator context", async () => {
		state.selects.push([{ ...agency, status: "owner_invited" }], [{ role: "owner" }], []);
		state.updates.push([{ ...agency, status: "active" }]);
		await expect(listDatabaseAgencyOverview()).resolves.toMatchObject({ occupiedSeats: 0 });

		state.selects.push([], [], [{ organizationId: "creator-org-1" }], [{ account: agency, membership: { role: "owner" } }], [], [], []);
		await expect(listDatabaseAgencyOverview()).resolves.toMatchObject({ occupiedSeats: 0 });

		state.selects.push([], [], [{ organizationId: "creator-org-1" }], []);
		await expect(listDatabaseAgencyOverview()).rejects.toThrow("ACTIVE_AGENCY_MEMBERSHIP_REQUIRED");
	});

	it("proposes a validated creator link", async () => {
		queueAgencyActor();
		state.selects.push([{ creatorId: "creator-1" }]);
		await expect(proposeDatabaseAgencyLink({ creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read"] })).resolves.toMatchObject({ status: "proposed" });
	});

	it("rejects invalid ceilings and missing creator accounts", async () => {
		queueAgencyActor();
		await expect(proposeDatabaseAgencyLink({ creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read", "overlay:read"], now })).rejects.toThrow("INVALID_PERMISSION_CEILING");
		queueAgencyActor();
		state.selects.push([]);
		await expect(proposeDatabaseAgencyLink({ creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read"], now })).rejects.toThrow("CREATOR_ACCOUNT_NOT_FOUND");
	});

	it("accepts, revokes, and reduces creator-owned links", async () => {
		const proposed = { id: "link-1", status: "proposed", creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read", "playlist:read"] };
		state.selects.push([proposed]);
		queueCreatorOwner();
		state.updates.push([{ ...proposed, status: "accepted", permissionCeiling: ["overlay:read"] }]);
		await expect(acceptDatabaseAgencyLink({ linkId: "link-1", permissionCeiling: ["overlay:read"] })).resolves.toMatchObject({ status: "accepted" });

		const accepted = { ...proposed, status: "accepted" };
		state.selects.push([accepted]);
		queueCreatorOwner();
		state.updates.push([{ ...accepted, status: "revoked" }]);
		await expect(revokeDatabaseAgencyLink({ linkId: "link-1" })).resolves.toMatchObject({ status: "revoked" });

		state.selects.push([accepted]);
		queueCreatorOwner();
		state.updates.push([{ ...accepted, permissionCeiling: ["overlay:read"] }]);
		await expect(reduceDatabaseAgencyLinkCeiling({ linkId: "link-1", permissionCeiling: ["overlay:read"] })).resolves.toMatchObject({ permissionCeiling: ["overlay:read"] });
	});

	it("rejects invalid creator-owner link transitions", async () => {
		state.selects.push([]);
		await expect(acceptDatabaseAgencyLink({ linkId: "missing", permissionCeiling: [], now })).rejects.toThrow("AGENCY_LINK_NOT_PROPOSED");
		state.selects.push([{ id: "link-1", status: "proposed", creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read"] }], [{ role: "member" }]);
		await expect(acceptDatabaseAgencyLink({ linkId: "link-1", permissionCeiling: [], now })).rejects.toThrow("CREATOR_OWNER_REQUIRED");
		state.selects.push([{ id: "link-1", status: "proposed", creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read"] }]);
		queueCreatorOwner();
		await expect(acceptDatabaseAgencyLink({ linkId: "link-1", permissionCeiling: ["overlay:update"], now })).rejects.toThrow("PERMISSION_CEILING_EXPANSION_DENIED");
		state.selects.push([]);
		await expect(revokeDatabaseAgencyLink({ linkId: "missing", now })).rejects.toThrow("AGENCY_LINK_NOT_FOUND");
		state.selects.push([{ id: "link-1", status: "revoked", creatorOrganizationId: "creator-org-1" }]);
		queueCreatorOwner();
		await expect(revokeDatabaseAgencyLink({ linkId: "link-1", now })).resolves.toMatchObject({ status: "revoked" });
		state.selects.push([{ id: "link-1", status: "proposed" }]);
		await expect(reduceDatabaseAgencyLinkCeiling({ linkId: "link-1", permissionCeiling: [], now })).rejects.toThrow("ACCEPTED_AGENCY_LINK_REQUIRED");
		state.selects.push([{ id: "link-1", status: "accepted", creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read"] }]);
		queueCreatorOwner();
		await expect(reduceDatabaseAgencyLinkCeiling({ linkId: "link-1", permissionCeiling: ["overlay:update"], now })).rejects.toThrow("PERMISSION_CEILING_EXPANSION_DENIED");

		state.selects.push([{ id: "link-1", status: "proposed", creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read"] }]);
		queueCreatorOwner();
		state.updates.push([]);
		await expect(acceptDatabaseAgencyLink({ linkId: "link-1", permissionCeiling: ["overlay:read"], now })).rejects.toThrow("AGENCY_LINK_STATE_CHANGED");
		state.selects.push([{ id: "link-1", status: "accepted", creatorOrganizationId: "creator-org-1" }]);
		queueCreatorOwner();
		state.updates.push([]);
		await expect(revokeDatabaseAgencyLink({ linkId: "link-1", now })).rejects.toThrow("AGENCY_LINK_STATE_CHANGED");
		state.selects.push([{ id: "link-1", status: "accepted", creatorOrganizationId: "creator-org-1", permissionCeiling: ["overlay:read"] }]);
		queueCreatorOwner();
		state.updates.push([]);
		await expect(reduceDatabaseAgencyLinkCeiling({ linkId: "link-1", permissionCeiling: ["overlay:read"], now })).rejects.toThrow("AGENCY_LINK_STATE_CHANGED");
	});

	it("resolves live role/link permission intersections", async () => {
		state.selects.push([] as unknown[], [{ status: "accepted", permissionCeiling: ["overlay:read"] }]);
		await expect(resolveDatabaseAgencyPermissions({ authUserId: "missing", agencyOrganizationId: "agency-org-1", creatorOrganizationId: "creator-org-1" })).resolves.toEqual([]);
		state.selects.push([{ role: "owner" }], [{ status: "accepted", permissionCeiling: ["overlay:read"] }], []);
		await expect(resolveDatabaseAgencyPermissions({ authUserId: "owner", agencyOrganizationId: "agency-org-1", creatorOrganizationId: "creator-org-1" })).resolves.toEqual(["overlay:read"]);
	});

	it("allocates and schedules removal with notification intents", async () => {
		queueAgencyActor();
		state.selects.push([{ id: "link-1", status: "accepted", creatorOrganizationId: "creator-org-1" }], [], [{ creatorId: "creator-1" }], [{ email: "creator@example.test" }]);
		state.inserts.push([{ id: "allocation-1", status: "active" }]);
		await expect(allocateDatabaseAgencyLicense({ linkId: "link-1", sourceReference: "contract-1" })).resolves.toMatchObject({ status: "active" });

		queueAgencyActor();
		state.selects.push([{ allocation: { id: "allocation-1", status: "active", creatorId: "creator-1" }, link: { id: "link-1" } }], [{ email: "creator@example.test" }]);
		state.updates.push([{ id: "allocation-1", status: "removal_scheduled" }]);
		await expect(scheduleDatabaseAgencyLicenseRemoval({ allocationId: "allocation-1" })).resolves.toMatchObject({ status: "removal_scheduled" });
	});

	it("rejects unavailable, missing, and changed allocation states", async () => {
		queueAgencyActor();
		state.selects.push([]);
		await expect(allocateDatabaseAgencyLicense({ linkId: "missing", sourceReference: "contract", now })).rejects.toThrow("ACCEPTED_AGENCY_LINK_REQUIRED");
		queueAgencyActor(undefined, { ...agency, creatorSeatLimit: 1 });
		state.selects.push([{ id: "link-1", status: "accepted" }], [{ id: "occupied" }]);
		await expect(allocateDatabaseAgencyLicense({ linkId: "link-1", sourceReference: "contract", now })).rejects.toThrow("NO_AGENCY_SEAT_AVAILABLE");
		queueAgencyActor();
		state.selects.push([{ allocation: { status: "ended" }, link: {} }]);
		await expect(scheduleDatabaseAgencyLicenseRemoval({ allocationId: "allocation-1", now })).rejects.toThrow("ACTIVE_ALLOCATION_REQUIRED");
		queueAgencyActor();
		state.selects.push([{ allocation: { id: "allocation-1", status: "active", creatorId: "creator-1" }, link: {} }]);
		state.updates.push([]);
		await expect(scheduleDatabaseAgencyLicenseRemoval({ allocationId: "allocation-1", now })).rejects.toThrow("ALLOCATION_STATE_CHANGED");
	});

	it("lists agency, creator, and administrator views", async () => {
		queueAgencyActor();
		state.selects.push([], []);
		await expect(listDatabaseAgencyOverview()).resolves.toMatchObject({ links: [], allocations: [], occupiedSeats: 0 });
		queueAgencyActor();
		state.selects.push(
			[{ id: "link-1" }, { id: "link-2" }],
			[
				{ id: "allocation-1", status: "active" },
				{ id: "allocation-2", status: "removal_scheduled" },
			],
			[],
		);
		await expect(listDatabaseAgencyOverview()).resolves.toMatchObject({ occupiedSeats: 2 });

		state.selects.push([]);
		await expect(listDatabaseCreatorAgencyLinks()).resolves.toEqual([]);
		state.selects.push([{ organizationId: "creator-org-1" }], [{ link: { id: "link-1" }, agencyName: "Agency" }]);
		await expect(listDatabaseCreatorAgencyLinks()).resolves.toHaveLength(1);

		validateAuth.mockResolvedValueOnce(null);
		await expect(listDatabaseAdminAgencies()).rejects.toThrow("ADMIN_REQUIRED");
		state.selects.push([{ account: agency, name: "Agency", slug: "agency" }]);
		await expect(listDatabaseAdminAgencies()).resolves.toHaveLength(1);
	});

	it("ends only allocations that win the compare-and-set race", async () => {
		state.selects.push([{ id: "allocation-1" }, { id: "allocation-2" }]);
		state.updates.push([{ id: "allocation-1", creatorId: "creator-1" }], []);
		await expect(endDueDatabaseAgencyAllocations({ now, limit: 999 })).resolves.toEqual({ scanned: 2, ended: 1 });
		state.selects.push([]);
		await expect(endDueDatabaseAgencyAllocations()).resolves.toEqual({ scanned: 0, ended: 0 });
	});

	it("recognizes every owner permission and rejects malformed custom role JSON", async () => {
		state.selects.push([{ role: "owner" }], [{ status: "accepted", permissionCeiling: [...PERMISSIONS] }], []);
		await expect(resolveDatabaseAgencyPermissions({ authUserId: "owner", agencyOrganizationId: "agency-org-1", creatorOrganizationId: "creator-org-1" })).resolves.toEqual(PERMISSIONS);
		state.selects.push([{ role: "custom" }], [{ status: "accepted", permissionCeiling: ["overlay:read"] }], [{ permission: "not-json" }]);
		await expect(resolveDatabaseAgencyPermissions({ authUserId: "custom", agencyOrganizationId: "agency-org-1", creatorOrganizationId: "creator-org-1" })).resolves.toEqual([]);
		state.selects.push([{ role: "custom" }], [{ status: "accepted", permissionCeiling: ["overlay:read"] }], [{ permission: JSON.stringify({ overlay: ["read", "update"] }) }]);
		await expect(resolveDatabaseAgencyPermissions({ authUserId: "custom", agencyOrganizationId: "agency-org-1", creatorOrganizationId: "creator-org-1" })).resolves.toEqual(["overlay:read"]);
	});
});
