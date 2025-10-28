import type { WebSocket } from "ws";

declare global {
	var __overlaySubscribers: Map<string, Set<WebSocket>> | undefined;
}

export const overlaySubscribers: Map<string, Set<WebSocket>> = globalThis.__overlaySubscribers ?? (globalThis.__overlaySubscribers = new Map());

// tiny helpers (optional)
export function addSubscriber(broadcaster: string, ws: WebSocket) {
	let set = overlaySubscribers.get(broadcaster);
	if (!set) {
		set = new Set<WebSocket>();
		overlaySubscribers.set(broadcaster, set);
	}
	set.add(ws);
}
export function removeSubscriber(broadcaster: string, ws: WebSocket) {
	const set = overlaySubscribers.get(broadcaster);
	if (!set) return;
	set.delete(ws);
	if (set.size === 0) overlaySubscribers.delete(broadcaster);
}
