/** @jest-environment node */
import { acceptInvitation, createInvitation, revokeInvitation, type InvitationRepository, type InvitationState } from "@/auth/invitations";
import { EMAIL_OTP_POLICY, passkeyFallback } from "@/auth/credential-policy";
import { ControlledClock, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite/time";

class MemoryInvitationRepository implements InvitationRepository {
	state: InvitationState = { invitations: [], memberships: [] };
	failMembership = false;

	async transaction<T>(operation: (draft: InvitationState) => Promise<T>): Promise<T> {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		if (this.failMembership && draft.memberships.length > this.state.memberships.length) throw new Error("membership_write_failed");
		this.state = draft;
		return result;
	}
}

const baseInput = {
	organizationId: "creator-org-1",
	email: " Team.Member@Example.COM ",
	role: "content-manager",
	inviterId: "owner-1",
};

function invitationHarness() {
	const clock = new ControlledClock();
	const repository = new MemoryInvitationRepository();
	const delivered: { email: string; token: string; invitationId: string }[] = [];
	return {
		clock,
		repository,
		delivered,
		dependencies: {
			repository,
			now: clock.now,
			generateToken: createDeterministicTokenGenerator("invite"),
			roleExists: async (_organizationId: string, role: string) => role === "content-manager",
			deliver: async (mail: { email: string; token: string; invitationId: string }) => delivered.push(mail),
		},
	};
}

describe("TDD-US3-002 invitations and credentials", () => {
	it("normalizes the bound address and uses one token for copy-only delivery", async () => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy" }, harness.dependencies);

		expect(created.email).toBe("team.member@example.com");
		expect(created.token).toBe("invite-000001");
		expect(harness.delivered).toEqual([]);
		expect(harness.repository.state.invitations[0]).not.toHaveProperty("token");
	});

	it("uses the exact same token for optional email delivery", async () => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy-and-email" }, harness.dependencies);
		expect(harness.delivered).toEqual([{ email: created.email, token: created.token, invitationId: created.id }]);
	});

	it("accepts at the exact seven-day boundary and creates membership atomically", async () => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy" }, harness.dependencies);
		harness.clock.advance(7 * 24 * 60 * 60 * 1000);

		await expect(acceptInvitation({ token: created.token, authenticatedEmail: "TEAM.MEMBER@example.com", authUserId: "member-1" }, harness.dependencies)).resolves.toMatchObject({ organizationId: baseInput.organizationId, authUserId: "member-1", role: baseInput.role });
		expect(harness.repository.state.invitations[0]?.status).toBe("accepted");
	});

	it("rejects expiry one millisecond beyond seven days", async () => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy" }, harness.dependencies);
		harness.clock.advance(7 * 24 * 60 * 60 * 1000 + 1);
		await expect(acceptInvitation({ token: created.token, authenticatedEmail: baseInput.email, authUserId: "member-1" }, harness.dependencies)).rejects.toMatchObject({ code: "INVITATION_EXPIRED" });
	});

	it.each([
		["email mismatch", { authenticatedEmail: "attacker@example.com" }, "INVITATION_EMAIL_MISMATCH"],
		["replay", {}, "INVITATION_ALREADY_USED"],
	] as const)("rejects %s", async (_label, overrides, code) => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy" }, harness.dependencies);
		if (code === "INVITATION_ALREADY_USED") {
			await acceptInvitation({ token: created.token, authenticatedEmail: baseInput.email, authUserId: "member-1" }, harness.dependencies);
		}
		await expect(acceptInvitation({ token: created.token, authenticatedEmail: baseInput.email, authUserId: "member-2", ...overrides }, harness.dependencies)).rejects.toMatchObject({ code });
	});

	it("rejects a revoked invitation", async () => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy" }, harness.dependencies);
		await revokeInvitation(created.id, harness.dependencies);
		await expect(acceptInvitation({ token: created.token, authenticatedEmail: baseInput.email, authUserId: "member-1" }, harness.dependencies)).rejects.toMatchObject({ code: "INVITATION_REVOKED" });
	});

	it("revalidates the role at acceptance", async () => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy" }, harness.dependencies);
		harness.dependencies.roleExists = async () => false;
		await expect(acceptInvitation({ token: created.token, authenticatedEmail: baseInput.email, authUserId: "member-1" }, harness.dependencies)).rejects.toMatchObject({ code: "INVITATION_ROLE_INVALID" });
	});

	it("rolls back invitation consumption when membership creation fails", async () => {
		const harness = invitationHarness();
		const created = await createInvitation({ ...baseInput, delivery: "copy" }, harness.dependencies);
		harness.repository.failMembership = true;
		await expect(acceptInvitation({ token: created.token, authenticatedEmail: baseInput.email, authUserId: "member-1" }, harness.dependencies)).rejects.toThrow("membership_write_failed");
		expect(harness.repository.state.invitations[0]?.status).toBe("pending");
		expect(harness.repository.state.memberships).toEqual([]);
	});

	it("freezes hashed ten-minute OTPs with three attempts and rotation on resend", () => {
		expect(EMAIL_OTP_POLICY).toEqual({ storage: "hashed", expiresInSeconds: 600, allowedAttempts: 3, resendStrategy: "rotate" });
	});

	it.each([
		["available", "passkey"],
		["unavailable", "email-otp"],
		["removed", "email-otp"],
		["failing", "email-otp"],
	] as const)("uses the safe %s passkey lifecycle path", (state, expected) => {
		expect(passkeyFallback(state)).toBe(expected);
	});
});
