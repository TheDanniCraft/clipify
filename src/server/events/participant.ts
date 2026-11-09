import "server-only";
import { and, eq } from "drizzle-orm";
import { getAuthSession } from "@/auth/session";
import { db } from "@/db/client";
import { account } from "@/db/auth-schema";
export async function getEventParticipant() {
	const session = await getAuthSession();
	if (!session?.session.userId) return null;
	const [twitch] = await db
		.select({ accountId: account.accountId })
		.from(account)
		.where(and(eq(account.userId, session.session.userId), eq(account.providerId, "twitch")))
		.limit(1);
	return twitch ? { authUserId: session.session.userId, twitchId: twitch.accountId } : null;
}
