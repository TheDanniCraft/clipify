import { addToModQueue, clearClipQueue, clearModQueueByBroadcasterId, getClipQueue, getModQueue, getOverlayBySecret, setPlayerVolumeForOwner } from "@actions/database";
import { getTwitchClip, handleClip } from "@actions/twitch";
import { sendMessage } from "@actions/websocket";

type QueueItem = {
	id: string;
	clipId: string;
	title: string;
	creatorName: string;
	duration: number;
	thumbnailUrl: string | null;
};

async function resolveQueueItems(rows: Array<{ id: string; clipId: string }>, ownerId: string): Promise<QueueItem[]> {
	const limited = rows.slice(0, 15);
	const items = await Promise.all(
		limited.map(async (row) => {
			const clip = await getTwitchClip(row.clipId, ownerId);
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

export async function GET(request: Request, { params }: { params: Promise<{ overlayId: string }> }) {
	const { overlayId } = await params;
	const url = new URL(request.url);
	const secret = url.searchParams.get("secret") ?? undefined;

	if (!secret) {
		return Response.json({ error: "Missing secret" }, { status: 400 });
	}

	const overlay = await getOverlayBySecret(overlayId, secret);
	if (!overlay) {
		return Response.json({ error: "Invalid overlay or secret" }, { status: 403 });
	}

	const [viewerRows, modRows] = await Promise.all([getClipQueue(overlayId, secret), getModQueue(overlay.ownerId)]);
	const [viewerQueue, modQueue] = await Promise.all([resolveQueueItems(viewerRows, overlay.ownerId), resolveQueueItems(modRows, overlay.ownerId)]);

	return Response.json({
		overlayId,
		modQueue,
		viewerQueue,
	});
}

export async function POST(request: Request, { params }: { params: Promise<{ overlayId: string }> }) {
	const { overlayId } = await params;
	const body = (await request.json().catch(() => null)) as { secret?: string; action?: string; volume?: number; clipUrl?: string } | null;
	const secret = body?.secret;
	const action = body?.action;

	if (!secret || !action) {
		return Response.json({ error: "Missing secret or action" }, { status: 400 });
	}

	const overlay = await getOverlayBySecret(overlayId, secret);
	if (!overlay) {
		return Response.json({ error: "Invalid overlay or secret" }, { status: 403 });
	}

	switch (action) {
		case "set_volume": {
			const rawVolume = Number(body?.volume);
			if (!Number.isFinite(rawVolume)) return Response.json({ error: "Invalid volume" }, { status: 400 });
			const volume = Math.max(0, Math.min(100, Math.round(rawVolume)));
			await setPlayerVolumeForOwner(overlay.ownerId, volume);
			await sendMessage("command", { name: "volume", data: String(volume) }, overlay.ownerId);
			return Response.json({ ok: true, volume });
		}
		case "clear_mod_queue": {
			await clearModQueueByBroadcasterId(overlay.ownerId);
			return Response.json({ ok: true });
		}
		case "clear_viewer_queue": {
			await clearClipQueue(overlayId, secret);
			return Response.json({ ok: true });
		}
		case "clear_all_queues": {
			await Promise.all([clearModQueueByBroadcasterId(overlay.ownerId), clearClipQueue(overlayId, secret)]);
			return Response.json({ ok: true });
		}
		case "add_mod_clip": {
			const clipUrl = body?.clipUrl?.trim();
			if (!clipUrl) {
				return Response.json({ error: "Missing clip URL" }, { status: 400 });
			}

			const clip = await handleClip(clipUrl, overlay.ownerId);
			if ("errorCode" in clip) {
				switch (clip.errorCode) {
					case 1:
					case 2:
						return Response.json({ error: "Please provide a valid Twitch clip URL." }, { status: 400 });
					case 3:
						return Response.json({ error: "The requested clip could not be found." }, { status: 404 });
					case 4:
						return Response.json({ error: "You can only add clips from this channel." }, { status: 400 });
					default:
						return Response.json({ error: "Unable to add this clip." }, { status: 400 });
				}
			}

			await addToModQueue(overlay.ownerId, clip.id);
			return Response.json({
				ok: true,
				clip: {
					clipId: clip.id,
					title: clip.title,
					creatorName: clip.creator_name,
					duration: clip.duration,
					thumbnailUrl: clip.thumbnail_url ?? null,
				},
			});
		}
		default:
			return Response.json({ error: "Unknown action" }, { status: 400 });
	}
}
