import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usersTable, settingsTable } from "@/db/schema";
import { allocateMemberNumber } from "./memberNumbers";
import { ensureReverseTrialGrantForUser } from "@/app/lib/entitlements";
import { getBetterAuthProviderAccessToken } from "./provider-credentials";
import { syncProductUpdatesContact } from "@/app/actions/newsletter";

export async function initializeCreator(creatorId: string, twitchCreatedAt: Date) {
	await db.transaction(async (tx) => {
		const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId)).for("update");
		if (!user) throw new Error("ONBOARDING_CREATOR_MISSING");
		if (user.onboardingPending) {
			if (user.memberNumber == null)
				await tx
					.update(usersTable)
					.set({ memberNumber: await allocateMemberNumber(tx) })
					.where(eq(usersTable.id, creatorId));
			await tx.insert(settingsTable).values({ id: creatorId, prefix: "!", marketingOptIn: true, marketingOptInAt: new Date(), marketingOptInSource: "soft_opt_in_default", showOnCommunityPage: true, creatorPageEnabled: true, creatorPageVisibility: "discoverable", creatorPageShowBio: true }).onConflictDoNothing();
			await ensureReverseTrialGrantForUser(user, tx);
		}
		await tx.update(usersTable).set({ twitchCreatedAt, lastLogin: new Date(), onboardingPending: false }).where(eq(usersTable.id, creatorId));
	});
}

/** Runs during Twitch sign-in. A failed first sign-in can finish on the next one. */
export async function completeTwitchSignIn(creatorId: string) {
	const [creator] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, creatorId)).limit(1);
	// An explicitly linked Runner channel is an OAuth credential, not a new
	// Clipify identity. Its provider subject therefore has no creator row.
	if (!creator) return;
	const token = await getBetterAuthProviderAccessToken(creatorId);
	if (!token?.accessToken) throw new Error("ONBOARDING_TWITCH_TOKEN_UNAVAILABLE");
	const response = await fetch("https://api.twitch.tv/helix/users", { headers: { Authorization: `Bearer ${token.accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" }, signal: AbortSignal.timeout(10_000) });
	if (!response.ok) throw new Error(`ONBOARDING_TWITCH_PROFILE_${response.status}`);
	const profile = ((await response.json()) as { data?: Array<{ id: string; created_at?: string }> }).data?.find((entry) => entry.id === creatorId);
	const twitchCreatedAt = profile?.created_at ? new Date(profile.created_at) : null;
	if (!twitchCreatedAt || !Number.isFinite(twitchCreatedAt.getTime()) || twitchCreatedAt > new Date()) throw new Error("ONBOARDING_TWITCH_CREATED_AT_INVALID");
	await initializeCreator(creatorId, twitchCreatedAt);

	// Match the legacy callback's best-effort contact sync without blocking sign-in.
	try {
		const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.id, creatorId));
		if (settings?.marketingOptIn && settings.marketingOptInAt && settings.marketingOptInSource && !settings.useSendProductUpdatesContactId) {
			await db.transaction(async (tx) => {
				const [current] = await tx.select().from(settingsTable).where(eq(settingsTable.id, creatorId)).for("update");
				if (!current?.marketingOptIn || !current.marketingOptInAt || !current.marketingOptInSource || current.useSendProductUpdatesContactId) return;
				const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId));
				if (!user) return;
				const contactId = await syncProductUpdatesContact({ email: user.email, subscribed: true, userId: creatorId, username: user.username, source: current.marketingOptInSource === "soft_opt_in_default" ? "soft_opt_in" : "explicit_opt_in" });
				if (contactId) await tx.update(settingsTable).set({ useSendProductUpdatesContactId: contactId }).where(eq(settingsTable.id, creatorId));
			});
		}
	} catch (error) {
		console.error("[creator-onboarding] contact sync failed", error);
	}
}
