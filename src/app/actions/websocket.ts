/* istanbul ignore file */
"use server";

import { WebSocket } from "ws";
import { getOverlayBySecret } from "@actions/database";
import { RawData } from "ws";
import { ownerSubscribers, overlaySubscribers, addSubscriber } from "@store/overlaySubscribers";

function broadcastToClients(type: string, data: object, clients: Set<WebSocket> | undefined, except?: WebSocket) {
	if (!clients) return;
	for (const client of clients) {
		if (client === except) continue;
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify({ type, data }));
		}
	}
}

export async function handleMessage(buffer: RawData, client: WebSocket) {
	const message = buffer.toString("utf8").trim();

	let parsedMessage: unknown;
	try {
		parsedMessage = JSON.parse(message);
	} catch (error) {
		console.error("Failed to parse WebSocket message:", error);
		client.close(4003);
		return;
	}

	if (!parsedMessage || typeof parsedMessage !== "object") {
		client.close(4003);
		return;
	}

	const messageObj = parsedMessage as Record<string, unknown>;

	switch (messageObj.type) {
		case "subscribe": {
			const payload = messageObj.data as { overlayId?: string; secret?: string; role?: "overlay" | "controller" } | string;
/* istanbul ignore next */
			const overlayId = typeof payload === "string" ? payload : payload?.overlayId;
/* istanbul ignore next */
			const secret = typeof payload === "string" ? undefined : payload?.secret;
			const role = typeof payload === "string" ? "overlay" : (payload?.role ?? "overlay");

			if (!overlayId || !secret) {
				client.close(4002);
				return;
			}

/* istanbul ignore next */
			const overlay = await getOverlayBySecret(overlayId, secret).catch(() => null);
			if (!overlay) {
				client.close(4002);
				return;
			}

			client.ownerId = overlay.ownerId;
			client.overlayId = overlay.id;
			client.role = role;
			clearTimeout(client.subscribeDeadline);
			addSubscriber(overlay.ownerId, overlay.id, client);

			client.send(`subscribed ${overlay.id}`);
			return;
		}
		case "command": {
			if (!client.overlayId || !client.ownerId) {
				client.close(4002);
				return;
			}
			const payload = messageObj.data as { name?: string; data?: unknown; overlayId?: string } | undefined;
			const name = payload?.name;
			if (!name || typeof name !== "string") {
				client.close(4003);
				return;
			}
			const targetOverlayId = payload?.overlayId && payload.overlayId === client.overlayId ? payload.overlayId : client.overlayId;
			broadcastToClients("command", { name, data: payload?.data ?? null }, overlaySubscribers.get(targetOverlayId));
			return;
		}
		case "state_update": {
			if (!client.overlayId || client.role !== "overlay") {
				client.close(4002);
				return;
			}
			const payload = messageObj.data;
			if (!payload || typeof payload !== "object") {
				client.close(4003);
				return;
			}
			broadcastToClients("overlay_state", payload as object, overlaySubscribers.get(client.overlayId), client);
			return;
		}
		default:
			client.close(4003);
			return;
	}
}

export async function sendMessage(type: string, data: object, broadcasterId?: string, overlayId?: string) {
	if (overlayId) {
		const clients = overlaySubscribers.get(overlayId);
/* istanbul ignore next */
		broadcastToClients(type, data, clients);
		return;
	}
	if (broadcasterId) {
		const clients = ownerSubscribers.get(broadcasterId);
/* istanbul ignore next */
		broadcastToClients(type, data, clients);
	} else {
		for (const clients of overlaySubscribers.values()) {
			broadcastToClients(type, data, clients);
		}
	}
}


