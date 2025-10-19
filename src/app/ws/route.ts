import { WebSocket, WebSocketServer } from "ws";
import { overlaySubscribers as subscribers, removeSubscriber } from "@/app/store/overlaySubscribers";
import { handleMessage } from "@actions/websocket";

let heartbeatInterval: NodeJS.Timeout | null = null;

declare module "ws" {
	interface WebSocket {
		isAlive?: boolean;
		broadcaster?: string | null;
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

	client.broadcaster = null;
	client.subscribeDeadline = setTimeout(() => {
		if (!client.broadcaster && client.readyState === client.OPEN) {
			client.close(4001);
		}
	}, 10 * 1000);

	client.on("message", async (buffer) => {
		await handleMessage(buffer, client);
	});

	const cleanup = async () => {
		clearTimeout(client.subscribeDeadline);
		if (client.broadcaster) removeSubscriber(client.broadcaster, client);
	};

	client.once("close", () => {
		cleanup();
	});

	client.once("error", () => {
		cleanup();
	});
}
