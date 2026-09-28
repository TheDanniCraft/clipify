import { AgencyService, createAgencyState, type AgencyActor } from "@/server/agencies/service";
import { PERMISSIONS } from "@/auth/permissions";

const NOW = new Date("2026-09-28T00:00:00.000Z");
const admin: AgencyActor = { authUserId: "admin_1", organizationId: null, role: "platform-admin" };
const owner: AgencyActor = { authUserId: "owner_1", organizationId: "agency_1", role: "owner" };
const creatorOwner: AgencyActor = { authUserId: "creator_owner", organizationId: "creator_1", role: "owner" };

describe("TDD-US4-001 agency provisioning and links", () => {
	it("allows only trusted administration to provision and activates the invited first owner", async () => {
		const state = createAgencyState();
		const service = new AgencyService(
			state,
			() => NOW,
			() => "agency_1",
		);
		await expect(service.provision({ actor: owner, name: "Nope", ownerEmail: "owner@example.com" })).rejects.toThrow("ADMIN_REQUIRED");

		const provisioned = await service.provision({ actor: admin, name: "Clip Agency", ownerEmail: "OWNER@example.com", commercialReference: "contract-42" });
		expect(provisioned.account.status).toBe("owner_invited");
		expect(provisioned.invitation.email).toBe("owner@example.com");
		await service.activateFirstOwner({ agencyOrganizationId: "agency_1", authUserId: "owner_1", verifiedEmail: "owner@example.com" });
		expect(state.accounts[0]?.status).toBe("active");
		expect(state.memberships).toContainEqual(expect.objectContaining({ organizationId: "agency_1", authUserId: "owner_1", role: "owner" }));
	});

	it("requires creator-owner acceptance and validates the delegable ceiling", async () => {
		const state = createAgencyState({ accounts: [{ organizationId: "agency_1", name: "Clip Agency", status: "active", commercialReference: null, provisionedBy: "admin_1", createdAt: NOW, updatedAt: NOW }] });
		const service = new AgencyService(
			state,
			() => NOW,
			() => "link_1",
		);
		await expect(service.proposeLink({ actor: owner, creatorOrganizationId: "creator_1", permissionCeiling: ["account:delete" as never] })).rejects.toThrow("INVALID_PERMISSION_CEILING");
		const proposed = await service.proposeLink({ actor: owner, creatorOrganizationId: "creator_1", permissionCeiling: ["overlay:read", "overlay:update"] });
		expect(proposed.status).toBe("proposed");
		await expect(service.acceptLink({ actor: owner, linkId: proposed.id, permissionCeiling: ["overlay:read"] })).rejects.toThrow("CREATOR_OWNER_REQUIRED");
		await service.acceptLink({ actor: creatorOwner, linkId: proposed.id, permissionCeiling: ["overlay:read"] });
		expect(state.links[0]).toMatchObject({ status: "accepted", permissionCeiling: ["overlay:read"], acceptedBy: "creator_owner" });
		expect(state.links[0]?.permissionCeiling.every((permission) => PERMISSIONS.includes(permission))).toBe(true);
	});

	it("prevents duplicate live links and revokes access on the next operation", async () => {
		const state = createAgencyState({
			accounts: [{ organizationId: "agency_1", name: "Clip Agency", status: "active", commercialReference: null, provisionedBy: "admin_1", createdAt: NOW, updatedAt: NOW }],
			links: [{ id: "link_1", agencyOrganizationId: "agency_1", creatorOrganizationId: "creator_1", status: "accepted", permissionCeiling: ["overlay:read"], proposedBy: "owner_1", proposedAt: NOW, acceptedBy: "creator_owner", acceptedAt: NOW, revokedBy: null, revokedAt: null, updatedAt: NOW }],
		});
		const service = new AgencyService(
			state,
			() => NOW,
			() => "link_2",
		);
		await expect(service.proposeLink({ actor: owner, creatorOrganizationId: "creator_1", permissionCeiling: ["overlay:read"] })).rejects.toThrow("AGENCY_LINK_EXISTS");
		await service.revokeLink({ actor: creatorOwner, linkId: "link_1" });
		expect(service.resolveAcceptedLink("agency_1", "creator_1")).toBeNull();
		expect(state.audits.at(-1)).toMatchObject({ action: "agency-link.revoke", outcome: "success" });
	});
});
