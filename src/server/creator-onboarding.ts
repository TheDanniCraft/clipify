import "server-only";

import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { creatorOnboardingJobsTable as jobs, usersTable, settingsTable } from "@/db/schema";
import { allocateMemberNumber } from "./memberNumbers";
import { ensureReverseTrialGrantForUser } from "@/app/lib/entitlements";
import { getBetterAuthProviderAccessToken } from "./provider-credentials";
import { syncProductUpdatesContact } from "@/app/actions/newsletter";

const pending = or(isNull(jobs.initializedAt), isNull(jobs.profileSyncedAt), isNull(jobs.contactSyncedAt));

/** The durable job is created by the account trigger, never inferred from a login. */
export async function initializeCreator(creatorId: string) {
	await db.transaction(async (tx) => {
		const [job] = await tx.select().from(jobs).where(eq(jobs.creatorId, creatorId)).for("update");
		if (!job || job.initializedAt) return;
		const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId)).for("update");
		if (!user) throw new Error("ONBOARDING_CREATOR_MISSING");
		if (user.memberNumber == null)
			await tx
				.update(usersTable)
				.set({ memberNumber: await allocateMemberNumber(tx) })
				.where(eq(usersTable.id, creatorId));
		await tx.insert(settingsTable).values({ id: creatorId, prefix: "!", marketingOptIn: true, marketingOptInAt: job.createdAt, marketingOptInSource: "soft_opt_in_default", showOnCommunityPage: true, creatorPageEnabled: true, creatorPageVisibility: "discoverable", creatorPageShowBio: true }).onConflictDoNothing();
		// Reuse the resolver's trial policy and transactional notification outbox.
		await ensureReverseTrialGrantForUser(user, tx);
		await tx.update(jobs).set({ initializedAt: new Date() }).where(eq(jobs.creatorId, creatorId));
	});
}

export async function processCreatorOnboarding(creatorId: string) {
	// A lease survives crashes. Another process can retry after five minutes.
	const [job] = await db
		.update(jobs)
		.set({ nextAttemptAt: new Date(Date.now() + 300_000), attempts: sql`${jobs.attempts} + 1` })
		.where(and(eq(jobs.creatorId, creatorId), pending, lte(jobs.nextAttemptAt, new Date())))
		.returning();
	if (!job) return;
	try {
		await initializeCreator(creatorId);
		// External services must not roll back mandatory account initialization.
		const results = await Promise.allSettled([
			(async () => {
				if (job.profileSyncedAt) return;
				const token = await getBetterAuthProviderAccessToken(creatorId);
				if (!token?.accessToken) throw new Error("ONBOARDING_TWITCH_TOKEN_UNAVAILABLE");
				const response = await fetch("https://api.twitch.tv/helix/users", { headers: { Authorization: `Bearer ${token.accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" }, signal: AbortSignal.timeout(10_000) });
				if (!response.ok) throw new Error(`ONBOARDING_TWITCH_PROFILE_${response.status}`);
				const profile = ((await response.json()) as { data?: Array<{ id: string; created_at?: string }> }).data?.find((entry) => entry.id === creatorId);
				const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
				if (!createdAt || !Number.isFinite(createdAt.getTime()) || createdAt > new Date()) throw new Error("ONBOARDING_TWITCH_CREATED_AT_INVALID");
				await db.transaction(async (tx) => {
					await tx.update(usersTable).set({ twitchCreatedAt: createdAt }).where(eq(usersTable.id, creatorId));
					await tx.update(jobs).set({ profileSyncedAt: new Date() }).where(eq(jobs.creatorId, creatorId));
				});
			})(),
			(async () => {
				if (job.contactSyncedAt) return;
				// Serialize against settings edits so an opt-out cannot race subscription.
				await db.transaction(async (tx) => {
					const [settings] = await tx.select().from(settingsTable).where(eq(settingsTable.id, creatorId)).for("update");
					const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId));
					if (!settings || !user) throw new Error("ONBOARDING_SETTINGS_MISSING");
					if (settings.marketingOptIn && settings.marketingOptInAt && settings.marketingOptInSource && !settings.useSendProductUpdatesContactId) {
						const contactId = await syncProductUpdatesContact({ email: user.email, subscribed: true, userId: creatorId, username: user.username, source: settings.marketingOptInSource === "soft_opt_in_default" ? "soft_opt_in" : "explicit_opt_in" });
						if (!contactId) throw new Error("ONBOARDING_CONTACT_SYNC_PENDING");
						await tx.update(settingsTable).set({ useSendProductUpdatesContactId: contactId }).where(eq(settingsTable.id, creatorId));
					}
					await tx.update(jobs).set({ contactSyncedAt: new Date() }).where(eq(jobs.creatorId, creatorId));
				});
			})(),
		]);
		for (const result of results) if (result.status === "rejected") console.error("[creator-onboarding] enrichment pending", { creatorId, error: result.reason });
	} catch (error) {
		console.error("[creator-onboarding] initialization pending", { creatorId, error });
	}
}

export async function retryCreatorOnboarding() {
	const batch = await db
		.select({ creatorId: jobs.creatorId })
		.from(jobs)
		.where(and(pending, lte(jobs.nextAttemptAt, new Date())))
		.orderBy(jobs.nextAttemptAt)
		.limit(25);
	for (const job of batch) await processCreatorOnboarding(job.creatorId);
}
