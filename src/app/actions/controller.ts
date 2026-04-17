"use server";

import { addToModQueue, clearClipQueueByOverlayIdServer, clearModQueueByBroadcasterId, getClipQueueByOverlayId, getModQueue, getOverlayOwnerPlanPublic, getOverlayWithEditAccess, getTwitchCache, setPlayerVolumeForOwner } from "@actions/database";
import { getTwitchClip, handleClip } from "@actions/twitch";
import { sendMessage } from "@actions/websocket";
import { Plan, TwitchCacheType, type TwitchClip } from "@types";

export type QueueItem = {
	id: string;
	clipId: string;
	title: string;
	creatorName: string;
	duration: number;
	thumbnailUrl: string | null;
};

export type ControllerQueueResponse = {
	overlayId: string;
	modQueue: QueueItem[];
	viewerQueue: QueueItem[];
};

export type ControllerActionResult =
	| { ok: true; volume?: number; clip?: Omit<QueueItem, "id"> }
	| { ok: false; error: string; status: number };

async function requireProOverlay(overlayId: string) {
	const overlay = await getOverlayWithEditAccess(overlayId);
	if (!overlay) return { error: { ok: false as const, error: "Unauthorized", status: 403 } };

	const ownerPlan = await getOverlayOwnerPlanPublic(overlayId);
	if (ownerPlan !== Plan.Pro) {
		return { error: { ok: false as const, error: "Remote controller is a Pro feature", status: 403 } };
	}

	return { overlay };
}

function parseStoredClip(value: unknown): TwitchClip | null {
	if (!value || typeof value !== "object") return null;
	if ("clip" in (value as { clip?: unknown }) && (value as { clip?: unknown }).clip) {
		const nested = (value as { clip?: unknown }).clip;
		if (nested && typeof nested === "object" && "id" in (nested as Record<string, unknown>)) return nested as TwitchClip;
	}
	if ("id" in (value as Record<string, unknown>) && typeof (value as Record<string, unknown>).id === "string") return value as TwitchClip;
	return null;
}

async function getQueueClip(clipId: string, ownerId: string) {
	const cached = await getTwitchCache<unknown>(TwitchCacheType.Clip, `clip:${ownerId}:${clipId}`);
	const stored = parseStoredClip(cached);
	if (stored) return stored;
	return getTwitchClip(clipId, ownerId);
}

async function resolveQueueItems(rows: Array<{ id: string; clipId: string }>, ownerId: string): Promise<QueueItem[]> {
	const limited = rows.slice(0, 15);
	const items = await Promise.all(
		limited.map(async (row) => {
			const clip = await getQueueClip(row.clipId, ownerId);
			return {
				id: row.id,
				clipId: row.clipId,
				title: clip?.title ?? row.clipId,
				creatorName: clip?.creator_name ?? "unknown",
				duration: clip?.duration ?? 0,
				thumbnailUrl: clip?.thumbnail_url ?? null,
			} satisfies QueueItem;
		}),
	);
	return items;
}

export async function getControllerQueuesAction(overlayId: string): Promise<ControllerQueueResponse | ControllerActionResult> {
	const { overlay, error } = await requireProOverlay(overlayId);
	if (!overlay) return error;

	const [viewerRows, modRows] = await Promise.all([getClipQueueByOverlayId(overlayId), getModQueue(overlay.ownerId)]);
	const [viewerQueue, modQueue] = await Promise.all([resolveQueueItems(viewerRows, overlay.ownerId), resolveQueueItems(modRows, overlay.ownerId)]);

	return { overlayId, modQueue, viewerQueue };
}

export async function runControllerAction(
	overlayId: string,
	body: { action?: string; volume?: number; clipUrl?: string } | null,
): Promise<ControllerActionResult> {
	const action = body?.action;

	if (!action) {
		return { ok: false, error: "Missing action", status: 400 };
	}

	const { overlay, error } = await requireProOverlay(overlayId);
	if (!overlay) return error;

	switch (action) {
		case "set_volume": {
			const rawVolume = Number(body?.volume);
			if (!Number.isFinite(rawVolume)) return { ok: false, error: "Invalid volume", status: 400 };
			const volume = Math.max(0, Math.min(100, Math.round(rawVolume)));
			await setPlayerVolumeForOwner(overlay.ownerId, volume);
			await sendMessage("command", { name: "volume", data: String(volume) }, overlay.ownerId);
			return { ok: true, volume };
		}
		case "clear_mod_queue": {
			await clearModQueueByBroadcasterId(overlay.ownerId);
			return { ok: true };
		}
		case "clear_viewer_queue": {
			await clearClipQueueByOverlayIdServer(overlayId);
			return { ok: true };
		}
		case "clear_all_queues": {
			await Promise.all([clearModQueueByBroadcasterId(overlay.ownerId), clearClipQueueByOverlayIdServer(overlayId)]);
			return { ok: true };
		}
		case "add_mod_clip": {
			const clipUrl = body?.clipUrl?.trim();
			if (!clipUrl) return { ok: false, error: "Missing clip URL", status: 400 };

			const clip = await handleClip(clipUrl, overlay.ownerId);
			if ("errorCode" in clip) {
				switch (clip.errorCode) {
					case 1:
					case 2:
						return { ok: false, error: "Please provide a valid Twitch clip URL.", status: 400 };
					case 3:
						return { ok: false, error: "The requested clip could not be found.", status: 404 };
					case 4:
						return { ok: false, error: "You can only add clips from this channel.", status: 400 };
					default:
						return { ok: false, error: "Unable to add this clip.", status: 400 };
				}
			}

			await addToModQueue(overlay.ownerId, clip.id);
			return {
				ok: true,
				clip: {
					clipId: clip.id,
					title: clip.title,
					creatorName: clip.creator_name,
					duration: clip.duration,
					thumbnailUrl: clip.thumbnail_url ?? null,
				},
			};
		}
		default:
			return { ok: false, error: "Unknown action", status: 400 };
	}
}
