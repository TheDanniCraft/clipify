import "server-only";

import { db } from "@/db/client";
import { badgesTable, userBadgesTable, usersTable } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { isMemberCardId } from "@lib/memberCardLinks";
import { memberCardIdExpression, memberCardIdForUser } from "@/server/memberCardId";

export type MemberBadgeView = {
	slug: string;
	name: string;
	description: string;
	icon: string | null;
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
	return db
		.select({
			slug: badgesTable.slug,
			name: badgesTable.name,
			description: badgesTable.description,
			icon: badgesTable.icon,
			awardedAt: userBadgesTable.awardedAt,
		})
		.from(userBadgesTable)
		.innerJoin(badgesTable, eq(userBadgesTable.badgeSlug, badgesTable.slug))
		.where(eq(userBadgesTable.userId, userId))
		.orderBy(desc(badgesTable.priority), asc(userBadgesTable.awardedAt))
		.execute();
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
