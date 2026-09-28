import { PERMISSIONS } from "@/auth/permissions";
import { resolveAgencyAccess, selectAgencyCreatorContext } from "@/server/agencies/access";

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

	it("selects only accepted linked creators without requiring creator memberships", () => {
		const links = [
			{ id: "proposed", creatorOrganizationId: "creator-a", status: "proposed" as const, permissionCeiling: ["gallery:read" as const] },
			{ id: "accepted-a", creatorOrganizationId: "creator-b", status: "accepted" as const, permissionCeiling: ["gallery:read" as const] },
			{ id: "accepted-b", creatorOrganizationId: "creator-c", status: "accepted" as const, permissionCeiling: ["playlist:read" as const] },
		];
		expect(selectAgencyCreatorContext(links)).toMatchObject({ options: [{ id: "accepted-a" }, { id: "accepted-b" }], selected: { id: "accepted-a" } });
		expect(selectAgencyCreatorContext(links, "creator-c").selected).toMatchObject({ id: "accepted-b" });
		expect(selectAgencyCreatorContext(links, "creator-a").selected).toBeNull();
	});
});
