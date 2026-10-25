import "server-only";

import { db } from "@/db/client";
import { modQueueTable, queueTable } from "@/db/schema";

export async function addVerifiedRewardClipToQueue(overlayId: string, clipId: string) {
	await db.insert(queueTable).values({ overlayId, clipId }).execute();
}

export async function addVerifiedChatClipToModQueue(broadcasterId: string, clipId: string) {
	await db.insert(modQueueTable).values({ broadcasterId, clipId }).execute();
}
