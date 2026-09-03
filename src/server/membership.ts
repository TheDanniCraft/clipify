import "server-only";

import { db } from "@/db/client";
import { badgesTable, userBadgesTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { badgeCatalog, type BadgeSlug } from "@lib/badgeCatalog";

export async function syncBadgeDefinitionInternal(slug: BadgeSlug) {
	const definition = badgeCatalog[slug];
	const [badge] = await db
		.insert(badgesTable)
		.values({
			slug,
			...definition,
		})
		.onConflictDoUpdate({
			target: badgesTable.slug,
			set: {
				...definition,
			},
		})
		.returning()
		.execute();
	return badge;
}

export async function awardBadgeInternal({ userId, badgeSlug, source, awardedBy }: { userId: string; badgeSlug: BadgeSlug; source: string; awardedBy?: string | null }) {
	await syncBadgeDefinitionInternal(badgeSlug);
	const [award] = await db
		.insert(userBadgesTable)
		.values({ userId, badgeSlug, source, awardedBy: awardedBy ?? null })
		.onConflictDoNothing({ target: [userBadgesTable.userId, userBadgesTable.badgeSlug] })
		.returning()
		.execute();
	return award ?? null;
}

export async function revokeBadgeInternal(userId: string, badgeSlug: BadgeSlug) {
	const [revoked] = await db
		.delete(userBadgesTable)
		.where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeSlug, badgeSlug)))
		.returning()
		.execute();
	return revoked ?? null;
}
