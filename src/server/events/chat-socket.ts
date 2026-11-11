import "server-only";
import { WebSocket } from "ws";
import { z } from "zod";
import { activateAwardChat, filterAwardChat, readAwardChat, subscribeAwardChat } from "./chat-buffer";
import { authorizeAwardChat, connectAwardChat, enrichChatBadges } from "./chat";
import type { AwardChatBadge } from "@/app/lib/eventChat";
import { eventError } from "./persistence";

const subscription = z.object({ eventId: z.uuid(), secret: z.string().min(43).max(200), preview: z.boolean().default(false) }).strict();
export async function attachAwardChatSocket(client: WebSocket, input: unknown) {
	let closed = client.readyState !== WebSocket.OPEN,
		sequence = 0;
	let unsubscribe = () => {};
	let timer: ReturnType<typeof setInterval> | undefined;
	const dispose = () => {
		closed = true;
		unsubscribe();
		clearInterval(timer);
	};
	client.once("close", dispose);
	client.once("error", dispose);
	function send(type: string, data: unknown) {
		if (closed || client.readyState !== WebSocket.OPEN) return;
		if (client.bufferedAmount > 262144) {
			client.close(1013);
			dispose();
			return;
		}
		try {
			client.send(JSON.stringify({ type, data }));
		} catch {
			client.close(1011);
			dispose();
		}
	}
	function fail(code: string) {
		send("event_chat_error", { code });
		client.close(code === "NOT_FOUND" || code === "ACCESS_DENIED" || code === "INVALID_INPUT" ? 4002 : 1013);
		dispose();
	}
	const parsed = subscription.safeParse(input);
	if (!parsed.success) {
		fail("INVALID_INPUT");
		return;
	}
	const { eventId, secret, preview } = parsed.data;
	try {
		let binding = await authorizeAwardChat(eventId, secret, preview);
		if (closed) return;
		clearTimeout(client.subscribeDeadline);
		if (!activateAwardChat(binding.ownerId)) {
			fail("SERVICE_UNAVAILABLE");
			return;
		}
		let knownBadges = new Map<string, AwardChatBadge>();
		const push = () => {
			if (closed) return;
			const messages = filterAwardChat(readAwardChat(binding.ownerId), binding.settings);
			const current = ++sequence;
			send("event_chat_messages", { messages: messages.map((message) => ({ ...message, sevenTvBadge: knownBadges.get(message.userId ?? "") })) });
			void enrichChatBadges(messages)
				.then((enriched) => {
					if (current !== sequence || closed) return;
					knownBadges = new Map(enriched.flatMap((message) => (message.userId && message.sevenTvBadge ? [[message.userId, message.sevenTvBadge] as const] : [])));
					send("event_chat_messages", { messages: enriched });
				})
				.catch((error) => {
					eventError(error);
				});
		};
		unsubscribe = subscribeAwardChat(binding.ownerId, push);
		let checking = false;
		timer = setInterval(() => {
			if (checking || closed) return;
			checking = true;
			void authorizeAwardChat(eventId, secret, preview)
				.then((next) => {
					if (closed) return;
					binding = next;
					if (!activateAwardChat(binding.ownerId)) {
						fail("SERVICE_UNAVAILABLE");
						return;
					}
					push();
				})
				.catch((error) => fail(eventError(error).code))
				.finally(() => {
					checking = false;
				});
		}, 20000);
		const connected = await connectAwardChat(eventId, secret, preview);
		if (closed) return;
		if (!connected.ok) {
			fail(connected.code);
			return;
		}
		send("event_chat_catalog", connected.catalog);
		push();
	} catch (error) {
		fail(eventError(error).code);
	}
}
