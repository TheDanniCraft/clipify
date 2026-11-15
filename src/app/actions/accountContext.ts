"use server";

import { eq } from "drizzle-orm";
import { getAuthActorContext } from "@/auth/session";
import { db } from "@/db/client";
import { creatorAccountsTable } from "@/db/schema";

/** Reflect the backend's implicit personal context; never select or mutate a workspace. */
export async function getDefaultAccountContext(): Promise<string | null> {
	const actor = await getAuthActorContext();
	if (!actor || actor.activeOrganizationId || actor.accountStatus === "suspended" || actor.accountStatus === "purge_eligible") return null;
	const [account] = await db.select({ organizationId: creatorAccountsTable.organizationId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, actor.creatorId)).limit(1);
	return account?.organizationId ?? null;
}
