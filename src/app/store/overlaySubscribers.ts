/* istanbul ignore file */
import type { WebSocket } from "ws";

declare global {
	var __ownerSubscribers: Map<string, Set<WebSocket>> | undefined;
	var __overlaySubscribers: Map<string, Set<WebSocket>> | undefined;
}

export const ownerSubscribers: Map<string, Set<WebSocket>> = globalThis.__ownerSubscribers ?? (globalThis.__ownerSubscribers = new Map());
export const overlaySubscribers: Map<string, Set<WebSocket>> = globalThis.__overlaySubscribers ?? (globalThis.__overlaySubscribers = new Map());

function addToMap(map: Map<string, Set<WebSocket>>, key: string, ws: WebSocket) {
	let set = map.get(key);
	if (!set) {
		set = new Set<WebSocket>();
		map.set(key, set);
	}
	set.add(ws);
}

function removeFromMap(map: Map<string, Set<WebSocket>>, key: string, ws: WebSocket) {
	const set = map.get(key);
	if (!set) return;
	set.delete(ws);
	if (set.size === 0) map.delete(key);
}

export function addSubscriber(ownerId: string, overlayId: string, ws: WebSocket) {
	addToMap(ownerSubscribers, ownerId, ws);
	addToMap(overlaySubscribers, overlayId, ws);
}

export function removeSubscriber(ownerId: string, overlayId: string, ws: WebSocket) {
	removeFromMap(ownerSubscribers, ownerId, ws);
	removeFromMap(overlaySubscribers, overlayId, ws);
}

// Remove sources before closing so queued activity frames cannot restore presence.
// Controllers stay connected so owners can continue managing the paused overlay.
export function disconnectOverlaySources(overlayId: string) {
	const clients = overlaySubscribers.get(overlayId);
	if (!clients) return;
	for (const client of [...clients]) {
		if (client.role !== "overlay") continue;
		client.sourceActive = false;
		if (client.ownerId) removeSubscriber(client.ownerId, overlayId, client);
		client.close(4002);
	}
}

// Presence shares the existing process-local subscription registry. Closed
// sockets disappear immediately; the existing ping/pong loop terminates hangs.
export function getActiveOverlayOwnerIds(): Set<string> {
	const owners = new Set<string>();
	for (const [ownerId, clients] of ownerSubscribers) {
		for (const client of clients) {
			if (client.role === "overlay" && client.readyState === 1 && client.sourceActive === true) {
				owners.add(ownerId);
				break;
			}
		}
	}
	return owners;
}
