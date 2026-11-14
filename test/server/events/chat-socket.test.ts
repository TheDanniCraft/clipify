/** @jest-environment node */
import { EventEmitter } from "node:events";
import { attachAwardChatSocket } from "@/server/events/chat-socket";
import { authorizeAwardChat, connectAwardChat, enrichChatBadges } from "@/server/events/chat";
import { relayAwardChat, readAwardChat } from "@/server/events/chat-buffer";
jest.mock("@/server/events/chat", () => ({ authorizeAwardChat: jest.fn(), connectAwardChat: jest.fn(), enrichChatBadges: jest.fn() }));
jest.mock("@/server/events/persistence", () => ({ eventError: () => ({ ok: false, code: "NOT_FOUND" }) }));
const input = { eventId: "243dbd2e-5393-4de7-b4bb-b4d252f70cca", secret: "s".repeat(43), preview: true };
function socket() {
	return Object.assign(new EventEmitter(), { readyState: 1, bufferedAmount: 0, send: jest.fn(), close: jest.fn() });
}
beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	jest.mocked(authorizeAwardChat).mockResolvedValue({ ownerId: input.eventId, settings: { showChat: true, hiddenAccounts: [], commandPrefixes: [] } });
	jest.mocked(connectAwardChat).mockResolvedValue({ ok: true, catalog: { badges: {}, emotes: {}, warnings: [] } });
	jest.mocked(enrichChatBadges).mockImplementation(async (messages) => messages);
});
afterEach(() => {
	jest.clearAllTimers();
	jest.useRealTimers();
});
it("pushes text before badge enrichment and removes its listener on close", async () => {
	const client = socket();
	let resolve!: (value: Awaited<ReturnType<typeof enrichChatBadges>>) => void;
	jest.mocked(enrichChatBadges).mockImplementation((messages) =>
		messages.length
			? new Promise((done) => {
					resolve = done;
				})
			: Promise.resolve(messages),
	);
	await attachAwardChatSocket(client as never, input);
	client.send.mockClear();
	relayAwardChat({ broadcaster_user_id: input.eventId, message_id: "push", chatter_user_login: "viewer", chatter_user_name: "Viewer", color: "", message: { text: "Instant text", fragments: [{ type: "text", text: "Instant text" }] }, badges: [] });
	expect(JSON.parse(client.send.mock.calls[0][0])).toMatchObject({ type: "event_chat_messages", data: { messages: expect.arrayContaining([expect.objectContaining({ text: "Instant text" })]) } });
	resolve(readAwardChat(input.eventId).map((message) => ({ ...message, sevenTvBadge: { id: "badge", name: "Badge", url: "https://cdn.7tv.app/badge/a/2x.webp" } })));
	await Promise.resolve();
	expect(client.send.mock.calls).toHaveLength(2);
	client.emit("close");
	client.send.mockClear();
	relayAwardChat({ broadcaster_user_id: input.eventId, message_id: "closed", chatter_user_login: "viewer", chatter_user_name: "Viewer", color: "", message: { text: "After close", fragments: [] }, badges: [] });
	expect(client.send).not.toHaveBeenCalled();
});
it("rechecks capabilities and disconnects revoked preview access", async () => {
	const client = socket();
	await attachAwardChatSocket(client as never, input);
	jest.mocked(authorizeAwardChat).mockRejectedValueOnce(new Error("revoked"));
	await jest.advanceTimersByTimeAsync(20000);
	expect(client.close).toHaveBeenCalledWith(4002);
});
it("rejects invalid capabilities before subscribing upstream", async () => {
	const client = socket();
	jest.mocked(authorizeAwardChat).mockRejectedValueOnce(new Error("denied"));
	await attachAwardChatSocket(client as never, input);
	expect(client.close).toHaveBeenCalledWith(4002);
	expect(connectAwardChat).not.toHaveBeenCalled();
});
