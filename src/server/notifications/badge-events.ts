import { eq } from "drizzle-orm";
import { db, type QueryClient } from "@/db/client";
import { notificationOutboxTable, usersTable } from "@/db/schema";
import { badgeCatalog, isBadgeSlug } from "@lib/badgeCatalog";
export async function queueBadgeEmail(award: { userId: string; badge: string; awardedAt: Date }, event: "awarded" | "removed", client: QueryClient = db) {
	if (!isBadgeSlug(award.badge)) throw new Error("UNKNOWN_BADGE");
	const [user] = await client.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, award.userId)).limit(1).execute();
	if (!user?.email) return;
	await client
		.insert(notificationOutboxTable)
		.values({ eventType: "badge", recipient: user.email, templateVersion: "badge-v1", locale: "en", payload: { type: "badge", badge: award.badge, event, name: badgeCatalog[award.badge].name, description: badgeCatalog[award.badge].description, userId: award.userId }, scheduledAt: new Date(), dedupeKey: `badge:${award.userId}:${award.badge}:${award.awardedAt.toISOString()}:${event}` })
		.onConflictDoNothing({ target: notificationOutboxTable.dedupeKey });
}
