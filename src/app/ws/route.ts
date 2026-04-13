import { WebSocket, WebSocketServer } from "ws";
import { removeSubscriber } from "@store/overlaySubscribers";
import { handleMessage } from "@actions/websocket";

let heartbeatInterval: NodeJS.Timeout | null = null;

declare module "ws" {
	interface WebSocket {
		isAlive?: boolean;
		ownerId?: string | null;
		overlayId?: string | null;
		role?: "overlay" | "controller";
		subscribeDeadline?: NodeJS.Timeout;
	}
}

export function UPGRADE(client: WebSocket, server: WebSocketServer) {
	client.isAlive = true;
	client.on("pong", () => {
		client.isAlive = true;
	});

	if (!heartbeatInterval) {
		heartbeatInterval = setInterval(() => {
			for (const ws of server.clients) {
				if (!ws.isAlive) {
					ws.terminate();
					continue;
				}

				ws.isAlive = false;
				ws.ping();
			}
		}, 30 * 1000);
	}

	client.ownerId = null;
	client.overlayId = null;
	client.role = "overlay";
	client.subscribeDeadline = setTimeout(() => {
		if ((!client.ownerId || !client.overlayId) && client.readyState === client.OPEN) {
			client.close(4001);
		}
	}, 10 * 1000);

	client.on("message", async (buffer) => {
		await handleMessage(buffer, client);
	});

	const cleanup = async () => {
		clearTimeout(client.subscribeDeadline);
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
