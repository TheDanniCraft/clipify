import { PERMISSIONS } from "@/auth/permissions";
import { resolveAgencyAccess } from "@/server/agencies/access";

describe("TDD-US4-002 live agency permission intersection", () => {
	it.each(PERMISSIONS)("allows %s only when the role and accepted ceiling both contain it", (permission) => {
		expect(resolveAgencyAccess({ membershipActive: true, linkStatus: "accepted", rolePermissions: [permission], permissionCeiling: [permission] })).toContain(permission);
		expect(resolveAgencyAccess({ membershipActive: true, linkStatus: "accepted", rolePermissions: [permission], permissionCeiling: [] })).not.toContain(permission);
		expect(resolveAgencyAccess({ membershipActive: true, linkStatus: "revoked", rolePermissions: [permission], permissionCeiling: [permission] })).toEqual([]);
	});

	it("does not reuse stale session permissions after membership or ceiling reduction", () => {
		expect(resolveAgencyAccess({ membershipActive: false, linkStatus: "accepted", rolePermissions: ["overlay:delete"], permissionCeiling: ["overlay:delete"] })).toEqual([]);
		expect(resolveAgencyAccess({ membershipActive: true, linkStatus: "accepted", rolePermissions: ["overlay:delete"], permissionCeiling: ["overlay:read"] })).toEqual([]);
	});
});
