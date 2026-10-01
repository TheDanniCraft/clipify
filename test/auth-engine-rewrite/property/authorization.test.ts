/** @jest-environment node */
import { authorize, type AuthorizationRequest } from "@/auth/authorize";
import { NON_DELEGABLE_ACTIONS, PERMISSIONS, STANDARD_ROLES } from "@/auth/permissions";

const now = new Date("2026-09-27T12:00:00.000Z");

function request(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
	return {
		session: { userId: "auth-owner", authenticatedAt: new Date(now.getTime() - 60_000) },
		creatorId: "creator-1",
		lifecycle: "active",
		resourceOwnerId: "creator-1",
		permission: "overlay:read",
		access: { kind: "owner", permissions: [] },
		entitlements: ["pro"],
		now,
		...overrides,
	};
}

describe("TDD-US3-001 centralized authorization", () => {
	it.each(PERMISSIONS)("allows an owner to use applicable permission %s", (permission) => {
		expect(authorize(request({ permission }))).toEqual({ allowed: true, accessPath: "owner" });
	});

	it.each(PERMISSIONS)("allows and denies direct members by explicit permission %s", (permission) => {
		expect(authorize(request({ permission, access: { kind: "direct", permissions: [permission] } }))).toEqual({ allowed: true, accessPath: "direct" });
		expect(authorize(request({ permission, access: { kind: "direct", permissions: [] } }))).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
	});

	it("uses the intersection of agency role and creator-approved ceiling", () => {
		expect(authorize(request({ permission: "overlay:update", access: { kind: "agency", permissions: ["overlay:update"], creatorCeiling: ["overlay:update"] } }))).toEqual({ allowed: true, accessPath: "agency" });
		expect(authorize(request({ permission: "overlay:update", access: { kind: "agency", permissions: ["overlay:update"], creatorCeiling: [] } }))).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
	});

	it.each([
		["missing session", { session: null }, "AUTHENTICATION_REQUIRED"],
		["suspended lifecycle", { lifecycle: "suspended" }, "ACCOUNT_SUSPENDED"],
		["stale sensitive session", { requireRecentAuth: true, session: { userId: "auth-owner", authenticatedAt: new Date(now.getTime() - 300_001) } }, "RECENT_AUTH_REQUIRED"],
		["wrong resource owner", { resourceOwnerId: "creator-2" }, "RESOURCE_OWNERSHIP_MISMATCH"],
		["missing membership", { access: { kind: "none", permissions: [] } }, "ACCESS_PATH_REQUIRED"],
		["missing permission", { access: { kind: "direct", permissions: [] } }, "PERMISSION_DENIED"],
		["non-owner action", { ownerOnlyAction: "account:delete", access: { kind: "direct", permissions: [...PERMISSIONS] } }, "OWNER_REQUIRED"],
		["missing entitlement", { requiredEntitlement: "runner", entitlements: ["pro"] }, "ENTITLEMENT_REQUIRED"],
	] as const)("denies %s in the documented order", (_label, overrides, code) => {
		expect(authorize(request(overrides as Partial<AuthorizationRequest>))).toMatchObject({ allowed: false, code });
	});

	it("accepts the exact five-minute recent-auth boundary and rejects one millisecond beyond", () => {
		expect(authorize(request({ requireRecentAuth: true, session: { userId: "auth-owner", authenticatedAt: new Date(now.getTime() - 300_000) } }))).toMatchObject({ allowed: true });
		expect(authorize(request({ requireRecentAuth: true, session: { userId: "auth-owner", authenticatedAt: new Date(now.getTime() - 300_001) } }))).toMatchObject({ allowed: false, code: "RECENT_AUTH_REQUIRED" });
	});

	it("keeps every non-delegable action outside standard and custom role permissions", () => {
		for (const action of NON_DELEGABLE_ACTIONS) {
			expect(PERMISSIONS).not.toContain(action);
			for (const permissions of Object.values(STANDARD_ROLES)) expect(permissions).not.toContain(action);
		}
	});

	it("does not invoke a protected mutation after denial", async () => {
		const mutation = jest.fn();
		const decision = authorize(request({ access: { kind: "direct", permissions: [] } }));
		if (decision.allowed) await mutation();
		expect(mutation).not.toHaveBeenCalled();
	});
});
