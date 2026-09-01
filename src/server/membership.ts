import "server-only";

import { db } from "@/db/client";
import { badgesTable, userBadgesTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type BadgeDefinitionInput = {
	slug: string;
	name: string;
	description: string;
	icon?: string | null;
	priority?: number;
};

export async function upsertBadgeDefinitionInternal(input: BadgeDefinitionInput) {
	const [badge] = await db
		.insert(badgesTable)
		.values({
			slug: input.slug,
			name: input.name,
			description: input.description,
			icon: input.icon ?? null,
			priority: input.priority ?? 0,
		})
		.onConflictDoUpdate({
			target: badgesTable.slug,
			set: {
				name: input.name,
				description: input.description,
				icon: input.icon ?? null,
				priority: input.priority ?? 0,
			},
		})
		.returning()
		.execute();
	return badge;
}

export async function awardBadgeInternal({ userId, badgeSlug, source, awardedBy }: { userId: string; badgeSlug: string; source: string; awardedBy?: string | null }) {
	const [award] = await db
		.insert(userBadgesTable)
		.values({ userId, badgeSlug, source, awardedBy: awardedBy ?? null })
		.onConflictDoNothing({ target: [userBadgesTable.userId, userBadgesTable.badgeSlug] })
		.returning()
		.execute();
	return award ?? null;
}

export async function revokeBadgeInternal(userId: string, badgeSlug: string) {
	const [revoked] = await db
		.delete(userBadgesTable)
		.where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeSlug, badgeSlug)))
		.returning()
		.execute();
	return revoked ?? null;
}
