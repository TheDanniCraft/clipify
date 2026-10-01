import "server-only";

import { db, dbPool } from "@/db/client";
import { account as authAccountTable } from "@/db/auth-schema";
import { creatorIdentityLinksTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

export async function withSerializedProviderCredential<T>(pool: Pool, accountId: string, operation: () => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [`clipify:twitch:${accountId}`]);
		return await operation();
	} finally {
		await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [`clipify:twitch:${accountId}`]).catch(() => undefined);
		client.release();
	}
}

export async function getBetterAuthProviderAccessToken(creatorId: string) {
	const links = await db.select({ authUserId: creatorIdentityLinksTable.authUserId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.creatorId, creatorId)).limit(1).execute();
	const authUserId = links[0]?.authUserId;
	if (!authUserId) return null;
	const accounts = await db
		.select({ id: authAccountTable.id })
		.from(authAccountTable)
		.where(and(eq(authAccountTable.userId, authUserId), eq(authAccountTable.providerId, "twitch")))
		.limit(1)
		.execute();
	const accountId = accounts[0]?.id;
	if (!accountId) return null;

	return withSerializedProviderCredential(dbPool, accountId, async () => {
		const { auth } = await import("@/auth/config");
		return auth.api.getAccessToken({ body: { accountId, userId: authUserId } });
	});
}
