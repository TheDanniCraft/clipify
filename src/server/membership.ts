import "server-only";

import { db } from "@/db/client";
import { userBadgesTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { BadgeSlug } from "@lib/badgeCatalog";

export async function awardBadgeInternal({ userId, badge, source, awardedBy }: { userId: string; badge: BadgeSlug; source: string; awardedBy?: string | null }) {
	const [award] = await db
		.insert(userBadgesTable)
		.values({ userId, badge, source, awardedBy: awardedBy ?? null })
		.onConflictDoNothing({ target: [userBadgesTable.userId, userBadgesTable.badge] })
		.returning()
		.execute();
	return award ?? null;
}

export async function revokeBadgeInternal(userId: string, badge: BadgeSlug) {
	const [revoked] = await db
		.delete(userBadgesTable)
		.where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badge, badge)))
		.returning()
		.execute();
	return revoked ?? null;
}
