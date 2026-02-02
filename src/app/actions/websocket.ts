"use server";

import { WebSocket } from "ws";
import { getOverlayBySecret } from "@actions/database";
import { RawData } from "ws";
import { overlaySubscribers as subscribers, addSubscriber } from "@/app/store/overlaySubscribers";

export async function handleMessage(buffer: RawData, client: WebSocket) {
	const message = buffer.toString("utf8").trim();
	const parsedMessage = JSON.parse(message);

	switch (parsedMessage.type) {
		case "subscribe": {
			const payload = parsedMessage.data as { overlayId?: string; secret?: string } | string;
			const overlayId = typeof payload === "string" ? payload : payload?.overlayId;
			const secret = typeof payload === "string" ? undefined : payload?.secret;

			if (!overlayId || !secret) {
				client.close(4002);
				return;
			}

			const overlay = await getOverlayBySecret(overlayId, secret).catch(() => null);
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

export async function sendMessage(type: string, data: object, broadcasterId?: string) {
	if (broadcasterId) {
		const clients = subscribers.get(broadcasterId);
		if (clients) {
			for (const client of clients) {
				if (client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify({ type, data }));
				}
			}
		}
	} else {
		for (const clients of subscribers.values()) {
			for (const client of clients) {
				if (client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify({ type, data }));
				}
			}
		}
	}
}
