import "server-only";

import { db } from "@/db/client";
import { userBadgesTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { badgeCatalog, type AutomaticBadgeSlug, type BadgeCondition, type BadgeSlug, type ManualBadgeSlug } from "@lib/badgeCatalog";
import { getActivePartnerAccessGrant } from "@lib/entitlements";

type AutomaticBadgeResolver = (userId: string) => Promise<Date | null>;

const automaticBadgeResolvers: Record<BadgeCondition, AutomaticBadgeResolver> = {
	"active-partner-grant": async (userId) => (await getActivePartnerAccessGrant(userId))?.startsAt ?? null,
};

export async function resolveAutomaticBadgeAwards(userId: string) {
	const awards = await Promise.all(
		(Object.entries(badgeCatalog) as [BadgeSlug, (typeof badgeCatalog)[BadgeSlug]][]).map(async ([slug, definition]) => {
			if (!("condition" in definition)) return null;
			const awardedAt = await automaticBadgeResolvers[definition.condition](userId);
			return awardedAt ? { slug, awardedAt } : null;
		}),
	);
	return awards.filter((award): award is { slug: AutomaticBadgeSlug; awardedAt: Date } => award !== null);
}

export async function awardBadgeInternal({ userId, badge, source, awardedBy }: { userId: string; badge: ManualBadgeSlug; source: string; awardedBy?: string | null }) {
	const [award] = await db
		.insert(userBadgesTable)
		.values({ userId, badge, source, awardedBy: awardedBy ?? null })
		.onConflictDoNothing({ target: [userBadgesTable.userId, userBadgesTable.badge] })
		.returning()
		.execute();
	return award ?? null;
}

export async function revokeBadgeInternal(userId: string, badge: ManualBadgeSlug) {
	const [revoked] = await db
		.delete(userBadgesTable)
		.where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badge, badge)))
		.returning()
		.execute();
	return revoked ?? null;
}
