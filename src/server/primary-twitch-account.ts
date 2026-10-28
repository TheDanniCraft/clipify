import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { creatorIdentityLinksTable } from "@/db/schema";

export async function isPrimaryTwitchAccount(account: { userId: string; providerId: string; accountId: string }) {
	if (account.providerId !== "twitch") return false;
	const [link] = await db
		.select({ creatorId: creatorIdentityLinksTable.creatorId })
		.from(creatorIdentityLinksTable)
		.where(and(eq(creatorIdentityLinksTable.authUserId, account.userId), eq(creatorIdentityLinksTable.creatorId, account.accountId)))
		.limit(1);
	return Boolean(link);
}
