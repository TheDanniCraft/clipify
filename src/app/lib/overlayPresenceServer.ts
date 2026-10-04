import "server-only";

import { and, eq, gt, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { twitchCacheTable } from "@/db/schema";
import { TwitchCacheType } from "@types";
import { OVERLAY_PRESENCE_CACHE_PREFIX, OVERLAY_PRESENCE_TTL_MS } from "./overlayPresence";

export type OverlayPresenceReport = { overlayId: string; instanceId: string; sequence: number; active: boolean };

export async function recordOverlayPresence(report: OverlayPresenceReport): Promise<void> {
	const now = new Date();
	const entry = {
		type: TwitchCacheType.User,
		key: `${OVERLAY_PRESENCE_CACHE_PREFIX}${report.overlayId}:${report.instanceId}`,
		value: JSON.stringify(report),
		fetchedAt: now,
		expiresAt: new Date(now.getTime() + OVERLAY_PRESENCE_TTL_MS),
	};
	// Keep inactive entries briefly as tombstones for out-of-order requests. Existing
	// cache cleanup removes expired entries; each browser instance has its own row.
	await db
		.insert(twitchCacheTable)
		.values(entry)
		.onConflictDoUpdate({
			target: [twitchCacheTable.type, twitchCacheTable.key],
			set: { value: entry.value, fetchedAt: now, expiresAt: entry.expiresAt },
			setWhere: sql`(${twitchCacheTable.value}::jsonb->>'sequence')::bigint < ${report.sequence}`,
		})
		.execute();
}

export async function fetchActiveOverlayIds(): Promise<Set<string>> {
	try {
		const rows = await db
			.select({ value: twitchCacheTable.value })
			.from(twitchCacheTable)
			.where(and(eq(twitchCacheTable.type, TwitchCacheType.User), like(twitchCacheTable.key, `${OVERLAY_PRESENCE_CACHE_PREFIX}%`), gt(twitchCacheTable.expiresAt, new Date())))
			.execute();
		const ids = new Set<string>();
		for (const row of rows) {
			try {
				const report = JSON.parse(row.value) as OverlayPresenceReport;
				if (report.active === true && typeof report.overlayId === "string") ids.add(report.overlayId);
			} catch {
				/* Ignore malformed cache entries. */
			}
		}
		return ids;
	} catch (error) {
		console.error("[community] failed to read overlay presence", error);
		return new Set<string>();
	}
}
