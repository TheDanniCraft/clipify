/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: { select: jest.fn() } }));
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: jest.fn() }));
jest.mock("@/auth/session", () => ({ getAuthSession: jest.fn() }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: jest.fn() }));
import { db } from "@/db/client";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { getAuthSession } from "@/auth/session";
import { resolveUserEntitlements } from "@lib/entitlements";
import { authorizeCreatorOperation, authorizeTrustedCreatorOperation, listAuthorizedCreatorOperations, parseOrganizationRolePermissions } from "@/auth/authorize-operation";
import { PERMISSIONS } from "@/auth/permissions";

const principal = { kind: "session" as const, authUserId: "actor", sessionId: "session", authenticatedAt: new Date(), organizationId: null };
const account = { creatorId: "creator", organizationId: "creator-org", status: "active" };
const creator = { id: "creator", username: "Creator", disabled: false, plan: "pro" };
let rows: unknown[][];
function enqueue(...values: unknown[][]) {
	rows.push(...values);
}
function ownerRows() {
	return [[account], [creator], [{ role: "owner" }], []];
}
beforeEach(() => {
	jest.clearAllMocks();
	rows = [];
	(db.select as jest.Mock).mockImplementation(() => {
		const result = rows.shift() ?? [];
		const query: any = { from: () => query, where: () => query, limit: async () => result, then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) };
		return query;
	});
	(getVerifiedSessionPrincipal as jest.Mock).mockResolvedValue(principal);
	(getAuthSession as jest.Mock).mockResolvedValue({ session: { id: "session", userId: "actor", createdAt: new Date(), activeOrganizationId: null } });
	(resolveUserEntitlements as jest.Mock).mockResolvedValue({ proAccess: true, runnerAccess: true });
});

test("owner role ignores malformed custom serialization and retains owner permissions", () => {
	expect(parseOrganizationRolePermissions("owner", "invalid")).toEqual([...PERMISSIONS]);
});
test.each([
	["content-manager", "playlist:read"],
	["billing-manager", "billing:read"],
])("standard alias %s has its established permissions", (role, permission) => {
	expect(parseOrganizationRolePermissions(role)).toContain(permission);
});
test.each([undefined, null, "", "invalid", "null"])("unknown role with unusable serialization %s grants nothing", (serialized) => {
	expect(parseOrganizationRolePermissions("custom-role", serialized)).toEqual([]);
});
test("custom role deduplicates known string permissions and ignores unknown resources/actions", () => {
	expect(parseOrganizationRolePermissions("custom-role", JSON.stringify({ overlay: ["read", "read", 42, "unknown"], playlist: "read", private: ["read"] }))).toEqual(["overlay:read"]);
});
test("missing verified session cannot query creator data", async () => {
	(getVerifiedSessionPrincipal as jest.Mock).mockResolvedValue(null);
	expect(await authorizeCreatorOperation({ creatorId: "creator", permission: "overlay:read" })).toEqual({ allowed: false, code: "AUTHENTICATION_REQUIRED" });
	expect(db.select).not.toHaveBeenCalled();
});
test("session wrapper forwards current headers and returns actual owner context", async () => {
	enqueue(...ownerRows());
	const headers = new Headers({ "x-fixture": "current" });
	expect(await authorizeCreatorOperation({ creatorId: "creator", permission: "overlay:read", requestHeaders: headers })).toMatchObject({ allowed: true, accessPath: "owner", creator, sessionId: "session", authUserId: "actor" });
	expect(getVerifiedSessionPrincipal).toHaveBeenCalledWith(headers);
});
test.each([
	[[], [creator]],
	[[account], []],
	[[account], [{ ...creator, disabled: true }]],
])("missing or disabled creator fails closed", async (accounts, creators) => {
	enqueue(accounts, creators);
	expect(await authorizeTrustedCreatorOperation({ principal, creatorId: "creator", permission: "overlay:read" })).toEqual({ allowed: false, code: "ACCOUNT_SUSPENDED" });
});
test("direct team permission still requires effective creator Pro", async () => {
	enqueue([account], [creator], [{ role: "operations" }], []);
	(resolveUserEntitlements as jest.Mock).mockResolvedValue({ proAccess: false, runnerAccess: false });
	expect(await authorizeTrustedCreatorOperation({ principal, creatorId: "creator", permission: "overlay:read" })).toEqual({ allowed: false, code: "ENTITLEMENT_REQUIRED" });
});
test("owner retains basic reads without Pro or Runner access", async () => {
	enqueue(...ownerRows());
	(resolveUserEntitlements as jest.Mock).mockResolvedValue({ proAccess: false, runnerAccess: false });
	expect(await authorizeTrustedCreatorOperation({ principal, creatorId: "creator", permission: "overlay:read" })).toMatchObject({ allowed: true, accessPath: "owner" });
});
test.each([{}, { creators: [{ creatorId: "foreign", agencyOrganizationId: null }] }])("OAuth unapproved creator %p is rejected before database lookup", async (patch) => {
	expect(await authorizeTrustedCreatorOperation({ principal: { ...principal, kind: "oauth", scopes: ["overlay:read"], ...patch }, creatorId: "creator", permission: "overlay:read" })).toEqual({ allowed: false, code: "ACCESS_PATH_REQUIRED" });
	expect(db.select).not.toHaveBeenCalled();
});
test("OAuth absent scope cannot use a saved creator approval", async () => {
	expect(await authorizeTrustedCreatorOperation({ principal: { ...principal, kind: "oauth", creators: [{ creatorId: "creator", agencyOrganizationId: null }] }, creatorId: "creator", permission: "overlay:read" })).toEqual({ allowed: false, code: "PERMISSION_DENIED" });
	expect(db.select).not.toHaveBeenCalled();
});
test.each(["accepted", "revoked", "missing-member", "missing-link", "empty-ceiling"])("agency %s follows current membership and creator ceiling", async (mode) => {
	enqueue([account], [creator], [], mode === "missing-member" ? [] : [{ role: "owner" }], mode === "missing-link" ? [] : [{ status: mode === "revoked" ? "revoked" : "accepted", permissionCeiling: mode === "empty-ceiling" ? [] : ["overlay:read"] }], []);
	const decision = await authorizeTrustedCreatorOperation({ principal: { ...principal, organizationId: "agency" }, creatorId: "creator", permission: "overlay:read" });
	expect(decision.allowed).toBe(mode === "accepted");
	if (mode === "accepted") expect(decision).toMatchObject({ accessPath: "agency" });
});
test.each([null, {}])("creator selector with missing session %p does no database reads", async (envelope) => {
	(getAuthSession as jest.Mock).mockResolvedValue(envelope);
	expect(await listAuthorizedCreatorOperations({ permission: "creator:read" })).toEqual([]);
	expect(db.select).not.toHaveBeenCalled();
});
test("creator selector without current organizations returns no creators", async () => {
	enqueue([]);
	expect(await listAuthorizedCreatorOperations({ permission: "creator:read" })).toEqual([]);
	expect(db.select).toHaveBeenCalledTimes(1);
});
test("creator selector deduplicates organizations and omits unavailable creator accounts", async () => {
	enqueue([{ organizationId: "creator-org" }, { organizationId: "creator-org" }, { organizationId: "missing-org" }], [{ creatorId: "creator" }], [], ...ownerRows());
	expect(await listAuthorizedCreatorOperations({ permission: "creator:read" })).toEqual([expect.objectContaining({ allowed: true, accessPath: "owner", creator })]);
	expect(db.select).toHaveBeenCalledTimes(7);
});
test("active agency links contribute selectors only after current authorization", async () => {
	(getAuthSession as jest.Mock).mockResolvedValue({ session: { id: "session", userId: "actor", createdAt: new Date(), activeOrganizationId: "agency" } });
	enqueue([], [{ creatorOrganizationId: "creator-org" }], [{ creatorId: "creator" }], ...ownerRows());
	expect(await listAuthorizedCreatorOperations({ permission: "creator:read" })).toEqual([expect.objectContaining({ creator })]);
});

test("creator selector omits a current member without audit permission", async () => {
	enqueue([{ organizationId: "creator-org" }], [{ creatorId: "creator" }], [account], [creator], [{ role: "overlay-only" }], [{ permission: JSON.stringify({ overlay: ["read"] }) }]);
	expect(await listAuthorizedCreatorOperations({ permission: "audit:read" })).toEqual([]);
});
test("OAuth agency context comes from stored target approval rather than session organization", async () => {
	enqueue([account], [creator], []);
	const decision = await authorizeTrustedCreatorOperation({ principal: { ...principal, kind: "oauth", organizationId: "unapproved-agency", scopes: ["overlay:read"], creators: [{ creatorId: "creator", agencyOrganizationId: null }] }, creatorId: "creator", permission: "overlay:read" });
	expect(decision).toEqual({ allowed: false, code: "ACCESS_PATH_REQUIRED" });
	expect(db.select).toHaveBeenCalledTimes(3);
});
test("an explicit required Runner entitlement remains authoritative for owner access", async () => {
	enqueue(...ownerRows());
	(resolveUserEntitlements as jest.Mock).mockResolvedValue({ proAccess: true, runnerAccess: false });
	expect(await authorizeTrustedCreatorOperation({ principal, creatorId: "creator", permission: "overlay:read", requiredEntitlement: "runner" })).toEqual({ allowed: false, code: "ENTITLEMENT_REQUIRED" });
});
