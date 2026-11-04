"use server";
import { getAuthSession } from "@/auth/session";
import { db } from "@/db/client";
import { creatorIdentityLinksTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTwitchCache, setTwitchCache } from "@actions/database";
import { getCreatorTwitchDetails } from "@actions/twitch";
import { tryRateLimit } from "@actions/rateLimit";
import { TwitchCacheType } from "@types";

/** Presence belongs to the signed-in identity, even while managing another creator. */
export async function getOwnTwitchPresence(): Promise<boolean | null> {
	const session = await getAuthSession();
	if (!session) return null;
	try {
		const [own] = await db.select({ creatorId: creatorIdentityLinksTable.creatorId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.authUserId, session.user.id)).limit(1);
		if (!own) return false;
		const key = `dashboard-live:${own.creatorId}`;
		const cached = await getTwitchCache<{ live: boolean }>(TwitchCacheType.User, key);
		if (typeof cached?.live === "boolean") return cached.live;
		if (!(await tryRateLimit({ key: "dashboard-live", identifier: own.creatorId, points: 2, duration: 30 })).success) return null;
		const { live } = await getCreatorTwitchDetails("", own.creatorId);
		await setTwitchCache(TwitchCacheType.User, key, { live: Boolean(live) }, 30);
		return Boolean(live);
	} catch {
		return null;
	}
}
