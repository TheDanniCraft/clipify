"use server";

import { getOverlayRuntimeAccessInternal } from "@/server/overlays";
import { recordProductOutcome } from "@/server/product-outcomes";
import { db } from "@/db/client";

export async function recordOverlayPlayback(overlayId: string, secret: string) {
	if (typeof overlayId !== "string" || overlayId.length > 100 || typeof secret !== "string" || secret.length > 200 || !secret || overlayId === process.env.DEMO_OVERLAY_ID) return { recorded: false };
	const access = await getOverlayRuntimeAccessInternal(overlayId, "websocket", secret);
	if (!access.allowed) return { recorded: false };
	const now = new Date();
	await db.transaction(async (tx) => {
		await recordProductOutcome({ outcome: "first_playback", creatorId: access.overlay.ownerId, key: "first", occurredAt: now }, tx);
		await recordProductOutcome({ outcome: "playback_day", creatorId: access.overlay.ownerId, key: now.toISOString().slice(0, 10), occurredAt: now }, tx);
	});
	return { recorded: true };
}
