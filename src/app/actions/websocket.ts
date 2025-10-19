"use server";

import { WebSocket } from "ws";
import { getOverlay } from "@actions/database";
import { RawData } from "ws";
import { overlaySubscribers as subscribers, addSubscriber } from "@/app/store/overlaySubscribers";

export async function emitToOverlaySubscribers(broadcaster: string, message: string) {
	const subs = subscribers.get(broadcaster);
	if (subs) {
		for (const ws of subs) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(message);
			}
		}
	}
}

export async function handleMessage(buffer: RawData, client: WebSocket) {
	const message = buffer.toString("utf8").trim();
	const parsedMessage = JSON.parse(message);

	switch (parsedMessage.type) {
		case "subscribe": {
			const overlay = await getOverlay(parsedMessage.data).catch(() => {
				return null;
			});
			if (!overlay) {
				client.close(4002);
				return;
			}

			client.broadcaster = overlay.ownerId;
			clearTimeout(client.subscribeDeadline);
			addSubscriber(overlay.ownerId, client);

			let set = subscribers.get(overlay.ownerId);
			if (!set) {
				set = new Set();
				subscribers.set(overlay.ownerId, set);
			}
			set.add(client);

			client.send(`subscribed ${overlay.ownerId}`);
			return;
		}
		default:
			client.close(4003);
			return;
	}
}
