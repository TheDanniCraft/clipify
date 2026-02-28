"use server";

import { entitlementGrantsTable, editorsTable, overlaysTable, usersTable } from "@/db/schema";
import { and, asc, eq, gt, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { AuthenticatedUser, Plan, UserEntitlements } from "@types";

const db = drizzle(process.env.DATABASE_URL!);

const PRO_ACCESS = "pro_access";
type CreateGrantInput = {
	userId?: string | null;
	source: string;
	reason?: string | null;
	startsAt?: Date;
	endsAt?: Date | null;
};
const REVERSE_TRIAL_DAYS = 7;

function isHybridEntitlementsEnabled() {
	const raw = process.env.ENTITLEMENTS_HYBRID_ENABLED;
	if (raw == null) return process.env.NODE_ENV !== "production";
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
	if (!isHybridEntitlementsEnabled()) return { created: false as const };
	if (user.plan !== Plan.Free) return { created: false as const };

	const existing = await db
		.select({ id: entitlementGrantsTable.id })
		.from(entitlementGrantsTable)
		.where(and(eq(entitlementGrantsTable.userId, user.id), eq(entitlementGrantsTable.entitlement, PRO_ACCESS), eq(entitlementGrantsTable.source, "reverse_trial")))
		.limit(1)
		.execute();

	if (existing.length > 0) return { created: false as const };

	const startsAt = new Date();
	const endsAt = new Date(startsAt.getTime() + REVERSE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
	await createProAccessGrant({
		userId: user.id,
		source: "reverse_trial",
		reason: "free_signup_trial",
		startsAt,
		endsAt,
	});
	return { created: true as const };
}

export async function resolveUserEntitlements(user: AuthenticatedUser): Promise<UserEntitlements> {
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

	const userSpecific = grants.find((grant) => grant.userId === user.id);
	const globalGrant = grants.find((grant) => grant.userId === null);
	const grant = userSpecific ?? globalGrant;
	if (grant) {
		const isReverseTrialGrant = grant.source === "reverse_trial";
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

export async function reconcileFreeConstraintsIfNeeded(user: AuthenticatedUser, entitlements: UserEntitlements) {
	if (!isHybridEntitlementsEnabled()) return;
	if (user.plan !== Plan.Free || entitlements.effectivePlan !== "free") return;

	const overlays = await db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, user.id)).orderBy(asc(overlaysTable.createdAt)).execute();
	const removed = overlays.slice(1).map((overlay) => overlay.id);

	if (removed.length > 0) {
		await db.delete(overlaysTable).where(inArray(overlaysTable.id, removed)).execute();
	}

	const keptOverlay = overlays[0];
	if (keptOverlay) {
		await db
			.update(overlaysTable)
			.set({
				rewardId: null,
				blacklistWords: [],
				minClipViews: 0,
				minClipDuration: 0,
				maxClipDuration: 60,
			})
			.where(eq(overlaysTable.id, keptOverlay.id))
			.execute();
	}

	await db.delete(editorsTable).where(eq(editorsTable.userId, user.id)).execute();
	await db
		.update(usersTable)
		.set({
			updatedAt: new Date(),
			lastEntitlementReconciledAt: new Date(),
		})
		.where(eq(usersTable.id, user.id))
		.execute();

}

export async function reconcileRevokedUsersBatch(batchSize = 100, reconciliationCooldownHours = 6) {
	if (!isHybridEntitlementsEnabled()) {
		return { candidates: 0, reconciled: 0 };
	}

	const now = new Date();
	const reconciliationCutoff = new Date(now.getTime() - reconciliationCooldownHours * 60 * 60 * 1000);

	const candidates = await db
		.select()
		.from(usersTable)
		.where(and(eq(usersTable.plan, Plan.Free), or(isNull(usersTable.lastEntitlementReconciledAt), lt(usersTable.lastEntitlementReconciledAt, reconciliationCutoff))))
		.orderBy(asc(usersTable.createdAt))
		.limit(batchSize)
		.execute();

	let reconciled = 0;
	for (const user of candidates) {
		const entitlements = await resolveUserEntitlements(user as AuthenticatedUser);
		if (entitlements.effectivePlan !== "free") {
			continue;
		}
		await reconcileFreeConstraintsIfNeeded(user as AuthenticatedUser, entitlements);
		reconciled += 1;
	}

	console.info("[entitlements] batch_reconcile_complete", {
		candidates: candidates.length,
		reconciled,
	});

	return { candidates: candidates.length, reconciled };
}
