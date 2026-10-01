/** @jest-environment node */

const createApiInvitation = jest.fn();
const acceptApiInvitation = jest.fn();
const cancelApiInvitation = jest.fn();
const sendTeamInvitation = jest.fn();

jest.mock("@/auth/config", () => ({
	auth: {
		api: {
			createInvitation: (...args: unknown[]) => createApiInvitation(...args),
			acceptInvitation: (...args: unknown[]) => acceptApiInvitation(...args),
			cancelInvitation: (...args: unknown[]) => cancelApiInvitation(...args),
		},
	},
}));
jest.mock("@/auth/transactional-mail", () => ({ sendTeamInvitation: (...args: unknown[]) => sendTeamInvitation(...args) }));
jest.mock("@/app/lib/baseUrl", () => ({ resolveBaseUrl: () => "https://clipify.us" }));

import { acceptInvitation, acceptPersistedInvitation, createInvitation, createPersistedInvitation, revokeInvitation, revokePersistedInvitation, type InvitationDependencies, type InvitationState } from "@/auth/invitations";
import { addMembership } from "@/auth/memberships";

describe("TDD-US3-008 persisted Better Auth invitation boundary", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		createApiInvitation.mockResolvedValue({ id: "invitation-1", email: "member@example.test" });
		acceptApiInvitation.mockResolvedValue({ invitation: { id: "invitation-1", status: "accepted" } });
		cancelApiInvitation.mockResolvedValue({ invitation: { id: "invitation-1", status: "canceled" } });
	});

	it.each(["copy", "copy-and-email"] as const)("creates one normalized invitation for %s delivery", async (delivery) => {
		const headers = new Headers({ cookie: "session=1" });
		const result = await createPersistedInvitation({ headers, organizationId: "creator-org-1", organizationName: "Creator Team", email: " MEMBER@Example.Test ", role: "operations", delivery });

		expect(createApiInvitation).toHaveBeenCalledWith({
			headers,
			body: { email: "member@example.test", role: "operations", organizationId: "creator-org-1", resend: true },
		});
		expect(result).toEqual({ invitation: { id: "invitation-1", email: "member@example.test" }, invitationUrl: "https://clipify.us/accept-invitation?invitationId=invitation-1", delivery });
		if (delivery === "copy-and-email") {
			expect(sendTeamInvitation).toHaveBeenCalledWith({ email: "member@example.test", invitationUrl: result.invitationUrl, organizationName: "Creator Team" });
		} else {
			expect(sendTeamInvitation).not.toHaveBeenCalled();
		}
	});

	it("delegates acceptance and revocation to the Better Auth API with the caller headers", async () => {
		const headers = new Headers({ cookie: "session=1" });
		await expect(acceptPersistedInvitation({ headers, invitationId: "invitation-1" })).resolves.toEqual({ invitation: { id: "invitation-1", status: "accepted" } });
		expect(acceptApiInvitation).toHaveBeenCalledWith({ headers, body: { invitationId: "invitation-1" } });

		await expect(revokePersistedInvitation({ headers, invitationId: "invitation-1" })).resolves.toEqual({ invitation: { id: "invitation-1", status: "canceled" } });
		expect(cancelApiInvitation).toHaveBeenCalledWith({ headers, body: { invitationId: "invitation-1" } });
	});

	it("keeps identical membership retries idempotent and rejects role conflicts", () => {
		const createdAt = new Date("2026-09-29T00:00:00.000Z");
		const memberships = [{ organizationId: "creator-org-1", authUserId: "auth-user-1", role: "operations", createdAt }];
		expect(addMembership(memberships, { ...memberships[0]! })).toBe(memberships[0]);
		expect(() => addMembership(memberships, { ...memberships[0]!, role: "analyst" })).toThrow("MEMBERSHIP_ROLE_CONFLICT");
		expect(addMembership(memberships, { organizationId: "creator-org-1", authUserId: "auth-user-2", role: "analyst", createdAt })).toMatchObject({ authUserId: "auth-user-2" });
		expect(memberships).toHaveLength(2);
	});

	it("rejects invalid creation and missing invitation tokens", async () => {
		const state: InvitationState = { invitations: [], memberships: [] };
		const dependencies: InvitationDependencies = {
			repository: { transaction: async (operation) => operation(state) },
			now: () => new Date("2026-09-29T00:00:00.000Z"),
			generateToken: () => "token-1",
			roleExists: async () => false,
			deliver: jest.fn(),
		};
		await expect(createInvitation({ organizationId: "creator-org-1", email: "member@example.test", role: "missing", inviterId: "owner-1", delivery: "copy" }, dependencies)).rejects.toMatchObject({ code: "INVITATION_ROLE_INVALID" });
		await expect(acceptInvitation({ token: "missing", authenticatedEmail: "member@example.test", authUserId: "auth-user-1" }, dependencies)).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });
	});

	it("rejects revocation of missing or already accepted invitations", async () => {
		const state: InvitationState = { invitations: [], memberships: [] };
		const dependencies: InvitationDependencies = {
			repository: { transaction: async (operation) => operation(state) },
			now: () => new Date("2026-09-29T00:00:00.000Z"),
			generateToken: () => "token-1",
			roleExists: async () => true,
			deliver: jest.fn(),
		};
		await expect(revokeInvitation("missing", dependencies)).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });
		const created = await createInvitation({ organizationId: "creator-org-1", email: "member@example.test", role: "operations", inviterId: "owner-1", delivery: "copy" }, dependencies);
		await acceptInvitation({ token: created.token, authenticatedEmail: created.email, authUserId: "auth-user-1" }, dependencies);
		await expect(revokeInvitation(created.id, dependencies)).rejects.toMatchObject({ code: "INVITATION_ALREADY_USED" });
	});
});
