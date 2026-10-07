import "server-only";
import { sql } from "drizzle-orm";
import type { TransactionClient } from "@/db/client";
/** Browser and OAuth creation must serialize against the same owner budget. */
export async function lockGalleryCreationQuota(client: TransactionClient, creatorId: string) {
	await client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`clipify:free-gallery:${creatorId}`}, 0))`);
}
