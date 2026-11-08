import type { QueryClient } from "@/db/client";
import { twitchCacheTable } from "@/db/schema";
import { cacheHealthCounts } from "./health-counts";

async function queryCacheHealthCounts(db: QueryClient, now: Date) {
	return db
		.select({ type: twitchCacheTable.type, ...cacheHealthCounts(now) })
		.from(twitchCacheTable)
		.groupBy(twitchCacheTable.type)
		.execute();
}

// Cache only the expensive cache inventory; liveness and job health remain fresh.
let sample: { expiresAt: number; rows: Awaited<ReturnType<typeof queryCacheHealthCounts>> } | undefined;
let pending: ReturnType<typeof queryCacheHealthCounts> | undefined;
export async function getCacheHealthCounts(db: QueryClient, now: Date) {
	if (sample && sample.expiresAt > Date.now()) return sample.rows;
	if (!pending)
		pending = queryCacheHealthCounts(db, now)
			.then((rows) => {
				sample = { rows, expiresAt: Date.now() + 30000 };
				return rows;
			})
			.finally(() => {
				pending = undefined;
			});
	return pending;
}
