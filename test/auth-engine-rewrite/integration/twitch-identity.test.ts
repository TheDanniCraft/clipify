/** @jest-environment node */
import { onboardTwitchIdentity, type CreatorOnboardingRepository, type CreatorOnboardingState } from "@/auth/creator-onboarding";

function emptyState(): CreatorOnboardingState {
	return { users: [], providerAccounts: [], creators: [], organizations: [], memberships: [], identityLinks: [] };
}

class MemoryOnboardingRepository implements CreatorOnboardingRepository {
	state = emptyState();
	failAt?: "creator" | "membership";

	async transaction<T>(operation: (draft: CreatorOnboardingState) => Promise<T>): Promise<T> {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		this.state = draft;
		return result;
	}

	async checkpoint(name: "creator" | "membership") {
		if (this.failAt === name) throw new Error(`injected:${name}`);
	}
}

const twitch = {
	subject: "twitch-000001",
	username: "fixture_creator",
	email: "creator@example.invalid",
	emailVerified: true,
	image: "https://example.invalid/avatar.png",
};

describe("TDD-US2-001 Twitch identity onboarding", () => {
	it("creates exactly one provider-neutral person, provider account, creator account, and owner membership", async () => {
		const repository = new MemoryOnboardingRepository();
		const first = await onboardTwitchIdentity(twitch, repository);
		const second = await onboardTwitchIdentity(twitch, repository);

		expect(second).toEqual(first);
		expect(repository.state.users).toHaveLength(1);
		expect(repository.state.providerAccounts).toHaveLength(1);
		expect(repository.state.creators).toHaveLength(1);
		expect(repository.state.organizations).toHaveLength(1);
		expect(repository.state.memberships).toEqual([{ organizationId: first.organizationId, authUserId: first.authUserId, role: "owner" }]);
		expect(repository.state.identityLinks).toEqual([{ creatorId: first.creatorId, authUserId: first.authUserId, source: "twitch_onboarding" }]);
	});

	it("synchronizes a changed Twitch-verified email", async () => {
		const repository = new MemoryOnboardingRepository();
		const first = await onboardTwitchIdentity(twitch, repository);
		await onboardTwitchIdentity({ ...twitch, email: "new-address@example.invalid" }, repository);

		expect(repository.state.users.find((user) => user.id === first.authUserId)?.email).toBe("new-address@example.invalid");
		expect(repository.state.users).toHaveLength(1);
	});

	it("rejects a different Twitch subject with the same email instead of linking by email", async () => {
		const repository = new MemoryOnboardingRepository();
		await onboardTwitchIdentity(twitch, repository);

		await expect(onboardTwitchIdentity({ ...twitch, subject: "twitch-000002", username: "other" }, repository)).rejects.toMatchObject({ code: "TWITCH_IDENTITY_CONFLICT" });
		expect(repository.state.users).toHaveLength(1);
		expect(repository.state.creators).toHaveLength(1);
	});

	it.each([
		["missing subject", { ...twitch, subject: "" }],
		["missing email", { ...twitch, email: "" }],
		["unverified email", { ...twitch, emailVerified: false }],
	])("rejects %s atomically", async (_label, input) => {
		const repository = new MemoryOnboardingRepository();
		await expect(onboardTwitchIdentity(input, repository)).rejects.toMatchObject({ code: "INVALID_TWITCH_IDENTITY" });
		expect(repository.state).toEqual(emptyState());
	});

	it("blocks a Twitch subject already linked to a different person", async () => {
		const repository = new MemoryOnboardingRepository();
		repository.state.providerAccounts.push({ providerId: "twitch", accountId: twitch.subject, authUserId: "conflicting-user" });

		await expect(onboardTwitchIdentity(twitch, repository)).rejects.toMatchObject({ code: "TWITCH_IDENTITY_CONFLICT" });
		expect(repository.state.users).toHaveLength(0);
	});

	it.each(["creator", "membership"] as const)("rolls back every record when the %s phase fails", async (failAt) => {
		const repository = new MemoryOnboardingRepository();
		repository.failAt = failAt;
		await expect(onboardTwitchIdentity(twitch, repository)).rejects.toThrow(`injected:${failAt}`);
		expect(repository.state).toEqual(emptyState());
	});

	it("keeps the Twitch subject as the stable creator ID without using it as the person ID", async () => {
		const repository = new MemoryOnboardingRepository();
		const generatedIds = ["person-0001", "creator-organization-0001"];
		const result = await onboardTwitchIdentity(twitch, repository, () => generatedIds.shift()!);

		expect(result).toEqual({
			authUserId: "person-0001",
			creatorId: twitch.subject,
			organizationId: "creator-organization-0001",
		});
		expect(result.authUserId).not.toBe(result.creatorId);
	});
});
