import { revalidateOverlaySource } from "@/server/resources/overlay-source-runtime";
import { WebSocket, WebSocketServer } from "ws";
import { removeSubscriber } from "@store/overlaySubscribers";
import { handleMessage } from "@actions/websocket";
import { recordWebSocketDisconnected, recordWebSocketRejected } from "@lib/operationalHealth";

let heartbeatInterval: NodeJS.Timeout | null = null;
let checkingRuntime = false;

declare module "ws" {
	interface WebSocket {
		isAlive?: boolean;
		ownerId?: string | null;
		overlayId?: string | null;
		role?: "overlay" | "controller";
		sourceActive?: boolean;
		sourceSecret?: string;
		subscribeDeadline?: NodeJS.Timeout;
	}
}

export function UPGRADE(client: WebSocket, server: WebSocketServer) {
	client.isAlive = true;
	client.on("pong", () => {
		client.isAlive = true;
	});

	if (!heartbeatInterval) {
		heartbeatInterval = setInterval(async () => {
			for (const ws of server.clients) {
				if (!ws.isAlive) {
					ws.terminate();
					continue;
				}

				ws.isAlive = false;
				ws.ping();
			}
			if (checkingRuntime) return;
			checkingRuntime = true;
			try {
				const sources = [...server.clients].filter((ws) => ws.readyState === WebSocket.OPEN && ws.role === "overlay" && ws.ownerId && ws.overlayId);
				for (let offset = 0; offset < sources.length; offset += 4) {
					await Promise.allSettled(sources.slice(offset, offset + 4).map(revalidateOverlaySource));
				}
			} finally {
				checkingRuntime = false;
			}
		}, 30 * 1000);
	}

	client.ownerId = null;
	client.overlayId = null;
	client.role = "overlay";
	client.subscribeDeadline = setTimeout(() => {
		if ((!client.ownerId || !client.overlayId) && client.readyState === client.OPEN) {
			recordWebSocketRejected("subscribe_timeout");
			client.close(4001);
		}
	}, 10 * 1000);

	client.on("message", async (buffer) => {
		await handleMessage(buffer, client);
	});

	const cleanup = async () => {
		clearTimeout(client.subscribeDeadline);
		recordWebSocketDisconnected(client);
		if (client.ownerId && client.overlayId) removeSubscriber(client.ownerId, client.overlayId, client);
	};

	client.once("close", () => {
		cleanup();
	});

	client.once("error", () => {
		cleanup();
	});
}

export async function GET() {
	return new Response(null, { status: 200 });
}
