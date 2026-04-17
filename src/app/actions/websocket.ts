/* istanbul ignore file */
"use server";

import jwt from "jsonwebtoken";
import { WebSocket } from "ws";
import { getOverlayBySecret, getOverlayOwnerPlanPublic, getOverlayPublic } from "@actions/database";
import { RawData } from "ws";
import { ownerSubscribers, overlaySubscribers, addSubscriber } from "@store/overlaySubscribers";
import { Plan } from "@types";

type ControllerTokenPayload = {
	overlayId: string;
	userId: string;
	iat?: number;
	exp?: number;
};

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
			const payload = messageObj.data as { overlayId?: string; secret?: string; controllerToken?: string; role?: unknown } | string;
/* istanbul ignore next */
			const overlayId = typeof payload === "string" ? payload : payload?.overlayId;
/* istanbul ignore next */
			const secret = typeof payload === "string" ? undefined : payload?.secret;
			const controllerToken = typeof payload === "string" ? undefined : payload?.controllerToken;
			const requestedRole = typeof payload === "string" ? undefined : payload?.role;

			if (requestedRole !== undefined && requestedRole !== "overlay" && requestedRole !== "controller") {
				client.close(4003);
				return;
			}

			const role = typeof payload === "string" ? "overlay" : (requestedRole ?? "overlay");

			if (!overlayId) {
				client.close(4002);
				return;
			}

			let overlay: Awaited<ReturnType<typeof getOverlayBySecret>> | null = null;
			if (role === "controller") {
				if (!controllerToken) {
					client.close(4002);
					return;
				}
				let decoded: ControllerTokenPayload | null = null;
				try {
					decoded = jwt.verify(controllerToken, process.env.JWT_SECRET!, {
						algorithms: ["HS256"],
						issuer: "clipify-controller",
					}) as ControllerTokenPayload;
				} catch {
					client.close(4002);
					return;
				}
				if (!decoded?.overlayId || decoded.overlayId !== overlayId || !decoded.userId) {
					client.close(4002);
					return;
				}
				overlay = await getOverlayPublic(overlayId).catch(() => null);
				if (!overlay) {
					client.close(4002);
					return;
				}
				const ownerPlan = await getOverlayOwnerPlanPublic(overlay.id).catch(() => null);
				if (ownerPlan !== Plan.Pro) {
					client.close(4002);
					return;
				}
			} else {
				if (!secret) {
					client.close(4002);
					return;
				}
/* istanbul ignore next */
				overlay = await getOverlayBySecret(overlayId, secret).catch(() => null);
				if (!overlay) {
					client.close(4002);
					return;
				}
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
			if (!client.overlayId || !client.ownerId || client.role !== "controller") {
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


