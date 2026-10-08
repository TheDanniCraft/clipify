import "server-only";
import type { WebSocket } from "ws";
import { getOverlayRuntimeAccessInternal } from "@/server/overlays";
import { overlaySubscribers, removeSubscriber } from "@/app/store/overlaySubscribers";

/** Revalidate the server-stored subscription capability against committed policy. */
export async function revalidateOverlaySource(client: WebSocket): Promise<boolean> {
	const { overlayId, ownerId, sourceSecret } = client;
	if (client.role !== "overlay" || !overlayId || !ownerId || !sourceSecret || !overlaySubscribers.get(overlayId)?.has(client)) return refuse();
	const decision = await getOverlayRuntimeAccessInternal(overlayId, "websocket", sourceSecret).catch(() => null);
	// A concurrent resubscription must not authorize the old frame or close its new connection.
	if (client.overlayId !== overlayId || client.ownerId !== ownerId || client.sourceSecret !== sourceSecret) return false;
	if (decision?.allowed && decision.overlay.ownerId === ownerId && decision.overlay.status !== "paused" && overlaySubscribers.get(overlayId)?.has(client)) return true;
	return refuse();
	function refuse() {
		client.sourceActive = false;
		client.sourceSecret = undefined;
		if (client.ownerId && client.overlayId) removeSubscriber(client.ownerId, client.overlayId, client);
		client.close(4002);
		return false;
	}
}
