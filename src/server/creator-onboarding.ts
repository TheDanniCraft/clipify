import "server-only";
import { recordProductOutcome } from "./product-outcomes";

import { and, eq, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { usersTable, settingsTable, creatorAccountsTable, creatorIdentityLinksTable } from "@/db/schema";
import { user as authUsers, account as authAccounts, organization, member } from "@/db/auth-schema";
import { Plan, Role } from "@types";
import { allocateMemberNumber } from "./memberNumbers";
import { ensureReverseTrialGrantForUser } from "@/app/lib/entitlements";
import { getBetterAuthProviderAccessToken } from "./provider-credentials";
import { syncProductUpdatesContact } from "@/app/actions/newsletter";

export async function initializeCreator(creatorId: string, twitchCreatedAt: Date, authUserId: string) {
	await db.transaction(async (tx) => {
		// Serialize callbacks for this identity, including retries after auth committed.
		const [identity] = await tx.select().from(authUsers).where(eq(authUsers.id, authUserId)).for("update");

		if (!identity?.emailVerified || !identity.email.trim()) {
			throw new Error("TWITCH_VERIFIED_IDENTITY_REQUIRED");
		}

		const [account] = await tx
			.select({ id: authAccounts.id })
			.from(authAccounts)
			.where(and(eq(authAccounts.userId, authUserId), eq(authAccounts.providerId, "twitch"), eq(authAccounts.accountId, creatorId)));

		if (!account) {
			throw new Error("TWITCH_ACCOUNT_IDENTITY_REQUIRED");
		}

		const links = await tx
			.select()
			.from(creatorIdentityLinksTable)
			.where(or(eq(creatorIdentityLinksTable.creatorId, creatorId), eq(creatorIdentityLinksTable.authUserId, authUserId)));

		if (links.some((link) => link.authUserId !== authUserId)) {
			throw new Error("TWITCH_SUBJECT_ALREADY_LINKED");
		}

		if (links.some((link) => link.creatorId !== creatorId)) {
			throw new Error("AUTH_USER_ALREADY_LINKED_TO_CREATOR");
		}

		const [existingAccount] = await tx.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, creatorId));
		// Migrated creators retain their original organization and team memberships.
		const organizationId = existingAccount?.organizationId ?? `creator:${creatorId}`;

		const now = new Date();
		const profile = {
			email: identity.email.toLowerCase(),
			username: identity.name,
			avatar: identity.image ?? "",
		};

		const [existingUser] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId)).for("update");

		// Allocate before inserting a new user, as the legacy callback did. Otherwise
		// the allocator counts the signup itself as a legacy member on a fresh DB.
		const [createdUser] = existingUser
			? []
			: await tx
					.insert(usersTable)
					.values({
						id: creatorId,
						...profile,
						role: Role.User,
						plan: Plan.Free,
						memberNumber: await allocateMemberNumber(tx),
						createdAt: identity.createdAt,
						twitchCreatedAt,
					})
					.onConflictDoNothing()
					.returning();
		const user = existingUser ?? createdUser ?? (await tx.select().from(usersTable).where(eq(usersTable.id, creatorId)).for("update"))[0];

		if (!user) {
			throw new Error("ONBOARDING_CREATOR_CONFLICT");
		}

		const organizationProfile = {
			name: identity.name,
			logo: identity.image,
			metadata: JSON.stringify({ kind: "creator", creatorId }),
		};

		await tx
			.insert(organization)
			.values({
				id: organizationId,
				...organizationProfile,
				slug: `creator-${createHash("sha256").update(creatorId).digest("hex").slice(0, 20)}`,
				createdAt: identity.createdAt,
			})
			.onConflictDoUpdate({ target: organization.id, set: organizationProfile });

		await tx
			.insert(creatorAccountsTable)
			.values({ organizationId, creatorId, status: "active" })
			.onConflictDoUpdate({ target: creatorAccountsTable.creatorId, set: { updatedAt: now } });

		await tx
			.insert(creatorIdentityLinksTable)
			.values({ creatorId, authUserId, source: "twitch_onboarding" })
			.onConflictDoUpdate({ target: creatorIdentityLinksTable.creatorId, set: { updatedAt: now } });

		await tx
			.insert(member)
			.values({
				id: `owner:${account.id}`,
				organizationId,
				userId: authUserId,
				role: "owner",
				createdAt: now,
			})
			.onConflictDoNothing({ target: [member.organizationId, member.userId] });

		// Newness comes from this transaction's insert, not a separately installed trigger.
		// Honor pending accounts created by the previous release as well.
		if (createdUser || user.onboardingPending) {
			if (user.memberNumber == null) {
				await tx
					.update(usersTable)
					.set({ memberNumber: await allocateMemberNumber(tx) })
					.where(eq(usersTable.id, creatorId));
			}

			await tx
				.insert(settingsTable)
				.values({
					id: creatorId,
					prefix: "!",
					marketingOptIn: true,
					marketingOptInAt: new Date(),
					marketingOptInSource: "soft_opt_in_default",
					showOnCommunityPage: true,
					creatorPageEnabled: true,
					creatorPageVisibility: "discoverable",
					creatorPageShowBio: true,
				})
				.onConflictDoNothing();

			const trial = await ensureReverseTrialGrantForUser(user, tx);
			if (trial.created) await recordProductOutcome({ outcome: "trial_granted", creatorId, key: "reverse-trial" }, tx);
			await recordProductOutcome({ outcome: "creator_created", creatorId, key: "signup" }, tx);
		}

		await tx
			.update(usersTable)
			.set({
				...profile,
				twitchCreatedAt,
				lastLogin: now,
				updatedAt: now,
				onboardingPending: false,
			})
			.where(eq(usersTable.id, creatorId));
	});
}

/** Keep linked creator profiles in sync when Better Auth updates a verified identity. */
export async function syncCreatorProfile(authUserId: string) {
	await db.transaction(async (tx) => {
		const [identity] = await tx.select().from(authUsers).where(eq(authUsers.id, authUserId)).for("update");

		if (!identity?.emailVerified || !identity.email.trim()) {
			return;
		}

		const links = await tx
			.select({ creatorId: creatorIdentityLinksTable.creatorId })
			.from(creatorIdentityLinksTable)
			.innerJoin(authAccounts, and(eq(authAccounts.userId, creatorIdentityLinksTable.authUserId), eq(authAccounts.providerId, "twitch"), eq(authAccounts.accountId, creatorIdentityLinksTable.creatorId)))
			.where(eq(creatorIdentityLinksTable.authUserId, authUserId));

		for (const { creatorId } of links) {
			await tx
				.update(usersTable)
				.set({
					email: identity.email.toLowerCase(),
					username: identity.name,
					avatar: identity.image ?? "",
					updatedAt: new Date(),
				})
				.where(eq(usersTable.id, creatorId));

			const [creator] = await tx.select({ organizationId: creatorAccountsTable.organizationId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, creatorId));

			if (creator) {
				await tx
					.update(organization)
					.set({
						name: identity.name,
						logo: identity.image,
						metadata: JSON.stringify({ kind: "creator", creatorId }),
					})
					.where(eq(organization.id, creator.organizationId));
			}
		}
	});
}

/** Runs during Twitch sign-in. A failed first sign-in can finish on the next one. */
export async function completeTwitchSignIn(creatorId: string, authUserId: string) {
	const token = await getBetterAuthProviderAccessToken(creatorId, authUserId);

	if (!token?.accessToken) {
		throw new Error("ONBOARDING_TWITCH_TOKEN_UNAVAILABLE");
	}

	const response = await fetch("https://api.twitch.tv/helix/users", {
		headers: {
			Authorization: `Bearer ${token.accessToken}`,
			"Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
		},
		signal: AbortSignal.timeout(10_000),
	});

	if (!response.ok) {
		throw new Error(`ONBOARDING_TWITCH_PROFILE_${response.status}`);
	}

	const profile = ((await response.json()) as { data?: Array<{ id: string; created_at?: string }> }).data?.find((entry) => entry.id === creatorId);
	const twitchCreatedAt = profile?.created_at ? new Date(profile.created_at) : null;

	if (!twitchCreatedAt || !Number.isFinite(twitchCreatedAt.getTime()) || twitchCreatedAt > new Date()) {
		throw new Error("ONBOARDING_TWITCH_CREATED_AT_INVALID");
	}

	await initializeCreator(creatorId, twitchCreatedAt, authUserId);

	// Match the legacy callback's best-effort contact sync without blocking sign-in.
	try {
		const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.id, creatorId));

		if (settings?.marketingOptIn && settings.marketingOptInAt && settings.marketingOptInSource && !settings.useSendProductUpdatesContactId) {
			await db.transaction(async (tx) => {
				const [current] = await tx.select().from(settingsTable).where(eq(settingsTable.id, creatorId)).for("update");

				if (!current?.marketingOptIn || !current.marketingOptInAt || !current.marketingOptInSource || current.useSendProductUpdatesContactId) {
					return;
				}

				const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId));

				if (!user) {
					return;
				}

				const contactId = await syncProductUpdatesContact({
					email: user.email,
					subscribed: true,
					userId: creatorId,
					username: user.username,
					source: current.marketingOptInSource === "soft_opt_in_default" ? "soft_opt_in" : "explicit_opt_in",
				});

				if (contactId) {
					await tx.update(settingsTable).set({ useSendProductUpdatesContactId: contactId }).where(eq(settingsTable.id, creatorId));
				}
			});
		}
	} catch (error) {
		console.error("[creator-onboarding] contact sync failed", error);
	}
}
