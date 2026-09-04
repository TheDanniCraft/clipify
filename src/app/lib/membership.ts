import "server-only";

import { db } from "@/db/client";
import { userBadgesTable, usersTable } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { isMemberCardId } from "@lib/memberCardLinks";
import { memberCardIdExpression, memberCardIdForUser } from "@/server/memberCardId";
import { badgeCatalog, type BadgeIconKey, type BadgeSlug } from "@lib/badgeCatalog";
import { resolveAutomaticBadgeAwards } from "@/server/membership";

export type MemberBadgeView = {
	slug: BadgeSlug;
	name: string;
	description: string;
	icon: BadgeIconKey;
	priority: number;
	awardedAt: Date;
};

export type MemberProfile = {
	cardId: string;
	avatar: string;
	username: string;
	memberNumber: number | null;
	joinedAt: Date;
	badges: MemberBadgeView[];
};

export async function getMemberBadges(userId: string): Promise<MemberBadgeView[]> {
	const [storedAwards, automaticAwards] = await Promise.all([
		db
			.select({
				slug: userBadgesTable.badge,
				awardedAt: userBadgesTable.awardedAt,
			})
			.from(userBadgesTable)
			.where(eq(userBadgesTable.userId, userId))
			.orderBy(asc(userBadgesTable.awardedAt))
			.execute(),
		resolveAutomaticBadgeAwards(userId),
	]);
	const awards = [...storedAwards.filter((award) => !("condition" in badgeCatalog[award.slug])), ...automaticAwards];
	return awards
		.map((award) => {
			const definition = badgeCatalog[award.slug];
			return { slug: award.slug, name: definition.name, description: definition.description, icon: definition.icon, priority: definition.priority, awardedAt: award.awardedAt };
		})
		.sort((left, right) => badgeCatalog[right.slug].priority - badgeCatalog[left.slug].priority || left.awardedAt.getTime() - right.awardedAt.getTime());
}

export async function getMemberProfile(userId: string): Promise<MemberProfile | null> {
	const [member] = await db
		.select({
			username: usersTable.username,
			avatar: usersTable.avatar,
			memberNumber: usersTable.memberNumber,
			joinedAt: usersTable.createdAt,
		})
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1)
		.execute();

	if (!member) return null;

	const badges = await getMemberBadges(userId);

	return { ...member, cardId: memberCardIdForUser(userId), badges };
}

export async function getPublicMemberProfile(cardId: string): Promise<MemberProfile | null> {
	if (!isMemberCardId(cardId)) return null;
	const [member] = await db
		.select({
			id: usersTable.id,
			avatar: usersTable.avatar,
			username: usersTable.username,
			memberNumber: usersTable.memberNumber,
			joinedAt: usersTable.createdAt,
		})
		.from(usersTable)
		.where(and(eq(memberCardIdExpression(usersTable.id), cardId), eq(usersTable.disabled, false)))
		.limit(1)
		.execute();

	if (!member) return null;
	const badges = await getMemberBadges(member.id);
	return { cardId: memberCardIdForUser(member.id), avatar: member.avatar, username: member.username, memberNumber: member.memberNumber, joinedAt: member.joinedAt, badges };
}
