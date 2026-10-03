import { evaluateRoleAssignment, permissionsForOrganizationRoles } from "@/auth/role-assignment-policy";

describe("organization role assignment policy", () => {
	const dynamicRoles = new Map<string, Record<string, readonly string[]>>([
		["operator", { member: ["update"], overlay: ["read"] }],
		["overlay-reader", { overlay: ["read"] }],
		["exporter", { account: ["export"] }],
	]);

	it("denies non-owner self-service role changes", () => {
		expect(evaluateRoleAssignment({ actorMemberId: "member-1", targetMemberId: "member-1", actorRole: "operator", requestedRole: "overlay-reader", dynamicRoles })).toEqual({ allowed: false, code: "SELF_ROLE_UPDATE_DENIED" });
	});

	it("denies granting permissions the actor does not already possess", () => {
		expect(evaluateRoleAssignment({ actorMemberId: "member-1", targetMemberId: "member-2", actorRole: "operator", requestedRole: "exporter", dynamicRoles })).toEqual({ allowed: false, code: "ROLE_PERMISSION_ESCALATION_DENIED" });
		expect(evaluateRoleAssignment({ actorMemberId: "member-1", actorRole: "operator", requestedRole: "exporter", dynamicRoles })).toEqual({ allowed: false, code: "ROLE_PERMISSION_ESCALATION_DENIED" });
	});

	it("allows a delegated manager to assign a strictly weaker role", () => {
		expect(evaluateRoleAssignment({ actorMemberId: "member-1", targetMemberId: "member-2", actorRole: "operator", requestedRole: "overlay-reader", dynamicRoles })).toEqual({ allowed: true });
	});

	it("allows owners to manage roles while rejecting unknown roles for other members", () => {
		expect(evaluateRoleAssignment({ actorMemberId: "owner-1", targetMemberId: "owner-1", actorRole: "owner", requestedRole: "operations", dynamicRoles })).toEqual({ allowed: true });
		expect(evaluateRoleAssignment({ actorMemberId: "member-1", targetMemberId: "member-2", actorRole: "operator", requestedRole: "missing", dynamicRoles })).toEqual({ allowed: false, code: "ROLE_NOT_FOUND" });
	});

	it("combines permissions from multiple assigned roles", () => {
		expect(permissionsForOrganizationRoles("overlay-reader,exporter", dynamicRoles)).toEqual(expect.arrayContaining(["overlay:read", "account:export"]));
	});
});
