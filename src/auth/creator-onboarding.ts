import { randomUUID } from "node:crypto";

export interface TwitchIdentityInput {
	subject: string;
	username: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
}

export interface CreatorOnboardingState {
	users: Array<{ id: string; email: string; name: string; image: string | null; emailVerified: boolean }>;
	providerAccounts: Array<{ providerId: "twitch"; accountId: string; authUserId: string }>;
	creators: Array<{ id: string; username: string; email: string; avatar: string }>;
	organizations: Array<{ id: string; kind: "creator"; creatorId: string }>;
	memberships: Array<{ organizationId: string; authUserId: string; role: "owner" }>;
	identityLinks: Array<{ creatorId: string; authUserId: string; source: "twitch_onboarding" }>;
}

export interface CreatorOnboardingRepository {
	transaction<T>(operation: (draft: CreatorOnboardingState) => Promise<T>): Promise<T>;
	checkpoint?(name: "creator" | "membership"): Promise<void>;
}

export interface CreatorOnboardingResult {
	authUserId: string;
	creatorId: string;
	organizationId: string;
}

export class CreatorOnboardingError extends Error {
	constructor(
		readonly code: "INVALID_TWITCH_IDENTITY" | "TWITCH_IDENTITY_CONFLICT",
		message: string,
	) {
		super(message);
		this.name = "CreatorOnboardingError";
	}
}

function requireVerifiedIdentity(input: TwitchIdentityInput) {
	if (!input.subject.trim() || !input.email.trim() || !input.emailVerified) {
		throw new CreatorOnboardingError("INVALID_TWITCH_IDENTITY", "Twitch must provide a subject and a verified email");
	}
}

export async function onboardTwitchIdentity(input: TwitchIdentityInput, repository: CreatorOnboardingRepository, createId: () => string = randomUUID): Promise<CreatorOnboardingResult> {
	requireVerifiedIdentity(input);

	return repository.transaction(async (draft) => {
		const providerAccount = draft.providerAccounts.find((account) => account.providerId === "twitch" && account.accountId === input.subject);
		if (providerAccount) {
			const user = draft.users.find((candidate) => candidate.id === providerAccount.authUserId);
			const link = draft.identityLinks.find((candidate) => candidate.authUserId === providerAccount.authUserId);
			const organization = link ? draft.organizations.find((candidate) => candidate.creatorId === link.creatorId) : undefined;
			if (!user || !link || !organization) {
				throw new CreatorOnboardingError("TWITCH_IDENTITY_CONFLICT", "The Twitch subject is already attached to an inconsistent identity");
			}
			user.email = input.email.trim().toLowerCase();
			user.emailVerified = true;
			user.name = input.username;
			user.image = input.image ?? null;
			const creator = draft.creators.find((candidate) => candidate.id === link.creatorId);
			if (creator) {
				creator.email = user.email;
				creator.username = input.username;
				creator.avatar = input.image ?? creator.avatar;
			}
			return { authUserId: user.id, creatorId: link.creatorId, organizationId: organization.id };
		}

		const authUserId = createId();
		const creatorId = input.subject;
		const organizationId = createId();
		const email = input.email.trim().toLowerCase();

		if (draft.users.some((user) => user.email.toLowerCase() === email)) {
			throw new CreatorOnboardingError("TWITCH_IDENTITY_CONFLICT", "Email equality cannot be used to link a Twitch identity");
		}
		if (draft.creators.some((creator) => creator.id === creatorId)) {
			throw new CreatorOnboardingError("TWITCH_IDENTITY_CONFLICT", "The Twitch subject conflicts with an existing creator profile");
		}

		draft.users.push({ id: authUserId, email, name: input.username, image: input.image ?? null, emailVerified: true });
		draft.providerAccounts.push({ providerId: "twitch", accountId: input.subject, authUserId });
		draft.creators.push({ id: creatorId, username: input.username, email, avatar: input.image ?? "" });
		draft.organizations.push({ id: organizationId, kind: "creator", creatorId });
		draft.identityLinks.push({ creatorId, authUserId, source: "twitch_onboarding" });
		await repository.checkpoint?.("creator");
		draft.memberships.push({ organizationId, authUserId, role: "owner" });
		await repository.checkpoint?.("membership");

		return { authUserId, creatorId, organizationId };
	});
}
