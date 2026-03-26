/* istanbul ignore file */
"use server";

import { entitlementGrantsTable, editorsTable, overlaysTable, playlistClipsTable, playlistsTable, usersTable } from "@/db/schema";
import { db } from "@/db/client";
import { and, asc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { AuthenticatedUser, Entitlement, EntitlementGrantSource, MaxDurationMode, Plan, PlaybackMode, UserEntitlements } from "@types";

const PRO_ACCESS = Entitlement.ProAccess;
type CreateGrantInput = {
	userId?: string | null;
	source: EntitlementGrantSource;
	reason?: string | null;
	startsAt?: Date;
	endsAt?: Date | null;
};
const REVERSE_TRIAL_DAYS = 7;
type ActiveGrant = typeof entitlementGrantsTable.$inferSelect;
type EntitlementUserRef = Pick<AuthenticatedUser, "id" | "plan">;

function isHybridEntitlementsEnabled() {
	const raw = process.env.ENTITLEMENTS_HYBRID_ENABLED;
	if (raw == null) return true;
	return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export async function hasActiveProGrant(userId: string, now = new Date()) {
	if (!isHybridEntitlementsEnabled()) return false;
	const rows = await db
		.select()
		.from(entitlementGrantsTable)
		.where(and(eq(entitlementGrantsTable.entitlement, PRO_ACCESS), lte(entitlementGrantsTable.startsAt, now), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, now)), or(eq(entitlementGrantsTable.userId, userId), isNull(entitlementGrantsTable.userId))))
		.limit(1)
		.execute();

	return rows.length > 0;
}

export async function createProAccessGrant(input: CreateGrantInput) {
	const now = new Date();
	const [grant] = await db
		.insert(entitlementGrantsTable)
		.values({
			userId: input.userId ?? null,
			entitlement: PRO_ACCESS,
			source: input.source,
			reason: input.reason ?? null,
			startsAt: input.startsAt ?? now,
			endsAt: input.endsAt ?? null,
			createdAt: now,
			updatedAt: now,
		})
		.returning()
		.execute();
	return grant ?? null;
}

export async function ensureReverseTrialGrantForUser(user: Pick<AuthenticatedUser, "id" | "plan">) {
	if (user.plan !== Plan.Free) return { created: false as const };

	return db.transaction(async (tx) => {
		// Serialize reverse-trial grant creation per user to avoid race duplicates.
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`reverse_trial:${user.id}`}))`);

		const existing = await tx
			.select({ id: entitlementGrantsTable.id })
			.from(entitlementGrantsTable)
			.where(and(eq(entitlementGrantsTable.userId, user.id), eq(entitlementGrantsTable.entitlement, PRO_ACCESS), eq(entitlementGrantsTable.source, EntitlementGrantSource.ReverseTrial)))
			.limit(1)
			.execute();

		if (existing.length > 0) return { created: false as const };

		const startsAt = new Date();
		const endsAt = new Date(startsAt.getTime() + REVERSE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
		await tx
			.insert(entitlementGrantsTable)
			.values({
				userId: user.id,
				entitlement: PRO_ACCESS,
				source: EntitlementGrantSource.ReverseTrial,
				reason: "free_signup_trial",
				startsAt,
				endsAt,
				createdAt: startsAt,
				updatedAt: startsAt,
			})
			.execute();

		return { created: true as const };
	});
}

function pickBestGrant(grants: ActiveGrant[]) {
	if (grants.length === 0) return null;
	return grants.reduce((best, current) => {
		const bestEndsAt = best.endsAt;
		const currentEndsAt = current.endsAt;

		if (bestEndsAt == null && currentEndsAt == null) {
			return current.startsAt > best.startsAt ? current : best;
		}
		if (bestEndsAt == null) {
			return best;
		}
		if (currentEndsAt == null) {
			return current;
		}
		if (currentEndsAt.getTime() !== bestEndsAt.getTime()) {
			return currentEndsAt > bestEndsAt ? current : best;
		}
		return current.startsAt > best.startsAt ? current : best;
	});
}

export async function resolveUserEntitlements(user: EntitlementUserRef): Promise<UserEntitlements> {
	const now = new Date();
	const isBillingPro = user.plan === Plan.Pro;

	if (isBillingPro) {
		return {
			effectivePlan: "pro",
			isBillingPro: true,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: false,
			source: "billing",
		};
	}

	if (!isHybridEntitlementsEnabled()) {
		return {
			effectivePlan: "free",
			isBillingPro: false,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: false,
			source: "reverse_trial",
		};
	}

	const grants = await db
		.select()
		.from(entitlementGrantsTable)
		.where(and(eq(entitlementGrantsTable.entitlement, PRO_ACCESS), lte(entitlementGrantsTable.startsAt, now), or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, now)), or(eq(entitlementGrantsTable.userId, user.id), isNull(entitlementGrantsTable.userId))))
		.orderBy(asc(entitlementGrantsTable.userId), asc(entitlementGrantsTable.startsAt))
		.execute();

	const grant = pickBestGrant(grants);
	if (grant) {
		const isReverseTrialGrant = grant.source === EntitlementGrantSource.ReverseTrial;
		return {
			effectivePlan: "pro",
			isBillingPro: false,
			reverseTrialActive: isReverseTrialGrant,
			trialEndsAt: grant.endsAt ?? null,
			hasActiveGrant: true,
			grantSource: grant.source,
			source: isReverseTrialGrant ? "reverse_trial" : "grant",
		};
	}

	return {
		effectivePlan: "free",
		isBillingPro: false,
		reverseTrialActive: false,
		trialEndsAt: null,
		hasActiveGrant: false,
		source: "reverse_trial",
	};
}

export async function resolveUserEntitlementsForUsers(users: EntitlementUserRef[]): Promise<Map<string, UserEntitlements>> {
	const result = new Map<string, UserEntitlements>();
	if (users.length === 0) return result;

	const now = new Date();
	const freeUsers = users.filter((user) => user.plan !== Plan.Pro);

	for (const user of users) {
		if (user.plan === Plan.Pro) {
			result.set(user.id, {
				effectivePlan: "pro",
				isBillingPro: true,
				reverseTrialActive: false,
				trialEndsAt: null,
				hasActiveGrant: false,
				source: "billing",
			});
		}
	}

	if (freeUsers.length === 0) return result;

	if (!isHybridEntitlementsEnabled()) {
		for (const user of freeUsers) {
			result.set(user.id, {
				effectivePlan: "free",
				isBillingPro: false,
				reverseTrialActive: false,
				trialEndsAt: null,
				hasActiveGrant: false,
				source: "reverse_trial",
			});
		}
		return result;
	}

	const freeUserIds = freeUsers.map((user) => user.id);
	const grants = await db
		.select()
		.from(entitlementGrantsTable)
		.where(
			and(
				eq(entitlementGrantsTable.entitlement, PRO_ACCESS),
				lte(entitlementGrantsTable.startsAt, now),
				or(isNull(entitlementGrantsTable.endsAt), gt(entitlementGrantsTable.endsAt, now)),
				or(inArray(entitlementGrantsTable.userId, freeUserIds), isNull(entitlementGrantsTable.userId)),
			),
		)
		.orderBy(asc(entitlementGrantsTable.userId), asc(entitlementGrantsTable.startsAt))
		.execute();

	const grantByUserId = new Map<string, ActiveGrant[]>();
	for (const grant of grants) {
		const key = grant.userId ?? "__global__";
		let grantsForUser = grantByUserId.get(key);
		if (!grantsForUser) {
			grantsForUser = [];
			grantByUserId.set(key, grantsForUser);
		}
		grantsForUser.push(grant);
	}

	for (const user of freeUsers) {
		const grant = pickBestGrant([...(grantByUserId.get(user.id) ?? []), ...(grantByUserId.get("__global__") ?? [])]);
		if (grant) {
			const isReverseTrialGrant = grant.source === EntitlementGrantSource.ReverseTrial;
			result.set(user.id, {
				effectivePlan: "pro",
				isBillingPro: false,
				reverseTrialActive: isReverseTrialGrant,
				trialEndsAt: grant.endsAt ?? null,
				hasActiveGrant: true,
				grantSource: grant.source,
				source: isReverseTrialGrant ? "reverse_trial" : "grant",
			});
			continue;
		}

		result.set(user.id, {
			effectivePlan: "free",
			isBillingPro: false,
			reverseTrialActive: false,
			trialEndsAt: null,
			hasActiveGrant: false,
			source: "reverse_trial",
		});
	}

	return result;
}

export async function reconcileFreeConstraintsIfNeeded(user: EntitlementUserRef, entitlements: UserEntitlements) {
	if (!isHybridEntitlementsEnabled()) return;
	if (user.plan !== Plan.Free || entitlements.effectivePlan !== "free") return;

	await db.transaction(async (tx) => {
		const overlays = await tx.select().from(overlaysTable).where(eq(overlaysTable.ownerId, user.id)).orderBy(asc(overlaysTable.createdAt)).execute();
		const removed = overlays.slice(1).map((overlay) => overlay.id);

		if (removed.length > 0) {
			await tx.delete(overlaysTable).where(inArray(overlaysTable.id, removed)).execute();
		}

		const keptOverlay = overlays[0];
		if (keptOverlay) {
			await tx
				.update(overlaysTable)
				.set({
					updatedAt: new Date(),
					rewardId: null,
					playlistId: null,
					blacklistWords: [],
					minClipViews: 0,
					minClipDuration: 0,
					maxClipDuration: 60,
					maxDurationMode: MaxDurationMode.Filter,
					playbackMode: PlaybackMode.Random,
					preferCurrentCategory: false,
					clipCreatorsOnly: [],
					clipCreatorsBlocked: [],
					clipPackSize: 100,
					playerVolume: 50,
					showChannelInfo: true,
					showClipInfo: true,
					showTimer: false,
					showProgressBar: false,
					overlayInfoFadeOutSeconds: 6,
					themeFontFamily: "inherit",
					themeTextColor: "#FFFFFF",
					themeAccentColor: "#7C3AED",
					themeBackgroundColor: "rgba(10,10,10,0.65)",
					progressBarStartColor: "#26018E",
					progressBarEndColor: "#8D42F9",
					borderSize: 0,
					borderRadius: 10,
					effectScanlines: false,
					effectStatic: false,
					effectCrt: false,
					channelInfoX: 0,
					channelInfoY: 0,
					clipInfoX: 100,
					clipInfoY: 100,
					timerX: 100,
					timerY: 0,
					channelScale: 100,
					clipScale: 100,
					timerScale: 100,
				})
				.where(eq(overlaysTable.id, keptOverlay.id))
				.execute();
		}

		await tx.delete(editorsTable).where(eq(editorsTable.userId, user.id)).execute();

		const playlists = await tx.select().from(playlistsTable).where(eq(playlistsTable.ownerId, user.id)).orderBy(asc(playlistsTable.createdAt)).execute();
		const removedPlaylists = playlists.slice(1).map((playlist) => playlist.id);
		if (removedPlaylists.length > 0) {
			await tx.delete(playlistsTable).where(inArray(playlistsTable.id, removedPlaylists)).execute();
		}
		const keptPlaylist = playlists[0];
		if (keptPlaylist) {
			const clips = await tx.select().from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, keptPlaylist.id)).orderBy(asc(playlistClipsTable.position)).execute();
			const removeClipIds = clips.slice(50).map((clip) => clip.clipId);
			if (removeClipIds.length > 0) {
				await tx.delete(playlistClipsTable).where(and(eq(playlistClipsTable.playlistId, keptPlaylist.id), inArray(playlistClipsTable.clipId, removeClipIds))).execute();
			}
		}

		const now = new Date();
		await tx
			.update(usersTable)
			.set({
				updatedAt: now,
				lastEntitlementReconciledAt: now,
			})
			.where(eq(usersTable.id, user.id))
			.execute();
	});
}

export async function reconcileRevokedUsersBatch(batchSize = 100, reconciliationCooldownHours = 6) {
	if (!isHybridEntitlementsEnabled()) {
		return { candidates: 0, reconciled: 0 };
	}

	const lockKey = "entitlements_reconcile_batch";
	const lockResult = (await db.execute(sql`select pg_try_advisory_lock(hashtext(${lockKey})) as locked`)) as unknown as { rows?: Array<{ locked?: boolean }> };
	const locked = Boolean(lockResult.rows?.[0]?.locked);
	if (!locked) {
		return { candidates: 0, reconciled: 0 };
	}

	try {
		const now = new Date();
		const reconciliationCutoff = new Date(now.getTime() - reconciliationCooldownHours * 60 * 60 * 1000);

		const candidates = await db
			.select()
			.from(usersTable)
			.where(and(eq(usersTable.plan, Plan.Free), or(isNull(usersTable.lastEntitlementReconciledAt), lt(usersTable.lastEntitlementReconciledAt, reconciliationCutoff))))
			.orderBy(asc(usersTable.createdAt))
			.limit(batchSize)
			.execute();

		const entitlementsByUserId = await resolveUserEntitlementsForUsers(candidates);
		let reconciled = 0;
		for (const user of candidates) {
			const entitlements = entitlementsByUserId.get(user.id) ?? {
				effectivePlan: "free" as const,
				isBillingPro: false,
				reverseTrialActive: false,
				trialEndsAt: null,
				hasActiveGrant: false,
				source: "reverse_trial" as const,
			};
			if (entitlements.effectivePlan !== "free") {
				await db
					.update(usersTable)
					.set({
						updatedAt: new Date(),
						lastEntitlementReconciledAt: new Date(),
					})
					.where(eq(usersTable.id, user.id))
					.execute();
				continue;
			}
			await reconcileFreeConstraintsIfNeeded(user, entitlements);
			reconciled += 1;
		}

		console.info("[entitlements] batch_reconcile_complete", {
			candidates: candidates.length,
			reconciled,
		});

		return { candidates: candidates.length, reconciled };
	} finally {
		await db.execute(sql`select pg_advisory_unlock(hashtext(${lockKey}))`);
	}
}
